// backend/src/routes/healthRoutes.js

const express = require("express");
const router = express.Router();
const { log } = require("../lib/logger");
const { config } = require("../config/env");
const { listLeads } = require("../services/crmService");

// API KEY middleware'i opsiyonel olarak dahil et
let apiKeyAuth = null;
try {
  // Eğer gerçekten varsa, kullanırız. Yoksa korumasız çalışır.
  // Örn: module.exports = function apiKeyAuth(...) {...}
  // veya module.exports.apiKeyAuth ise buna göre uyarlayabiliriz.
  const maybe = require("../middleware/apiKeyAuth");

  // Eğer direkt fonksiyon export ediyorsa:
  if (typeof maybe === "function") {
    apiKeyAuth = maybe;
  }
  // Eğer { apiKeyAuth: fn } şeklinde ise:
  else if (maybe && typeof maybe.apiKeyAuth === "function") {
    apiKeyAuth = maybe.apiKeyAuth;
  } else {
    log.warn(
      "[HEALTH] apiKeyAuth middleware yüklendi ama fonksiyon formatında değil. Korumasız çalışacak."
    );
  }
} catch (err) {
  log.warn(
    "[HEALTH] apiKeyAuth middleware bulunamadı veya yüklenemedi. Internal endpointler korumasız çalışacak.",
    err.message
  );
}

// Küçük helper: varsa apiKeyAuth ekle, yoksa direkt handler kullan
function withOptionalApiKey(handler) {
  if (apiKeyAuth) {
    return [apiKeyAuth, handler]; // Express => path, mw, handler
  }
  return [handler];
}

/**
 * PUBLIC HEALTH CHECK
 * `/api/health`
 * API key gerektirmez
 */
router.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "CNG Medya AI Agent backend çalışıyor.",
    env: config.env,
    timestamp: new Date().toISOString(),
  });
});

/**
 * INTERNAL HEALTH CHECK (API KEY VARSA KORUMALI)
 * `/api/health/internal`
 */
router.get(
  "/internal",
  ...withOptionalApiKey((req, res) => {
    res.json({
      ok: true,
      env: config.env,
      timestamp: new Date().toISOString(),
      services: [
        "lead-engine",
        "offer-engine",
        "firmographic-engine",
        "swot-engine",
        "crm",
        "whatsapp",
        "ai-agent-core",
      ],
    });
  })
);

/**
 * FULL SYSTEM DIAGNOSTIC
 * `/api/health/full`
 * (Senin mevcut kontrol ekranın — API KEY VARSA korumalı)
 */
router.get(
  "/full",
  ...withOptionalApiKey((req, res) => {
    try {
      const checks = {
        env: config.env,
        openaiConfigured: !!config.openaiApiKey,
        googleConfigured: !!config.googleApiKey,
        internalApiKeyConfigured: !!config.internalApiKey,
      };

      let crmOk = true;

      try {
        const result = listLeads({ page: 1, pageSize: 1 });
        checks.crmTotalLeads = result.total;
      } catch (err) {
        crmOk = false;
        checks.crmError = err.message;
      }

      checks.crmOk = crmOk;

      return res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        checks,
      });
    } catch (err) {
      log.error("Health check error:", err);
      return res.status(500).json({
        ok: false,
        error: "Health check failed",
        detail: err.message,
      });
    }
  })
);

module.exports = router;