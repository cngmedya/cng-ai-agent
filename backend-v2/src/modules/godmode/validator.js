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

function validateDiscoveryPayload(payload) {
  const issues = [];

  if (!payload || typeof payload !== 'object') {
    issues.push({ field: 'payload', message: 'Payload is required' });
    throw new ValidationError('Discovery job validation failed', issues);
  }

  const city = isNonEmptyString(payload.city) ? payload.city.trim() : null;
  const country = isNonEmptyString(payload.country) ? payload.country.trim() : null;

  if (!city) {
    issues.push({ field: 'city', message: 'city is required' });
  }
  if (!country) {
    issues.push({ field: 'country', message: 'country is required' });
  }

  let categories = [];
  if (Array.isArray(payload.categories)) {
    categories = payload.categories
      .map(v => (typeof v === 'string' ? v.trim() : String(v || '')))
      .filter(v => v.length > 0);
  } else if (typeof payload.categories === 'undefined') {
    categories = [];
  } else {
    issues.push({ field: 'categories', message: 'categories must be an array of strings' });
  }

  let minGoogleRating = typeof payload.minGoogleRating === 'number' ? payload.minGoogleRating : 0;
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
  if (typeof payload.maxResults === 'number' && !Number.isNaN(payload.maxResults)) {
    maxResults = payload.maxResults;
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
  if (typeof payload.channels === 'undefined') {
    channels = ['google_places'];
  } else {
    channels = ensureStringArray(payload.channels, 'channels', issues);
  }

  let notes = null;
  if (typeof payload.notes === 'string') {
    notes = payload.notes.trim() || null;
  } else if (typeof payload.notes !== 'undefined' && payload.notes !== null) {
    notes = String(payload.notes);
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
    notes,
  };
}

module.exports = {
  ValidationError,
  validateDiscoveryPayload,
};