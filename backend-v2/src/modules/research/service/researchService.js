const { getDb } = require('../../../core/db');
const { chatJson } = require('../../../shared/ai/llmClient');

// Ek analiz modülleri
const { runWebSearch } = require('./websearchService');
const { detectSocials } = require('./socialsService');
const { analyzeAds } = require('./adsService');
const { findCompetitors } = require('./competitorsService');
const { benchmarkLead } = require('./benchmarkService');

// Intel modülü (basic + deep)
const intel = require('../../intel/service');

/* -------------------------------------------------------
   LEAD GETTER
------------------------------------------------------- */
function getLeadById(id) {
  const db = getDb();
  return db.prepare(`SELECT * FROM potential_leads WHERE id = ? LIMIT 1`).get(id);
}

/* -------------------------------------------------------
   SAVE CIR TO DB
------------------------------------------------------- */
function saveCIRToDb({ leadId, cir, raw }) {
  const db = getDb();

  // CIR geçmişine kaydet
  db.prepare(`
    INSERT INTO lead_cir_reports (lead_id, report_json, raw_json, created_at)
    VALUES (@lead_id, @report_json, @raw_json, @created_at)
  `).run({
    lead_id: leadId,
    report_json: JSON.stringify(cir),
    raw_json: JSON.stringify(raw),
    created_at: new Date().toISOString()
  });

  // potential_leads güncelle
  const cirScore = cir?.cng_recommendation?.overall_score ?? null;

  db.prepare(`
    UPDATE potential_leads
    SET 
      last_cir_score = @cirScore,
      last_cir_created_at = @createdAt
    WHERE id = @id
  `).run({
    cirScore,
    createdAt: new Date().toISOString(),
    id: leadId
  });
}

/* -------------------------------------------------------
   RESEARCH MASTER PROMPT
------------------------------------------------------- */
const RESEARCH_MASTER_PROMPT = `
Sen CNG AI Agent için çalışan üst seviye bir "CNG Intelligence Engine"sın.

Elindeki veri kaynakları:
1) lead
2) intel_basic
3) intel_deep
4) web_presence
5) social_presence
6) ad_intel
7) competitors
8) benchmark

Bu sekiz kaynağı birleştirerek tam profesyonel bir
"CNG Intelligence Report (CIR)" üret.

Çıktı geçerli JSON olmak zorunda.
`;

/* -------------------------------------------------------
   FULL CIR PIPELINE
------------------------------------------------------- */
async function generateFullResearch({ leadId }) {
  const id = Number(leadId);
  if (!id) throw new Error('Geçerli leadId zorunlu.');

  const lead = getLeadById(id);
  if (!lead) throw new Error(`Lead bulunamadı: ${id}`);

  /* 1) Intel Basic */
  let intel_basic = null;
  try {
    const res = await intel.analyzeLead({ leadId: id });
    intel_basic = res.intel;
  } catch (err) {
    console.warn('[research] Basic intel hata:', err.message);
  }

  /* 2) Intel Deep */
  let intel_deep = null;
  if (lead.website) {
    try {
      const res = await intel.analyzeLeadDeep({ leadId: id });
      intel_deep = res.intel;
    } catch (err) {
      console.warn('[research] Deep intel hata:', err.message);
    }
  }

  /* 3) Web search */
  const web_presence = await runWebSearch(lead);

  /* 4) Social */
  const social_presence = await detectSocials(lead);

  /* 5) Ads */
  const ad_intel = await analyzeAds(lead);

  /* 6) Competitors */
  const competitors = await findCompetitors(lead, web_presence);

  /* 7) Benchmark */
  const benchmark = await benchmarkLead(lead, competitors);

  /* 8) AI → CIR */
  const payload = {
    lead,
    intel_basic,
    intel_deep,
    web_presence,
    social_presence,
    ad_intel,
    competitors,
    benchmark
  };

  const cir = await chatJson({
    system: RESEARCH_MASTER_PROMPT,
    user: JSON.stringify(payload)
  });

  // 👉 CIR raporunu DB'ye kaydediyoruz
  saveCIRToDb({
    leadId: id,
    cir,
    raw: payload
  });

  return {
    leadId,
    leadName: lead.name,
    cir,
    raw: payload
  };
}

module.exports = {
  generateFullResearch
};