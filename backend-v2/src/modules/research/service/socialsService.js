// backend-v2/src/modules/research/service/socialsService.js
//
// Social Presence Engine
// v2.x – Generic for ALL industries
//
// Sorumluluk:
// - Lead'in web sitesi HTML'inden sosyal medya linklerini çıkarmak
// - OSINT web search sonuçlarındaki sosyal profil linklerini birleştirmek
// - Tek bir social_presence JSON'u üretmek:
//   {
//     instagram, facebook, linkedin, youtube, tiktok,
//     activity_score: 0-100,
//     raw_links: [...],
//     summary: string
//   }
//
// Not: Bu modül tamamen sektör bağımsızdır. Hiçbir sektöre özel kural yoktur.

const axios = require('axios');
const { URL } = require('url');
const { runWebSearch } = require('./websearchService');

/**
 * Bilinen sosyal platform host pattern'leri
 */
const PLATFORM_PATTERNS = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com'],
  linkedin: ['linkedin.com'],
  youtube: ['youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com'],
  twitter: ['twitter.com', 'x.com'],
  pinterest: ['pinterest.com'],
  behance: ['behance.net'],
  dribbble: ['dribbble.com']
};

/**
 * Ana public fonksiyon
 * @param {Object} lead - potential_leads satırı
 * @returns {Promise<Object>} social_presence
 */
async function detectSocials(lead) {
  const website = (lead && lead.website) || null;

  let linksFromWebsite = [];
  let linksFromOsint = [];

  // 1) Website HTML → Sosyal linkler
  if (website) {
    try {
      const html = await safeFetchHtml(website);
      if (html) {
        linksFromWebsite = extractSocialLinksFromHtml(html, website);
      }
    } catch (err) {
      console.warn('[socials] Website HTML çekme hatası:', err.message);
    }
  }

  // 2) OSINT (web search) → third_party_profiles içinden sosyal linkler
  try {
    const webPresence = await runWebSearch(lead);
    linksFromOsint = extractSocialLinksFromWebPresence(webPresence);
  } catch (err) {
    console.warn('[socials] Web search / OSINT hatası:', err.message);
  }

  // 3) Linkleri birleştir + dedupe
  const raw_links = dedupeLinks([...linksFromWebsite, ...linksFromOsint]);
  const byPlatform = groupByPlatform(raw_links);

  // 4) Normalize edilmiş çıktı
  const normalized = {
    instagram: pickFirstByPlatform(byPlatform.instagram, 'instagram'),
    facebook: pickFirstByPlatform(byPlatform.facebook, 'facebook'),
    linkedin: pickFirstByPlatform(byPlatform.linkedin, 'linkedin'),
    youtube: pickFirstByPlatform(byPlatform.youtube, 'youtube'),
    tiktok: pickFirstByPlatform(byPlatform.tiktok, 'tiktok'),
    // Ek platformlar (şu an raporluyoruz ama LLM kullanıp kullanmamak serbest)
    twitter: pickFirstByPlatform(byPlatform.twitter, 'twitter'),
    behance: pickFirstByPlatform(byPlatform.behance, 'behance'),
    dribbble: pickFirstByPlatform(byPlatform.dribbble, 'dribbble'),
    pinterest: pickFirstByPlatform(byPlatform.pinterest, 'pinterest')
  };

  // 5) Activity score (basit, sektör bağımsız metrik)
  const presentPlatforms = Object.keys(normalized).filter((k) => !!normalized[k]);
  const activity_score = Math.min(100, presentPlatforms.length * 20);

  // 6) Özlü özet
  let summary;
  if (raw_links.length === 0) {
    summary =
      'Web sitesi ve açık web taramasında bu firma için herhangi bir sosyal medya profili tespit edilemedi.';
  } else {
    summary =
      'Web sitesi HTML analizi ve açık web araması sonucunda aşağıdaki sosyal medya platformlarında profiller tespit edildi: ' +
      presentPlatforms.join(', ') +
      '.';
  }

  return {
    instagram: normalized.instagram,
    facebook: normalized.facebook,
    linkedin: normalized.linkedin,
    youtube: normalized.youtube,
    tiktok: normalized.tiktok,
    twitter: normalized.twitter,
    behance: normalized.behance,
    dribbble: normalized.dribbble,
    pinterest: normalized.pinterest,
    activity_score,
    raw_links,
    summary
  };
}

/**
 * Website HTML içeriklerini güvenli şekilde çeker
 */
async function safeFetchHtml(url) {
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CNG-AI-Agent-SocialsBot/1.0; +https://cngmedya.com)'
      }
    });

    if (typeof res.data === 'string') {
      return res.data;
    }

    if (Buffer.isBuffer(res.data)) {
      return res.data.toString('utf8');
    }

    return '';
  } catch (err) {
    console.warn('[socials] safeFetchHtml hata:', err.message);
    return '';
  }
}

/**
 * Basit regex ile HTML içinden href URL’lerini toplar ve sosyal olanları filtreler
 */
function extractSocialLinksFromHtml(html, baseUrl) {
  if (!html || typeof html !== 'string') return [];

  const links = [];
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    const url = normalizeUrl(href, baseUrl);
    if (!url) continue;

    const platform = detectPlatformFromUrl(url);
    if (!platform) continue;

    links.push({
      platform,
      url,
      source: 'website_html'
    });
  }

  return links;
}

/**
 * Web search OSINT sonuçlarından sosyal linkleri çıkarır.
 * Beklenen yapı (websearchService.runWebSearch çıktısı):
 * {
 *   directories: [],
 *   news_mentions: [],
 *   blog_mentions: [],
 *   third_party_profiles: [{ url, hostname, platforms: [...] }],
 *   ...
 * }
 */
function extractSocialLinksFromWebPresence(webPresence) {
  if (!webPresence || !Array.isArray(webPresence.third_party_profiles)) {
    return [];
  }

  const result = [];

  for (const item of webPresence.third_party_profiles) {
    if (!item || !item.url) continue;

    const url = String(item.url).trim();
    const platforms = Array.isArray(item.platforms) ? item.platforms : [];
    const detected = platforms.length
      ? platforms
      : [detectPlatformFromUrl(url)].filter(Boolean);

    for (const platform of detected) {
      result.push({
        platform,
        url,
        source: 'web_osint',
        hostname: item.hostname || null
      });
    }
  }

  return result;
}

/**
 * URL’yi normalize eder (relative -> absolute vs.)
 */
function normalizeUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;

  try {
    // mailto:, tel:, javascript: vs. atla
    if (/^(mailto:|tel:|javascript:)/i.test(rawUrl)) return null;

    // Absolute URL
    if (/^https?:\/\//i.test(rawUrl)) {
      return new URL(rawUrl).toString();
    }

    if (!baseUrl) return null;

    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * URL host’una göre hangi sosyal platform olduğunu bulur.
 */
function detectPlatformFromUrl(url) {
  try {
    const u = new URL(url);
    const host = (u.hostname || '').toLowerCase();

    for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
      if (patterns.some((p) => host.includes(p))) {
        return platform;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Linkleri URL + platform bazında dedup eder
 */
function dedupeLinks(links) {
  const seen = new Set();
  const out = [];

  for (const link of links) {
    if (!link || !link.url || !link.platform) continue;

    const key = `${link.platform}::${link.url}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(link);
  }

  return out;
}

/**
 * Platform adına göre gruplanmış liste döner
 */
function groupByPlatform(links) {
  const out = {};

  for (const link of links) {
    const platform = link.platform;
    if (!platform) continue;

    if (!out[platform]) out[platform] = [];
    out[platform].push(link);
  }

  return out;
}

/**
 * Eski API ile geriye dönük uyumluluk:
 *
 * Daha önce:
 *   pickFirstByPlatform(socials, 'instagram')
 *   // socials: [{ platform, url }, ...]
 *
 * Şimdi:
 *   socials parametresi genelde bir platform listesi olacak.
 */
function pickFirstByPlatform(socials, platformName) {
  if (!Array.isArray(socials) || socials.length === 0) return null;

  // Eğer her eleman aynı platform ise direkt ilkini döndür
  const first = socials[0];
  if (!first.platform || first.platform === platformName) {
    return first;
  }

  const match = socials.find((s) => s.platform === platformName);
  return match || first || null;
}

module.exports = {
  detectSocials,
  pickFirstByPlatform
};