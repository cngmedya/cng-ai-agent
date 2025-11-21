const express = require("express");
const router = express.Router();
const leadController = require("./leadController");

// Basit lead arama
router.post("/search", leadController.searchLeads);

// Lead + AI summary
router.post("/search-with-summary", leadController.searchLeadsWithSummary);

// 🔥 Yeni eklediğimiz full otomatik pipeline
router.post("/search-with-offer", leadController.searchLeadsWithOffer);

module.exports = router;