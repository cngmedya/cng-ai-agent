// backend/src/modules/lead-acquisition/db/leadAcquisitionSchema.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

/**
 * Lead Acquisition + Intel + Reputation için gerekli tabloların init'i
 *
 * Burada şunları yaratıyoruz / güncelliyoruz:
 *  - lead_sources
 *  - potential_leads
 *  - website_intel
 *  - lead_search_intel
 *  - lead_reputation_insights
 */
async function initLeadAcquisitionSchema() {
  const db = await getCrmDb();

  // 1) Ana tabloları oluştur
  const schemaSql = `
    -- 1) Lead kaynakları (Google Places vs.)
    CREATE TABLE IF NOT EXISTS lead_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      source_type TEXT NOT NULL,
      raw_payload_json TEXT,
      created_at TEXT NOT NULL
    );

    -- 2) Potansiyel lead'ler
    CREATE TABLE IF NOT EXISTS potential_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      category TEXT,
      website TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      source TEXT,               -- google_places / manual / import vs.
      status TEXT,               -- found / qualified / contacted / closed vs.
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_potential_leads_company_city
      ON potential_leads (company_name, city);

    -- 3) Website intel (tekil site taraması sonuçları)
    -- Not: Bu tablo daha önce oluşturulmuş olabilir; CREATE TABLE IF NOT EXISTS
    -- mevcut tabloyu değiştirmez, sadece yoksa yaratır.
    CREATE TABLE IF NOT EXISTS website_intel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      url TEXT NOT NULL,
      http_status INTEGER,
      title TEXT,
      description TEXT,
      meta_json TEXT,          -- extra meta / teknik detaylar
      last_checked_at TEXT,
      error_message TEXT,
      FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_website_intel_url
      ON website_intel (url);

    -- 4) Google Search / SERP ham verisi
    CREATE TABLE IF NOT EXISTS lead_search_intel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      query TEXT NOT NULL,
      engine TEXT NOT NULL,             -- google, custom_search, serpapi, mock
      results_json TEXT,                -- normalize edilmiş top sonuçlar
      mentions_count INTEGER DEFAULT 0,
      complaints_count INTEGER DEFAULT 0,
      last_checked_at TEXT,
      status TEXT,                      -- ok / no_results / error
      error_message TEXT,
      FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_search_intel_lead
      ON lead_search_intel (lead_id);

    -- 5) AI Reputation / marka itibarı özetleri
    CREATE TABLE IF NOT EXISTS lead_reputation_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      search_intel_id INTEGER,          -- opsiyonel: hangi search run'ından geldi
      reputation_score INTEGER,         -- 0–100
      risk_level TEXT,                  -- low / medium / high
      positive_ratio REAL,              -- 0–1
      negative_ratio REAL,              -- 0–1
      summary_markdown TEXT,            -- insan okunur özet (pitch hazırlarken kullanacağız)
      key_opportunities_json TEXT,      -- ["SEO", "Şikayet yönetimi", ...]
      suggested_actions_json TEXT,      -- ["Google My Business optimize", ...]
      last_updated_at TEXT,
      FOREIGN KEY (lead_id) REFERENCES potential_leads(id),
      FOREIGN KEY (search_intel_id) REFERENCES lead_search_intel(id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_reputation_insights_lead
      ON lead_reputation_insights (lead_id);
  `;

  db.exec(schemaSql);

  // 2) MIGRATION PATCH: Eski tabloları yeni kolonlara uyumlu hale getir
  // (ALTER TABLE ile ekliyoruz; varsa hata verir, try/catch ile yutuyoruz)

  // website_intel için kolonlar
  try {
    db.exec(`ALTER TABLE website_intel ADD COLUMN lead_id INTEGER;`);
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE website_intel ADD COLUMN meta_json TEXT;`);
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE website_intel ADD COLUMN last_checked_at TEXT;`);
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE website_intel ADD COLUMN error_message TEXT;`);
  } catch (_) {}

  // lead_search_intel için hata kolonu
  try {
    db.exec(`ALTER TABLE lead_search_intel ADD COLUMN error_message TEXT;`);
  } catch (_) {}

  // reputation için suggested_actions_json kolonu (eski DB'lerde olmayabilir)
  try {
    db.exec(
      `ALTER TABLE lead_reputation_insights ADD COLUMN suggested_actions_json TEXT;`
    );
  } catch (_) {}

  // 3) lead_id kolonu artık garanti olduğu için index'i ayrı yaratalım
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_website_intel_lead
      ON website_intel (lead_id);
    `);
  } catch (_) {}

  log.info(
    "[LeadAcq] lead_sources, potential_leads, website_intel, lead_search_intel, lead_reputation_insights tabloları hazır."
  );
}

module.exports = {
  initLeadAcquisitionSchema,
};