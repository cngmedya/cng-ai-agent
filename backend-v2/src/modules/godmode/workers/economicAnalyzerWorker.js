// backend-v2/src/modules/godmode/workers/economicAnalyzerWorker.js
const { appendDeepEnrichmentStage } = require('../repo');

const ENABLE_DEEP_ENRICHMENT = process.env.GODMODE_DEEP_ENRICHMENT === '1';

async function runEconomicAnalyzer(job) {
  const jobId = job.id;

  if (!ENABLE_DEEP_ENRICHMENT) {
    console.log('[GODMODE][ECONOMIC_ANALYZER] Skipped (deep enrichment disabled)');
    return {
      market_score: null,
      skipped: true,
    };
  }

  appendDeepEnrichmentStage(jobId, 'RUNNING', {
    worker: 'economicAnalyzer',
    started_at: new Date().toISOString(),
  });

  console.log('[GODMODE][ECONOMIC_ANALYZER] Running for job:', jobId);

  try {
    // v2.D placeholder signals (no external calls yet)
    const signals = {
      macro_environment: 'neutral',
      inflation_risk: 'unknown',
      interest_rate_pressure: 'unknown',
      currency_risk: 'unknown',
    };

    const marketScore = null;

    appendDeepEnrichmentStage(jobId, 'COMPLETED', {
      worker: 'economicAnalyzer',
      finished_at: new Date().toISOString(),
      signals,
      market_score: marketScore,
    });

    return {
      market_score: marketScore,
      signals,
    };
  } catch (err) {
    appendDeepEnrichmentStage(jobId, 'FAILED', {
      worker: 'economicAnalyzer',
      error: err?.message || String(err),
    });

    throw err;
  }
}

module.exports = {
  runEconomicAnalyzer,
};