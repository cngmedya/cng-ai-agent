// backend/src/services/workerService.js

const { log } = require("../lib/logger");
const { getCrmDb } = require("../db/db");

// Lead acquisition modülü servisleri
const {
  runDomainDiscoveryBatch,
} = require("../modules/lead-acquisition/services/leadDomainDiscoveryService");

const {
  runWebsiteIntelBatch,
} = require("../modules/lead-acquisition/services/leadBatchWebsiteIntelService");

const {
  runReputationIntelForLead,
} = require("../modules/lead-acquisition/services/leadReputationOrchestrator");

/**
 * Reputation batch helper:
 *  - Henüz reputation çalışmamış lead'leri bulur
 *  - runReputationIntelForLead ile tek tek işler
 */
async function runReputationBatch({ limit = 20 } = {}) {
  const db = await getCrmDb();

  const rows = db
    .prepare(
      `
      SELECT pl.id, pl.company_name
      FROM potential_leads pl
      LEFT JOIN lead_reputation_insights lri ON lri.lead_id = pl.id
      WHERE lri.id IS NULL
      ORDER BY pl.id ASC
      LIMIT ?
    `
    )
    .all(limit);

  if (!rows.length) {
    return {
      processedCount: 0,
      items: [],
      note: "Reputation intel bekleyen lead bulunamadı.",
    };
  }

  const items = [];

  for (const row of rows) {
    try {
      const result = await runReputationIntelForLead(row.id);

      items.push({
        leadId: row.id,
        companyName: row.company_name,
        ok: result.ok,
        reputation_score: result.reputation_score || null,
        risk_level: result.risk_level || null,
      });
    } catch (err) {
      log.error("[WorkerReputation] Lead reputation hata", {
        leadId: row.id,
        companyName: row.company_name,
        error: err.message,
      });

      items.push({
        leadId: row.id,
        companyName: row.company_name,
        ok: false,
        error: err.message,
      });
    }
  }

  log.info("[WorkerReputation] Batch tamamlandı", {
    processedCount: items.length,
  });

  return {
    processedCount: items.length,
    items,
  };
}

/**
 * Worker V1: Lead pipeline’ı uçtan uca koşturur
 *
 * 1) Domain Discovery (website boş olanlar)
 * 2) Website Intel Batch (website'i olan ama intel'i olmayanlar)
 * 3) Reputation Batch (reputation'u olmayanlar)
 */
async function runWorkerOnce({ context = "manual" } = {}) {
  const startedAt = new Date().toISOString();

  log.info("[Worker] runWorkerOnce çağrıldı", { context, startedAt });

  const steps = [];
  let errorCount = 0;

  // 1) Domain Discovery
  try {
    const domainResult = await runDomainDiscoveryBatch({ limit: 20 });

    steps.push({
      step: "domainDiscovery",
      ok: true,
      processedCount: domainResult.processedCount,
      updatedCount: domainResult.updatedCount,
    });
  } catch (err) {
    errorCount++;
    log.error("[Worker] Domain discovery hata", {
      error: err.message,
      stack: err.stack,
    });

    steps.push({
      step: "domainDiscovery",
      ok: false,
      error: err.message,
    });
  }

  // 2) Website Intel Batch
  try {
    const websiteResult = await runWebsiteIntelBatch({ limit: 20 });

    steps.push({
      step: "websiteIntel",
      ok: true,
      processedCount: websiteResult.processedCount || websiteResult.processed || 0,
    });
  } catch (err) {
    errorCount++;
    log.error("[Worker] Website intel batch hata", {
      error: err.message,
      stack: err.stack,
    });

    steps.push({
      step: "websiteIntel",
      ok: false,
      error: err.message,
    });
  }

  // 3) Reputation Batch
  try {
    const reputationResult = await runReputationBatch({ limit: 20 });

    steps.push({
      step: "reputation",
      ok: true,
      processedCount: reputationResult.processedCount,
    });
  } catch (err) {
    errorCount++;
    log.error("[Worker] Reputation batch hata", {
      error: err.message,
      stack: err.stack,
    });

    steps.push({
      step: "reputation",
      ok: false,
      error: err.message,
    });
  }

  const finishedAt = new Date().toISOString();

  const summary = {
    context,
    startedAt,
    finishedAt,
    errorCount,
    steps,
  };

  log.info("[Worker] runWorkerOnce tamamlandı", summary);

  return summary;
}

module.exports = {
  runWorkerOnce,
};