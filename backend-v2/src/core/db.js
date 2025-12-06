// backend-v2/src/core/db.js
const path = require('path');
const Database = require('better-sqlite3');

let db;

// Şema başlangıç fonksiyonu
function initSchema(db) {
  // Foreign key desteğini aç
  db.pragma('foreign_keys = ON');

  // Ana lead tablosu (discovery + intel + research hepsi buradan beslenecek)
  db.exec(`
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
    );
  `);

  // CIR / intel raporları (high-level rapor arşivi)
  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_intel_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      cir_json TEXT NOT NULL,
      overall_score INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
    );
  `);

  // 🔍 Web arama (OSINT) sonuçlarının özetini tuttuğumuz tablo
  // websearchService.js → persistSearchIntel burayı kullanıyor
  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_search_intel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      query TEXT NOT NULL,
      engine TEXT NOT NULL,             -- google | bing | mock
      results_json TEXT,                -- normalize edilmiş sonuçlar (JSON string)
      mentions_count INTEGER DEFAULT 0,
      complaints_count INTEGER DEFAULT 0,
      last_checked_at TEXT,
      status TEXT,                      -- ok | no_results | error
      error_message TEXT,
      FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_search_intel_lead
      ON lead_search_intel (lead_id);
  `);
}

function getDb() {
  if (!db) {
    const dbPath = path.join(__dirname, '..', 'data', 'crm.sqlite');
    db = new Database(dbPath);

    initSchema(db);
  }
  return db;
}

module.exports = {
  getDb
};