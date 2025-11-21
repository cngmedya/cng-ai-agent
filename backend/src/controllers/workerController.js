// backend/src/controllers/workerController.js

const { runWorkerOnce } = require("../services/workerService");
const { log } = require("../lib/logger");

/**
 * Tek seferlik worker run (manuel / cron tetik)
 *  - context: "manual" | "cron" vs.
 */
exports.runWorkerOnce = async (req, res) => {
  const context =
    (req.body && req.body.context) ||
    (req.query && req.query.context) ||
    "manual";

  try {
    const result = await runWorkerOnce({ context });

    return res.json({
      ok: true,
      data: result,
      error: null,
    });
  } catch (err) {
    log.error("[WorkerController] runWorkerOnce HATA", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      data: null,
      error: "runWorkerOnce sırasında bir hata oluştu.",
    });
  }
};