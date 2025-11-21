// backend/src/modules/lead-acquisition/services/websiteAiAnalysisService.js

const { log } = require("../../../lib/logger");
const OpenAI = require("openai");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || "";

let openaiClient = null;
if (OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
} else {
  log.warn("[WebIntelAI] OPENAI_API_KEY tanımlı değil. AI analiz devre dışı kalacak.");
}

/**
 * Website intel + AI analizi.
 * @param {Object} params
 * @param {string} params.url
 * @param {Object} params.intel  // enrichWebsiteFromUrl'in döndürdüğü obje
 */
async function analyzeWebsiteWithAI({ url, intel }) {
  if (!openaiClient) {
    throw new Error("OPENAI_API_KEY tanımlı olmadığı için AI analizi yapılamıyor.");
  }

  const title = intel?.title || null;
  const description = intel?.description || null;
  const httpStatus = intel?.httpStatus || null;

  const metaSummary = {
    url,
    httpStatus,
    title,
    description,
  };

  const systemPrompt = `
Sen CNG Medya için çalışan senior bir dijital stratejist ve kreatif direktörsün.
Görevin:
- Verilen website bilgilerine göre hızlı ama derin bir analiz yapmak
- SWOT çıkarmak
- Dijital pazarlama olgunluğunu puanlamak (0–100)
- Ajans için hangi hizmetlerin en mantıklı olduğunu önermek
- Somut aksiyon maddeleri vermek

Çıktını SADECE geçerli JSON formatında döndür.
Markdown, ekstra açıklama, serbest metin YAZMA.
`;

  const userPrompt = `
Aşağıdaki website için analiz yap:

${JSON.stringify(metaSummary, null, 2)}

Lütfen şu formatta JSON üret:

{
  "swot": {
    "strengths": [ "..." ],
    "weaknesses": [ "..." ],
    "opportunities": [ "..." ],
    "threats": [ "..." ]
  },
  "digitalScore": {
    "overall": 0,
    "website": 0,
    "seo": 0,
    "brand": 0
  },
  "idealServices": [
    "Google Ads yönetimi",
    "Meta Ads",
    "Kurumsal web sitesi tasarımı",
    "Sosyal medya yönetimi",
    "Marka konumlandırma",
    "Video prodüksiyon"
  ],
  "shortSummary": "Kısa bir paragrafla markayı ve dijital durumunu özetle.",
  "suggestedNextActions": [
    "1-2 cümlelik net aksiyon madde madde",
    "Önceliklendirilmiş şekilde"
  ]
}
`;

  log.info("[WebIntelAI] Website için AI analizi başlıyor", { url });

  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
  });

  const raw = completion.choices?.[0]?.message?.content || "";
  let parsed = null;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log.error("[WebIntelAI] JSON parse hatası, ham içerik döndürülüyor", {
      error: err.message,
      raw,
    });
    // fallback: hatalı JSON dönerse bile ham string'i döndür
    parsed = {
      parseError: err.message,
      raw,
    };
  }

  log.info("[WebIntelAI] Website AI analizi tamamlandı", { url });

  return {
    url,
    intel: metaSummary,
    ai: parsed,
  };
}

module.exports = {
  analyzeWebsiteWithAI,
};