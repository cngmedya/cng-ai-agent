// backend-v2/src/modules/research/api/routes.js

const express = require('express');
const router = express.Router();

const {
  fullReportHandler,
  getLatestHandler,
  getAllHandler
} = require('../controller/controller');

const { getDb } = require('../../../core/db');

// CIR Raporu üret
router.post('/full-report', fullReportHandler);

// Son CIR raporu
router.get('/latest/:leadId', getLatestHandler);

// Tüm CIR raporları (detay)
router.get('/all/:leadId', getAllHandler);

// CIR History (skor + timestamp listesi)
router.get('/history/:leadId', (req, res) => {
  try {
    const { leadId } = req.params;
    const id = Number(leadId);

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        ok: false,
        error: 'Geçerli bir leadId zorunlu.'
      });
    }

    const db = getDb();

    const rows = db.prepare(
      `
        SELECT
          id,
          lead_id,
          report_json,
          created_at
        FROM lead_cir_reports
        WHERE lead_id = ?
        ORDER BY created_at DESC
      `
    ).all(id);

    const history = rows.map((r) => {
      let score = null;

      if (r.report_json) {
        try {
          const parsed = JSON.parse(r.report_json);

          // Eski + yeni tüm formatları kapsayacak şekilde geniş path seti
          score =
            // Klasik CIR
            parsed?.cng_recommendation?.overall_score ??
            parsed?.CNG_Intelligence_Report?.cng_recommendation?.overall_score ??
            // Top-level priority
            parsed?.overall_score ??
            parsed?.priority_score ??
            parsed?.CNG_Intelligence_Report?.overall_score ??
            parsed?.CNG_Intelligence_Report?.priority_score ??
            // Yeni “intel_summary.basic.priority_score” formatı
            parsed?.intel_summary?.basic?.priority_score ??
            parsed?.CNG_Intelligence_Report?.intel_summary?.basic?.priority_score ??
            // Son çare: benchmark skorunu kullan (fallback)
            parsed?.benchmark?.benchmark_score ??
            parsed?.CNG_Intelligence_Report?.benchmark?.benchmark_score ??
            null;
        } catch {
          score = null;
        }
      }

      return {
        id: r.id,
        leadId: r.lead_id,
        created_at: r.created_at,
        score
      };
    });

    return res.json({
      ok: true,
      data: history
    });
  } catch (err) {
    console.error('[research/history] hata:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'History alınırken hata oluştu.'
    });
  }
});

module.exports = { researchRouter: router };