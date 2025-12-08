// backend-v2/src/modules/godmode/service.js

const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { runDiscoveryProviders } = require('./providers/providersRunner');

const {
  loadAllJobs,
  insertJob,
  updateJob,
  getJobById: getJobFromDb,
  appendJobLog,
} = require('./repo');

/**
 * In-memory job store (v1.x) + SQLite sync
 */
const jobs = new Map();

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
 * INTERNAL: Worker orchestration stub (Faz 1.G)
 * Discovery tamamlandığında dataFeederWorker tetikleme noktası.
 * Faz 2’de gerçek queue / worker pipeline ile değiştirilecek.
 */
function triggerPostDiscoveryWorkers(job) {
  try {
    console.log(
      '[GODMODE][WORKER_STUB] dataFeederWorker would be triggered for job',
      job.id,
    );
    // İlerleyen fazlarda:
    // - Queue push
    // - dataFeederWorker / entityResolverWorker / economicAnalyzerWorker entegrasyonu
  } catch (err) {
    console.error(
      '[GODMODE][WORKER_STUB][ERROR] jobId=',
      job.id,
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
 * VALIDATION HELPERLARI (Faz 1.G.1)
 */

function clampMaxResults(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 50;
  if (n > 250) return 250;
  return n;
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
 * LIVE discovery engine wrapper
 */
async function runDiscoveryJobLive(job) {
  const { criteria } = job;

  // Multi-provider discovery runner (şu an sadece google_places aktif)
  const discoveryResult = await runDiscoveryProviders(criteria, job);

  const leads = Array.isArray(discoveryResult.leads)
    ? discoveryResult.leads
    : [];

  const providersUsed = Array.isArray(discoveryResult.providers_used)
    ? discoveryResult.providers_used
    : [];

  const usedCategories = Array.isArray(discoveryResult.used_categories)
    ? discoveryResult.used_categories
    : [];

  const providerErrors = Array.isArray(discoveryResult.provider_errors)
    ? discoveryResult.provider_errors
    : [];

  const uniqueProvidersUsed = Array.from(new Set(providersUsed.filter(Boolean)));
  const uniqueUsedCategories = Array.from(
    new Set(usedCategories.filter(Boolean)),
  );

  const foundLeads = leads.length;
  const enrichedLeads = Math.round(foundLeads * 0.7);

  job.progress = {
    percent: 100,
    found_leads: foundLeads,
    enriched_leads: enrichedLeads,
  };

  const allProvidersFailed =
    uniqueProvidersUsed.length > 0 &&
    foundLeads === 0 &&
    providerErrors.length > 0;

  job.result_summary = {
    engine_version: 'v1.1.0-live-faz2',
    notes:
      'Multi-provider hazır discovery engine. Şu an sadece google_places aktif.\nFaz 2’de diğer providerlar eklenecek.',
    criteria_snapshot: criteria,

    // Faz 2 için kritik alanlar (root)
    providers_used: uniqueProvidersUsed,
    used_categories: uniqueUsedCategories,
    provider_errors: providerErrors,

    // Ek metrikler
    stats: {
      found_leads: foundLeads,
      enriched_leads: enrichedLeads,
      providers_used: uniqueProvidersUsed,
      used_categories: uniqueUsedCategories,
    },

    // Örnek lead’ler
    sample_leads: leads.slice(0, 50),
  };

  if (allProvidersFailed) {
    const err = new Error('Tüm provider çağrıları hata verdi.');
    err.code = 'ALL_PROVIDERS_FAILED';
    throw err;
  }
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

    markJobCompleted(job);

    // Worker orchestration stub (Faz 1.G)
    triggerPostDiscoveryWorkers(job);

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
  listJobs,
  getJob,

  // job creation / run (yeni isimler)
  createDiscoveryJob,
  runDiscoveryJob,

  // backward-compat (eski isimleri kullanan controller'lar için)
  createDiscoveryScanJob,
  runJob,

  // log helper (1.G kapsamı)
  appendJobLog,
};