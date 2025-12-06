// backend-v2/src/modules/research/controller/controller.js

const { getDb } = require('../../../core/db');
const { generateFullResearch, getLatestReport, getAllReports } = require('../service/researchService');

// Basit performans ölçer
function now() { return Date.now(); }

async function fullReportHandler(req, res) {
  const start = now();
  const { leadId } = req.body || {};

  console.log(`\n[research/full-report] ▶️ STARTED (leadId=${leadId})`);

  try {
    const data = await generateFullResearch({ leadId });

    const end = now();
    const duration = (end - start) / 1000;

    // CIR skorunu çekelim
    const score =
      data?.cir?.CNG_Intelligence_Report?.priority_score ??
      data?.cir?.cng_recommendation?.overall_score ??
      null;

    console.log(
      `[research/full-report] ✅ FINISHED (leadId=${leadId}, score=${score}, duration=${duration}s)`
    );

    res.json({ ok: true, data });

  } catch (err) {
    const end = now();
    const duration = (end - start) / 1000;

    console.error(
      `[research/full-report] ❌ ERROR (leadId=${leadId}, duration=${duration}s):`,
      err.message
    );

    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getLatestHandler(req, res) {
  try {
    const { leadId } = req.params;
    console.log(`[research/latest] Fetching latest CIR (leadId=${leadId})`);

    const data = await getLatestReport(leadId);
    res.json({ ok: true, data });

  } catch (err) {
    console.error('[research/latest] ERROR:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getAllHandler(req, res) {
  try {
    const { leadId } = req.params;
    console.log(`[research/all] Fetching ALL CIR reports (leadId=${leadId})`);

    const data = await getAllReports(leadId);
    res.json({ ok: true, data });

  } catch (err) {
    console.error('[research/all] ERROR:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getHistoryHandler(req, res) {
  try {
    const { leadId } = req.params;

    console.log(`[research/history] Fetching score history (leadId=${leadId})`);

    const db = getDb();

    const rows = db.prepare(`
      SELECT id, created_at, cir_json
      FROM lead_cir_reports
      WHERE lead_id = ?
      ORDER BY created_at DESC
    `).all(leadId);

    const formatted = rows.map(r => ({
      id: r.id,
      leadId,
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
    console.error('[research/history] ERROR:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  fullReportHandler,
  getLatestHandler,
  getAllHandler,
  getHistoryHandler
};