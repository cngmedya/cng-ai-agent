// backend/src/modules/lead-acquisition/services/leadDomainDiscoveryService.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");
const { enrichWebsiteFromUrl } = require("./websiteIntelService");

/**
 * Firma adını slug'a çevir:
 *  - Türkçe karakter temizleme
 *  - sadece harf + rakam
 *  - boşlukları kaldır
 */
function slugify(text) {
  if (!text) return "";

  const map = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  };

  let t = String(text)
    .split("")
    .map((ch) => map[ch] || ch)
    .join("");

  // harf ve rakam dışını temizle
  t = t.toLowerCase().replace(/[^a-z0-9]+/g, "");

  return t;
}

/**
 * Domain root için generic / yasak kelimeler:
 *  - Bunlar marka olmaz, sadece sonuna eklenir
 */
const STOP_ROOTS = [
  "mimarlik",
  "icmimarlik",
  "mimar",
  "icmimar",
  "tasarim",
  "design",
  "architecture",
  "insaat",
  "yapi",
  "yapı",
  "gayrimenkul",
  "proje",
  "ofis",
  "ofisi",
  "office",
];

/**
 * Şirket isminden domain root adayları üret
 * Kurallar:
 *  - sadece şirket adı / unvandan gelsin (adres, şehir yok)
 *  - max 3 kelime → brand + 0/1/2 extra kelime
 *  - brand: ilk STOP_ROOTS olmayan kelime
 *  - ekstra kelimeler: şirket isminden gelen, STOP_ROOTS da olabilir (ek olarak kullanılabilir)
 *  - her root max 15 karaktere kesilir
 */
function buildDomainRootCandidates(companyName) {
  if (!companyName) return [];

  const roots = [];

  const raw = companyName
    .replace(/\|.*/g, "") // '|' sonrası açıklamaları at
    .replace(/- .*$/g, "") // '-' sonrası slogan vs.
    .replace(/\(.*?\)/g, ""); // parantez içlerini at

  const words = raw
    .split(/\s+/g)
    .map((w) => slugify(w))
    .filter(Boolean);

  if (!words.length) return [];

  // Brand = ilk STOP_ROOTS olmayan kelime
  let brand = null;
  let rest = [];

  for (const w of words) {
    if (!brand && !STOP_ROOTS.includes(w)) {
      brand = w;
    } else {
      rest.push(w);
    }
  }

  // Eğer tüm kelimeler generic ise, ilk kelimeyi brand kabul et (yine de bir şey denesin)
  if (!brand) {
    brand = words[0];
    rest = words.slice(1);
  }

  // Extra kelimeleri max 3 ile sınırla
  const extras = rest.slice(0, 3);

  const pushRoot = (val) => {
    if (!val) return;
    const trimmed = val.slice(0, 15); // max 15 karakter
    if (!trimmed) return;
    if (!roots.includes(trimmed)) roots.push(trimmed);
  };

  // 1) Sadece brand
  pushRoot(brand);

  // 2) brand + 1. kelime
  if (extras.length >= 1) {
    pushRoot(brand + extras[0]);
  }

  // 3) brand + 1. + 2. kelime (max 3 kelime)
  if (extras.length >= 2) {
    pushRoot(brand + extras[0] + extras[1]);
  }

  // 4) (opsiyonel) brand + 2. kelime (arcves + gayrimenkul gibi)
  if (extras.length >= 2) {
    pushRoot(brand + extras[1]);
  }

  return roots.slice(0, 5);
}

/**
 * Tek bir lead için domain keşfi:
 *  - website boşsa
 *  - aday domain rootları üret
 *  - .com, .com.tr, .net kombinasyonlarını dene
 *  - ilk çalışan domaini seç
 */
async function discoverDomainForLead(lead) {
  const tries = [];

  const { id, company_name } = lead;

  const domainRoots = buildDomainRootCandidates(company_name);

  if (!domainRoots.length) {
    log.warn("[DomainDiscovery] Root üretilemedi", {
      leadId: id,
      companyName: company_name,
    });
    return { ok: false, chosenDomain: null, tries };
  }

  const tlds = [".com", ".com.tr", ".net"];

  for (const root of domainRoots) {
    for (const tld of tlds) {
      const domain = `${root}${tld}`;
      const url = `https://${domain}`;

      try {
        const intel = await enrichWebsiteFromUrl({
          url,
          leadId: id,
        });

        tries.push({
          domain,
          url: intel.url,
          httpStatus: intel.httpStatus,
          ok:
            typeof intel.httpStatus === "number" &&
            intel.httpStatus >= 200 &&
            intel.httpStatus < 400,
        });

        // sadece 2xx–3xx arası cevap verenleri kabul ediyoruz
        if (
          typeof intel.httpStatus === "number" &&
          intel.httpStatus >= 200 &&
          intel.httpStatus < 400
        ) {
          log.info("[DomainDiscovery] Uygun domain bulundu", {
            leadId: id,
            companyName: company_name,
            domain,
            httpStatus: intel.httpStatus,
          });

          return { ok: true, chosenDomain: domain, tries };
        }
      } catch (err) {
        tries.push({
          domain,
          url,
          httpStatus: null,
          ok: false,
          error: err.message,
        });

        log.warn("[DomainDiscovery] Domain denemesi hata", {
          leadId: id,
          companyName: company_name,
          domain,
          error: err.message,
        });
      }
    }
  }

  log.info("[DomainDiscovery] Uygun domain bulunamadı", {
    leadId: id,
    companyName: company_name,
  });

  return { ok: false, chosenDomain: null, tries };
}

/**
 * Batch domain discovery:
 *  - website alanı boş olan lead'leri seç
 *  - her biri için discoverDomainForLead çalıştır
 *  - çalışan domain bulunduysa potential_leads.website alanını güncelle
 */
async function runDomainDiscoveryBatch({ limit = 20 } = {}) {
  const db = await getCrmDb();

  const leads = db
    .prepare(
      `
      SELECT id, company_name, website, address, city
      FROM potential_leads
      WHERE (website IS NULL OR website = '')
      ORDER BY id ASC
      LIMIT ?
    `,
    )
    .all(limit);

  if (!leads.length) {
    return {
      processedCount: 0,
      updatedCount: 0,
      items: [],
      note: "Website alanı boş olan lead bulunamadı.",
    };
  }

  const items = [];
  let updatedCount = 0;

  for (const lead of leads) {
    const result = await discoverDomainForLead(lead);

    if (result.ok && result.chosenDomain) {
      const fullUrl = `https://${result.chosenDomain}`;

      // potential_leads.website alanını güncelle
      db.prepare(
        `
        UPDATE potential_leads
        SET website = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(fullUrl, lead.id);

      items.push({
        leadId: lead.id,
        companyName: lead.company_name,
        status: "updated",
        chosenDomain: result.chosenDomain,
        tries: result.tries,
      });

      updatedCount++;
    } else {
      items.push({
        leadId: lead.id,
        companyName: lead.company_name,
        status: "not_found",
        chosenDomain: null,
        tries: result.tries,
      });
    }
  }

  log.info("[DomainDiscovery] Batch tamamlandı", {
    processedCount: leads.length,
    updatedCount,
  });

  return {
    processedCount: leads.length,
    updatedCount,
    items,
  };
}

module.exports = {
  runDomainDiscoveryBatch,
};