// backend/src/workers/leadAutoIntelWorker.js

"use strict";

const { log } = require("../lib/logger");

// Service katmanı
const { runDomainDiscoveryBatch } = require("../modules/lead-acquisition/services/leadDomainDiscoveryService");
const { runWebsiteIntelBatch } = require("../modules/lead-acquisition/services/leadBatchWebsiteIntelService");
const {
  runReputationIntelBatchForLeads,
} = require("../modules/lead-acquisition/services/leadReputationBatchService");

let isRunning = false;
let timer = null;

/**
 * Tek bir worker cycle'ı:
 * 1) Domain discovery (website'i eksik olan lead'ler)
 * 2) Website intel (website_intel eksik olan lead'ler)
 * 3) Reputation (reputation eksik olan lead'ler – içinde search_intel V2 de var)
 */
async function runWorkerCycle() {
  if (isRunning) {
    log.warn("[LeadAutoIntelWorker] Önceki cycle hâlâ çalışıyor, skip ediliyor.");
    return;
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  log.info("[LeadAutoIntelWorker] Cycle başlıyor", { startedAt });

  try {
    // 1) DOMAIN DISCOVERY
    try {
      const domainResult = await runDomainDiscoveryBatch({ limit: 20 });
      log.info("[LeadAutoIntelWorker] DomainDiscovery tamamlandı", {
        processedCount: domainResult?.processedCount || 0,
      });
    } catch (err) {
      log.error("[LeadAutoIntelWorker] DomainDiscovery hatası", {
        error: err.message,
      });
    }

    // 2) WEBSITE INTEL
    try {
      const webResult = await runWebsiteIntelBatch({ limit: 10 });
      log.info("[LeadAutoIntelWorker] WebsiteIntel tamamlandı", {
        processedCount: webResult?.processedCount || 0,
      });
    } catch (err) {
      log.error("[LeadAutoIntelWorker] WebsiteIntel hatası", {
        error: err.message,
      });
    }

    // 3) REPUTATION (içinde Search Intel V2 + ReputationEngine V2)
    try {
      const repResult = await runReputationIntelBatchForLeads({ limit: 5 });
      log.info("[LeadAutoIntelWorker] ReputationBatch tamamlandı", {
        processedCount: repResult?.processedCount || 0,
      });
    } catch (err) {
      log.error("[LeadAutoIntelWorker] ReputationBatch hatası", {
        error: err.message,
      });
    }

    const finishedAt = new Date().toISOString();
    log.info("[LeadAutoIntelWorker] Cycle bitti", {
      startedAt,
      finishedAt,
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Worker'ı başlatır (interval ile)
 * - default 60 saniyede bir cycle
 */
function startLeadAutoIntelWorker(options = {}) {
  const intervalMs = options.intervalMs || 60_000;

  if (timer) {
    log.warn("[LeadAutoIntelWorker] Zaten çalışıyor, ikinci kez başlatılmadı.");
    return;
  }

  log.info("[LeadAutoIntelWorker] Başlatılıyor", { intervalMs });

  // İlk cycle'ı hemen çalıştır
  runWorkerCycle().catch((err) => {
    log.error("[LeadAutoIntelWorker] İlk cycle hatası", { error: err.message });
  });

  // Sonra periyodik olarak
  timer = setInterval(() => {
    runWorkerCycle().catch((err) => {
      log.error("[LeadAutoIntelWorker] Periyodik cycle hatası", {
        error: err.message,
      });
    });
  }, intervalMs);
}

module.exports = {
  startLeadAutoIntelWorker,
};