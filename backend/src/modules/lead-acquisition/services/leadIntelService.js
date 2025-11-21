// backend/src/modules/lead-acquisition/services/leadIntelService.js

const { getCrmDb } = require("../../../db/db");

/**
 * Tek bir lead kaydını getir
 */
async function getLeadCore(leadId) {
  const db = await getCrmDb();
  const stmt = db.prepare(`
    SELECT id, company_name, category, website, phone, address, city, country, source, status, created_at, updated_at
    FROM potential_leads
    WHERE id = ?
  `);
  return stmt.get(leadId);
}

/**
 * Lead'e ait son website_intel kaydını getir
 */
async function getLatestWebsiteIntel(leadId) {
  const db = await getCrmDb();
  const stmt = db.prepare(`
    SELECT id, url, http_status, title, description, meta_json, last_checked_at, error_message
    FROM website_intel
    WHERE lead_id = ?
    ORDER BY last_checked_at DESC, id DESC
    LIMIT 1
  `);
  return stmt.get(leadId);
}

/**
 * Lead'e ait son search_intel kaydını getir
 */
async function getLatestSearchIntel(leadId) {
  const db = await getCrmDb();
  const stmt = db.prepare(`
    SELECT id, query, engine, results_json, mentions_count, complaints_count, last_checked_at, status, error_message
    FROM lead_search_intel
    WHERE lead_id = ?
    ORDER BY last_checked_at DESC, id DESC
    LIMIT 1
  `);
  return stmt.get(leadId);
}

/**
 * Lead'e ait son reputation_insight kaydını getir
 */
async function getLatestReputationInsight(leadId) {
  const db = await getCrmDb();
  const stmt = db.prepare(`
    SELECT
      id,
      search_intel_id,
      reputation_score,
      risk_level,
      positive_ratio,
      negative_ratio,
      summary_markdown,
      key_opportunities_json,
      suggested_actions_json,
      last_updated_at
    FROM lead_reputation_insights
    WHERE lead_id = ?
    ORDER BY last_updated_at DESC, id DESC
    LIMIT 1
  `);
  return stmt.get(leadId);
}

/**
 * Tek bir lead'in full intel datasını toparla
 */
async function getLeadIntel(leadId) {
  const lead = await getLeadCore(leadId);
  if (!lead) {
    return null;
  }

  const [websiteIntel, searchIntelRow, reputationRow] = await Promise.all([
    getLatestWebsiteIntel(leadId),
    getLatestSearchIntel(leadId),
    getLatestReputationInsight(leadId),
  ]);

  let searchIntel = null;
  if (searchIntelRow) {
    searchIntel = {
      ...searchIntelRow,
      results: searchIntelRow.results_json
        ? JSON.parse(searchIntelRow.results_json)
        : [],
    };
    delete searchIntel.results_json;
  }

  let reputation = null;
  if (reputationRow) {
    reputation = {
      ...reputationRow,
      key_opportunities: reputationRow.key_opportunities_json
        ? JSON.parse(reputationRow.key_opportunities_json)
        : [],
      suggested_actions: reputationRow.suggested_actions_json
        ? JSON.parse(reputationRow.suggested_actions_json)
        : [],
    };
    delete reputation.key_opportunities_json;
    delete reputation.suggested_actions_json;
  }

  return {
    lead,
    websiteIntel: websiteIntel || null,
    searchIntel,
    reputation,
  };
}

/**
 * Genel intel özeti (dashboard için sayılar)
 */
async function getLeadIntelSummary() {
  const db = await getCrmDb();

  const totalLeads =
    db.prepare(`SELECT COUNT(*) as c FROM potential_leads`).get().c || 0;

  const leadsWithWebsiteIntel =
    db
      .prepare(
        `SELECT COUNT(DISTINCT lead_id) as c FROM website_intel WHERE lead_id IS NOT NULL`
      )
      .get().c || 0;

  const leadsWithReputation =
    db
      .prepare(
        `SELECT COUNT(DISTINCT lead_id) as c FROM lead_reputation_insights`
      )
      .get().c || 0;

  const leadsWithoutReputation = totalLeads - leadsWithReputation;

  return {
    totalLeads,
    leadsWithWebsiteIntel,
    leadsWithReputation,
    leadsWithoutReputation,
  };
}

module.exports = {
  getLeadIntel,
  getLeadIntelSummary,
};