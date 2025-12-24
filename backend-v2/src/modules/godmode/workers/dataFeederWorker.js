const { getDb } = require('../../../core/db');

const ENABLE_DEEP_ENRICHMENT = process.env.GODMODE_DEEP_ENRICHMENT === '1';
const DEEP_ENRICHMENT_SOURCES = (process.env.GODMODE_DEEP_ENRICHMENT_SOURCES || 'website,tech,seo,social')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const ENABLE_TECH_FINGERPRINT =
  ENABLE_DEEP_ENRICHMENT && DEEP_ENRICHMENT_SOURCES.includes('tech');

const ENABLE_SEO_SIGNALS = ENABLE_DEEP_ENRICHMENT;

function normalizeRobotsContent(content) {
  if (!content || typeof content !== 'string') return '';
  return content
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .join(',');
}

function extractMetaContent(html, name) {
  if (!html || typeof html !== 'string') return null;
  const re = new RegExp(`<meta\\s+[^>]*name=["']${name}["'][^>]*>`, 'i');
  const m = html.match(re);
  if (!m) return null;

  const tag = m[0];
  const contentMatch = tag.match(/content=["']([^"']*)["']/i);
  return contentMatch ? contentMatch[1] : null;
}

function extractLinkHref(html, rel) {
  if (!html || typeof html !== 'string') return null;
  const re = new RegExp(`<link\\s+[^>]*rel=["']${rel}["'][^>]*>`, 'i');
  const m = html.match(re);
  if (!m) return null;

  const tag = m[0];
  const hrefMatch = tag.match(/href=["']([^"']*)["']/i);
  return hrefMatch ? hrefMatch[1] : null;
}

function extractTitle(html) {
  if (!html || typeof html !== 'string') return null;
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!m) return null;
  const t = (m[1] || '').replace(/\s+/g, ' ').trim();
  return t || null;
}

function countJsonLdBlocks(html) {
  if (!html || typeof html !== 'string') return 0;
  const re = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>/gi;
  const matches = html.match(re);
  return matches ? matches.length : 0;
}

function extractSeoSignalsFromHtml(html) {
  if (!html || typeof html !== 'string') {
    return {
      ok: false,
      reason: 'missing_html',
      seo: null,
    };
  }

  const title = extractTitle(html);
  const description = extractMetaContent(html, 'description');
  const robotsRaw = extractMetaContent(html, 'robots');
  const robots = normalizeRobotsContent(robotsRaw || '');
  const canonical = extractLinkHref(html, 'canonical');

  const jsonldCount = countJsonLdBlocks(html);

  const robotsNoindex = robots.includes('noindex') || robots.includes('none');
  const robotsNofollow = robots.includes('nofollow') || robots.includes('none');

  const seo = {
    indexability: {
      robots: robots || null,
      robots_noindex: !!robotsNoindex,
      robots_nofollow: !!robotsNofollow,
      indexable: !robotsNoindex,
    },
    meta: {
      title: title,
      title_len: title ? title.length : 0,
      description_present: !!(description && description.trim()),
      canonical_present: !!(canonical && canonical.trim()),
    },
    schema: {
      jsonld_present: jsonldCount > 0,
      jsonld_count: jsonldCount,
    },
  };

  return {
    ok: true,
    reason: null,
    seo,
  };
}

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

  const jobId = job?.id || job?.job_id || job?.jobId;
  if (!jobId) {
    throw new Error('feedDiscoveryResults: missing job id (expected job.id/job.job_id/job.jobId)');
  }

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

  const hasWebsiteMissingLogStmt = db.prepare(
    `SELECT 1 FROM godmode_job_logs
     WHERE job_id = ? AND event_type = 'DEEP_ENRICHMENT_WEBSITE_MISSING'
       AND json_extract(payload_json, '$.google_place_id') = ?
     LIMIT 1`,
  );

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
      if (ENABLE_DEEP_ENRICHMENT && row.website) {
        const tech = detectTechFromWebsite(row.website);

        insertJobLogStmt.run({
          job_id: jobId,
          event_type: 'DEEP_ENRICHMENT_TECH_STUB',
          payload_json: JSON.stringify({
            job_id: jobId,
            google_place_id: row.google_place_id,
            website: row.website,
            seo: {
              ok: false,
              reason: 'html_not_fetched_in_discovery_feed',
            },
            tech,
            created_at: row.created_at,
          }),
          created_at: row.created_at,
        });
      }
      if (ENABLE_DEEP_ENRICHMENT && !row.website) {
        const alreadyMissing = hasWebsiteMissingLogStmt.get(jobId, row.google_place_id);
        if (!alreadyMissing) {
          insertJobLogStmt.run({
            job_id: jobId,
            event_type: 'DEEP_ENRICHMENT_WEBSITE_MISSING',
            payload_json: JSON.stringify({
              job_id: jobId,
              google_place_id: row.google_place_id,
              status: 'OK',
              website: null,
              seo: {
                ok: false,
                reason: 'website_missing',
                indexability: null,
                meta: null,
                schema: null,
              },
              opportunity: {
                website_offer: true,
                priority: 'high',
              },
              created_at: row.created_at,
            }),
            created_at: row.created_at,
          });
        }
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
  ENABLE_DEEP_ENRICHMENT,
  DEEP_ENRICHMENT_SOURCES,
  ENABLE_TECH_FINGERPRINT,
  ENABLE_SEO_SIGNALS,
  extractSeoSignalsFromHtml,
}; 
