// backend/src/app.js

const express = require("express");
const cors = require("cors");
const { config } = require("./config/env");
const { log } = require("./lib/logger");

// Lead Acquisition V1
const {
  initLeadAcquisitionSchema,
} = require("./modules/lead-acquisition/db/leadAcquisitionSchema");
const leadAcquisitionRoutes = require("./modules/lead-acquisition/routes/leadAcquisitionRoutes");

// Routes
const aiRoutes = require("./routes/aiRoutes");
const leadRoutes = require("./lead-engine/leadRoutes");
const offerRoutes = require("./offers/offerRoutes");
const crmRoutes = require("./routes/crmRoutes");
const healthRoutes = require("./routes/healthRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const seoRoutes = require("./routes/seoRoutes");
const adsRoutes = require("./routes/adsRoutes");
const socialRoutes = require("./routes/socialRoutes");
const campaignRoutes = require("./routes/campaignRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes"); // 🔹 YENİ
const workerRoutes = require("./routes/workerRoutes"); // 🔹 YENİ

// Middleware
const { apiKeyAuth } = require("./middleware/apiKeyAuth");

// 🔹 Önce app'i oluşturacağız
const app = express();

app.use(cors());
app.use(express.json());

// Basit root health check (korumasız)
app.get("/", (req, res) => {
  res.json({ ok: true, message: "CNG Medya AI Agent backend çalışıyor." });
});

// Derin health check (env + CRM vs.)
app.use("/api/health", healthRoutes);

// 🔹 WhatsApp webhook: BURADA API KEY YOK!
// Meta kendi doğrulamasını yapıyor (verify_token).
app.use("/api/whatsapp", whatsappRoutes);

// 🔐 API KEY ile korunan core endpointler
app.use("/api/ai", apiKeyAuth, aiRoutes);
app.use("/api/leads", apiKeyAuth, leadRoutes);
// Lead Acquisition endpointleri de aynı namespace altında, API key ile korumalı
// Örn: POST /api/leads/acquire/google
app.use("/api/leads", apiKeyAuth, leadAcquisitionRoutes);
app.use("/api/offers", apiKeyAuth, offerRoutes);
app.use("/api/crm", apiKeyAuth, crmRoutes);
app.use("/api/seo", apiKeyAuth, seoRoutes);
app.use("/api/ads", apiKeyAuth, adsRoutes);
app.use("/api/social", apiKeyAuth, socialRoutes);
app.use("/api/campaigns", apiKeyAuth, campaignRoutes);
app.use("/api/dashboard", apiKeyAuth, dashboardRoutes); // 🔹 YENİ
app.use("/api/worker", apiKeyAuth, workerRoutes); // 🔹 YENİ

// -------------------------------------------------------------
// SERVER BOOTSTRAP
// -------------------------------------------------------------

async function start() {
  try {
    // Lead Acquisition tablolarını hazırla
    await initLeadAcquisitionSchema();

    app.listen(config.port, () => {
      log.info(`Server ${config.port} portunda çalışıyor (${config.env})`);
    });
  } catch (err) {
    log.error("Sunucu başlatılırken hata oluştu", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

start();

module.exports = app;