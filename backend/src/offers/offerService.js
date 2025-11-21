// backend/src/offers/offerService.js

const { callAgent } = require("../services/aiService");
const { loadPrompt } = require("../services/promptService");

async function generateOffer({
  lead,
  sector,
  swotAnalysis, // optional
  packageLevel = "premium",
  tone = "insight",
}) {
  if (!lead) {
    throw new Error("generateOffer: lead bilgisi zorunludur.");
  }

  const { name, address, websiteUrl, scores, firmographic, source } = lead;

  const google = source?.google || {};
  const linkedin = source?.linkedin || {};

  const basePrompt = loadPrompt("offers/offer_engine_base.md");
  const tonePrompt = loadPrompt(`offers/tone_${tone}.md`) || "";

  const systemPrompt = `${basePrompt}\n\n${tonePrompt}`.trim();

  const firmographicSummary = firmographic
    ? `
Website verileri:
- Title: ${firmographic.meta?.title || "belirtilmedi"}
- Meta description: ${firmographic.meta?.metaDescription || "yok"}
- Logo: ${firmographic.brand?.logoFound ? "var" : "belirsiz/yok"}
- Mobil uyum: ${firmographic.ux?.mobileFriendly ? "evet" : "hayır"}
- Hakkımızda içeriği: ${
        firmographic.content?.aboutPresent ? "var" : "belirsiz/yok"
      }
- Hizmet sayısı (tahmini): ${firmographic.content?.serviceCount ?? "?"}
- Sosyal medya:
  - Instagram: ${firmographic.socials?.instagram ? "var" : "yok"}
  - Facebook: ${firmographic.socials?.facebook ? "var" : "yok"}
  - LinkedIn: ${firmographic.socials?.linkedin ? "var" : "yok"}
  - YouTube: ${firmographic.socials?.youtube ? "var" : "yok"}
  - TikTok: ${firmographic.socials?.tiktok ? "var" : "yok"}
- Firmographic skor: ${firmographic.scores?.totalScore ?? "?"} / 30
`
    : `
Bu firma için detaylı website analizi bulunamadı (firmographic null).
Yine de mevcut bilgilerden yola çıkarak sektör bağımsız güçlü bir teklif üret.
`;

  const swotBlock = swotAnalysis
    ? `\n\nSWOT Özet (AI tarafından daha önce üretilmiş):\n${swotAnalysis}\n`
    : "";

  const userMessage = `
Firma adı: ${name}
Sektör: ${sector || "belirtilmedi"}
Adres: ${address || "bilinmiyor"}
Website: ${websiteUrl || google.website || "bilinmiyor"}
Telefon: ${google.phoneNumber || "bilinmiyor"}

Google rating: ${
    typeof google.rating === "number" ? google.rating : "belirtilmemiş"
  } (${google.userRatingsTotal || 0} yorum)

Lead skorları:
- Dijital skor: ${scores?.digitalScore ?? 0}
- Görünürlük skoru: ${scores?.visibilityScore ?? 0}
- Marka skoru: ${scores?.brandScore ?? 0}
- Toplam skor: ${scores?.totalScore ?? 0}
- Fırsat seviyesi: ${scores?.opportunity ?? "belirsiz"}

LinkedIn verisi (AI-simüle / düşük ağırlık):
- Profil adı: ${linkedin.name || "bilinmiyor"}
- Lokasyon: ${linkedin.location || "bilinmiyor"}

${firmographicSummary}
${swotBlock}

Paket seviyesi: ${packageLevel}
Teklif tonu: ${tone} (insight / momentum / accelerator)

Görev:
Bu firma için CNG Medya adına Türkçe, premium hisli, sektör bağımsız okunabilen ama bu firmaya özel bir satış teklifi metni üret.
`;

  const offerMarkdown = await callAgent({
    systemPrompt,
    userMessage,
  });

  return {
    leadName: name,
    packageLevel,
    tone,
    offerMarkdown,
  };
}

module.exports = { generateOffer };