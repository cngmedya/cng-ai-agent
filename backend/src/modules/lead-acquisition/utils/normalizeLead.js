// backend/src/modules/lead-acquisition/utils/normalizeLead.js

/**
 * Google Places place objesini, bizim potential_leads şemamıza normalize eder.
 *
 * Input (örnek):
 *  - place: Google Places text search + details ile gelen obje
 *  - options: { keyword, sourceType, location }
 *
 * Output:
 *  {
 *    company_name,
 *    category,
 *    website,
 *    phone,
 *    address,
 *    city,
 *    country,
 *    source
 *  }
 */

/**
 * Website URL temizleyici
 * - Boşlukları kırpar
 * - " " gibi saçma değerleri NULL yapar
 * - Lowercase'e çeker
 */
function normalizeWebsite(website) {
  if (!website) return null;
  let w = String(website).trim();
  if (!w) return null;

  // Eğer sadece saçma kısa string ise (örn: "-")
  if (w.length < 4) return null;

  // Lowercase
  w = w.toLowerCase();

  return w;
}

/**
 * Telefon normalize:
 * - Tüm boşluk, parantez, tireleri kaldır
 * - Başında + yoksa ve Türkiye formatına benziyorsa +90 ekleyebiliriz (çok agresif davranmayalım)
 */
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).trim();
  if (!p) return null;

  // Semboller vs. temizle
  p = p.replace(/[\s\-().]/g, "");

  if (!p) return null;

  // Eğer zaten + ile başlıyorsa dokunma
  if (p.startsWith("+")) {
    return p;
  }

  // TR için çok temel bir tahmin:
  // 10 haneli ise (5xx...) veya 11 haneli 0 ile başlıyorsa → +90 ekle
  if (p.length === 10 && p.startsWith("5")) {
    return "+90" + p;
  }

  if (p.length === 11 && p.startsWith("0")) {
    return "+9" + p; // 0 + 90 + 5xx... → basit yaklaşım
  }

  // Aksi halde olduğu gibi dön
  return p;
}

/**
 * Adres içinden city / country çıkarma
 * Google çoğunlukla:
 *  "..., 34750 Ataşehir/İstanbul, Türkiye"
 * gibi format veriyor.
 */
function parseAddressCityCountry(address) {
  if (!address) {
    return {
      address: null,
      city: null,
      country: null,
    };
  }

  let addr = String(address).trim();
  if (!addr) {
    return {
      address: null,
      city: null,
      country: null,
    };
  }

  // Parçaları virgüle göre ayıralım
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);

  let country = null;
  let city = null;

  if (parts.length > 0) {
    const last = parts[parts.length - 1];

    // Son parçada "Türkiye" geçiyorsa country = Türkiye
    if (/türkiye/i.test(last)) {
      country = "Türkiye";
      parts.pop();
    }
  }

  // Tekrar bak: şimdi son parça şehir bilgisi olabilir
  if (parts.length > 0) {
    const last = parts[parts.length - 1];

    // Eğer "Ataşehir/İstanbul" gibi ise, / sonrası şehir olarak al
    if (last.includes("/")) {
      const subParts = last.split("/").map((p) => p.trim()).filter(Boolean);
      city = subParts[subParts.length - 1] || null;
    } else {
      city = last || null;
    }
  }

  // Geri kalan her şeyi "temiz adres" olarak birleştir
  const cleanAddress = parts.join(", ");

  return {
    address: cleanAddress || null,
    city,
    country,
  };
}

/**
 * Google Places types → daha okunur kategori
 * Örn:
 *  - ["architect", "point_of_interest", "establishment"] → "mimarlık ofisi"
 *  - ["interior_designer", ...] → "iç mimarlık ofisi"
 */
function normalizeCategory(place, fallbackKeyword) {
  const types = place.types || [];
  const lowerTypes = types.map((t) => String(t).toLowerCase());

  if (lowerTypes.includes("interior_designer")) {
    return "iç mimarlık ofisi";
  }

  if (
    lowerTypes.includes("architect") ||
    lowerTypes.includes("architecture_firm")
  ) {
    return "mimarlık ofisi";
  }

  // Google bazen "establishment", "point_of_interest" vs. verir → çok genel, kullanma
  // Eğer hiçbir şey bulamadıysak, keyword'den faydalanabiliriz:
  if (fallbackKeyword) {
    return String(fallbackKeyword).toLowerCase();
  }

  return null;
}

/**
 * Ana normalize fonksiyonu
 */
function normalizePlaceToLead(place, options = {}) {
  const { keyword, sourceType, location } = options;

  const company_name = place.name || null;

  // Website:
  const websiteRaw =
    place.website ||
    (place._details && place._details.website) ||
    null;
  const website = normalizeWebsite(websiteRaw);

  // Telefon:
  const phoneRaw =
    place.phone ||
    place.international_phone_number ||
    place.formatted_phone_number ||
    (place._details && (place._details.international_phone_number || place._details.formatted_phone_number)) ||
    null;
  const phone = normalizePhone(phoneRaw);

  // Adres:
  const addressRaw =
    place.formatted_address ||
    place.vicinity ||
    null;

  const { address, city, country } = parseAddressCityCountry(addressRaw);

  // Kategori:
  const category = normalizeCategory(place, keyword);

  // Kaynak:
  const source = sourceType || "google_places";

  return {
    company_name,
    category,
    website,
    phone,
    address,
    city,
    country,
    source,
  };
}

module.exports = {
  normalizePlaceToLead,
  normalizeWebsite,
  normalizePhone,
  parseAddressCityCountry,
  normalizeCategory,
};