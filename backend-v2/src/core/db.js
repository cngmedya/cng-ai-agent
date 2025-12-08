// backend-v2/src/core/db.js

const path = require('path');
const Database = require('better-sqlite3');

let db;

/**
 * Tüm ana veritabanı şemasını burada açıyoruz.
 * Tek dosya: data/app.sqlite
 *
 * - potential_leads        → discovery + intel + research ana lead tablosu
 * - lead_intel_reports     → CIR / high-level intel rapor arşivi
 * - lead_search_intel      → web / OSINT arama snapshot’ları
 * - lead_crm_notes         → aramalar / toplantılar / whatsapp / email notları
 * - lead_crm_brains        → AI CRM beyni snapshot’ları
 * - godmode_jobs           → GODMODE discovery job’ları
 */
function initSchema(dbInstance) {
  // Foreign key desteğini aç
  dbInstance.pragma('foreign_keys = ON');

  // Ana lead tablosu
  dbInstance.exec(`
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
      source TEXT,          -- google_places | manual | import | godmode
      created_at TEXT,      -- ISO string
      ai_category TEXT,     -- AI'nin atadığı kategori (opsiyonel)
      ai_score INTEGER,     -- 0–100 potansiyel skoru
      ai_notes TEXT         -- kısa AI notu / etiketler
    );
  `);

  // CIR / intel raporları
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS lead_intel_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      cir_json TEXT NOT NULL,         -- tam CIR payload'ı (JSON string)
      overall_score INTEGER,          -- 0–100 veya null
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
    );
  `);

  // Web / OSINT arama sonuçları
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS lead_search_intel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      query TEXT NOT NULL,
      engine TEXT NOT NULL,           -- google | bing | mock | internal
      results_json TEXT,              -- normalize edilmiş sonuçlar (JSON)
      mentions_count INTEGER DEFAULT 0,
      complaints_count INTEGER DEFAULT 0,
      last_checked_at TEXT,           -- ISO string
      status TEXT,                    -- ok | no_results | error
      error_message TEXT,
      FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_search_intel_lead
      ON lead_search_intel (lead_id);
  `);

  // CRM notları
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS lead_crm_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      note_type TEXT,                 -- call | meeting | whatsapp | email | generic | system
      channel TEXT,                   -- whatsapp | phone | email | instagram | linkedin | other
      direction TEXT,                 -- inbound | outbound | internal
      title TEXT,
      body TEXT NOT NULL,             -- notun serbest metni
      sentiment TEXT,                 -- positive | neutral | negative | mixed | unknown
      tags TEXT,                      -- JSON string: ["hot_lead","follow_up","pricing"]
      source TEXT,                    -- manual | ai | integration
      meta_json TEXT,                 -- ekstra ham metadata (JSON)
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,                -- kullanıcı id / isim (opsiyonel)
      FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_crm_notes_lead
      ON lead_crm_notes (lead_id);
  `);

  // CRM Brain snapshot’ları
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS lead_crm_brains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      brain_version TEXT,             -- örn: v1.0.0
      brain_json TEXT NOT NULL,       -- AI özet beyin durumu (JSON)
      last_source TEXT,               -- research | whatsapp_v3 | manual | godmode
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_crm_brains_lead
      ON lead_crm_brains (lead_id);
  `);

  // GODMODE discovery job’ları için tablo
  // src/modules/godmode/repo.js içindeki SELECT/INSERT/UPDATE’lerle uyumlu minimal şema
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS godmode_jobs (
      id TEXT PRIMARY KEY,            -- UUID
      type TEXT NOT NULL,             -- discovery_scan vb.
      label TEXT,
      criteria_json TEXT NOT NULL,    -- request.body kriterleri (JSON)
      status TEXT NOT NULL,           -- queued | running | completed | failed
      progress_percent INTEGER DEFAULT 0,
      found_leads INTEGER DEFAULT 0,
      enriched_leads INTEGER DEFAULT 0,
      result_summary_json TEXT,       -- summary + stats (JSON)
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_godmode_jobs_status
      ON godmode_jobs (status);

    CREATE INDEX IF NOT EXISTS idx_godmode_jobs_created_at
      ON godmode_jobs (created_at);
  `);
}

function getDb() {
  if (!db) {
    const dbPath = path.join(__dirname, '..', 'data', 'app.sqlite'); // eski DB ile aynı
    db = new Database(dbPath);
    initSchema(db);
  }
  return db;
}

module.exports = {
  getDb,
};