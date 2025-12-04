// backend-v2/src/modules/research/service/socialsService.js

async function detectSocials(lead) {
    // MVP: Website/Google/Name üzerinden link detect edilecek
    return {
      instagram: null,
      facebook: null,
      linkedin: null,
      youtube: null,
      tiktok: null,
      activity_score: 0
    };
  }
  
  module.exports = { detectSocials };