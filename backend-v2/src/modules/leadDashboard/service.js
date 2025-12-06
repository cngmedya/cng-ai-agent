// backend-v2/src/modules/leadDashboard/service.js

const { getLeadById } = require('./repo');
const intelService = require('../intel/service');
const researchService = require('../research/service/researchService');
const crmService = require('../crm/service/crmBrainService');
const outreachService = require('../outreach/service');

async function getLeadAiDashboard({ leadId }) {
  const id = Number(leadId);
  if (!id || Number.isNaN(id)) {
    throw new Error("Geçerli leadId zorunludur.");
  }

  // 1) Lead
  const lead = getLeadById(id);
  if (!lead) {
    throw new Error(`Lead bulunamadı: ${id}`);
  }

  // 2) Intel
  const intelBasic = await intelService.analyzeLead({ leadId: id });

  let intelDeep = null;
  try {
    intelDeep = await intelService.analyzeLeadDeep({ leadId: id });
  } catch (_) {}

  // 3) Research / CIR (getLatestCIR → yeni ekledik)
  const latestCIR = researchService.getLatestCIR(id);

  // 4) CRM Brain (GERÇEK FONKSİYON → getLeadBrain)
  const crmBrain = await crmService.getLeadBrain(id);

  // 5) Outreach v1
  const whatsappPremium = await outreachService.generateFirstContact({
    leadId: id,
    channel: "whatsapp",
    tone: "premium",
    language: "tr"
  });

  const emailKurumsal = await outreachService.generateFirstContact({
    leadId: id,
    channel: "email",
    tone: "kurumsal",
    language: "tr"
  });

  // 6) Outreach v2 – Multi-step sequence
  let outreachSeq = null;
  try {
    outreachSeq = await outreachService.generateSequenceForLead({
      leadId: id,
      channel: "whatsapp",
      tone: "kurumsal",
      language: "tr",
      objective: "ilk_temas",
      max_followups: 2
    });
  } catch (err) {
    console.error("[AI Dashboard] Outreach sequence hata:", err.message);
  }

  // 7) Final full brain JSON
  return {
    lead,
    intel: {
      basic: intelBasic.intel,
      deep: intelDeep ? intelDeep.intel : null
    },
    research: latestCIR,   // ← FULL CIR buraya geliyor
    crm: crmBrain,         // ← Başlıklar + riskler + aksiyon önerileri
    outreach: {
      whatsapp_tr_premium: whatsappPremium,
      email_tr_kurumsal: emailKurumsal,
      whatsapp_sequence_tr_kurumsal: outreachSeq
    }
  };
}

module.exports = {
  getLeadAiDashboard
};