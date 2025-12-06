// backend-v2/src/modules/outreach/controller.js
const {
  generateFirstContact,
  generateSequenceForLead
} = require('./service'); // v1 + v2  [oai_citation:0‡controller.js](sediment://file_00000000775071f483d36d24e69c4280)

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

async function outreachSequenceHandler(req, res, next) {
  try {
    const { leadId } = req.params;
    const {
      channel,
      tone,
      language,
      objective,
      max_followups
    } = req.body || {};

    const data = await generateSequenceForLead({
      leadId,
      channel,
      tone,
      language,
      objective,
      max_followups
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
  firstContactHandler,
  outreachSequenceHandler
};