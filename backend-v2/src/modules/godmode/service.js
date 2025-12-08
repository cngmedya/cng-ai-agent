// backend-v2/src/modules/godmode/service.js

const os = require('os');
const { v4: uuidv4 } = require('uuid');

const {
  loadAllJobs,
  insertJob,
  updateJob,
  getJobById: getJobFromDb,
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
  const lowered = String(raw).toLowerCase();
  return lowered === '1' || lowered === 'live' || lowered === 'true';
}

/**
 * Roadmap / faz durumu
 */
function getRoadmapPhases() {
  return {
    phase1_core_bootstrap: 'done',        // job modeli, run flow, mock + live engine
    phase2_data_pipelines: 'pending',     // multi-provider discovery + enrichment
    phase3_brain_integration: 'pending',
    phase4_automation: 'pending',
  };
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
        updateJob(job);
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
 * 1.G.1 — Job Validation Layer
 * /api/godmode/jobs/discovery-scan
 * Discovery job create
 */
function createDiscoveryJob(payload) {
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

  // Zorunlu alanlar
  if (!city || !country) {
    const err = new Error('city ve country alanları zorunludur.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  // categories → array zorunluluğu (opsiyonel ama varsa array olmalı)
  if (typeof categories !== 'undefined' && !Array.isArray(categories)) {
    const err = new Error('categories alanı bir dizi (array) olmalıdır.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  // minGoogleRating 0–5 arası
  let effectiveMinRating = 0;
  if (typeof minGoogleRating === 'number') {
    if (minGoogleRating < 0 || minGoogleRating > 5) {
      const err = new Error(
        'minGoogleRating değeri 0 ile 5 arasında olmalıdır.',
      );
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    effectiveMinRating = minGoogleRating;
  }

  // maxResults hard limit ≤ 250
  let effectiveMaxResults = 250;
  if (typeof maxResults === 'number') {
    if (maxResults <= 0) {
      const err = new Error('maxResults 1 veya daha büyük olmalıdır.');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    effectiveMaxResults = Math.min(maxResults, 250);
  }

  const effectiveChannels =
    Array.isArray(channels) && channels.length > 0
      ? channels
      : ['google_places'];

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
      minGoogleRating: effectiveMinRating,
      maxResults: effectiveMaxResults,
      channels: effectiveChannels,
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

  return job;
}

/**
 * Eski çağrılar için alias:
 * createDiscoveryScanJob → createDiscoveryJob
 */
function createDiscoveryScanJob(payload) {
  return createDiscoveryJob(payload);
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
}

function markJobFailed(job, error) {
  job.status = 'failed';
  job.error = error ? String(error.message || error) : 'unknown error';
  job.updated_at = new Date().toISOString();

  jobs.set(job.id, job);
  updateJob(job);
}

/**
 * 1.G.2 — Provider Error Normalization helper
 */
function normalizeProviderError(provider, error) {
  const message = error && error.message ? String(error.message) : String(error || '');
  let errorCode = 'UNKNOWN';

  // Basit pattern’ler — ileride genişletilebilir
  if (message.includes('Google Places API HTTP error')) {
    errorCode = 'HTTP_ERROR';
  } else if (message.includes('Google Places API status:')) {
    const parts = message.split('Google Places API status:');
    if (parts[1]) {
      errorCode = `STATUS_${parts[1].trim()}`;
    } else {
      errorCode = 'API_STATUS_ERROR';
    }
  } else if (message.includes('GOOGLE_PLACES_API_KEY tanımlı değil')) {
    errorCode = 'MISSING_API_KEY';
  } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    errorCode = 'NETWORK_ERROR';
  }

  return {
    provider,
    error_code: errorCode,
    error_message: message,
  };
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
    provider_errors: [],
  };
}

/**
 * GOOGLE PLACES discovery (v1.0.0-live)
 */
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function runGooglePlacesDiscovery(criteria) {
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
      const url =
        pageToken == null
          ? `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
              query,
            )}&key=${GOOGLE_PLACES_API_KEY}`
          : `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${GOOGLE_PLACES_API_KEY}`;

      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Google Places API HTTP error: ${resp.status}`);
      }

      const data = await resp.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API status: ${data.status}`);
      }

      const results = data.results || [];
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
  };
}

/**
 * LIVE discovery engine wrapper
 * 1.G.2 — Provider Error Normalization burada uygulanıyor.
 */
async function runDiscoveryJobLive(job) {
  const { criteria } = job;

  const providerResults = [];
  let allLeads = [];
  const providerErrors = [];

  // Şimdilik tek provider: google_places
  if (
    criteria.channels &&
    Array.isArray(criteria.channels) &&
    criteria.channels.includes('google_places')
  ) {
    try {
      const gp = await runGooglePlacesDiscovery(criteria);
      providerResults.push({
        provider: 'google_places',
        ...gp,
      });
      allLeads = allLeads.concat(gp.leads || []);
    } catch (err) {
      providerErrors.push(normalizeProviderError('google_places', err));
    }
  }

  const foundLeads = allLeads.length;
  const enrichedLeads = foundLeads > 0 ? Math.round(foundLeads * 0.7) : 0;

  job.progress = {
    percent: foundLeads > 0 ? 100 : 0,
    found_leads: foundLeads,
    enriched_leads: enrichedLeads,
  };

  const providersUsed =
    providerResults.length > 0
      ? Array.from(
          new Set(
            providerResults
              .map(r => r.providers_used || [])
              .flat()
              .filter(Boolean),
          ),
        )
      : [];

  job.result_summary = {
    engine_version: 'v1.0.0-live',
    notes:
      providerErrors.length === 0
        ? 'Gerçek Google Places discovery çalıştırıldı. Faz 2’de multi-provider entegrasyon ve otomatik enrichment eklenecek.'
        : 'Discovery sırasında bazı provider hataları oluştu. Detaylar provider_errors alanında.',
    criteria_snapshot: criteria,
    stats: {
      found_leads: foundLeads,
      enriched_leads: enrichedLeads,
      providers_used: providersUsed.length > 0 ? providersUsed : ['google_places'],
    },
    sample_leads: allLeads.slice(0, 20),
    provider_errors: providerErrors,
  };

  // Tüm provider’lar fail olduysa (ileride birden fazla provider olduğunda da çalışacak)
  if (providerResults.length === 0 && providerErrors.length > 0) {
    const aggregateError = new Error('ALL_PROVIDERS_FAILED');
    aggregateError.code = 'ALL_PROVIDERS_FAILED';
    aggregateError.provider_errors = providerErrors;
    throw aggregateError;
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
    return getJob(jobId);
  } catch (err) {
    // Eğer ALL_PROVIDERS_FAILED ise, job.result_summary zaten provider_errors ile dolu.
    markJobFailed(job, err);
    throw err;
  }
}

/**
 * Eski çağrılar için alias:
 * runJob → runDiscoveryJob
 */
async function runJob(jobId) {
  return runDiscoveryJob(jobId);
}

module.exports = {
  getStatus,
  listJobs,
  createDiscoveryJob,
  createDiscoveryScanJob,
  runDiscoveryJob,
  runJob,
};