// backend/src/modules/lead-acquisition/controllers/leadAcquisitionController.js

const { log } = require("../../../lib/logger");
const leadAcquisitionService = require("../services/leadAcquisitionService");
const websiteIntelService = require("../services/websiteIntelService");

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