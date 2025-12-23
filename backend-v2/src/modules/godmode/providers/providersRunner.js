const {
  runGooglePlacesDiscovery,
  healthCheckGooglePlaces,
} = require('./googlePlacesProvider');

const { getDb } = require('../../../core/db');

const PROVIDERS = {
  google_places: {
    id: 'google_places',
    run: runGooglePlacesDiscovery,
    healthCheck: healthCheckGooglePlaces,
  },
};

// === PAL rate-limit + backoff utilities ===
const PROVIDER_RATE_LIMIT_CONFIG = {
  google_places: {
    initialBackoffMs: 3000,
    maxBackoffMs: 60000,
  },
};

const providerRateState = {
  google_places: {
    nextAllowedAt: 0,
    backoffMs: PROVIDER_RATE_LIMIT_CONFIG.google_places.initialBackoffMs,
    lastError: null,
  },
};

function isRateLimitLikeError(err) {
  const code = err?.code || err?.error?.code || null;
  const msg = (err?.message || '').toLowerCase();

  return (
    code === 429 ||
    code === '429' ||
    code === 'OVER_QUERY_LIMIT' ||
    code === 'RESOURCE_EXHAUSTED' ||
    code === 'RATE_LIMIT' ||
    code === 'rate_limit' ||
    msg.includes('over_query_limit') ||
    msg.includes('rate limit') ||
    msg.includes('429')
  );
}

function getProviderState(providerId) {
  if (!providerRateState[providerId]) {
    const cfg = PROVIDER_RATE_LIMIT_CONFIG[providerId] || {
      initialBackoffMs: 3000,
      maxBackoffMs: 60000,
    };

    providerRateState[providerId] = {
      nextAllowedAt: 0,
      backoffMs: cfg.initialBackoffMs,
      lastError: null,
    };
  }

  return providerRateState[providerId];
}

function onProviderSuccess(providerId) {
  const cfg = PROVIDER_RATE_LIMIT_CONFIG[providerId] || {
    initialBackoffMs: 3000,
    maxBackoffMs: 60000,
  };

  const st = getProviderState(providerId);
  st.nextAllowedAt = 0;
  st.backoffMs = cfg.initialBackoffMs;
  st.lastError = null;
}

function onProviderRateLimit(providerId, err) {
  const cfg = PROVIDER_RATE_LIMIT_CONFIG[providerId] || {
    initialBackoffMs: 3000,
    maxBackoffMs: 60000,
  };

  const st = getProviderState(providerId);
  st.backoffMs = Math.min(
    cfg.maxBackoffMs,
    Math.max(cfg.initialBackoffMs, st.backoffMs * 2),
  );
  st.nextAllowedAt = Date.now() + st.backoffMs;
  st.lastError = {
    code: err?.code || 'rate_limited',
    message: err?.message || 'rate_limited',
    at: new Date().toISOString(),
  };

  return st;
}

async function withProviderBackoff(providerId, fn, options = {}) {
  const st = getProviderState(providerId);

  const forceRateLimit = process.env.PAL_FORCE_RATE_LIMIT === '1';
  if (forceRateLimit && providerId === 'google_places') {
    const next = onProviderRateLimit(providerId, {
      code: 'OVER_QUERY_LIMIT',
      message: 'PAL_FORCE_RATE_LIMIT',
    });

    return {
      skipped: true,
      reason: 'provider_rate_limited',
      retryAt: new Date(next.nextAllowedAt).toISOString(),
      backoffMs: next.backoffMs,
      lastError: next.lastError,
    };
  }

  const bypass = options?.bypassRateLimit === true;
  if (!bypass && st.nextAllowedAt && Date.now() < st.nextAllowedAt) {
    return {
      skipped: true,
      reason: 'provider_rate_limited',
      retryAt: new Date(st.nextAllowedAt).toISOString(),
      backoffMs: st.backoffMs,
      lastError: st.lastError,
    };
  }

  try {
    const res = await fn();
    onProviderSuccess(providerId);
    return { skipped: false, res };
  } catch (err) {
    if (isRateLimitLikeError(err)) {
      const next = onProviderRateLimit(providerId, err);
      return {
        skipped: true,
        reason: 'provider_rate_limited',
        retryAt: new Date(next.nextAllowedAt).toISOString(),
        backoffMs: next.backoffMs,
        lastError: next.lastError,
      };
    }

    throw err;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchGooglePlaceWebsite(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 'MISSING_API_KEY', website: null };
  }

  const url =
    'https://maps.googleapis.com/maps/api/place/details/json?' +
    'place_id=' +
    encodeURIComponent(placeId) +
    '&fields=website' +
    '&key=' +
    encodeURIComponent(apiKey);

  const res = await fetch(url);
  const json = await res.json().catch(() => null);

  const status = json?.status || null;

  if (status !== 'OK') {
    return {
      ok: false,
      status: status || 'UNKNOWN',
      error_message: json?.error_message || null,
      website: null,
    };
  }

  const website = json?.result?.website || null;

  return {
    ok: true,
    status: 'OK',
    website:
      typeof website === 'string' && website.trim().length > 0 ? website.trim() : null,
  };
}

async function processDeepEnrichmentBatch({ jobId, ids = [], sources = [] }) {
  if (!Array.isArray(ids) || ids.length === 0) return { processed: 0 };

  const db = getDb();

  const insertLog = db.prepare(`
    INSERT INTO godmode_job_logs (job_id, event_type, payload_json, created_at)
    VALUES (@job_id, @event_type, @payload_json, @created_at)
  `);

  const readWebsiteStmt = db.prepare(
    `SELECT website FROM potential_leads WHERE google_place_id = ?`,
  );

  const updateWebsiteStmt = db.prepare(
    `UPDATE potential_leads SET website = ?, updated_at = datetime('now') WHERE google_place_id = ?`,
  );

  const hasTechStubLogStmt = db.prepare(
    `SELECT 1 FROM godmode_job_logs
     WHERE job_id = ? AND event_type = 'DEEP_ENRICHMENT_TECH_STUB'
       AND json_extract(payload_json, '$.google_place_id') = ?
     LIMIT 1`,
  );

  const hasWebsiteMissingLogStmt = db.prepare(
    `SELECT 1 FROM godmode_job_logs
     WHERE job_id = ? AND event_type = 'DEEP_ENRICHMENT_WEBSITE_MISSING'
       AND json_extract(payload_json, '$.google_place_id') = ?
     LIMIT 1`,
  );

  let processed = 0;

  for (const placeId of ids) {
    const wantsWebsite = sources.includes('website');
    const wantsTech = sources.includes('tech');

    const row = readWebsiteStmt.get(placeId);

    let website =
      row && typeof row.website === 'string' && row.website.trim().length > 0
        ? row.website.trim()
        : null;

    // If website missing and website enrichment is enabled, try Place Details fallback (rate-limit protected)
    if (!website && wantsWebsite) {
      // small delay to be gentle even when bypassing freshness (keeps QPS low)
      await sleep(350);

      const out = await withProviderBackoff(
        'google_places',
        () => fetchGooglePlaceWebsite(placeId),
        { bypassRateLimit: true },
      );

      if (out?.skipped === false && out?.res?.ok === true) {
        const w = out?.res?.website || null;

        if (typeof w === 'string' && w.trim().length > 0) {
          website = w.trim();
          updateWebsiteStmt.run(website, placeId);
        } else {
          const alreadyMissing = hasWebsiteMissingLogStmt.get(jobId, placeId);
          if (!alreadyMissing) {
            insertLog.run({
              job_id: jobId,
              event_type: 'DEEP_ENRICHMENT_WEBSITE_MISSING',
              payload_json: JSON.stringify({
                job_id: jobId,
                google_place_id: placeId,
                status: 'OK',
                website: null,
              }),
              created_at: new Date().toISOString(),
            });
          }
        }
      } else if (out?.skipped === false && out?.res?.ok === false) {
        insertLog.run({
          job_id: jobId,
          event_type: 'DEEP_ENRICHMENT_WEBSITE_FETCH_FAILED',
          payload_json: JSON.stringify({
            job_id: jobId,
            google_place_id: placeId,
            status: out?.res?.status || 'UNKNOWN',
            error_message: out?.res?.error_message || null,
          }),
          created_at: new Date().toISOString(),
        });
      }
    }

    // If we still don't have a website, we can't do tech stub.
    if (!website || !wantsTech) continue;

    // very light tech heuristic (same philosophy as dataFeederWorker)
    const w = String(website).toLowerCase();
    const tech = [];
    if (w.includes('wix')) tech.push('wix');
    if (w.includes('webflow')) tech.push('webflow');
    if (w.includes('shopify')) tech.push('shopify');
    if (w.includes('wordpress')) tech.push('wordpress');

    const alreadyTech = hasTechStubLogStmt.get(jobId, placeId);
    if (alreadyTech) continue;

    insertLog.run({
      job_id: jobId,
      event_type: 'DEEP_ENRICHMENT_TECH_STUB',
      payload_json: JSON.stringify({
        job_id: jobId,
        google_place_id: placeId,
        website,
        tech,
      }),
      created_at: new Date().toISOString(),
    });

    processed += 1;
  }

  return { processed };
}

async function runDiscoveryProviders(criteria) {
  const leads = [];
  const providersUsed = [];
  const usedCategories = [];
  const providerSkips = [];
  const providerSkipDetails = {};
  const providerErrors = [];

  const channels = Array.isArray(criteria?.channels)
    ? criteria.channels
    : ['google_places'];

  const selectedProviders = channels.map((c) => PROVIDERS[c]).filter(Boolean);

  const parallel = criteria?.parallel !== false;

  const tasks = selectedProviders.map((p) =>
    withProviderBackoff(p.id, () => p.run(criteria), {
      bypassRateLimit: criteria?.bypassRateLimit === true,
    }).then((out) => ({ providerId: p.id, out })),
  );

  const settled = parallel
    ? await Promise.allSettled(tasks)
    : await (async () => {
        const res = [];
        for (const t of tasks) {
          try {
            const v = await t;
            res.push({ status: 'fulfilled', value: v });
          } catch (e) {
            res.push({ status: 'rejected', reason: e });
          }
        }
        return res;
      })();

  for (const s of settled) {
    if (s.status === 'rejected') {
      providerErrors.push({
        provider: 'unknown',
        code: s?.reason?.code || 'provider_failed',
        message: s?.reason?.message || 'provider_failed',
      });
      continue;
    }

    const { providerId, out } = s.value;

    if (out?.skipped === true) {
      providerSkips.push(providerId);
      providerSkipDetails[providerId] = {
        reason: out.reason || 'provider_rate_limited',
        retryAt: out.retryAt || null,
        backoffMs: out.backoffMs || null,
        lastError: out.lastError || null,
      };

      console.warn(
        '[GODMODE][PAL]',
        providerId,
        'skipped:',
        out.reason,
        out.retryAt,
      );
      continue;
    }

    const res = out?.res;

    providersUsed.push(providerId);

    if (Array.isArray(res?.used_categories) && res.used_categories.length > 0) {
      usedCategories.push(...res.used_categories);
    }

    if (Array.isArray(res?.leads)) {
      leads.push(...res.leads);
    }
  }

  let effectiveUsedCategories = usedCategories;

  if (
    (!Array.isArray(effectiveUsedCategories) ||
      effectiveUsedCategories.length === 0) &&
    Array.isArray(criteria?.categories)
  ) {
    effectiveUsedCategories = [...criteria.categories];
  }

  return {
    leads,
    providers_used: Array.from(new Set(providersUsed)),
    used_categories: Array.from(new Set(effectiveUsedCategories || [])),
    provider_errors: providerErrors,
    provider_skips: Array.from(new Set(providerSkips)),
    provider_skip_details: providerSkipDetails,
  };
}

module.exports = {
  runDiscoveryProviders,
  healthCheckProviders,
  processDeepEnrichmentBatch,
};

async function healthCheckProviders(options) {
  const channels = Array.isArray(options?.channels)
    ? options.channels
    : ['google_places'];

  const providers = {};
  const results = [];

  if (channels.includes('google_places')) {
    const startedAt = Date.now();

    try {
      const hc = PROVIDERS.google_places?.healthCheck;
      if (typeof hc !== 'function') {
        throw new Error('healthCheckGooglePlaces_not_implemented');
      }

      const hcRun = await withProviderBackoff('google_places', () => hc(options), {
        bypassRateLimit: options?.bypassRateLimit === true,
      });

      if (hcRun?.skipped === true) {
        throw Object.assign(new Error('provider_rate_limited'), {
          code: 'provider_rate_limited',
          retryAt: hcRun.retryAt,
          backoffMs: hcRun.backoffMs,
          lastError: hcRun.lastError,
        });
      }

      const res = hcRun.res;
      const latencyMs = Date.now() - startedAt;

      providers.google_places = {
        ok: res?.ok === true,
        latencyMs,
        meta: res?.meta || {},
      };

      results.push(providers.google_places);
    } catch (err) {
      const latencyMs = Date.now() - startedAt;

      providers.google_places = {
        ok: false,
        latencyMs,
        error: {
          code: err?.code || 'provider_healthcheck_failed',
          message: err?.message || 'provider_healthcheck_failed',
          retryAt: err?.retryAt || null,
          backoffMs: err?.backoffMs || null,
        },
      };

      results.push(providers.google_places);
    }
  }

  const summary = {
    total: Object.keys(providers).length,
    healthy: results.filter((r) => r?.ok === true).length,
    unhealthy: results.filter((r) => r?.ok !== true).length,
  };

  return { providers, summary };
}