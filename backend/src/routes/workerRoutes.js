// backend/src/routes/workerRoutes.js

const express = require("express");
const router = express.Router();
const workerController = require("../controllers/workerController");

// Manuel worker tetikleme
router.post("/run", workerController.runNow);

module.exports = router;