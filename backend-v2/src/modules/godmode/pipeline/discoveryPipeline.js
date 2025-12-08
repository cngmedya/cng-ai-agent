// backend-v2/src/modules/godmode/pipeline/discoveryPipeline.js

const { getDb } = require('../../../core/db');

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
  const firstType = Array.isArray(lead.types) && lead.types.length > 0
    ? lead.types[0]
    : null;

  return {
    name: lead.name || null,
    address: lead.address || null,
    city: lead.city || null,
    country: lead.country || null,
    category: firstType,
    phone: lead.phone || null,        // şu an summary’de yok, ileride enrichment’ten gelebilir
    website: lead.website || null,    // aynı şekilde
    google_place_id: lead.place_id || lead.google_place_id || null,
    google_rating: typeof lead.rating === 'number' ? lead.rating : null,
    google_user_ratings_total: typeof lead.user_ratings_total === 'number'
      ? lead.user_ratings_total
      : null,
    source: lead.provider || 'godmode',
  };
}

/**
 * sample_leads listesini alır, potential_leads tablosuna
 * INSERT ... ON CONFLICT(google_place_id) DO UPDATE ile yazar.
 */
function bulkUpsertLeadsFromSummary(sampleLeads) {
  if (!Array.isArray(sampleLeads) || sampleLeads.length === 0) {
    return { inserted: 0, updated: 0 };
  }

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
      created_at
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
      datetime('now')
    )
    ON CONFLICT(google_place_id) DO UPDATE SET
      name                       = excluded.name,
      address                    = excluded.address,
      city                       = excluded.city,
      country                    = excluded.country,
      category                   = excluded.category,
      phone                      = COALESCE(excluded.phone, phone),
      website                    = COALESCE(excluded.website, website),
      google_rating              = COALESCE(excluded.google_rating, google_rating),
      google_user_ratings_total  = COALESCE(excluded.google_user_ratings_total, google_user_ratings_total),
      source                     = excluded.source
  `);

  let affected = 0;

  const tx = db.transaction((rows) => {
    for (const lead of rows) {
      const params = mapSummaryLeadToDbParams(lead);

      // google_place_id yoksa, DB’de uniqueness sağlayamayız → şimdilik atla
      if (!params.google_place_id) continue;

      stmt.run(params);
      affected += 1;
    }
  });

  tx(sampleLeads);

  return {
    inserted_or_updated: affected,
  };
}

module.exports = {
  bulkUpsertLeadsFromSummary,
};