// backend/src/modules/lead-acquisition/services/leadBatchWebsiteIntelService.js

const { log } = require("../../../lib/logger");
const { getCrmDb } = require("../../../db/db");
const { guessDomainsForLead } = require("../utils/domainGuess");
const websiteIntelService = require("./websiteIntelService");
const { analyzeWebsiteWithAI } = require("./websiteAiAnalysisService");

/**
 * potential_leads tablosundaki website'i boş olan lead'ler için:
 *  - Firma adından max 5 kısa domain adayı üretir
 *  - Her adayı sırayla deneyerek website_intel'e yazdırır
 *  - HTTP status 200–399 dönen ilk domain'i "geçerli website" kabul eder
 *  - Sadece bu geçerli domain'i potential_leads.website alanına yazar
 *  - Ardından bu website için AI analizini tetikler (AI sonucu DB'ye yazmıyor, şimdilik sadece logluyor)
 */
async function runWebsiteIntelBatch({ limit = 5 } = {}) {
  const db = await getCrmDb();

  const selectStmt = db.prepare(`
    SELECT id, company_name, city, website
    FROM potential_leads
    WHERE (website IS NULL OR website = '')
    ORDER BY id ASC
    LIMIT ?
  `);

  const leads = selectStmt.all(Number(limit) || 5);

  if (!Array.isArray(leads) || leads.length === 0) {
    log.info("[WebIntelBatch] İşlenecek lead bulunamadı.");
    return {
      ok: true,
      processedCount: 0,
      items: [],
    };
  }

  log.info("[WebIntelBatch] Batch website intel başlıyor", {
    count: leads.length,
    limit,
  });

  const updateStmt = db.prepare(`
    UPDATE potential_leads
    SET website = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const items = [];

  for (const lead of leads) {
    const { id, company_name, city } = lead;

    // 1) Domain adaylarını üret (max 5 kısa URL)
    const candidates = guessDomainsForLead(company_name, city);

    if (!candidates || candidates.length === 0) {
      log.warn("[WebIntelBatch] Domain adayı üretilemedi", {
        id,
        company_name,
      });

      items.push({
        id,
        company_name,
        status: "no_domain_candidates",
      });

      continue;
    }

    log.info("[WebIntelBatch] Domain tahmini", {
      leadId: id,
      company: company_name,
      guesses: candidates,
    });

    let chosenUrl = null;
    let lastIntel = null;

    // 2) Her domain adayını sırayla dene
    for (const url of candidates) {
      try {
        const intel = await websiteIntelService.enrichWebsiteFromUrl({ url });
        lastIntel = intel;

        // Sadece gerçekten çalışan (200–399) domain'i kabul et
        if (
          intel.httpStatus &&
          intel.httpStatus >= 200 &&
          intel.httpStatus < 400
        ) {
          chosenUrl = url;
          break;
        }
      } catch (err) {
        log.warn(
          "[WebIntelBatch] Website intel hatası, bir sonraki adaya geçiliyor",
          {
            leadId: id,
            url,
            error: err?.message || String(err),
          }
        );
        // sıradaki adaya geç
      }
    }

    if (chosenUrl && lastIntel) {
      // 3) Geçerli domain'i potential_leads'e yaz
      updateStmt.run(chosenUrl, id);

      log.info("[WebIntelBatch] Lead için geçerli website bulundu", {
        id,
        company_name,
        website: chosenUrl,
        httpStatus: lastIntel.httpStatus,
      });

      // 4) AI analizini tetikle (response'a koymuyoruz, sadece log)
      try {
        const aiResult = await analyzeWebsiteWithAI({
          url: chosenUrl,
          intel: lastIntel,
        });

        log.info("[WebIntelBatchAI] Lead için AI website analizi tamamlandı", {
          id,
          company_name,
          url: chosenUrl,
          hasError: !!aiResult.ai?.parseError,
        });
      } catch (err) {
        log.error("[WebIntelBatchAI] Lead için AI analiz hatası", {
          id,
          company_name,
          url: chosenUrl,
          error: err?.message || String(err),
        });
      }

      items.push({
        id,
        company_name,
        website: chosenUrl,
        httpStatus: lastIntel.httpStatus,
        status: "ok",
      });
    } else {
      log.warn("[WebIntelBatch] Geçerli website bulunamadı", {
        id,
        company_name,
      });

      items.push({
        id,
        company_name,
        status: "no_valid_website",
      });
    }
  }

  log.info("[WebIntelBatch] Batch tamamlandı", {
    processedCount: items.length,
  });

  return {
    ok: true,
    processedCount: items.length,
    items,
  };
}

module.exports = {
  runWebsiteIntelBatch,
};