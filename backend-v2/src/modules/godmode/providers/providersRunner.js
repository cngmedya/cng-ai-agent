// backend-v2/src/modules/godmode/providers/providersRunner.js

const {
  getProvidersByChannels,
  runProviderDiscover,
} = require('./index');

/**
 * GODMODE Discovery Providers Runner (Faz 2 PAL integration)
 *
 * Bu katman, verilen kriterlere göre doğru provider setini seçer
 * ve her birini çalıştırarak birleşik bir discovery sonucu döner.
 *
 * Dönüş formatı:
 * {
 *   leads: [...],                // tüm provider'lardan gelen birleşik lead listesi
 *   providers_used: [...],       // kullanılan provider id'leri (örn: ['google_places'])
 *   used_categories: [...],      // provider'ların efektif olarak kullandığı kategori listesi
 *   provider_errors: [           // provider bazlı hata listesi
 *     {
 *       provider_id: 'google_places',
 *       error: 'HTTP 403 ...'
 *     }
 *   ]
 * }
 */
async function runDiscoveryProviders(criteria) {
  const channels = Array.isArray(criteria?.channels)
    ? criteria.channels
    : [];

  // Seçili channel'lara göre provider listesi
  const providers = getProvidersByChannels(channels);

  const allLeads = [];
  const providersUsed = new Set();
  const usedCategories = new Set();
  const providerErrors = [];

  // Not: Şimdilik sequential; Faz 2.C'de paralel execution (Promise.all) düşünülebilir
  for (const provider of providers) {
    try {
      const result = await runProviderDiscover(provider, criteria);
      if (!result) continue;

      providersUsed.add(provider.id);

      if (Array.isArray(result.used_categories)) {
        for (const cat of result.used_categories) {
          usedCategories.add(cat);
        }
      }

      if (Array.isArray(result.leads)) {
        allLeads.push(...result.leads);
      }

      if (Array.isArray(result.provider_errors) && result.provider_errors.length > 0) {
        providerErrors.push(
          ...result.provider_errors.map(err => ({
            provider_id: provider.id,
            ...err,
          })),
        );
      }
    } catch (err) {
      providerErrors.push({
        provider_id: provider.id,
        error: String(err && err.message ? err.message : err),
      });
    }
  }

  return {
    leads: allLeads,
    providers_used: Array.from(providersUsed),
    used_categories: Array.from(usedCategories),
    provider_errors: providerErrors,
  };
}

module.exports = {
  runDiscoveryProviders,
};