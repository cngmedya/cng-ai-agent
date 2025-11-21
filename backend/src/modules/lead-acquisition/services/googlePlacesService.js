// backend/src/modules/lead-acquisition/services/googlePlacesService.js

const axios = require("axios");
const { log } = require("../../../lib/logger");
const { config } = require("../../../config/env");

// ENV → Google Places API Key
const GOOGLE_PLACES_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY || config.googlePlacesApiKey;

/**
 * Google Places Text Search + (opsiyonel) Details
 *
 * Input:
 *  - location: "İstanbul"
 *  - keyword: "mimarlık ofisi"
 *  - radius: metre (örn: 8000)
 *
 * Output:
 *  {
 *    places: [ ...detaylı place objeleri... ],
 *    raw: text search'in ham JSON cevabı
 *  }
 */
async function searchPlacesWithTextAndDetails({ location, keyword, radius }) {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Google Places API anahtarı tanımlı değil.");
  }

  const radiusValue = radius || 8000;
  const query = `${keyword} ${location}`.trim();

  log.info("[LeadAcq] Google Places text search çağrısı", {
    query,
    radius: radiusValue,
  });

  const textSearchUrl =
    "https://maps.googleapis.com/maps/api/place/textsearch/json";

  // 1) Text Search çağrısı
  const textResp = await axios.get(textSearchUrl, {
    params: {
      query,
      radius: radiusValue,
      key: GOOGLE_PLACES_API_KEY,
      language: "tr",
    },
  });

  const textData = textResp.data || {};
  const basePlaces = textData.results || [];

  // 2) Detay log
  log.info("[LeadAcq] Google Places sonuç sayısı (details ile)", {
    count: basePlaces.length,
  });

  // 3) Details çağrıları
  const detailsUrl =
    "https://maps.googleapis.com/maps/api/place/details/json";

  const placesWithDetails = [];

  for (const place of basePlaces) {
    // place_id yoksa direk ekle
    if (!place.place_id) {
      placesWithDetails.push(place);
      continue;
    }

    try {
      const detailsResp = await axios.get(detailsUrl, {
        params: {
          place_id: place.place_id,
          key: GOOGLE_PLACES_API_KEY,
          language: "tr",
          // V1 için temel bilgiler yeterli:
          fields:
            "website,formatted_phone_number,international_phone_number",
        },
      });

      const details = (detailsResp.data && detailsResp.data.result) || {};

      // Website + telefon gibi alanları ana place objesinin üstüne merge ediyoruz
      const merged = {
        ...place,
        website: details.website || place.website || null,
        phone:
          details.international_phone_number ||
          details.formatted_phone_number ||
          place.formatted_phone_number ||
          null,
        _details: details, // İstersek normalize sırasında kullanırız
      };

      placesWithDetails.push(merged);
    } catch (err) {
      log.warn("[LeadAcq] Google Places details çağrısı hatası", {
        placeId: place.place_id,
        error: err.message,
      });

      // Hata olsa bile en azından text search sonucunu koruyalım
      placesWithDetails.push(place);
    }
  }

  return {
    places: placesWithDetails,
    raw: textData,
  };
}

module.exports = {
  searchPlacesWithTextAndDetails,
};