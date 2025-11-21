// backend/src/modules/lead-acquisition/routes/leadAcquisitionRoutes.js

const express = require("express");
const router = express.Router();

// API key middleware
const { apiKeyAuth } = require("../../../middleware/apiKeyAuth");

// Controller fonksiyonları
const {
  acquireFromGooglePlaces,
  runWebsiteIntelBatchForLeads,
  runReputationIntel,
  runReputationIntelBatchForLeads,
  getLeadIntelController,
  getLeadIntelSummaryController,
} = require("../controllers/leadAcquisitionController");

// -------------------------------
// GOOGLE PLACES -> LEAD ACQUISITION
// -------------------------------
router.post("/acquire/google", apiKeyAuth, acquireFromGooglePlaces);

// -------------------------------
// WEBSITE INTEL BATCH
// -------------------------------
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

module.exports = router;