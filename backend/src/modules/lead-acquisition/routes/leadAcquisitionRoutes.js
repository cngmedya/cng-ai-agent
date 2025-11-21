// backend/src/modules/lead-acquisition/routes/leadAcquisitionRoutes.js

const express = require("express");
const router = express.Router();

const leadAcquisitionController = require("../controllers/leadAcquisitionController");

// Google Places üzerinden potansiyel müşteri tarama
// POST /api/leads/acquire/google
router.post("/acquire/google", leadAcquisitionController.acquireFromGooglePlaces);

module.exports = router;