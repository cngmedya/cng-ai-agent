// backend/src/db/db.js

const path = require("path");
const Database = require("better-sqlite3");
const { log } = require("../lib/logger");

const dbFile = path.join(__dirname, "..", "data", "crm.sqlite");

let db = null;

// -------------------------------------------
// WHATSAPP SCHEMA INITIALIZER
// -------------------------------------------
function initWhatsAppSchema(dbInstance) {
  // whatsapp_messages (v2)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      direction TEXT NOT NULL,          -- inbound | outbound | system
      wa_message_id TEXT,
      wa_phone_number_id TEXT,
      from_number TEXT,
      to_number TEXT,
      type TEXT,                        -- text | image | template | system
      text_body TEXT,
      payload_json TEXT,
      status TEXT,                      -- sent | received | error | delivered | read | dev_skipped
      error_json TEXT,
      lead_id INTEGER,
      campaign_id INTEGER,
      action_id INTEGER,
      raw_json TEXT,
      FOREIGN KEY (lead_id) REFERENCES leads(id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at
      ON whatsapp_messages (created_at);

    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_from
      ON whatsapp_messages (from_number);

    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_to
      ON whatsapp_messages (to_number);

    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead
      ON whatsapp_messages (lead_id);

    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_campaign
      ON whatsapp_messages (campaign_id);
  `);

  log.info("[DB] whatsapp_messages v2 şeması ve indexler hazır.");

  // whatsapp_conversations
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      wa_phone TEXT NOT NULL,
      lead_id INTEGER,
      last_message_at TEXT,
      last_direction TEXT,
      last_summary TEXT,
      meta_json TEXT,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone
      ON whatsapp_conversations (wa_phone);

    CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_lead
      ON whatsapp_conversations (lead_id);
  `);

  // whatsapp_memories
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      wa_phone TEXT NOT NULL,
      lead_id INTEGER,
      memory_type TEXT,
      memory_text TEXT NOT NULL,
      weight INTEGER DEFAULT 1,
      meta_json TEXT,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_whatsapp_memories_phone
      ON whatsapp_memories (wa_phone);

    CREATE INDEX IF NOT EXISTS idx_whatsapp_memories_lead
      ON whatsapp_memories (lead_id);
  `);

  log.info("[DB] WhatsApp conversation + memory tabloları hazır.");
}

// -------------------------------------------
// MAIN DB INIT
// -------------------------------------------
function getDb() {
  if (!db) {
    db = new Database(dbFile);

    try {
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      db.pragma("busy_timeout = 5000");
    } catch (err) {
      log.warn("[DB] PRAGMA ayarları uygulanırken hata:", err.message);
    }

    // WhatsApp tabloları
    initWhatsAppSchema(db);

    log.info("[DB] Shared sqlite instance hazır: " + dbFile);
  }

  return db;
}

// Eski isimle de erişim sağla
function getCrmDb() {
  return getDb();
}

module.exports = {
  getDb,
  getCrmDb,
};