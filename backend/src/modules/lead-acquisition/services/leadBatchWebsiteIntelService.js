// backend/src/modules/lead-acquisition/services/leadBatchWebsiteIntelService.js

const { log } = require("../../../lib/logger");
const { getCrmDb } = require("../../../db/db");
const { guessDomainsForLead } = require("../utils/domainGuess");
const websiteIntelService = require("./websiteIntelService");

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  const str = String(value);
  const escaped = str.replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * potential_leads tablosundaki website'i boş olan lead'ler için,
 * firma adından domain tahmini yapar ve ilk başarılı olanı website olarak kaydeder.
 *
 * @param {Object} params
 * @param {number} params.limit - bir seferde işlenecek lead sayısı (default 5)
 */
async function runWebsiteIntelBatch({ limit = 5 } = {}) {
  const db = await getCrmDb();

  // website'i boş olan lead'leri çek
  const leads = await db.all(
    `
    SELECT id, company_name, city, website
    FROM potential_leads
    WHERE (website IS NULL OR website = '')
    LIMIT ${Number(limit) || 5};
    `
  );

  if (!leads || leads.length === 0) {
    log.info("[WebIntelBatch] İşlenecek lead bulunamadı.");
    return {
      ok: true,
      processedCount: 0,
      items: [],
    };
  }

  log.info("[WebIntelBatch] Batch başlıyor", {
    count: leads.length,
  });

  const items = [];

  for (const lead of leads) {
    const { id, company_name, city } = lead;

    const candidates = guessDomainsForLead({
      company_name,
      city,
    });

    if (!candidates.length) {
      items.push({
        id,
        company_name,
        status: "no_domain_candidates",
      });
      continue;
    }

    let chosenUrl = null;
    let lastIntel = null;

    for (const url of candidates) {
      try {
        const intel = await websiteIntelService.enrichWebsiteFromUrl({ url });
        lastIntel = intel;

        // 200–399 arası HTTP status'leri "başarılı" kabul edelim
        if (
          intel.httpStatus &&
          intel.httpStatus >= 200 &&
          intel.httpStatus < 400
        ) {
          chosenUrl = url;
          break;
        }
      } catch (err) {
        // enrichWebsiteFromUrl zaten logluyor, burada sadece devam ediyoruz
        continue;
      }
    }

    if (chosenUrl) {
      const sql = `
        UPDATE potential_leads
        SET website = ${sqlValue(chosenUrl)},
            updated_at = datetime('now')
        WHERE id = ${id};
      `;
      await db.exec(sql);

      items.push({
        id,
        company_name,
        website: chosenUrl,
        httpStatus: lastIntel ? lastIntel.httpStatus : null,
        status: "ok",
      });

      log.info("[WebIntelBatch] Lead için website bulundu", {
        id,
        company_name,
        chosenUrl,
      });
    } else {
      items.push({
        id,
        company_name,
        status: "no_valid_website",
      });

      log.warn("[WebIntelBatch] Geçerli website bulunamadı", {
        id,
        company_name,
      });
    }
  }

  return {
    ok: true,
    processedCount: items.length,
    items,
  };
}

module.exports = {
  runWebsiteIntelBatch,
};