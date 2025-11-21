// backend/src/services/memoryService.js

const { getCrmDb } = require("../db/db");
const { log } = require("../lib/logger");
const { callAgent } = require("./aiService");

const db = getCrmDb();

// ----------------------------------------------------------
// Helper
// ----------------------------------------------------------
function now() {
  return new Date().toISOString();
}

// ----------------------------------------------------------
// Memory kaydı oluştur (ilk kez konuşan numara)
// ----------------------------------------------------------
function createMemoryRecord(phone, leadId = null) {
  db.prepare(`
    INSERT INTO whatsapp_memory (
      created_at, updated_at,
      wa_phone, lead_id,
      memory_summary, conversation_json, ai_tags
    ) VALUES (
      @created_at, @updated_at,
      @wa_phone, @lead_id,
      @summary, @conv, @tags
    )
  `).run({
    created_at: now(),
    updated_at: now(),
    wa_phone: phone,
    lead_id: leadId || null,
    summary: "",
    conv: "[]",
    tags: "{}"
  });

  log.info(`[Memory] Yeni memory kaydı oluşturuldu: ${phone}`);
}

// ----------------------------------------------------------
// Memory kaydı getir
// ----------------------------------------------------------
function getMemory(phone) {
  const row = db.prepare(`
    SELECT * FROM whatsapp_memory WHERE wa_phone = ?
  `).get(phone);
  return row || null;
}

// ----------------------------------------------------------
// Son konuşma mesajlarını al (en fazla 20 adet)
// ----------------------------------------------------------
function getLastMessages(phone) {
  return db.prepare(`
    SELECT direction, text_body, created_at
    FROM whatsapp_messages
    WHERE from_number = @p OR to_number = @p
    ORDER BY created_at DESC
    LIMIT 20
  `).all({ p: phone });
}

// ----------------------------------------------------------
// AI ile memory güncelle
// ----------------------------------------------------------
async function updateMemoryWithAI(phone, leadId = null) {
  let memory = getMemory(phone);

  if (!memory) {
    createMemoryRecord(phone, leadId);
    memory = getMemory(phone);
  }

  const lastMessages = getLastMessages(phone);

  const userMessage = `
Aşağıda WhatsApp konuşmasının son 20 mesajı var. 

Görev:
1) Konuşmayı kısa bir summary haline getir
2) Kullanıcı niyetini yorumla
3) Kullanıcı persona çıkarımı yap
4) Mesaj duygusunu (sentiment) belirt
5) Bu kişiye hitap ederken kısa bir AI notu oluştur

Lütfen JSON formatında döndür.

Son Mesajlar:
${JSON.stringify(lastMessages, null, 2)}
`;

  const aiResult = await callAgent({
    systemPrompt: "Sen WhatsApp AI Memory Engine'sin. Görev: konuşmaları kısa hafıza özetine dönüştür.",
    userMessage
  });

  let parsed = {};
  try {
    parsed = JSON.parse(aiResult);
  } catch (err) {
    parsed = {
      summary: aiResult,
      intent: "unknown",
      persona: "unknown",
      sentiment: "neutral",
      ai_note: "",
    };
  }

  db.prepare(`
    UPDATE whatsapp_memory
    SET updated_at = @updated_at,
        memory_summary = @summary,
        conversation_json = @conv,
        ai_tags = @tags
    WHERE wa_phone = @phone
  `).run({
    updated_at: now(),
    summary: parsed.summary || "",
    conv: JSON.stringify(lastMessages),
    tags: JSON.stringify(parsed),
    phone
  });

  log.info(`[Memory] Güncellendi → ${phone}`);

  return parsed;
}

module.exports = {
  getMemory,
  updateMemoryWithAI,
};