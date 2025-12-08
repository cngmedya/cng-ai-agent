/**
 * GODMODE Provider Abstraction Layer (PAL)
 *
 * Buradaki amaç:
 * - Tüm discovery provider'larını tek merkezden yönetmek
 * - Her provider için ortak bir interface zorunlu kılmak:
 *    - id: string (örn: "google_places")
 *    - label: string (örn: "Google Places")
 *    - async discover(criteria, ctx) -> { leads, stats?, errors? }
 *    - async healthCheck?() -> { ok: boolean, details?: any }
 *
 * Faz 2 boyunca yeni provider eklemek:
 *  1) providers/ klasöründe <providerName>Provider.js oluştur
 *  2) Buraya import et ve REGISTRY içine ekle
 */

const googlePlacesProvider = require('./googlePlacesProvider');

// Gelecekte buraya eklenecek örnekler:
// const linkedinProvider = require('./linkedinProvider');
// const instagramProvider = require('./instagramBusinessProvider');
// const facebookProvider = require('./facebookBusinessProvider');
// const yelpProvider = require('./yelpProvider');

const REGISTRY = {};

// Güvenli register helper — ileride duplicate id yakalamak için kullanışlı
function registerProvider(providerModule) {
  if (!providerModule || !providerModule.id) {
    throw new Error(
      '[GODMODE][PAL] registerProvider: providerModule.id eksik veya geçersiz',
    );
  }

  if (REGISTRY[providerModule.id]) {
    console.warn(
      `[GODMODE][PAL] registerProvider: "${providerModule.id}" zaten kayıtlı, üzerine yazılıyor.`,
    );
  }

  REGISTRY[providerModule.id] = providerModule;
}

// 🔗 Kayıtlı provider’ları burada topluyoruz
registerProvider(googlePlacesProvider);
// registerProvider(linkedinProvider);
// registerProvider(instagramProvider);
// registerProvider(facebookProvider);
// registerProvider(yelpProvider);

/**
 * Tek bir provider id'si ile provider objesini getirir.
 */
function getProvider(id) {
  return REGISTRY[id] || null;
}

/**
 * Birden fazla id ile provider listesi getirir.
 * Eğer ids boş / geçersiz ise: tüm kayıtlı provider’ları döner.
 */
function getProvidersByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return Object.values(REGISTRY);
  }

  const wanted = new Set(ids.map(String));
  return Object.values(REGISTRY).filter(p => wanted.has(p.id));
}

function getProvidersByChannels(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    return Object.values(REGISTRY);
  }

  const wanted = new Set(channels.map(String));

  return Object.values(REGISTRY).filter(provider => {
    const providerChannels = Array.isArray(provider.channels) && provider.channels.length > 0
      ? provider.channels.map(String)
      : [String(provider.id)];

    return providerChannels.some(ch => wanted.has(ch));
  });
}

/**
 * Admin / debug amaçlı: kayıtlı provider’ların kısa listesini verir.
 */
function listProviders() {
  return Object.values(REGISTRY).map(p => ({
    id: p.id,
    label: p.label || p.id,
    // Faz 2'de bazı provider'lar birden fazla "channel" ismiyle anılabilir
    channels: Array.isArray(p.channels) && p.channels.length > 0
      ? p.channels
      : [p.id],
  }));
}

/**
 * Tek bir provider discover çağrısını normalize eden helper.
 *
 * Beklenen provider.discover sonucu:
 *  {
 *    leads: Lead[],
 *    stats?: { ... },
 *    errors?: NormalizedProviderError[]
 *  }
 *
 * Normalizasyon sonrası garanti edilen yapı:
 *  {
 *    leads: Lead[],
 *    stats: { provider_id, provider_label, ... },
 *    errors: NormalizedProviderError[]
 *  }
 */
async function runProviderDiscover(provider, criteria, ctx = {}) {
  if (!provider || typeof provider.discover !== 'function') {
    throw new Error(
      `[GODMODE][PAL] Provider discover() eksik veya geçersiz: ${
        provider && provider.id
      }`,
    );
  }

  const rawResult = await provider.discover(criteria, ctx);
  const safe = rawResult || {};

  const leads = Array.isArray(safe.leads) ? safe.leads : [];

  const stats = {
    provider_id: provider.id,
    provider_label: provider.label || provider.id,
    ...(safe.stats || {}),
  };

  const errors = Array.isArray(safe.errors) ? safe.errors : [];

  return { leads, stats, errors };
}

async function runProviderHealthCheck(provider) {
  if (!provider) {
    throw new Error('[GODMODE][PAL] runProviderHealthCheck: provider eksik');
  }

  if (typeof provider.healthCheck !== 'function') {
    return {
      provider_id: provider.id,
      provider_label: provider.label || provider.id,
      ok: true,
      details: { mode: 'no-op', reason: 'healthCheck() tanımlı değil, varsayılan OK' },
    };
  }

  try {
    const raw = await provider.healthCheck();
    const safe = raw || {};

    return {
      provider_id: provider.id,
      provider_label: provider.label || provider.id,
      ok: typeof safe.ok === 'boolean' ? safe.ok : true,
      details: safe.details || null,
    };
  } catch (err) {
    return {
      provider_id: provider.id,
      provider_label: provider.label || provider.id,
      ok: false,
      details: {
        error: String(err && err.message ? err.message : err),
      },
    };
  }
}

async function runAllProviderHealthChecks() {
  const providers = Object.values(REGISTRY);
  const results = {};

  for (const provider of providers) {
    // Tek tek çalıştırıyoruz; Faz 2.C ile paralel execution düşünülebilir
    const res = await runProviderHealthCheck(provider);
    results[provider.id] = res;
  }

  return results;
}

module.exports = {
  REGISTRY,
  registerProvider,
  getProvider,
  getProvidersByIds,
  getProvidersByChannels,
  listProviders,
  runProviderDiscover,
  runProviderHealthCheck,
  runAllProviderHealthChecks,
};