// backend-v2/src/modules/outreach/repo.js
const { getDb } = require('../../core/db');

function getLeadById(id) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT *
    FROM potential_leads
    WHERE id = ?
  `);
  return stmt.get(id);
}

module.exports = {
  getLeadById
};