// backend-v2/src/modules/intel/service.js
const { getLeadById } = require('./repo');
const { chatJson } = require('../../shared/ai/llmClient');
const { loadPrompt } = require('../../shared/ai/promptLoader');
const { fetchWebsiteSnapshot } = require('../../shared/web/fetchWebsite');
const { analyzeOnPageSeo } = require('../../shared/seo/onpageAnalyzer');

const intelPrompt = loadPrompt('intel/lead_intel_analysis.md');
const deepIntelPrompt = loadPrompt('intel/lead_deep_website_analysis.md');


// --------------------------------------------------
// QUICK INTEL — SADECE LEAD DATA ÜZERİNDEN
// --------------------------------------------------
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



// --------------------------------------------------
// DEEP INTEL — WEBSITE + SEO ANALİZİ + DERİN SWOT
// --------------------------------------------------
async function analyzeLeadDeep({ leadId }) {
  const id = Number(leadId);
  if (!id || Number.isNaN(id)) {
    throw new Error('Geçerli bir leadId zorunlu.');
  }

  const lead = getLeadById(id);
  if (!lead) {
    throw new Error(`Lead bulunamadı: id=${id}`);
  }

  if (!lead.website) {
    throw new Error(`Lead için website alanı boş: id=${id}`);
  }

  // 1) Website snapshot (fetch fail olsa bile error objesi dönecek)
  const websiteSnapshot = await fetchWebsiteSnapshot(lead.website);

  // 2) On-page SEO analizi (title/meta/h1/keyword match)
  const seoOnPage = analyzeOnPageSeo({
    websiteSnapshot,
    lead
  });

  // 3) Deep intel için prompt'a tüm veriyi gönder
  const system = deepIntelPrompt;
  const user = JSON.stringify({
    lead: {
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
    },
    website: websiteSnapshot,
    seo_onpage: seoOnPage
  });

  const result = await chatJson({ system, user });

  return {
    leadId: lead.id,
    leadName: lead.name,
    website: websiteSnapshot.url,
    websiteError: websiteSnapshot.error || null,
    intel: result
  };
}



module.exports = {
  analyzeLead,
  analyzeLeadDeep
};