// backend-v2/src/modules/whatsapp/repo.js
const { getDb } = require('../../core/db');

function logWhatsapp(payload = {}) {
  const db = getDb();

  try {
    // Tabloyu garanti et
    db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER,
        phone TEXT,
        message TEXT,
        meta_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const {
      leadId = null,
      phone = null,
      message = null,
      meta = {}
    } = payload;

    const stmt = db.prepare(`
      INSERT INTO whatsapp_logs (lead_id, phone, message, meta_json)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      leadId,
      phone,
      message,
      JSON.stringify(meta || {})
    );

    return {
      ok: true,
      id: result.lastInsertRowid
    };
  } catch (err) {
    console.error('[whatsapp_logs] insert failed:', err.message);

    return {
      ok: false,
      error: err.message
    };
  }
}

module.exports = {
  logWhatsapp
};