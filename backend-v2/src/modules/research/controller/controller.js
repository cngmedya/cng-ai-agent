const { getDb } = require('../../../core/db');
const {
  generateFullResearch,
  getLatestReport,
  getAllReports,
} = require('../service/researchService');

// Basit performans ölçer
function now() {
  return Date.now();
}

async function fullReportHandler(req, res) {
  const start = now();
  const { leadId: leadIdBody, lead_id, priority_score } = req.body || {};
  const leadId = leadIdBody ?? lead_id;
  const reqId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // leadId zorunlu kontrolü
  if (!leadId) {
    return res.status(400).json({ ok: false, error: 'leadId zorunludur' });
  }

  const resolvedPriorityScore = Number.isFinite(Number(priority_score))
    ? Math.max(0, Math.min(100, Math.round(Number(priority_score))))
    : 60;

  const db = getDb();

  const leadRow =
    db.prepare(`SELECT id, name FROM potential_leads WHERE id = ?`).get(leadId) ||
    db.prepare(`SELECT id, name FROM leads WHERE id = ?`).get(leadId) ||
    null;

  const leadName = leadRow ? leadRow.name : null;

  console.log(
    `\n[research/full-report] ▶️ STARTED (reqId=${reqId}, leadId=${leadId}, priority_score=${resolvedPriorityScore})`,
  );

  try {
    const data = await generateFullResearch({
      leadId,
      priority_score: resolvedPriorityScore,
    });

    const end = now();
    const duration = (end - start) / 1000;

    // CIR skorunu çekelim (fallback-safe)
    const extractedScore =
      data?.cir?.CNG_Intelligence_Report?.priority_score ??
      data?.cir?.cng_recommendation?.overall_score ??
      data?.cir_score ??
      data?.cirScore ??
      data?.score ??
      data?.result?.score ??
      data?.data?.cir_score ??
      data?.priority_score ??
      null;

    const cir =
      extractedScore === null || typeof extractedScore === 'undefined'
        ? resolvedPriorityScore
        : Number.isFinite(Number(extractedScore))
          ? Number(extractedScore)
          : resolvedPriorityScore;

    const cirObj =
      data && typeof data === 'object' && data.cir && typeof data.cir === 'object' && data.cir !== null
        ? data.cir
        : {
            CNG_Intelligence_Report: {
              priority_score: cir,
            },
          };

    console.log(
      `[research/full-report] ✅ FINISHED (reqId=${reqId}, leadId=${leadId}, cir=${cir}, duration=${duration}s)`,
    );

    return res.json({
      ok: true,
      leadId: Number(leadId),
      leadName,
      priority_score: resolvedPriorityScore,
      handler: 'research/full-report:v2.2',
      cir: cirObj,
      cir_obj: cirObj,
      cir_score: cir,
      data: {
        leadId: Number(leadId),
        leadName,
        priority_score: resolvedPriorityScore,
        cir: cirObj,
        cir_obj: cirObj,
        cir_score: cir,
        raw: data && typeof data === 'object' && data.raw ? data.raw : data,
      },
    });
  } catch (err) {
    const end = now();
    const duration = (end - start) / 1000;

    console.error(
      `[research/full-report] ❌ ERROR (reqId=${reqId}, leadId=${leadId}, duration=${duration}s):`,
      err.message,
    );

    const fallbackCirObj = {
      CNG_Intelligence_Report: {
        priority_score: resolvedPriorityScore,
      },
    };

    return res.status(200).json({
      ok: true,
      leadId: leadId ? Number(leadId) : null,
      leadName,
      priority_score: resolvedPriorityScore,
      handler: 'research/full-report:v2.2',
      cir: fallbackCirObj,
      cir_obj: fallbackCirObj,
      cir_score: resolvedPriorityScore,
      data: {
        leadId: leadId ? Number(leadId) : null,
        leadName,
        priority_score: resolvedPriorityScore,
        cir: fallbackCirObj,
        cir_obj: fallbackCirObj,
        cir_score: resolvedPriorityScore,
      },
      note: 'fallback_contract_applied',
      error: err.message,
    });
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

    const rows = db
      .prepare(
        `
      SELECT id, created_at, cir_json
      FROM lead_cir_reports
      WHERE lead_id = ?
      ORDER BY created_at DESC
    `,
      )
      .all(leadId);

    const formatted = rows.map((r) => ({
      id: r.id,
      leadId,
      created_at: r.created_at,
      score: (() => {
        try {
          return JSON.parse(r.cir_json)?.cng_recommendation?.overall_score;
        } catch {
          return null;
        }
      })(),
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
  getHistoryHandler,
};