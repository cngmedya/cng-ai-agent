const crmBrainService = require('../../crm/service/crmBrainService');

async function getLeadBrain(leadId) {
  const id = Number(leadId);

  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Geçersiz leadId');
    err.code = 'INVALID_LEAD_ID';
    throw err;
  }

  const brain = await crmBrainService.getLeadBrain(id);

  if (!brain) {
    const err = new Error('Bu lead için brain bulunamadı');
    err.code = 'BRAIN_NOT_FOUND';
    throw err;
  }

  return brain;
}

async function getLeadBrainSummary(leadId) {
  const brain = await getLeadBrain(leadId);

  const lead = brain.lead || {};
  const aiScoreBand = brain.ai_score_band || null;
  const cir = brain.cir || {};
  const cirPriority =
    cir.priority_score ??
    (cir.raw && cir.raw.priority_score) ??
    null;

  const summaryBlock =
    brain.summary &&
    brain.summary.json &&
    brain.summary.json.lead_brain_summary
      ? brain.summary.json.lead_brain_summary
      : null;

  const summary = summaryBlock || {};

  return {
    lead_id: lead.id ?? null,
    lead_name: lead.name ?? null,
    city: lead.city ?? null,
    country: lead.country ?? null,
    category: lead.category ?? null,
    ai_score_band: aiScoreBand,
    priority_score: cirPriority,
    headline: summary.headline ?? null,
    one_line_positioning: summary.one_line_positioning ?? null,
    why_now: summary.why_now ?? null,
    risk_level: summary.risk_level ?? null,
    ideal_entry_channel: summary.ideal_entry_channel ?? null,
    recommended_next_actions: summary.recommended_next_actions ?? [],
  };
}

module.exports = {
  getLeadBrain,
  getLeadBrainSummary,
};