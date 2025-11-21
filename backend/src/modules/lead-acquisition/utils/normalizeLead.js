// backend/src/modules/lead-acquisition/utils/normalizeLead.js

function safeGet(obj, path, defaultValue = null) {
    try {
      return path.split(".").reduce((acc, key) => {
        if (!acc) return null;
        return acc[key];
      }, obj) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }
  
  // Google Places place objesini potential_leads yapısına çevir
  function normalizePlaceToLead(place, context = {}) {
    const { keyword, sourceType = "google_places", location } = context;
  
    const company_name = place.name || null;
    const address =
      place.formatted_address ||
      safeGet(place, "vicinity") ||
      null;
  
    let city = null;
    if (address && typeof address === "string") {
      const parts = address.split(",");
      city = parts.length > 1 ? parts[parts.length - 2].trim() : null;
    }
  
    const country = null; // ileride geocoding ile doldurulabilir
    const website = place.website || null; // textsearch result genelde vermez, placeDetails gerekebilir (V2'de)
    const phone = null; // V1 skeleton: telefon bilgisi için ekstra call yok
  
    // kategori: keyword + place.types birleşimi
    const placeTypes = Array.isArray(place.types) ? place.types.join(",") : "";
    const category = keyword || placeTypes;
  
    return {
      company_name,
      category,
      website,
      phone,
      address,
      city,
      country,
      source: sourceType,
      location_hint: location,
    };
  }
  
  module.exports = {
    normalizePlaceToLead,
  };