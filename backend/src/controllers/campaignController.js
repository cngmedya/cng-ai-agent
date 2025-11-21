// backend/src/controllers/campaignController.js

const campaignService = require("../services/campaignService");
const { log } = require("../lib/logger");

// GET /api/campaigns
exports.listCampaigns = (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const pageSize = parseInt(req.query.pageSize || "20", 10);
    const { status, type } = req.query;

    const result = campaignService.listCampaigns({
      page,
      pageSize,
      status,
      type,
    });

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    log.error("[Campaigns] listCampaigns error:", err);
    return res.status(500).json({
      ok: false,
      error: "Campaign listesi alınırken bir hata oluştu.",
    });
  }
};

// GET /api/campaigns/:id
exports.getCampaignDetail = (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz campaign ID",
      });
    }

    const detail = campaignService.getCampaignDetail(id);
    if (!detail) {
      return res.status(404).json({
        ok: false,
        error: "Campaign bulunamadı.",
      });
    }

    return res.json({
      ok: true,
      ...detail,
    });
  } catch (err) {
    log.error("[Campaigns] getCampaignDetail error:", err);
    return res.status(500).json({
      ok: false,
      error: "Campaign detayı alınırken bir hata oluştu.",
    });
  }
};