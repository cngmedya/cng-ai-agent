// backend-v2/src/modules/research/service/competitorsService.js
//
// Competitors Engine v1.0.0
// - Lead'e göre potansiyel rakipleri DB'den bulur
// - Web presence sinyallerini (OSINT) kullanarak basit bir rekabet skoru üretir
// - Research pipeline içinde LLM'e gönderilecek "competitors" datasını hazırlar

const { getDb } = require('../../../core/db');

/**
 * Ana fonksiyon:
 * findCompetitors(lead, webPresence) → competitors[]
 *
 * @param {Object} lead            - potential_leads kaydı
 * @param {Object|null} webPresence - websearchService.runWebSearch çıktısı
 * @returns {Promise<Array>}
 */
async function findCompetitors(lead, webPresence) {
  if (!lead || !lead.id) {
    throw new Error('[competitors] Geçersiz lead objesi');
  }

  const db = getDb();

  const leadCity = (lead.city || '').trim();
  const leadCategory = (lead.category || '').trim();

  // 1) Aynı şehir + aynı/benzer kategoriye sahip diğer lead'leri çek
  const candidates = db
    .prepare(
      `
      SELECT
        id,
        name,
        city,
        country,
        category,
        phone,
        website,
        ai_score
      FROM potential_leads
      WHERE id <> @id
        AND (
          @category IS NULL
          OR LOWER(COALESCE(category, '')) = LOWER(@category)
        )
        AND (
          @city IS NULL
          OR LOWER(COALESCE(city, '')) = LOWER(@city)
        )
      ORDER BY
        ai_score DESC NULLS LAST,
        id DESC
      LIMIT 20
    `
    )
    .all({
      id: lead.id,
      category: leadCategory || null,
      city: leadCity || null
    });

  // SQLite NULLS LAST desteklemediği için fallback:
  // ai_score null olanlar en sona itilecek şekilde hafifçe normalize edelim.
  const osintIntensity = computeOsintIntensity(webPresence);

  const competitors = candidates.map((row) => {
    const sameCity =
      !!leadCity &&
      !!row.city &&
      row.city.toLowerCase().trim() === leadCity.toLowerCase();

    const categoryMatch =
      !!leadCategory &&
      !!row.category &&
      row.category.toLowerCase().trim() === leadCategory.toLowerCase();

    const hasWebsite = !!row.website;
    const aiScore = typeof row.ai_score === 'number' ? row.ai_score : null;

    const competitorStrengthScore = computeCompetitorScore({
      hasWebsite,
      aiScore,
      categoryMatch,
      sameCity,
      osintScore: osintIntensity
    });

    return {
      id: row.id,
      name: row.name,
      city: row.city || null,
      country: row.country || null,
      category: row.category || null,
      phone: row.phone || null,
      website: row.website || null,
      ai_score: aiScore,
      competitor_strength_score: competitorStrengthScore
    };
  });

  // Skora göre büyükten küçüğe sırala
  competitors.sort(
    (a, b) =>
      (b.competitor_strength_score || 0) - (a.competitor_strength_score || 0)
  );

  return competitors;
}

/**
 * OSINT yoğunluğuna göre 0–100 arası bir skor üretir.
 * Burada lead'in genel web görünürlüğünü rakip skoruna küçük bir katkı olarak kullanıyoruz.
 */
function computeOsintIntensity(webPresence) {
  if (!webPresence || typeof webPresence !== 'object') return 0;

  const directories = Array.isArray(webPresence.directories)
    ? webPresence.directories.length
    : 0;
  const news = Array.isArray(webPresence.news_mentions)
    ? webPresence.news_mentions.length
    : 0;
  const blogs = Array.isArray(webPresence.blog_mentions)
    ? webPresence.blog_mentions.length
    : 0;
  const profiles = Array.isArray(webPresence.third_party_profiles)
    ? webPresence.third_party_profiles.length
    : 0;

  const total = directories + news + blogs + profiles;
  if (total <= 0) return 0;

  // Çok agresif olmadan lineer bir yoğunluk:
  // 1 kaynak → 20, 5+ kaynak → 100
  const raw = total * 20;
  return clamp(raw, 0, 100);
}

/**
 * Tek bir rakip için 0–100 arası güç skoru üretir.
 */
function computeCompetitorScore({
  hasWebsite,
  aiScore,
  categoryMatch,
  sameCity,
  osintScore
}) {
  const normalizedAi = clamp(
    typeof aiScore === 'number' ? aiScore : 50, // veri yoksa nötr: 50
    0,
    100
  );

  const websitePart = hasWebsite ? 20 : 0;
  const aiPart = normalizedAi * 0.3; // max 30 puan
  const categoryPart = categoryMatch ? 20 : 0;
  const cityPart = sameCity ? 20 : 0;
  const osintPart = clamp(osintScore, 0, 100) * 0.1; // max 10 puan

  const total = websitePart + aiPart + categoryPart + cityPart + osintPart;

  return Math.round(clamp(total, 0, 100));
}

function clamp(value, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  findCompetitors
};