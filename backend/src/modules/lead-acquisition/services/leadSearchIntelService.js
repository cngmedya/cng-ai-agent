// backend/src/modules/lead-acquisition/services/leadSearchIntelService.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");
const { searchLeadOnGoogle } = require("./leadSearchEngineService");

/**
 * potential_leads tablosundan lead bilgisi çek
 */
async function getLeadById(leadId) {
  const db = await getCrmDb();
  const stmt = db.prepare(`
    SELECT id, company_name, city, category
    FROM potential_leads
    WHERE id = ?
  `);
  return stmt.get(leadId);
}

/**
 * lead_search_intel tablosuna kayıt ekle
 */
async function insertSearchIntel({
  leadId,
  query,
  engine,
  results,
  mentionsCount,
  complaintsCount,
  status,
  errorMessage,
}) {
  const db = await getCrmDb();

  const stmt = db.prepare(`
    INSERT INTO lead_search_intel (
      lead_id,
      query,
      engine,
      results_json,
      mentions_count,
      complaints_count,
      last_checked_at,
      status,
      error_message
    )
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
  `);

  const info = stmt.run(
    leadId,
    query,
    engine,
    JSON.stringify(results),
    mentionsCount,
    complaintsCount,
    status,
    errorMessage || null
  );

  return info.lastInsertRowid;
}

/**
 * HAM Google Search Intel (V1 - Mock)
 *
 * Bu fonksiyon:
 *  - Firma adından query üretir
 *  - Google Search Engine Skeleton’dan sonuç çeker
 *  - Complaint / mention sayısı hesaplar
 *  - lead_search_intel tablosuna yazar
 *  - Orchestrator tarafından AI analizine verilmek üzere geri döner
 */
async function runSearchIntelForLead(leadId) {
  try {
    log.info("[SearchIntel] Çalışıyor", { leadId });

    const lead = await getLeadById(leadId);

    if (!lead) {
      log.warn("[SearchIntel] Lead bulunamadı", { leadId });
      return {
        ok: false,
        error: "Lead not found",
      };
    }

    // 1) Search Engine Skeleton'u çağırıyoruz
    const searchData = await searchLeadOnGoogle({
      companyName: lead.company_name,
      city: lead.city,
      category: lead.category,
    });

    const results = searchData.results || [];

    // 2) Mention / Complaint hesaplama
    const mentionsCount = results.length;
    const complaintsCount = results.filter((r) => r.isComplaint).length;

    // 3) DB'ye yaz
    const intelId = await insertSearchIntel({
      leadId,
      query: searchData.query,
      engine: searchData.engine,
      results,
      mentionsCount,
      complaintsCount,
      status: "ok",
    });

    log.info("[SearchIntel] Search intel kaydedildi", {
      leadId,
      intelId,
      mentionsCount,
      complaintsCount,
    });

    // 4) Orchestrator & AI için geri dön
    return {
      ok: true,
      leadId,
      intelId,
      query: searchData.query,
      mentionsCount,
      complaintsCount,
      results,
    };
  } catch (err) {
    log.error("[SearchIntel] HATA", {
      leadId,
      error: err.message,
      stack: err.stack,
    });

    // Hata durumunda tabloya error status olarak yazalım
    await insertSearchIntel({
      leadId,
      query: "",
      engine: "mock_google",
      results: [],
      mentionsCount: 0,
      complaintsCount: 0,
      status: "error",
      errorMessage: err.message,
    });

    return {
      ok: false,
      error: err.message,
    };
  }
}

module.exports = {
  runSearchIntelForLead,
};