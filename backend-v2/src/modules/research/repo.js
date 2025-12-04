// backend-v2/src/modules/research/repo.js

const { getDb } = require('../../core/db');

function saveReport({ leadId, cirJson, overallScore }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO lead_intel_reports (lead_id, cir_json, overall_score)
    VALUES (?, ?, ?)
  `);
  return stmt.run(leadId, cirJson, overallScore);
}

function getLatestReport(leadId) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT *
    FROM lead_intel_reports
    WHERE lead_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return stmt.get(leadId);
}

function getReportsByLead(leadId) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT *
    FROM lead_intel_reports
    WHERE lead_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(leadId);
}

module.exports = {
  saveReport,
  getLatestReport,
  getReportsByLead
};