"use strict";

const { discoverWithGooglePlaces, providerKey: googlePlacesKey } = require("./googlePlacesProvider");

async function runDiscoveryProviders(criteria = {}) {
  const results = [];

  const googleResult = await discoverWithGooglePlaces(criteria);
  results.push(googleResult);

  const aggregated = {
    providers: results.map(r => r.provider),
    stats: {
      found_leads: results.reduce((sum, r) => sum + (r.stats?.found_leads || 0), 0),
      enriched_leads: results.reduce((sum, r) => sum + (r.stats?.enriched_leads || 0), 0)
    },
    leads: results.flatMap(r => r.leads || []),
    raw_by_provider: results
  };

  return aggregated;
}

module.exports = {
  runDiscoveryProviders
};
