// backend-v2/src/modules/outreach/service.js
const { getLeadById } = require('./repo');
const { chatJson } = require('../../shared/ai/llmClient');
const { loadPrompt } = require('../../shared/ai/promptLoader');

const firstContactPrompt = loadPrompt('outreach/first_contact_message.md');

async function generateFirstContact({ leadId, channel, tone, language }) {
  const id = Number(leadId);
  if (!id || Number.isNaN(id)) {
    throw new Error('Geçerli bir leadId zorunlu.');
  }

  const lead = getLeadById(id);
  if (!lead) {
    throw new Error(`Lead bulunamadı: id=${id}`);
  }

  const system = firstContactPrompt;
  const user = JSON.stringify({
    name: lead.name,
    address: lead.address,
    ai_category: lead.ai_category,
    ai_score: lead.ai_score,
    ai_notes: lead.ai_notes,
    channel: channel || 'whatsapp',
    tone: tone || 'premium',
    language: language || 'tr'
  });

  const result = await chatJson({ system, user });

  return {
    leadId: lead.id,
    leadName: lead.name,
    channel: channel || 'whatsapp',
    tone: tone || 'premium',
    language: language || 'tr',
    subject: result.subject || null,
    message: result.message
  };
}

module.exports = {
  generateFirstContact
};