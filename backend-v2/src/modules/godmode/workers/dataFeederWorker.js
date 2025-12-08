// backend-v2/src/modules/godmode/workers/dataFeederWorker.js

const { getDb } = require('../../../core/db');

function buildLeadRow(lead, job) {
  const criteria = job.criteria || {};
  const city = lead.city || criteria.city || null;
  const country = lead.country || criteria.country || null;

  return {
    name: lead.name || null,
    address: lead.address || null,
    city,
    country,
    category: Array.isArray(lead.types) && lead.types.length > 0 ? lead.types[0] : null,
    phone: null,
    website: null,
    google_place_id: lead.place_id,
    google_rating:
      typeof lead.rating === 'number' ? lead.rating : null,
    google_user_ratings_total: lead.user_ratings_total || 0,
    source: 'godmode',
    created_at: new Date().toISOString(),
  };
}

/**
 * Discovery sonucunda gelen lead’leri potential_leads tablosuna yazar.
 * google_place_id UNIQUE olduğu için INSERT OR UPDATE davranıyoruz.
 */
function feedDiscoveryResults(job, leads) {
  if (!Array.isArray(leads) || leads.length === 0) {
    return { upserted: 0 };
  }

  const db = getDb();

  const upsertStmt = db.prepare(`
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
      @created_at
    )
    ON CONFLICT(google_place_id) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      city = excluded.city,
      country = excluded.country,
      category = excluded.category,
      google_rating = excluded.google_rating,
      google_user_ratings_total = excluded.google_user_ratings_total,
      source = excluded.source
  `);

  const tx = db.transaction(items => {
    for (const lead of items) {
      const row = buildLeadRow(lead, job);
      upsertStmt.run(row);
    }
  });

  tx(leads);

  return { upserted: leads.length };
}

module.exports = {
  feedDiscoveryResults,
};