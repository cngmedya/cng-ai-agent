// backend/src/lead-engine/leadController.js

// Lead service gerçek export'ları
const {
  searchLeadsBasic,
  // searchLeadsWithAiSummary // istersek ileride direkt servisten de kullanabiliriz
} = require("./leadService");

const offerService = require("../offers/offerService");
const crmService = require("../services/crmService");
const { callAgent } = require("../services/aiService");
const { generateSwotAnalysis } = require("./swot/swotEngine"); // UNIVERSAL SWOT

// -------------------------------------------------------------
// Yardımcı fonksiyonlar
// -------------------------------------------------------------

/**
 * En iyi firmayı seç (lead skor + firmographic skor kombinasyonu)
 */
function pickBestLead(leads = []) {
  if (!Array.isArray(leads) || leads.length === 0) return null;

  let best = null;

  for (const lead of leads) {
    const leadScore = lead.scores?.totalScore ?? 0;
    const firmScore = lead.firmographic?.scores?.totalScore ?? 0;
    const combined = leadScore + firmScore * 2; // firmographic'e ekstra ağırlık

    if (!best || combined > best.combined) {
      best = { combined, lead };
    }
  }

  return best?.lead || leads[0];
}

/**
 * AI ile lead listesi için kısa bir özet üret
 */
async function buildAiSummary({ leads, sector, location }) {
  if (!Array.isArray(leads) || leads.length === 0) return null;

  const shortList = leads.slice(0, 5); // prompt'u çok şişirmemek için

  const items = shortList
    .map((l, idx) => {
      const firmScore = l.firmographic?.scores?.totalScore ?? 0;
      const leadScore = l.scores?.totalScore ?? 0;
      return `${idx + 1}) ${l.name} – adres: ${
        l.address || "bilinmiyor"
      } – leadSkor: ${leadScore} – firmographicSkor: ${firmScore}`;
    })
    .join("\n");

  const systemPrompt = `
Sen CNG Medya için çalışan bir "Lead Intelligence Analisti"sin.
Görevin: Liste halinde gelen potansiyel firmaları hızlıca analiz edip,
CNG Medya ekibine anlaşılır, aksiyon odaklı kısa bir özet sunmak.

Dil:
- Türkçe
- Premium, yaratıcı ama kurumsal
- Madde madde, kolay taranabilir yapı
- En yüksek fırsatlı 3 firmayı ön plana çıkar
`;

  const userMessage = `
Sektör: ${sector || "belirtilmedi"}
Lokasyon: ${location || "belirtilmedi"}

Aşağıda önceliklendirilmiş potansiyel firmalar var:

${items}

Görev:
- En yüksek fırsatlı 3 firmayı seç ve sırala.
- Her biri için kısaca "neden fırsat" açıklaması yaz.
- Son bölümde CNG Medya'nın hangi hizmetleriyle gitmesi gerektiğini özetle.
- Markdown formatında başlıklarla yaz.
`;

  const summary = await callAgent({
    systemPrompt,
    userMessage,
  });

  return summary;
}

// -------------------------------------------------------------
//  /api/leads/search
//  → Basit: sadece lead listesi
// -------------------------------------------------------------
exports.searchLeads = async (req, res) => {
  try {
    const { sector, location, limit } = req.body;

    // searchLeadsBasic DİZİ döndürür: [ lead, lead, ... ]
    const leads = await searchLeadsBasic({
      sector,
      location,
      limit,
    });

    return res.json({
      ok: true,
      leads,
    });
  } catch (err) {
    console.error("searchLeads error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Lead araması sırasında hata oluştu." });
  }
};

// -------------------------------------------------------------
//  /api/leads/search-with-summary
//  → Lead listesi + AI özet
// -------------------------------------------------------------
exports.searchLeadsWithSummary = async (req, res) => {
  try {
    const { sector, location, limit } = req.body;

    // Aynı temel aramayı kullanıyoruz
    const leads = await searchLeadsBasic({
      sector,
      location,
      limit,
    });

    const aiSummary = await buildAiSummary({ leads, sector, location });

    return res.json({
      ok: true,
      leads,
      aiSummary,
    });
  } catch (err) {
    console.error("searchLeadsWithSummary error:", err);
    return res.status(500).json({
      ok: false,
      error: "Lead + özet üretimi sırasında hata oluştu.",
    });
  }
};

// -------------------------------------------------------------
//  /api/leads/search-with-offer
//  → Full pipeline: Leads + AI Summary + SWOT + Offer + CRM
// -------------------------------------------------------------
exports.searchLeadsWithOffer = async (req, res) => {
  try {
    const {
      sector,
      location,
      limit,
      packageLevel = "premium",
      tone = "insight", // insight | momentum | accelerator
    } = req.body;

    // 1) Leadleri çek
    const leads = await searchLeadsBasic({
      sector,
      location,
      limit,
    });

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.json({
        ok: true,
        leads: [],
        aiSummary: null,
        bestLead: null,
        swot: null,
        offer: null,
        crm: null,
        message: "Kriterlere uygun lead bulunamadı.",
      });
    }

    // 2) AI ile lead özetini üret
    const aiSummary = await buildAiSummary({ leads, sector, location });

    // 3) En iyi fırsat lead'ini seç
    const bestLead = pickBestLead(leads);

    // 4) UNIVERSAL SWOT analizi üret (sektör bağımsız)
    let swot = null;
    try {
      swot = await generateSwotAnalysis({
        lead: bestLead,
      });
    } catch (swotErr) {
      console.error("SWOT analysis error:", swotErr);
    }

    // 5) Teklif motorunu çalıştır
    const offer = await offerService.generateOffer({
      lead: bestLead,
      sector,         // universal hale getirdik, mimarlıkla sınırlı değil
      swotAnalysis: swot,
      packageLevel,
      tone,
    });

    // 6) CRM'e kaydet (lead + offer [+ swot])
    let crm = null;
    try {
      crm = crmService.saveLeadAndOfferFromPipeline({
        lead: bestLead,
        offer,
        sector,
        location,
        // swot burada istersen crmService içinde not olarak saklanabilir
      });
    } catch (crmErr) {
      console.error("CRM saveLeadAndOfferFromPipeline error:", crmErr);
    }

    // 7) Sonucu döndür
    return res.json({
      ok: true,
      params: { sector, location, limit, packageLevel, tone },
      leads,
      aiSummary,
      bestLead,
      swot,
      offer,
      crm,
    });
  } catch (err) {
    console.error("searchLeadsWithOffer error:", err);
    return res.status(500).json({
      ok: false,
      error: "Lead + teklif pipeline sırasında hata oluştu.",
    });
  }
};