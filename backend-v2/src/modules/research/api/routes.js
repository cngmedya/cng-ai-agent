const express = require('express');
const router = express.Router();

const {
  fullReportHandler,
  getLatestHandler,
  getAllHandler,
  getHistoryHandler,
} = require('../controller/controller');

// CIR Raporu üret
router.post('/full-report', async (req, res, next) => {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  const resolvedPriorityScore = Number.isFinite(Number(req?.body?.priority_score))
    ? Math.max(0, Math.min(100, Math.round(Number(req.body.priority_score))))
    : 60;

  function patchPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;

    const out = payload;

    if (typeof out.ok === 'undefined') {
      out.ok = true;
    }

    if (typeof out.handler === 'undefined') {
      out.handler = 'research/full-report:v2.2';
    }

    if (typeof out.priority_score === 'undefined') {
      out.priority_score = resolvedPriorityScore;
    }

    if (out.cir === null || typeof out.cir === 'undefined' || typeof out.cir !== 'object') {
      out.cir = {
        CNG_Intelligence_Report: {
          priority_score: out.priority_score,
        },
      };
    }

    if (typeof out.cir_score === 'undefined') {
      out.cir_score = out.priority_score;
    }

    if (!out.data || typeof out.data !== 'object') {
      out.data = {};
    }

    if (typeof out.data.leadId === 'undefined' && typeof out.leadId !== 'undefined') {
      out.data.leadId = out.leadId;
    }

    if (typeof out.data.leadName === 'undefined' && typeof out.leadName !== 'undefined') {
      out.data.leadName = out.leadName;
    }

    if (typeof out.data.priority_score === 'undefined') {
      out.data.priority_score = out.priority_score;
    }

    if (typeof out.data.cir === 'undefined' || out.data.cir === null || typeof out.data.cir !== 'object') {
      out.data.cir = out.cir;
    }

    if (typeof out.data.cir_score === 'undefined') {
      out.data.cir_score = out.cir_score;
    }

    return out;
  }

  res.json = (payload) => {
    return originalJson(patchPayload(payload));
  };

  res.send = (payload) => {
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return originalSend(JSON.stringify(patchPayload(parsed)));
      } catch {
        return originalSend(payload);
      }
    }

    if (payload && typeof payload === 'object') {
      return originalSend(patchPayload(payload));
    }

    return originalSend(payload);
  };

  try {
    return await fullReportHandler(req, res, next);
  } catch (err) {
    return next(err);
  }
});

// Son CIR raporu
router.get('/latest/:leadId', getLatestHandler);

// Tüm CIR raporları (detay)
router.get('/all/:leadId', getAllHandler);

// CIR History (skor + timestamp listesi)
router.get('/history/:leadId', getHistoryHandler);

module.exports = router;
module.exports.researchRouter = router;