// backend-v2/src/modules/whatsapp/controller.js
const whatsappService = require('./service');

async function sendTestWhatsappHandler(req, res) {
  try {
    const data = await whatsappService.sendTestMessage();
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[WHATSAPP][TEST] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'WHATSAPP_TEST_FAILED',
      message: err.message || 'WhatsApp test mesajı gönderilemedi.',
    });
  }
}

async function sendWhatsappForLeadHandler(req, res) {
  const leadId = Number(req.params.leadId) || null;
  const { phone, message } = req.body || {};

  try {
    const data = await whatsappService.sendMessageForLead({
      leadId,
      phone,
      message,
    });

    res.json({ ok: true, data });
  } catch (err) {
    console.error('[WHATSAPP][SEND_FOR_LEAD] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'WHATSAPP_SEND_FOR_LEAD_FAILED',
      message: err.message || 'WhatsApp mesajı gönderilemedi.',
    });
  }
}

async function listWhatsappLogsHandler(req, res) {
  const limit = req.query.limit ? Number(req.query.limit) : 50;

  try {
    const data = whatsappService.getLastLogs(limit);
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[WHATSAPP][LOGS] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'WHATSAPP_LOGS_FAILED',
      message: err.message || 'WhatsApp logları alınamadı.',
    });
  }
}

module.exports = {
  sendTestWhatsappHandler,
  sendWhatsappForLeadHandler,
  listWhatsappLogsHandler,
};