/**
 * Çok basit bir skor motoru – V1
 * Sonra bunu AI destekli hale getireceğiz.
 */

function scoreLead({ googleData, linkedinData }) {
    const g = googleData || {};
    const l = linkedinData || {};
  
    let digitalScore = 0;
    let visibilityScore = 0;
    let brandScore = 0;
  
    // Google rating
    if (g.rating >= 4 && g.userRatingsTotal >= 20) {
      visibilityScore += 30;
      brandScore += 20;
    } else if (g.rating >= 3 && g.userRatingsTotal >= 5) {
      visibilityScore += 20;
    } else if (g.userRatingsTotal > 0) {
      visibilityScore += 10;
    }
  
    // Review sayısı düşükse "gelişebilir" sinyali
    if (g.userRatingsTotal < 10) {
      digitalScore += 15;
    }
  
    // LinkedIn aktivitesi bilinmiyor – V1'de çok etkili değil
    if (l.activityHint === "low") {
      digitalScore += 20;
    }
  
    const totalScore = digitalScore + visibilityScore + brandScore;
  
    let opportunity;
    if (totalScore >= 60) opportunity = "high";
    else if (totalScore >= 35) opportunity = "medium";
    else opportunity = "low";
  
    return {
      digitalScore,
      visibilityScore,
      brandScore,
      totalScore,
      opportunity,
    };
  }
  
  module.exports = { scoreLead };