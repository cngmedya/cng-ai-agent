// backend/src/seo/seoService.js

const { callAgent } = require("../services/aiService");
const { log } = require("../lib/logger");

/**
 * Basit bir SEO skoru hesapla (firmographic + heuristik)
 */
function computeSeoScore(f) {
  if (!f) {
    return 40; // hiçbir veri yoksa ortalama altı bir başlangıç
  }

  let score = 40;

  // Meta title varsa
  if (f.meta?.title) score += 10;

  // Meta description varsa
  if (f.meta?.metaDescription) score += 15;

  // Mobil uyum
  if (f.ux?.mobileFriendly) score += 10;

  // Hakkında sayfası
  if (f.content?.aboutPresent) score += 5;

  // Hizmet sayısı (içerik derinliği için kaba proxy)
  if ((f.content?.serviceCount ?? 0) > 5) score += 5;
  if ((f.content?.serviceCount ?? 0) > 15) score += 5;

  // Sosyal medya varlığı
  const socials = f.socials || {};
  const socialCount = [
    socials.instagram,
    socials.facebook,
    socials.linkedin,
    socials.youtube,
    socials.tiktok,
  ].filter(Boolean).length;

  score += socialCount * 3;

  // Firmographic totalScore varsa ona da biraz ağırlık ver
  if (typeof f.scores?.totalScore === "number") {
    score += Math.min(20, f.scores.totalScore);
  }

  // Clamp 0–100
  score = Math.max(0, Math.min(100, score));
  return score;
}

/**
 * AI tabanlı SEO analizi
 * Input:
 *  - lead: merge edilmiş lead objesi (Google + LinkedIn + firmographic)
 *  - sector: isteğe bağlı
 *  - location: isteğe bağlı
 */
async function analyzeLeadSeo({ lead, sector, location }) {
  if (!lead) {
    throw new Error("analyzeLeadSeo requires lead");
  }

  const websiteUrl =
    lead.websiteUrl ||
    lead.source?.google?.website ||
    null;

  const firmographic = lead.firmographic || null;
  const g = lead.source?.google || {};
  const l = lead.source?.linkedin || {};

  const seoScore = computeSeoScore(firmographic);

  const systemPrompt = `
Sen CNG Medya için çalışan üst düzey bir "SEO & Dijital Görünürlük Uzmanı"sın.

Uzmanlık alanların:
- Her sektörden web sitesinin SEO durumunu analiz etmek
- Teknik SEO + içerik + kullanıcı deneyimi + sosyal sinyalleri birlikte yorumlamak
- Ajans satış ekibine aksiyon odaklı, uygulanabilir bir SEO raporu üretmek

Tarzın:
- Türkçe
- Premium, stratejik, danışman seviye
- Maddeli, net ve anlaşılır
- Gereksiz teknik jargon yok; ama gerektiğinde teknik terimleri açıklarsın
- Çıktıyı tamamen **Markdown** formatında üretirsin.
`;

  const userMessage = `
Firma Bilgisi:
- Firma Adı: ${lead.name}
- Sektör: ${sector || lead.sector || "belirtilmedi"}
- Lokasyon: ${location || lead.address || "belirtilmedi"}
- Website: ${websiteUrl || "-"}

Google Bilgisi:
- Google Adı: ${g.name || "-"}
- Adres: ${g.address || "-"}
- Rating: ${g.rating ?? "-"} (${g.userRatingsTotal ?? 0} yorum)

LinkedIn Bilgisi:
- Ad: ${l.name || "-"}
- Lokasyon: ${l.location || "-"}
- Profil: ${l.url || "-"}

Firmographic / Site Analizi:
- Title: ${firmographic?.meta?.title || "-"}
- Meta Description: ${firmographic?.meta?.metaDescription || "-"}
- Logo: ${firmographic?.brand?.logoFound ? "Var" : "Yok"}
- Mobil Uyum: ${firmographic?.ux?.mobileFriendly ? "Evet" : "Hayır"}
- Hakkında Sayfası: ${firmographic?.content?.aboutPresent ? "Var" : "Yok"}
- Tahmini Hizmet Sayısı: ${firmographic?.content?.serviceCount ?? 0}

Sosyal Medya:
- Instagram: ${firmographic?.socials?.instagram ? "Var" : "Yok"}
- Facebook: ${firmographic?.socials?.facebook ? "Var" : "Yok"}
- LinkedIn: ${firmographic?.socials?.linkedin ? "Var" : "Yok"}
- YouTube: ${firmographic?.socials?.youtube ? "Var" : "Yok"}
- TikTok: ${firmographic?.socials?.tiktok ? "Var" : "Yok"}

Görev:
1) Bu firmanın web sitesi ve dijital varlığını SEO açısından değerlendir.
2) Aşağıdaki başlıklarla detaylı bir rapor yaz:
   - Genel Durum Özeti
   - Teknik SEO (sayfa yapısı, mobil, hız, temel etiketler – elindeki veriye göre)
   - İçerik & Anahtar Kelime Stratejisi
   - Kullanıcı Deneyimi (UX) & Dönüşüm Potansiyeli
   - Sosyal Medya & Marka Aramaları
3) "Hızlı Kazanımlar (Quick Wins)" başlığı altında hemen uygulanabilecek 3–5 madde yaz.
4) "CNG Medya İçin Önerilen Aksiyonlar" başlığı altında,
   - Web tasarım/iyileştirme,
   - SEO optimizasyon,
   - içerik üretimi,
   - reklam ve medya planlama
   açısından net aksiyon önerileri ver.
5) Ton: profesyonel, samimi, güven veren ajans danışmanı gibi olsun.
`;

  const seoReport = await callAgent({
    systemPrompt,
    userMessage,
  });

  log.info("[SEO] Analysis generated for:", lead.name);

  return {
    websiteUrl,
    firmographic,
    seoScore,
    seoReport,
  };
}

module.exports = {
  analyzeLeadSeo,
};