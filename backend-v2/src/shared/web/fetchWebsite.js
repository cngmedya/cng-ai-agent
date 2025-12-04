// backend-v2/src/shared/web/fetchWebsite.js
const cheerio = require('cheerio');

/**
 * Verilen website URL'sinden basit bir içerik snapshot'ı alır.
 * Node 18+ global fetch kullanıyor.
 * Network hatalarında throw ETMEZ, hata bilgisini döner.
 */
async function fetchWebsiteSnapshot(rawUrl) {
  if (!rawUrl) {
    throw new Error('Website URL zorunlu');
  }

  // URL "https://" olmadan geldiyse düzeltmeye çalış
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CNG-AI-Agent/1.0 (+https://cngmedya.com)'
      },
      redirect: 'follow'
    });

    if (!res.ok) {
      // Burada da patlatmayalım, structured error dönderelim
      return {
        url,
        error: `HTTP ${res.status} ${res.statusText}`,
        title: null,
        metaDescription: null,
        headings: [],
        textSnippet: ''
      };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('title').first().text().trim() || null;
    const metaDescription =
      $('meta[name="description"]').attr('content')?.trim() || null;

    const headings = [];
    ['h1', 'h2', 'h3'].forEach((tag) => {
      $(tag).each((_, el) => {
        const text = $(el).text().trim();
        if (text) headings.push(text);
      });
    });

    let bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    if (bodyText.length > 4000) {
      bodyText = bodyText.slice(0, 4000);
    }

    return {
      url,
      error: null,
      title,
      metaDescription,
      headings,
      textSnippet: bodyText
    };
  } catch (err) {
    // Burada throw etmek yerine kontrollü error objesi dönüyoruz
    console.warn('[fetchWebsiteSnapshot] fetch failed for', url, err.message);

    return {
      url,
      error: err.message,
      title: null,
      metaDescription: null,
      headings: [],
      textSnippet: ''
    };
  }
}

module.exports = {
  fetchWebsiteSnapshot
};