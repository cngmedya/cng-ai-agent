// backend/src/modules/lead-acquisition/db/leadAcquisitionSchema.js

const { log } = require("../../../lib/logger");
const { getCrmDb } = require("../../../db/db");

async function initLeadAcquisitionSchema() {
  const db = await getCrmDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lead_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT,
      source_type TEXT,
      raw_payload_json TEXT,
      created_at TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS potential_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT,
      category TEXT,
      website TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      source TEXT,
      status TEXT, -- found, enriched, qualified, analyzed, contacted, offer_sent, closed
      created_at TEXT,
      updated_at TEXT
    );
  `);

  log("INFO", "[LeadAcq] lead_sources ve potential_leads tabloları hazır.");
}

module.exports = {
  initLeadAcquisitionSchema,
};