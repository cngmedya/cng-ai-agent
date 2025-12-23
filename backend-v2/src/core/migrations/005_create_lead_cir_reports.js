// backend-v2/src/core/migrations/005_create_lead_cir_reports.js

module.exports = function (db) {
  // Target schema (current writer expects raw_json; report_json optional)
  const ensureTargetTable = () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS lead_cir_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        provider TEXT,
        raw_json TEXT NOT NULL,
        report_json TEXT,
        priority_score INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_lead_cir_reports_lead_id_created_at
      ON lead_cir_reports (lead_id, created_at);
    `);
  };

  ensureTargetTable();

  const cirInfo = db.prepare(`PRAGMA table_info(lead_cir_reports)`).all();
  const cirCols = cirInfo.map((c) => c.name);

  // If an older draft created cir_json as NOT NULL, current inserts will fail.
  const cirJsonCol = cirInfo.find((c) => c.name === 'cir_json');
  const cirJsonNotNull = !!(cirJsonCol && Number(cirJsonCol.notnull) === 1);

  if (cirJsonNotNull) {
    // Rebuild table with the target schema and migrate existing rows.
    db.exec('BEGIN;');

    db.exec(`
      CREATE TABLE IF NOT EXISTS lead_cir_reports__new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        provider TEXT,
        raw_json TEXT NOT NULL,
        report_json TEXT,
        priority_score INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
      );
    `);

    db.exec(`
      INSERT INTO lead_cir_reports__new (id, lead_id, provider, raw_json, report_json, priority_score, created_at)
      SELECT
        id,
        lead_id,
        provider,
        COALESCE(raw_json, cir_json, report_json, '{}') AS raw_json,
        COALESCE(report_json, cir_json) AS report_json,
        priority_score,
        created_at
      FROM lead_cir_reports;
    `);

    db.exec(`DROP TABLE lead_cir_reports;`);
    db.exec(`ALTER TABLE lead_cir_reports__new RENAME TO lead_cir_reports;`);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_lead_cir_reports_lead_id_created_at
      ON lead_cir_reports (lead_id, created_at);
    `);

    db.exec('COMMIT;');
  } else {
    // Ensure expected columns exist for mixed schemas (idempotent).
    if (!cirCols.includes('raw_json')) {
      db.exec(`ALTER TABLE lead_cir_reports ADD COLUMN raw_json TEXT;`);
    }
    if (!cirCols.includes('report_json')) {
      db.exec(`ALTER TABLE lead_cir_reports ADD COLUMN report_json TEXT;`);
    }
  }

  // idempotent: potential_leads columns
  const leadCols = db
    .prepare(`PRAGMA table_info(potential_leads)`)
    .all()
    .map((c) => c.name);

  if (!leadCols.includes('last_cir_score')) {
    db.exec(`ALTER TABLE potential_leads ADD COLUMN last_cir_score INTEGER;`);
  }

  if (!leadCols.includes('last_cir_created_at')) {
    db.exec(`ALTER TABLE potential_leads ADD COLUMN last_cir_created_at TEXT;`);
  }

  // Godmode FAZ 2.B.6.2 — Freshness/Enrichment gating columns (idempotent)
  if (!leadCols.includes('updated_at')) {
    db.exec(`ALTER TABLE potential_leads ADD COLUMN updated_at TEXT;`);
  }

  if (!leadCols.includes('skip_enrichment')) {
    db.exec(`ALTER TABLE potential_leads ADD COLUMN skip_enrichment INTEGER DEFAULT 0;`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_potential_leads_skip_enrichment
    ON potential_leads (skip_enrichment);
  `);
};