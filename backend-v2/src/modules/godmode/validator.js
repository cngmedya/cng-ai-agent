'use strict';

const MAX_RESULTS_HARD_LIMIT = 250;
const MIN_RESULTS = 1;
const MIN_RATING = 0;
const MAX_RATING = 5;

class ValidationError extends Error {
  constructor(message, issues) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.issues = issues || [];
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function ensureStringArray(arr, fieldName, issues) {
  if (!Array.isArray(arr)) {
    issues.push({ field: fieldName, message: `${fieldName} must be an array of strings` });
    return [];
  }
  const cleaned = arr
    .map(v => (typeof v === 'string' ? v.trim() : String(v || '')))
    .filter(v => v.length > 0);
  if (!cleaned.length) {
    issues.push({ field: fieldName, message: `${fieldName} must contain at least one item` });
  }
  return cleaned;
}

function clampNumber(n, min, max) {
  if (!Number.isFinite(Number(n))) return null;
  const v = Number(n);
  return Math.max(min, Math.min(max, v));
}

function parseProviderWeights(input, issues) {
  if (typeof input === 'undefined' || input === null) return null;

  const out = {};

  // Accept object map: { google_places: 1.0, yelp: 0.9 }
  if (typeof input === 'object' && !Array.isArray(input)) {
    for (const [k, v] of Object.entries(input)) {
      const key = typeof k === 'string' ? k.trim() : String(k || '');
      if (!key) continue;

      const w = clampNumber(v, 0, 2);
      if (w === null) {
        issues.push({ field: 'providerWeights', message: `Invalid weight for ${key}` });
        continue;
      }

      out[key] = w;
    }

    return Object.keys(out).length ? out : null;
  }

  // Accept string: "google_places=1.0,yelp=0.9"
  if (typeof input === 'string') {
    const parts = input.split(',').map(s => s.trim()).filter(Boolean);

    for (const p of parts) {
      const [kRaw, vRaw] = p.split('=').map(s => (s || '').trim());
      if (!kRaw) continue;

      const w = clampNumber(vRaw, 0, 2);
      if (w === null) {
        issues.push({ field: 'providerWeights', message: `Invalid weight for ${kRaw}` });
        continue;
      }

      out[kRaw] = w;
    }

    return Object.keys(out).length ? out : null;
  }

  issues.push({ field: 'providerWeights', message: 'providerWeights must be an object map or a "k=v,k=v" string' });
  return null;
}

function validateDiscoveryPayload(payload) {
  const issues = [];

  if (!payload || typeof payload !== 'object') {
    issues.push({ field: 'payload', message: 'Payload is required' });
    throw new ValidationError('Discovery job validation failed', issues);
  }

  const src =
    payload.criteria && typeof payload.criteria === 'object' && !Array.isArray(payload.criteria)
      ? payload.criteria
      : payload;

  const city = isNonEmptyString(src.city) ? src.city.trim() : null;
  const country = isNonEmptyString(src.country) ? src.country.trim() : null;

  if (!city) {
    issues.push({ field: 'city', message: 'city is required' });
  }
  if (!country) {
    issues.push({ field: 'country', message: 'country is required' });
  }

  let categories = [];
  if (Array.isArray(src.categories)) {
    categories = src.categories
      .map(v => (typeof v === 'string' ? v.trim() : String(v || '')))
      .filter(v => v.length > 0);
  } else if (typeof src.categories === 'undefined') {
    categories = [];
  } else {
    issues.push({ field: 'categories', message: 'categories must be an array of strings' });
  }

  let minGoogleRating = typeof src.minGoogleRating === 'number' ? src.minGoogleRating : 0;
  if (Number.isNaN(minGoogleRating)) {
    minGoogleRating = 0;
  }
  if (minGoogleRating < MIN_RATING || minGoogleRating > MAX_RATING) {
    issues.push({
      field: 'minGoogleRating',
      message: `minGoogleRating must be between ${MIN_RATING} and ${MAX_RATING}`,
    });
  }

  let maxResults;
  if (typeof src.maxResults === 'number' && !Number.isNaN(src.maxResults)) {
    maxResults = src.maxResults;
  } else {
    maxResults = MAX_RESULTS_HARD_LIMIT;
  }
  if (maxResults < MIN_RESULTS) {
    maxResults = MIN_RESULTS;
  }
  if (maxResults > MAX_RESULTS_HARD_LIMIT) {
    maxResults = MAX_RESULTS_HARD_LIMIT;
  }

  let channels;
  if (typeof src.channels === 'undefined') {
    channels = ['google_places'];
  } else {
    channels = ensureStringArray(src.channels, 'channels', issues);
  }

  const parallel =
    typeof src.parallel === 'boolean' ? src.parallel : true;

  const bypassRateLimit =
    typeof src.bypassRateLimit === 'boolean' ? src.bypassRateLimit : false;

  const forceRefresh =
    typeof src.forceRefresh === 'boolean' ? src.forceRefresh : false;

  const providerWeights = parseProviderWeights(src.providerWeights, issues);

  let notes = null;
  if (typeof src.notes === 'string') {
    notes = src.notes.trim() || null;
  } else if (typeof src.notes !== 'undefined' && src.notes !== null) {
    notes = String(src.notes);
  }

  if (issues.length > 0) {
    throw new ValidationError('Discovery job validation failed', issues);
  }

  return {
    city,
    country,
    categories,
    minGoogleRating,
    maxResults,
    channels,
    parallel,
    bypassRateLimit,
    forceRefresh,
    providerWeights,
    notes,
  };
}

module.exports = {
  ValidationError,
  validateDiscoveryPayload,
};