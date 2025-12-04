// backend-v2/src/modules/intel/service.js
const { getLeadById } = require('./repo');
const { chatJson } = require('../../shared/ai/llmClient');
const { loadPrompt } = require('../../shared/ai/promptLoader');

const intelPrompt = loadPrompt('intel/lead_intel_analysis.md');

async function analyzeLead({ leadId }) {
  const id = Number(leadId);
  if (!id || Number.isNaN(id)) {
    throw new Error('Geçerli bir leadId zorunlu.');
  }

  const lead = getLeadById(id);
  if (!lead) {
    throw new Error(`Lead bulunamadı: id=${id}`);
  }

  const system = intelPrompt;
  const user = JSON.stringify({
    id: lead.id,
    name: lead.name,
    address: lead.address,
    city: lead.city,
    country: lead.country,
    category: lead.category,
    google_rating: lead.google_rating,
    google_user_ratings_total: lead.google_user_ratings_total,
    ai_category: lead.ai_category,
    ai_score: lead.ai_score,
    ai_notes: lead.ai_notes
  });

  const result = await chatJson({ system, user });

  return {
    leadId: lead.id,
    leadName: lead.name,
    intel: result
  };
}

module.exports = {
  analyzeLead
};