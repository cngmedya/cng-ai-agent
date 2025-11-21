// backend/src/routes/socialRoutes.js

const express = require("express");
const router = express.Router();
const { log } = require("../lib/logger");
const socialService = require("../social/socialService");

/**
 * Sadece plan üretir (DB'ye kaydetmez)
 * Body:
 * {
 *   "lead": { ... },         // zorunlu (id opsiyonel ama tavsiye edilir)
 *   "goal": "string",
 *   "platforms": ["instagram","linkedin"]
 * }
 */
router.post("/plan", async (req, res) => {
  try {
    const { lead, goal, platforms } = req.body;

    if (!lead) {
      return res
        .status(400)
        .json({ ok: false, error: "lead zorunlu (plan)" });
    }

    const plan = await socialService.planSocialGrowth({
      lead,
      goal,
      platforms,
    });

    return res.json({ ok: true, plan });
  } catch (err) {
    log.error("[SOCIAL] /plan hata:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "Social plan hatası" });
  }
});

/**
 * Plan üretir + campaigns & campaign_actions içine kaydeder
 *
 * Body için 2 opsiyon var:
 *
 * 1) lead objesiyle:
 * {
 *   "lead": {
 *      "id": 7,
 *      "name": "...",
 *      "sector": "...",
 *      "location": "...",
 *      ...
 *   },
 *   "goal": "Instagram + LinkedIn üzerinden ...",
 *   "platforms": ["instagram","linkedin"]
 * }
 *
 * 2) sadece id ile (şimdilik minimum):
 * {
 *   "leadId": 7,
 *   "goal": "...",
 *   "platforms": ["instagram","linkedin"]
 * }
 *
 * NOT: En sağlıklısı 1. yöntem (lead objesiyle).
 */
router.post("/plan-and-save", async (req, res) => {
  try {
    const { lead: rawLead, leadId, goal, platforms } = req.body;

    // lead objesi geldiyse onu, gelmediyse en azından id'den bir lead iskeleti oluştur
    let lead = rawLead || null;

    if (!lead && leadId) {
      lead = {
        id: leadId,
        name: `Lead #${leadId}`, // İleride CRM'den gerçek isim çekilebilir
      };
    }

    if (!lead || typeof lead.id === "undefined" || lead.id === null) {
      return res.status(400).json({
        ok: false,
        error: "lead.id veya leadId zorunlu (plan-and-save)",
      });
    }

    // 1) Planı üret
    const plan = await socialService.planSocialGrowth({
      lead,
      goal,
      platforms,
    });

    // 2) Campaign + actions kaydet
    const { campaign, actions } =
      socialService.createCampaignFromSocialPlan({
        lead,
        plan,
      });

    return res.json({
      ok: true,
      plan,
      campaign,
      actions,
    });
  } catch (err) {
    log.error("[SOCIAL] /plan-and-save hata:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "Social plan-and-save hatası" });
  }
});

module.exports = router;