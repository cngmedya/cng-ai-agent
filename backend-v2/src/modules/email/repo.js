// backend-v2/src/modules/email/repo.js
const { getDb } = require('../../core/db');

function logEmail(payload = {}) {
  const db = getDb();

  try {
    // Tabloyu garanti et
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER,
        to_address TEXT,
        subject TEXT,
        body TEXT,
        meta_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const {
      leadId = null,
      to = null,
      subject = null,
      body = null,
      meta = {}
    } = payload;

    const stmt = db.prepare(`
      INSERT INTO email_logs (lead_id, to_address, subject, body, meta_json)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      leadId,
      to,
      subject,
      body,
      JSON.stringify(meta || {})
    );

    return {
      ok: true,
      id: result.lastInsertRowid
    };
  } catch (err) {
    console.error('[email_logs] insert failed:', err.message);

    // Repo hiçbir zaman API’yi düşürmesin
    return {
      ok: false,
      error: err.message
    };
  }
}

module.exports = {
  logEmail
};