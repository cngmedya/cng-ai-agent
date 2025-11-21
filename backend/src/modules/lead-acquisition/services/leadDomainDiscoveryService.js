// backend/src/modules/lead-acquisition/services/leadDomainDiscoveryService.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");
const websiteIntelService = require("./websiteIntelService");

/**
 * Türkçe karakterleri domain uyumlu hale getir
 */
function toAscii(str) {
  if (!str) return "";
  return str
    .replace(/ğ/gi, "g")
    .replace(/ü/gi, "u")
    .replace(/ş/gi, "s")
    .replace(/ı/gi, "i")
    .replace(/İ/g, "i")
    .replace(/ö/gi, "o")
    .replace(/ç/gi, "c");
}

/**
 * Firma adından domain için kullanılabilir bir "slug" üret
 * Örn:
 *  "ARIN UYGUR MİMARLIK & İÇMİMARLIK - İstanbul Mimarlık Ofisi | Proje Tasarım & Uygulama"
 *   → "arinuygur"
 */
function buildDomainBaseFromCompanyName(companyName) {
  if (!companyName) return null;

  let s = String(companyName).toLowerCase().trim();

  // Pipe ve tire sonrası açıklamaları at
  if (s.includes("|")) {
    s = s.split("|")[0].trim();
  }
  if (s.includes(" - ")) {
    s = s.split(" - ")[0].trim();
  }

  // Parantez içlerini temizle
  s = s.replace(/\(.*?\)/g, " ");

  // Türkçe karakterleri ascii'ye çevir
  s = toAscii(s);

  // Gereksiz kelimeleri temizle
  const stopWords = [
    "mimarlik",
    "ic",
    "iç",
    "icmimarlik",
    "office",
    "ofis",
    "ofisi",
    "tasarim",
    "tasarım",
    "design",
    "architecture",
    "architect",
    "proje",
    "yapi",
    "yapı",
    "insaat",
    "inşaat",
    "limited",
    "ltd",
    "sti",
    "şti",
    "a.s",
    "a.ş",
    "sanayi",
    "ticaret",
    "ve",
    "veya",
    "grup",
    "group",
    "co",
    "company",
  ];

  // Harf/digit olmayan karakterleri space'e çevir
  s = s.replace(/[^a-z0-9]+/g, " ");

  let tokens = s
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t && !stopWords.includes(t));

  if (!tokens.length) {
    return null;
  }

  // En fazla 2 token birleştirelim
  let base = tokens.slice(0, 2).join("");

  // Tekrar non-alnum temizliği
  base = base.replace(/[^a-z0-9]/g, "");

  // Çok kısa ise tüm stringten biraz toparlamaya çalış
  if (base.length < 4) {
    base = tokens.join("").replace(/[^a-z0-9]/g, "");
  }

  if (!base) return null;

  // Maksimum 15 karakter
  if (base.length > 15) {
    base = base.slice(0, 15);
  }

  return base;
}

/**
 * Lead için domain adayları üret
 * - max 5 adet
 * - domain uzunluğu makul (ör: 30 karakter üstünü çöpe at)
 */
function generateDomainGuessesForLead(lead) {
  const { company_name } = lead;

  const base = buildDomainBaseFromCompanyName(company_name);
  if (!base) {
    return [];
  }

  const candidates = new Set();

  // Temel kombinasyonlar
  candidates.add(`${base}.com`);
  candidates.add(`${base}.com.tr`);

  // Birkaç varyasyon daha (çok abartmadan)
  if (base.length > 6) {
    const short = base.slice(0, 10);
    candidates.add(`${short}.com`);
    candidates.add(`${short}.com.tr`);
  }

  // Filtre: çok uzun domainleri at
  const filtered = Array.from(candidates).filter(
    (d) => d.length <= 30 && d.includes(".")
  );

  // Max 5 aday
  return filtered.slice(0, 5);
}

/**
 * Domain Discovery V2 – Batch
 *
 * - website alanı boş olan lead'ler için
 * - makul domain tahminleri üretir
 * - her domain için website intel çağırır (HTTP check)
 * - başarılı olan ilk domain'i lead.website alanına yazar
 */
async function runDomainDiscoveryBatch({ limit = 10 } = {}) {
  const db = await getCrmDb();

  // Sadece website'i boş olan lead'ler
  const rows = db
    .prepare(
      `
      SELECT id, company_name, city, website
      FROM potential_leads
      WHERE (website IS NULL OR website = '')
      ORDER BY id ASC
      LIMIT ?
    `
    )
    .all(limit);

  if (!rows.length) {
    return {
      processedCount: 0,
      updatedCount: 0,
      items: [],
      note: "Domain discovery bekleyen lead bulunamadı.",
    };
  }

  const items = [];
  let updatedCount = 0;

  for (const row of rows) {
    const guesses = generateDomainGuessesForLead(row);

    if (!guesses.length) {
      log.info("[DomainDiscovery] Domain üretilemedi", {
        leadId: row.id,
        companyName: row.company_name,
      });

      items.push({
        leadId: row.id,
        companyName: row.company_name,
        status: "no_guess",
        chosenDomain: null,
        tries: [],
      });

      continue;
    }

    log.info("[DomainDiscovery] Domain adayları", {
      leadId: row.id,
      companyName: row.company_name,
      guesses,
    });

    let chosenDomain = null;
    const tries = [];

    for (const domain of guesses) {
      const url = `https://${domain}`;

      try {
        const intel = await websiteIntelService.enrichWebsiteFromUrl({ url });

        const httpStatus = intel && intel.httpStatus ? intel.httpStatus : null;
        const ok =
          httpStatus && Number(httpStatus) >= 200 && Number(httpStatus) < 400;

        tries.push({
          domain,
          url,
          httpStatus,
          ok,
        });

        if (ok) {
          // Bu domain'i lead.website alanına yaz
          db.prepare(
            `
            UPDATE potential_leads
            SET website = ?, updated_at = datetime('now')
            WHERE id = ?
          `
          ).run(url, row.id);

          chosenDomain = domain;
          updatedCount++;

          log.info("[DomainDiscovery] Domain bulundu ve kaydedildi", {
            leadId: row.id,
            domain,
            url,
          });

          break; // İlk başarılı domain'i alınca dur
        }
      } catch (err) {
        log.warn("[DomainDiscovery] Domain check hatası", {
          leadId: row.id,
          domain,
          error: err.message,
        });

        tries.push({
          domain,
          url,
          httpStatus: null,
          ok: false,
          error: err.message,
        });
      }
    }

    if (!chosenDomain) {
      log.info("[DomainDiscovery] Uygun domain bulunamadı", {
        leadId: row.id,
        companyName: row.company_name,
      });
    }

    items.push({
      leadId: row.id,
      companyName: row.company_name,
      status: chosenDomain ? "updated" : "not_found",
      chosenDomain,
      tries,
    });
  }

  return {
    processedCount: rows.length,
    updatedCount,
    items,
  };
}

module.exports = {
  runDomainDiscoveryBatch,
  generateDomainGuessesForLead,
  buildDomainBaseFromCompanyName,
};