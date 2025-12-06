// backend-v2/src/modules/research/service/benchmarkService.js
//
// Benchmark Engine v1.0.0
// - Rakip skorlarından pazar benchmark skoru üretir
// - Lead'in rakiplerine göre nerede konumlandığını özetler
// - CIR içinde kullanılacak "benchmark" objesini hazırlar

/**
 * benchmarkLead(lead, competitors) → benchmark
 *
 * @param {Object} lead
 * @param {Array} competitors - competitorsService.findCompetitors çıktısı
 * @returns {Object} benchmark
 */
function benchmarkLead(lead, competitors) {
  const leadAi = sanitizeScore(lead && lead.ai_score);

  const competitorScores = Array.isArray(competitors)
    ? competitors
        .map((c) => sanitizeScore(c.competitor_strength_score))
        .filter((s) => s !== null)
    : [];

  let benchmarkScore;
  let avgCompetitorScore = null;

  if (competitorScores.length > 0) {
    avgCompetitorScore =
      competitorScores.reduce((sum, v) => sum + v, 0) / competitorScores.length;

    // Tasarladığımız formül:
    // benchmark_score = avg(competitors) - (100 - lead.ai_score)/2
    const effectiveLeadAi =
      leadAi !== null ? leadAi : Math.round(avgCompetitorScore);

    const raw =
      avgCompetitorScore - (100 - clamp(effectiveLeadAi, 0, 100)) / 2;

    benchmarkScore = Math.round(clamp(raw, 0, 100));
  } else {
    // Rakip yoksa bench'i lead'in AI skoruna yakın tutuyoruz
    benchmarkScore =
      leadAi !== null ? Math.round(clamp(leadAi, 0, 100)) : 50;
  }

  const { strengths, weaknesses } = buildMarketNarrative({
    leadAi,
    benchmarkScore,
    avgCompetitorScore,
    competitorCount: competitorScores.length
  });

  return {
    benchmark_score: benchmarkScore,
    strengths_vs_market: strengths,
    weaknesses_vs_market: weaknesses
  };
}

/**
 * Pazar anlatısını basit kurallarla üretir.
 */
function buildMarketNarrative({
  leadAi,
  benchmarkScore,
  avgCompetitorScore,
  competitorCount
}) {
  const strengths = [];
  const weaknesses = [];

  if (competitorCount === 0) {
    strengths.push(
      'Bu lead için kayıtlı doğrudan rakip bulunmuyor; pazar nispeten boş görünüyor.'
    );
    return { strengths, weaknesses };
  }

  if (avgCompetitorScore != null) {
    strengths.push(
      `Pazardaki rakip ortalama dijital güç skoru yaklaşık ${Math.round(
        avgCompetitorScore
      )} seviyesinde.`
    );
  }

  if (benchmarkScore >= 70) {
    strengths.push(
      'Lead, dijital güç ve rekabet açısından pazar ortalamasının üzerinde konumlanıyor.'
    );
  } else if (benchmarkScore >= 50) {
    strengths.push(
      'Lead dijital rekabet gücü açısından pazar ortalamasına yakın bir konumda.'
    );
  } else {
    weaknesses.push(
      'Lead, dijital güç ve görünürlük açısından pazar ortalamasının altında konumlanıyor.'
    );
  }

  if (typeof leadAi === 'number' && avgCompetitorScore != null) {
    if (leadAi >= avgCompetitorScore + 5) {
      strengths.push(
        'AI değerlendirme skoruna göre lead, rakiplerin ortalamasının üzerinde bir potansiyel sunuyor.'
      );
    } else if (leadAi <= avgCompetitorScore - 5) {
      weaknesses.push(
        'AI skoruna göre lead, rakip ortalamasının gerisinde kalıyor; dijital iyileştirmeler kritik.'
      );
    }
  }

  if (competitorCount >= 5) {
    weaknesses.push(
      'Benzer segmentte birden fazla güçlü rakip bulunuyor; pazar rekabet seviyesi yüksek.'
    );
  } else if (competitorCount > 0 && competitorCount <= 3) {
    strengths.push(
      'Segmentte sınırlı sayıda doğrudan rakip var; rekabet avantajı yaratmak daha ulaşılabilir görünüyor.'
    );
  }

  return { strengths, weaknesses };
}

function sanitizeScore(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return clamp(value, 0, 100);
}

function clamp(value, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  benchmarkLead
};