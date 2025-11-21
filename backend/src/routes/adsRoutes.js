// backend/src/routes/adsRoutes.js

const express = require("express");
const router = express.Router();
const adsController = require("../ads/adsController");

// 🔹 Ham lead + seo + swot + offer ile plan üret (zaten test ettiğimiz endpoint)
router.post("/plan-for-lead", adsController.planForLead);

// 🔹 CRM'deki leadId üzerinden plan üret + campaigns & actions içine kaydet
router.post("/plan-and-save", adsController.planAndSave);

module.exports = router;