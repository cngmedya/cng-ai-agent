// backend-v2/src/modules/leadDashboard/service.js
const { getLeadById } = require('./repo');
const { analyzeLead } = require('../intel/service');
const { generateFirstContact } = require('../outreach/service');

/**
 * Tek endpoint ile:
 * - lead temel bilgisi
 * - basit intel analizi
 * - 2 farklı outreach mesajı (whatsapp TR premium + email TR kurumsal)
 */
async function getLeadAiDashboard({ leadId }) {
  const id = Number(leadId);
  if (!id || Number.isNaN(id)) {
    throw new Error('Geçerli bir leadId zorunlu.');
  }

  const lead = getLeadById(id);
  if (!lead) {
    throw new Error(`Lead bulunamadı: id=${id}`);
  }

  // 1) Hızlı intel (deep olmayan)
  const intelResult = await analyzeLead({ leadId: id });

  // 2) Outreach mesajları
  const whatsappMsg = await generateFirstContact({
    leadId: id,
    channel: 'whatsapp',
    tone: 'premium',
    language: 'tr'
  });

  const emailKurumsalMsg = await generateFirstContact({
    leadId: id,
    channel: 'email',
    tone: 'kurumsal',
    language: 'tr'
  });

  return {
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
      ai_notes: lead.ai_notes,
      website: lead.website
    },
    intel: intelResult.intel,
    outreach: {
      whatsapp_tr_premium: {
        subject: whatsappMsg.subject,
        message: whatsappMsg.message
      },
      email_tr_kurumsal: {
        subject: emailKurumsalMsg.subject,
        message: emailKurumsalMsg.message
      }
    }
  };
}

module.exports = {
  getLeadAiDashboard
};