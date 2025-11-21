// backend/src/services/whatsappMemoryService.js

const { getDb } = require("../db/db");
const { log } = require("../lib/logger");

const db = getDb();

// -------------------------------------------------------------
// TABLOLAR: 
//  - whatsapp_conversations: telefon başına conversation özeti
//  - whatsapp_chat_messages: AI için sadeleştirilmiş chat log'u
// -------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    wa_phone TEXT NOT NULL UNIQUE,
    lead_id INTEGER,
    last_message_at TEXT,
    last_direction TEXT,
    last_message_preview TEXT,
    total_messages INTEGER NOT NULL DEFAULT 0,
    meta_json TEXT
  );

  CREATE TABLE IF NOT EXISTS whatsapp_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    wa_phone TEXT NOT NULL,
    role TEXT NOT NULL,          -- user | assistant | system
    direction TEXT NOT NULL,     -- inbound | outbound | system
    text_body TEXT,
    meta_json TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_phone
    ON whatsapp_chat_messages (wa_phone, created_at);

  CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_phone
    ON whatsapp_conversations (wa_phone);
`);

function nowIso() {
  return new Date().toISOString();
}

// -------------------------------------------------------------
// Conversation tablosu (özet)
// -------------------------------------------------------------
function touchConversation({ phone, direction, text, leadId = null, meta = null }) {
  if (!phone) return;

  const preview = (text || "").slice(0, 160);

  const selectStmt = db.prepare(
    "SELECT * FROM whatsapp_conversations WHERE wa_phone = ? LIMIT 1"
  );
  const existing = selectStmt.get(phone);

  const now = nowIso();
  const metaJson = meta ? JSON.stringify(meta) : null;

  if (!existing) {
    const insertStmt = db.prepare(`
      INSERT INTO whatsapp_conversations (
        created_at, updated_at,
        wa_phone,
        lead_id,
        last_message_at,
        last_direction,
        last_message_preview,
        total_messages,
        meta_json
      ) VALUES (
        @created_at, @updated_at,
        @wa_phone,
        @lead_id,
        @last_message_at,
        @last_direction,
        @last_message_preview,
        @total_messages,
        @meta_json
      )
    `);

    insertStmt.run({
      created_at: now,
      updated_at: now,
      wa_phone: phone,
      lead_id: leadId,
      last_message_at: now,
      last_direction: direction,
      last_message_preview: preview,
      total_messages: 1,
      meta_json: metaJson,
    });

    log.info(`[WhatsAppMemory] Yeni conversation oluşturuldu: ${phone}`);
  } else {
    const updateStmt = db.prepare(`
      UPDATE whatsapp_conversations
      SET
        updated_at = @updated_at,
        last_message_at = @last_message_at,
        last_direction = @last_direction,
        last_message_preview = @last_message_preview,
        total_messages = total_messages + 1,
        lead_id = COALESCE(@lead_id, lead_id),
        meta_json = COALESCE(@meta_json, meta_json)
      WHERE wa_phone = @wa_phone
    `);

    updateStmt.run({
      updated_at: now,
      last_message_at: now,
      last_direction: direction,
      last_message_preview: preview,
      wa_phone: phone,
      lead_id: leadId,
      meta_json: metaJson,
    });
  }
}

// -------------------------------------------------------------
// Chat log tablosu
// -------------------------------------------------------------
function recordMessage({ phone, role, direction, text, leadId = null, meta = null }) {
  if (!phone) return;

  const insertStmt = db.prepare(`
    INSERT INTO whatsapp_chat_messages (
      created_at,
      wa_phone,
      role,
      direction,
      text_body,
      meta_json
    ) VALUES (
      @created_at,
      @wa_phone,
      @role,
      @direction,
      @text_body,
      @meta_json
    )
  `);

  insertStmt.run({
    created_at: nowIso(),
    wa_phone: phone,
    role,
    direction,
    text_body: text || "",
    meta_json: meta ? JSON.stringify(meta) : null,
  });

  touchConversation({
    phone,
    direction,
    text,
    leadId,
    meta,
  });
}

function recordInboundText({ phone, text, leadId = null, meta = null }) {
  recordMessage({
    phone,
    role: "user",
    direction: "inbound",
    text,
    leadId,
    meta,
  });
}

function recordOutboundText({ phone, text, leadId = null, meta = null }) {
  recordMessage({
    phone,
    role: "assistant",
    direction: "outbound",
    text,
    leadId,
    meta,
  });
}

function getRecentChatHistory(phone, limit = 20) {
  if (!phone) return [];

  const stmt = db.prepare(`
    SELECT
      id,
      created_at,
      wa_phone,
      role,
      direction,
      text_body,
      meta_json
    FROM whatsapp_chat_messages
    WHERE wa_phone = @phone
    ORDER BY datetime(created_at) DESC
    LIMIT @limit
  `);

  const rows = stmt.all({ phone, limit });
  // AI için kronolojik olsun
  return rows.reverse().map((row) => ({
    id: row.id,
    at: row.created_at,
    phone: row.wa_phone,
    role: row.role,
    direction: row.direction,
    text: row.text_body || "",
    meta: row.meta_json ? JSON.parse(row.meta_json) : null,
  }));
}

function buildHistoryMarkdown(phone, limit = 20) {
  const history = getRecentChatHistory(phone, limit);
  if (!history.length) return "_Daha önce kayıtlı bir konuşma yok._";

  const lines = history.map((m) => {
    const who =
      m.role === "assistant"
        ? "CNG Agent"
        : m.role === "system"
        ? "Sistem"
        : "Müşteri";
    return `- **${who}:** ${m.text || ""}`;
  });

  return lines.join("\n");
}

module.exports = {
  recordInboundText,
  recordOutboundText,
  getRecentChatHistory,
  buildHistoryMarkdown,
  touchConversation,
};