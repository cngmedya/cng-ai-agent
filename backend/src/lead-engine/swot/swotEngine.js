// backend/src/lead-engine/swot/swotEngine.js

const { callAgent } = require("../../services/aiService");
const { loadPrompt } = require("../../services/promptService");

async function generateSwotAnalysis({ lead }) {
  const g = lead.source?.google || {};
  const f = lead.firmographic || {};

  const systemPrompt = loadPrompt("lead/swot.md");

  const userMessage = `
Firma Bilgileri
---------------
- Firma Adı: ${lead.name}
- Adres: ${lead.address || "-"}
- Sektör: ${lead.sector || "Belirtilmedi (Google/LinkedIn verisine göre tahmin edebilirsin)"}
- Website: ${lead.websiteUrl || g.website || "-"}

Dijital Skorlar
---------------
- Lead Skoru: ${lead.scores?.totalScore ?? 0}
- Firmographic Skoru: ${f.scores?.totalScore ?? "Yok"}

Website Analizi
---------------
- Title: ${f.meta?.title || "-"}
- Description: ${f.meta?.metaDescription || "-"}
- Logo: ${f.brand?.logoFound ? "Var" : "Yok"}
- Mobil Uyum: ${f.ux?.mobileFriendly ? "Evet" : "Hayır"}
- Hakkında Bölümü: ${f.content?.aboutPresent ? "Var" : "Yok"}
- Hizmet Sayısı (tahmini): ${f.content?.serviceCount ?? 0}

Sosyal Medya Varlığı
--------------------
- Instagram: ${f.socials?.instagram ? "Evet" : "Hayır"}
- Facebook: ${f.socials?.facebook ? "Evet" : "Hayır"}
- LinkedIn: ${f.socials?.linkedin ? "Evet" : "Hayır"}
- YouTube: ${f.socials?.youtube ? "Evet" : "Hayır"}
- TikTok: ${f.socials?.tiktok ? "Evet" : "Hayır"}

Görev:
Yukarıdaki verilere göre, sektör bağımsız düşünen bir dijital danışman gibi bu firma için profesyonel SWOT analizi üret.
`;

  const swot = await callAgent({
    systemPrompt,
    userMessage,
  });

  return swot;
}

module.exports = { generateSwotAnalysis };