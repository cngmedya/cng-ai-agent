// backend/src/modules/lead-acquisition/services/leadSearchEngineService.js

const { log } = require("../../../lib/logger");

/**
 * Firma adı + şehir + sektör ile akıllı Google arama sorgusu üretir
 * Örn:
 *  - "Mimaristudio İstanbul iç mimarlık yorum şikayet inceleme"
 */
function buildGoogleQuery({ companyName, city, category }) {
  const parts = [];

  if (companyName) parts.push(companyName);
  if (city) parts.push(city);
  if (category) parts.push(category);

  // Arama amaçlı ek keyword'ler
  parts.push("yorum");
  parts.push("şikayet");
  parts.push("hakkında");
  parts.push("inceleme");

  return parts.join(" ").trim();
}

/**
 * MOCK GOOGLE SEARCH API (V1)
 * 
 * Şimdilik:
 *  - 5 adet sahte ama gerçekçi sonuç döndürüyor
 *  - Title, snippet ve URL normalleştirilmiş geliyor
 * 
 * V2'de:
 *  - Gerçek Custom Search API
 *  - Rate limit yönetimi
 *  - Query scoring
 */
async function mockGoogleSearch(query) {
  log.info("[SearchIntel] MOCK Google Search çağrısı", { query });

  // Örnek domainler (randomlaştırılabilir)
  const demoDomains = [
    "yorumkitap.com",
    "sikayetvar.com",
    "blogspot.com",
    "medium.com",
    "mimarlikhaber.com",
  ];

  const mockResults = demoDomains.map((domain, i) => ({
    title: `Mock Arama Sonucu ${i + 1} - ${query}`,
    snippet: `Bu, '${query}' için oluşturulmuş örnek snippet ${i + 1}.`,
    url: `https://${domain}/example-${i + 1}`,
    domain,
  }));

  return mockResults;
}

/**
 * Domain çıkarma helper
 */
function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace("www.", "");
  } catch (err) {
    return null;
  }
}

/**
 * Complaint / Review site flag'leri
 */
function analyzeDomainFlags(domain) {
  if (!domain) return { isComplaint: false, isReview: false };

  const d = domain.toLowerCase();

  const complaintSites = ["sikayetvar.com", "sikayet.com", "complaintsboard.com"];
  const reviewSites = ["trustpilot.com", "yorumkitap.com", "ekşisözlük.com"];

  return {
    isComplaint: complaintSites.some((c) => d.includes(c)),
    isReview: reviewSites.some((r) => d.includes(r)),
  };
}

/**
 * Search sonuçlarını normalize eder:
 *  title, snippet, url, domain, flags
 */
function normalizeSearchResults(rawResults) {
  return rawResults.map((r) => {
    const domain = extractDomain(r.url);
    const flags = analyzeDomainFlags(domain);

    return {
      title: r.title,
      snippet: r.snippet,
      url: r.url,
      domain,
      isComplaint: flags.isComplaint,
      isReview: flags.isReview,
    };
  });
}

/**
 * Lead Search Engine Ana Fonksiyon (SKELETON)
 *
 * Input:
 *  { companyName, city, category }
 *
 * Output:
 *  { query, results }
 */
async function searchLeadOnGoogle({ companyName, city, category }) {
  const query = buildGoogleQuery({ companyName, city, category });

  // V1 → MOCK
  const rawResults = await mockGoogleSearch(query);

  const results = normalizeSearchResults(rawResults);

  log.info("[SearchIntel] normalized Google Search sonuçları", {
    query,
    count: results.length,
  });

  return {
    query,
    engine: "mock_google",
    results,
  };
}

module.exports = {
  buildGoogleQuery,
  mockGoogleSearch,
  normalizeSearchResults,
  searchLeadOnGoogle,
};