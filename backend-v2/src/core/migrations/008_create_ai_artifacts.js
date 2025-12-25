/**
 * Migration: 008_create_ai_artifacts
 *
 * Purpose:
 * Persist read-only AI outputs (Auto-SWOT, Outreach Draft, etc.)
 * without polluting core lead tables.
 *
 * This table is append-only and used for observability,
 * review, and future UI/CRM consumption.
 */

module.exports = {
  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ai_artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT,
        lead_id INTEGER,
        provider TEXT,
        provider_id TEXT,
        artifact_type TEXT NOT NULL,
        artifact_json TEXT,
        created_at TEXT NOT NULL
      );
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_ai_artifacts_job
      ON ai_artifacts(job_id);
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_ai_artifacts_lead
      ON ai_artifacts(lead_id);
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_ai_artifacts_type
      ON ai_artifacts(artifact_type);
    `).run();
  },

  down(db) {
    db.prepare(`
      DROP TABLE IF EXISTS ai_artifacts;
    `).run();
  },
};
