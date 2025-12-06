// backend-v2/src/modules/research/service/researchService.js

const { getDb } = require('../../../core/db');
const { chatJson } = require('../../../shared/ai/llmClient');

// Ek analiz modülleri
const { runWebSearch } = require('./websearchService');
const { detectSocials } = require('./socialsService');
const { analyzeAds } = require('./adsService');
const { findCompetitors } = require('./competitorsService');
const { benchmarkLead } = require('./benchmarkService');

// Intel modülü
const intel = require('../../intel/service');

function getLeadById(leadId) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM potential_leads WHERE id = ?`).get(leadId);
  if (!row) throw new Error(`Lead bulunamadı (id=${leadId})`);
  return row;
}

/**
 * DB kayıt
 */
function saveCIRToDb(leadId, cir, payload, overallScore) {
  const db = getDb();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO lead_cir_reports (lead_id, report_json, raw_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    leadId,
    JSON.stringify(cir ?? {}),
    JSON.stringify(payload ?? {}),
    createdAt
  );

  if (typeof overallScore === 'number') {
    db.prepare(`
      UPDATE potential_leads
      SET last_cir_score = ?, last_cir_created_at = ?
      WHERE id = ?
    `).run(overallScore, createdAt, leadId);
  }

  return { createdAt };
}

/**
 * FULL PIPELINE
 */
async function generateFullResearch({ leadId }) {
  const startedAt = Date.now();
  console.log(`[research/full-report] ▶️ STARTED (leadId=${leadId})`);

  const lead = getLeadById(leadId);

  // 1) intel basic
  let intelBasic = null;
  try {
    intelBasic = await intel.analyzeLead({ leadId });
  } catch (e) {
    console.error('[research] Basic intel hata:', e.message);
  }

  // 2) intel deep
  let intelDeep = null;
  if (lead.website) {
    try {
      intelDeep = await intel.analyzeLeadDeep({ leadId });
    } catch (e) {
      console.error('[research] Deep intel hata:', e.message);
    }
  }

  // 3) web search
  let webPresence = null;
  try {
    webPresence = await runWebSearch(lead);
  } catch (e) {
    console.error('[research] Web search hata:', e.message);
  }

  // 4) socials
  let socialPresence = null;
  try {
    socialPresence = await detectSocials(lead, webPresence);
  } catch (e) {
    console.error('[research] Socials hata:', e.message);
  }

  // 5) ads
  let adIntel = null;
  try {
    adIntel = await analyzeAds(lead, webPresence);
  } catch (e) {
    console.error('[research] Ads hata:', e.message);
  }

  // 6) competitors
  let competitors = null;
  try {
    competitors = await findCompetitors(lead, webPresence);
  } catch (e) {
    console.error('[research] Competitors hata:', e.message);
  }

  // 7) benchmark
  let benchmark = null;
  try {
    // benchmarkLead imzası: (lead, competitorsArray)
    benchmark = benchmarkLead(lead, Array.isArray(competitors) ? competitors : []);
  } catch (e) {
    console.error('[research] Benchmark hata:', e.message);
  }

  // 8) LLM → CIR üretimi
  const payload = {
    lead,
    intel_basic: intelBasic,
    intel_deep: intelDeep,
    web_presence: webPresence,
    social_presence: socialPresence,
    ad_intel: adIntel,
    competitors,
    benchmark
  };

  const aiResponse = await chatJson({
    system:
      'You are CNG Medya için kurumsal B2B istihbarat motoru. Sadece geçerli JSON döndür.',
    user: JSON.stringify({
      task: 'cng_intelligence_report_v2',
      ...payload
    }),
    model: 'gpt-4.1-mini'
  });

  if (!aiResponse.ok) {
    const duration = (Date.now() - startedAt) / 1000;
    console.error(
      `[research/full-report] ❌ ERROR (leadId=${leadId}, duration=${duration.toFixed(
        2
      )}s):`,
      aiResponse.raw
    );
    throw new Error(aiResponse.error || 'CIR modeli JSON formatında cevap vermedi');
  }

  const cir = aiResponse.json;

  const overallScore =
    cir?.CNG_Intelligence_Report?.priority_score ??
    cir?.priority_score ??
    cir?.overall_score ??
    null;

  saveCIRToDb(leadId, cir, payload, overallScore);

  const duration = (Date.now() - startedAt) / 1000;
  console.log(
    `[research/full-report] ✅ OK (leadId=${leadId}, duration=${duration.toFixed(
      2
    )}s, score=${overallScore ?? 'n/a'})`
  );

  return { leadId, leadName: lead.name, cir, raw: payload };
}

/**
 * Son CIR kaydını DB'den çeker ve dashboard / CRM için normalize eder.
 * NOT: Bu fonksiyon sadece okuma yapar, yeni CIR üretmez.
 */
function getLatestCIR(leadId) {
  const id = Number(leadId);
  if (!id || Number.isNaN(id)) {
    throw new Error('[research/getLatestCIR] Geçerli bir leadId zorunlu.');
  }

  const db = getDb();

  const row = db
    .prepare(
      `
      SELECT
        id,
        lead_id,
        report_json,
        raw_json,
        created_at
      FROM lead_cir_reports
      WHERE lead_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 1
    `
    )
    .get(id);

  if (!row) {
    return {
      exists: false,
      last_cir_created_at: null,
      priority_score: null,
      sales_notes: null,
      cir_json: null
    };
  }

  let cirJson = null;
  try {
    cirJson = row.report_json ? JSON.parse(row.report_json) : null;
  } catch (err) {
    console.warn('[research/getLatestCIR] report_json parse hatası:', err.message);
  }

  const cir = cirJson || {};

  const priorityScore =
    cir?.CNG_Intelligence_Report?.priority_score ??
    cir?.priority_score ??
    cir?.overall_score ??
    null;

  const salesNotes =
    cir?.CNG_Intelligence_Report?.notes_for_sales ?? cir?.notes_for_sales ?? null;

  return {
    exists: true,
    last_cir_created_at: row.created_at,
    priority_score: priorityScore,
    sales_notes: salesNotes,
    cir_json: cir
  };
}

module.exports = {
  generateFullResearch,
  getLatestCIR
};