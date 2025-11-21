// backend/src/modules/lead-acquisition/services/googlePlacesService.js

const axios = require("axios");
const { log } = require("../../../lib/logger");

const GOOGLE_PLACES_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || "";

// Basit text search yaklaşımı: "keyword + location" → query
async function searchPlacesWithText({ location, keyword, radius }) {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY tanımlı değil.");
  }

  const query = `${keyword} ${location}`.trim();
  const url = "https://maps.googleapis.com/maps/api/place/textsearch/json";

  log("INFO", "[LeadAcq] Google Places text search çağrısı", {
    query,
    radius,
  });

  const params = {
    query,
    key: GOOGLE_PLACES_API_KEY,
    radius,
    // language: "tr", // istersen ileride ekleyebiliriz
  };

  const response = await axios.get(url, { params });
  const data = response.data || {};

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    log("WARN", "[LeadAcq] Google Places beklenmedik status", {
      status: data.status,
      error_message: data.error_message,
    });
  }

  return {
    raw: data,
    places: Array.isArray(data.results) ? data.results : [],
  };
}

module.exports = {
  searchPlacesWithText,
};