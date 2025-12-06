// backend-v2/src/modules/whatsapp/controller.js
const whatsappService = require('./service');

async function sendTestWhatsappHandler(req, res, next) {
  try {
    const result = await whatsappService.sendTestMessage(req.body);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function sendWhatsappForLeadHandler(req, res, next) {
  try {
    const { leadId } = req.params;
    const payload = req.body; // { message, toOverride? }
    const result = await whatsappService.sendMessageForLead({ leadId, payload });
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendTestWhatsappHandler,
  sendWhatsappForLeadHandler,
};