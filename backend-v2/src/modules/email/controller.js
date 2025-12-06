// backend-v2/src/modules/email/controller.js
const emailService = require('./service');

async function sendTestEmailHandler(req, res, next) {
  try {
    const result = await emailService.sendTestEmail(req.body);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function sendLeadEmailHandler(req, res, next) {
  try {
    const { leadId } = req.params;
    const payload = req.body; // {subject, message, toOverride?}
    const result = await emailService.sendEmailForLead({ leadId, payload });
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendTestEmailHandler,
  sendLeadEmailHandler,
};