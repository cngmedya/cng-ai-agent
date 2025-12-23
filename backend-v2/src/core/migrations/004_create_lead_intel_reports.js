// backend-v2/src/core/migrations/004_create_lead_intel_reports.js

module.exports = function (db) {
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
};