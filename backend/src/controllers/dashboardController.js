// backend/src/controllers/dashboardController.js

const dashboardService = require("../services/dashboardService");

exports.getSummary = (req, res) => {
  try {
    const summary = dashboardService.getSummary();
    res.json({ ok: true, summary });
  } catch (err) {
    console.error("[Dashboard] summary error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};