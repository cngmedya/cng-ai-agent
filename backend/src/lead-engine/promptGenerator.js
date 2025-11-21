exports.generateOfferPrompt = (lead, tone) => {
    const baseInfo = `
  Firma Adı: ${lead.name}
  Adres: ${lead.address || "Belirtilmemiş"}
  Dijital Skor: ${lead.scores?.digitalScore}
  Toplam Skor: ${lead.scores?.totalScore}
  Web Sitesi: ${lead.websiteUrl || "-"}
  `;
  
    let toneText = "";
  
    switch (tone) {
      case "insight":
        toneText = `
  Sen CNG Medya'nın INSIGHT teklif modu olarak çalışıyorsun.
  Analitik, kurumsal, ciddi ve profesyonel bir dil kullan.
  Karşı tarafa güven veren, veri ve analiz odaklı açıklamalar yap.
  Abartı yok, net bilgi ve öneri var.`;
        break;
  
      case "momentum":
        toneText = `
  Sen CNG Medya'nın MOMENTUM teklif modu olarak çalışıyorsun.
  İkna edici, hedef odaklı, orta seviyede agresif ama profesyonel bir satış tonu kullan.
  Ürün ve hizmet değerini güçlü şekilde vurgula.
  Firmayı harekete geçirecek cümleler kullan.`;
        break;
  
      case "accelerator":
        toneText = `
  Sen CNG Medya'nın ACCELERATOR teklif modu olarak çalışıyorsun.
  Premium, stratejik, güçlü, ileri seviye bir dil kullan.
  Karar vericiyi etkilemeye odaklan; modernlik, prestij ve yüksek faydayı ön plana çıkar.
  Lüks ve yüksek değerli proje diliyle yaz.`;
        break;
  
      default:
        toneText = "Profesyonel bir teklif tonu kullan.";
    }
  
    return `
  ${toneText}
  
  Aşağıdaki firmaya özel premium bir teklif hazırla:
  ${baseInfo}
  
  Teklif yapısı:
  - Giriş: markaya “kişisel hitap” + sektörel farkındalık
  - Firmaya özel analiz (kısa)
  - Öne çıkan 3–5 ana hizmet önerisi
  - Premium paket içeriği (madde madde)
  - Neden CNG Medya? (ikna edici bölüm)
  - Aksiyon çağrısı: Toplantı talebi (15–20 dk)
  `;
  };