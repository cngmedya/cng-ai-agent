// backend/src/ads/adsService.js

const { callAgent } = require("../services/aiService");
const { loadCombinedPrompts } = require("../services/promptService");
const { log } = require("../lib/logger");
const campaignService = require("../services/campaignService");

/**
 * Ads Campaign Planner
 * lead + seoReport + swot + offer bilgilerini alır,
 * Google + Meta için tam kampanya planı üretir.
 */
async function planAdsCampaign({
  lead,
  seoReport,
  swot,
  offer,
  campaignGoal,
  budgetHint,
  channels = ["google", "meta"],
}) {
  if (!lead) {
    throw new Error("planAdsCampaign için lead zorunludur.");
  }

  // Ortak beyin + ajans dili
  const universal = loadCombinedPrompts([
    "universal/brain.md",
    "universal/voice_style.md",
  ]);

  // Ads base + kanal spesifik promptlar
  const baseAds = loadCombinedPrompts(["ads/ads_planner_base.md"]);

  const channelPrompts = [];
  if (channels.includes("google")) {
    channelPrompts.push("ads/google_playbook.md");
  }
  if (channels.includes("meta")) {
    channelPrompts.push("ads/meta_playbook.md");
  }

  const channelPromptText =
    channelPrompts.length > 0 ? loadCombinedPrompts(channelPrompts) : "";

  const systemPrompt = [universal, baseAds, channelPromptText]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const g = lead.source?.google || {};
  const f = lead.firmographic || {};

  const userMessage = `
## Lead Bilgileri
- Firma Adı: ${lead.name}
- Sektör: ${lead.sector || "belirtilmedi"}
- Lokasyon: ${lead.location || lead.address || "belirtilmedi"}
- Website: ${lead.websiteUrl || g.website || "bilinmiyor"}
- Google Rating: ${
    typeof g.rating === "number" ? g.rating : "belirsiz"
  } (${g.userRatingsTotal || 0} yorum)

Dijital Skorlar:
- Lead Skoru: ${lead.scores?.totalScore ?? 0}
- Firmographic Skoru: ${f.scores?.totalScore ?? "yok"}

SEO Özeti (serbest format, AI yorumlayabilir):
${seoReport || "SEO raporu sağlanmadı."}

SWOT Özeti (serbest format, AI yorumlayabilir):
${swot || "SWOT analizi sağlanmadı."}

Teklif Özeti (offer):
${
  offer?.offerMarkdown
    ? "(Aşağıda CNG Medya'nın bu firmaya sunduğu teklif metni var. Bunu da bağlama dahil et):\n\n" +
      offer.offerMarkdown
    : "Teklif metni sağlanmadı."
}

## Kampanya Hedef & Bütçe Bilgisi
- Kampanya Hedefi: ${
    campaignGoal ||
    "High-ticket lead üretimi / marka bilinirliğini ve nitelikli form başvurularını artırmak"
  }
- Bütçe İpucu: ${
    budgetHint ||
    "Orta seviye bütçe – önce test edip, çalışan kampanyaları büyütmek istiyoruz."
  }
- Kanallar: ${channels.join(", ")}

## Görev
Bu firma için Google Ads ve Meta Ads tarafında, CNG Medya'nın uygulayabileceği **gerçekçi ve performans odaklı** bir medya planı oluştur.

Mutlaka aşağıdaki başlıkları içeren, Markdown formatında bir çıktı üret:

1. Kampanya Özeti (Campaign Overview)
2. Hedef Kitle Segmentleri
3. Google Ads Planı
4. Meta Ads Planı
5. Kreatif & Mesaj Önerileri
6. Önerilen Bütçe Aralıkları (günlük / aylık)
7. KPI & Başarı Ölçümü
8. CNG Medya İçin Aksiyon Planı (ilk 3–5 adım)
`;

  log.info("[ADS] Planning campaign for lead:", lead.name);

  const planMarkdown = await callAgent({
    systemPrompt,
    userMessage,
  });

  return {
    leadName: lead.name,
    channels,
    campaignGoal:
      campaignGoal ||
      "High-ticket lead üretimi / marka bilinirliği + nitelikli başvuru",
    budgetHint:
      budgetHint ||
      "Orta seviye, test & scale odaklı başlangıç bütçesi",
    planMarkdown,
  };
}

/**
 * Ads Planner çıktısından otomatik campaign + internal action üretir.
 * - campaigns & campaign_actions tablolarına yazar.
 * - Detaylı planı action.payload_json içinde saklarız.
 */
function createCampaignFromPlan({ lead, plan }) {
  if (!lead || !lead.id) {
    throw new Error("createCampaignFromPlan: lead.id zorunlu");
  }
  if (!plan) {
    throw new Error("createCampaignFromPlan: plan zorunlu");
  }

  const {
    channels = [],
    campaignGoal = null,
    budgetHint = null,
    planMarkdown,
  } = plan;

  const campaignName = `${lead.name} - Ads Growth Plan`;

  // Meta tarafında yalnızca özet bilgileri tutuyoruz
  const campaignMeta = {
    campaignGoal,
    budgetHint,
    channels,
  };

  // Ana campaign kaydı
  const campaign = campaignService.createCampaign({
    name: campaignName,
    type: "ads",
    leadId: lead.id,
    sector: lead.sector || null,
    location: lead.location || null,
    status: "draft",
    meta: campaignMeta,
  });

  // Planın tamamını içeren internal action
  const action = campaignService.addCampaignAction({
    campaignId: campaign.id,
    channel: "internal",
    actionType: "generate_ads_plan",
    scheduledAt: null,
    payload: {
      planMarkdown,
      channels,
      campaignGoal,
      budgetHint,
    },
  });

  log.info(
    `[ADS] Plan'dan campaign üretildi #${campaign.id} (action: ${action.id})`
  );

  return { campaign, action };
}

module.exports = {
  planAdsCampaign,
  createCampaignFromPlan,
};