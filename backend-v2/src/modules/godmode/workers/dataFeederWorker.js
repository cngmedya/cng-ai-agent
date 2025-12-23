const { getDb } = require('../../../core/db');

const ENABLE_DEEP_ENRICHMENT = process.env.GODMODE_DEEP_ENRICHMENT === '1';
const DEEP_ENRICHMENT_SOURCES = (process.env.GODMODE_DEEP_ENRICHMENT_SOURCES || 'website,tech,seo,social')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const ENABLE_TECH_FINGERPRINT =
  ENABLE_DEEP_ENRICHMENT && DEEP_ENRICHMENT_SOURCES.includes('tech');

function detectTechFromWebsite(website) {
  if (!website || typeof website !== 'string') return [];

  const w = website.trim().toLowerCase();
  if (!w) return [];

  const signals = [];

  if (w.includes('wixsite.com') || w.includes('wix.com')) signals.push('wix');
  if (w.includes('webflow.io') || w.includes('webflow.com')) signals.push('webflow');
  if (w.includes('shopify.com') || w.includes('myshopify.com')) signals.push('shopify');
  if (w.includes('wordpress.com')) signals.push('wordpress');
  if (w.includes('squarespace.com')) signals.push('squarespace');
  if (w.includes('tilda.ws')) signals.push('tilda');

  // Generic CMS hints (very rough)
  if (w.includes('/wp-') || w.includes('wp-content') || w.includes('wp-includes')) {
    if (!signals.includes('wordpress')) signals.push('wordpress');
  }

  return Array.from(new Set(signals));
}

function buildLeadRow(lead, job) {
  const criteria = job.criteria || {};
  const city = lead.city || criteria.city || null;
  const country = lead.country || criteria.country || null;

  return {
    name: lead.name || null,
    address: lead.address || null,
    city,
    country,
    category: Array.isArray(lead.types) && lead.types.length > 0 ? lead.types[0] : null,
    phone: null,
    website: lead.website || null,
    google_place_id: lead.place_id,
    google_rating:
      typeof lead.rating === 'number' ? lead.rating : null,
    google_user_ratings_total: lead.user_ratings_total || 0,
    source: 'godmode',
    created_at: new Date().toISOString(),
  };
}

/**
 * Discovery sonucunda gelen lead’leri potential_leads tablosuna yazar.
 * google_place_id UNIQUE olduğu için INSERT OR UPDATE davranıyoruz.
 */
function feedDiscoveryResults(job, leads) {
  let deepEnrichmentCandidates = 0;

  if (!Array.isArray(leads) || leads.length === 0) {
    return { upserted: 0 };
  }

  const db = getDb();

  const insertJobLogStmt = db.prepare(`
    INSERT INTO godmode_job_logs (
      job_id,
      event_type,
      payload_json,
      created_at
    ) VALUES (
      @job_id,
      @event_type,
      @payload_json,
      @created_at
    )
  `);

  const upsertStmt = db.prepare(`
    INSERT INTO potential_leads (
      name,
      address,
      city,
      country,
      category,
      phone,
      website,
      google_place_id,
      google_rating,
      google_user_ratings_total,
      source,
      created_at
    ) VALUES (
      @name,
      @address,
      @city,
      @country,
      @category,
      @phone,
      @website,
      @google_place_id,
      @google_rating,
      @google_user_ratings_total,
      @source,
      @created_at
    )
    ON CONFLICT(google_place_id) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      city = excluded.city,
      country = excluded.country,
      category = excluded.category,
      website = COALESCE(excluded.website, potential_leads.website),
      google_rating = excluded.google_rating,
      google_user_ratings_total = excluded.google_user_ratings_total,
      source = excluded.source
  `);

  const tx = db.transaction(items => {
    for (const lead of items) {
      const row = buildLeadRow(lead, job);
      upsertStmt.run(row);
      if (ENABLE_TECH_FINGERPRINT && row.website) {
        const tech = detectTechFromWebsite(row.website);

        insertJobLogStmt.run({
          job_id: job.id,
          event_type: 'DEEP_ENRICHMENT_TECH_STUB',
          payload_json: JSON.stringify({
            job_id: job.id,
            google_place_id: row.google_place_id,
            website: row.website,
            tech,
            created_at: row.created_at,
          }),
          created_at: row.created_at,
        });
      }
      if (ENABLE_DEEP_ENRICHMENT) {
        deepEnrichmentCandidates += 1;
      }
    }
  });

  tx(leads);

  return {
    upserted: leads.length,
    deep_enrichment_candidates: ENABLE_DEEP_ENRICHMENT ? deepEnrichmentCandidates : 0,
  };
}

module.exports = {
  feedDiscoveryResults,
};