const { scoreLead } = require("./scoreEngine");

/**
 * Şimdilik basit: sadece isim üzerinden eşleştiriyoruz.
 * İleride fuzzy match eklenebilir.
 */

function mergeSources(googleLeads = [], linkedinLeads = []) {
  return googleLeads.map((g) => {
    const match = linkedinLeads.find(
      (l) =>
        l.name &&
        g.name &&
        l.name.toLowerCase().includes(g.name.toLowerCase().split(" ")[0])
    );

    const scores = scoreLead({ googleData: g, linkedinData: match });

    return {
      name: g.name,
      address: g.address,
      source: {
        google: g,
        linkedin: match || null,
      },
      scores,
    };
  });
}

module.exports = { mergeSources };