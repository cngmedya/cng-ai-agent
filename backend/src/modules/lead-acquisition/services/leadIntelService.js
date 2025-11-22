// backend/src/modules/lead-acquisition/services/leadIntelService.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

/**
 * Helper: Son website_intel kaydını getir
 */
function getLatestWebsiteIntel(db, leadId) {
  const row = db
    .prepare(
      `
      SELECT *
      FROM website_intel
      WHERE lead_id = ?
      ORDER BY last_checked_at DESC, id DESC
      LIMIT 1
    `,
    )
    .get(leadId);

  if (!row) return null;

  let meta = null;
  try {
    meta = row.meta_json ? JSON.parse(row.meta_json) : null;
  } catch (_) {
    meta = null;
  }

  return {
    id: row.id,
    lead_id: row.lead_id,
    url: row.url,
    http_status: row.http_status,
    title: row.title,
    description: row.description,
    meta,
    last_checked_at: row.last_checked_at,
    error_message: row.error_message,
  };
}

/**
 * Helper: Son search_intel kaydını getir
 */
function getLatestSearchIntel(db, leadId) {
  const row = db
    .prepare(
      `
      SELECT *
      FROM lead_search_intel
      WHERE lead_id = ?
      ORDER BY last_checked_at DESC, id DESC
      LIMIT 1
    `,
    )
    .get(leadId);

  if (!row) return null;

  let results = [];
  try {
    results = row.results_json ? JSON.parse(row.results_json) : [];
  } catch (_) {
    results = [];
  }

  return {
    id: row.id,
    lead_id: row.lead_id,
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
 * Helper: Son reputation kaydını getir
 */
function getLatestReputationInsight(db, leadId) {
  const row = db
    .prepare(
      `
      SELECT *
      FROM lead_reputation_insights
      WHERE lead_id = ?
      ORDER BY last_updated_at DESC, id DESC
      LIMIT 1
    `,
    )
    .get(leadId);

  if (!row) return null;

  let keyOpportunites = [];
  let suggestedActions = [];

  try {
    keyOpportunites = row.key_opportunities_json
      ? JSON.parse(row.key_opportunities_json)
      : [];
  } catch (_) {
    keyOpportunites = [];
  }

  try {
    suggestedActions = row.suggested_actions_json
      ? JSON.parse(row.suggested_actions_json)
      : [];
  } catch (_) {
    suggestedActions = [];
  }

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
    key_opportunities: keyOpportunites,
    suggested_actions: suggestedActions,
  };
}

/**
 * Lead Quality Scoring – V1
 * 0–100 arası skor
 *
 * Basit mantık:
 *  - Reputation varsa → ana taban = reputation_score
 *  - Yoksa → website meta score varsa onu kullan
 *  - Ek bonus/kesintiler:
 *      - http_status 2xx / 3xx ise +5
 *      - SEO score >= 60 ise +5
 *      - Çok şikayet varsa (complaints_count >= 3) → -10
 */
function computeLeadQualityScore({ lead, websiteIntel, searchIntel, reputation }) {
  let scoreBase = 40; // minimum taban

  // 1) Reputation en önemli sinyal
  if (reputation && typeof reputation.reputation_score === "number") {
    scoreBase = reputation.reputation_score;
  } else if (
    websiteIntel &&
    websiteIntel.meta &&
    typeof websiteIntel.meta.score === "number"
  ) {
    // 2) Website meta score yedek sinyal
    scoreBase = Math.max(scoreBase, websiteIntel.meta.score);
  }

  // 3) HTTP status → site ayakta mı?
  if (
    websiteIntel &&
    typeof websiteIntel.http_status === "number" &&
    websiteIntel.http_status >= 200 &&
    websiteIntel.http_status < 400
  ) {
    scoreBase += 5;
  }

  // 4) SEO skor bonusu
  const seoScore =
    websiteIntel &&
    websiteIntel.meta &&
    websiteIntel.meta.seo &&
    typeof websiteIntel.meta.seo.score === "number"
      ? websiteIntel.meta.seo.score
      : null;

  if (seoScore !== null && seoScore >= 60) {
    scoreBase += 5;
  }

  // 5) Şikayet sayısı → negatif etki
  const complaints =
    searchIntel && typeof searchIntel.complaints_count === "number"
      ? searchIntel.complaints_count
      : 0;

  if (complaints >= 3) {
    scoreBase -= 10;
  } else if (complaints === 2) {
    scoreBase -= 5;
  }

  // 6) Basit normalizasyon
  if (Number.isNaN(scoreBase)) scoreBase = 40;
  scoreBase = Math.max(0, Math.min(100, Math.round(scoreBase)));

  return scoreBase;
}

/**
 * Tek bir lead için full intel (lead + website + search + reputation + quality_score)
 */
async function getLeadIntel(leadId) {
  const db = await getCrmDb();

  const lead = db
    .prepare(
      `
      SELECT *
      FROM potential_leads
      WHERE id = ?
    `,
    )
    .get(leadId);

  if (!lead) return null;

  const websiteIntel = getLatestWebsiteIntel(db, lead.id);
  const searchIntel = getLatestSearchIntel(db, lead.id);
  const reputation = getLatestReputationInsight(db, lead.id);

  const lead_quality_score = computeLeadQualityScore({
    lead,
    websiteIntel,
    searchIntel,
    reputation,
  });

  return {
    lead: {
      ...lead,
      lead_quality_score,
    },
    websiteIntel,
    searchIntel,
    reputation,
  };
}

/**
 * Lead listesi + inline intel snapshot
 *  - Sayfalama için page / limit parametreleri alır
 *  - Her lead için websiteIntel / reputation / searchIntel minimal snapshot + quality_score döner
 */
async function getLeadListWithIntel({ page = 1, limit = 20 } = {}) {
  const db = await getCrmDb();

  const offset = (page - 1) * limit;

  const leads = db
    .prepare(
      `
      SELECT *
      FROM potential_leads
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `,
    )
    .all(limit, offset);

  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM potential_leads`).get();
  const total = totalRow ? totalRow.cnt : 0;

  const items = leads.map((lead) => {
    const websiteIntel = getLatestWebsiteIntel(db, lead.id);
    const searchIntel = getLatestSearchIntel(db, lead.id);
    const reputation = getLatestReputationInsight(db, lead.id);

    const lead_quality_score = computeLeadQualityScore({
      lead,
      websiteIntel,
      searchIntel,
      reputation,
    });

    return {
      ...lead,
      lead_quality_score,
      website_intel: websiteIntel,
      reputation,
      search_intel: searchIntel,
    };
  });

  return {
    items,
    total,
    page,
    limit,
  };
}

/**
 * Dashboard summary: kaç lead var, kaçı intel / reputation almış
 */
async function getLeadIntelSummary() {
  const db = await getCrmDb();

  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM potential_leads`).get();
  const totalLeads = totalRow ? totalRow.cnt : 0;

  const withWebsiteRow = db
    .prepare(
      `
      SELECT COUNT(DISTINCT lead_id) as cnt
      FROM website_intel
    `,
    )
    .get();
  const leadsWithWebsiteIntel = withWebsiteRow ? withWebsiteRow.cnt : 0;

  const withReputationRow = db
    .prepare(
      `
      SELECT COUNT(DISTINCT lead_id) as cnt
      FROM lead_reputation_insights
    `,
    )
    .get();
  const leadsWithReputation = withReputationRow ? withReputationRow.cnt : 0;

  const leadsWithoutReputation = Math.max(
    0,
    totalLeads - leadsWithReputation,
  );

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
  getLeadListWithIntel,
  computeLeadQualityScore, // ileride başka yerlerde kullanmak için export ediyoruz
};