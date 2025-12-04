// backend-v2/src/modules/discovery/service.js
const {
  listLeads,
  countLeads,
  findLeadsWithoutAI,
  findRecentLeads,
  updateLeadAIFields,
  upsertLeadFromPlace
} = require('./repo');

const { searchPlacesText } = require('./placesClient');
const { rankLeadWithAI } = require('./aiRanker');
const { getDb } = require('../../core/db');

async function getLeadsPage({ page = 1, pageSize = 20 } = {}) {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  const items = listLeads({ limit, offset });
  const total = countLeads();

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  };
}

async function health() {
  try {
    const total = countLeads();
    return { ok: true, leadCount: total };
  } catch (err) {
    return { ok: false, leadCount: 0, error: err.message };
  }
}

async function importFromPlaces({ query, maxPages = 1 }) {
  if (!query || typeof query !== 'string') {
    throw new Error('query string olmalı (örn: "mimarlık ofisi İstanbul")');
  }

  const places = await searchPlacesText({ query, maxPages });

  let inserted = 0;
  const db = getDb();

  const run = db.transaction(() => {
    for (const place of places) {
      const result = upsertLeadFromPlace(place, { source: 'google_places' });
      inserted += result.changes || 0;
    }
  });

  run();

  return {
    found: places.length,
    inserted
  };
}

/**
 * AI skoru olmayan lead'lerden bir batch al ve AI ile doldur.
 */
async function rankMissingLeads({ limit = 10 } = {}) {
  const leads = findLeadsWithoutAI({ limit });
  if (!leads.length) {
    return { processed: 0, remaining: 0 };
  }

  let processed = 0;

  for (const lead of leads) {
    const aiData = await rankLeadWithAI(lead);
    updateLeadAIFields(lead.id, aiData);
    processed++;
  }

  const db = getDb();
  const remaining = db
    .prepare('SELECT COUNT(*) AS count FROM potential_leads WHERE ai_score IS NULL')
    .get().count;

  return {
    processed,
    remaining
  };
}

/**
 * Full AI Discovery:
 * 1) Places'ten veri çek
 * 2) DB'ye upsert et
 * 3) En yeni lead'leri AI ile enrich et
 * 4) Enriched listeyi döndür
 */
async function aiSearch({ query, maxPages = 1, aiLimit = 20 } = {}) {
  // 1) Places import
  const importResult = await importFromPlaces({ query, maxPages });

  const totalToEnrich =
    importResult.found > 0
      ? Math.min(importResult.found, aiLimit)
      : aiLimit;

  // 2) En yeni lead'leri al
  const recentLeads = findRecentLeads({ limit: totalToEnrich });

  // 3) AI ile enrich et + DB'ye yaz
  const enriched = [];
  for (const lead of recentLeads) {
    const aiData = await rankLeadWithAI(lead);
    updateLeadAIFields(lead.id, aiData);
    enriched.push({
      ...lead,
      ...aiData
    });
  }

  return {
    import: importResult,
    enrichedCount: enriched.length,
    items: enriched
  };
}

module.exports = {
  getLeadsPage,
  health,
  importFromPlaces,
  rankMissingLeads,
  aiSearch
};