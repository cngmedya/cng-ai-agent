// backend/src/modules/lead-acquisition/services/leadListService.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

/**
 * website_intel satırını frontend için sadeleştirilmiş objeye çevirir.
 */
function mapWebsiteIntelRow(row) {
  if (!row) return null;

  let meta = null;
  try {
    meta = row.meta_json ? JSON.parse(row.meta_json) : null;
  } catch (_) {
    meta = null;
  }

  const seo = meta && meta.seo ? meta.seo : null;
  const tech = meta && meta.tech ? meta.tech : null;
  const structure = meta && meta.structure ? meta.structure : null;
  const performance = meta && meta.performance ? meta.performance : null;

  // Genel skor: meta.score varsa onu, yoksa seo.score varsa onu kullan
  let score = null;
  if (meta && typeof meta.score === "number") {
    score = meta.score;
  } else if (seo && typeof seo.score === "number") {
    score = seo.score;
  }

  return {
    http_status: row.http_status,
    title: row.title,
    description: row.description,
    score,
    tech,
    seo,
    structure,
    performance,
  };
}

/**
 * Reputation satırını frontend için sadeleştirilmiş objeye çevirir.
 */
function mapReputationRow(row) {
  if (!row) return null;

  let keyOpportunities = [];
  let suggestedActions = [];

  try {
    if (row.key_opportunities_json) {
      keyOpportunities = JSON.parse(row.key_opportunities_json);
    }
  } catch (_) {}

  try {
    if (row.suggested_actions_json) {
      suggestedActions = JSON.parse(row.suggested_actions_json);
    }
  } catch (_) {}

  return {
    score: row.reputation_score,
    risk_level: row.risk_level,
    positive_ratio: row.positive_ratio,
    negative_ratio: row.negative_ratio,
    summary_markdown: row.summary_markdown,
    key_opportunities: keyOpportunities,
    suggested_actions: suggestedActions,
    last_updated_at: row.last_updated_at,
  };
}

/**
 * Search intel satırını sade obje yapar.
 */
function mapSearchIntelRow(row) {
  if (!row) return null;

  let results = [];
  try {
    if (row.results_json) {
      results = JSON.parse(row.results_json);
    }
  } catch (_) {}

  return {
    query: row.query,
    engine: row.engine,
    mentions_count: row.mentions_count,
    complaints_count: row.complaints_count,
    last_checked_at: row.last_checked_at,
    status: row.status,
    error_message: row.error_message,
    results,
  };
}

/**
 * Lead listesi (liste view için hafif ama zengin obje)
 *
 * options:
 *  - limit (default 50)
 *  - offset (default 0)
 */
async function getLeadList({ limit = 50, offset = 0 } = {}) {
  const db = await getCrmDb();

  // 1) Total count (pagination için)
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total FROM potential_leads`)
    .get();
  const total = totalRow ? totalRow.total : 0;

  if (total === 0) {
    return {
      items: [],
      total: 0,
    };
  }

  // 2) Lead listesi
  const leads = db
    .prepare(
      `
      SELECT
        id,
        company_name,
        category,
        website,
        phone,
        address,
        city,
        country,
        source,
        status,
        created_at,
        updated_at
      FROM potential_leads
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset);

  if (!leads.length) {
    return {
      items: [],
      total,
    };
  }

  const leadIds = leads.map((l) => l.id);
  const placeholders = leadIds.map(() => "?").join(",");

  // 3) Website intel (lead için son satır)
  let websiteRows = [];
  if (leadIds.length) {
    websiteRows = db
      .prepare(
        `
        SELECT wi.*
        FROM website_intel wi
        JOIN (
          SELECT lead_id, MAX(id) AS max_id
          FROM website_intel
          WHERE lead_id IN (${placeholders})
          GROUP BY lead_id
        ) latest
        ON wi.lead_id = latest.lead_id AND wi.id = latest.max_id
      `
      )
      .all(...leadIds);
  }

  const websiteByLead = {};
  for (const row of websiteRows) {
    websiteByLead[row.lead_id] = mapWebsiteIntelRow(row);
  }

  // 4) Reputation intel (lead için son satır)
  let reputationRows = [];
  if (leadIds.length) {
    reputationRows = db
      .prepare(
        `
        SELECT lri.*
        FROM lead_reputation_insights lri
        JOIN (
          SELECT lead_id, MAX(id) AS max_id
          FROM lead_reputation_insights
          WHERE lead_id IN (${placeholders})
          GROUP BY lead_id
        ) latest
        ON lri.lead_id = latest.lead_id AND lri.id = latest.max_id
      `
      )
      .all(...leadIds);
  }

  const reputationByLead = {};
  for (const row of reputationRows) {
    reputationByLead[row.lead_id] = mapReputationRow(row);
  }

  // 5) Search intel (lead için son satır)
  let searchRows = [];
  if (leadIds.length) {
    searchRows = db
      .prepare(
        `
        SELECT lsi.*
        FROM lead_search_intel lsi
        JOIN (
          SELECT lead_id, MAX(id) AS max_id
          FROM lead_search_intel
          WHERE lead_id IN (${placeholders})
          GROUP BY lead_id
        ) latest
        ON lsi.lead_id = latest.lead_id AND lsi.id = latest.max_id
      `
      )
      .all(...leadIds);
  }

  const searchByLead = {};
  for (const row of searchRows) {
    searchByLead[row.lead_id] = mapSearchIntelRow(row);
  }

  // 6) Final items (frontend contract)
  const items = leads.map((lead) => {
    const websiteIntel = websiteByLead[lead.id] || null;
    const reputation = reputationByLead[lead.id] || null;
    const searchIntel = searchByLead[lead.id] || null;

    // Basit lead_quality_score (frontend için default kullanılabilir)
    let leadQualityScore = 0;
    if (websiteIntel && typeof websiteIntel.score === "number") {
      leadQualityScore += websiteIntel.score * 0.4;
    }
    if (reputation && typeof reputation.score === "number") {
      leadQualityScore += reputation.score * 0.4;
    }
    if (searchIntel) {
      // mentions + complaints'ten biraz sinyal
      const mentionBonus = Math.min(searchIntel.mentions_count || 0, 10) * 1.5;
      const complaintPenalty = Math.min(
        searchIntel.complaints_count || 0,
        10
      ) * 2;
      leadQualityScore += mentionBonus - complaintPenalty;
    }
    leadQualityScore = Math.max(0, Math.min(100, Math.round(leadQualityScore)));

    return {
      id: lead.id,
      company_name: lead.company_name,
      category: lead.category,
      website: lead.website,
      phone: lead.phone,
      address: lead.address,
      city: lead.city,
      country: lead.country,
      source: lead.source,
      status: lead.status,
      created_at: lead.created_at,
      updated_at: lead.updated_at,

      lead_quality_score: leadQualityScore,

      website_intel: websiteIntel,
      reputation,
      search_intel: searchIntel,
    };
  });

  log.info("[LeadList] Liste hazır", {
    count: items.length,
    total,
  });

  return {
    items,
    total,
  };
}

module.exports = {
  getLeadList,
};