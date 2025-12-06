// src/modules/crm/api/controller.js

const { getLeadBrain } = require('../service/crmBrainService');

async function getLeadBrainHandler(req, res) {
  const { leadId } = req.params;

  try {
    const numericLeadId = Number(leadId);
    if (!numericLeadId || Number.isNaN(numericLeadId)) {
      return res.status(400).json({ ok: false, error: 'Geçersiz leadId.' });
    }

    const brain = await getLeadBrain(numericLeadId);

    return res.json({
      ok: true,
      data: brain
    });
  } catch (err) {
    console.error('[crm/getLeadBrain] hata:', err);

    if (err && err.code === 'LEAD_NOT_FOUND') {
      return res.status(404).json({ ok: false, error: 'Lead bulunamadı.' });
    }

    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getLeadBrainHandler
};