// backend/src/routes/workerRoutes.js

const express = require("express");
const router = express.Router();

// API key middleware
const { apiKeyAuth } = require("../middleware/apiKeyAuth");

// Controller
const { runWorkerOnce } = require("../controllers/workerController");

// Tek seferlik worker çalıştırma (manual / cron tetik)
router.post("/run-once", apiKeyAuth, runWorkerOnce);

module.exports = router;