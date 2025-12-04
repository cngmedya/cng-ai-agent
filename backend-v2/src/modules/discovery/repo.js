// backend-v2/src/modules/discovery/repo.js
const { getDb } = require('../../core/db');

function listLeads({ limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT *
    FROM potential_leads
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset);
}

function countLeads() {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) AS count FROM potential_leads`).get();
  return row.count || 0;
}

function findLeadsWithoutAI({ limit = 10 } = {}) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT *
    FROM potential_leads
    WHERE ai_score IS NULL
    ORDER BY id ASC
    LIMIT ?
  `);
  return stmt.all(limit);
}

function findRecentLeads({ limit = 20 } = {}) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT *
    FROM potential_leads
    ORDER BY id DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

function updateLeadAIFields(id, { ai_category, ai_score, ai_notes }) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE potential_leads
    SET
      ai_category = @ai_category,
      ai_score = @ai_score,
      ai_notes = @ai_notes
    WHERE id = @id
  `);
  return stmt.run({
    id,
    ai_category,
    ai_score,
    ai_notes
  });
}

function upsertLeadFromPlace(place, { source = 'google_places' } = {}) {
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
      @created_at
    )
    ON CONFLICT(google_place_id) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      city = excluded.city,
      country = excluded.country,
      category = excluded.category,
      phone = excluded.phone,
      website = excluded.website,
      google_rating = excluded.google_rating,
      google_user_ratings_total = excluded.google_user_ratings_total,
      source = excluded.source,
      created_at = excluded.created_at
  `);

  const payload = {
    name: place.name || null,
    address: place.formatted_address || place.vicinity || null,
    city: null,
    country: null,
    category: (place.types && place.types[0]) || null,
    phone: null,
    website: null,
    google_place_id: place.place_id || null,
    google_rating: place.rating || null,
    google_user_ratings_total: place.user_ratings_total || null,
    source,
    created_at: new Date().toISOString()
  };

  return stmt.run(payload);
}

/**
 * YENİ EKLEDİĞİMİZ KRİTİK FONKSİYON
 */
function getLeadById(id) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT *
    FROM potential_leads
    WHERE id = ?
    LIMIT 1
  `);
  return stmt.get(id);
}

module.exports = {
  listLeads,
  countLeads,
  findLeadsWithoutAI,
  findRecentLeads,
  updateLeadAIFields,
  upsertLeadFromPlace,
  getLeadById
};