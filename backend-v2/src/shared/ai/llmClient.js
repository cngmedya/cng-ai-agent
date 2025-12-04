// backend-v2/src/shared/ai/llmClient.js
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Basit JSON helper:
 * - Hiçbir ek parametre yok (response_format vs.)
 * - Sadece modele "JSON döndür" diyoruz
 * - Gelen metni JSON.parse ile parse ediyoruz
 */
async function chatJson({ system, user, model = 'gpt-4.1-mini' }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY tanımlı değil (.env içinde)');
  }

  const response = await client.responses.create({
    model,
    input: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });

  // Yeni Responses API:
  // response.output[0].content[0].text → model cevabı (string)
  const block = response.output[0].content[0];
  const text = typeof block === 'string' ? block : block.text;

  if (!text) {
    throw new Error('Model boş cevap döndürdü veya beklenen text alanı bulunamadı.');
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    // Debug için ilk 200 karakteri hataya ekleyelim
    throw new Error(
      'Model JSON formatında dönmedi veya parse edilemedi. Cevap: ' +
        text.slice(0, 200)
    );
  }
}

module.exports = {
  chatJson
};