const express = require("express");
const router = express.Router();

const leadAcquisitionController = require("../controllers/leadAcquisitionController");

// Google Places üzerinden potansiyel müşteri tarama
router.post("/acquire/google", leadAcquisitionController.acquireFromGooglePlaces);

// Website intelligence: URL bazlı ham meta analiz
router.post("/intel/website", leadAcquisitionController.enrichWebsiteIntel);

// Website intelligence + AI SWOT + dijital skor analizi
router.post("/intel/website/ai", leadAcquisitionController.analyzeWebsiteWithAI);

module.exports = router;