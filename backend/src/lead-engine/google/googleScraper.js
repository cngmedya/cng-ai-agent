// backend/src/lead-engine/google/googleScraper.js

const { config } = require("../../config/env");
const { log } = require("../../lib/logger");

const GOOGLE_PLACES_TEXT_URL =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACES_DETAILS_URL =
  "https://maps.googleapis.com/maps/api/place/details/json";

/**
 * Basit Text Search: "mimarlık ofisi Istanbul" gibi
 */
async function textSearchPlaces({ query, location, limit = 20 }) {
  if (!config.googleApiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY tanımlı değil.");
  }

  const q = `${query} ${location}`.trim();
  const url = `${GOOGLE_PLACES_TEXT_URL}?query=${encodeURIComponent(
    q
  )}&key=${config.googleApiKey}&region=tr`;

  log.info("Google Places Text Search:", q);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log.error(
      "Google Places Text Search hata:",
      res.status,
      text.slice(0, 200)
    );
    throw new Error(`Google Places API hatası: ${res.status}`);
  }

  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.slice(0, limit);
}

/**
 * Place Details: place_id üzerinden website, telefon vb. detaylar
 */
async function getPlaceDetails(placeId) {
  if (!config.googleApiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY tanımlı değil.");
  }

  const url = `${GOOGLE_PLACES_DETAILS_URL}?place_id=${encodeURIComponent(
    placeId
  )}&key=${config.googleApiKey}&region=tr&fields=website,formatted_phone_number`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log.error(
      "Google Places Details hata:",
      res.status,
      text.slice(0, 200)
    );
    throw new Error(`Google Places Details API hatası: ${res.status}`);
  }

  const data = await res.json();
  return data.result || {};
}

/**
 * Text Search + Place Details birleşik fonksiyon.
 * Çıktı: Text search sonuçları + mümkünse website & telefon eklenmiş hali.
 */
async function searchGooglePlacesWithDetails({ query, location, limit = 10 }) {
  const baseResults = await textSearchPlaces({ query, location, limit });

  const detailedResults = await Promise.all(
    baseResults.map(async (place) => {
      if (!place.place_id) return place;

      try {
        const details = await getPlaceDetails(place.place_id);
        return {
          ...place,
          website: details.website || null,
          formatted_phone_number: details.formatted_phone_number || null,
        };
      } catch (err) {
        log.error(
          "Place details alınırken hata:",
          place.place_id,
          err.message
        );
        return place;
      }
    })
  );

  return detailedResults;
}

module.exports = { searchGooglePlacesWithDetails };