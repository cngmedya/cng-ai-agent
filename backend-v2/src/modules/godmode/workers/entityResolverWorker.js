// backend-v2/src/modules/godmode/workers/entityResolverWorker.js

async function runEntityResolver(job) {
  // v1.0'da placeholder. Faz 3'te lead/entity merge, duplicate detection vs.
  console.log('[GODMODE][ENTITY_RESOLVER] Placeholder run for job:', job.id);
  return {
    resolved_entities: 0,
  };
}

module.exports = {
  runEntityResolver,
};