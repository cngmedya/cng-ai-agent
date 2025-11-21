// backend/src/modules/lead-acquisition/services/leadReputationAiService.js

const { log } = require("../../../lib/logger");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI reputation analizi için prompt oluşturucu
 */
function buildReputationPrompt({ lead, searchIntel }) {
  const { company_name, city, category } = lead;
  const results = searchIntel.results || [];

  const resultText = results
    .map(
      (r, i) => `
#${i + 1}
Title: ${r.title}
URL: ${r.url}
Domain: ${r.domain}
Complaint: ${r.isComplaint}
Review: ${r.isReview}
Snippet: ${r.snippet}
`
    )
    .join("\n");

  return `
Sen CNG MEDYA'nın üst düzey dijital strateji danışmanısın.  
Görevin bir firmanın Google arama sonuçlarını inceleyip dijital itibar analizi çıkarmaktır.

Firma: ${company_name}
Şehir: ${city || "-"}
Kategori: ${category || "-"}

Aşağıdaki veriler Google arama sonuçlarından normalize edilmiştir:
${resultText}

Lütfen şu çıktıları JSON formatında döndür:

{
  "reputation_score": 0-100 arası bir sayı,
  "risk_level": "low" | "medium" | "high",
  "positive_ratio": 0-1 arası (yaklaşık),
  "negative_ratio": 0-1 arası (yaklaşık),
  "summary_markdown": "İnsan tarafından okunabilir kısa özet",
  "key_opportunities": ["madde1", "madde2", ...],
  "suggested_actions": ["adım1", "adım2", ...]
}

Cevabını sadece geçerli JSON olarak döndür.
`;
}

/**
 * AI Reputation Analizi
 */
async function analyzeLeadReputation({ lead, searchIntel }) {
  try {
    log.info("[AI Reputation] Analiz başlıyor", {
      leadId: lead.id,
    });

    const prompt = buildReputationPrompt({ lead, searchIntel });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const text = completion.choices[0].message.content;

    // -------------------------------------------------
    // PATCH: AI’nın döndürdüğü ```json ... ``` bloklarını temizle
    // -------------------------------------------------
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      log.error("[AI Reputation] JSON parse hatası", {
        cleaned,
        err: err.message,
      });

      return {
        reputation_score: 0,
        risk_level: "medium",
        positive_ratio: 0.5,
        negative_ratio: 0.5,
        summary_markdown:
          "AI cevap formatı bozulduğu için varsayılan değerlendirme yapıldı.",
        key_opportunities: [],
        suggested_actions: [],
        parseError: true,
      };
    }

    log.info("[AI Reputation] Analiz tamamlandı", {
      leadId: lead.id,
      score: parsed.reputation_score,
      risk: parsed.risk_level,
    });

    return {
      ...parsed,
      parseError: false,
    };
  } catch (err) {
    log.error("[AI Reputation] HATA:", {
      leadId: lead.id,
      error: err.message,
    });

    return {
      reputation_score: 0,
      risk_level: "high",
      positive_ratio: 0,
      negative_ratio: 1,
      summary_markdown:
        "AI analizinde hata oluştu. Firma dijital itibarı riskli kabul edilmiştir.",
      key_opportunities: [],
      suggested_actions: [],
      parseError: true,
    };
  }
}

module.exports = {
  analyzeLeadReputation,
};