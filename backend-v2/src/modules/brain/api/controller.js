const brainService = require('../service/brainService');

async function pingBrain(req, res) {
  res.json({
    ok: true,
    data: {
      message: 'brain module v1.0 — OK',
    },
  });
}

async function getLeadBrainHandler(req, res) {
  try {
    const { leadId } = req.params;
    const brain = await brainService.getLeadBrain(leadId);

    res.json({
      ok: true,
      data: brain,
    });
  } catch (err) {
    console.error('[BRAIN][LEAD]', err);

    res.status(500).json({
      ok: false,
      error: err.code || 'BRAIN_LEAD_ERROR',
      message: err.message || 'Brain lead verisi alınırken hata oluştu.',
    });
  }
}

async function getLeadBrainSummaryHandler(req, res) {
  try {
    const { leadId } = req.params;
    const summary = await brainService.getLeadBrainSummary(leadId);

    res.json({
      ok: true,
      data: summary,
    });
  } catch (err) {
    console.error('[BRAIN][SUMMARY]', err);

    res.status(500).json({
      ok: false,
      error: err.code || 'BRAIN_SUMMARY_ERROR',
      message: err.message || 'Brain summary verisi alınırken hata oluştu.',
    });
  }
}

module.exports = {
  pingBrain,
  getLeadBrainHandler,
  getLeadBrainSummaryHandler,
};