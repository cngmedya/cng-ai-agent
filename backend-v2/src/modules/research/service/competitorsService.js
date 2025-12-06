// backend-v2/src/modules/research/service/competitorsService.js

/**
 * Rakip analizi — v1.0.0
 * Sektör bağımsız çalışır.
 *
 * Girdi:
 *   - lead: { name, category, city, website }
 *   - web_presence: OSINT taraması sonuçları (news/blog/directory/third_party_profiles)
 *
 * Mantık:
 *   1) Google tarzı arama ifadeleri oluşturur
 *   2) web_presence içinden rakip olabilecek domain/isimleri çıkartır
 *   3) Lead’in kendi domain ismini ve kendi adını hariç tutar
 *   4) Duplicates temizlenir → ilk 5 rakip döner
 */

function clean(str) {
  return (str || "").toLowerCase().trim();
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.replace("www.", "").toLowerCase();
  } catch {
    return null;
  }
}

async function findCompetitors(lead, web_presence) {
  const leadName = clean(lead.name);
  const leadDomain = clean(extractHostname(lead.website));
  const leadCategory = clean(lead.category);
  const leadCity = clean(lead.city);

  const candidates = new Map();

  // 1) web_presence.third_party_profiles üzerinden rakip adaylarını topla
  const allSources = [
    ...(web_presence?.third_party_profiles || []),
    ...(web_presence?.directories || []),
    ...(web_presence?.news_mentions || []),
    ...(web_presence?.blog_mentions || []),
  ];

  for (const item of allSources) {
    const url = item.url;
    const hostname = extractHostname(url);
    const title = clean(item.title);

    if (!hostname) continue;

    // kendi domainimizi hariç tutuyoruz
    if (leadDomain && hostname.includes(leadDomain)) continue;

    // kendi adımızı içeren başlıkları hariç tutuyoruz
    if (leadName && title.includes(leadName)) continue;

    // Basit sektör sinyali — kategori geçiyorsa +1
    let score = 0;
    if (leadCategory && title.includes(leadCategory)) score += 2;
    if (leadCity && title.includes(leadCity)) score += 1;

    // URL’de sektörel kelime varsa (ör: mimarlık, restaurant, klinik, ajans vs.)
    if (leadCategory && clean(url).includes(leadCategory)) score += 2;

    // kaydet
    if (!candidates.has(hostname)) {
      candidates.set(hostname, {
        domain: hostname,
        url,
        title: item.title || "",
        snippet: item.snippet || "",
        source: item.source || "",
        relevance_score: score,
      });
    }
  }

  // Skor sıralama
  const sorted = Array.from(candidates.values())
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 5); // en fazla 5 rakip

  return sorted;
}

module.exports = { findCompetitors };