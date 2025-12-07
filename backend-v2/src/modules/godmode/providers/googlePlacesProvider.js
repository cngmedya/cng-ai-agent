"use strict";

async function discoverWithGooglePlaces(criteria = {}) {
  const city = criteria.city || null;
  const country = criteria.country || null;
  const categories = Array.isArray(criteria.categories) ? criteria.categories : [];
  const maxResults = typeof criteria.maxResults === "number" ? criteria.maxResults : 50;
  const minGoogleRating = typeof criteria.minGoogleRating === "number" ? criteria.minGoogleRating : 0;

  return {
    provider: "google_places",
    criteria: { city, country, categories, maxResults, minGoogleRating },
    stats: {
      found_leads: 0,
      enriched_leads: 0
    },
    leads: []
  };
}

module.exports = {
  providerKey: "google_places",
  discoverWithGooglePlaces
};
