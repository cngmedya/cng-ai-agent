// backend-v2/src/modules/research/service/benchmarkService.js

async function benchmarkLead(lead, competitors) {
    // MVP: Basit benchmark, sonra genişleyecek
    return {
      strengths_vs_market: [],
      weaknesses_vs_market: [],
      benchmark_score: 50
    };
  }
  
  module.exports = { benchmarkLead };