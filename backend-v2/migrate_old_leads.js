// backend-v2/migrate_old_leads.js
const path = require('path');
const Database = require('better-sqlite3');

// Yeni v2 DB
const newDbPath = path.join(__dirname, 'data', 'app.sqlite');
// Eski backend DB
const oldDbPath = path.join(__dirname, '..', 'backend', 'src', 'data', 'crm.sqlite');

console.log('[MIGRATE] Old DB:', oldDbPath);
console.log('[MIGRATE] New DB:', newDbPath);

const oldDb = new Database(oldDbPath);
const newDb = new Database(newDbPath);

newDb.pragma('journal_mode = WAL');
newDb.pragma('foreign_keys = ON');

// 1) Yeni tabloları oluştur (şimdilik sadece potential_leads)
newDb.exec(`
  CREATE TABLE IF NOT EXISTS potential_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    category TEXT,
    phone TEXT,
    website TEXT,
    google_place_id TEXT UNIQUE,
    google_rating REAL,
    google_user_ratings_total INTEGER,
    source TEXT,
    created_at TEXT
  );
`);

console.log('[MIGRATE] potential_leads table ensured on new DB');

// 2) Eski DB'den kayıtları çek
const oldLeads = oldDb.prepare('SELECT * FROM potential_leads').all();
console.log('[MIGRATE] Found old leads:', oldLeads.length);

// 3) Insert / Upsert
const insertStmt = newDb.prepare(`
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

const migrate = newDb.transaction(() => {
  let inserted = 0;

  for (const row of oldLeads) {
    const payload = {
      name: row.name || null,
      address: row.address || null,
      city: row.city || null,
      country: row.country || null,
      category: row.category || null,
      phone: row.phone || null,
      website: row.website || null,
      google_place_id: row.google_place_id || null,
      google_rating: row.google_rating || null,
      google_user_ratings_total: row.google_user_ratings_total || null,
      source: row.source || 'legacy',
      created_at: row.created_at || new Date().toISOString()
    };

    const result = insertStmt.run(payload);
    inserted += result.changes || 0;
  }

  return inserted;
});

const insertedCount = migrate();
console.log(`[MIGRATE] Migration completed. Inserted/updated rows: ${insertedCount}`);

oldDb.close();
newDb.close();
console.log('[MIGRATE] Done.');