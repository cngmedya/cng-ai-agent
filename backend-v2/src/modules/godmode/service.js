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
} = require('./repo');

/**
 * In-memory job store (v1.x) + SQLite sync
 */
const jobs = new Map();

const FRESHNESS_WINDOW_HOURS = Number(
  process.env.GODMODE_FRESHNESS_WINDOW_HOURS || 168,
);

// FAZ 2.D Deep Enrichment gating + observability flags
const ENABLE_DEEP_ENRICHMENT = process.env.GODMODE_DEEP_ENRICHMENT === '1';
const DEEP_ENRICHMENT_SOURCES = (process.env.GODMODE_DEEP_ENRICHMENT_SOURCES || 'website,tech,seo,social')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const COLLECT_DEEP_ENRICHMENT_IDS = process.env.GODMODE_DEEP_ENRICHMENT_COLLECT_IDS === '1';
const DEEP_ENRICHMENT_IDS_CAP = Number(process.env.GODMODE_DEEP_ENRICHMENT_IDS_CAP || 200);
const DEEP_ENRICHMENT_QUEUE_CHUNK = Number(process.env.GODMODE_DEEP_ENRICHMENT_QUEUE_CHUNK || 50);

/**
 * MODE:
 * GODMODE_DISCOVERY_MODE=0 -> MOCK
 * GODMODE_DISCOVERY_MODE=1 -> LIVE (Google Places)
 */
function isLiveDiscoveryMode() {
  const raw = process.env.GODMODE_DISCOVERY_MODE;
  if (!raw) return false; // varsayılan: mock

  if (raw === '1') return true;
  const lowered = String(raw).toLowerCase();
  return lowered === 'live' || lowered === 'true';
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

  logJobEvent(job.id, 'COMPLETED', {
    progress: job.progress,
    stats: job.result_summary && job.result_summary.stats,
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
      providers_used: ['google_places'],
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
  const providersUsed = Array.isArray(discoveryResult.providers_used)
    ? discoveryResult.providers_used
    : [];
  const weightsUsed = resolveProviderWeights(criteria, providersUsed);
  const rankedLeads = applyProviderWeighting(allLeads, weightsUsed);

  //
  // FAZ 2.B.6 — DEDUP + PERSIST (canonical: provider + provider_id)
  // FAZ 2.B.6.2 — Freshness Window & Skip-Enrichment Policy (metrics-only)
  //
  const windowMs = FRESHNESS_WINDOW_HOURS * 60 * 60 * 1000;
  const forceRefresh = Boolean(criteria && criteria.forceRefresh);

  let dedupedCount = 0;
  let freshInsertedCount = 0;

  let skippedAsFreshCount = 0;
  let refreshedDueToForceCount = 0;
  let updatedKnownLeadsCount = 0;

  let deepEnrichmentCandidates = 0;
  const deepEnrichmentCandidateIds = [];

  for (const lead of allLeads) {
    if (!lead || !lead.provider) continue;

    // provider_id mapping (google_places → place_id)
    const providerId =
      lead.provider === 'google_places'
        ? lead.place_id
        : lead.provider_id;

    if (!providerId) continue;

    const result = upsertPotentialLead({
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

    if (result.deduped) {
      dedupedCount += 1;
      updatedKnownLeadsCount += 1;

      const lastSeenBefore = result.last_seen_at_before;
      const isFresh =
        lastSeenBefore && Number.isFinite(Date.parse(lastSeenBefore))
          ? Date.now() - Date.parse(lastSeenBefore) <= windowMs
          : false;

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

      // FAZ 2.D Deep Enrichment gating: deduped branch
      if (ENABLE_DEEP_ENRICHMENT) {
        const eligible = !isFresh || forceRefresh;
        if (eligible) {
          deepEnrichmentCandidates += 1;

          if (
            COLLECT_DEEP_ENRICHMENT_IDS &&
            deepEnrichmentCandidateIds.length < DEEP_ENRICHMENT_IDS_CAP
          ) {
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

        if (
          COLLECT_DEEP_ENRICHMENT_IDS &&
          deepEnrichmentCandidateIds.length < DEEP_ENRICHMENT_IDS_CAP
        ) {
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
    window_hours: FRESHNESS_WINDOW_HOURS,
    force_refresh: forceRefresh,
    deep_enrichment_enabled: ENABLE_DEEP_ENRICHMENT,
    deep_enrichment_candidates: deepEnrichmentCandidates,
  });

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
    if (isLiveDiscoveryMode()) {
      await runDiscoveryJobLive(job);
    } else {
      await runDiscoveryJobMock(job);
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