// backend/src/modules/lead-acquisition/routes/leadAcquisitionRoutes.js

const express = require("express");
const router = express.Router();

// middleware eklemeyi unutmayalım!
const { apiKeyAuth } = require("../../../middleware/apiKeyAuth");

const {
  acquireFromGooglePlaces,
  runWebsiteIntelBatchForLeads,
} = require("../controllers/leadAcquisitionController");

// Yeni reputation controller
const { runReputationIntel } = require("../controllers/leadAcquisitionController");

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
// REPUTATION INTEL (AI + Search)
// -------------------------------
router.post(
  "/intel/reputation",
  apiKeyAuth,
  runReputationIntel
);

module.exports = router;