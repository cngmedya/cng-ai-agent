// backend/src/controllers/whatsappController.js

const { log } = require("../lib/logger");
const {
  verifyWebhookQuery,
  verifyWebhookSignature,
  logInboundMessage,
  saveUserMessageToMemory,
  saveAssistantMessageToMemory,
  getMemoryForPhone,
} = require("../services/whatsappService");

const { sendTextMessage } = require("../services/whatsappService");
const { callAgent } = require("../services/aiService");

// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
exports.health = (req, res) => {
  return res.json({
    ok: true,
    service: "whatsapp-webhook",
    time: new Date().toISOString(),
  });
};

// -------------------------------------------------------------
// WEBHOOK VERIFY (GET)
// -------------------------------------------------------------
exports.verify = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const result = verifyWebhookQuery({ mode, token, challenge });

  if (result.ok) {
    return res.status(200).send(result.challenge);
  }

  return res.sendStatus(403);
};

// -------------------------------------------------------------
// WEBHOOK RECEIVE (POST)
// -------------------------------------------------------------
exports.receiveWebhook = async (req, res) => {
  try {
    const body = req.body;

    // Meta boş test webhookları
    if (!body.entry || !Array.isArray(body.entry)) {
      return res.sendStatus(200);
    }

    const entry = body.entry[0];
    const changes = entry.changes?.[0];
    const value = changes?.value;

    if (!value || !value.messages) {
      return res.sendStatus(200);
    }

    const msg = value.messages[0];
    const from = msg.from; // 905xxxxxxxxx
    const waMessageId = msg.id;
    const waPhoneNumberId = value.metadata?.phone_number_id;

    log.info("[WhatsApp] Inbound mesaj:", { from, waMessageId });

    let messageText = null;

    // ---------------------------------------------------------
    // A) TEXT MESAJ
    // ---------------------------------------------------------
    if (msg.type === "text") {
      messageText = msg.text.body;

      // Memory'ye kaydet
      await saveUserMessageToMemory({
        wa_phone: from,
        text: messageText,
      });

      // Inbound log
      logInboundMessage({
        waMessageId,
        waPhoneNumberId,
        from,
        to: null,
        type: "text",
        textBody: messageText,
        payload: msg,
        raw: body,
      });
    }

    // Şimdilik sadece text için auto-response verelim
    if (!messageText) {
      return res.sendStatus(200);
    }

    // ---------------------------------------------------------
    // B) AI AUTO RESPONSE (Chat Memory ile)
    // ---------------------------------------------------------

    // Geçmiş konuşmayı getir
    const history = await getMemoryForPhone(from);

    const systemPrompt = `
Sen CNG Medya için çalışan bir satış ve danışmanlık asistanısın.
Kullanıcıyla WhatsApp üzerinden konuşuyorsun.
Tonun samimi, profesyonel ve net.
Kısa ve okunabilir mesajlar yaz, gereksiz uzun paragraflardan kaçın.
Mimarlık ofisleri, iç mimarlık projeleri, dijital pazarlama, reklam ve CNG Medya hizmetleri hakkında bilgi verebilir,
gerekirse keşif/randevu/teklif adımlarına yönlendirebilirsin.
`;

    // Geçmişi sade bir metne çevir
    const historyText =
      history && history.length
        ? history
            .map((h) => {
              const speaker = h.role === "assistant" ? "Asistan" : "Müşteri";
              return `${speaker}: ${h.message}`;
            })
            .join("\n")
        : "(Daha önce mesaj yok)";

    // aiService.callAgent için userMessage hazırlıyoruz
    const userMessage = `
Önceki konuşma:
${historyText}

Yeni gelen WhatsApp mesajı (müşteri):
${messageText}

Lütfen WhatsApp üzerinden tek bir cevap mesajı üret.
Cevap sadece kullanıcıya göndereceğimiz metin olsun, ekstra açıklama yazma.
    `.trim();

    const aiResult = await callAgent({
      systemPrompt,
      userMessage,
    });

    // aiService implementasyonuna göre aiResult string veya obje olabilir.
    // En güvenlisi: string ise direkt kullan, obje ise .content veya .text dene.
    let cleanReply = null;

    if (!aiResult) {
      cleanReply = "Size nasıl yardımcı olabilirim?";
    } else if (typeof aiResult === "string") {
      cleanReply = aiResult.trim();
    } else if (typeof aiResult === "object") {
      cleanReply =
        aiResult.content ||
        aiResult.text ||
        JSON.stringify(aiResult).slice(0, 500);
    } else {
      cleanReply = "Size nasıl yardımcı olabilirim?";
    }

    if (!cleanReply) {
      cleanReply = "Size nasıl yardımcı olabilirim?";
    }

    // WhatsApp üzerinden geri cevap gönder
    await sendTextMessage(from, cleanReply);

    // Assistant mesajını memory'ye ekle
    await saveAssistantMessageToMemory({
      wa_phone: from,
      text: cleanReply,
    });

    return res.sendStatus(200);
  } catch (err) {
    log.error("[WhatsApp] Webhook işlem hatası:", err);
    return res.sendStatus(500);
  }
};

// -------------------------------------------------------------
// DEBUG – Memory görüntüleme (sadece internal kullanım için)
// GET /api/whatsapp/debug/memory?phone=9053....&limit=50
// -------------------------------------------------------------
exports.debugMemory = async (req, res) => {
  try {
    const phone =
      req.query.phone ||
      req.query.wa_phone ||
      req.query.number ||
      null;

    const limit = req.query.limit ? Number(req.query.limit) : 50;

    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: "phone_required",
        message:
          "Lütfen ?phone=9053.... şeklinde bir telefon numarası gönderin.",
      });
    }

    const history = await getMemoryForPhone(phone, limit);

    return res.json({
      ok: true,
      phone,
      limit,
      count: history.length,
      items: history,
    });
  } catch (err) {
    log.error("[WhatsApp] debugMemory hata:", err);
    return res.status(500).json({
      ok: false,
      error: "DEBUG_MEMORY_FAILED",
      message: err.message,
    });
  }
};