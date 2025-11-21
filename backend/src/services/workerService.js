// backend/src/services/whatsappService.js

const { log } = require("../lib/logger");
const { getDb } = require("../db/db");
// veya istersen direkt CRM ismine göre:
// const { getCrmDb: getDb } = require("../db/db");


// -------------------------------------------------------------
// ENV & MODLAR
// -------------------------------------------------------------

const META_WHATSAPP_ACCESS_TOKEN =
  process.env.META_WHATSAPP_ACCESS_TOKEN || "";
const META_WHATSAPP_PHONE_NUMBER_ID =
  process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
const META_WHATSAPP_VERIFY_TOKEN =
  process.env.META_WHATSAPP_VERIFY_TOKEN || "";
const WHATSAPP_DEV_MODE =
  process.env.WHATSAPP_DEV_MODE === "true" ||
  !META_WHATSAPP_ACCESS_TOKEN ||
  !META_WHATSAPP_PHONE_NUMBER_ID;

// -------------------------------------------------------------
// DB & TABLOLAR
// -------------------------------------------------------------

const db = getDb();

/**
 * whatsapp_messages tablosu zaten db.js içinde v2 şema ile
 * oluşturuluyor. Burada sadece memory için extra tablo açıyoruz.
 *
 * whatsapp_conversations:
 *  - telefon numarası bazlı son konuşma durumu
 *  - hızlı özet / preview tutmak için
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_phone TEXT NOT NULL UNIQUE,
    lead_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_message_at TEXT,
    last_direction TEXT,       -- inbound | outbound | system
    last_text_preview TEXT,    -- son mesajın kısa hali
    memory_json TEXT,          -- ileride AI özetlerini saklamak için
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  );

  CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone
    ON whatsapp_conversations (wa_phone);
`);

function nowIso() {
  return new Date().toISOString();
}

// -------------------------------------------------------------
// CONVERSATION MEMORY HELPER'LARI
// -------------------------------------------------------------

/**
 * Belirli bir telefon numarası için son konuşma durumunu günceller.
 *  - inbound/outbound mesaj geldiğinde çağırıyoruz.
 */
function upsertConversation({ waPhone, direction, text, leadId = null }) {
  if (!waPhone) return;

  const now = nowIso();
  const preview = text ? String(text).slice(0, 200) : null;

  try {
    const update = db.prepare(`
      UPDATE whatsapp_conversations
      SET
        updated_at       = @now,
        last_message_at  = @now,
        last_direction   = @direction,
        last_text_preview = @preview,
        lead_id          = COALESCE(lead_id, @lead_id)
      WHERE wa_phone = @wa_phone
    `);

    const result = update.run({
      now,
      direction,
      preview,
      wa_phone: waPhone,
      lead_id: leadId,
    });

    if (result.changes === 0) {
      const insert = db.prepare(`
        INSERT INTO whatsapp_conversations (
          wa_phone,
          lead_id,
          created_at,
          updated_at,
          last_message_at,
          last_direction,
          last_text_preview,
          memory_json
        ) VALUES (
          @wa_phone,
          @lead_id,
          @now,
          @now,
          @now,
          @direction,
          @preview,
          NULL
        )
      `);

      insert.run({
        wa_phone: waPhone,
        lead_id: leadId,
        now,
        direction,
        preview,
      });
    }
  } catch (err) {
    log.warn("[WhatsApp] upsertConversation hata:", err.message);
  }
}

/**
 * Belirli bir numara için son N mesajı getirir.
 *  - whatsapp_messages tablosundan okuyor (db.js zaten yaratıyor).
 *  - AI Chat Memory için context olacak.
 */
function getRecentMessagesForPhone(waPhone, limit = 15) {
  if (!waPhone) return [];

  try {
    const stmt = db.prepare(`
      SELECT
        created_at,
        direction,
        wa_phone,
        message_type AS type,
        content
      FROM whatsapp_messages
      WHERE wa_phone = @wa_phone
      ORDER BY datetime(created_at) DESC
      LIMIT @limit
    `);

    const rows = stmt.all({
      wa_phone: waPhone,
      limit,
    });

    // AI'ye verirken eskiden yeniye doğru gitmek daha mantıklı
    return rows.reverse();
  } catch (err) {
    log.warn("[WhatsApp] getRecentMessagesForPhone hata:", err.message);
    return [];
  }
}

/**
 * Inbound mesajları loglamak için helper (controller içinden kullanılabilir).
 * Burada sadece whatsapp_messages'a basic insert yapıyoruz ve memory'yi güncelliyoruz.
 */
function logInboundMessage({
  waPhone,
  text,
  messageType = "text",
  status = "received",
  leadId = null,
  campaignId = null,
  rawJson = null,
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO whatsapp_messages (
        created_at,
        direction,
        wa_phone,
        message_type,
        content,
        raw_json,
        status,
        error,
        lead_id,
        campaign_id,
        channel
      ) VALUES (
        @created_at,
        'inbound',
        @wa_phone,
        @message_type,
        @content,
        @raw_json,
        @status,
        NULL,
        @lead_id,
        @campaign_id,
        'whatsapp'
      )
    `);

    stmt.run({
      created_at: nowIso(),
      wa_phone: waPhone,
      message_type: messageType,
      content: text || null,
      raw_json: rawJson ? JSON.stringify(rawJson) : null,
      status,
      lead_id: leadId,
      campaign_id: campaignId,
    });

    // Konuşma memory güncelle
    upsertConversation({
      waPhone,
      direction: "inbound",
      text,
      leadId,
    });

    log.info(
      `[WhatsApp] Inbound mesaj loglandı (phone: ${waPhone}, type: ${messageType})`
    );
  } catch (err) {
    log.error("[WhatsApp] logInboundMessage hata:", err.message);
  }
}

/**
 * Outbound (bizim gönderdiğimiz) mesajlar için log helper.
 */
function logOutboundMessage({
  waPhone,
  text,
  messageType = "text",
  status = "sent",
  error = null,
  leadId = null,
  campaignId = null,
  rawJson = null,
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO whatsapp_messages (
        created_at,
        direction,
        wa_phone,
        message_type,
        content,
        raw_json,
        status,
        error,
        lead_id,
        campaign_id,
        channel
      ) VALUES (
        @created_at,
        'outbound',
        @wa_phone,
        @message_type,
        @content,
        @raw_json,
        @status,
        @error,
        @lead_id,
        @campaign_id,
        'whatsapp'
      )
    `);

    stmt.run({
      created_at: nowIso(),
      wa_phone: waPhone,
      message_type: messageType,
      content: text || null,
      raw_json: rawJson ? JSON.stringify(rawJson) : null,
      status,
      error: error ? JSON.stringify(error) : null,
      lead_id: leadId,
      campaign_id: campaignId,
    });

    // Konuşma memory güncelle
    upsertConversation({
      waPhone,
      direction: "outbound",
      text,
      leadId,
    });

    log.info(
      `[WhatsApp] Outbound mesaj loglandı (phone: ${waPhone}, status: ${status})`
    );
  } catch (err) {
    log.error("[WhatsApp] logOutboundMessage hata:", err.message);
  }
}

// -------------------------------------------------------------
// Basit Worker Çalıştırma (runWorkerOnce)
// Şimdilik "dummy" (iskelet) fonksiyon – sadece log atar.
// Daha sonra kampanya aksiyonlarını işleyen gerçek mantığı
// buraya ekleyebiliriz.
// -------------------------------------------------------------
async function runWorkerOnce(options = {}) {
  try {
    // Buraya ileride:
    // - pending campaign actions çek
    // - AI ile plan üret
    // - status = completed yap
    // gibi mantıkları ekleyeceğiz.

    const startedAt = new Date().toISOString();
    const context = options.context || "manual";

    log.info(
      `[Worker] runWorkerOnce çağrıldı (context=${context}, startedAt=${startedAt})`
    );

    // Şimdilik sadece boş bir sonuç döndürüyoruz
    return {
      ok: true,
      context,
      startedAt,
      processed: 0,
      note: "runWorkerOnce şu an skeleton modda. İş mantığı henüz eklenmedi.",
    };
  } catch (err) {
    log.error("[Worker] runWorkerOnce hata:", err.message);
    return {
      ok: false,
      error: err.message,
    };
  }
}
// -------------------------------------------------------------
// WEBHOOK VERIFY (GET ?hub.mode=subscribe vs.)
// -------------------------------------------------------------

function verifyWebhookQuery({ mode, token, challenge }) {
  if (mode === "subscribe" && token === META_WHATSAPP_VERIFY_TOKEN) {
    log.info("[WhatsApp] Webhook doğrulandı.");
    return { ok: true, challenge };
  }

  log.warn(
    "[WhatsApp] Webhook doğrulama başarısız:",
    mode,
    token,
    META_WHATSAPP_VERIFY_TOKEN
  );

  return { ok: false };
}

// İleride X-Hub-Signature-256 doğrulamak istersek doldururuz.
function verifyWebhookSignature({ body, signatureHeader }) {
  return true;
}

// -------------------------------------------------------------
// MESAJ GÖNDERME (TEXT)
// -------------------------------------------------------------

/**
 * WhatsApp üzerinden basit text mesaj gönderir.
 *
 * Signature:
 *   sendTextMessage({ to, text })
 *   sendTextMessage({ to, message })
 *
 * Controller/test endpoint bunu kullanıyor.
 */
async function sendTextMessage(params) {
  const to = params?.to;
  const bodyText = params?.text || params?.message;

  if (!to || !bodyText) {
    throw new Error("sendTextMessage için 'to' ve 'text'/'message' zorunlu.");
  }

  const waPhone = String(to);
  const text = String(bodyText);

  // DEV veya ENV eksikse: Sadece log + DB log, gerçek API çağrısı yok
  if (WHATSAPP_DEV_MODE) {
    log.warn(
      "[WhatsApp] DEV MODE aktif veya env eksik – gerçek API çağrısı yapılmıyor.",
      {
        phone: waPhone,
        preview: text.slice(0, 80),
      }
    );

    // Outbound log + memory update
    logOutboundMessage({
      waPhone,
      text,
      messageType: "text",
      status: "dev_skipped",
      leadId: params.leadId || null,
      campaignId: params.campaignId || null,
    });

    return {
      ok: true,
      dev: true,
      message: "DEV mode: gerçek Meta API çağrısı yapılmadı.",
    };
  }

  const url = `https://graph.facebook.com/v20.0/${META_WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: waPhone,
    type: "text",
    text: {
      preview_url: false,
      body: text,
    },
  };

  log.info("[WhatsApp] Mesaj gönderiliyor:", {
    to: waPhone,
    preview: text.slice(0, 80),
  });

  let responseData = null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    responseData = await res.json();

    if (!res.ok) {
      throw new Error(
        `Meta API error: ${res.status} ${JSON.stringify(responseData)}`
      );
    }

    log.info("[WhatsApp] Mesaj gönderildi:", responseData);

    // Başarılı outbound log
    logOutboundMessage({
      waPhone,
      text,
      messageType: "text",
      status: "sent",
      leadId: params.leadId || null,
      campaignId: params.campaignId || null,
      rawJson: responseData,
    });

    return { ok: true, data: responseData };
  } catch (err) {
    log.error(
      "[WhatsApp] Mesaj gönderim hatası:",
      err?.response?.data || err.message
    );

    // Hatalı outbound log
    logOutboundMessage({
      waPhone,
      text,
      messageType: "text",
      status: "error",
      error: err?.response?.data || { message: err.message },
      leadId: params.leadId || null,
      campaignId: params.campaignId || null,
      rawJson: responseData,
    });

    return {
      ok: false,
      error: "WHATSAPP_SEND_FAILED",
      detail: err.message,
    };
  }
}

// -------------------------------------------------------------
// EXPORTS
// -------------------------------------------------------------

module.exports = {
  // Webhook doğrulama
  verifyWebhookQuery,
  verifyWebhookSignature,

  // Gönderim
  sendTextMessage,

  // Memory & log helper'lar
  logInboundMessage,
  logOutboundMessage,
  getRecentMessagesForPhone,
  upsertConversation,

  // 🧠 Worker entegrasyonu
  runWorkerOnce,
  
};