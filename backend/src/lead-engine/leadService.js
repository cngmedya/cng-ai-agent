// backend/src/lead-engine/leadService.js

const { searchGooglePlacesWithDetails } = require("./google/googleScraper");
const { parseGooglePlaces } = require("./google/googleParser");
const { searchLinkedinCompanies } = require("./linkedin/linkedinScraper");
const { parseLinkedinCompanies } = require("./linkedin/linkedinParser");
const { mergeSources } = require("./analyzer/mergeEngine");
const { callAgent } = require("../services/aiService");

const { fetchWebsiteHtml } = require("../firmographic/websiteFetcher");
const { analyzeWebsite } = require("../firmographic/websiteAnalyzer");
const { log } = require("../lib/logger");

/**
 * Lead'leri firmographic verilerle zenginleştirir.
 * Şimdilik sadece ilk N firma için deep analiz yapıyoruz (performans için).
 */
async function enrichLeadsWithFirmographic(
  leads,
  { sector, location, maxDeep = 5 }
) {
  const enriched = await Promise.all(
    leads.map(async (lead, index) => {
      const website =
        lead.source?.google?.website ||
        lead.website ||
        null;

      // Website yoksa ya da deep limit dışındaysa, firmographic ekleme
      if (!website || index >= maxDeep) {
        return {
          ...lead,
          websiteUrl: website,
          firmographic: null,
        };
      }

      try {
        const fetchResult = await fetchWebsiteHtml(website);

        if (!fetchResult) {
          log.warn(
            "[Firmographic] Fetch sonucu null, analiz atlanıyor:",
            website
          );
          return {
            ...lead,
            websiteUrl: website,
            firmographic: null,
          };
        }

        const { html, finalUrl } = fetchResult;

        if (!html) {
          log.warn(
            "[Firmographic] HTML boş döndü, analiz atlanıyor:",
            finalUrl || website
          );
          return {
            ...lead,
            websiteUrl: finalUrl || website,
            firmographic: null,
          };
        }

        const metrics = analyzeWebsite(html);

        return {
          ...lead,
          websiteUrl: finalUrl || website,
          firmographic: metrics,
        };
      } catch (err) {
        log.error(
          "Firmographic enrich error for lead:",
          lead.name,
          err && err.message ? err.message : err
        );
        return {
          ...lead,
          websiteUrl: website,
          firmographic: null,
        };
      }
    })
  );

  return enriched;
}

/**
 * Lokasyon + sektör bazlı temel lead araması
 * Google Places + LinkedIn placeholder + skor hesaplama + firmographic
 *
 * DÖNÜŞ: [ lead, lead, ... ]  → DİZİ!
 */
async function searchLeadsBasic({ sector, location, limit = 10 }) {
  log.info("Lead search basic:", { sector, location, limit });

  // 1) Google Places'ten (website dahil) ham veriyi çek
  const googleRaw = await searchGooglePlacesWithDetails({
    query: sector,
    location,
    limit,
  });

  // 2) Google verisini normalize et
  const googleParsed = parseGooglePlaces(googleRaw);

  // 3) Her Google kaydı için LinkedIn'den (şimdilik stub) veri çek
  const linkedinRawAll = await Promise.all(
    googleParsed.map((g) =>
      searchLinkedinCompanies({
        companyName: g.name,
        location,
      })
    )
  );

  // 4) LinkedIn sonuçlarını normalize et
  const linkedinParsedAll = linkedinRawAll
    .map((arr) => parseLinkedinCompanies(arr))
    .flat();

  // 5) Google + LinkedIn verilerini tekil lead objelerine merge et (scores dahil)
  const merged = mergeSources(googleParsed, linkedinParsedAll);

  // 6) İlk N firma için otomatik website + firmographic analizi yap
  const enriched = await enrichLeadsWithFirmographic(merged, {
    sector,
    location,
    maxDeep: 5, // ileride config'e alabiliriz
  });

  // 🔵 ÖNEMLİ: SADECE DİZİ DÖNÜYORUZ
  return enriched;
}

/**
 * AI destekli lead özeti – UI'da "Bugünün Fırsatları" gibi göstereceğiz.
 *
 * DÖNÜŞ: { leads: [...], aiSummary: "..." }
 */
async function searchLeadsWithAiSummary({ sector, location, limit = 10 }) {
  // searchLeadsBasic doğrudan DİZİ döner
  const mergedLeads = await searchLeadsBasic({
    sector,
    location,
    limit,
  });

  const summaryInput = mergedLeads
    .map((l, idx) => {
      const firmoScore = l.firmographic?.scores?.totalScore ?? "NA";

      return `${idx + 1}. ${l.name} – Lead Skoru: ${
        l.scores.totalScore
      } (${l.scores.opportunity}) – Firmographic Skor: ${firmoScore} – Adres: ${
        l.address || "bilinmiyor"
      }`;
    })
    .join("\n");

  const systemPrompt =
    "Sen CNG Medya için tasarlanmış Lead Intelligence motorusun. Ajans için en mantıklı satış fırsatlarını çıkarırsın.";
  const userMessage = `
Sektör: ${sector}
Lokasyon: ${location}

Aşağıda skorlanmış potansiyel firmalar var (lead skoru + firmographic skoru birlikte):

${summaryInput}

Görev:
- En yüksek fırsatlı 3 firmayı seç
- Neden fırsat olduğunu kısaca açıkla
- Web/kurumsal kimlik, sosyal medya ve reklam tarafında CNG Medya'nın hangi hizmetleriyle girebileceğini öner
- Kısa bir aksiyon listesi ver (ör: Önce şu firmayı ara, sonra bunu maille yokla)
`;

  const aiSummary = await callAgent({ systemPrompt, userMessage });

  return {
    leads: mergedLeads,
    aiSummary,
  };
}

module.exports = { searchLeadsBasic, searchLeadsWithAiSummary };