const { getDb } = require('../../../core/db');
const FRESHNESS_WINDOW_DAYS = Number(process.env.GODMODE_FRESHNESS_DAYS || 30);

const ENABLE_DEEP_ENRICHMENT = process.env.GODMODE_DEEP_ENRICHMENT === '1';
const DEEP_ENRICHMENT_SOURCES = (process.env.GODMODE_DEEP_ENRICHMENT_SOURCES || 'website,tech,seo,social')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const COLLECT_DEEP_ENRICHMENT_IDS = process.env.GODMODE_DEEP_ENRICHMENT_COLLECT_IDS === '1';
const DEEP_ENRICHMENT_IDS_CAP = Number(process.env.GODMODE_DEEP_ENRICHMENT_IDS_CAP || 200);

/**
 * GODMODE result_summary.sample_leads içindeki lead objesini
 * potential_leads tablosuna uygun parametrelere map eder.
 *
 * Beklenen örnek shape (Google Places):
 * {
 *   provider: "google_places",
 *   place_id: "ChIJ...",
 *   name: "...",
 *   address: "...",
 *   city: "İstanbul",
 *   country: "Türkiye",
 *   rating: 4.9,
 *   user_ratings_total: 23,
 *   types: [...],
 *   business_status: "OPERATIONAL",
 *   location: { lat: 40.9, lng: 29.1 },
 *   raw: { ... }
 * }
 */
function mapSummaryLeadToDbParams(lead) {
  const firstType =
    Array.isArray(lead.types) && lead.types.length > 0 ? lead.types[0] : null;

  return {
    name: lead.name || null,
    address: lead.address || null,
    city: lead.city || null,
    country: lead.country || null,
    category: firstType,
    phone: lead.phone || null,
    website: lead.website || null,
    google_place_id: lead.place_id || lead.google_place_id || null,
    google_rating: typeof lead.rating === 'number' ? lead.rating : null,
    google_user_ratings_total:
      typeof lead.user_ratings_total === 'number' ? lead.user_ratings_total : null,
    source: lead.provider || 'godmode',
    updated_at: "datetime('now')",
  };
}

/**
 * sample_leads listesini alır, potential_leads tablosuna
 * INSERT ... ON CONFLICT(google_place_id) DO UPDATE ile yazar.
 */
function bulkUpsertLeadsFromSummary(sampleLeads /* merged leads */, opts = {}) {
  if (!Array.isArray(sampleLeads) || sampleLeads.length === 0) {
    return {
      affected_rows: 0,
      skipped_enrichment_rows: 0,
      deep_enrichment_candidates: 0,
      deep_enrichment_candidate_ids: [],
    };
  }

  const forceRefresh = opts && opts.forceRefresh === true;

  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO potential_leads (
      name,
      address,
      city,
      country,
      category,
      phone,
      website,
      google_place_id,
      google_rating,
      google_user_ratings_total,
      source,
      created_at,
      updated_at,
      skip_enrichment
    ) VALUES (
      @name,
      @address,
      @city,
      @country,
      @category,
      @phone,
      @website,
      @google_place_id,
      @google_rating,
      @google_user_ratings_total,
      @source,
      datetime('now'),
      datetime('now'),
      0
    )
    ON CONFLICT(google_place_id) DO UPDATE SET
      name                      = excluded.name,
      address                   = excluded.address,
      city                      = excluded.city,
      country                   = excluded.country,
      category                  = excluded.category,
      phone                     = COALESCE(excluded.phone, phone),
      website                   = COALESCE(excluded.website, website),
      google_rating             = COALESCE(excluded.google_rating, google_rating),
      google_user_ratings_total = COALESCE(excluded.google_user_ratings_total, google_user_ratings_total),
      source                    = excluded.source,
      updated_at                = datetime('now'),
      skip_enrichment = CASE
        WHEN ${forceRefresh ? 1 : 0} = 1
        THEN 0
        WHEN potential_leads.updated_at >= datetime('now', '-' || ${FRESHNESS_WINDOW_DAYS} || ' days')
        THEN 1
        ELSE 0
      END
  `);

  const selectSkipStmt = db.prepare(`
    SELECT skip_enrichment
    FROM potential_leads
    WHERE google_place_id = ?
    LIMIT 1
  `);

  let affected = 0;
  let skippedEnrichment = 0;
  let deepCandidates = 0;
  const deepCandidateIds = [];

  const tx = db.transaction((rows) => {
    for (const lead of rows) {
      const params = mapSummaryLeadToDbParams(lead);

      if (!params.google_place_id) continue;

      stmt.run(params);
      affected += 1;

      const row = selectSkipStmt.get(params.google_place_id);
      if (row && row.skip_enrichment === 1) {
        skippedEnrichment += 1;
      }
      if (ENABLE_DEEP_ENRICHMENT && (!row || row.skip_enrichment === 0)) {
        deepCandidates += 1;

        if (
          COLLECT_DEEP_ENRICHMENT_IDS &&
          deepCandidateIds.length < DEEP_ENRICHMENT_IDS_CAP
        ) {
          deepCandidateIds.push(params.google_place_id);
        }
      }
    }
  });

  tx(sampleLeads);

  return {
    affected_rows: affected,
    skipped_enrichment_rows: skippedEnrichment,
    deep_enrichment_candidates: deepCandidates,
    deep_enrichment_candidate_ids: deepCandidateIds,
  };
}

module.exports = {
  bulkUpsertLeadsFromSummary,
};