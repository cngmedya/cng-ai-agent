// backend-v2/src/modules/research/controller/controller.js

const { getDb } = require('../../../core/db');
const { generateFullResearch, getLatestReport, getAllReports } = require('../service/researchService');

async function fullReportHandler(req, res) {
  try {
    const { leadId } = req.body;
    const data = await generateFullResearch({ leadId });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getLatestHandler(req, res) {
  try {
    const { leadId } = req.params;
    const data = await getLatestReport(leadId);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getAllHandler(req, res) {
  try {
    const { leadId } = req.params;
    const data = await getAllReports(leadId);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getHistoryHandler(req, res) {
  try {
    const { leadId } = req.params;
    const db = getDb();

    const rows = db.prepare(`
      SELECT id, created_at, cir_json
      FROM lead_cir_reports
      WHERE lead_id = ?
      ORDER BY created_at DESC
    `).all(leadId);

    const formatted = rows.map(r => ({
      id: r.id,
      created_at: r.created_at,
      score: (() => {
        try {
          return JSON.parse(r.cir_json)?.cng_recommendation?.overall_score;
        } catch {
          return null;
        }
      })()
    }));

    res.json({ ok: true, data: formatted });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  fullReportHandler,
  getLatestHandler,
  getAllHandler,
  getHistoryHandler
};