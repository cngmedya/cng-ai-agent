// backend/src/modules/lead-acquisition/routes/leadAcquisitionRoutes.js

const express = require("express");
const router = express.Router();

// API key middleware
const { apiKeyAuth } = require("../../../middleware/apiKeyAuth");

// Controller fonksiyonları
const {
  acquireFromGooglePlaces,
  enrichWebsiteIntel,             // 🔹 TEKİL WEBSITE INTEL
  runWebsiteIntelBatchForLeads,
  runReputationIntel,
  runReputationIntelBatchForLeads,
  getLeadIntelController,
  getLeadIntelSummaryController,
  runDomainDiscoveryBatchController,
} = require("../controllers/leadAcquisitionController");

// -------------------------------
// GOOGLE PLACES -> LEAD ACQUISITION
// -------------------------------
router.post("/acquire/google", apiKeyAuth, acquireFromGooglePlaces);

// -------------------------------
// WEBSITE INTEL (single + batch)
// -------------------------------

// Tek bir URL için website intel
router.post(
  "/website-intel",
  apiKeyAuth,
  enrichWebsiteIntel
);

// Batch çalıştırma (lead'ler üzerinden)
router.post(
  "/intel/website/batch",
  apiKeyAuth,
  runWebsiteIntelBatchForLeads
);

// -------------------------------
// REPUTATION INTEL (single + batch)
// -------------------------------
router.post(
  "/intel/reputation",
  apiKeyAuth,
  runReputationIntel
);

router.post(
  "/intel/reputation/batch",
  apiKeyAuth,
  runReputationIntelBatchForLeads
);

// -------------------------------
// LEAD INTEL (dashboard için)
// -------------------------------
router.get(
  "/intel/summary",
  apiKeyAuth,
  getLeadIntelSummaryController
);

router.get(
  "/intel/:leadId",
  apiKeyAuth,
  getLeadIntelController
);

// -------------------------------
// DOMAIN DISCOVERY V2 (batch)
// -------------------------------
router.post(
  "/domain-discovery/batch",
  apiKeyAuth,
  runDomainDiscoveryBatchController
);

module.exports = router;