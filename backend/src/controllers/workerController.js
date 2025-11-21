// backend/src/controllers/workerController.js

const { log } = require("../lib/logger");
const workerService = require("../services/workerService");

/**
 * Manuel worker tetikleme
 * POST /api/worker/run
 */
async function runNow(req, res) {
  try {
    // İleride limit vs. query'den alabiliriz, şimdilik default
    const processed = await workerService.runWorkerOnce();

    return res.json({
      ok: true,
      processed,
    });
  } catch (err) {
    log.error("[WorkerController] runNow hata:", err);
    return res.status(500).json({
      ok: false,
      error: "WORKER_RUN_FAILED",
      detail: err.message,
    });
  }
}

module.exports = {
  runNow,
};