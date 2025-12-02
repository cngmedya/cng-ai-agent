// backend/src/modules/system/routes/systemRoutes.js

"use strict";

const express = require("express");
const router = express.Router();

const { apiKeyAuth } = require("../../../middleware/apiKeyAuth");
const { healthCheck } = require("../controllers/systemController");

// Basit health endpoint
router.get("/health", apiKeyAuth, healthCheck);

module.exports = router;