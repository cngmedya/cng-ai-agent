// backend/src/services/aiService.js

const OpenAI = require("openai");
const { config } = require("../config/env");
const { log } = require("../lib/logger");
const { loadCombinedPrompts } = require("./promptService");

const client = new OpenAI({
  apiKey: config.openaiApiKey,
});

/**
 * Genel amaçlı AI çağrısı.
 * Tüm modüller burayı kullanıyor.
 */
async function callAgent({
  systemPrompt = "",
  userMessage,
  model = config.openaiModel || "gpt-4.1-mini",
  temperature = 0.4,
  maxTokens = 2000,
  useUniversalBrain = true,
}) {
  if (!userMessage) {
    throw new Error("callAgent userMessage zorunludur.");
  }

  let finalSystemPrompt = systemPrompt || "";

  if (useUniversalBrain) {
    const universal = loadCombinedPrompts([
      "universal/brain.md",
      "universal/voice_style.md",
    ]);

    if (universal && universal.trim().length > 0) {
      finalSystemPrompt = `${universal}\n\n${systemPrompt || ""}`.trim();
    }
  }

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    const content =
      completion.choices?.[0]?.message?.content?.trim() ||
      "(boş yanıt döndü)";
    return content;
  } catch (err) {
    log.error("callAgent error:", err);
    throw err;
  }
}

module.exports = { callAgent };