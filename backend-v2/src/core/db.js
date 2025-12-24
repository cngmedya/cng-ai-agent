// backend-v2/src/core/db.js

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let db;

function runCoreMigrations(dbInstance) {
  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) return;

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    dbInstance
      .prepare(`SELECT id FROM schema_migrations`)
      .all()
      .map((r) => r.id),
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.+\.js$/.test(f))
    .sort();

  for (const file of files) {
    const fullPath = path.join(__dirname, 'migrations', file);

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mig = require(fullPath);

    const migId = mig && mig.id ? mig.id : file.replace(/\.js$/, '');
    if (applied.has(migId)) continue;

    if (!mig || typeof mig.up !== 'function') {
      throw new Error(`[core/db] invalid migration file: ${file}`);
    }

    mig.up(dbInstance);

    dbInstance
      .prepare(
        `INSERT INTO schema_migrations (id, applied_at) VALUES (@id, @applied_at)`,
      )
      .run({ id: migId, applied_at: new Date().toISOString() });
  }
}

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
 * - godmode_job_progress   → GODMODE job progress (JOIN için)
 * - godmode_job_results    → GODMODE job result snapshot (JOIN için)
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
      ai_notes TEXT,        -- kısa AI notu / etiketler
      provider TEXT,
      provider_id TEXT,
      raw_payload_json TEXT,
      first_seen_at TEXT,
      last_seen_at TEXT,
      scan_count INTEGER DEFAULT 1,
      updated_at TEXT,
      skip_enrichment INTEGER DEFAULT 0
    );
  `);

  // Godmode FAZ 2.B.6 — potential_leads dedup & freshness columns (idempotent)
  const leadCols = dbInstance
    .prepare(`PRAGMA table_info(potential_leads)`)
    .all()
    .map((c) => c.name);

  if (!leadCols.includes('provider')) {
    dbInstance.exec(`ALTER TABLE potential_leads ADD COLUMN provider TEXT;`);
  }
  if (!leadCols.includes('provider_id')) {
    dbInstance.exec(`ALTER TABLE potential_leads ADD COLUMN provider_id TEXT;`);
  }
  if (!leadCols.includes('raw_payload_json')) {
    dbInstance.exec(`ALTER TABLE potential_leads ADD COLUMN raw_payload_json TEXT;`);
  }
  if (!leadCols.includes('first_seen_at')) {
    dbInstance.exec(`ALTER TABLE potential_leads ADD COLUMN first_seen_at TEXT;`);
  }
  if (!leadCols.includes('last_seen_at')) {
    dbInstance.exec(`ALTER TABLE potential_leads ADD COLUMN last_seen_at TEXT;`);
  }
  if (!leadCols.includes('scan_count')) {
    dbInstance.exec(`ALTER TABLE potential_leads ADD COLUMN scan_count INTEGER DEFAULT 1;`);
  }
  if (!leadCols.includes('updated_at')) {
    dbInstance.exec(`ALTER TABLE potential_leads ADD COLUMN updated_at TEXT;`);
  }

  if (!leadCols.includes('skip_enrichment')) {
    dbInstance.exec(
      `ALTER TABLE potential_leads ADD COLUMN skip_enrichment INTEGER DEFAULT 0;`,
    );
  }

  dbInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_potential_leads_skip_enrichment
    ON potential_leads (skip_enrichment);
  `);

  dbInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_potential_leads_provider_provider_id
    ON potential_leads (provider, provider_id);
  `);

  // Backfill canonical dedup keys from legacy columns (safe to re-run)
  dbInstance.exec(`
    UPDATE potential_leads
    SET
      provider    = COALESCE(provider, source, 'google_places'),
      provider_id = COALESCE(provider_id, google_place_id)
    WHERE provider IS NULL
       OR provider_id IS NULL;
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
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS godmode_jobs (
      id TEXT PRIMARY KEY,            -- UUID
      type TEXT NOT NULL,             -- discovery_scan vb.
      label TEXT,
      criteria_json TEXT NOT NULL,    -- request.body kriterleri (JSON)
      status TEXT NOT NULL,
      progress_percent INTEGER DEFAULT 0,
      found_leads INTEGER DEFAULT 0,
      enriched_leads INTEGER DEFAULT 0,
      result_summary_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_godmode_jobs_status
      ON godmode_jobs (status);

    CREATE INDEX IF NOT EXISTS idx_godmode_jobs_created_at
      ON godmode_jobs (created_at);
  `);

  // GODMODE job progress (JOIN için) – yeni kurulumlarda doğru şema
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS godmode_job_progress (
      job_id TEXT PRIMARY KEY,
      percent INTEGER DEFAULT 0,
      found_leads INTEGER DEFAULT 0,
      enriched_leads INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_godmode_job_progress_job_id
      ON godmode_job_progress (job_id);
  `);

  // Eski şemadan gelen DB'ler için: percent kolonu yoksa ekle
  try {
    dbInstance.prepare('SELECT percent FROM godmode_job_progress LIMIT 1').get();
  } catch (e) {
    if (e && String(e.message).includes('no such column: percent')) {
      dbInstance.exec(
        "ALTER TABLE godmode_job_progress ADD COLUMN percent INTEGER DEFAULT 0"
      );
    }
  }

  // GODMODE job results (JOIN için, minimal şema)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS godmode_job_results (
      job_id TEXT PRIMARY KEY,
      result_summary_json TEXT,
      raw_results_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_godmode_job_results_job_id
      ON godmode_job_results (job_id);
  `);

  runCoreMigrations(dbInstance);
}

function getDb() {
  if (!db) {
    const dbPath = path.join(__dirname, '..', '..', 'data', 'app.sqlite');
    db = new Database(dbPath);
    initSchema(db);
  }
  return db;
}

module.exports = {
  getDb,
};
