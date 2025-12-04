// backend-v2/src/modules/discovery/aiRanker.js
const { chatJson } = require('../../shared/ai/llmClient');
const { loadPrompt } = require('../../shared/ai/promptLoader');

const rankPrompt = loadPrompt('lead/ai_rank_lead.md');

/**
 * Tek bir lead için AI skorlaması yapar.
 * lead: DB'den gelen satır (id, name, address, category, google_rating, google_user_ratings_total, source vs.)
 */
async function rankLeadWithAI(lead) {
  const system = rankPrompt;
  const user = JSON.stringify({
    name: lead.name,
    address: lead.address,
    category: lead.category,
    google_rating: lead.google_rating,
    google_user_ratings_total: lead.google_user_ratings_total,
    source: lead.source
  });

  const result = await chatJson({ system, user });

  return {
    ai_category: result.ai_category || null,
    ai_score: typeof result.ai_score === 'number' ? result.ai_score : null,
    ai_notes: result.ai_notes || null
  };
}

module.exports = {
  rankLeadWithAI
};