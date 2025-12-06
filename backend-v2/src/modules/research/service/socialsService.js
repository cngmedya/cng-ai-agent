// backend-v2/src/modules/research/service/socialsService.js
//
// Social Presence / OSINT Engine v2.0
// - Lead'in web sitesini tarayıp sosyal medya linklerini tespit eder
// - Instagram / Facebook / LinkedIn / YouTube / TikTok odaklı çalışır
// - Çıktı shape'i RESEARCH pipeline ile uyumludur:
//   {
//     instagram: string | null,
//     facebook:  string | null,
//     linkedin:  string | null,
//     youtube:   string | null,
//     tiktok:    string | null,
//     activity_score: number (0–100),
//     raw_links: string[],
//     summary: string
//   }

const { fetchWebsiteSnapshot } = require('../../../shared/web/fetchWebsite');

const SOCIAL_DOMAINS = {
  instagram: 'instagram.com',
  facebook: 'facebook.com',
  linkedin: 'linkedin.com',
  youtube: 'youtube.com',
  tiktok: 'tiktok.com'
};

function basePresence() {
  return {
    instagram: null,
    facebook: null,
    linkedin: null,
    youtube: null,
    tiktok: null,
    activity_score: 0,
    raw_links: [],
    summary: 'Sosyal medya faaliyeti tespit edilemedi.'
  };
}

/**
 * Ana giriş noktası:
 * detectSocials(lead) → social_presence JSON
 */
async function detectSocials(lead) {
  if (!lead || !lead.website) {
    return {
      ...basePresence(),
      summary: 'Lead için web sitesi bilgisi olmadığından sosyal medya analizi yapılamadı.'
    };
  }

  let html = '';
  let finalUrl = lead.website;

  try {
    const snapshot = await fetchWebsiteSnapshot(lead.website);

    if (typeof snapshot === 'string') {
      html = snapshot;
    } else if (snapshot && typeof snapshot === 'object') {
      html = snapshot.html || snapshot.content || '';
      finalUrl = snapshot.finalUrl || finalUrl;
    }
  } catch (err) {
    console.warn('[socialsService] fetchWebsiteSnapshot hata:', err.message);
    return {
      ...basePresence(),
      summary: 'Web sitesi çekilirken hata oluştu, sosyal medya analizi tamamlanamadı.'
    };
  }

  html = (html || '').toString();

  // HTML içinden tüm sosyal linkleri çıkar
  const rawLinks = extractLinks(html);
  const socialLinks = filterSocialLinks(rawLinks);

  const normalized = normalizeByPlatform(socialLinks, finalUrl);
  const activity_score = computeActivityScore(normalized);

  const platformsActive = Object.entries(normalized)
    .filter(([key]) => key !== 'activity_score' && key !== 'raw_links' && key !== 'summary')
    .filter(([, value]) => !!value)
    .map(([key]) => key);

  let summary;
  if (platformsActive.length === 0) {
    summary = 'Web sitesinde doğrudan sosyal medya bağlantısı tespit edilemedi.';
  } else {
    summary = `Web sitesinde şu platformlara ait bağlantılar bulundu: ${platformsActive.join(
      ', '
    )}. Aktivite skoru: ${activity_score}/100.`;
  }

  return {
    instagram: normalized.instagram,
    facebook: normalized.facebook,
    linkedin: normalized.linkedin,
    youtube: normalized.youtube,
    tiktok: normalized.tiktok,
    activity_score,
    raw_links: socialLinks.map((l) => l.url),
    summary
  };
}

/**
 * Basit link extractor
 * href="https://...." + fallback olarak genel URL regexi
 */
function extractLinks(html) {
  const links = new Set();

  // 1) href="…"
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    links.add(match[1]);
  }

  // 2) fallback: düz URL yakalayıcı
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  while ((match = urlRegex.exec(html)) !== null) {
    links.add(match[0]);
  }

  return Array.from(links);
}

/**
 * Sadece sosyal domain içeren linkleri filtrele
 */
function filterSocialLinks(urls) {
  const result = [];

  for (const url of urls) {
    const lower = url.toLowerCase();

    for (const [platform, domain] of Object.entries(SOCIAL_DOMAINS)) {
      if (lower.includes(domain)) {
        result.push({ platform, url });
        break;
      }
    }
  }

  return result;
}

/**
 * Platform bazında normalize et:
 * - Her platform için ilk bulunan URL’i seç
 * - Domain / trailing slash / query vs. ile çok uğraşmıyoruz, sadece temizliyoruz
 */
function normalizeByPlatform(socialLinks, finalUrl) {
  const out = {
    instagram: null,
    facebook: null,
    linkedin: null,
    youtube: null,
    tiktok: null
  };

  for (const { platform, url } of socialLinks) {
    if (!out[platform]) {
      out[platform] = sanitizeUrl(url);
    }
  }

  // Bazı sitelerde ikon linkleri relatif olabilir, çok basic fix:
  for (const key of Object.keys(out)) {
    const val = out[key];
    if (val && val.startsWith('/')) {
      try {
        const u = new URL(finalUrl);
        out[key] = `${u.protocol}//${u.host}${val}`;
      } catch {
        // finalUrl parse edilemezse olduğu gibi bırak
      }
    }
  }

  return out;
}

function sanitizeUrl(url) {
  // Query ve fragment kısmını temel düzeyde temizle
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`.replace(/\/+$/, '');
  } catch {
    return url;
  }
}

/**
 * Aktivite skoru:
 * - Sadece presence bazlı çok kaba bir skor
 * - Her aktif platform = +20, max 100
 */
function computeActivityScore(presence) {
  const platforms = ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok'];
  const count = platforms.filter((p) => !!presence[p]).length;
  const score = Math.min(100, count * 20);
  return score;
}

module.exports = {
  detectSocials
};