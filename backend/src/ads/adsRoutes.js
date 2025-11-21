// backend/src/ads/adsRoutes.js

const express = require("express");
const router = express.Router();
const adsController = require("./adsController");

// POST /api/ads/plan-for-lead
router.post("/plan-for-lead", adsController.planForLead);

module.exports = router;