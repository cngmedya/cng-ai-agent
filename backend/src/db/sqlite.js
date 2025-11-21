// backend/src/db/sqlite.js

const path = require("path");
const Database = require("better-sqlite3");

// DB dosyasının yolu: backend/cng-ai-agent.db
const dbPath = path.join(__dirname, "..", "..", "cng-ai-agent.db");

// Tek bir global connection açıyoruz
const db = new Database(dbPath);

// Basit helper: tablo yoksa oluştur
function initDb() {
  // leads tablosu
  db.prepare(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      sector TEXT,
      location TEXT,
      google_place_id TEXT,
      website TEXT,
      phone TEXT,
      lead_score INTEGER,
      firmographic_score INTEGER,
      total_score INTEGER,
      status TEXT NOT NULL DEFAULT 'new',
      raw_json TEXT NOT NULL
    )
  `).run();

  // offers tablosu
  db.prepare(`
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      package_level TEXT,
      tone TEXT,
      offer_markdown TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    )
  `).run();

  // notes / aktiviteler
  db.prepare(`
    CREATE TABLE IF NOT EXISTS lead_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      type TEXT NOT NULL, -- call | email | meeting | note
      content TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    )
  `).run();
}

// Modül import edildiğinde tabloları garanti altına al
initDb();

module.exports = {
  db,
};