// backend/src/lead-engine/analyzer/opportunityEngine.js

/**
 * Tek bir lead için birleşik skor hesaplar.
 * - leadScore: lead.scores.totalScore
 * - firmScore: lead.firmographic.scores.totalScore
 * firmScore'u biraz daha ağır basacak şekilde kullanıyoruz.
 */
function calcCombinedScore(lead) {
    const leadScore = lead?.scores?.totalScore ?? 0;
    const firmScore = lead?.firmographic?.scores?.totalScore ?? 0;
  
    // Ağırlıklar: firmographic 2x, lead 1x
    const combined = leadScore + firmScore * 2;
  
    return {
      leadScore,
      firmScore,
      combined,
    };
  }
  
  /**
   * Normalize edilmiş skor için 0–100 arası bir değer üret.
   */
  function normalizeScores(combinedScores) {
    if (!combinedScores.length) return [];
  
    const values = combinedScores.map((c) => c.combined);
    const min = Math.min(...values);
    const max = Math.max(...values);
  
    return combinedScores.map((c) => {
      let normalized = 50;
  
      if (max !== min) {
        normalized = ((c.combined - min) / (max - min)) * 100;
      }
  
      // 0–100 arasında clamp
      if (normalized < 0) normalized = 0;
      if (normalized > 100) normalized = 100;
  
      return { ...c, normalized };
    });
  }
  
  /**
   * Normalized skora göre fırsat bucket'ı belirle.
   */
  function classifyOpportunity(normalizedScore) {
    if (normalizedScore >= 75) {
      return { bucket: "hot", label: "Yüksek Fırsat" };
    }
    if (normalizedScore >= 50) {
      return { bucket: "warm", label: "Orta Fırsat" };
    }
    return { bucket: "cold", label: "Düşük Fırsat" };
  }
  
  /**
   * Lead listesini zenginleştir:
   * - engine.combinedScore
   * - engine.normalizedScore
   * - engine.bucket ("hot" / "warm" / "cold")
   * - engine.label (Türkçe açıklama)
   * - engine.rank (1 en iyi)
   */
  function enrichLeadsWithScores(leads = []) {
    if (!Array.isArray(leads) || leads.length === 0) return [];
  
    // 1) Kombine skorları hesapla
    const combined = leads.map((lead, idx) => ({
      index: idx,
      lead,
      ...calcCombinedScore(lead),
    }));
  
    // 2) Normalize et
    const normalizedList = normalizeScores(combined);
  
    // 3) Skora göre sırala ve rank ver
    const sorted = [...normalizedList].sort(
      (a, b) => b.normalized - a.normalized
    );
  
    sorted.forEach((item, i) => {
      item.rank = i + 1;
    });
  
    // 4) Orijinal diziyi zenginleştir
    const enriched = leads.map((lead, idx) => {
      const info = sorted.find((x) => x.index === idx) || normalizedList[idx];
      const { bucket, label } = classifyOpportunity(info.normalized);
  
      return {
        ...lead,
        engine: {
          leadScore: info.leadScore,
          firmographicScore: info.firmScore,
          combinedScore: info.combined,
          normalizedScore: Math.round(info.normalized),
          bucket,
          label,
          rank: info.rank,
        },
      };
    });
  
    return enriched;
  }
  
  /**
   * En iyi lead'i seçmek için yardımcı fonksiyon.
   * Eğer enrichLeadsWithScores çağrılmışsa engine.combinedScore kullanır,
   * yoksa fallback olarak leadScore + 2*firmScore hesaplar.
   */
  function pickBestLeadFromEnriched(leads = []) {
    if (!Array.isArray(leads) || leads.length === 0) return null;
  
    let best = null;
  
    for (const lead of leads) {
      const combined =
        lead?.engine?.combinedScore ??
        calcCombinedScore(lead).combined;
  
      if (!best || combined > best.combined) {
        best = { combined, lead };
      }
    }
  
    return best?.lead || leads[0];
  }
  
  module.exports = {
    enrichLeadsWithScores,
    pickBestLeadFromEnriched,
  };