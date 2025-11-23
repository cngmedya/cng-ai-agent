// backend/src/modules/lead-acquisition/services/leadReputationBatchService.js

"use strict";

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");
const { runReputationIntelForLead } = require("./leadReputationOrchestrator");

/**
 * ReputationEngine V2 batch runner
 * - lead_reputation_insights kaydı olmayan lead'leri bulur
 * - her biri için runReputationIntelForLead çalıştırır
 */
async function runReputationIntelBatchForLeads({ limit = 5 } = {}) {
  const db = await getCrmDb();

  const rows = db
    .prepare(
      `
      SELECT pl.id, pl.company_name
      FROM potential_leads pl
      LEFT JOIN lead_reputation_insights lri ON lri.lead_id = pl.id
      WHERE lri.id IS NULL
      ORDER BY pl.id ASC
      LIMIT ?
    `
    )
    .all(limit);

  if (!rows.length) {
    log.info("[ReputationBatch] İşlenecek lead bulunamadı.");
    return {
      processedCount: 0,
      items: [],
      note: "Reputation intel bekleyen lead bulunamadı.",
    };
  }

  const items = [];

  for (const row of rows) {
    try {
      const result = await runReputationIntelForLead(row.id);

      items.push({
        leadId: row.id,
        companyName: row.company_name,
        ok: result.ok,
        reputation_score: result.reputation_score || null,
        risk_level: result.risk_level || null,
      });
    } catch (err) {
      log.error("[ReputationBatch] Tekil lead işlenirken hata", {
        leadId: row.id,
        error: err.message,
      });

      items.push({
        leadId: row.id,
        companyName: row.company_name,
        ok: false,
        reputation_score: null,
        risk_level: null,
        error: err.message,
      });
    }
  }

  log.info("[ReputationBatch] Batch tamamlandı", {
    processedCount: items.length,
  });

  return {
    processedCount: items.length,
    items,
  };
}

module.exports = {
  runReputationIntelBatchForLeads,
};