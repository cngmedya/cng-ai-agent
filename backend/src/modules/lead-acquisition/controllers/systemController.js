// backend/src/modules/system/controllers/systemController.js

"use strict";

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

exports.healthCheck = (req, res) => {
  const startedAt = new Date();

  try {
    // DB erişimi test
    const db = getCrmDb();
    const row = db.prepare("SELECT 1 AS ok").get();

    const dbOk = row && row.ok === 1;

    const now = new Date();

    return res.json({
      ok: true,
      data: {
        app: {
          status: "ok",
          env: process.env.NODE_ENV || "development",
        },
        db: {
          status: dbOk ? "ok" : "error",
        },
        meta: {
          startedAt: startedAt.toISOString(),
          checkedAt: now.toISOString(),
        },
      },
      error: null,
    });
  } catch (err) {
    const now = new Date();

    log.error("[SystemHealth] HATA", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      data: {
        app: {
          status: "error",
          env: process.env.NODE_ENV || "development",
        },
        db: {
          status: "error",
        },
        meta: {
          startedAt: startedAt.toISOString(),
          checkedAt: now.toISOString(),
        },
      },
      error: "Sistem sağlığı kontrolünde hata.",
    });
  }
};