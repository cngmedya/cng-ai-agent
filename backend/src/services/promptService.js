// backend/src/services/promptService.js
const fs = require("fs");
const path = require("path");
const { log } = require("../lib/logger");

// Root: .../cng-ai-agent/prompts
const PROMPT_ROOT = path.join(__dirname, "..", "..", "prompts");

function loadPrompt(relativePath) {
  try {
    const fullPath = path.join(PROMPT_ROOT, relativePath);
    const content = fs.readFileSync(fullPath, "utf8");
    return content;
  } catch (err) {
    log.error("[PromptEngine] Prompt yüklenemedi:", relativePath, err.message);
    return "";
  }
}

function loadCombinedPrompts(paths = []) {
  return paths.map((p) => loadPrompt(p)).join("\n\n");
}

module.exports = { loadPrompt, loadCombinedPrompts };