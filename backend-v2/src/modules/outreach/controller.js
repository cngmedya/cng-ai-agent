// backend-v2/src/modules/outreach/controller.js
const { generateFirstContact } = require('./service');

async function firstContactHandler(req, res, next) {
  try {
    const { leadId, channel, tone, language } = req.body;

    const data = await generateFirstContact({
      leadId,
      channel,
      tone,
      language
    });

    res.json({
      ok: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  firstContactHandler
};