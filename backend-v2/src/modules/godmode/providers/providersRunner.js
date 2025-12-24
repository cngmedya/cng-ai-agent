const {
  runGooglePlacesDiscovery,
  healthCheckGooglePlaces,
} = require('./googlePlacesProvider');

const { getDb } = require('../../../core/db');

const { extractSeoSignalsFromHtml } = require('../workers/dataFeederWorker');

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

// 2.D.3.4 — Social signals extraction helper
function uniq(arr) {
  return Array.from(new Set((Array.isArray(arr) ? arr : []).filter(Boolean)));
}

function extractSocialSignalsFromHtml(html) {
  const text = typeof html === 'string' ? html : '';
  if (!text) {
    return {
      ok: false,
      reason: 'empty_html',
      links: {
        instagram: [],
        facebook: [],
        linkedin: [],
        youtube: [],
        tiktok: [],
      },
      emails: [],
      phones: [],
    };
  }

  const urlMatches = text.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  const urls = uniq(urlMatches.map((u) => String(u).replace(/&amp;/g, '&')));

  const pick = (pred) => uniq(urls.filter(pred).slice(0, 20));

  const instagram = pick((u) => /instagram\.com\//i.test(u));
  const facebook = pick((u) => /facebook\.com\//i.test(u));
  const linkedin = pick((u) => /linkedin\.com\//i.test(u));
  const youtube = pick((u) => /(youtube\.com\/|youtu\.be\/)/i.test(u));
  const tiktok = pick((u) => /tiktok\.com\//i.test(u));

  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const emails = uniq(emailMatches.map((e) => e.toLowerCase())).slice(0, 20);

  const telMatches = text.match(/(\+\d{1,3}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{2,4}[\s-]?\d{2,4}/g) || [];
  const phones = uniq(
    telMatches
      .map((p) => String(p).replace(/[^\d+]/g, ''))
      .filter((p) => p.length >= 10 && p.length <= 15),
  ).slice(0, 20);

  return {
    ok: true,
    reason: 'ok',
    links: {
      instagram,
      facebook,
      linkedin,
      youtube,
      tiktok,
    },
    emails,
    phones,
  };
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

  const hasSeoSignalsLogStmt = db.prepare(
    `SELECT 1 FROM godmode_job_logs
     WHERE job_id = ? AND event_type = 'DEEP_ENRICHMENT_SEO_SIGNALS'
       AND json_extract(payload_json, '$.google_place_id') = ?
     LIMIT 1`,
  );

  const hasSocialSignalsLogStmt = db.prepare(
    `SELECT 1 FROM godmode_job_logs
     WHERE job_id = ? AND event_type = 'DEEP_ENRICHMENT_SOCIAL_SIGNALS'
       AND json_extract(payload_json, '$.google_place_id') = ?
     LIMIT 1`,
  );

  const hasWebsiteMissingLogStmt = db.prepare(
    `SELECT 1 FROM godmode_job_logs
     WHERE job_id = ? AND event_type = 'DEEP_ENRICHMENT_WEBSITE_MISSING'
       AND json_extract(payload_json, '$.google_place_id') = ?
     LIMIT 1`,
  );

  const hasOpportunityScoreLogStmt = db.prepare(
    `SELECT 1 FROM godmode_job_logs
     WHERE job_id = ? AND event_type = 'DEEP_ENRICHMENT_OPPORTUNITY_SCORE'
       AND json_extract(payload_json, '$.google_place_id') = ?
     LIMIT 1`,
  );

  const readLogRowStmt = db.prepare(
    `SELECT rowid as row_id, payload_json
     FROM godmode_job_logs
     WHERE job_id = ? AND event_type = ?
       AND json_extract(payload_json, '$.google_place_id') = ?
     ORDER BY created_at DESC
     LIMIT 1`,
  );

  const updateLogRowStmt = db.prepare(
    `UPDATE godmode_job_logs
     SET payload_json = ?, created_at = created_at
     WHERE rowid = ?`,
  );

  // 2.D.3.3 — Opportunity / Lead Scoring helper
  function computeOpportunity({ website, seo, tech }) {
    const websiteMissing = !website;

    const seoOk = seo?.ok === true;
    const seoOffer = !seoOk;

    const techArr = Array.isArray(tech) ? tech : [];
    const techModernization = techArr.some((t) =>
      ['wix', 'webflow', 'shopify', 'wordpress'].includes(String(t || '').toLowerCase()),
    );

    let score = 0;
    if (websiteMissing) score += 45;
    if (seoOffer) score += 30;
    if (techModernization) score += 15;

    if (score > 100) score = 100;
    if (score < 0) score = 0;

    const priority = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

    return {
      website_missing: websiteMissing,
      website_offer: websiteMissing,
      seo_offer: seoOffer,
      tech_modernization_offer: techModernization,
      score,
      priority,
    };
  }

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
                seo: {
                  ok: false,
                  reason: 'website_missing',
                  indexability: null,
                  meta: null,
                  schema: null,
                },
                opportunity: {
                  website_offer: true,
                  priority: 'high',
                },
              }),
              created_at: new Date().toISOString(),
            });
            // 2.D.3.3 — Emit DEEP_ENRICHMENT_OPPORTUNITY_SCORE event (idempotent)
            const alreadyOpp = hasOpportunityScoreLogStmt.get(jobId, placeId);
            if (!alreadyOpp) {
              const opportunity = computeOpportunity({
                website: null,
                seo: { ok: false, reason: 'website_missing' },
                tech: [],
              });

              insertLog.run({
                job_id: jobId,
                event_type: 'DEEP_ENRICHMENT_OPPORTUNITY_SCORE',
                payload_json: JSON.stringify({
                  job_id: jobId,
                  google_place_id: placeId,
                  website: null,
                  seo: { ok: false, reason: 'website_missing' },
                  tech: [],
                  opportunity,
                }),
                created_at: new Date().toISOString(),
              });
            }
          } else {
            const existing = readLogRowStmt.get(
              jobId,
              'DEEP_ENRICHMENT_WEBSITE_MISSING',
              placeId,
            );

            if (existing?.payload_json && !String(existing.payload_json).includes('"seo"')) {
              let prev = {};
              try {
                prev = JSON.parse(existing.payload_json);
              } catch (_) {
                prev = {};
              }

              const next = {
                ...prev,
                job_id: jobId,
                google_place_id: placeId,
                status: prev.status || 'OK',
                website: null,
                seo: {
                  ok: false,
                  reason: 'website_missing',
                  indexability: null,
                  meta: null,
                  schema: null,
                },
                opportunity: {
                  website_offer: true,
                  priority: 'high',
                },
              };

              updateLogRowStmt.run(JSON.stringify(next), existing.row_id);
            }
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

    // (SEO signals/opportunity are now embedded in the WEBSITE_MISSING and TECH_STUB events)

    if (!website || !wantsTech) continue;

    // very light tech heuristic (same philosophy as dataFeederWorker)
    const w = String(website).toLowerCase();
    const tech = [];
    if (w.includes('wix')) tech.push('wix');
    if (w.includes('webflow')) tech.push('webflow');
    if (w.includes('shopify')) tech.push('shopify');
    if (w.includes('wordpress')) tech.push('wordpress');

    const alreadyTech = hasTechStubLogStmt.get(jobId, placeId);
    if (alreadyTech) {
      const existing = readLogRowStmt.get(jobId, 'DEEP_ENRICHMENT_TECH_STUB', placeId);

      if (existing?.payload_json && !String(existing.payload_json).includes('"seo"')) {
        let prev = {};
        try {
          prev = JSON.parse(existing.payload_json);
        } catch (_) {
          prev = {};
        }

        const seo = await (async () => {
          try {
            const res = await fetch(website, { redirect: 'follow' });
            const html = await res.text().catch(() => null);
            const out = extractSeoSignalsFromHtml(html);
            return {
              ok: out.ok,
              reason: out.reason,
              ...(out.seo || {}),
            };
          } catch (e) {
            return { ok: false, reason: 'fetch_failed' };
          }
        })();

        // 2.D.3.4 — Social signals extraction from HTML
        const social = extractSocialSignalsFromHtml(
          (() => {
            try {
              // html may be undefined if fetch failed
              return typeof html === 'string' ? html : '';
            } catch (_) {
              return '';
            }
          })(),
        );

        // Emit SEO-only event if not already present
        const alreadySeo = hasSeoSignalsLogStmt.get(jobId, placeId);
        if (!alreadySeo) {
          insertLog.run({
            job_id: jobId,
            event_type: 'DEEP_ENRICHMENT_SEO_SIGNALS',
            payload_json: JSON.stringify({
              job_id: jobId,
              google_place_id: placeId,
              website,
              seo,
            }),
            created_at: new Date().toISOString(),
          });
        }

        // Emit SOCIAL_SIGNALS event if not already present
        const alreadySocial = hasSocialSignalsLogStmt.get(jobId, placeId);
        if (!alreadySocial) {
          insertLog.run({
            job_id: jobId,
            event_type: 'DEEP_ENRICHMENT_SOCIAL_SIGNALS',
            payload_json: JSON.stringify({
              job_id: jobId,
              google_place_id: placeId,
              website,
              social,
            }),
            created_at: new Date().toISOString(),
          });
        }

        // 2.D.3.3 — Emit DEEP_ENRICHMENT_OPPORTUNITY_SCORE event (idempotent, after SEO)
        const alreadyOpp = hasOpportunityScoreLogStmt.get(jobId, placeId);
        if (!alreadyOpp) {
          const opportunity = computeOpportunity({ website, seo, tech });
          insertLog.run({
            job_id: jobId,
            event_type: 'DEEP_ENRICHMENT_OPPORTUNITY_SCORE',
            payload_json: JSON.stringify({
              job_id: jobId,
              google_place_id: placeId,
              website,
              seo,
              tech,
              opportunity,
            }),
            created_at: new Date().toISOString(),
          });
        }

        const next = {
          ...prev,
          job_id: jobId,
          google_place_id: placeId,
          website,
          seo,
          tech: Array.isArray(prev.tech) ? prev.tech : tech,
        };

        updateLogRowStmt.run(JSON.stringify(next), existing.row_id);
      }

      continue;
    }

    // Fetch SEO signals for fresh TECH_STUB
    let html;
    const seo = await (async () => {
      try {
        const res = await fetch(website, { redirect: 'follow' });
        html = await res.text().catch(() => null);
        const out = extractSeoSignalsFromHtml(html);
        return {
          ok: out.ok,
          reason: out.reason,
          ...(out.seo || {}),
        };
      } catch (e) {
        return { ok: false, reason: 'fetch_failed' };
      }
    })();

    // 2.D.3.4 — Social signals extraction from HTML (fresh path)
    const social = extractSocialSignalsFromHtml(
      (() => {
        try {
          return typeof html === 'string' ? html : '';
        } catch (_) {
          return '';
        }
      })(),
    );

    insertLog.run({
      job_id: jobId,
      event_type: 'DEEP_ENRICHMENT_TECH_STUB',
      payload_json: JSON.stringify({
        job_id: jobId,
        google_place_id: placeId,
        website,
        seo,
        tech,
      }),
      created_at: new Date().toISOString(),
    });

    // Emit SEO-only event if not already present (for fresh TECH_STUB insert)
    const alreadySeo = hasSeoSignalsLogStmt.get(jobId, placeId);
    if (!alreadySeo) {
      insertLog.run({
        job_id: jobId,
        event_type: 'DEEP_ENRICHMENT_SEO_SIGNALS',
        payload_json: JSON.stringify({
          job_id: jobId,
          google_place_id: placeId,
          website,
          seo,
        }),
        created_at: new Date().toISOString(),
      });
    }

    // Emit SOCIAL_SIGNALS event if not already present (fresh path)
    const alreadySocial = hasSocialSignalsLogStmt.get(jobId, placeId);
    if (!alreadySocial) {
      insertLog.run({
        job_id: jobId,
        event_type: 'DEEP_ENRICHMENT_SOCIAL_SIGNALS',
        payload_json: JSON.stringify({
          job_id: jobId,
          google_place_id: placeId,
          website,
          social,
        }),
        created_at: new Date().toISOString(),
      });
    }

    // 2.D.3.3 — Emit DEEP_ENRICHMENT_OPPORTUNITY_SCORE event (idempotent, after SEO)
    const alreadyOpp = hasOpportunityScoreLogStmt.get(jobId, placeId);
    if (!alreadyOpp) {
      const opportunity = computeOpportunity({ website, seo, tech });
      insertLog.run({
        job_id: jobId,
        event_type: 'DEEP_ENRICHMENT_OPPORTUNITY_SCORE',
        payload_json: JSON.stringify({
          job_id: jobId,
          google_place_id: placeId,
          website,
          seo,
          tech,
          opportunity,
        }),
        created_at: new Date().toISOString(),
      });
    }

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