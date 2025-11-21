// backend/src/social/socialService.js

const { callAgent } = require("../services/aiService");
const { loadCombinedPrompts } = require("../services/promptService");
const { log } = require("../lib/logger");
const campaignService = require("../services/campaignService");

/**
 * Social Media Growth Planner
 * lead + hedef + platform bilgilerini alır,
 * Instagram / LinkedIn için büyüme planı üretir.
 */
async function planSocialGrowth({
  lead,
  goal,
  platforms = ["instagram", "linkedin"],
}) {
  if (!lead) {
    throw new Error("planSocialGrowth için lead zorunludur.");
  }

  // Ortak beyin + ajans dili
  const universal = loadCombinedPrompts([
    "universal/brain.md",
    "universal/voice_style.md",
  ]);

  // 🔹 DOĞRU DOSYA ADI: social_planner_base.md
  const baseSocial = loadCombinedPrompts([
    "social/social_planner_base.md",
  ]);

  const platformPrompts = [];
  if (platforms.includes("instagram")) {
    platformPrompts.push("social/instagram_playbook.md");
  }
  if (platforms.includes("linkedin")) {
    platformPrompts.push("social/linkedin_playbook.md");
  }

  const platformPromptText =
    platformPrompts.length > 0
      ? loadCombinedPrompts(platformPrompts)
      : "";

  const systemPrompt = [universal, baseSocial, platformPromptText]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const socials = lead.firmographic?.socials || {};

  const userMessage = `
## Lead Bilgileri
- Firma: ${lead.name}
- Sektör: ${lead.sector || "belirtilmedi"}
- Lokasyon: ${lead.location || "belirtilmedi"}
- Toplam Skor: ${lead.scores?.totalScore ?? "yok"}

Mevcut Sosyal Medya Varlığı:
- Instagram: ${socials.instagram ? "var" : "yok"}
- Facebook: ${socials.facebook ? "var" : "yok"}
- LinkedIn: ${socials.linkedin ? "var" : "yok"}
- YouTube: ${socials.youtube ? "var" : "yok"}
- TikTok: ${socials.tiktok ? "var" : "yok"}

Hedef:
${
  goal ||
  "Instagram + LinkedIn üzerinden marka otoritesi ve high-ticket proje leadleri üretmek"
}

Planlanacak Platformlar: ${platforms.join(", ")}

## Görev
Bu firma için seçili platformlarda (özellikle Instagram ve LinkedIn) 30–90 günlük **sosyal medya büyüme ve içerik stratejisi** oluştur.

Çıktı mutlaka Markdown formatında ve aşağıdaki başlıkları içermeli:

1. Stratejik Özet (Strategy Overview)
2. Hedef Kitle & Pozisyonlama
3. Platform Bazlı Strateji (Instagram, LinkedIn, varsa diğerleri)
4. İçerik Stratejisi (Content Pillars, formatlar, frekans)
5. Büyüme Taktikleri (organik + paid destek)
6. Önerilen Yayın Takvimi (örnek haftalık plan tablo ile)
7. KPI’lar ve Başarı Ölçümü
8. CNG Medya için İlk 5 Aksiyon (uygulama planı)
`;

  log.info("[SOCIAL] Planning social growth for lead:", lead.name);

  const socialPlanMarkdown = await callAgent({
    systemPrompt,
    userMessage,
  });

  return {
    leadName: lead.name,
    platforms,
    goal:
      goal ||
      "Instagram + LinkedIn üzerinden marka otoritesi ve high-ticket proje leadleri",
    socialPlanMarkdown,
  };
}

/**
 * Social plan çıktısından otomatik campaign + campaign_actions üretir.
 * - campaigns & campaign_actions tablolarına yazar.
 */
function createCampaignFromSocialPlan({ lead, plan }) {
  if (!lead || !lead.id) {
    throw new Error("createCampaignFromSocialPlan: lead.id zorunlu");
  }
  if (!plan) {
    throw new Error("createCampaignFromSocialPlan: plan zorunlu");
  }

  const {
    platforms = [],
    goal = null,
    socialPlanMarkdown,
  } = plan;

  const campaignName = `${lead.name} - Social Growth Campaign`;

  const meta = {
    platforms,
    goal,
    planMarkdown: socialPlanMarkdown,
  };

  // Ana campaign kaydı
  const campaign = campaignService.createCampaign({
    name: campaignName,
    type: "social",
    leadId: lead.id,
    sector: lead.sector || null,
    location: lead.location || null,
    status: "draft",
    meta,
  });

  const actions = [];

  // İç not – plan oluşturuldu
  actions.push(
    campaignService.addCampaignAction({
      campaignId: campaign.id,
      channel: "internal",
      actionType: "note",
      scheduledAt: null,
      payload: {
        note: "Social Planner AI tarafından sosyal büyüme planı oluşturuldu.",
        goal,
        platforms,
      },
    })
  );

  // Plan dokümanı üretme / CRM'e kaydetme gibi iç görev
  actions.push(
    campaignService.addCampaignAction({
      campaignId: campaign.id,
      channel: "internal",
      actionType: "generate_doc",
      scheduledAt: null,
      payload: {
        docType: "social_growth_plan",
        comment: "Social plan Markdown'ı dokümana dönüştür ve ilgili kayda ekle.",
      },
    })
  );

  // Platform bazlı aksiyon stub'ları
  if (platforms.includes("instagram")) {
    actions.push(
      campaignService.addCampaignAction({
        campaignId: campaign.id,
        channel: "social_instagram",
        actionType: "setup_social_growth",
        scheduledAt: null,
        payload: {
          platform: "instagram",
          comment:
            "Instagram içerik takvimi, kreatif ihtiyaç listesi ve yayın planını hazırla.",
        },
      })
    );
  }

  if (platforms.includes("linkedin")) {
    actions.push(
      campaignService.addCampaignAction({
        campaignId: campaign.id,
        channel: "social_linkedin",
        actionType: "setup_social_growth",
        scheduledAt: null,
        payload: {
          platform: "linkedin",
          comment:
            "LinkedIn için thought-leadership içerik takvimi ve case study serisini hazırla.",
        },
      })
    );
  }

  log.info(
    `[SOCIAL] Plan'dan social campaign üretildi #${campaign.id} (actions: ${actions.length})`
  );

  return { campaign, actions };
}

module.exports = {
  planSocialGrowth,
  createCampaignFromSocialPlan, // 🔹 ÖNEMLİ: dışarı açtık
};