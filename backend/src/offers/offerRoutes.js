// backend/src/offers/offerRoutes.js

const express = require("express");
const { generateOfferHandler } = require("./offerController");

const router = express.Router();

// POST /api/offers/generate
// Body: { lead: {...}, packageLevel?: "lite" | "standard" | "premium" }
router.post("/generate", generateOfferHandler);

module.exports = router;