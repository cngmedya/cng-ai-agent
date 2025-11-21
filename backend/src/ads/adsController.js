// backend/src/ads/adsController.js

const { planAdsCampaign } = require("./adsService");
const crmService = require("../services/crmService");
const campaignService = require("../services/campaignService");
const { log } = require("../lib/logger");

/**
 * POST /api/ads/plan-for-lead
 * Body:
 * {
 *   lead: {...},
 *   seoReport?: string,
 *   swot?: string,
 *   offer?: { offerMarkdown: string },
 *   channels?: ["google","meta"],
 *   campaignGoal?: string,
 *   budgetHint?: string
 * }
 *
 * Daha önce test ettiğimiz "ham lead objesi" ile çalışan endpoint.
 */
exports.planForLead = async (req, res) => {
  try {
    const {
      lead,
      seoReport,
      swot,
      offer,
      channels,
      campaignGoal,
      budgetHint,
    } = req.body;

    if (!lead) {
      return res
        .status(400)
        .json({ ok: false, error: "lead alanı zorunludur." });
    }

    const plan = await planAdsCampaign({
      lead,
      seoReport,
      swot,
      offer,
      channels,
      campaignGoal,
      budgetHint,
    });

    return res.json({
      ok: true,
      plan,
    });
  } catch (err) {
    log.error("planForLead error:", err);
    return res.status(500).json({
      ok: false,
      error: "Ads plan üretimi sırasında hata oluştu.",
      detail: err.message,
    });
  }
};

/**
 * POST /api/ads/plan-and-save
 * Body:
 * {
 *   leadId: number,
 *   channels?: ["google","meta"],
 *   campaignGoal?: string,
 *   budgetHint?: string
 * }
 *
 * Bu endpoint:
 * 1) CRM'den lead'i çeker
 * 2) Varsayılan / son teklifi bağlam olarak alır
 * 3) Ads planı üretir
 * 4) campaigns + campaign_actions tablolarına kayıt açar
 */
exports.planAndSave = async (req, res) => {
  try {
    const { leadId, channels, campaignGoal, budgetHint } = req.body || {};

    if (!leadId) {
      return res
        .status(400)
        .json({ ok: false, error: "leadId alanı zorunludur." });
    }

    // 1) CRM'den lead + offers'ı çek
    const crmDetail = crmService.getLeadDetail
      ? crmService.getLeadDetail(leadId)
      : crmService.getLeadWithOffersAndNotes
      ? crmService.getLeadWithOffersAndNotes(leadId)
      : null;

    if (!crmDetail) {
      return res.status(404).json({
        ok: false,
        error: `CRM'de lead bulunamadı (id=${leadId})`,
      });
    }

    const crmLead = crmDetail.lead || crmDetail;
    const offers = crmDetail.offers || [];

    // Son teklifi al (varsa)
    let offer = null;
    if (offers.length > 0) {
      const lastOffer = offers[offers.length - 1];
      offer = {
        offerMarkdown: lastOffer.content,
      };
    }

    // 2) CRM lead'ini, adsService'in beklediği lead formatına uyarlayalım
    const leadForAds = {
      name: crmLead.name,
      sector: crmLead.sector,
      location: crmLead.location,
      address: null,
      websiteUrl: null, // İleride CRM'e website eklersek buraya bağlayabiliriz
      scores: {
        totalScore:
          crmLead.total_score ??
          (typeof crmLead.lead_score === "number" &&
          typeof crmLead.firmographic_score === "number"
            ? crmLead.lead_score + crmLead.firmographic_score
            : crmLead.lead_score ?? 0),
      },
      firmographic: {
        scores: {
          totalScore: crmLead.firmographic_score ?? null,
        },
      },
      source: {
        google: {}, // Şimdilik boş, ileride zenginleştirilebilir
        linkedin: {},
      },
    };

    // 3) Ads planını üret
    const plan = await planAdsCampaign({
      lead: leadForAds,
      seoReport: null, // Şimdilik SEO raporu yok, ileride SEO engine bağlanır
      swot: null, // İleride SWOT notlarından çekilebilir
      offer,
      channels: channels && channels.length ? channels : ["google", "meta"],
      campaignGoal,
      budgetHint,
    });

    // 4) Campaign kaydı aç
    const campaign = campaignService.createCampaign({
      name: `${crmLead.name} - Ads Growth Plan`,
      type: "ads",
      leadId: crmLead.id,
      sector: crmLead.sector,
      location: crmLead.location,
      status: "draft",
      meta: {
        campaignGoal:
          campaignGoal ||
          "High-ticket lead üretimi / marka bilinirliği + nitelikli başvuru",
        budgetHint:
          budgetHint ||
          "Orta seviye, test & scale odaklı başlangıç bütçesi",
        channels: channels && channels.length ? channels : ["google", "meta"],
      },
    });

    // 5) Campaign action kaydı aç (internal not / doküman)
    const action = campaignService.addCampaignAction({
      campaignId: campaign.id,
      channel: "internal",
      actionType: "generate_ads_plan",
      scheduledAt: null,
      payload: {
        planMarkdown: plan.planMarkdown,
        channels: plan.channels,
        campaignGoal: plan.campaignGoal,
        budgetHint: plan.budgetHint,
      },
    });

    return res.json({
      ok: true,
      plan,
      campaign,
      action,
    });
  } catch (err) {
    log.error("planAndSave error:", err);
    return res.status(500).json({
      ok: false,
      error: "Ads plan üretimi + campaign kayıt sırasında hata oluştu.",
      detail: err.message,
    });
  }
};