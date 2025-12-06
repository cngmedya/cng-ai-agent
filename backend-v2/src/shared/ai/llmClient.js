// backend-v2/src/shared/ai/llmClient.js
//
// Tek sorumluluk:
// - LLM'den JSON güvenli şekilde almak (chatJson)
// - Metin cevabı gerektiğinde basit chat fonksiyonu (chat)
//
// Özellikler:
// - response_format: { type: 'json_object' } kullanır
// - ```json ... ``` code block içinden JSON'ı almayı dener
// - JSON içinde fazladan metin varsa { ... } aralığını kesip parse eder
// - Parse edilemezse anlamlı ve kısaltılmış hata mesajı üretir

const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

/**
 * Genel chat (saf text) – ihtiyaç duyulursa kullanılabilecek basit helper.
 */
async function chat({ system, user, model = DEFAULT_MODEL }) {
  const messages = [];

  if (system) {
    messages.push({ role: 'system', content: system });
  }

  if (user) {
    messages.push({ role: 'user', content: user });
  }

  const completion = await client.chat.completions.create({
    model,
    messages
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  return content || '';
}

/**
 * JSON garantili chat
 *
 * Örn:
 * const result = await chatJson({ system: '...', user: JSON.stringify(payload) });
 */
async function chatJson({ system, user, model = DEFAULT_MODEL }) {
  const messages = [];

  if (system) {
    messages.push({ role: 'system', content: system });
  }

  if (user) {
    messages.push({ role: 'user', content: user });
  }

  const completion = await client.chat.completions.create({
    model,
    messages,
    // Modeli direkt JSON dönmeye zorluyoruz
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices?.[0]?.message?.content?.trim();

  if (!raw) {
    throw new Error('Modelden boş cevap geldi.');
  }

  // 1) Direkt parse denemesi
  try {
    return JSON.parse(raw);
  } catch (_) {
    // devam et, temizleyip yeniden deneyelim
  }

  // 2) ```json ... ``` code block içinden JSON ayıklama
  const cleanedFromFences = extractJsonFromText(raw);
  if (cleanedFromFences) {
    try {
      return JSON.parse(cleanedFromFences);
    } catch (_) {
      // devam
    }
  }

  // 3) Hâlâ parse edemiyorsak: anlamlı ve kısa bir hata
  const preview = raw.length > 600 ? raw.slice(0, 600) + '…' : raw;

  throw new Error(
    `Model JSON formatında dönmedi veya parse edilemedi. Cevap önizleme: ${preview}`
  );
}

/**
 * Gelen text içinden JSON gövdesini ayıklamaya çalışır.
 * - ```json ... ``` bloklarını temizler
 * - İlk '{' ile son '}' arasını alır
 */
function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;

  let candidate = text;

  // ```json ... ``` bloğu varsa içerik kısmını al
  const fenced = text.match(/```json([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    candidate = fenced[1];
  }

  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');

  if (first === -1 || last === -1 || last <= first) {
    return null;
  }

  return candidate.slice(first, last + 1);
}

module.exports = {
  chat,
  chatJson
};