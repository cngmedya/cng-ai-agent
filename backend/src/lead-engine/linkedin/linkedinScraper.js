const { log } = require("../../lib/logger");

/**
 * V1: LinkedIn tarafı için placeholder.
 * İleride resmi API / 3rd party entegrasyon buraya gelecek.
 */
async function searchLinkedinCompanies({ companyName, location }) {
  log.info("LinkedIn placeholder arama:", companyName, location);

  // Şimdilik sadece sahte bir kayıt dönüyoruz ki pipeline çalışsın.
  return [
    {
      source: "linkedin",
      name: companyName,
      location,
      url: null,
      employees: null,
      headline: null,
      activityHint: "unknown",
    },
  ];
}

module.exports = { searchLinkedinCompanies };