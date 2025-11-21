// backend/src/modules/lead-acquisition/services/leadReputationOrchestrator.js

const { log } = require("../../../lib/logger");
const { getCrmDb } = require("../../../db/db");
const { runSearchIntelForLead } = require("./leadSearchIntelService");
const { analyzeLeadReputation } = require("./leadReputationAiService");

/**
 * DB’den lead çek
 */
async function getLeadById(leadId) {
  const db = await getCrmDb();
  return db
    .prepare(
      `SELECT id, company_name, city, category
       FROM potential_leads
       WHERE id = ?`
    )
    .get(leadId);
}

/**
 * AI reputation sonuçlarını DB'ye kaydet
 */
async function saveReputationInsight(leadId, searchIntelId, aiResult) {
  const db = await getCrmDb();

  const stmt = db.prepare(`
    INSERT INTO lead_reputation_insights (
      lead_id,
      search_intel_id,
      reputation_score,
      risk_level,
      positive_ratio,
      negative_ratio,
      summary_markdown,
      key_opportunities_json,
      suggested_actions_json,
      last_updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  stmt.run(
    leadId,
    searchIntelId,
    aiResult.reputation_score,
    aiResult.risk_level,
    aiResult.positive_ratio,
    aiResult.negative_ratio,
    aiResult.summary_markdown,
    JSON.stringify(aiResult.key_opportunities || []),
    JSON.stringify(aiResult.suggested_actions || [])
  );

  return true;
}

/**
 * FULL PIPELINE
 *
 * 1. Lead'i çek
 * 2. Google Search Intel al
 * 3. AI Reputation analizi yap
 * 4. DB’ye kaydet
 * 5. Özet döndür
 */
async function runReputationIntelForLead(leadId) {
  log.info("[ReputationOrchestrator] Çalışıyor", { leadId });

  // 1) Lead bilgisi
  const lead = await getLeadById(leadId);
  if (!lead) {
    log.warn("[ReputationOrchestrator] Lead bulunamadı", { leadId });
    return { ok: false, error: "Lead not found" };
  }

  // 2) Search Intel
  const searchIntel = await runSearchIntelForLead(leadId);
  if (!searchIntel.ok) {
    return { ok: false, error: "Search Intel Failed" };
  }

  // 3) AI reputation analysis
  const aiResult = await analyzeLeadReputation({
    lead,
    searchIntel,
  });

  // 4) DB’ye sonuçları kaydet
  await saveReputationInsight(
    leadId,
    searchIntel.intelId,
    aiResult
  );

  log.info("[ReputationOrchestrator] Reputation tamamlandı", {
    leadId,
    score: aiResult.reputation_score,
  });

  // 5) Controller'ın döndüreceği özet
  return {
    ok: true,
    leadId,
    reputation_score: aiResult.reputation_score,
    risk_level: aiResult.risk_level,
    summary: aiResult.summary_markdown,
    opportunities: aiResult.key_opportunities,
  };
}

module.exports = {
  runReputationIntelForLead,
};