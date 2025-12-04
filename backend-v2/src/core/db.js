// backend-v2/src/core/db.js
const path = require('path');
const Database = require('better-sqlite3');

let db;

// Şema başlangıç fonksiyonu
function initSchema(db) {
  // Foreign key desteğini aç
  db.pragma('foreign_keys = ON');

  // Eğer yeni bir DB oluşursa potential_leads tablosu da burada garanti altına alınmış olur.
  // Eğer zaten varsa, CREATE TABLE IF NOT EXISTS hiçbir şeye dokunmaz.
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

  // Yeni CIR rapor tablosu
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