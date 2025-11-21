const express = require("express");
const router = express.Router();

const leadAcquisitionController = require("../controllers/leadAcquisitionController");

// Google Places üzerinden potansiyel müşteri tarama
router.post("/acquire/google", leadAcquisitionController.acquireFromGooglePlaces);

// Website intelligence: URL bazlı analiz
router.post("/intel/website", leadAcquisitionController.enrichWebsiteIntel);

module.exports = router;