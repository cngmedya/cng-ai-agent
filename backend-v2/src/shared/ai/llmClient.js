// backend-v2/src/shared/ai/llmClient.js

const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

/**
 * Basic text chat
 */
async function chat({ system, user, model = DEFAULT_MODEL }) {
  const messages = [];

  if (system) messages.push({ role: 'system', content: system });
  if (user) messages.push({ role: 'user', content: user });

  const completion = await client.chat.completions.create({
    model,
    messages
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  return content || '';
}

/**
 * JSON guaranteed chat
 * return { ok: true, json, raw }
 */
async function chatJson({ system, user, model = DEFAULT_MODEL }) {
  const messages = [];

  if (system) messages.push({ role: 'system', content: system });
  if (user) messages.push({ role: 'user', content: user });

  const completion = await client.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices?.[0]?.message?.content?.trim();

  if (!raw) {
    return {
      ok: false,
      error: 'Modelden boş cevap geldi.',
      raw: null,
      json: null
    };
  }

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(raw);
    return { ok: true, json: parsed, raw };
  } catch (_) {}

  // Try extracting fenced JSON
  const cleaned = extractJsonFromText(raw);
  if (cleaned) {
    try {
      const parsed = JSON.parse(cleaned);
      return { ok: true, json: parsed, raw };
    } catch (_) {}
  }

  return {
    ok: false,
    error: 'JSON parse edilemedi',
    raw,
    json: null
  };
}

function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;

  let candidate = text;

  const fenced = text.match(/```json([\s\S]*?)```/i);
  if (fenced?.[1]) candidate = fenced[1];

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