// backend/src/modules/lead-acquisition/services/leadIntelService.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

// Lead list için mevcut kalite + normalizasyon mantığını kullanalım
const { getLeadList } = require("./leadListService");

/**
 * Güvenli JSON parse helper'ı
 */
function safeJsonParse(str, fallback = null) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
}

/**
 * website_intel satırını API'ye uygun objeye çevir
 */
function mapWebsiteIntelRow(row) {
  if (!row) return null;

  const meta = safeJsonParse(row.meta_json, null);

  return {
    id: row.id,
    lead_id: row.lead_id,
    url: row.url,
    httpStatus: row.http_status,
    title: row.title,
    description: row.description,
    meta,
    last_checked_at: row.last_checked_at,
    error: row.error_message || null,
  };
}

/**
 * lead_search_intel satırını API'ye uygun objeye çevir
 */
function mapSearchIntelRow(row) {
  if (!row) return null;

  const results = safeJsonParse(row.results_json, []);

  return {
    id: row.id,
    lead_id: row.lead_id,
    query: row.query,
    engine: row.engine,
    results,
    mentions_count: row.mentions_count,
    complaints_count: row.complaints_count,
    last_checked_at: row.last_checked_at,
    status: row.status,
    error_message: row.error_message || null,
  };
}

/**
 * lead_reputation_insights satırını API'ye uygun objeye çevir
 */
function mapReputationRow(row) {
  if (!row) return null;

  const keyOpportunities = safeJsonParse(row.key_opportunities_json, []);
  const suggestedActions = safeJsonParse(row.suggested_actions_json, []);

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
    key_opportunities: keyOpportunities,
    suggested_actions: suggestedActions,
  };
}

/**
 * Website kalite sınıflandırması
 *  - score: meta.score veya meta.seo.score
 *  - websiteQuality:
 *      - "none"  : intel yok
 *      - "bad"   : httpStatus yok veya 4xx/5xx
 *      - "weak"  : score < 75
 *      - "strong": score >= 75
 */
function classifyWebsiteQuality(websiteIntel) {
  if (!websiteIntel) {
    return {
      websiteQuality: "none",
      websiteScore: 0,
      websiteQualityNotes: ["Website intel bulunamadı veya henüz taranmamış."],
    };
  }

  const notes = [];
  const meta = websiteIntel.meta || {};
  const seo = meta.seo || {};
  const structure = meta.structure || {};
  const performance = meta.performance || {};

  const score = typeof meta.score === "number"
    ? meta.score
    : typeof seo.score === "number"
      ? seo.score
      : 0;

  if (!websiteIntel.httpStatus || websiteIntel.httpStatus >= 400) {
    notes.push("Site HTTP düzeyinde hata dönüyor veya erişilemiyor.");
  }

  if (!structure.hasTitle && !websiteIntel.title) {
    notes.push("Başlık (title) eksik veya zayıf.");
  }

  if (!structure.hasDescription && !websiteIntel.description) {
    notes.push("Meta description eksik.");
  }

  if (performance.contentLength && performance.contentLength < 2000) {
    notes.push("Site içeriği çok kısa görünüyor (muhtemelen zayıf/boş sayfa).");
  }

  let websiteQuality = "weak";

  if (!websiteIntel.httpStatus || websiteIntel.httpStatus >= 400) {
    websiteQuality = "bad";
  } else if (score >= 75) {
    websiteQuality = "strong";
  } else {
    websiteQuality = "weak";
  }

  return {
    websiteQuality,
    websiteScore: score,
    websiteQualityNotes: notes,
  };
}

/**
 * Tek bir lead için full intel (lead + website + search + reputation)
 */
async function getLeadIntel(leadId) {
  const db = await getCrmDb();

  const lead = db
    .prepare(
      `
      SELECT *
      FROM potential_leads
      WHERE id = ?
    `
    )
    .get(leadId);

  if (!lead) {
    return null;
  }

  const websiteRow = db
    .prepare(
      `
      SELECT *
      FROM website_intel
      WHERE lead_id = ?
      ORDER BY last_checked_at DESC, id DESC
      LIMIT 1
    `
    )
    .get(leadId);

  const searchRow = db
    .prepare(
      `
      SELECT *
      FROM lead_search_intel
      WHERE lead_id = ?
      ORDER BY last_checked_at DESC, id DESC
      LIMIT 1
    `
    )
    .get(leadId);

  const reputationRow = db
    .prepare(
      `
      SELECT *
      FROM lead_reputation_insights
      WHERE lead_id = ?
      ORDER BY last_updated_at DESC, id DESC
      LIMIT 1
    `
    )
    .get(leadId);

  const websiteIntel = mapWebsiteIntelRow(websiteRow);
  const searchIntel = mapSearchIntelRow(searchRow);
  const reputation = mapReputationRow(reputationRow);

  const qualityInfo = classifyWebsiteQuality(websiteIntel);

  return {
    lead,
    websiteIntel,
    searchIntel,
    reputation,
    website_quality: qualityInfo.websiteQuality,
    website_score: qualityInfo.websiteScore,
    website_quality_notes: qualityInfo.websiteQualityNotes,
  };
}

/**
 * Intel summary (dashboard sayıları)
 */
async function getLeadIntelSummary() {
  const db = await getCrmDb();

  const totalLeadsRow = db
    .prepare(`SELECT COUNT(*) as c FROM potential_leads`)
    .get();

  const websiteIntelRow = db
    .prepare(
      `
      SELECT COUNT(DISTINCT lead_id) as c
      FROM website_intel
      WHERE http_status IS NOT NULL
    `
    )
    .get();

  const reputationRow = db
    .prepare(
      `
      SELECT COUNT(DISTINCT lead_id) as c
      FROM lead_reputation_insights
    `
    )
    .get();

  const totalLeads = totalLeadsRow?.c || 0;
  const leadsWithWebsiteIntel = websiteIntelRow?.c || 0;
  const leadsWithReputation = reputationRow?.c || 0;
  const leadsWithoutReputation = Math.max(
    0,
    totalLeads - leadsWithReputation
  );

  return {
    totalLeads,
    leadsWithWebsiteIntel,
    leadsWithReputation,
    leadsWithoutReputation,
  };
}

/**
 * Lead list (paged) + WebsiteIntel + SearchIntel + Reputation
 * Burada mevcut leadListService çıktısını zenginleştiriyoruz.
 *
 * Input:  { page, limit }
 * Output: { items: [...], total, page, limit }
 */
async function getLeadListWithIntel({ page = 1, limit = 20 } = {}) {
  const db = await getCrmDb();

  // Önce mevcut leadListService ile temel listeyi al
  // Bu zaten: normalized_name, lead_quality_score, lead_quality_notes vs. içeriyor.
  const base = await getLeadList({ page, limit });

  const enrichedItems = [];

  for (const lead of base.items) {
    const leadId = lead.id;

    const websiteRow = db
      .prepare(
        `
        SELECT *
        FROM website_intel
        WHERE lead_id = ?
        ORDER BY last_checked_at DESC, id DESC
        LIMIT 1
      `
      )
      .get(leadId);

    const searchRow = db
      .prepare(
        `
        SELECT *
        FROM lead_search_intel
        WHERE lead_id = ?
        ORDER BY last_checked_at DESC, id DESC
        LIMIT 1
      `
      )
      .get(leadId);

    const reputationRow = db
      .prepare(
        `
        SELECT *
        FROM lead_reputation_insights
        WHERE lead_id = ?
        ORDER BY last_updated_at DESC, id DESC
        LIMIT 1
      `
      )
      .get(leadId);

    const websiteIntel = mapWebsiteIntelRow(websiteRow);
    const searchIntel = mapSearchIntelRow(searchRow);
    const reputation = mapReputationRow(reputationRow);

    const qualityInfo = classifyWebsiteQuality(websiteIntel);

    enrichedItems.push({
      ...lead,
      website_intel: websiteIntel,
      search_intel: searchIntel,
      reputation,
      website_quality: qualityInfo.websiteQuality,
      website_score: qualityInfo.websiteScore,
      website_quality_notes: qualityInfo.websiteQualityNotes,
    });
  }

  return {
    ...base,
    items: enrichedItems,
  };
}

module.exports = {
  getLeadIntel,
  getLeadIntelSummary,
  getLeadListWithIntel,
};