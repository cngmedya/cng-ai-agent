/**
 * backend-v2/src/jobs/migrateOldLeads.js
 * Eski DB (backend/src/data/crm.sqlite → potential_leads)
 *  -> Yeni DB (backend-v2/src/data/crm.sqlite → potential_leads)
 */

const path = require('path');
const Database = require('better-sqlite3');

console.log("\n[migrate:old-leads] Migration başladı...\n");

// ✅ Eski DB (backend v1)
const oldDbPath = path.join(
  __dirname,
  '../../../backend/src/data/crm.sqlite'
);

// ✅ Yeni DB (backend-v2)
const newDbPath = path.join(
  __dirname,
  '../..',
  'src/data/crm.sqlite'
);

console.log("[migrate:old-leads] Eski DB:", oldDbPath);
console.log("[migrate:old-leads] Yeni DB:", newDbPath);

// Eski / yeni DB aç
let oldDb;
let newDb;

try {
  oldDb = new Database(oldDbPath, { readonly: true });
} catch (e) {
  console.error("\n❌ Eski veritabanı açılamadı:", e.message);
  process.exit(1);
}

try {
  newDb = new Database(newDbPath);
} catch (e) {
  console.error("\n❌ Yeni veritabanı açılamadı:", e.message);
  process.exit(1);
}

// Yeni DB şemasını garantiye al (v2 potential_leads ile uyumlu)
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
    created_at TEXT,
    ai_category TEXT,
    ai_score INTEGER,
    ai_notes TEXT
  )
`);

console.log("[migrate:old-leads] Yeni tablo hazır.");

// 🔍 Eski DB'deki potential_leads yapısı:
//
// company_name TEXT,
// category TEXT,
// website TEXT,
// phone TEXT,
// address TEXT,
// city TEXT,
// country TEXT,
// source TEXT,
// status TEXT,
// created_at TEXT,
// updated_at TEXT,
// normalized_name TEXT,
// normalized_category TEXT,
// normalized_city TEXT,
// lead_quality_score INTEGER,
// lead_quality_notes TEXT
//
// Bunları v2 şemasına map'liyoruz.
const oldRows = oldDb.prepare(`
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
    created_at,
    lead_quality_score,
    lead_quality_notes
  FROM potential_leads
`).all();

console.log(`[migrate:old-leads] Eski DB potential_leads kaydı: ${oldRows.length}`);

// Eski → Yeni map
const mappedRows = oldRows.map((row) => {
  return {
    id: row.id, // ID'yi koruyoruz (ileride referans için faydalı)
    name: row.company_name || null,
    address: row.address || null,
    city: row.city || null,
    country: row.country || 'Türkiye',
    category: row.category || null,
    phone: row.phone || null,
    website: row.website || null,
    google_place_id: null,
    google_rating: null,
    google_user_ratings_total: null,
    source: row.source || 'legacy_v1',
    created_at: row.created_at || new Date().toISOString(),
    ai_category: null,
    ai_score: row.lead_quality_score || null,
    ai_notes: row.lead_quality_notes || null
  };
});

const insert = newDb.prepare(`
  INSERT OR REPLACE INTO potential_leads (
    id,
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
    ai_category,
    ai_score,
    ai_notes
  ) VALUES (
    @id,
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
    @created_at,
    @ai_category,
    @ai_score,
    @ai_notes
  )
`);

newDb.transaction(() => {
  for (const row of mappedRows) {
    insert.run(row);
  }
})();

const countRow = newDb.prepare(`SELECT COUNT(*) AS c FROM potential_leads`).get();
console.log(`\n✅ [migrate:old-leads] Migration tamamlandı. Yeni DB potential_leads sayısı: ${countRow.c}\n`);

oldDb.close();
newDb.close();