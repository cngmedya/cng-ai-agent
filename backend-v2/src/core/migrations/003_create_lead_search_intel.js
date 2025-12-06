// backend-v2/src/core/migrations/003_create_lead_search_intel.js

/**
 * lead_search_intel tablosu:
 * - Web araması (OSINT) sonuçlarının özetini tutar
 * - Her kayıt bir lead + query + engine sonucu
 */
function up(db) {
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
  
  module.exports = { up };