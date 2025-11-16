const express = require("express");
const {
  leadAnalyze,
  offerGenerate,
  healthReport,
} = require("../controllers/aiController");

const router = express.Router();

// Lead analizi
router.post("/lead-analyze", leadAnalyze);

// Teklif oluşturma
router.post("/offer-generate", offerGenerate);

// Ajans sağlık raporu
router.post("/health-report", healthReport);

module.exports = router;