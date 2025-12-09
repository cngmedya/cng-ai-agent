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

    // Provider kendi used_categories bilgisini veriyorsa onu topla
    if (Array.isArray(gp.used_categories) && gp.used_categories.length > 0) {
      usedCategories.push(...gp.used_categories);
    }

    if (Array.isArray(gp.leads)) {
      leads.push(...gp.leads);
    }
  }

  // === used_categories fallback mantığı ===
  // Eğer provider seviyesinde hiç kategori toplanmadıysa,
  // şimdilik doğrudan criteria.categories'i kullanıyoruz.
  let effectiveUsedCategories = usedCategories;

  if (
    (!Array.isArray(effectiveUsedCategories) ||
      effectiveUsedCategories.length === 0) &&
    Array.isArray(criteria?.categories)
  ) {
    effectiveUsedCategories = [...criteria.categories];
  }

  return {
    leads,
    providers_used: Array.from(new Set(providersUsed)),
    used_categories: Array.from(new Set(effectiveUsedCategories || [])),
  };
}

module.exports = {
  runDiscoveryProviders,
};