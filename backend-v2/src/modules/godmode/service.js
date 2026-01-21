// backend-v2/src/modules/godmode/service.js

const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { runDiscoveryProviders, healthCheckProviders } = require('./providers/providersRunner');

const {
  loadAllJobs,
  insertJob,
  updateJob,
  getJobById: getJobFromDb,
  appendJobLog,
  upsertPotentialLead,
  enqueueDeepEnrichmentCandidates,
  appendDeepEnrichmentStage,
  upsertDeepEnrichmentIntoPotentialLead,
  insertAiArtifact,
} = require('./repo');

const llmClient = require('../../shared/ai/llmClient');
const leadRankingPrompt = require('./ai/leadRanking.prompt');
const leadRankingSchema = require('./ai/leadRanking.schema');
const autoSwotPrompt = require('./ai/autoSwot.prompt');
const autoSwotSchema = require('./ai/autoSwot.schema');
const outreachDraftPrompt = require('./ai/outreachDraft.prompt');
const outreachDraftSchema = require('./ai/outreachDraft.schema');
const salesEntryStrategyPrompt = require('./ai/salesEntryStrategy.prompt');
const salesEntryStrategySchema = require('./ai/salesEntryStrategy.schema');
let channelStrategyPrompt = null;
let channelStrategySchema = null;

try {
  channelStrategyPrompt = require('./ai/channelStrategy.prompt');
} catch {}

try {
  channelStrategySchema = require('./ai/channelStrategy.schema');
} catch {}

const { brainService, outreachTriggerService } = require('./services');

function resolveDiscoveryMode() {
  const raw = process.env.GODMODE_DISCOVERY_MODE;
  if (!raw) return 'replay';

  const v = String(raw).toLowerCase();
  if (v === '1' || v === 'live' || v === 'true') return 'live';
  if (v === 'mock') return 'mock';
  return 'replay';
}

/**
 * In-memory job store (v1.x) + SQLite sync
 */
const jobs = new Map();

const FRESHNESS_WINDOW_HOURS = Number(
  process.env.GODMODE_FRESHNESS_WINDOW_HOURS || 168,
);
const RESCAN_AFTER_HOURS = Number(process.env.GODMODE_RESCAN_AFTER_HOURS || 720); // 30 days
const RESCAN_SCANCOUNT_CAP = Number(process.env.GODMODE_RESCAN_SCANCOUNT_CAP || 10);

// FAZ 2.D Deep Enrichment gating + observability flags
const ENABLE_DEEP_ENRICHMENT = process.env.GODMODE_DEEP_ENRICHMENT === '1';
const DEEP_ENRICHMENT_SOURCES = (process.env.GODMODE_DEEP_ENRICHMENT_SOURCES || 'website,tech,seo,social')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const COLLECT_DEEP_ENRICHMENT_IDS =
  process.env.GODMODE_DEEP_ENRICHMENT_COLLECT_IDS != null
    ? process.env.GODMODE_DEEP_ENRICHMENT_COLLECT_IDS === '1'
    : true;
const DEEP_ENRICHMENT_IDS_CAP = Number(process.env.GODMODE_DEEP_ENRICHMENT_IDS_CAP || 200);

const DEEP_ENRICHMENT_QUEUE_CHUNK = Number(process.env.GODMODE_DEEP_ENRICHMENT_QUEUE_CHUNK || 50);
// FAZ 4.C — Outreach auto-trigger flag (enqueue only)
const ENABLE_OUTREACH_AUTO_TRIGGER = process.env.GODMODE_OUTREACH_AUTO_TRIGGER === '1';

/**
 * DISCOVERY MODE (server process)
 * - 0 / replay / mock => no external calls (DB replay provider)
 * - 1 / live / true   => real Google Places
 */
function isLiveDiscoveryMode() {
  return resolveDiscoveryMode() === 'live';
}

function getDiscoveryModeLabel() {
  return resolveDiscoveryMode();
}

/**
 * Roadmap / faz durumu
 */
function getRoadmapPhases() {
  return {
    phase1_core_bootstrap: 'done', // job modeli, run flow, mock + live engine
    phase2_data_pipelines: 'pending', // multi-provider discovery + enrichment
    phase3_brain_integration: 'pending',
    phase4_automation: 'pending',
  };
}

/**
 * INTERNAL: Job event log helper
 */
function logJobEvent(jobId, eventType, payload) {
  try {
    appendJobLog(jobId, eventType, payload || null);
  } catch (err) {
    // Observability failure, işin akışını bozmamalı
    console.error(
      '[GODMODE][JOB_LOG][ERROR]',
      eventType,
      'jobId=',
      jobId,
      err.message || err,
    );
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateLeadRankingOutput(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'NOT_OBJECT' };

  const band = obj.ai_score_band;
  const score = obj.priority_score;
  const why = obj.why_now;
  const ch = obj.ideal_entry_channel;

  const bandOk = band === 'A' || band === 'B' || band === 'C';
  const scoreOk = typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
  const whyOk = typeof why === 'string' && why.trim().length >= 5 && why.trim().length <= 240;
  const chOk = ch === 'email' || ch === 'whatsapp' || ch === 'instagram' || ch === 'phone';

  if (!bandOk) return { ok: false, reason: 'BAD_BAND' };
  if (!scoreOk) return { ok: false, reason: 'BAD_SCORE' };
  if (!whyOk) return { ok: false, reason: 'BAD_WHY_NOW' };
  if (!chOk) return { ok: false, reason: 'BAD_CHANNEL' };

  return { ok: true };
}

function heuristicLeadRanking(input) {
  const websiteMissing = input && input.website_missing === true;
  const rating = Number.isFinite(Number(input.rating)) ? Number(input.rating) : 0;
  const reviews = Number.isFinite(Number(input.user_ratings_total)) ? Number(input.user_ratings_total) : 0;

  const oppScore = Number.isFinite(Number(input.opportunity_score))
    ? Number(input.opportunity_score)
    : null;

  let score = 0;

  // Biggest sales opportunity in this agency context: no-website / weak digital presence
  if (websiteMissing) score += 45;

  // Opportunity score from enrichment (0..100) if present
  if (oppScore != null) score += Math.round(oppScore * 0.4);

  // Social proof: rating + reviews
  if (rating >= 4.3) score += 10;
  if (reviews >= 200) score += 10;
  else if (reviews >= 50) score += 6;

  // Freshness / intent
  const forceRefresh =
    input && (input.force_refresh === true || input.forceRefresh === true);
  if (forceRefresh) score += 20;

  // Scan fatigue guard (if high scan_count, reduce urgency)
  const sc = Number.isFinite(Number(input.scan_count_after)) ? Number(input.scan_count_after) : 1;
  if (sc >= 8) score -= 10;
  if (sc >= 12) score -= 20;

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  let band = 'C';
  if (score >= 65) band = 'A';
  else if (score >= 35) band = 'B';

  const whyNow =
    band === 'A'
      ? websiteMissing
        ? 'Web sitesi yok; hızlı teklif + dönüşüm fırsatı yüksek.'
        : 'Dijital sinyaller zayıf; hızlı iyileştirme ile yüksek kazanım.'
      : band === 'B'
        ? websiteMissing
          ? 'Web sitesi yok; uygun zamanda giriş yapılabilir.'
          : 'Orta seviye fırsat; doğru kanal ile denenebilir.'
        : websiteMissing
          ? 'Web sitesi yok ama öncelik düşük; listeye alın.'
          : 'Sinyaller zayıf; şu an düşük öncelik.';

  const idealChannel = (() => {
    // Very rough: if website missing, WhatsApp/phone tends to be fastest
    if (websiteMissing) return 'whatsapp';
    // Otherwise default to email for structured outreach
    return 'email';
  })();

  return {
    ai_score_band: band,
    priority_score: score,
    why_now: whyNow,
    ideal_entry_channel: idealChannel,
    _source: 'heuristic_v1',
  };
}

async function callLeadRankingLLM(input) {
  const system = (leadRankingPrompt && leadRankingPrompt.system) ? String(leadRankingPrompt.system) : '';
  const userBase = (leadRankingPrompt && leadRankingPrompt.user) ? String(leadRankingPrompt.user) : '';
  const user = `${userBase}\n\nINPUT_JSON:\n${JSON.stringify(input)}`;

  // Try common llmClient interfaces (best-effort, backward compatible)
  if (llmClient && typeof llmClient.chatJson === 'function') {
    return llmClient.chatJson({
      system,
      user,
      schema: leadRankingSchema,
    });
  }

  if (llmClient && typeof llmClient.completeJson === 'function') {
    return llmClient.completeJson({
      system,
      user,
      schema: leadRankingSchema,
    });
  }

  if (llmClient && typeof llmClient.chat === 'function') {
    const text = await llmClient.chat({ system, user });
    const parsed = typeof text === 'string' ? safeJsonParse(text) : text;
    return parsed;
  }

  throw new Error('LLM_CLIENT_INTERFACE_NOT_FOUND');
}

async function rankLead(input) {
  const useLlm = process.env.GODMODE_AI_LEAD_RANKING === '1';

  if (!useLlm) {
    return heuristicLeadRanking(input);
  }

  try {
    const out = await callLeadRankingLLM(input);
    const validated = validateLeadRankingOutput(out);
    if (validated.ok) return { ...out, _source: 'llm_v1' };

    // If LLM returned invalid shape, fall back
    return { ...heuristicLeadRanking(input), _source: 'heuristic_fallback_invalid_llm' };
  } catch (err) {
    return { ...heuristicLeadRanking(input), _source: 'heuristic_fallback_llm_error', _llm_error: String(err.message || err) };
  }
}

function validateAutoSwotOutput(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'NOT_OBJECT' };

  const arr2 = (v) => Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'string' && x.trim().length >= 3 && x.trim().length <= 120);

  const strengthsOk = arr2(obj.strengths);
  const weaknessesOk = arr2(obj.weaknesses);
  const opportunitiesOk = arr2(obj.opportunities);
  const threatsOk = arr2(obj.threats);

  const salesAngleOk = typeof obj.sales_angle === 'string' && obj.sales_angle.trim().length >= 10 && obj.sales_angle.trim().length <= 240;
  const conf = obj.confidence_level;
  const confOk = conf === 'high' || conf === 'medium' || conf === 'low';

  if (!strengthsOk) return { ok: false, reason: 'BAD_STRENGTHS' };
  if (!weaknessesOk) return { ok: false, reason: 'BAD_WEAKNESSES' };
  if (!opportunitiesOk) return { ok: false, reason: 'BAD_OPPORTUNITIES' };
  if (!threatsOk) return { ok: false, reason: 'BAD_THREATS' };
  if (!salesAngleOk) return { ok: false, reason: 'BAD_SALES_ANGLE' };
  if (!confOk) return { ok: false, reason: 'BAD_CONFIDENCE' };

  return { ok: true };
}

function heuristicAutoSwot(input) {
  const name = input && input.name ? String(input.name) : null;
  const websiteMissing = input && input.website_missing === true;
  const band = input && input.ai_score_band ? String(input.ai_score_band) : 'C';
  const score = Number.isFinite(Number(input && input.priority_score)) ? Number(input.priority_score) : 0;

  const strengths = [
    'Yerel pazarda görünürlük sinyali var.',
    'Hızlı iletişime uygun bir hizmet kategorisinde.',
  ];

  const weaknesses = websiteMissing
    ? ['Web sitesi yok; dijital güven ve dönüşüm zayıf.', 'Online kanallarda tutarsız görünüm riski var.']
    : ['Dijital performans sinyalleri net değil.', 'Dönüşüm altyapısı iyileştirmeye açık.'];

  const opportunities = websiteMissing
    ? ['Hızlı web sitesi + Google görünürlük paketi için güçlü fırsat.', 'Rakiplere göre hızlı konumlanma yapılabilir.']
    : ['SEO/teknik iyileştirme ile kısa vadede kazanım.', 'Reklam + ölçümleme ile lead akışı artırılabilir.'];

  const threats = [
    'Fiyat odaklı rekabet ve düşük bütçe itirazı gelebilir.',
    'Karar vericiye erişim gecikebilir; takip gerekir.',
  ];

  const salesAngle =
    band === 'A'
      ? (websiteMissing
          ? 'Web sitesi eksikliğini hızlı çözerek görünürlük ve güven kazancı üzerinden net bir teklif ile gir.'
          : 'Dijital performanstaki boşlukları 30 günlük hızlı kazanım planı ile somutlaştırıp teklif et.')
      : band === 'B'
        ? (websiteMissing
            ? 'Basit bir başlangıç paketiyle giriş yap; görünürlük + güveni hızlıca iyileştirmeyi hedefle.'
            : 'Ön keşif + küçük optimizasyonlarla değer gösterip sonraki adımı büyüt.')
        : 'Bu lead’i listeye al; daha güçlü sinyal oluşunca yeniden değerlendir.';

  const confidence =
    websiteMissing ? 'high'
      : score >= 70 ? 'medium'
      : 'low';

  return {
    strengths,
    weaknesses,
    opportunities,
    threats,
    sales_angle: salesAngle,
    confidence_level: confidence,
    _source: 'heuristic_v1',
    _meta: { name },
  };
}

async function callAutoSwotLLM(input) {
  const system = (autoSwotPrompt && autoSwotPrompt.system) ? String(autoSwotPrompt.system) : '';
  const userBase = (autoSwotPrompt && autoSwotPrompt.user) ? String(autoSwotPrompt.user) : '';
  const user = `${userBase}\n\nINPUT_JSON:\n${JSON.stringify(input)}`;

  if (llmClient && typeof llmClient.chatJson === 'function') {
    return llmClient.chatJson({
      system,
      user,
      schema: autoSwotSchema,
    });
  }

  if (llmClient && typeof llmClient.completeJson === 'function') {
    return llmClient.completeJson({
      system,
      user,
      schema: autoSwotSchema,
    });
  }

  if (llmClient && typeof llmClient.chat === 'function') {
    const text = await llmClient.chat({ system, user });
    const parsed = typeof text === 'string' ? safeJsonParse(text) : text;
    return parsed;
  }

  throw new Error('LLM_CLIENT_INTERFACE_NOT_FOUND');
}

async function generateAutoSwot(input) {
  const useLlm = process.env.GODMODE_AI_AUTO_SWOT === '1';

  if (!useLlm) {
    return heuristicAutoSwot(input);
  }

  try {
    const out = await callAutoSwotLLM(input);
    const validated = validateAutoSwotOutput(out);
    if (validated.ok) return { ...out, _source: 'llm_v1' };

    return { ...heuristicAutoSwot(input), _source: 'heuristic_fallback_invalid_llm' };
  } catch (err) {
    return { ...heuristicAutoSwot(input), _source: 'heuristic_fallback_llm_error', _llm_error: String(err.message || err) };
  }
}

function validateOutreachDraftOutput(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'NOT_OBJECT' };

  const ch = obj.suggested_channel;
  const msg = obj.opening_message;
  const cta = obj.cta;
  const lang = obj.language;
  const tone = obj.tone;
  const conf = obj.confidence_level;
  const subj = obj.subject;

  const chOk = ch === 'email' || ch === 'whatsapp' || ch === 'instagram_dm';
  const msgOk = typeof msg === 'string' && msg.trim().length >= 40 && msg.trim().length <= 800;
  const ctaOk = typeof cta === 'string' && cta.trim().length >= 6 && cta.trim().length <= 140;
  const langOk = lang === 'tr' || lang === 'en';
  const toneOk = tone === 'kurumsal' || tone === 'samimi' || tone === 'premium';
  const confOk = conf === 'high' || conf === 'medium' || conf === 'low';

  const subjOk =
    ch === 'email'
      ? (typeof subj === 'string' && subj.trim().length >= 6 && subj.trim().length <= 140)
      : (subj === null);

  if (!chOk) return { ok: false, reason: 'BAD_CHANNEL' };
  if (!subjOk) return { ok: false, reason: 'BAD_SUBJECT' };
  if (!msgOk) return { ok: false, reason: 'BAD_MESSAGE' };
  if (!ctaOk) return { ok: false, reason: 'BAD_CTA' };
  if (!langOk) return { ok: false, reason: 'BAD_LANGUAGE' };
  if (!toneOk) return { ok: false, reason: 'BAD_TONE' };
  if (!confOk) return { ok: false, reason: 'BAD_CONFIDENCE' };

  // personalization_hooks is optional, but if present enforce 0..3 strings
  if (obj.personalization_hooks != null) {
    const hooks = obj.personalization_hooks;
    const hooksOk =
      Array.isArray(hooks) &&
      hooks.length <= 3 &&
      hooks.every(x => typeof x === 'string' && x.trim().length >= 3 && x.trim().length <= 120);
    if (!hooksOk) return { ok: false, reason: 'BAD_HOOKS' };
  }

  return { ok: true };
}

function validateSalesEntryStrategyOutput(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'NOT_OBJECT' };

  const arr = (v, max) =>
    Array.isArray(v) &&
    v.length <= max &&
    v.every(x => typeof x === 'string' && x.trim().length >= 3 && x.trim().length <= 160);

  const channelOk =
    obj.ideal_channel === 'email' ||
    obj.ideal_channel === 'whatsapp' ||
    obj.ideal_channel === 'instagram' ||
    obj.ideal_channel === 'phone';

  const toneOk =
    obj.tone === 'kurumsal' ||
    obj.tone === 'samimi' ||
    obj.tone === 'premium';

  if (!channelOk) return { ok: false, reason: 'BAD_CHANNEL' };
  if (!toneOk) return { ok: false, reason: 'BAD_TONE' };
  if (!arr(obj.quick_wins, 4)) return { ok: false, reason: 'BAD_QUICK_WINS' };
  if (!arr(obj.red_flags, 3)) return { ok: false, reason: 'BAD_RED_FLAGS' };
  if (!arr(obj.next_steps, 4)) return { ok: false, reason: 'BAD_NEXT_STEPS' };

  return { ok: true };
}

function heuristicSalesEntryStrategy(input) {
  const websiteMissing = input && input.website_missing === true;
  const band = input && input.ai_score_band ? String(input.ai_score_band) : 'C';

  return {
    ideal_channel: websiteMissing ? 'whatsapp' : 'email',
    tone: band === 'A' ? 'premium' : 'kurumsal',
    quick_wins: websiteMissing
      ? ['Hızlı web varlık kontrolü', 'Google görünürlük boşluklarının listelenmesi']
      : ['SEO teknik tarama', 'Reklam & dönüşüm kontrolü'],
    red_flags: ['Bütçe itirazı', 'Karar vericiye erişim gecikmesi'],
    next_steps: [
      '10–15 dk keşif görüşmesi',
      'Mini audit paylaşımı',
      'Net teklif & zaman planı',
    ],
    _source: 'heuristic_v1',
  };
}

async function callSalesEntryStrategyLLM(input) {
  const system = salesEntryStrategyPrompt?.system ? String(salesEntryStrategyPrompt.system) : '';
  const userBase = salesEntryStrategyPrompt?.user ? String(salesEntryStrategyPrompt.user) : '';
  const user = `${userBase}\n\nINPUT_JSON:\n${JSON.stringify(input)}`;

  if (llmClient?.chatJson) {
    return llmClient.chatJson({ system, user, schema: salesEntryStrategySchema });
  }

  if (llmClient?.completeJson) {
    return llmClient.completeJson({ system, user, schema: salesEntryStrategySchema });
  }

  const text = await llmClient.chat({ system, user });
  return typeof text === 'string' ? safeJsonParse(text) : text;
}

async function generateSalesEntryStrategy(input) {
  const useLlm = process.env.GODMODE_AI_SALES_ENTRY === '1';

  if (!useLlm) {
    return heuristicSalesEntryStrategy(input);
  }

  try {
    const out = await callSalesEntryStrategyLLM(input);
    const validated = validateSalesEntryStrategyOutput(out);
    if (validated.ok) return { ...out, _source: 'llm_v1' };

    return { ...heuristicSalesEntryStrategy(input), _source: 'heuristic_fallback_invalid_llm' };
  } catch (err) {
    return {
      ...heuristicSalesEntryStrategy(input),
      _source: 'heuristic_fallback_llm_error',
      _llm_error: String(err.message || err),
    };
  }
}

function heuristicOutreachDraft(input) {
  const band = input && input.ai_score_band ? String(input.ai_score_band) : 'C';
  const websiteMissing = input && input.website_missing === true;
  const name = input && input.name ? String(input.name).trim() : 'Merhaba';
  const city = input && input.city ? String(input.city).trim() : null;

  const ideal = input && input.ideal_entry_channel ? String(input.ideal_entry_channel) : null;
  const suggestedChannel = (() => {
    if (ideal === 'whatsapp') return 'whatsapp';
    if (ideal === 'instagram' || ideal === 'instagram_dm') return 'instagram_dm';
    return 'email';
  })();

  const tone = band === 'A' ? 'premium' : band === 'B' ? 'kurumsal' : 'kurumsal';
  const language = 'tr';

  const subject = suggestedChannel === 'email'
    ? (websiteMissing ? 'Web sitesi + Google görünürlük için hızlı bir öneri' : 'Dijital görünürlük için hızlı bir öneri')
    : null;

  const hookBits = [];
  if (city) hookBits.push(city);
  if (websiteMissing) hookBits.push('web sitesi yok');

  const introLine = suggestedChannel === 'email'
    ? `Merhaba ${name},`
    : `Merhaba ${name},`;

  const contextLine = websiteMissing
    ? 'Kısa bir göz atışta web sitenizin olmadığını fark ettim; bu durum dijital güven ve dönüşüm tarafında fırsat yaratıyor.'
    : 'Kısa bir göz atışta dijital görünürlük tarafında hızlı iyileştirme fırsatları gördüm.';

  const angle = input && input.auto_swot && input.auto_swot.sales_angle
    ? String(input.auto_swot.sales_angle)
    : (websiteMissing
        ? 'İsterseniz 7–14 gün içinde hızlı bir “web + Google görünürlük” başlangıç paketi ile net kazanım sağlayabiliriz.'
        : 'İsterseniz 30 günlük hızlı kazanım planı ile ölçülebilir iyileştirme sağlayabiliriz.');

  const cta = suggestedChannel === 'whatsapp'
    ? 'Uygunsa buradan 10 dk yazışıp netleştirelim mi?'
    : 'Uygunsa 10–15 dk kısa bir görüşme ayarlayalım mı?';

  const opening = [
    introLine,
    city ? `${city} bölgesindeki işletmeler için dijital görünürlük tarafında kısa bir çalışma yapıyoruz.` : 'Dijital görünürlük tarafında kısa bir çalışma yapıyoruz.',
    contextLine,
    angle,
    '',
    cta,
  ].join('\n');

  return {
    suggested_channel: suggestedChannel,
    subject,
    opening_message: opening.trim(),
    cta,
    language,
    tone,
    personalization_hooks: hookBits.slice(0, 3),
    confidence_level: websiteMissing ? 'high' : band === 'A' ? 'medium' : 'low',
    _source: 'heuristic_v1',
  };
}

async function callOutreachDraftLLM(input) {
  const system = (outreachDraftPrompt && outreachDraftPrompt.system) ? String(outreachDraftPrompt.system) : '';
  const userBase = (outreachDraftPrompt && outreachDraftPrompt.user) ? String(outreachDraftPrompt.user) : '';
  const user = `${userBase}\n\nINPUT_JSON:\n${JSON.stringify(input)}`;

  if (llmClient && typeof llmClient.chatJson === 'function') {
    return llmClient.chatJson({
      system,
      user,
      schema: outreachDraftSchema,
    });
  }

  if (llmClient && typeof llmClient.completeJson === 'function') {
    return llmClient.completeJson({
      system,
      user,
      schema: outreachDraftSchema,
    });
  }

  if (llmClient && typeof llmClient.chat === 'function') {
    const text = await llmClient.chat({ system, user });
    const parsed = typeof text === 'string' ? safeJsonParse(text) : text;
    return parsed;
  }

  throw new Error('LLM_CLIENT_INTERFACE_NOT_FOUND');
}

async function generateOutreachDraft(input) {
  const useLlm = process.env.GODMODE_AI_OUTREACH_DRAFT === '1';

  if (!useLlm) {
    return heuristicOutreachDraft(input);
  }

  try {
    const out = await callOutreachDraftLLM(input);
    const validated = validateOutreachDraftOutput(out);
    if (validated.ok) return { ...out, _source: 'llm_v1' };

    return { ...heuristicOutreachDraft(input), _source: 'heuristic_fallback_invalid_llm' };
  } catch (err) {
    return { ...heuristicOutreachDraft(input), _source: 'heuristic_fallback_llm_error', _llm_error: String(err.message || err) };
  }
}

function validateChannelStrategyOutput(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'NOT_OBJECT' };

  const primary = obj.primary_channel;
  const fallbacks = obj.fallback_channels;
  const reasoning = obj.channel_reasoning;
  const conf = obj.confidence;

  const chOk =
    primary === 'email' ||
    primary === 'whatsapp' ||
    primary === 'instagram' ||
    primary === 'linkedin' ||
    primary === 'phone';

  const fallbacksOk =
    Array.isArray(fallbacks) &&
    fallbacks.length >= 1 &&
    fallbacks.length <= 4 &&
    fallbacks.every(x =>
      x === 'email' ||
      x === 'whatsapp' ||
      x === 'instagram' ||
      x === 'linkedin' ||
      x === 'phone',
    );

  const reasoningOk =
    typeof reasoning === 'string' &&
    reasoning.trim().length >= 12 &&
    reasoning.trim().length <= 260;

  const confOk = conf === 'low' || conf === 'medium' || conf === 'high';

  if (!chOk) return { ok: false, reason: 'BAD_PRIMARY_CHANNEL' };
  if (!fallbacksOk) return { ok: false, reason: 'BAD_FALLBACKS' };
  if (!reasoningOk) return { ok: false, reason: 'BAD_REASONING' };
  if (!confOk) return { ok: false, reason: 'BAD_CONFIDENCE' };

  return { ok: true };
}

function heuristicChannelStrategy(input) {
  const websiteMissing = input && input.website_missing === true;
  const band = input && input.ai_score_band ? String(input.ai_score_band) : 'C';

  if (websiteMissing) {
    return {
      primary_channel: 'whatsapp',
      fallback_channels: ['instagram', 'phone', 'email'],
      channel_reasoning:
        'Web sitesi yoksa en hızlı dönüş genelde WhatsApp/telefon ile alınır; Instagram ikinci temas kanalıdır, e-posta en sonda.',
      confidence: band === 'A' ? 'high' : 'medium',
      _source: 'heuristic_v1',
    };
  }

  return {
    primary_channel: 'email',
    fallback_channels: ['linkedin', 'whatsapp', 'phone'],
    channel_reasoning:
      'Web sitesi olan işletmelerde e-posta daha düzenli ve izlenebilir ilk temas sağlar; LinkedIn/WhatsApp/telefon alternatif kanallardır.',
    confidence: band === 'A' ? 'high' : 'medium',
    _source: 'heuristic_v1',
  };
}

async function callChannelStrategyLLM(input) {
  if (!channelStrategyPrompt || !channelStrategySchema) {
    throw new Error('CHANNEL_STRATEGY_PROMPT_OR_SCHEMA_MISSING');
  }

  const system = channelStrategyPrompt?.system ? String(channelStrategyPrompt.system) : '';
  const userBase = channelStrategyPrompt?.user ? String(channelStrategyPrompt.user) : '';
  const user = `${userBase}\n\nINPUT_JSON:\n${JSON.stringify(input)}`;

  if (llmClient?.chatJson) {
    return llmClient.chatJson({ system, user, schema: channelStrategySchema });
  }

  if (llmClient?.completeJson) {
    return llmClient.completeJson({ system, user, schema: channelStrategySchema });
  }

  const text = await llmClient.chat({ system, user });
  return typeof text === 'string' ? safeJsonParse(text) : text;
}

async function generateChannelStrategy(input) {
  const useLlm = process.env.GODMODE_AI_CHANNEL_STRATEGY === '1';

  if (!useLlm) {
    return heuristicChannelStrategy(input);
  }

  try {
    const out = await callChannelStrategyLLM(input);
    const validated = validateChannelStrategyOutput(out);
    if (validated.ok) return { ...out, _source: 'llm_v1' };

    return { ...heuristicChannelStrategy(input), _source: 'heuristic_fallback_invalid_llm' };
  } catch (err) {
    return {
      ...heuristicChannelStrategy(input),
      _source: 'heuristic_fallback_llm_error',
      _llm_error: String(err.message || err),
    };
  }
}


/**
 * Startup’ta DB’den job’ları hydrate et.
 * Eğer status=running ise auto-recovery: failed olarak işaretle.
 */
(function bootstrapJobsFromDb() {
  try {
    const persisted = loadAllJobs();
    persisted.forEach(job => {
      if (job.status === 'running') {
        job.status = 'failed';
        job.error =
          'Auto-recovery: previous run interrupted, job marked as failed.';
        job.updated_at = new Date().toISOString();
        updateJob(job);
        logJobEvent(job.id, 'FAILED_AUTO_RECOVERY', {
          error: job.error,
        });
      }
      jobs.set(job.id, job);
    });
  } catch (err) {
    console.error('[GODMODE][BOOTSTRAP] failed to hydrate jobs from db:', err);
  }
})();

/**
 * /api/godmode/status
 */
function getStatus() {
  const phases = getRoadmapPhases();

  return {
    version: 'v1.0.0',
    phases,
    jobs: {
      total: jobs.size,
      queued: Array.from(jobs.values()).filter(j => j.status === 'queued')
        .length,
      running: Array.from(jobs.values()).filter(j => j.status === 'running')
        .length,
      completed: Array.from(jobs.values()).filter(j => j.status === 'completed')
        .length,
      failed: Array.from(jobs.values()).filter(j => j.status === 'failed')
        .length,
    },
    host: {
      hostname: os.hostname(),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * /api/godmode/providers/health
 * Provider health snapshot (PAL)
 * Stable, non-nested response shape (no providers.providers nesting)
 */
async function getProvidersHealth() {
  const snapshot = await healthCheckProviders();

  const providers = snapshot && snapshot.providers ? snapshot.providers : {};
  const summary =
    snapshot && snapshot.summary
      ? snapshot.summary
      : {
          total: Object.keys(providers).length,
          healthy: Object.values(providers).filter(p => p && p.ok === true)
            .length,
          unhealthy: Object.values(providers).filter(p => !p || p.ok !== true)
            .length,
        };

  return {
    providers,
    summary,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Job helper’ları
 */
function getJob(id) {
  return jobs.get(id) || null;
}

function listJobs() {
  return Array.from(jobs.values()).sort((a, b) =>
    (b.created_at || '').localeCompare(a.created_at || ''),
  );
}

/** 
 * Single job getter (API için)
 * Önce memory cache'e, yoksa DB'ye bakar.
 */
function getJobById(id) {
  if (!id) return null;

  // 1) Memory cache
  const fromCache = getJob(id);
  if (fromCache) {
    return fromCache;
  }

  // 2) DB
  const fromDb = getJobFromDb(id);
  if (fromDb) {
    // Cache'e geri yazalım ki bir sonraki istek hızlı olsun
    jobs.set(fromDb.id, fromDb);
    return fromDb;
  }

  return null;
}

/**
 * VALIDATION HELPERLARI (Faz 1.G.1)
 */

function clampMaxResults(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 50;
  if (n > 250) return 250;
  return n;
}

// FAZ 2.C.4 Provider Bazlı Weighting (Lead Ranking v1)
function parseProviderWeightsFromEnv() {
  const raw = process.env.GODMODE_PROVIDER_WEIGHTS;
  if (!raw || typeof raw !== 'string') return null;

  const out = {};
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);

  for (const p of parts) {
    const [kRaw, vRaw] = p.split('=').map(s => (s || '').trim());
    if (!kRaw) continue;

    const n = Number(vRaw);
    if (!Number.isFinite(n)) continue;

    // 0..2 güvenli aralık
    out[kRaw] = Math.max(0, Math.min(2, n));
  }

  return Object.keys(out).length ? out : null;
}

function resolveProviderWeights(criteria, providersUsed) {
  const fromCriteria =
    criteria && typeof criteria === 'object' && criteria.providerWeights &&
    typeof criteria.providerWeights === 'object'
      ? criteria.providerWeights
      : null;

  const fromEnv = parseProviderWeightsFromEnv();

  const weights = {};

  // default 1.0
  (Array.isArray(providersUsed) ? providersUsed : []).forEach(p => {
    if (p) weights[p] = 1.0;
  });

  // env override
  if (fromEnv) {
    Object.entries(fromEnv).forEach(([k, v]) => {
      weights[k] = v;
    });
  }

  // criteria override (highest priority)
  if (fromCriteria) {
    Object.entries(fromCriteria).forEach(([k, v]) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return;
      weights[k] = Math.max(0, Math.min(2, n));
    });
  }

  return weights;
}

function applyProviderWeighting(leads, weights) {
  const ranked = (Array.isArray(leads) ? leads : []).map(l => {
    const provider = l && l.provider ? l.provider : null;
    const w =
      provider && weights && Object.prototype.hasOwnProperty.call(weights, provider)
        ? Number(weights[provider])
        : 1.0;

    const base =
      Number.isFinite(Number(l && l.source_confidence))
        ? Number(l.source_confidence)
        : 60;

    const finalScore = Math.max(0, Math.min(100, Math.round(base * w)));

    return {
      ...l,
      weight_used: w,
      final_score: finalScore,
    };
  });

  ranked.sort((a, b) => {
    const as = Number.isFinite(Number(a.final_score)) ? Number(a.final_score) : 0;
    const bs = Number.isFinite(Number(b.final_score)) ? Number(b.final_score) : 0;
    if (bs !== as) return bs - as;

    const ar = Number.isFinite(Number(a.rating)) ? Number(a.rating) : 0;
    const br = Number.isFinite(Number(b.rating)) ? Number(b.rating) : 0;
    if (br !== ar) return br - ar;

    const av = Number.isFinite(Number(a.user_ratings_total)) ? Number(a.user_ratings_total) : 0;
    const bv = Number.isFinite(Number(b.user_ratings_total)) ? Number(b.user_ratings_total) : 0;
    if (bv !== av) return bv - av;

    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  return ranked;
}

function validateDiscoveryPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Geçersiz istek gövdesi.');
    return errors;
  }

  const { city, country, categories, minGoogleRating, maxResults } = payload;

  if (!city || typeof city !== 'string') {
    errors.push('city alanı zorunludur ve string olmalıdır.');
  }

  if (!country || typeof country !== 'string') {
    errors.push('country alanı zorunludur ve string olmalıdır.');
  }

  if (categories !== undefined) {
    if (!Array.isArray(categories)) {
      errors.push('categories alanı bir dizi olmalıdır.');
    }
  }

  if (minGoogleRating !== undefined) {
    const r = Number(minGoogleRating);
    if (!Number.isFinite(r) || r < 0 || r > 5) {
      errors.push('minGoogleRating 0 ile 5 arasında bir sayı olmalıdır.');
    }
  }

  if (maxResults !== undefined) {
    const m = Number(maxResults);
    if (!Number.isFinite(m) || m <= 0) {
      errors.push('maxResults 0’dan büyük bir sayı olmalıdır.');
    }
  }

  return errors;
}

/**
 * /api/godmode/jobs/discovery-scan
 * Discovery job create
 */
function createDiscoveryJob(payload) {
  const validationErrors = validateDiscoveryPayload(payload);
  if (validationErrors.length > 0) {
    const err = new Error(validationErrors.join(' '));
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const {
    label,
    city,
    country,
    categories,
    minGoogleRating,
    maxResults,
    channels,
    notes,
    providerWeights,
    parallel,
    bypassRateLimit,
    forceRefresh,
  } = payload || {};

  const id = uuidv4();
  const now = new Date().toISOString();

  const job = {
    id,
    type: 'discovery_scan',
    label: label || `${city} discovery job`,
    criteria: {
      city,
      country,
      categories: Array.isArray(categories) ? categories : [],
      minGoogleRating:
        typeof minGoogleRating === 'number' ? minGoogleRating : 0,
      maxResults: clampMaxResults(maxResults),
      channels:
        Array.isArray(channels) && channels.length > 0
          ? channels
          : ['google_places'],
      notes: notes || null,
      providerWeights:
        providerWeights && typeof providerWeights === 'object'
          ? providerWeights
          : null,
      parallel: typeof parallel === 'boolean' ? parallel : true,
      bypassRateLimit: typeof bypassRateLimit === 'boolean' ? bypassRateLimit : false,
      forceRefresh: typeof forceRefresh === 'boolean' ? forceRefresh : false,
    },
    status: 'queued',
    progress: {
      percent: 0,
      found_leads: 0,
      enriched_leads: 0,
    },
    result_summary: null,
    created_at: now,
    updated_at: now,
  };

  // In-memory + DB
  jobs.set(job.id, job);
  insertJob(job);

  // Event log
  logJobEvent(job.id, 'QUEUED', {
    criteria: job.criteria,
  });

  return job;
}

/**
 * Job status helper’ları (internal)
 */
function markJobRunning(job) {
  job.status = 'running';
  job.progress =
    job.progress || { percent: 0, found_leads: 0, enriched_leads: 0 };
  job.progress.percent = 0;
  job.updated_at = new Date().toISOString();

  jobs.set(job.id, job);
  updateJob(job);

  logJobEvent(job.id, 'RUN_START', {
    criteria: job.criteria,
  });
}

function markJobCompleted(job) {
  job.status = 'completed';
  job.progress = job.progress || {};
  if (typeof job.progress.percent !== 'number') {
    job.progress.percent = 100;
  }
  job.updated_at = new Date().toISOString();

  jobs.set(job.id, job);
  updateJob(job);

  const completedStatsRaw =
    job.result_summary && job.result_summary.stats
      ? job.result_summary.stats
      : {};

  const completedStats =
    completedStatsRaw && typeof completedStatsRaw === 'object'
      ? { ...completedStatsRaw }
      : {};

  if (typeof completedStats.discovery_mode !== 'string' || !completedStats.discovery_mode) {
    completedStats.discovery_mode = getDiscoveryModeLabel();
  }

  if (!Array.isArray(completedStats.providers_used)) {
    completedStats.providers_used = [];
  }

  // Deterministic REPLAY labeling: avoid ambiguous channel-only label
  if (completedStats.discovery_mode === 'replay') {
    if (
      completedStats.providers_used.includes('google_places') &&
      !completedStats.providers_used.includes('google_places_replay')
    ) {
      completedStats.providers_used = completedStats.providers_used.map(p =>
        p === 'google_places' ? 'google_places_replay' : p
      );
    }
  }

  logJobEvent(job.id, 'COMPLETED', {
    progress: job.progress,
    stats: completedStats,
  });
}

function markJobFailed(job, error) {
  job.status = 'failed';
  job.error = error ? String(error.message || error) : 'unknown error';
  job.updated_at = new Date().toISOString();

  jobs.set(job.id, job);
  updateJob(job);

  logJobEvent(job.id, 'FAILED', {
    error: job.error,
  });
}

/**
 * FAZ 2.C.2 — Multi-provider duplicate merge helpers
 */
function normalizeText(v) {
  if (!v) return '';
  return String(v)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDomain(v) {
  if (!v) return null;
  try {
    const s = String(v).trim();
    const url = s.startsWith('http') ? new URL(s) : new URL(`https://${s}`);
    return normalizeText(url.hostname.replace(/^www\./, ''));
  } catch {
    const s = normalizeText(v);
    return s || null;
  }
}

function buildMergeKey(lead) {
  const name = normalizeText(lead && lead.name);
  const city = normalizeText(lead && lead.city);
  const country = normalizeText(lead && lead.country);
  const addr = normalizeText(lead && lead.address).slice(0, 64);
  const domain =
    extractDomain(lead && lead.website) ||
    extractDomain(lead && lead.url) ||
    extractDomain(lead && lead.raw && lead.raw.url) ||
    null;

  if (domain) return `${domain}::${city || country}`;
  if (name && addr) return `${name}::${city || country}::${addr}`;
  if (name) return `${name}::${city || country}`;
  return null;
}

function mergeGroup(group) {
  const sources = group.map((g) => ({
    provider: g.provider || null,
    provider_id:
      g.provider === 'google_places'
        ? g.place_id || null
        : g.provider_id || null,
  }));

  // Select best primary: by source_confidence, rating, user_ratings_total
  const primary = [...group].sort((a, b) => {
    const ac = Number.isFinite(Number(a?.source_confidence)) ? Number(a.source_confidence) : 0;
    const bc = Number.isFinite(Number(b?.source_confidence)) ? Number(b.source_confidence) : 0;
    if (bc !== ac) return bc - ac;

    const ar = Number.isFinite(Number(a?.rating)) ? Number(a.rating) : 0;
    const br = Number.isFinite(Number(b?.rating)) ? Number(b.rating) : 0;
    if (br !== ar) return br - ar;

    const av = Number.isFinite(Number(a?.user_ratings_total)) ? Number(a.user_ratings_total) : 0;
    const bv = Number.isFinite(Number(b?.user_ratings_total)) ? Number(b.user_ratings_total) : 0;
    return bv - av;
  })[0] || {};

  const bestRating = group.reduce((max, g) => {
    const r = typeof g.rating === 'number' ? g.rating : null;
    if (r == null) return max;
    if (max == null) return r;
    return Math.max(max, r);
  }, null);

  const bestReviews = group.reduce((max, g) => {
    const r = typeof g.user_ratings_total === 'number' ? g.user_ratings_total : null;
    if (r == null) return max;
    if (max == null) return r;
    return Math.max(max, r);
  }, null);

  // Compute merged confidence and provider count
  const bestConfidence = group.reduce((max, g) => {
    const c = Number.isFinite(Number(g?.source_confidence)) ? Number(g.source_confidence) : null;
    if (c == null) return max;
    if (max == null) return c;
    return Math.max(max, c);
  }, null);

  // Cross-source bonus: if the same entity appears in multiple providers, boost slightly (cap 100)
  const providerCount = new Set(group.map((g) => g && g.provider).filter(Boolean)).size;
  const crossSourceBonus = providerCount >= 2 ? 5 : 0;

  const mergedConfidence = Math.max(
    0,
    Math.min(100, Math.round((bestConfidence != null ? bestConfidence : 60) + crossSourceBonus)),
  );

  const merged = {
    ...primary,
    rating: bestRating != null ? bestRating : primary.rating,
    user_ratings_total: bestReviews != null ? bestReviews : primary.user_ratings_total,
    source_confidence: mergedConfidence,
    provider_count: providerCount,
    sources,
    raw_sources: group,
  };

  return merged;
}

function mergeMultiProviderLeads(rawLeads) {
  const merged = [];
  const groups = new Map();

  for (const lead of rawLeads) {
    if (!lead) continue;
    const key = buildMergeKey(lead);
    if (!key) {
      merged.push({
        ...lead,
        source_confidence: Number.isFinite(Number(lead?.source_confidence))
          ? Number(lead.source_confidence)
          : 60,
        sources: [
          {
            provider: lead.provider || null,
            provider_id:
              lead.provider === 'google_places'
                ? lead.place_id || null
                : lead.provider_id || null,
          },
        ],
        raw_sources: [lead],
      });
      continue;
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lead);
  }

  for (const [, group] of groups) {
    merged.push(mergeGroup(group));
  }

  return merged;
}

/**
 * PROVIDER ERROR NORMALIZATION (Faz 1.G.2 / 1.G.3)
 */
function normalizeProviderError(provider, error) {
  const base = {
    provider,
    error_code: 'UNKNOWN',
    error_message: error && (error.message || String(error)),
  };

  if (!error) return base;

  // HTTP status hataları
  if (typeof error.status === 'number') {
    return {
      ...base,
      error_code: 'HTTP_ERROR',
      http_status: error.status,
    };
  }

  const message = String(error.message || error);

  if (message.includes('GOOGLE_PLACES_API_KEY tanımlı değil')) {
    return {
      ...base,
      error_code: 'MISSING_API_KEY',
    };
  }

  if (message.includes('Google Places API status')) {
    return {
      ...base,
      error_code: 'STATUS_ERROR',
    };
  }

  if (
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND')
  ) {
    return {
      ...base,
      error_code: 'NETWORK_ERROR',
    };
  }

  return base;
}

/**
 * MOCK discovery engine (v1.0.0-mock)
 */
async function runDiscoveryJobMock(job) {
  const { criteria } = job;

  const foundLeads = 150;
  const enrichedLeads = 105;

  job.progress = {
    percent: 100,
    found_leads: foundLeads,
    enriched_leads: enrichedLeads,
  };

  job.result_summary = {
    engine_version: 'v1.0.0-mock',
    notes:
      'Bu sonuçlar şimdilik demo amaçlıdır. Gerçek çok-kaynaklı discovery entegrasyonu Faz 2 OMNI-DATA FEEDER ile bağlanacaktır.',
    criteria_snapshot: criteria,
    stats: {
      found_leads: foundLeads,
      enriched_leads: enrichedLeads,
      discovery_mode: 'mock',
      providers_used: ['mock'],
    },
    sample_leads: [],
    provider_errors: [],
  };
}

/**
 * GOOGLE PLACES discovery (v1.0.0-live)
 */
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function runGooglePlacesDiscovery(criteria, jobForLogging) {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY tanımlı değil (.env).');
  }

  const {
    city,
    country,
    categories = [],
    minGoogleRating = 0,
    maxResults = 250,
  } = criteria;

  const leads = [];
  const usedCategories = [];
  const providerErrors = [];

  const effectiveCategories =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : ['firma'];

  for (const cat of effectiveCategories) {
    if (leads.length >= maxResults) break;
    usedCategories.push(cat);

    const query = `${cat} ${city} ${country}`;
    let pageToken = null;
    let pageCount = 0;

    do {
      let url;
      if (pageToken == null) {
        url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          query,
        )}&key=${GOOGLE_PLACES_API_KEY}`;
      } else {
        url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${GOOGLE_PLACES_API_KEY}`;
      }

      let data;
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          const error = new Error(
            `Google Places API HTTP error: ${resp.status}`,
          );
          error.status = resp.status;
          throw error;
        }

        data = await resp.json();

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          throw new Error(`Google Places API status: ${data.status}`);
        }
      } catch (err) {
        const normalized = normalizeProviderError('google_places', err);
        providerErrors.push(normalized);

        logJobEvent(jobForLogging.id, 'PROVIDER_ERROR', {
          provider: 'google_places',
          category: cat,
          query,
          error: normalized,
        });

        break;
      }

      const results = data.results || [];

      // PROVIDER_PAGE event log’u
      logJobEvent(jobForLogging.id, 'PROVIDER_PAGE', {
        provider: 'google_places',
        category: cat,
        query,
        page: pageCount + 1,
        results_count: results.length,
        accumulated_leads: leads.length,
      });

      for (const r of results) {
        if (leads.length >= maxResults) break;

        const rating = typeof r.rating === 'number' ? r.rating : 0;
        if (rating < minGoogleRating) continue;

        leads.push({
          provider: 'google_places',
          place_id: r.place_id,
          name: r.name,
          address: r.formatted_address || null,
          city,
          country,
          rating,
          user_ratings_total: r.user_ratings_total || 0,
          types: r.types || [],
          business_status: r.business_status || null,
          location:
            r.geometry && r.geometry.location ? r.geometry.location : null,
          raw: {
            reference: r.reference,
            url: r.url,
          },
        });
      }

      pageToken = data.next_page_token || null;
      pageCount += 1;

      if (pageToken && leads.length < maxResults) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } while (pageToken && pageCount < 3 && leads.length < maxResults);
  }

  return {
    leads,
    providers_used: ['google_places'],
    discovery_mode: 'live',
    used_categories: usedCategories,
    provider_errors: providerErrors,
  };
}

/**
 * LIVE discovery engine wrapper (Faz 2)
 */
async function runDiscoveryJobLive(job) {
  const { criteria } = job;
  // Progress heartbeat: provider_search start
  job.progress = job.progress || { percent: 0, found_leads: 0, enriched_leads: 0 };
  job.progress.percent = 15;
  job.updated_at = new Date().toISOString();
  jobs.set(job.id, job);
  updateJob(job);
  logJobEvent(job.id, 'STAGE', {
    stage: 'provider_search',
    percent: job.progress.percent,
    message: 'Provider discovery başlatıldı.',
  });

  const discoveryMode = getDiscoveryModeLabel();

  // Faz 2: Tüm provider'ları tek yerden yöneten runner
  const discoveryResult = await runDiscoveryProviders({
    ...criteria,
    jobId: job.id,
  });

  // Provider skip / rate limit observability (PAL)
  if (discoveryResult && typeof discoveryResult === 'object') {
    const skipped = Array.isArray(discoveryResult.provider_skips)
      ? discoveryResult.provider_skips
      : [];

    const skipDetails =
      discoveryResult.provider_skip_details &&
      typeof discoveryResult.provider_skip_details === 'object'
        ? discoveryResult.provider_skip_details
        : null;

    if (skipped.length > 0) {
      logJobEvent(job.id, 'PROVIDER_SKIPPED', {
        stage: 'provider_search',
        providers: skipped,
        details: skipDetails,
      });
    }
  }

  // Progress heartbeat: provider_search done
  job.progress = job.progress || { percent: 0, found_leads: 0, enriched_leads: 0 };
  job.progress.percent = 55;
  job.updated_at = new Date().toISOString();
  jobs.set(job.id, job);
  updateJob(job);
  logJobEvent(job.id, 'STAGE', {
    stage: 'provider_search_done',
    percent: job.progress.percent,
    message: 'Provider discovery tamamlandı.',
  });

  const rawLeads = Array.isArray(discoveryResult.leads)
    ? discoveryResult.leads
    : [];

  const allLeads = mergeMultiProviderLeads(rawLeads);

  // FAZ 2.C.4 — Provider Bazlı Weighting (Lead Ranking v1)
  // providers_used
  let providersUsed = Array.isArray(discoveryResult.providers_used)
    ? discoveryResult.providers_used
    : [];

  if (discoveryMode === 'replay') {
    if (providersUsed.includes('google_places') && !providersUsed.includes('google_places_replay')) {
      providersUsed = providersUsed.map(p => (p === 'google_places' ? 'google_places_replay' : p));
    }
  }
  const weightsUsed = resolveProviderWeights(criteria, providersUsed);
  const rankedLeads = applyProviderWeighting(allLeads, weightsUsed);

  //
  // FAZ 2.B.6 — DEDUP + PERSIST (canonical: provider + provider_id)
  // FAZ 2.B.6.2 — Freshness Window & Skip-Enrichment Policy (metrics-only)
  //
  const windowMs = FRESHNESS_WINDOW_HOURS * 60 * 60 * 1000;
  const forceRefresh = Boolean(criteria && criteria.forceRefresh);
  const rescanAfterMs = RESCAN_AFTER_HOURS * 60 * 60 * 1000;

  let dedupedCount = 0;
  let freshInsertedCount = 0;

  let skippedAsFreshCount = 0;
  let refreshedDueToForceCount = 0;
  let updatedKnownLeadsCount = 0; 
  
  // FAZ 2.E.2 rescan policy metrics
  let rescannedDueToTimeCount = 0;
  let rescannedDueToManualCount = 0;
  let blockedByScanCountCapCount = 0;
  let skippedDueToRescanPolicyCount = 0;

  // FAZ 2.E metrics
  let newLeadsCount = 0;
  let knownLeadsCount = 0;
  let scanCountTotalBefore = 0;
  let scanCountTotalAfter = 0;

  let deepEnrichmentCandidates = 0;
  const deepEnrichmentCandidateIds = [];
  const deepEnrichmentCandidateLeadSamples = [];

  for (const lead of allLeads) {
    if (!lead || !lead.provider) continue;

    // provider_id mapping (google_places → place_id)
    const providerId =
      lead.provider === 'google_places'
        ? lead.place_id
        : lead.provider_id;

    if (!providerId) continue;

    const result = upsertPotentialLead({
      jobId: job.id,
      provider: lead.provider,
      provider_id: providerId,
      name: lead.name || null,
      category:
        Array.isArray(lead.types) && lead.types.length > 0
          ? lead.types[0]
          : null,
      city: lead.city || null,
      raw_payload: lead,
    });

    // FAZ 2.E metrics accumulation
    if (result && result.is_new === true) {
      newLeadsCount += 1;
    } else if (result && result.is_new === false) {
      knownLeadsCount += 1;
    }

    if (result && typeof result.scan_count_before === 'number') {
      scanCountTotalBefore += result.scan_count_before;
    }
    if (result && typeof result.scan_count_after === 'number') {
      scanCountTotalAfter += result.scan_count_after;
    }

    if (result.deduped) {
      dedupedCount += 1;
      updatedKnownLeadsCount += 1;

      const lastSeenBefore = result.last_seen_at_before;
      const isFresh =
        lastSeenBefore && Number.isFinite(Date.parse(lastSeenBefore))
          ? Date.now() - Date.parse(lastSeenBefore) <= windowMs
          : false;

      // FAZ 2.E.2 — rescan eligibility (time/manual) + scan_count guardrail
      const scAfter =
        result && typeof result.scan_count_after === 'number'
          ? result.scan_count_after
          : null;

      const hoursSinceLastSeen =
        lastSeenBefore && Number.isFinite(Date.parse(lastSeenBefore))
          ? (Date.now() - Date.parse(lastSeenBefore)) / (60 * 60 * 1000)
          : null;

      const timeEligible =
        hoursSinceLastSeen != null && Number.isFinite(hoursSinceLastSeen)
          ? hoursSinceLastSeen >= RESCAN_AFTER_HOURS
          : false;

      const manualEligible = forceRefresh === true;

      const blockedByScanCap =
        scAfter != null && Number.isFinite(Number(scAfter))
          ? Number(scAfter) > RESCAN_SCANCOUNT_CAP
          : false;

      const rescanEligible = manualEligible || (!blockedByScanCap && timeEligible);

      if (blockedByScanCap && !manualEligible) {
        blockedByScanCountCapCount += 1;
        logJobEvent(job.id, 'RESCAN_BLOCKED_SCANCOUNT_CAP', {
          provider: lead.provider,
          provider_id: providerId,
          scan_count_after: scAfter,
          cap: RESCAN_SCANCOUNT_CAP,
        });
      }

      if (rescanEligible) {
        if (manualEligible) rescannedDueToManualCount += 1;
        else rescannedDueToTimeCount += 1;

        logJobEvent(job.id, 'RESCAN_ELIGIBLE', {
          provider: lead.provider,
          provider_id: providerId,
          reason: manualEligible ? 'manual' : 'time',
          last_seen_at_before: lastSeenBefore,
          hours_since_last_seen: hoursSinceLastSeen,
          threshold_hours: RESCAN_AFTER_HOURS,
          scan_count_after: scAfter,
        });
      }

      if (isFresh && !forceRefresh) {
        skippedAsFreshCount += 1;
        logJobEvent(job.id, 'ENRICHMENT_SKIPPED', {
          reason: 'freshness_window',
          provider: lead.provider,
          provider_id: providerId,
          last_seen_at_before: lastSeenBefore,
          window_hours: FRESHNESS_WINDOW_HOURS,
        });
      } else if (isFresh && forceRefresh) {
        refreshedDueToForceCount += 1;
        logJobEvent(job.id, 'FORCE_REFRESH', {
          provider: lead.provider,
          provider_id: providerId,
          last_seen_at_before: lastSeenBefore,
          window_hours: FRESHNESS_WINDOW_HOURS,
        });
      }

      if (!isFresh && !forceRefresh && !rescanEligible) {
        skippedDueToRescanPolicyCount += 1;
        logJobEvent(job.id, 'ENRICHMENT_SKIPPED', {
          reason: 'rescan_policy',
          provider: lead.provider,
          provider_id: providerId,
          last_seen_at_before: lastSeenBefore,
          threshold_hours: RESCAN_AFTER_HOURS,
          scan_count_after: scAfter,
          cap: RESCAN_SCANCOUNT_CAP,
        });
      }

      // FAZ 2.D Deep Enrichment gating: deduped branch
      if (ENABLE_DEEP_ENRICHMENT) {
        const eligible = rescanEligible || (!isFresh && RESCAN_AFTER_HOURS <= FRESHNESS_WINDOW_HOURS);
        if (eligible) {
          deepEnrichmentCandidates += 1;

          if (deepEnrichmentCandidateLeadSamples.length < 25) {
            deepEnrichmentCandidateLeadSamples.push({
              provider: lead.provider,
              provider_id: providerId,
              name: lead.name || null,
              website: lead.website || null,
              rating:
                lead && Number.isFinite(Number(lead.rating)) ? Number(lead.rating) : null,
              user_ratings_total:
                lead && Number.isFinite(Number(lead.user_ratings_total))
                  ? Number(lead.user_ratings_total)
                  : null,
            });
          }

          if (deepEnrichmentCandidateIds.length < DEEP_ENRICHMENT_IDS_CAP) {
            deepEnrichmentCandidateIds.push(providerId);
          }
        }
      }

      logJobEvent(job.id, 'DEDUP_SKIP', {
        provider: lead.provider,
        provider_id: providerId,
      });
    } else {
      freshInsertedCount += 1;
      logJobEvent(job.id, 'FRESH_LEAD', {
        provider: lead.provider,
        provider_id: providerId,
      });
      // FAZ 2.D Deep Enrichment gating: fresh insert branch
      if (ENABLE_DEEP_ENRICHMENT) {
        deepEnrichmentCandidates += 1;

        if (deepEnrichmentCandidateLeadSamples.length < 25) {
          deepEnrichmentCandidateLeadSamples.push({
            provider: lead.provider,
            provider_id: providerId,
            name: lead.name || null,
            website: lead.website || null,
            rating:
              lead && Number.isFinite(Number(lead.rating)) ? Number(lead.rating) : null,
            user_ratings_total:
              lead && Number.isFinite(Number(lead.user_ratings_total))
                ? Number(lead.user_ratings_total)
                : null,
          });
        }

        if (deepEnrichmentCandidateIds.length < DEEP_ENRICHMENT_IDS_CAP) {
          deepEnrichmentCandidateIds.push(providerId);
        }
      }
    }
  }
  logJobEvent(job.id, 'DEDUP_DONE', {
    found_leads: allLeads.length,
    raw_leads_count: rawLeads.length,
    merged_leads_count: allLeads.length,
    deduped_leads: dedupedCount,
    fresh_inserted_leads: freshInsertedCount,
    updated_known_leads_count: updatedKnownLeadsCount,
    skipped_as_fresh_count: skippedAsFreshCount,
    refreshed_due_to_force_count: refreshedDueToForceCount,
    rescanned_due_to_time_count: rescannedDueToTimeCount,
    rescanned_due_to_manual_count: rescannedDueToManualCount,
    blocked_by_scancount_cap_count: blockedByScanCountCapCount,
    skipped_due_to_rescan_policy_count: skippedDueToRescanPolicyCount,
    rescan_after_hours: RESCAN_AFTER_HOURS,
    scancount_cap: RESCAN_SCANCOUNT_CAP,
    window_hours: FRESHNESS_WINDOW_HOURS,
    force_refresh: forceRefresh,
    deep_enrichment_enabled: ENABLE_DEEP_ENRICHMENT,
    deep_enrichment_candidates: deepEnrichmentCandidates,
    // FAZ 2.E deterministic metrics
    new_leads_count: newLeadsCount,
    known_leads_count: knownLeadsCount,
    scan_count_total_before: scanCountTotalBefore,
    scan_count_total_after: scanCountTotalAfter,
  });

  //
  // FAZ 3 — Brain Sample Pipeline (deterministic)
  // Runs independently of deep-enrichment gating so smoke/full runs always produce AI artifacts.
  //
  const brainSample = (() => {
    if (Array.isArray(deepEnrichmentCandidateLeadSamples) && deepEnrichmentCandidateLeadSamples.length > 0) {
      return deepEnrichmentCandidateLeadSamples.slice(0, 10);
    }

    return (Array.isArray(allLeads) ? allLeads : []).slice(0, 10).map(l => {
      if (!l) return null;

      const provider = l.provider || null;
      const providerId =
        provider === 'google_places'
          ? (l.place_id || null)
          : (l.provider_id || null);

      return {
        provider,
        provider_id: providerId,
        name: l.name || null,
        website: l.website || null,
        rating: Number.isFinite(Number(l.rating)) ? Number(l.rating) : null,
        user_ratings_total: Number.isFinite(Number(l.user_ratings_total)) ? Number(l.user_ratings_total) : null,
      };
    }).filter(Boolean);
  })();

  if (brainSample.length > 0) {
    const targets = brainSample.map(s => {
      const websiteMissing = !s.website;

      const opportunityScore = websiteMissing ? 75 : 40;

      return {
        job_id: job.id,
        provider: s.provider,
        provider_id: s.provider_id,
        name: s.name || null,
        website_missing: websiteMissing,
        website: s.website || null,
        city: criteria && criteria.city ? criteria.city : null,
        country: criteria && criteria.country ? criteria.country : null,
        force_refresh: forceRefresh,
        scan_count_after: null,
        rating: s && Number.isFinite(Number(s.rating)) ? Number(s.rating) : null,
        user_ratings_total: s && Number.isFinite(Number(s.user_ratings_total))
          ? Number(s.user_ratings_total)
          : null,
        opportunity_score: opportunityScore,
      };
    });

    await brainService.runBrainPipeline({
      job,
      targets,
      generators: {
        generateLeadRanking: async (t) => {
          return rankLead(t);
        },
        generateAutoSwot: async (t) => {
          return generateAutoSwot({
            job_id: t.job_id,
            provider: t.provider,
            provider_id: t.provider_id,
            name: t.name || null,
            city: t.city || null,
            country: t.country || null,
            website_missing: Boolean(t.website_missing),
            website: t.website || null,
            ai_score_band: t.ai_score_band || null,
            priority_score: t.priority_score || null,
            why_now: t.why_now || null,
            ideal_entry_channel: t.ideal_entry_channel || null,
          });
        },
        generateOutreachDraft: async (t) => {
          return generateOutreachDraft({
            job_id: t.job_id,
            provider: t.provider,
            provider_id: t.provider_id,
            name: t.name || null,
            city: t.city || null,
            country: t.country || null,
            website_missing: Boolean(t.website_missing),
            website: t.website || null,
            ai_score_band: t.ai_score_band || null,
            priority_score: t.priority_score || null,
            why_now: t.why_now || null,
            ideal_entry_channel: t.ideal_entry_channel || null,
            auto_swot: t.auto_swot || null,
          });
        },
        generateSalesEntryStrategy: async (t) => {
          return generateSalesEntryStrategy({
            job_id: t.job_id,
            provider: t.provider,
            provider_id: t.provider_id,
            name: t.name || null,
            website_missing: Boolean(t.website_missing),
            website: t.website || null,
            ai_score_band: t.ai_score_band || null,
            priority_score: t.priority_score || null,
            ideal_entry_channel: t.ideal_entry_channel || null,
            auto_swot: t.auto_swot || null,
          });
        },
        generateChannelStrategy: async (t) => {
          return generateChannelStrategy({
            job_id: t.job_id,
            provider: t.provider,
            provider_id: t.provider_id,
            name: t.name || null,
            website_missing: Boolean(t.website_missing),
            website: t.website || null,
            ai_score_band: t.ai_score_band || null,
            priority_score: t.priority_score || null,
            why_now: t.why_now || null,
            ideal_entry_channel: t.ideal_entry_channel || null,
            auto_swot: t.auto_swot || null,
            sales_entry_strategy: t.sales_entry_strategy || null,
          });
        },
      },
    });
    // FAZ 4.C — Auto-trigger outreach enqueue (A/B band only, idempotent)
    if (ENABLE_OUTREACH_AUTO_TRIGGER) {
      await outreachTriggerService.runOutreachAutoTrigger({
        job,
        targets,
      });
    }
  }

  //
  // FAZ 2.B.6.3 — Enrichment Gating (Skip-Enrichment Execution)
  //
  const shouldSkipEnrichment =
    skippedAsFreshCount > 0 && !forceRefresh;

  if (shouldSkipEnrichment) {
    logJobEvent(job.id, 'ENRICHMENT_SKIPPED', {
      reason: 'freshness_window',
      skipped_count: skippedAsFreshCount,
      window_hours: FRESHNESS_WINDOW_HOURS,
    });
    // Canonical event for deep-enrichment freshness gating (for smoke-test assertions)
    logJobEvent(job.id, 'DEEP_ENRICHMENT_SKIPPED_AS_FRESH', {
      reason: 'freshness_window',
      skipped_count: skippedAsFreshCount,
      window_hours: FRESHNESS_WINDOW_HOURS,
      force_refresh: forceRefresh,
    });

    console.log(
      '[GODMODE][ENRICHMENT_SKIPPED]',
      'job=',
      job.id,
      'skipped_count=',
      skippedAsFreshCount,
    );
  } else {
    logJobEvent(job.id, 'ENRICHMENT_START', {
      reason: forceRefresh ? 'force_refresh' : 'normal',
    });

    console.log(
      '[GODMODE][WORKER_TRIGGER] dataFeederWorker triggered for job',
      job.id,
    );
  }

  // FAZ 2.D Deep Enrichment observability + queue persistence (no external calls)
  if (ENABLE_DEEP_ENRICHMENT) {
    logJobEvent(job.id, 'DEEP_ENRICHMENT_CANDIDATES', {
      enabled: true,
      candidates: deepEnrichmentCandidates,
      sources: DEEP_ENRICHMENT_SOURCES,
      skipped_due_to_freshness: shouldSkipEnrichment,
      force_refresh: forceRefresh,
      collected_ids: COLLECT_DEEP_ENRICHMENT_IDS,
      collected_ids_count: deepEnrichmentCandidateIds.length,
    });

    // Deterministic stub write for smoke-test: emit minimal deep-enrichment signals without workers
    if (false) {
      const sample = Array.isArray(deepEnrichmentCandidateLeadSamples)
        ? deepEnrichmentCandidateLeadSamples.slice(0, 10)
        : [];

      for (const s of sample) {
        if (!s) continue;

        const websiteMissing = !s.website;

        const seo = websiteMissing
          ? { ok: false, reason: 'website_missing' }
          : { ok: false, reason: 'html_not_fetched_in_discovery_feed' };

        const opportunity = (() => {
          let score = 0;
          if (websiteMissing) score += 45;
          if (seo.ok !== true) score += 30;

          if (score > 100) score = 100;
          if (score < 0) score = 0;

          const priority = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

          return {
            website_missing: websiteMissing,
            website_offer: websiteMissing,
            seo_offer: seo.ok !== true,
            tech_modernization_offer: false,
            score,
            priority,
          };
        })();

        if (websiteMissing) {
          logJobEvent(job.id, 'DEEP_ENRICHMENT_WEBSITE_MISSING', {
            provider: s.provider,
            provider_id: s.provider_id,
            name: s.name,
            note: 'website is missing in discovery payload (stub write for determinism)',
          });
        } else {
          logJobEvent(job.id, 'DEEP_ENRICHMENT_TECH_STUB', {
            provider: s.provider,
            provider_id: s.provider_id,
            name: s.name,
            website: s.website,
            seo,
          });
        }

        console.log('[SMOKE][STUB_LOOP] writing SEO + OPPORTUNITY', {
          job_id: job.id,
          provider: s.provider,
          provider_id: s.provider_id,
          website_missing: websiteMissing,
        });
        // SEO-only event (stubbed)
        logJobEvent(job.id, 'DEEP_ENRICHMENT_SEO_SIGNALS', {
          provider: s.provider,
          provider_id: s.provider_id,
          name: s.name,
          website: s.website || null,
          seo,
          note: 'stubbed in discovery (no HTML fetch)',
        });

        // Opportunity scoring event (stubbed)
        logJobEvent(job.id, 'DEEP_ENRICHMENT_OPPORTUNITY_SCORE', {
          provider: s.provider,
          provider_id: s.provider_id,
          name: s.name,
          website: s.website || null,
          seo,
          tech: [],
          opportunity,
          note: 'stubbed in discovery (workerless determinism)',
        });

        // Persist deep enrichment snapshot (v1) into potential_leads.raw_payload_json._deep_enrichment
        try {
          const persistResult = upsertDeepEnrichmentIntoPotentialLead({
            provider: s.provider,
            providerId: s.provider_id,
            jobId: job.id,
            enrichment: {
              source: 'discovery_stub',
              website: s.website || null,
              seo,
              opportunity,
              tech: [],
            },
          });

          if (!persistResult || persistResult.ok !== true) {
            logJobEvent(job.id, 'DEEP_ENRICHMENT_PERSIST_MISS', {
              provider: s.provider,
              provider_id: s.provider_id,
              reason: persistResult && persistResult.reason ? persistResult.reason : 'UNKNOWN',
            });
          } else {
            logJobEvent(job.id, 'DEEP_ENRICHMENT_PERSIST_OK', {
              provider: s.provider,
              provider_id: s.provider_id,
              lead_row_id: persistResult.id || null,
            });
          }
        } catch (err) {
          logJobEvent(job.id, 'DEEP_ENRICHMENT_PERSIST_ERROR', {
            provider: s.provider,
            provider_id: s.provider_id,
            error: err.message || String(err),
          });
        }

        // Social signals event (stubbed)
        logJobEvent(job.id, 'DEEP_ENRICHMENT_SOCIAL_SIGNALS', {
          provider: s.provider,
          provider_id: s.provider_id,
          name: s.name,
          website: s.website || null,
          social: {
            ok: false,
            reason: websiteMissing ? 'website_missing' : 'html_not_fetched_in_discovery_feed',
            links: {
              instagram: [],
              facebook: [],
              linkedin: [],
              youtube: [],
              tiktok: [],
            },
            emails: [],
            phones: [],
          },
          note: 'stubbed in discovery (no HTML fetch)',
        });
      }

      // FAZ 3.A — AI Lead Ranking (v1 minimal)
      const rankingSample = sample;
      let aiRankedCount = 0;
      const aiRankedTop = [];

      for (const s of rankingSample) {
        if (!s) continue;

        // Build compact ranking input (keep it stable & cheap)
        const websiteMissing = !s.website;

        // Try to reuse opportunity score from stub (best-effort: recompute)
        const opportunityScore = websiteMissing ? 75 : 40;

        const input = {
          job_id: job.id,
          provider: s.provider,
          provider_id: s.provider_id,
          name: s.name || null,
          website_missing: websiteMissing,
          website: s.website || null,
          city: criteria && criteria.city ? criteria.city : null,
          country: criteria && criteria.country ? criteria.country : null,
          force_refresh: forceRefresh,
          scan_count_after: null,
          rating:
            s && Number.isFinite(Number(s.rating)) ? Number(s.rating) : null,
          user_ratings_total:
            s && Number.isFinite(Number(s.user_ratings_total))
              ? Number(s.user_ratings_total)
              : null,
          opportunity_score: opportunityScore,
        };

        const ranked = await rankLead(input);

        aiRankedCount += 1;
        if (aiRankedTop.length < 10) {
          aiRankedTop.push({
            provider: s.provider,
            provider_id: s.provider_id,
            name: s.name || null,
            ai_score_band: ranked.ai_score_band,
            priority_score: ranked.priority_score,
            ideal_entry_channel: ranked.ideal_entry_channel,
            why_now: ranked.why_now,
            source: ranked._source || null,
          });
        }

        logJobEvent(job.id, 'AI_LEAD_RANKED', {
          provider: s.provider,
          provider_id: s.provider_id,
          name: s.name || null,
          result: {
            ai_score_band: ranked.ai_score_band,
            priority_score: ranked.priority_score,
            why_now: ranked.why_now,
            ideal_entry_channel: ranked.ideal_entry_channel,
            source: ranked._source || null,
            llm_error: ranked._llm_error || null,
          },
        });
      }

      // Summary event for observability
      logJobEvent(job.id, 'AI_LEAD_RANKING_DONE', {
        enabled: process.env.GODMODE_AI_LEAD_RANKING === '1',
        ranked_count: aiRankedCount,
        top: aiRankedTop,
      });

      // FAZ 3.B — Auto-SWOT (v1 minimal) — only for A/B leads
      const websiteByProviderId = {};
      for (const s of rankingSample) {
        if (!s) continue;
        websiteByProviderId[String(s.provider_id)] = s.website || null;
      }

      const swotTargets = aiRankedTop.filter(x => x && (x.ai_score_band === 'A' || x.ai_score_band === 'B'));
      let swotCount = 0;
      const swotTop = [];
      const swotByProviderId = {};

      for (const t of swotTargets) {
        const website = websiteByProviderId[String(t.provider_id)] || null;
        const websiteMissing = !website;

        const swotInput = {
          job_id: job.id,
          provider: t.provider,
          provider_id: t.provider_id,
          name: t.name || null,
          city: criteria && criteria.city ? criteria.city : null,
          country: criteria && criteria.country ? criteria.country : null,
          website_missing: websiteMissing,
          website,
          ai_score_band: t.ai_score_band,
          priority_score: t.priority_score,
          why_now: t.why_now,
          ideal_entry_channel: t.ideal_entry_channel,
        };

        const swot = await generateAutoSwot(swotInput);
        swotByProviderId[String(t.provider_id)] = swot;

        swotCount += 1;

        if (swotTop.length < 10) {
          swotTop.push({
            provider: t.provider,
            provider_id: t.provider_id,
            name: t.name || null,
            ai_score_band: t.ai_score_band,
            priority_score: t.priority_score,
            confidence_level: swot.confidence_level,
            sales_angle: swot.sales_angle,
            source: swot._source || null,
          });
        }

        logJobEvent(job.id, 'AI_AUTO_SWOT_GENERATED', {
          provider: t.provider,
          provider_id: t.provider_id,
          name: t.name || null,
          input: swotInput,
          result: {
            strengths: swot.strengths,
            weaknesses: swot.weaknesses,
            opportunities: swot.opportunities,
            threats: swot.threats,
            sales_angle: swot.sales_angle,
            confidence_level: swot.confidence_level,
            source: swot._source || null,
            llm_error: swot._llm_error || null,
          },
        });
      }

      logJobEvent(job.id, 'AI_AUTO_SWOT_DONE', {
        enabled: process.env.GODMODE_AI_AUTO_SWOT === '1',
        swot_count: swotCount,
        targets_count: swotTargets.length,
        top: swotTop,
      });

      // FAZ 3.C.1 — Auto-Outreach Draft (v1 minimal) — only for A/B leads
      let draftCount = 0;
      const draftTop = [];

      for (const t of swotTargets) {
        const website = websiteByProviderId[String(t.provider_id)] || null;
        const websiteMissing = !website;

        const swot = swotByProviderId[String(t.provider_id)] || null;

        const draftInput = {
          job_id: job.id,
          provider: t.provider,
          provider_id: t.provider_id,
          name: t.name || null,
          city: criteria && criteria.city ? criteria.city : null,
          country: criteria && criteria.country ? criteria.country : null,
          website_missing: websiteMissing,
          website,
          ai_score_band: t.ai_score_band,
          priority_score: t.priority_score,
          why_now: t.why_now,
          ideal_entry_channel: t.ideal_entry_channel,
          auto_swot: swot && typeof swot === 'object'
            ? {
                strengths: swot.strengths,
                weaknesses: swot.weaknesses,
                opportunities: swot.opportunities,
                threats: swot.threats,
                sales_angle: swot.sales_angle,
                confidence_level: swot.confidence_level,
                source: swot._source || null,
              }
            : null,
        };

        const draft = await generateOutreachDraft(draftInput);
        draftCount += 1;

        if (draftTop.length < 10) {
          draftTop.push({
            provider: t.provider,
            provider_id: t.provider_id,
            name: t.name || null,
            ai_score_band: t.ai_score_band,
            priority_score: t.priority_score,
            suggested_channel: draft.suggested_channel,
            subject: draft.subject || null,
            confidence_level: draft.confidence_level,
            tone: draft.tone,
            source: draft._source || null,
          });
        }

        logJobEvent(job.id, 'AI_OUTREACH_DRAFT_GENERATED', {
          provider: t.provider,
          provider_id: t.provider_id,
          name: t.name || null,
          input: draftInput,
          result: {
            suggested_channel: draft.suggested_channel,
            subject: draft.subject || null,
            opening_message: draft.opening_message,
            cta: draft.cta,
            language: draft.language,
            tone: draft.tone,
            personalization_hooks: Array.isArray(draft.personalization_hooks) ? draft.personalization_hooks : [],
            confidence_level: draft.confidence_level,
            source: draft._source || null,
            llm_error: draft._llm_error || null,
          },
        });
        try {
          const persist = insertAiArtifact({
            jobId: job.id,
            leadId: null,
            provider: t.provider,
            providerId: String(t.provider_id),
            artifactType: 'outreach_draft_v1',
            artifact: {
              suggested_channel: draft.suggested_channel,
              subject: draft.subject || null,
              opening_message: draft.opening_message,
              cta: draft.cta,
              language: draft.language,
              tone: draft.tone,
              personalization_hooks: Array.isArray(draft.personalization_hooks)
                ? draft.personalization_hooks
                : [],
              confidence_level: draft.confidence_level,
              source: draft._source || null,
            },
          });

          logJobEvent(job.id, 'AI_OUTREACH_DRAFT_PERSISTED', {
            provider: t.provider,
            provider_id: t.provider_id,
            ok: persist && persist.ok === true,
            reason: persist && persist.reason ? persist.reason : null,
          });
        } catch (err) {
          logJobEvent(job.id, 'AI_OUTREACH_DRAFT_PERSIST_ERROR', {
            provider: t.provider,
            provider_id: t.provider_id,
            error: err.message || String(err),
          });
        }

        const salesInput = {
          job_id: job.id,
          provider: t.provider,
          provider_id: t.provider_id,
          name: t.name || null,
          website_missing: websiteMissing,
          website,
          ai_score_band: t.ai_score_band,
          priority_score: t.priority_score,
          ideal_entry_channel: t.ideal_entry_channel,
          auto_swot: swot || null,
        };

        const salesStrategy = await generateSalesEntryStrategy(salesInput);

        logJobEvent(job.id, 'AI_SALES_ENTRY_STRATEGY_GENERATED', {
          provider: t.provider,
          provider_id: t.provider_id,
          result: salesStrategy,
        });

        try {
          const persistSales = insertAiArtifact({
            jobId: job.id,
            leadId: null,
            provider: t.provider,
            providerId: String(t.provider_id),
            artifactType: 'sales_entry_strategy_v1',
            artifact: salesStrategy,
          });

          logJobEvent(job.id, 'AI_SALES_ENTRY_STRATEGY_PERSISTED', {
            provider: t.provider,
            provider_id: t.provider_id,
            ok: persistSales && persistSales.ok === true,
          });
        } catch (err) {
          logJobEvent(job.id, 'AI_SALES_ENTRY_STRATEGY_PERSIST_ERROR', {
            provider: t.provider,
            provider_id: t.provider_id,
            error: err.message || String(err),
          });
        }
      }

      logJobEvent(job.id, 'AI_OUTREACH_DRAFT_DONE', {
        enabled: process.env.GODMODE_AI_OUTREACH_DRAFT === '1',
        draft_count: draftCount,
        targets_count: swotTargets.length,
        top: draftTop,
      });
    }

    if (!shouldSkipEnrichment && deepEnrichmentCandidates > 0) {
      console.log(
        '[GODMODE][DEEP_ENRICHMENT_READY]',
        'job=',
        job.id,
        'candidates=',
        deepEnrichmentCandidates,
        'sources=',
        DEEP_ENRICHMENT_SOURCES.join(','),
      );
    }

    if (
      !shouldSkipEnrichment &&
      deepEnrichmentCandidateIds.length > 0 &&
      typeof enqueueDeepEnrichmentCandidates === 'function'
    ) {
      appendDeepEnrichmentStage(job.id, 'QUEUED', {
        enabled: true,
        sources: DEEP_ENRICHMENT_SOURCES,
        candidates: deepEnrichmentCandidates,
        queued_ids: deepEnrichmentCandidateIds.length,
        chunk_size: DEEP_ENRICHMENT_QUEUE_CHUNK,
        cap: DEEP_ENRICHMENT_IDS_CAP,
      });

      const q = enqueueDeepEnrichmentCandidates(
        job.id,
        deepEnrichmentCandidateIds,
        DEEP_ENRICHMENT_SOURCES,
        {
          chunk_size: DEEP_ENRICHMENT_QUEUE_CHUNK,
          cap: DEEP_ENRICHMENT_IDS_CAP,
        },
      );

      logJobEvent(job.id, 'DEEP_ENRICHMENT_QUEUED', {
        queued: q && typeof q === 'object' ? q.queued : null,
        batches: q && typeof q === 'object' ? q.batches : null,
      });
    }
  }

  const foundLeads = allLeads.length;
  const enrichedLeads = Math.round(foundLeads * 0.7);

  // criteria.categories fallback
  const criteriaCategories = Array.isArray(criteria.categories)
    ? criteria.categories
    : [];

  // used_categories:
  // 1) Eğer runner'dan gelen dolu bir dizi varsa onu kullan
  // 2) Yoksa en azından criteria.categories'i yaz
  const usedCategories =
    Array.isArray(discoveryResult.used_categories) &&
    discoveryResult.used_categories.length > 0
      ? discoveryResult.used_categories
      : criteriaCategories;

  const providerErrors = Array.isArray(discoveryResult.provider_errors)
    ? discoveryResult.provider_errors
    : [];

  // Progress heartbeat: result_build start
  job.progress = job.progress || { percent: 0, found_leads: 0, enriched_leads: 0 };
  job.progress.percent = 85;
  job.updated_at = new Date().toISOString();
  jobs.set(job.id, job);
  updateJob(job);
  logJobEvent(job.id, 'STAGE', {
    stage: 'result_build',
    percent: job.progress.percent,
    message: 'Result summary hazırlanıyor.',
  });

  job.progress = {
    percent: 100,
    found_leads: foundLeads,
    enriched_leads: enrichedLeads,
  };

  job.result_summary = {
    engine_version: 'v1.1.0-live-faz2',
    notes:
      'Multi-provider hazır discovery engine. Şu an sadece google_places aktif. Faz 2’de diğer providerlar eklenecek.',
    criteria_snapshot: criteria,
    providers_used: providersUsed,
    used_categories: usedCategories,
    provider_errors: providerErrors,
    provider_skips: Array.isArray(discoveryResult.provider_skips)
      ? discoveryResult.provider_skips
      : [],
    provider_skip_details:
      discoveryResult.provider_skip_details &&
      typeof discoveryResult.provider_skip_details === 'object'
        ? discoveryResult.provider_skip_details
        : {},
    // FAZ 2.D: deep_enrichment result_summary field
    deep_enrichment: {
      enabled: ENABLE_DEEP_ENRICHMENT,
      sources: DEEP_ENRICHMENT_SOURCES,
      candidates: deepEnrichmentCandidates,
      collected_ids: COLLECT_DEEP_ENRICHMENT_IDS,
      collected_ids_count: deepEnrichmentCandidateIds.length,
    },
    weights_used: weightsUsed,
    top_ranked_sample: rankedLeads.slice(0, 20),
    stats: {
      found_leads: foundLeads,
      raw_leads_count: rawLeads.length,
      merged_leads_count: allLeads.length,
      enriched_leads: enrichedLeads,
      discovery_mode: discoveryMode,
      providers_used: providersUsed,
      weights_used: weightsUsed,
      used_categories: usedCategories,
      deduped_leads: dedupedCount,
      fresh_inserted_leads: freshInsertedCount,

      freshness_window_hours: FRESHNESS_WINDOW_HOURS,
      force_refresh: forceRefresh,
      updated_known_leads_count: updatedKnownLeadsCount,
      skipped_as_fresh_count: skippedAsFreshCount,
      refreshed_due_to_force_count: refreshedDueToForceCount,
      // FAZ 2.D: deep_enrichment stats
      deep_enrichment_enabled: ENABLE_DEEP_ENRICHMENT,
      deep_enrichment_candidates: deepEnrichmentCandidates,
    },
    sample_leads: allLeads.slice(0, 20),
    raw_leads_sample: rawLeads.slice(0, 20),
  };
}

/**
 * /api/godmode/jobs/:id/run
 */
async function runDiscoveryJob(jobId) {
  const job = getJob(jobId) || getJobFromDb(jobId);

  if (!job) {
    const err = new Error('JOB_NOT_FOUND');
    err.code = 'JOB_NOT_FOUND';
    throw err;
  }

  if (job.type !== 'discovery_scan') {
    throw new Error(
      `Bu runner sadece discovery_scan job türü için geçerli (got: ${job.type})`,
    );
  }

  // cache’e geri yazalım
  jobs.set(job.id, job);

  markJobRunning(job);

  try {
    const discoveryMode = resolveDiscoveryMode();
    
    if (discoveryMode === 'mock') {
      await runDiscoveryJobMock(job);
    } else {
      await runDiscoveryJobLive(job);
    }

    //
    // 🔴 BURASI YENİ: result_summary normalizasyon katmanı
    //
    if (job.result_summary && typeof job.result_summary === 'object') {
      const rs = job.result_summary;

      // Eğer stats yoksa, en azından basic bir stats objesi yarat
      if (!rs.stats || typeof rs.stats !== 'object') {
        rs.stats = {};
      }

      // providers_used
      if (!Array.isArray(rs.providers_used)) {
        // stats içindeki providers_used varsa oradan al, yoksa boş liste
        rs.providers_used = Array.isArray(rs.stats.providers_used)
          ? rs.stats.providers_used
          : [];
      }

      // used_categories (şu an için yoksa boş liste bırakıyoruz;
      // ileride pipeline/providers tarafında dolduracağız)
      if (!Array.isArray(rs.used_categories)) {
        rs.used_categories = Array.isArray(rs.stats.used_categories)
          ? rs.stats.used_categories
          : [];
      }

      // provider_errors
      if (!Array.isArray(rs.provider_errors)) {
        rs.provider_errors = [];
      }

      // provider_skips
      if (!Array.isArray(rs.provider_skips)) {
        rs.provider_skips = [];
      }

      // provider_skip_details
      if (!rs.provider_skip_details || typeof rs.provider_skip_details !== 'object') {
        rs.provider_skip_details = {};
      }

      // stats.providers_used içinde de eşitle
      if (!Array.isArray(rs.stats.providers_used)) {
        rs.stats.providers_used = rs.providers_used;
      }

      job.result_summary = rs;
    }

    markJobCompleted(job);
    return getJob(jobId);
  } catch (err) {
    markJobFailed(job, err);
    throw err;
  }
}

/**
 * Backward-compat aliases (v1.x → v1.0.0)
 * Controller içinde hâlâ createDiscoveryScanJob / runJob kullanıldığı için
 * bu alias'lar üzerinden yeni fonksiyonlara yönlendiriyoruz.
 */
function createDiscoveryScanJob(payload) {
  // Esas implementasyon: createDiscoveryJob
  return createDiscoveryJob(payload);
}

async function runJob(jobId) {
  // Esas implementasyon: runDiscoveryJob
  return runDiscoveryJob(jobId);
}

module.exports = {
  // status & listing
  getStatus,
  getProvidersHealth,
  listJobs,
  getJob,
  getJobById, // <-- EKLENDİ

  // job creation / run (yeni isimler)
  createDiscoveryJob,
  runDiscoveryJob,

  // backward-compat (eski isimleri kullanan controller'lar için)
  createDiscoveryScanJob,
  runJob,

  // log helper (1.G kapsamı)
  appendJobLog,
};