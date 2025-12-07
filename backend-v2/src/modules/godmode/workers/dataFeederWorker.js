// backend-v2/src/modules/godmode/workers/dataFeederWorker.js

async function runDataFeederJob(job) {
  // v1.0'da gerçek discovery/discoveryWorker entegrasyonu yok.
  // Faz 2'de: discovery + crm + external API'ler ile dolduracağız.
  console.log('[GODMODE][DATA_FEEDER] Placeholder run for job:', job.id);
  return {
    found_leads: 0,
  };
}

module.exports = {
  runDataFeederJob,
};