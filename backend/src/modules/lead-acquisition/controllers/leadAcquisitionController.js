// backend/src/modules/lead-acquisition/controllers/leadAcquisitionController.js

const { log } = require("../../../lib/logger");
const leadAcquisitionService = require("../services/leadAcquisitionService");
const websiteIntelService = require("../services/websiteIntelService");
const websiteAiAnalysisService = require("../services/websiteAiAnalysisService");
const { runWebsiteIntelBatch } = require("../services/leadBatchWebsiteIntelService");

exports.acquireFromGooglePlaces = async (req, res) => {
  try {
    const { location, keyword, radius } = req.body || {};

    if (!location || !keyword) {
      return res.status(400).json({
        ok: false,
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
      ...result,
    });

  } catch (err) {
    log.error("[LeadAcq] Google Places tarama hatası", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      error: "Google Places taraması sırasında bir hata oluştu.",
    });
  }
};

exports.enrichWebsiteIntel = async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "url alanı zorunludur.",
      });
    }

    const intel = await websiteIntelService.enrichWebsiteFromUrl({ url });

    return res.json({
      ok: true,
      intel,
    });
  } catch (err) {
    log.error("[WebIntel] Website intel hatası", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      error: "Website intel sırasında bir hata oluştu.",
    });
  }
};

exports.analyzeWebsiteWithAI = async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({
        ok: false,
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
      analysis,
    });
  } catch (err) {
    log.error("[WebIntelAI] Website AI analiz hatası", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      error: "Website AI analizi sırasında bir hata oluştu.",
    });
  }
};

exports.runWebsiteIntelBatchForLeads = async (req, res) => {
  try {
    const { limit } = req.body || {};
    const result = await runWebsiteIntelBatch({
      limit: limit || 5,
    });

    return res.json(result);
  } catch (err) {
    log.error("[WebIntelBatch] Batch çalıştırma hatası", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      ok: false,
      error: "Website batch intel sırasında bir hata oluştu.",
    });
  }
};

const { runReputationIntelForLead } = require("../services/leadReputationOrchestrator");

exports.runReputationIntel = async (req, res) => {
  const { leadId } = req.body;

  if (!leadId) {
    return res.status(400).json({ ok: false, error: "leadId required" });
  }

  const result = await runReputationIntelForLead(leadId);
  return res.json(result);
};