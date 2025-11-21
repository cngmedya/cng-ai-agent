const { fetchWebsiteHtml } = require("./websiteFetcher");
const { analyzeWebsite } = require("./websiteAnalyzer");
const { log } = require("../lib/logger");

async function buildFirmographicProfile(lead) {
  if (!lead || !lead.websiteUrl) return null;

  try {
    const fetched = await fetchWebsiteHtml(lead.websiteUrl);
    if (!fetched) return null;

    const analysis = analyzeWebsite(fetched.html);
    if (!analysis) return null;

    return {
      ...analysis,
      url: fetched.finalUrl,
    };
  } catch (err) {
    log.warn(
      `[Firmographic] Profil oluşturulamadı (${lead.name}): ${err.message}`
    );
    return null;
  }
}

module.exports = { buildFirmographicProfile };