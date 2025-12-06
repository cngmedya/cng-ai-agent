// backend-v2/src/modules/leadDashboard/controller.js
const { getLeadAiDashboard } = require('./service');

async function leadAiDashboardHandler(req, res, next) {
  try {
    const { id } = req.params;

    const data = await getLeadAiDashboard({ leadId: id });

    res.json({
      ok: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

exports.getAIDashboard = async (req, res, next) => {
  try {
    const data = await service.getLeadAiDashboard({
      leadId: req.params.leadId,
    });

    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  leadAiDashboardHandler
};