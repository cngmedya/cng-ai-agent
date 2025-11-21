const fetch = require("node-fetch");
const { URL } = require("url");
const { log } = require("../lib/logger");

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;

function buildUrlVariants(rawUrl) {
  if (!rawUrl) return [];
  let variants = [];

  try {
    const u = new URL(rawUrl);
    variants.push(u.toString());
  } catch (_) {
    variants.push(`https://${rawUrl.replace(/^\/+/, "")}`);
    variants.push(`http://${rawUrl.replace(/^\/+/, "")}`);
  }

  return Array.from(new Set(variants));
}

async function fetchWithTimeout(url, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "CNGMedyaBot/1.0",
      },
    });

    clearTimeout(id);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    return { html: text, finalUrl: res.url || url };
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchWebsiteHtml(rawUrl) {
  const variants = buildUrlVariants(rawUrl);
  if (!variants.length) return null;

  let lastError = null;

  for (let i = 0; i < Math.min(MAX_ATTEMPTS, variants.length); i++) {
    const url = variants[i];

    try {
      log.info(`[Firmographic] Fetch attempt ${i + 1}: ${url}`);
      const { html, finalUrl } = await fetchWithTimeout(url);

      if (!html || html.trim().length < 200)
        throw new Error("HTML too short");

      return { html, finalUrl };
    } catch (err) {
      lastError = err;
      log.warn(
        `[Firmographic] Fetch failed (${i + 1}/${MAX_ATTEMPTS}): ${url} => ${
          err.message
        }`
      );
    }
  }

  log.warn(
    `[Firmographic] All fetch attempts failed for: ${rawUrl}. Last error: ${lastError?.message}`
  );
  return null;
}

module.exports = { fetchWebsiteHtml };