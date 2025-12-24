module.exports = {
    id: '007_create_lead_enrichments',
    up(db) {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS lead_enrichments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL,
          job_id TEXT,
          provider TEXT,
          provider_id TEXT,
          source TEXT,
          seo_json TEXT,
          social_json TEXT,
          tech_json TEXT,
          opportunity_json TEXT,
          created_at TEXT NOT NULL
        );
      `).run();
  
      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_lead_enrichments_lead_id_created_at
        ON lead_enrichments (lead_id, created_at DESC);
      `).run();
  
      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_lead_enrichments_job_id
        ON lead_enrichments (job_id);
      `).run();
  
      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_lead_enrichments_provider_provider_id
        ON lead_enrichments (provider, provider_id);
      `).run();
    },
    down(db) {
      db.prepare(`DROP TABLE IF EXISTS lead_enrichments;`).run();
    },
  };