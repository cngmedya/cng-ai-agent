// backend/src/routes/campaignRoutes.js

const express = require("express");
const router = express.Router();
const { log } = require("../lib/logger");
const campaignService = require("../services/campaignService");
const campaignController = require("../controllers/campaignController");

// Eğer internal API key middleware'in varsa, buraya ekleyebilirsin:
// const requireInternalApiKey = require("../middleware/internalAuth");

// -------------------------------------------------------------
// GET /api/campaigns
//  - ?page=1&pageSize=20&status=active&type=ads
// -------------------------------------------------------------
router.get(
  "/",
  // requireInternalApiKey,
  (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.pageSize, 10) || 20;
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
      log.error("GET /api/campaigns error:", err);
      return res.status(500).json({
        ok: false,
        error: "Campaign listesi alınırken hata oluştu.",
      });
    }
  }
);
// Campaign listesi (sayfalı)
router.get("/", campaignController.listCampaigns);

// Tekil campaign + actions
router.get("/:id", campaignController.getCampaignDetail);
// -------------------------------------------------------------
// GET /api/campaigns/:id
//  - Tekil campaign + actions
// -------------------------------------------------------------
router.get(
  "/:id",
  // requireInternalApiKey,
  (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res
          .status(400)
          .json({ ok: false, error: "Geçersiz campaign id." });
      }

      const detail = campaignService.getCampaignDetail(id);
      if (!detail) {
        return res
          .status(404)
          .json({ ok: false, error: "Campaign bulunamadı." });
      }

      return res.json({
        ok: true,
        ...detail,
      });
    } catch (err) {
      log.error("GET /api/campaigns/:id error:", err);
      return res.status(500).json({
        ok: false,
        error: "Campaign detayı alınırken hata oluştu.",
      });
    }
  }
);

// -------------------------------------------------------------
// POST /api/campaigns
//  - Yeni campaign + opsiyonel başlangıç action'ları
// Body:
//  {
//    "name": "Fiart Mimarlık - Q1 Growth",
//    "type": "ads",
//    "leadId": 7,
//    "sector": "mimarlık ofisi",
//    "location": "İstanbul",
//    "status": "draft", // opsiyonel
//    "meta": { ... },   // opsiyonel
//    "actions": [
//      {
//        "channel": "internal",
//        "actionType": "note",
//        "scheduledAt": null,
//        "payload": { "note": "İlk growth planı" }
//      }
//    ]
//  }
// -------------------------------------------------------------
router.post(
  "/",
  // requireInternalApiKey,
  (req, res) => {
    try {
      const {
        name,
        type,
        leadId,
        sector,
        location,
        status,
        meta,
        actions,
      } = req.body || {};

      if (!name || !type) {
        return res.status(400).json({
          ok: false,
          error: "name ve type alanları zorunludur.",
        });
      }

      const campaign = campaignService.createCampaign({
        name,
        type,
        leadId: leadId || null,
        sector: sector || null,
        location: location || null,
        status: status || "draft",
        meta: meta || null,
      });

      let createdActions = [];
      if (Array.isArray(actions) && actions.length > 0) {
        createdActions = actions.map((a) =>
          campaignService.addCampaignAction({
            campaignId: campaign.id,
            channel: a.channel,
            actionType: a.actionType,
            scheduledAt: a.scheduledAt || null,
            payload: a.payload || null,
          })
        );
      }

      return res.status(201).json({
        ok: true,
        campaign,
        actions: createdActions,
      });
    } catch (err) {
      log.error("POST /api/campaigns error:", err);
      return res.status(500).json({
        ok: false,
        error: "Campaign oluşturulurken hata oluştu.",
      });
    }
  }
);

// -------------------------------------------------------------
// PATCH /api/campaigns/:id/status
//  - Sadece status güncellemek için
// Body: { "status": "active" }
// -------------------------------------------------------------
router.patch(
  "/:id/status",
  // requireInternalApiKey,
  (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res
          .status(400)
          .json({ ok: false, error: "Geçersiz campaign id." });
      }

      const { status } = req.body || {};
      if (!status) {
        return res.status(400).json({
          ok: false,
          error: "status alanı zorunludur.",
        });
      }

      const updated = campaignService.updateCampaignStatus({ id, status });
      if (!updated) {
        return res
          .status(404)
          .json({ ok: false, error: "Campaign bulunamadı." });
      }

      return res.json({
        ok: true,
        campaign: updated,
      });
    } catch (err) {
      log.error("PATCH /api/campaigns/:id/status error:", err);
      return res.status(500).json({
        ok: false,
        error: "Campaign status güncellenirken hata oluştu.",
      });
    }
  }
);

module.exports = router;