// backend-v2/src/modules/godmode/workers/entityResolverWorker.js
const { appendDeepEnrichmentStage } = require('../repo');

const ENABLE_DEEP_ENRICHMENT = process.env.GODMODE_DEEP_ENRICHMENT === '1';

async function runEntityResolver(job) {
  const jobId = job.id;

  if (!ENABLE_DEEP_ENRICHMENT) {
    console.log('[GODMODE][ENTITY_RESOLVER] Skipped (deep enrichment disabled)');
    return {
      resolved_entities: 0,
      skipped: true,
    };
  }

  appendDeepEnrichmentStage(jobId, 'RUNNING', {
    worker: 'entityResolver',
    started_at: new Date().toISOString(),
  });

  console.log('[GODMODE][ENTITY_RESOLVER] Running for job:', jobId);

  try {
    const enrichment = job.result_summary?.deep_enrichment || {};

    const normalizedEntity = {
      entity_type: 'company',
      lead_id: job.lead_id || null,
      sources: enrichment.sources || [],
      resolved_at: new Date().toISOString(),
    };

    appendDeepEnrichmentStage(jobId, 'COMPLETED', {
      worker: 'entityResolver',
      finished_at: new Date().toISOString(),
      entity: normalizedEntity,
    });

    return {
      resolved_entities: 1,
      entity: normalizedEntity,
    };
  } catch (err) {
    appendDeepEnrichmentStage(jobId, 'FAILED', {
      worker: 'entityResolver',
      error: err?.message || String(err),
    });

    throw err;
  }
}

module.exports = {
  runEntityResolver,
};