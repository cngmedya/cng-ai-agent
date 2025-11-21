function normalizeLinkedinCompany(company) {
    return {
      source: "linkedin",
      name: company.name || "",
      location: company.location || "",
      url: company.url || null,
      employees: company.employees || null,
      headline: company.headline || "",
      activityHint: company.activityHint || "unknown",
    };
  }
  
  function parseLinkedinCompanies(results = []) {
    return results.map(normalizeLinkedinCompany);
  }
  
  module.exports = { parseLinkedinCompanies };