const { config } = require("../config/env");
const { log } = require("../lib/logger");

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4.1"; // gerekirse değiştiririz

async function callAgent({ systemPrompt, userMessage }) {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY tanımlı değil.");
  }

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  };

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      log.error("OpenAI error:", res.status, text);
      throw new Error(`OpenAI API hatası: ${res.status}`);
    }

    const data = await res.json();
    const answer = data?.choices?.[0]?.message?.content || "";
    return answer.trim();
  } catch (err) {
    log.error("callAgent exception:", err);
    throw err;
  }
}

module.exports = { callAgent };