// backend-v2/src/modules/email/controller.js
const emailService = require('./service');

async function sendTestEmailHandler(req, res) {
  try {
    const payload = req.body || {};

    const result = await emailService.sendTestEmail(payload);

    res.json({
      ok: true,
      data: result,
    });
  } catch (err) {
    console.error('[EMAIL][TEST] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'EMAIL_TEST_FAILED',
      message: err.message || 'Email test sırasında bir hata oluştu.',
    });
  }
}

async function sendLeadEmailHandler(req, res) {
  try {
    const { leadId } = req.params;
    const payload = req.body || {};

    if (!leadId || Number.isNaN(Number(leadId))) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_LEAD_ID',
        message: 'Geçerli bir leadId zorunlu.',
      });
    }

    const result = await emailService.sendEmailForLead({
      leadId: Number(leadId),
      payload,
    });

    res.json({
      ok: true,
      data: result,
    });
  } catch (err) {
    console.error('[EMAIL][SEND_FOR_LEAD] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'EMAIL_SEND_FOR_LEAD_FAILED',
      message: err.message || 'Lead için email loglanırken hata oluştu.',
    });
  }
}

module.exports = {
  sendTestEmailHandler,
  sendLeadEmailHandler,
};