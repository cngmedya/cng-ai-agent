// backend/src/routes/whatsappRoutes.js

const express = require("express");
const router = express.Router();

const whatsappController = require("../controllers/whatsappController");

// -------------------------------------------------------------
// HEALTH (GET)
// -------------------------------------------------------------
router.get("/health", whatsappController.health);

// -------------------------------------------------------------
// WEBHOOK VERIFY (GET) — Meta çağırır
// -------------------------------------------------------------
router.get("/webhook", whatsappController.verify);

// -------------------------------------------------------------
// WEBHOOK RECEIVE (POST) — Meta mesaj gönderir
// -------------------------------------------------------------
router.post("/webhook", whatsappController.receiveWebhook);

// -------------------------------------------------------------
// DEBUG / MEMORY — (GET) memory dump
// ÖRNEK:
//   GET /api/whatsapp/debug/memory?phone=905322011479&limit=50
// -------------------------------------------------------------
router.get("/debug/memory", async (req, res) => {
  try {
    const phone = req.query.phone;
    const limit = Number(req.query.limit) || 30;

    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: "phone parametresi zorunlu",
      });
    }

    const { getMemoryForPhone } = require("../services/whatsappService");
    const items = await getMemoryForPhone(phone, limit);

    return res.json({
      ok: true,
      phone,
      limit,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error("[WhatsApp] DEBUG MEMORY ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_ERROR",
      detail: err.message,
    });
  }
});

// -------------------------------------------------------------
// MANUAL SEND TEST — DEV MODE (POST)
// -------------------------------------------------------------
// ÖRNEK:
//   POST /api/whatsapp/test-send
//   { "to": "9053xxxxxxx", "message": "Test" }
router.post("/test-send", async (req, res) => {
  try {
    const { to, message } = req.body;
    const { sendTextMessage } = require("../services/whatsappService");

    if (!to || !message) {
      return res.status(400).json({
        ok: false,
        error: "to ve message zorunlu",
      });
    }

    const resp = await sendTextMessage(to, message);

    return res.json({
      ok: true,
      to,
      message,
      resp,
    });
  } catch (err) {
    console.error("[WhatsApp] TEST-SEND ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "WHATSAPP_SEND_FAILED",
      detail: err.message,
    });
  }
});

module.exports = router;