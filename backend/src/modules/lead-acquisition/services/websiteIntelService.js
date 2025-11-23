// backend/src/modules/lead-acquisition/services/leadIntelService.js

"use strict";

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

// Lead list + base quality skorları buradan geliyor
const { getLeadList } = require("./leadListService");

/**
 * Website intel'den kalite ve fırsat sınıflandırması üretir
 *
 * Dönüş:
 *  - websiteScore: 0–100
 *  - websiteQuality: no_site | weak | medium | strong
 *  - websiteQualityNotes: string[]
 *  - websiteOpportunityType: brand_new_website | website_rebuild | seo_content_upgrade | high_quality
 *  - websiteOpportunityNotes: string[]
 */
function classifyWebsiteForLead(intel) {
  // Hiç site yok / httpStatus problemli
  if (
    !intel ||
    !intel.httpStatus ||
    intel.httpStatus < 200 ||
    intel.httpStatus >= 400
  ) {
    return {
      websiteScore: 0,
      websiteQuality: "no_site",
      websiteQualityNotes: [
        "Website'e erişilemedi veya HTTP hatası alındı.",
      ],
      websiteOpportunityType: "brand_new_website",
      websiteOpportunityNotes: [
        "Website şu an erişilemiyor veya HTTP hatası veriyor. Domain aktif ama site çalışmıyor olabilir.",
      ],
    };
  }

  const meta = intel.meta || {};
  const seo = meta.seo || {};
  const structure = meta.structure || {};

  const seoScore = typeof seo.score === "number" ? seo.score : 0;
  const metaScore =
    typeof meta.score === "number" ? meta.score : seoScore;

  const hasTitle = !!structure.hasTitle;
  const hasDescription = !!structure.hasDescription;

  const websiteQualityNotes = [];
  const websiteOpportunityNotes = [];

  if (!hasTitle || !hasDescription) {
    websiteQualityNotes.push("Başlık veya açıklama eksik.");
  }

  if (Array.isArray(seo.issues) && seo.issues.length > 0) {
    websiteOpportunityNotes.push(...seo.issues);
  }

  let websiteQuality = "medium";
  let websiteOpportunityType = "seo_content_upgrade";

  if (seoScore < 50 || !hasTitle || !hasDescription) {
    websiteQuality = "weak";
    websiteOpportunityType = "website_rebuild";

    websiteOpportunityNotes.unshift(
      "Başlık / açıklama eksik, tasarım & içerik tarafında ciddi iyileştirme fırsatı var.",
      "SEO tarafında önemli eksikler mevcut."
    );
  } else if (seoScore >= 80) {
    websiteQuality = "strong";

    if (seo.issues && seo.issues.length > 0) {
      websiteOpportunityType = "seo_content_upgrade";
      websiteOpportunityNotes.unshift(
        "Website iyi durumda fakat SEO & içerik tarafında upgrade fırsatları var."
      );
    } else {
      websiteOpportunityType = "high_quality";
      websiteOpportunityNotes.unshift(
        "Website güçlü görünüyor. Reklam, performans ve ölçeklendirme odaklı teklif için uygun."
      );
    }
  } else {
    websiteQuality = "medium";
    websiteOpportunityType = "seo_content_upgrade";
    websiteOpportunityNotes.unshift(
      "Website ortalama seviyede, SEO ve içerik tarafında iyileştirme fırsatları var."
    );
  }

  // duplicate notları temizle
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

  return {
    websiteScore: metaScore,
    websiteQuality,
    websiteQualityNotes: uniq(websiteQualityNotes),
    websiteOpportunityType,
    websiteOpportunityNotes: uniq(websiteOpportunityNotes),
  };
}

/**
 * DB satırını typed website_intel objesine çevir
 */
function buildWebsiteIntelFromRow(row) {
  if (!row) return null;

  let meta = null;
  if (row.meta_json) {
    try {
      meta = JSON.parse(row.meta_json);
    } catch (e) {
      meta = null;
    }
  }

  const base = {
    id: row.id,
    leadId: row.lead_id || null,
    url: row.url,
    httpStatus: row.http_status,
    title: row.title,
    description: row.description,
    meta,
    lastCheckedAt: row.last_checked_at || null,
    error: row.error_message || null,
  };

  const classification = classifyWebsiteForLead(base);

  return {
    ...base,
    websiteScore: classification.websiteScore,
    websiteQuality: classification.websiteQuality,
    websiteQualityNotes: classification.websiteQualityNotes,
    websiteOpportunityType: classification.websiteOpportunityType,
    websiteOpportunityNotes: classification.websiteOpportunityNotes,
  };
}

/**
 * DB satırını typed search_intel objesine çevir
 */
function buildSearchIntelFromRow(row) {
  if (!row) return null;

  let results = null;
  if (row.results_json) {
    try {
      results = JSON.parse(row.results_json);
    } catch (e) {
      results = null;
    }
  }

  return {
    id: row.id,
    leadId: row.lead_id,
    query: row.query,
    engine: row.engine,
    results,
    mentionsCount: row.mentions_count,
    complaintsCount: row.complaints_count,
    lastCheckedAt: row.last_checked_at || null,
    status: row.status || null,
    error: row.error_message || null,
  };
}

/**
 * DB satırını typed reputation objesine çevir
 */
function buildReputationFromRow(row) {
  if (!row) return null;

  let keyOpportunities = null;
  let suggestedActions = null;

  if (row.key_opportunities_json) {
    try {
      keyOpportunities = JSON.parse(row.key_opportunities_json);
    } catch (_) {
      keyOpportunities = null;
    }
  }

  if (row.suggested_actions_json) {
    try {
      suggestedActions = JSON.parse(row.suggested_actions_json);
    } catch (_) {
      suggestedActions = null;
    }
  }

  return {
    id: row.id,
    leadId: row.lead_id,
    searchIntelId: row.search_intel_id || null,
    reputationScore: row.reputation_score,
    riskLevel: row.risk_level,
    positiveRatio: row.positive_ratio,
    negativeRatio: row.negative_ratio,
    summaryMarkdown: row.summary_markdown,
    keyOpportunities,
    suggestedActions,
    lastUpdatedAt: row.last_updated_at || null,
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

  const websiteIntel = buildWebsiteIntelFromRow(websiteRow);
  const searchIntel = buildSearchIntelFromRow(searchRow);
  const reputation = buildReputationFromRow(reputationRow);

  return {
    lead,
    websiteIntel,
    searchIntel,
    reputation,
  };
}

/**
 * Intel summary (dashboard sayıları)
 */
async function getLeadIntelSummary() {
  const db = await getCrmDb();

  const totalLeadsRow = db
    .prepare(`SELECT COUNT(*) AS c FROM potential_leads`)
    .get();
  const totalLeads = totalLeadsRow.c || 0;

  const leadsWithWebsiteRow = db
    .prepare(
      `
      SELECT COUNT(DISTINCT lead_id) AS c
      FROM website_intel
      WHERE http_status BETWEEN 200 AND 399
    `
    )
    .get();
  const leadsWithWebsiteIntel = leadsWithWebsiteRow.c || 0;

  const leadsWithReputationRow = db
    .prepare(
      `
      SELECT COUNT(DISTINCT lead_id) AS c
      FROM lead_reputation_insights
    `
    )
    .get();
  const leadsWithReputation = leadsWithReputationRow.c || 0;

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
 * Lead listesi (paged) + website/search/reputation intel birleşmiş hali
 *
 * Not: base list + quality skorları leadListService.getLeadList'ten geliyor.
 */
async function getLeadListWithIntel({ page = 1, limit = 20 }) {
  const db = await getCrmDb();

  // Base list (normalized_name, lead_quality_score vs.)
  const base = await getLeadList({ page, limit });
  const items = base.items || [];

  const websiteStmt = db.prepare(
    `
    SELECT *
    FROM website_intel
    WHERE lead_id = ?
    ORDER BY last_checked_at DESC, id DESC
    LIMIT 1
  `
  );

  const searchStmt = db.prepare(
    `
    SELECT *
    FROM lead_search_intel
    WHERE lead_id = ?
    ORDER BY last_checked_at DESC, id DESC
    LIMIT 1
  `
  );

  const reputationStmt = db.prepare(
    `
    SELECT *
    FROM lead_reputation_insights
    WHERE lead_id = ?
    ORDER BY last_updated_at DESC, id DESC
    LIMIT 1
  `
  );

  const enrichedItems = items.map((row) => {
    const websiteRow = websiteStmt.get(row.id);
    const searchRow = searchStmt.get(row.id);
    const reputationRow = reputationStmt.get(row.id);

    const websiteIntel = buildWebsiteIntelFromRow(websiteRow);
    const searchIntel = buildSearchIntelFromRow(searchRow);
    const reputation = buildReputationFromRow(reputationRow);

    return {
      ...row,

      // full nested intel
      website_intel: websiteIntel,
      search_intel: searchIntel,
      reputation,

      // Website snapshot (frontend için düz alanlar)
      website_score: websiteIntel?.websiteScore || null,
      website_quality: websiteIntel?.websiteQuality || null,
      website_opportunity_type:
        websiteIntel?.websiteOpportunityType || null,

      // Reputation snapshot (frontend hızlı filtre/sort için)
      reputation_score: reputation?.reputationScore || null,
      reputation_risk_level: reputation?.riskLevel || null,
      reputation_positive_ratio: reputation?.positiveRatio || null,
      reputation_negative_ratio: reputation?.negativeRatio || null,
    };
  });

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