// backend-v2/src/modules/intel/controller.js
const { analyzeLead, analyzeLeadDeep } = require('./service');

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

async function deepAnalyzeLeadHandler(req, res, next) {
  try {
    const { leadId } = req.body;

    const data = await analyzeLeadDeep({ leadId });

    res.json({
      ok: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  analyzeLeadHandler,
  deepAnalyzeLeadHandler
};