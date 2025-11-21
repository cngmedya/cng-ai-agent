// backend/src/firmographic/websiteAnalyzer.js

const cheerio = require("cheerio");

/**
 * HTML içinden firmographic bilgiler çıkar:
 *  - meta title / description
 *  - logo var mı?
 *  - mobile friendly (viewport meta)
 *  - basit içerik sinyalleri (hakkımızda, hizmetler vb.)
 *  - sosyal linkler
 *  - skorlar (design / content / social / total)
 */
function analyzeWebsite(html) {
  if (!html || typeof html !== "string") {
    return null;
  }

  const $ = cheerio.load(html);

  const title = ($("title").first().text() || "").trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    null;

  const hasViewport =
    $('meta[name="viewport"]').attr("content")?.includes("width=device-width") ||
    false;

  // Basit logo tespiti
  const logoImg =
    $('img[alt*="logo" i]').first().attr("src") ||
    $('img[src*="logo" i]').first().attr("src") ||
    null;

  // Gövde metni – çok büyük sitelerde aşırı uzun olmasın diye kırpıyoruz
  const bodyText = $("body").text().replace(/\s+/g, " ").slice(0, 5000);

  const hasAbout =
    /hakkımızda|hakkimizda|about us|biz kimiz/i.test(bodyText) || false;
  const hasServiceWords =
    /hizmetlerimiz|hizmetler|servisler|neler yapıyoruz|solutions/i.test(
      bodyText
    ) || false;

  // Hizmet sayısını kaba tahmin – "•", "-" bullet, <li> sayısı vb.
  const liCount = $("li").length;
  const serviceCount = Math.min(liCount, 30);

  // Sosyal link tespiti
  const htmlLower = html.toLowerCase();
  const socials = {
    instagram: htmlLower.includes("instagram.com"),
    facebook: htmlLower.includes("facebook.com"),
    linkedin: htmlLower.includes("linkedin.com"),
    youtube:
      htmlLower.includes("youtube.com") || htmlLower.includes("youtu.be"),
    tiktok: htmlLower.includes("tiktok.com"),
  };

  // Skorlar (çok basit heuristic, sadece önceliklendirme için)
  let designScore = 0;
  if (title) designScore += 4;
  if (metaDescription) designScore += 3;
  if (hasViewport) designScore += 3;
  if (logoImg) designScore += 4;
  designScore = Math.min(designScore, 10);

  let contentScore = 0;
  if (hasAbout) contentScore += 4;
  if (hasServiceWords) contentScore += 3;
  if (serviceCount > 5) contentScore += 3;
  contentScore = Math.min(contentScore, 10);

  let socialScore = 0;
  Object.keys(socials).forEach((k) => {
    if (socials[k]) socialScore += 2;
  });
  socialScore = Math.min(socialScore, 10);

  const totalScore = designScore + contentScore + socialScore;

  return {
    meta: {
      title,
      metaDescription,
    },
    brand: {
      logoFound: !!logoImg,
      logoSrc: logoImg,
    },
    ux: {
      mobileFriendly: !!hasViewport,
    },
    content: {
      aboutPresent: hasAbout,
      serviceCount,
    },
    socials,
    scores: {
      designScore,
      contentScore,
      socialScore,
      totalScore,
    },
  };
}

module.exports = {
  analyzeWebsite,
};