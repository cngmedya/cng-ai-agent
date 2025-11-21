// backend/src/lead-engine/google/googleParser.js

/**
 * Google Places sonucunu normalize eder.
 */
function normalizeGooglePlace(place) {
  return {
    source: "google",
    placeId: place.place_id || null,
    name: place.name || "",
    address: place.formatted_address || "",
    rating:
      typeof place.rating === "number" ? place.rating : null,
    userRatingsTotal: place.user_ratings_total || 0,
    types: place.types || [],
    location: place.geometry?.location || null,
    website: place.website || null,
    phoneNumber: place.formatted_phone_number || null,
  };
}

function parseGooglePlaces(results = []) {
  return results.map(normalizeGooglePlace);
}

module.exports = { normalizeGooglePlace, parseGooglePlaces };