// backend/src/modules/lead-acquisition/services/leadIntelService.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
}

/**
 * Tek lead kaydı
 */
async function getLeadById(leadId) {
  const db = await getCrmDb();
  const row = db
    .prepare(`SELECT * FROM potential_leads WHERE id = ?`)
    .get(leadId);
  return row || null;
}

/**
 * Son website_intel kaydı
 */
async function getLatestWebsiteIntel(leadId) {
  const db = await getCrmDb();

  const row = db
    .prepare(
      `
      SELECT *
      FROM website_intel
      WHERE lead_id = ?
      ORDER BY
        last_checked_at DESC NULLS LAST,
        id DESC
      LIMIT 1
    `
    )
    .get(leadId);

  if (!row) return null;

  return {
    id: row.id,
    lead_id: row.lead_id,
    url: row.url,
    httpStatus: row.http_status,
    title: row.title,
    description: row.description,
    meta: safeJsonParse(row.meta_json, null),
    last_checked_at: row.last_checked_at,
    error: row.error_message || null,
  };
}

/**
 * Son lead_search_intel kaydı
 * - results_json parse edilir
 */
async function getLatestSearchIntel(leadId) {
  const db = await getCrmDb();

  const row = db
    .prepare(
      `
      SELECT *
      FROM lead_search_intel
      WHERE lead_id = ?
      ORDER BY
        last_checked_at DESC NULLS LAST,
        id DESC
      LIMIT 1
    `
    )
    .get(leadId);

  if (!row) return null;

  return {
    id: row.id,
    lead_id: row.lead_id,
    query: row.query,
    engine: row.engine,
    mentions_count: row.mentions_count,
    complaints_count: row.complaints_count,
    last_checked_at: row.last_checked_at,
    status: row.status,
    error_message: row.error_message || null,
    results: safeJsonParse(row.results_json, []),
  };
}

/**
 * Son lead_reputation_insights kaydı
 * - key_opportunities_json / suggested_actions_json parse edilir
 */
async function getLatestReputation(leadId) {
  const db = await getCrmDb();

  const row = db
    .prepare(
      `
      SELECT *
      FROM lead_reputation_insights
      WHERE lead_id = ?
      ORDER BY
        last_updated_at DESC NULLS LAST,
        id DESC
      LIMIT 1
    `
    )
    .get(leadId);

  if (!row) return null;

  return {
    id: row.id,
    lead_id: row.lead_id,
    search_intel_id: row.search_intel_id,
    reputation_score: row.reputation_score,
    risk_level: row.risk_level,
    positive_ratio: row.positive_ratio,
    negative_ratio: row.negative_ratio,
    summary_markdown: row.summary_markdown,
    last_updated_at: row.last_updated_at,
    key_opportunities: safeJsonParse(row.key_opportunities_json, []),
    suggested_actions: safeJsonParse(row.suggested_actions_json, []),
  };
}

/**
 * Tek lead için full intel:
 *  - lead
 *  - websiteIntel
 *  - searchIntel
 *  - reputation
 */
async function getLeadIntel(leadId) {
  const lead = await getLeadById(leadId);

  if (!lead) {
    log.warn("[LeadIntel] Lead bulunamadı", { leadId });
    return null;
  }

  const [websiteIntel, searchIntel, reputation] = await Promise.all([
    getLatestWebsiteIntel(leadId),
    getLatestSearchIntel(leadId),
    getLatestReputation(leadId),
  ]);

  return {
    lead,
    websiteIntel,
    searchIntel,
    reputation,
  };
}

/**
 * Özet (dashboard için):
 *  - totalLeads
 *  - leadsWithWebsiteIntel
 *  - leadsWithReputation
 *  - leadsWithoutReputation
 */
async function getLeadIntelSummary() {
  const db = await getCrmDb();

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM potential_leads`)
    .get().c;

  const withWebsite = db
    .prepare(
      `
      SELECT COUNT(DISTINCT lead_id) AS c
      FROM website_intel
      WHERE lead_id IS NOT NULL
    `
    )
    .get().c;

  const withReputation = db
    .prepare(
      `
      SELECT COUNT(DISTINCT lead_id) AS c
      FROM lead_reputation_insights
    `
    )
    .get().c;

  const withoutReputation = total - withReputation;

  const summary = {
    totalLeads: total,
    leadsWithWebsiteIntel: withWebsite,
    leadsWithReputation: withReputation,
    leadsWithoutReputation: withoutReputation,
  };

  log.info("[LeadIntel] Summary", summary);

  return summary;
}

module.exports = {
  getLeadIntel,
  getLeadIntelSummary,

  // İstersen ileride ihtiyaç olursa direkt kullanmak için export ediyoruz:
  getLatestWebsiteIntel,
  getLatestSearchIntel,
  getLatestReputation,
};