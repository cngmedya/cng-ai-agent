// backend-v2/src/modules/discovery/placesClient.js
const axios = require('axios');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

/**
 * Tek bir Text Search isteği
 * - query: "mimarlık ofisi İstanbul Türkiye" gibi
 * - pageToken: Google'ın next_page_token'ı (opsiyonel)
 */
async function fetchPlacesPage({ query, pageToken }) {
  if (!API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY tanımlı değil (.env içinde)');
  }

  const params = {
    key: API_KEY,
    query
  };

  if (pageToken) {
    params.pagetoken = pageToken;
  }

  const res = await axios.get(BASE_URL, { params });

  if (res.data.status !== 'OK' && res.data.status !== 'ZERO_RESULTS') {
    throw new Error(
      `Google Places hata: ${res.data.status} - ${res.data.error_message || ''}`
    );
  }

  return {
    results: res.data.results || [],
    nextPageToken: res.data.next_page_token || null
  };
}

/**
 * Birden fazla sayfa çekebilir (maxPages: 1–3 arası mantıklı)
 */
async function searchPlacesText({ query, maxPages = 1 }) {
  let allResults = [];
  let nextPageToken = null;
  let page = 0;

  do {
    page += 1;

    const { results, nextPageToken: token } = await fetchPlacesPage({
      query,
      pageToken: nextPageToken
    });

    allResults = allResults.concat(results);
    nextPageToken = token;

    // Daha fazla sayfa yoksa kır
    if (!nextPageToken) break;
    if (page >= maxPages) break;

    // Google Places requirement: next_page_token kullanılmadan önce ~2 saniye bekle
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } while (nextPageToken);

  return allResults;
}

module.exports = {
  searchPlacesText
};