// backend-v2/src/modules/research/service/websearchService.js
//
// Premium OSINT Web Search Engine v1.0
// - Çoklu arama sorgusu üretir
// - (Opsiyonel) SerpAPI / Bing API entegrasyonuna hazır
// - Sonuçları normalize eder
// - Kategoriye ayırır (directory, news, blog, profile vs.)
// - Sosyal medya ve platform tespiti yapar
// - Risk & reputasyon flag'leri çıkarır
// - CIR için "web_presence" çıktısını hazırlar

const axios = require('axios');
const { URL } = require('url');

/**
 * Ana fonksiyon:
 * runWebSearch(lead) → web_presence JSON
 *
 * @param {Object} lead
 * @returns {Promise<Object>}
 */
async function runWebSearch(lead) {
  const queries = buildQueriesFromLead(lead);

  // Eğer API key yoksa bile, mimariyi bozmadan boş sonuç döner.
  const serpApiKey = process.env.SERPAPI_KEY || null;
  const bingApiKey = process.env.BING_SEARCH_KEY || null;

  let rawResults = [];

  for (const q of queries) {
    // SerpAPI
    if (serpApiKey) {
      const serpResults = await safeSerpApiSearch(q, serpApiKey);
      rawResults = rawResults.concat(serpResults);
    }

    // Bing (opsiyonel)
    if (bingApiKey) {
      const bingResults = await safeBingSearch(q, bingApiKey);
      rawResults = rawResults.concat(bingResults);
    }
  }

  // Eğer hiçbir API yoksa, yine de boş ama tutarlı bir yapı döneriz
  const normalized = normalizeAndDeduplicate(rawResults);

  const {
    directories,
    newsMentions,
    blogMentions,
    thirdPartyProfiles,
    riskFlags
  } = categorizeResults(normalized);

  const searchKeywordsDetected = extractKeywordSignals(queries, normalized);

  return {
    directories,
    news_mentions: newsMentions,
    blog_mentions: blogMentions,
    third_party_profiles: thirdPartyProfiles,
    search_keywords_detected: searchKeywordsDetected,
    risk_or_reputation_flags: riskFlags
  };
}

/**
 * Lead'den arama sorguları üretir.
 * Ör: "Hane Mimarlık", "Hane Mimarlık Üsküdar", "Hane Mimarlık mimarlık ofisi"
 */
function buildQueriesFromLead(lead) {
  const queries = new Set();

  if (lead.name) {
    queries.add(lead.name);
    if (lead.city) queries.add(`${lead.name} ${lead.city}`);
    if (lead.category) queries.add(`${lead.name} ${lead.category}`);
  }

  if (lead.address && lead.name) {
    queries.add(`${lead.name} ${lead.address}`);
  }

  // Çok boş kalmasın diye kategori + şehir fallback
  if (!lead.name && lead.category && lead.city) {
    queries.add(`${lead.category} ${lead.city}`);
  }

  // En azından 1 sorgu olsun
  if (queries.size === 0 && lead.id) {
    queries.add(`"${lead.id}"`);
  }

  return Array.from(queries);
}

/**
 * SerpAPI araması (Google Search proxy)
 * Dönen sonuçları basit formatta döner:
 * { title, snippet, url, source: 'serpapi' }
 */
async function safeSerpApiSearch(query, apiKey) {
  try {
    const params = {
      api_key: apiKey,
      engine: 'google',
      q: query,
      hl: 'tr',
      num: 10
    };

    const res = await axios.get('https://serpapi.com/search', { params });
    const organic = (res.data && res.data.organic_results) || [];

    return organic
      .filter(r => r.link)
      .map(r => ({
        title: r.title || '',
        snippet: r.snippet || '',
        url: r.link,
        source: 'serpapi'
      }));
  } catch (err) {
    console.warn('[websearch] SerpAPI hata:', err.message);
    return [];
  }
}

/**
 * Bing Search entegrasyonu (opsiyonel)
 */
async function safeBingSearch(query, apiKey) {
  try {
    const res = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
      params: { q: query, count: 10 },
      headers: { 'Ocp-Apim-Subscription-Key': apiKey }
    });

    const webPages = res.data && res.data.webPages && res.data.webPages.value;
    if (!webPages || !Array.isArray(webPages)) return [];

    return webPages
      .filter(r => r.url)
      .map(r => ({
        title: r.name || '',
        snippet: r.snippet || r.description || '',
        url: r.url,
        source: 'bing'
      }));
  } catch (err) {
    console.warn('[websearch] Bing hata:', err.message);
    return [];
  }
}

/**
 * Sonuçları normalize eder ve URL bazlı deduplication yapar
 */
function normalizeAndDeduplicate(rawResults) {
  const seen = new Set();
  const normalized = [];

  for (const r of rawResults) {
    if (!r || !r.url) continue;

    const urlStr = String(r.url).trim();
    if (!urlStr) continue;

    if (seen.has(urlStr)) continue;
    seen.add(urlStr);

    const { hostname } = safeParseUrl(urlStr);

    normalized.push({
      title: (r.title || '').trim(),
      snippet: (r.snippet || '').trim(),
      url: urlStr,
      hostname,
      source: r.source || 'unknown',
      type: classifyResultType(urlStr, hostname),
      platforms: detectPlatforms(urlStr, hostname)
    });
  }

  return normalized;
}

/**
 * URL güvenli parse
 */
function safeParseUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return {
      hostname: u.hostname || null
    };
  } catch {
    return { hostname: null };
  }
}

/**
 * Sonucu kaba kategorilere ayırır.
 */
function classifyResultType(url, hostname) {
  const h = (hostname || '').toLowerCase();
  const u = (url || '').toLowerCase();

  // Direkt sosyal medya domain'leri
  if (isSocialDomain(h)) return 'social_profile';

  // Dizinler
  if (
    h.includes('yelp.') ||
    h.includes('yellowpages') ||
    h.includes('foursquare.') ||
    h.includes('maps.google.') ||
    h.includes('mapquest.') ||
    h.includes('firmarehberi') ||
    h.includes('yellowpages') ||
    h.includes('tr.firmalar')
  ) {
    return 'directory';
  }

  // Haber siteleri
  if (
    h.includes('hurriyet.') ||
    h.includes('milliyet.') ||
    h.includes('ntv.') ||
    h.includes('bbc.') ||
    h.includes('nytimes.') ||
    h.includes('bloomberg.') ||
    h.includes('haber') ||
    h.includes('news')
  ) {
    return 'news';
  }

  // Blog platformları
  if (
    h.includes('medium.') ||
    h.includes('blogspot.') ||
    h.includes('wordpress.') ||
    h.includes('substack.') ||
    u.includes('/blog/')
  ) {
    return 'blog';
  }

  // Review / şikayet
  if (
    h.includes('sikayetvar.') ||
    h.includes('complaint') ||
    h.includes('trustpilot.') ||
    h.includes('reviews.')
  ) {
    return 'review';
  }

  // Mimarlık & tasarım odaklı platformlar
  if (
    h.includes('archilovers.') ||
    h.includes('houzz.') ||
    h.includes('behance.') ||
    h.includes('dribbble.')
  ) {
    return 'creative_platform';
  }

  return 'generic';
}

/**
 * Sosyal medya domain kontrolü
 */
function isSocialDomain(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  return (
    h.includes('instagram.') ||
    h.includes('facebook.') ||
    h.includes('linkedin.') ||
    h.includes('twitter.') ||
    h.includes('x.com') ||
    h.includes('youtube.') ||
    h.includes('tiktok.')
  );
}

/**
 * URL'den platform türlerini keşfeder
 */
function detectPlatforms(url, hostname) {
  const platforms = [];
  const h = (hostname || '').toLowerCase();
  const u = (url || '').toLowerCase();

  if (h.includes('instagram.')) platforms.push('instagram');
  if (h.includes('facebook.')) platforms.push('facebook');
  if (h.includes('linkedin.')) platforms.push('linkedin');
  if (h.includes('twitter.') || h.includes('x.com')) platforms.push('twitter');
  if (h.includes('youtube.')) platforms.push('youtube');
  if (h.includes('tiktok.')) platforms.push('tiktok');
  if (h.includes('behance.')) platforms.push('behance');
  if (h.includes('dribbble.')) platforms.push('dribbble');
  if (h.includes('archilovers.')) platforms.push('archilovers');
  if (h.includes('houzz.')) platforms.push('houzz');
  if (h.includes('pinterest.')) platforms.push('pinterest');

  // Basit fallback: URL pattern
  if (u.includes('instagram.com')) platforms.push('instagram');
  if (u.includes('facebook.com')) platforms.push('facebook');
  if (u.includes('linkedin.com')) platforms.push('linkedin');

  // Duplicates temizle
  return Array.from(new Set(platforms));
}

/**
 * Sonuçları türlerine göre kategorize eder
 */
function categorizeResults(normalized) {
  const directories = [];
  const newsMentions = [];
  const blogMentions = [];
  const thirdPartyProfiles = [];
  const riskFlags = [];

  for (const item of normalized) {
    const payload = {
      title: item.title,
      snippet: item.snippet,
      url: item.url,
      hostname: item.hostname,
      source: item.source,
      type: item.type,
      platforms: item.platforms
    };

    switch (item.type) {
      case 'directory':
        directories.push(payload);
        break;
      case 'news':
        newsMentions.push(payload);
        break;
      case 'blog':
        blogMentions.push(payload);
        break;
      case 'social_profile':
      case 'creative_platform':
      case 'review':
      case 'generic':
      default:
        thirdPartyProfiles.push(payload);
        break;
    }

    const riskItems = scanForRisks(item);
    if (riskItems.length > 0) {
      riskFlags.push(...riskItems);
    }
  }

  return {
    directories,
    newsMentions,
    blogMentions,
    thirdPartyProfiles,
    riskFlags
  };
}

/**
 * Risk / itibar problemleri için basit kelime taraması.
 * Hem Türkçe hem İngilizce kritik kelimeler.
 */
function scanForRisks(item) {
  const text = `${item.title} ${item.snippet}`.toLowerCase();

  const riskKeywords = [
    'şikayet',
    'dolandırıc',
    'mahkeme',
    'dava',
    'ceza',
    'skandal',
    'problem',
    'memnuniyetsizlik',
    'rezalet',
    'scam',
    'fraud',
    'lawsuit',
    'bad review',
    'complaint',
    'warning'
  ];

  const found = riskKeywords.filter((kw) => text.includes(kw));
  if (found.length === 0) return [];

  return [
    {
      type: 'reputation_risk',
      keywords: found,
      url: item.url,
      snippet: item.snippet
    }
  ];
}

/**
 * Hangi keywordlerin SERP sonuçlarında tekrar tekrar geçtiğini bulur
 * → CIR içindeki "search_keywords_detected" alanına gider.
 */
function extractKeywordSignals(queries, normalizedResults) {
  const textBlob = normalizedResults
    .map((r) => `${r.title} ${r.snippet}`.toLowerCase())
    .join(' ');

  const tokens = textBlob
    .split(/[\s,.;:!?()"'”“’]+/g)
    .filter((t) => t && t.length > 3);

  const freq = new Map();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }

  // Sık çıkan keywordleri al (çok genel kelimeleri filtrelemek istersek stop-word listesi ekleyebiliriz)
  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30) // ilk 30
    .map(([word, count]) => ({ word, count }));

  // Arama sorgularında geçen önemli kelimeleri de highlight edebiliriz
  const queryWords = Array.from(
    new Set(
      queries
        .join(' ')
        .toLowerCase()
        .split(/\s+/g)
        .filter((w) => w.length > 3)
    )
  );

  return {
    top_terms: sorted,
    query_terms: queryWords
  };
}

module.exports = {
  runWebSearch
};