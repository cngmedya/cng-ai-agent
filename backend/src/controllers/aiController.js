const fs = require("fs");
const path = require("path");
const { callAgent } = require("../services/aiService");

// prompt dosyaları (birazdan /prompts içine ekleyeceğiz)
const beyinPath = path.join(__dirname, "../../..", "prompts", "CNG_AI_AGENT_V2_BEYIN.md");
const lightPath = path.join(__dirname, "../../..", "prompts", "CNG_AI_AGENT_V2_LIGHT.md");

const beyinPrompt = fs.existsSync(beyinPath) ? fs.readFileSync(beyinPath, "utf8") : "";
const lightPrompt = fs.existsSync(lightPath) ? fs.readFileSync(lightPath, "utf8") : "";

function getSystemPrompt() {
  // Beyin varsa onu, yoksa light’ı kullan
  if (beyinPrompt) return beyinPrompt;
  if (lightPrompt) return lightPrompt;
  return "Sen CNG Medya için tasarlanmış bir reklam ajansı AI asistanısın.";
}

async function leadAnalyze(req, res) {
  try {
    const { input } = req.body;

    const systemPrompt = getSystemPrompt();
    const userMessage = `
Kullanıcıdan gelen lead analizi isteği:

${input}

Yukarıdaki talebe göre CNG Medya AI Agent olarak lead analizi yap.
Firma isimlerini net bir şekilde kullan, fırsatları ve önerilen hizmetleri belirt.
`;

    const answer = await callAgent({ systemPrompt, userMessage });
    res.json({ ok: true, answer });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function offerGenerate(req, res) {
  try {
    const { input } = req.body;

    const systemPrompt = getSystemPrompt();
    const userMessage = `
Aşağıdaki firma/hizmet bilgisine göre CNG Medya üslubunda premium bir teklif taslağı hazırla:

${input}

Teklifi tamamen kişiye özel, net başlıklar ve açıklamalar halinde yaz.
`;

    const answer = await callAgent({ systemPrompt, userMessage });
    res.json({ ok: true, answer });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function healthReport(req, res) {
  try {
    const { context } = req.body;

    const systemPrompt = getSystemPrompt();
    const userMessage = `
Ajans sağlık raporu isteği:

${context}

CNG Medya CEO Mode'da, fırsatlar, riskler ve öncelikler içeren kısa bir ajans sağlık raporu üret.
`;

    const answer = await callAgent({ systemPrompt, userMessage });
    res.json({ ok: true, answer });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { leadAnalyze, offerGenerate, healthReport };