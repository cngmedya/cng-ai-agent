// backend-v2/src/modules/outreachScheduler/controller.js
const { enqueueSequenceForLead } = require('./service');

async function enqueueOutreachSequenceHandler(req, res, next) {
  try {
    const leadId = Number(req.params.leadId);
    const result = await enqueueSequenceForLead(leadId, req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  enqueueOutreachSequenceHandler
};