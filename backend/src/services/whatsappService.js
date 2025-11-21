// backend/src/services/whatsappService.js

const axios = require("axios");
const { log } = require("../lib/logger");
const { getCrmDb } = require("../db/db");

// Opsiyonel: R2 servisimiz (varsa)
let r2Service = null;
try {
  r2Service = require("./r2Service");
} catch (e) {
  r2Service = null;
}

// -------------------------------------------------------------
// ENV CONFIG
// -------------------------------------------------------------

const META_WHATSAPP_ACCESS_TOKEN =
  process.env.META_WHATSAPP_ACCESS_TOKEN ||
  process.env.WHATSAPP_TOKEN ||
  "";

const META_WHATSAPP_PHONE_NUMBER_ID =
  process.env.META_WHATSAPP_PHONE_NUMBER_ID ||
  process.env.WHATSAPP_PHONE_NUMBER_ID ||
  "";

const META_WHATSAPP_VERIFY_TOKEN =
  process.env.META_WHATSAPP_VERIFY_TOKEN || "";

const WHATSAPP_DEV_MODE =
  process.env.WHATSAPP_DEV_MODE === "true" ||
  !META_WHATSAPP_ACCESS_TOKEN ||
  !META_WHATSAPP_PHONE_NUMBER_ID;

// -------------------------------------------------------------
// DB - LAZY LOAD
// -------------------------------------------------------------
function db() {
  return getCrmDb(); // tablo oluşumu her zaman hazır olur
}

function nowIso() {
  return new Date().toISOString();
}

// -------------------------------------------------------------
// WHATSAPP MESSAGE LOGGING
// -------------------------------------------------------------

function logInboundMessage({
  waMessageId = null,
  waPhoneNumberId = null,
  from,
  to,
  type = "text",
  textBody = null,
  payload = null,
  status = "received",
  error = null,
  leadId = null,
  campaignId = null,
  actionId = null,
  raw = null,
}) {
  try {
    const stmt = db().prepare(`
      INSERT INTO whatsapp_messages (
        created_at,
        direction,
        wa_message_id,
        wa_phone_number_id,
        from_number,
        to_number,
        type,
        text_body,
        payload_json,
        status,
        error_json,
        lead_id,
        campaign_id,
        action_id,
        raw_json
      )
      VALUES (
        @created_at,
        @direction,
        @wa_message_id,
        @wa_phone_number_id,
        @from_number,
        @to_number,
        @type,
        @text_body,
        @payload_json,
        @status,
        @error_json,
        @lead_id,
        @campaign_id,
        @action_id,
        @raw_json
      )
    `);

    const info = stmt.run({
      created_at: nowIso(),
      direction: "inbound",
      wa_message_id: waMessageId,
      wa_phone_number_id: waPhoneNumberId,
      from_number: from || null,
      to_number: to || null,
      type,
      text_body: textBody || null,
      payload_json: payload ? JSON.stringify(payload) : null,
      status,
      error_json: error ? JSON.stringify(error) : null,
      lead_id: leadId,
      campaign_id: campaignId,
      action_id: actionId,
      raw_json: raw ? JSON.stringify(raw) : null,
    });

    log.info(
      `[WhatsApp] Inbound message logged #${info.lastInsertRowid} (${from} -> ${to}, type: ${type})`
    );
  } catch (err) {
    log.error("[WhatsApp] Inbound log hata:", err.message);
  }
}

function logOutboundMessage({
  waMessageId = null,
  waPhoneNumberId = null,
  from = null,
  to,
  type = "text",
  textBody = null,
  payload = null,
  status = "sent",
  error = null,
  leadId = null,
  campaignId = null,
  actionId = null,
  raw = null,
}) {
  try {
    const stmt = db().prepare(`
      INSERT INTO whatsapp_messages (
        created_at,
        direction,
        wa_message_id,
        wa_phone_number_id,
        from_number,
        to_number,
        type,
        text_body,
        payload_json,
        status,
        error_json,
        lead_id,
        campaign_id,
        action_id,
        raw_json
      )
      VALUES (
        @created_at,
        @direction,
        @wa_message_id,
        @wa_phone_number_id,
        @from_number,
        @to_number,
        @type,
        @text_body,
        @payload_json,
        @status,
        @error_json,
        @lead_id,
        @campaign_id,
        @action_id,
        @raw_json
      )
    `);

    stmt.run({
      created_at: nowIso(),
      direction: "outbound",
      wa_message_id: waMessageId,
      wa_phone_number_id: waPhoneNumberId,
      from_number: from || null,
      to_number: to || null,
      type,
      text_body: textBody || null,
      payload_json: payload ? JSON.stringify(payload) : null,
      status,
      error_json: error ? JSON.stringify(error) : null,
      lead_id: leadId,
      campaign_id: campaignId,
      action_id: actionId,
      raw_json: raw ? JSON.stringify(raw) : null,
    });

    log.info(
      `[WhatsApp] Outbound message logged (${from || "me"} -> ${to}, status: ${status})`
    );
  } catch (err) {
    log.error("[WhatsApp] Outbound log hata:", err.message);
  }
}

function attachAiSummary(messageId, aiSummary) {
  if (!messageId || !aiSummary) return;

  try {
    const row = db()
      .prepare(
        "SELECT payload_json FROM whatsapp_messages WHERE id = ? LIMIT 1"
      )
      .get(messageId);

    let payload = {};
    if (row?.payload_json) {
      try {
        payload = JSON.parse(row.payload_json);
      } catch {
        payload = {};
      }
    }

    payload.ai_summary = aiSummary;

    db()
      .prepare(
        "UPDATE whatsapp_messages SET payload_json = @json WHERE id = @id"
      )
      .run({
        id: messageId,
        json: JSON.stringify(payload),
      });

    log.info(`[WhatsApp] AI summary attached (#${messageId})`);
  } catch (err) {
    log.error("[WhatsApp] attachAiSummary hata:", err.message);
  }
}

// -------------------------------------------------------------
// CHAT MEMORY — FINAL (whatsapp_memories)
// -------------------------------------------------------------

function ensureConversationForPhone(wa_phone) {
  if (!wa_phone) return null;

  let conv = db()
    .prepare(
      "SELECT * FROM whatsapp_conversations WHERE wa_phone = ? LIMIT 1"
    )
    .get(wa_phone);

  const now = nowIso();

  if (!conv) {
    const info = db()
      .prepare(`
        INSERT INTO whatsapp_conversations (
          wa_phone, lead_id, last_message_at, created_at, updated_at
        ) VALUES (
          @wa_phone, @lead_id, @ts, @ts, @ts
        )
      `)
      .run({
        wa_phone,
        lead_id: null,
        ts: now,
      });

    conv = db()
      .prepare("SELECT * FROM whatsapp_conversations WHERE id = ?")
      .get(info.lastInsertRowid);

    log.info(`[WhatsApp] Yeni conversation oluşturuldu #${info.lastInsertRowid}`);
  } else {
    db()
      .prepare(
        "UPDATE whatsapp_conversations SET last_message_at=@ts, updated_at=@ts WHERE wa_phone=@wa_phone"
      )
      .run({ ts: now, wa_phone });
  }

  return conv;
}

async function saveUserMessageToMemory({ wa_phone, text }) {
  if (!wa_phone || !text) return;

  ensureConversationForPhone(wa_phone);

  db()
    .prepare(`
      INSERT INTO whatsapp_memories (
        wa_phone, memory_type, memory_text, weight, meta_json, created_at
      ) VALUES (
        @wa_phone, 'user', @text, 1, '{}', @ts
      )
    `)
    .run({
      wa_phone,
      text,
      ts: nowIso(),
    });

  log.info(`[WhatsApp] Memory user: ${wa_phone}`);
}

async function saveAssistantMessageToMemory({ wa_phone, text }) {
  if (!wa_phone || !text) return;

  ensureConversationForPhone(wa_phone);

  db()
    .prepare(`
      INSERT INTO whatsapp_memories (
        wa_phone, memory_type, memory_text, weight, meta_json, created_at
      ) VALUES (
        @wa_phone, 'assistant', @text, 1, '{}', @ts
      )
    `)
    .run({
      wa_phone,
      text,
      ts: nowIso(),
    });

  log.info(`[WhatsApp] Memory assistant: ${wa_phone}`);
}

async function getMemoryForPhone(wa_phone, limit = 30) {
  if (!wa_phone) return [];

  return (
    db()
      .prepare(
        `
        SELECT memory_type AS role,
               memory_text AS message,
               created_at
        FROM whatsapp_memories
        WHERE wa_phone = ?
        ORDER BY created_at ASC
        LIMIT ?
      `
      )
      .all(wa_phone, limit) || []
  );
}

// -------------------------------------------------------------
// MEDIA → R2
// -------------------------------------------------------------

async function downloadMediaFromWhatsApp(mediaId) {
  if (!mediaId) throw new Error("mediaId zorunlu");

  if (!META_WHATSAPP_ACCESS_TOKEN) {
    throw new Error("WhatsApp access token eksik");
  }

  const meta = await axios.get(
    `https://graph.facebook.com/v20.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${META_WHATSAPP_ACCESS_TOKEN}`,
      },
    }
  );

  const url = meta.data?.url;
  if (!url) throw new Error("Media url alınamadı");

  const bin = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      Authorization: `Bearer ${META_WHATSAPP_ACCESS_TOKEN}`,
    },
  });

  return Buffer.from(bin.data);
}

async function uploadBufferToR2(buffer, { contentType, extension }) {
  if (r2Service?.uploadBufferToR2) {
    return r2Service.uploadBufferToR2(buffer, { contentType, extension });
  }

  log.warn("[R2] uploadBufferToR2 stub");
  return null;
}

function getR2PublicUrl(keyOrPath) {
  if (r2Service?.getR2PublicUrl) {
    return r2Service.getR2PublicUrl(keyOrPath);
  }
  return null;
}

// -------------------------------------------------------------
// WEBHOOK VERIFY
// -------------------------------------------------------------

function verifyWebhookQuery({ mode, token, challenge }) {
  if (mode === "subscribe" && token === META_WHATSAPP_VERIFY_TOKEN) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

function verifyWebhookSignature() {
  return true;
}

// -------------------------------------------------------------
// SEND TEXT MESSAGE
// -------------------------------------------------------------

async function sendTextMessage(phone, text, options = {}) {
  if (WHATSAPP_DEV_MODE) {
    log.warn("[WhatsApp] DEV MODE → mesaj gönderilmeyecek", {
      phone,
      preview: text.slice(0, 120),
    });

    logOutboundMessage({
      from: "me",
      to: phone,
      type: "text",
      textBody: text,
      status: "dev_skipped",
      payload: { dev: true },
      leadId: options?.leadId || null,
      campaignId: options?.campaignId || null,
      actionId: options?.actionId || null,
    });

    return { ok: true, dev: true };
  }

  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: text },
  };

  try {
    const resp = await axios.post(
      `https://graph.facebook.com/v20.0/${META_WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${META_WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const waMessageId = resp.data?.messages?.[0]?.id;

    logOutboundMessage({
      waMessageId,
      waPhoneNumberId: META_WHATSAPP_PHONE_NUMBER_ID,
      from: "me",
      to: phone,
      type: "text",
      textBody: text,
      payload,
      status: "sent",
      raw: resp.data,
      leadId: options?.leadId || null,
      campaignId: options?.campaignId || null,
      actionId: options?.actionId || null,
    });

    return resp.data;
  } catch (err) {
    const errorData = err.response?.data || { message: err.message };
    log.error("[WhatsApp] sendTextMessage hata:", errorData);

    logOutboundMessage({
      from: "me",
      to: phone,
      type: "text",
      textBody: text,
      payload,
      status: "error",
      error: errorData,
      leadId: options?.leadId || null,
      campaignId: options?.campaignId || null,
      actionId: options?.actionId || null,
    });

    throw err;
  }
}

// -------------------------------------------------------------
// EXPORTS
// -------------------------------------------------------------

module.exports = {
  WHATSAPP_DEV_MODE,
  META_WHATSAPP_PHONE_NUMBER_ID,
  META_WHATSAPP_ACCESS_TOKEN,

  sendTextMessage,
  verifyWebhookQuery,
  verifyWebhookSignature,

  logInboundMessage,
  logOutboundMessage,
  attachAiSummary,

  saveUserMessageToMemory,
  saveAssistantMessageToMemory,
  getMemoryForPhone,

  downloadMediaFromWhatsApp,
  uploadBufferToR2,
  getR2PublicUrl,
};