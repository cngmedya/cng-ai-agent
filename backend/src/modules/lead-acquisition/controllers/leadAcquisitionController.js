// backend/src/modules/lead-acquisition/controllers/leadAcquisitionController.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

const leadAcquisitionService = require("../services/leadAcquisitionService");
const websiteIntelService = require("../services/websiteIntelService");
const websiteAiAnalysisService = require("../services/websiteAiAnalysisService");
const { runWebsiteIntelBatch } = require("../services/leadBatchWebsiteIntelService");
const {
  getLeadIntel,
  getLeadIntelSummary,
} = require("../services/leadIntelService");
const { runReputationIntelForLead } = require("../services/leadReputationOrchestrator");

/**
 * Google Places üzerinden lead toplama
 */
exports.acquireFromGooglePlaces = async (req, res) => {
  try {
    const { location, keyword, radius } = req.body || {};

    if (!location || !keyword) {
      return res.status(400).json({
        ok: false,
        data: null,
        error: "location ve keyword alanları zorunludur.",
      });
    }

    const radiusValue = radius || 8000;

    log.info("[LeadAcq] Google Places taraması başlıyor", {
      location,
      keyword,
      radius: radiusValue,
    });

    const result = await leadAcquisitionService.acquireFromGooglePlaces({
      location,
      keyword,
      radius: radiusValue,
    });

    return res.json({
      ok: true,
      data: {
        sourceId: result.sourceId,
        foundCount: result.foundCount,
        insertedCount: result.insertedCount,
        duplicateCount: result.duplicateCount,
      },
      error: null,
    });
  } catch (err) {
    log.error("[LeadAcq] Google Places tarama hatası", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      data: null,
      error: "Google Places taraması sırasında bir hata oluştu.",
    });
  }
};

/**
 * Tek bir URL için website intel enrichment
 */
exports.enrichWebsiteIntel = async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({
        ok: false,
        data: null,
        error: "url alanı zorunludur.",
      });
    }

    const intel = await websiteIntelService.enrichWebsiteFromUrl({ url });

    return res.json({
      ok: true,
      data: { intel },
      error: null,
    });
  } catch (err) {
    log.error("[WebIntel] Website intel hatası", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      data: null,
      error: "Website intel sırasında bir hata oluştu.",
    });
  }
};

/**
 * Tek bir URL için website + AI analizi
 */
exports.analyzeWebsiteWithAI = async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({
        ok: false,
        data: null,
        error: "url alanı zorunludur.",
      });
    }

    // 1) Önce raw website intel'i al (DB'ye kaydediyor zaten)
    const intel = await websiteIntelService.enrichWebsiteFromUrl({ url });

    // 2) Sonra AI analizi yap
    const analysis = await websiteAiAnalysisService.analyzeWebsiteWithAI({
      url,
      intel,
    });

    return res.json({
      ok: true,
      data: { analysis },
      error: null,
    });
  } catch (err) {
    log.error("[WebIntelAI] Website AI analiz hatası", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      data: null,
      error: "Website AI analizi sırasında bir hata oluştu.",
    });
  }
};

/**
 * Batch website intel – lead'ler için domain/website intel çalıştırma
 */
exports.runWebsiteIntelBatchForLeads = async (req, res) => {
  try {
    const { limit } = req.body || {};
    const result = await runWebsiteIntelBatch({
      limit: limit || 5,
    });

    return res.json({
      ok: true,
      data: result,
      error: null,
    });
  } catch (err) {
    log.error("[WebIntelBatch] Batch çalıştırma hatası", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      data: null,
      error: "Website batch intel sırasında bir hata oluştu.",
    });
  }
};

/**
 * Tek bir lead için reputation orchestrator (search + AI reputation)
 */
exports.runReputationIntel = async (req, res) => {
  try {
    const { leadId } = req.body || {};

    if (!leadId) {
      return res.status(400).json({
        ok: false,
        data: null,
        error: "leadId required",
      });
    }

    const result = await runReputationIntelForLead(leadId);

    return res.json({
      ok: true,
      data: result,
      error: null,
    });
  } catch (err) {
    log.error("[ReputationOrchestrator] Tek lead reputation hatası", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      data: null,
      error: "Reputation analizi sırasında bir hata oluştu.",
    });
  }
};

/**
 * Reputation batch – reputation olmayan lead'ler için toplu analiz
 */
exports.runReputationIntelBatchForLeads = async (req, res) => {
  try {
    const { limit = 5 } = req.body || {};
    const db = await getCrmDb();

    // Daha önce reputation çalışmamış lead'leri seç
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
      return res.json({
        ok: true,
        data: {
          processedCount: 0,
          items: [],
          note: "Reputation intel bekleyen lead bulunamadı.",
        },
        error: null,
      });
    }

    const items = [];

    for (const row of rows) {
      const result = await runReputationIntelForLead(row.id);

      items.push({
        leadId: row.id,
        companyName: row.company_name,
        ok: result.ok,
        reputation_score: result.reputation_score || null,
        risk_level: result.risk_level || null,
      });
    }

    log.info("[ReputationBatch] Batch tamamlandı", {
      processedCount: items.length,
    });

    return res.json({
      ok: true,
      data: {
        processedCount: items.length,
        items,
      },
      error: null,
    });
  } catch (err) {
    log.error("[ReputationBatch] HATA", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      data: null,
      error: "Reputation batch hata verdi.",
    });
  }
};

/**
 * Tek bir lead için full intel (lead + website + search + reputation)
 */
exports.getLeadIntelController = async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId || req.params.id, 10);

    if (!leadId || Number.isNaN(leadId)) {
      return res.status(400).json({
        ok: false,
        data: null,
        error: "Geçerli leadId gerekli.",
      });
    }

    const intel = await getLeadIntel(leadId);

    if (!intel) {
      return res.status(404).json({
        ok: false,
        data: null,
        error: "Lead bulunamadı.",
      });
    }

    return res.json({
      ok: true,
      data: intel,
      error: null,
    });
  } catch (err) {
    log.error("[LeadIntel] Lead intel hata", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      data: null,
      error: "Lead intel alınırken bir hata oluştu.",
    });
  }
};

/**
 * Intel summary (dashboard sayıları)
 */
exports.getLeadIntelSummaryController = async (req, res) => {
  try {
    const summary = await getLeadIntelSummary();

    return res.json({
      ok: true,
      data: summary,
      error: null,
    });
  } catch (err) {
    log.error("[LeadIntel] Lead summary hata", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      data: null,
      error: "Lead özetleri alınırken bir hata oluştu.",
    });
  }
};