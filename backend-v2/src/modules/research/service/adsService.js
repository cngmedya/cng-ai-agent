// backend-v2/src/modules/research/service/adsService.js
//
// Ad / Pixel Intelligence v2.0
// - Lead'in web sitesini tarayıp temel izleme / reklam etiketlerini tespit eder
// - Şimdilik sadece presence sinyali verir:
//   - pixel_detected (Meta / Facebook Pixel)
//   - google_analytics_detected (GA / gtag / GTM)
// - Çıktı shape'i RESEARCH master prompt ile uyumludur:
//   {
//     active_ads: [],
//     pixel_detected: boolean,
//     google_analytics_detected: boolean
//   }

const { fetchWebsiteSnapshot } = require('../../../shared/web/fetchWebsite');

async function analyzeAds(lead) {
  const empty = {
    active_ads: [],
    pixel_detected: false,
    google_analytics_detected: false
  };

  if (!lead || !lead.website) {
    return empty;
  }

  let html = '';

  try {
    const snapshot = await fetchWebsiteSnapshot(lead.website);

    if (typeof snapshot === 'string') {
      html = snapshot;
    } else if (snapshot && typeof snapshot === 'object') {
      html = snapshot.html || snapshot.content || '';
    }
  } catch (err) {
    console.warn('[adsService] fetchWebsiteSnapshot hata:', err.message);
    return empty;
  }

  const haystack = (html || '').toString().toLowerCase();

  const pixel_detected =
    haystack.includes('facebook.com/tr') ||
    haystack.includes('connect.facebook.net') ||
    haystack.includes('fbq(') ||
    haystack.includes('fbq("init"') ||
    haystack.includes("fbq('init'");

  const google_analytics_detected =
    haystack.includes('www.google-analytics.com') ||
    haystack.includes('google-analytics.com/analytics.js') ||
    haystack.includes('gtag(') ||
    haystack.includes('ga(') ||
    haystack.includes('googletagmanager.com') ||
    haystack.includes('gtm.js');

  // Şimdilik aktif kampanya listesi tutmuyoruz, sadece sinyaller
  const active_ads = [];

  return {
    active_ads,
    pixel_detected,
    google_analytics_detected
  };
}

module.exports = {
  analyzeAds
};