// backend-v2/src/modules/outreachScheduler/controller.js
const { enqueueSequenceForLead } = require('./service');

async function enqueueOutreachSequenceHandler(req, res) {
  try {
    const { leadId } = req.params;
    const {
      channel,
      tone,
      language,
      objective,
      max_followups,
    } = req.body || {};

    const data = await enqueueSequenceForLead({
      leadId,
      channel,
      tone,
      language,
      objective,
      max_followups,
    });

    res.json({ ok: true, data });
  } catch (err) {
    console.error('[OUTREACH_SCHEDULER][ENQUEUE] Error:', err);
    res.status(400).json({
      ok: false,
      error: 'OUTREACH_SCHEDULER_ENQUEUE_FAILED',
      message: err.message || 'Outreach scheduling failed',
    });
  }
}

module.exports = {
  enqueueOutreachSequenceHandler,
};