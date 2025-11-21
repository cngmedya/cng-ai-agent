// backend/src/routes/seoRoutes.js

const express = require("express");
const router = express.Router();
const seoController = require("../seo/seoController");

// Lead objesi üzerinden SEO analizi
router.post("/analyze-lead", seoController.analyzeLeadForLeadObject);

module.exports = router;