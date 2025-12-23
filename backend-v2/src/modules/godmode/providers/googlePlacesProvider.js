/**
 * Google Places Provider (GODMODE PAL compatible)
 *
 * Bu modül, Provider Abstraction Layer (PAL) için standart interface'i
 * uygulayan Google Places discovery provider'ıdır.
 *
 * Zorunlu alanlar:
 *  - id: 'google_places'
 *  - label: string
 *  - channels: string[]
 *  - async discover(criteria, ctx?) -> { leads, stats, errors }
 */

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const ENABLE_PLACE_DETAILS = process.env.GODMODE_DEEP_ENRICHMENT === '1';
const PLACE_DETAILS_FIELDS = 'website';
const PLACE_DETAILS_DELAY_MS = Number(process.env.GOOGLE_PLACES_DETAILS_DELAY_MS || 1200);

if (!GOOGLE_PLACES_API_KEY) {
  // Bu modül yüklendiğinde env yoksa da patlamasın,
  // sadece run/discover sırasında hata fırlatacağız.
}

async function callGooglePlacesTextSearch(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Google Places API HTTP error: ${resp.status}`);
  }
  const data = await resp.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API status: ${data.status}`);
  }
  return data;
}

async function callGooglePlacesDetails(placeId) {
  if (!ENABLE_PLACE_DETAILS) return null;

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId,
  )}&fields=${PLACE_DETAILS_FIELDS}&key=${GOOGLE_PLACES_API_KEY}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Google Places Details HTTP error: ${resp.status}`);
  }

  const data = await resp.json();
  if (data.status !== 'OK') {
    return null;
  }

  // Rate-limit safety
  await new Promise(r => setTimeout(r, PLACE_DETAILS_DELAY_MS));

  return data?.result || null;
}

async function healthCheckGooglePlaces(options = {}) {
  if (!GOOGLE_PLACES_API_KEY) {
    const err = new Error('GOOGLE_PLACES_API_KEY_missing');
    err.code = 'GOOGLE_PLACES_API_KEY_missing';
    throw err;
  }

  const query =
    typeof options.query === 'string' && options.query.trim().length > 0
      ? options.query.trim()
      : 'reklam ajansı Istanbul Turkey';

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    query,
  )}&key=${GOOGLE_PLACES_API_KEY}`;

  const data = await callGooglePlacesTextSearch(url);

  return {
    ok: true,
    meta: {
      status: data?.status || null,
      resultsCount: Array.isArray(data?.results) ? data.results.length : 0,
    },
  };
}

/**
 * Eski core discovery fonksiyonumuz
 * PAL discover() bunun üzerine oturuyor.
 */
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
  } = criteria || {};

  if (!city || !country) {
    throw new Error('Google Places discovery için city ve country zorunlu.');
  }

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

      const data = await callGooglePlacesTextSearch(url);

      const results = data.results || [];
      for (const r of results) {
        if (leads.length >= maxResults) break;

        const rating = typeof r.rating === 'number' ? r.rating : 0;

        if (rating < minGoogleRating) continue;

        const reviews = typeof r.user_ratings_total === 'number' ? r.user_ratings_total : 0;
        const status = r.business_status || null;

        // Basit confidence (0-100): rating + review volume + business_status
        const confidence =
          Math.max(0, Math.min(100, Math.round(
            (rating / 5) * 55 +
              Math.min(30, Math.log10(Math.max(1, reviews)) * 10) +
              (status === 'OPERATIONAL' ? 15 : 5),
          )));

        const mapsUrl = r.place_id
          ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(r.place_id)}`
          : null;

        let website = null;
        try {
          if (ENABLE_PLACE_DETAILS && r.place_id) {
            const details = await callGooglePlacesDetails(r.place_id);
            website = details?.website || null;
          }
        } catch (e) {
          website = null;
        }

        leads.push({
          provider: 'google_places',
          provider_id: r.place_id,
          place_id: r.place_id,
          name: r.name,
          website,
          address: r.formatted_address || null,
          city,
          country,
          rating,
          user_ratings_total: reviews,
          types: r.types || [],
          business_status: status,
          location:
            r.geometry && r.geometry.location ? r.geometry.location : null,
          source_confidence: confidence,
          raw: {
            reference: r.reference || null,
            maps_url: mapsUrl,
            query,
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

// PAL interface implementation
const id = 'google_places';
const label = 'Google Places';
const channels = ['google_places'];

/**
 * PAL uyumlu discover fonksiyonu.
 *
 * Dönüş formatı:
 *  {
 *    leads: Lead[],
 *    stats: { provider_id, provider_label, used_categories, raw_providers_used },
 *    errors: NormalizedProviderError[]
 *  }
 */
async function discover(criteria, ctx = {}) {
  // ctx şimdilik kullanılmıyor ama ileride tracing / jobId gibi bilgiler gelebilir.
  const base = await runGooglePlacesDiscovery(criteria);

  const leads = Array.isArray(base.leads) ? base.leads : [];
  const usedCategories = Array.isArray(base.used_categories)
    ? base.used_categories
    : [];

  const stats = {
    provider_id: id,
    provider_label: label,
    used_categories: usedCategories,
    raw_providers_used: base.providers_used || ['google_places'],
  };

  return {
    leads,
    stats,
    errors: [],
  };
}

module.exports = {
  id,
  label,
  channels,
  discover,
  healthCheckGooglePlaces,
  // Eski core fonksiyona ihtiyaç duyulursa diye export etmeye devam ediyoruz
  runGooglePlacesDiscovery,
};