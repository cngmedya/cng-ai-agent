// backend-v2/src/modules/godmode/providers/providersRunner.js

const { runGooglePlacesDiscovery } = require('./googlePlacesProvider');

async function runDiscoveryProviders(criteria) {
  const leads = [];
  const providersUsed = [];
  const usedCategories = [];

  const channels = Array.isArray(criteria?.channels)
    ? criteria.channels
    : ['google_places'];

  if (channels.includes('google_places')) {
    const gp = await runGooglePlacesDiscovery(criteria);
    providersUsed.push('google_places');
    if (Array.isArray(gp.used_categories)) {
      usedCategories.push(...gp.used_categories);
    }
    if (Array.isArray(gp.leads)) {
      leads.push(...gp.leads);
    }
  }

  return {
    leads,
    providers_used: Array.from(new Set(providersUsed)),
    used_categories: Array.from(new Set(usedCategories)),
  };
}

module.exports = {
  runDiscoveryProviders,
};