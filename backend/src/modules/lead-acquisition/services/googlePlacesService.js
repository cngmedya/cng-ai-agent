// backend/src/modules/lead-acquisition/services/googlePlacesService.js

const axios = require("axios");
const { log } = require("../../../lib/logger");

const GOOGLE_PLACES_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || "";

const PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";

/**
 * Basit Text Search
 */
async function textSearch({ query }) {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY tanımlı değil.");
  }

  const url = `${PLACES_BASE_URL}/textsearch/json`;

  const resp = await axios.get(url, {
    params: {
      key: GOOGLE_PLACES_API_KEY,
      query,
    },
    timeout: 10000,
  });

  if (resp.data.status !== "OK" && resp.data.status !== "ZERO_RESULTS") {
    log.warn("[GooglePlaces] Text search status", resp.data);
  }

  const results = resp.data.results || [];
  return { results, raw: resp.data };
}

/**
 * Place Details: website, telefon vs. çekmek için
 */
async function getPlaceDetails(placeId) {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY tanımlı değil.");
  }

  const url = `${PLACES_BASE_URL}/details/json`;

  const resp = await axios.get(url, {
    params: {
      key: GOOGLE_PLACES_API_KEY,
      place_id: placeId,
      fields:
        "name,formatted_address,geometry,website,formatted_phone_number,international_phone_number,types,url,business_status",
    },
    timeout: 10000,
  });

  if (resp.data.status !== "OK") {
    log.warn("[GooglePlaces] Place details status", {
      placeId,
      status: resp.data.status,
    });
  }

  return resp.data.result || {};
}

/**
 * Text Search + Place Details kombinasyonu.
 * place.website varsa → doğrudan lead kaydında kullanacağız.
 */
async function searchPlacesWithTextAndDetails({ location, keyword, radius }) {
  const query =
    keyword && location ? `${keyword} ${location}` : keyword || location;

  log.info("[LeadAcq] Google Places text search çağrısı", {
    query,
    radius,
  });

  const { results, raw } = await textSearch({ query });

  const places = [];

  for (const r of results) {
    const placeId = r.place_id;
    let details = {};

    try {
      details = await getPlaceDetails(placeId);
    } catch (err) {
      log.warn("[GooglePlaces] Place details hatası", {
        placeId,
        error: err?.message || String(err),
      });
    }

    const website =
      details.website && typeof details.website === "string"
        ? details.website
        : null;

    const phone =
      details.formatted_phone_number ||
      details.international_phone_number ||
      null;

    places.push({
      place_id: placeId,
      name: details.name || r.name,
      formatted_address: details.formatted_address || r.formatted_address,
      location:
        (details.geometry && details.geometry.location) ||
        (r.geometry && r.geometry.location) ||
        null,
      website,
      phone,
      types: details.types || r.types || [],
      raw: {
        text: r,
        details,
      },
    });
  }

  log.info("[LeadAcq] Google Places sonuç sayısı (details ile)", {
    count: places.length,
  });

  return { places, raw };
}

module.exports = {
  searchPlacesWithTextAndDetails,
};