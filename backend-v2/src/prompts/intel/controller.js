// backend-v2/src/modules/intel/controller.js
const { analyzeLead } = require('./service');

async function analyzeLeadHandler(req, res, next) {
  try {
    const { leadId } = req.body;

    const data = await analyzeLead({ leadId });

    res.json({
      ok: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  analyzeLeadHandler
};