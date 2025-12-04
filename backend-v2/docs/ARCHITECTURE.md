Ooo işte bu 😎 Artık gerçekten “kafası net” bir backend-v2 evrenimiz var.
	•	Devlog formatını ve tetikleyiciyi kaydettim:
Ne zaman “bugünlük yeter / ara verelim / sonra devam” dersen
→ o gün için docs/devlogs/ altına uygun formatta devlog metnini mutlaka vereceğim.

Şimdi istediğin gibi değişmeyecek ana mimari blueprint’ini tek bir dosyada topluyoruz.
Bunu direkt backend-v2/docs/ARCHITECTURE.md olarak kaydedebilirsin.

⸻

backend-v2/docs/ARCHITECTURE.md

Aşağıdakini komple kopyalayıp ARCHITECTURE.md olarak kaydet:

# CNG AI Agent — Backend V2 Architecture Blueprint

Bu döküman, CNG AI Agent backend-v2 için **değişmeyecek ana mimari blueprint**’tir.  
Tüm geliştirme, modül ekleme ve refactor kararları bu yapı üzerine inşa edilmelidir.

---

## 1. Amaç ve Yüksek Seviye Akış

Backend-v2, CNG Medya için **her sektörden potansiyel müşteriyi bulup, analiz eden, fikir üreten ve satış sürecini destekleyen** bir AI destekli ajans motorudur.

Uçtan uca akış:

1. **Discovery (Keşif)**  
   Google Maps / arama kaynakları üzerinden potansiyel firmaların bulunması.
2. **Intel (Analiz)**  
   Website, arama görünürlüğü, itibar ve sosyal medyanın analiz edilmesi.
3. **Brain (Beyin / AI)**  
   Toplanan verilerden SWOT, fırsatlar, yapılacaklar, teklifler, SEO önerileri ve içerik fikirleri üretilmesi.
4. **Outreach (İletişim)**  
   Cold email, WhatsApp, DM mesaj taslakları, arama script’leri üretilmesi.
5. **CRM (Takip)**  
   Lead’lerin statü, notlar, teklifler ve süreç adımlarıyla birlikte yönetilmesi.
6. **Opsiyonel Modüller**  
   - Auth → Müşteri / kullanıcı yönetimi
   - WhatsApp → Otomatik diyalog ve hafıza
   - Admin → CNG internal yönetim ekranları

---

## 2. Klasör Yapısı (Değişmeyecek İskelet)

```text
backend-v2/
  package.json
  .env
  README.md

  docs/
    ARCHITECTURE.md      # Bu dosya (ana mimari blueprint)
    MODULES.md           # Modül bazlı açıklamalar
    API.md               # Endpoint referansı
    devlogs/             # Günlük teknik loglar (her gün için ayrı dosya)

  src/
    app.js               # Express app tanımı
    server.js            # Sunucu başlatma

    core/                # Çekirdek altyapı (uygulama omurgası)
      config.js          # env, port, db path, feature flags
      db.js              # better-sqlite3 instance (tek DB bağlantısı)
      logger.js          # logging helper
      http.js            # response / error helper fonksiyonları
      middleware/
        requestLogger.js
        errorHandler.js
        notFoundHandler.js
        authOptional.js
        authRequired.js

    shared/              # Modüller arasında paylaşılan kodlar
      utils/
        validation.js
        dates.js
        strings.js
      ai/
        llmClient.js     # LLM/OpenAI client
        promptLoader.js  # prompts klasöründen okuma
      types/
        LeadDto.js
        IntelDto.js
        OfferDto.js
        UserDto.js

    prompts/             # Tüm prompt dosyaları (yalnızca metin, logic yok)
      universal/         # Genel ajans zekâsı, ton, persona
      lead/              # Lead analizi, discovery Q&A
      seo/               # SEO audit & öneri prompt’ları
      offers/            # Teklif/packaging prompt’ları
      outreach/          # Cold email, WhatsApp, script prompt’ları
      social/            # İçerik fikirleri, post/reels metin prompt’ları

    modules/             # İş mantığının tamamı modüller halinde
      discovery/         # 1. ADIM: potansiyel müşteri arama & bulma
        routes.js        # /api/discovery/...
        controller.js
        service.js
        repo.js
        index.js
      intel/             # 2. ADIM: analiz (website, search, social)
        routes.js        # /api/intel/...
        controller.js
        service.js
        repo.js
        websiteScanner.js
        searchScanner.js
        socialScanner.js
        index.js
      brain/             # 3. ADIM: AI beyni (SWOT, Offer, SEO, fikir)
        routes.js        # /api/brain/...
        controller.js
        service.js
        swotEngine.js
        offerEngine.js
        seoEngine.js
        contentIdeaEngine.js
        index.js
      outreach/          # 4. ADIM: iletişim & mesaj senaryoları
        routes.js        # /api/outreach/...
        controller.js
        service.js
        templates.js
        index.js
      crm/               # 5. ADIM: lead & pipeline yönetimi
        routes.js        # /api/crm/...
        controller.js
        service.js
        repo.js
        index.js
      auth/              # Kullanıcı/müşteri kimlik doğrulama (ileride)
        routes.js        # /api/auth/...
        controller.js
        service.js
        repo.js
        index.js
      whatsapp/          # WhatsApp entegrasyonu & hafıza (ileride)
        routes.js        # /api/whatsapp/...
        controller.js
        service.js
        repo.js
        index.js
      admin/             # CNG internal admin endpoint’leri (opsiyonel)
        routes.js        # /api/admin/...
        controller.js
        service.js
        index.js

    jobs/                # Background işler / cron benzeri akışlar
      jobsRunner.js      # Tüm işleri schedule eden merkezi dosya
      discoveryRefreshJob.js
      intelRefreshJob.js
      reputationRefreshJob.js
      outreachReminderJob.js

    tests/               # Testler
      http/              # REST/HTTP senaryoları (REST Client, Thunder, vs.)
        discovery.http
        intel.http
        brain.http
        outreach.http
        crm.http
      unit/              # Unit test dosyaları
        discovery.service.test.js
        intel.websiteScanner.test.js
        brain.swotEngine.test.js


⸻

3. Modül Tasarım Prensibi

Her modül aşağıdaki minimal pattern’i takip eder:

src/modules/<module>/
  routes.js      # Express Router: sadece URL → controller bağlar
  controller.js  # HTTP request/response, validasyon ve hata yönetimi
  service.js     # İş mantığı, modül içi senaryolar
  repo.js        # DB erişimi (SELECT/INSERT/UPDATE/DELETE)
  index.js       # Dışarıya routes + belirli servis fonksiyonlarını export eder

Ek dosyalar:
	•	*Engine.js → Karar, skor, model, analiz logic’leri (ör: swotEngine.js)
	•	*Scanner.js → Saha tarayıcıları (ör: websiteScanner.js, searchScanner.js)
	•	templates.js → Sabit şablon cümleler, metin blokları

Kurallar:
	1.	DB’ye sadece repo.js dokunur.
	2.	AI/LLM çağrıları sadece shared/ai/llmClient.js üzerinden yapılır.
	3.	Prompt metni prompts/ içinde durur; JS dosyaları prompt’u sadece yükler/kullanır.
	4.	Yeni bir iş alanı geldiğinde:
	•	Örnek: billing, reports, analytics
	•	→ Yeni bir modül olarak src/modules/<yeni-modül>/ oluşturulur
	•	Mevcut modüller bu iskeleti bozmaz.

⸻

4. Core Katmanı

Amaç: Express app, db bağlantısı, logging ve ortak middleware’leri modüllerden ayırmak.
	•	core/config.js
	•	.env yükler
	•	port, dbPath, NODE_ENV, feature flags gibi ayarları tek yerden yönetir.
	•	core/db.js
	•	better-sqlite3 ile tek DB instance oluşturur.
	•	Tüm modüller shared yerine buradan db import eder.
	•	core/logger.js
	•	İleride file logging, third-party log sistemleri (Sentry, Logtail vs.) bağlanabilir.
	•	Şimdilik console tabanlı, ama tek noktadan geçer.
	•	core/http.js
	•	ok(), fail(), validationError(), notFound() gibi helper’lar barındırır.
	•	core/middleware/*
	•	requestLogger → her request’i loglar
	•	errorHandler → tüm hataları JSON formatında döner
	•	notFoundHandler → bilinmeyen endpoint’leri yakalar
	•	authOptional → varsa user bilgisini inject eder, zorunlu kılmaz
	•	authRequired → kimlik doğrulaması olmayan istekleri reddeder

⸻

5. Devlogs Klasörü ve Standart Format

Her günkü geliştirme için docs/devlogs/ altında yeni bir dosya açılır:
	•	Dosya adı formatı: YYYY-MM-DD-<kısa-etiket>.md
Örnek: 2025-12-02-init.md, 2025-12-03-discovery-intel.md

Standart içerik formatı:

# Tarih — Başlık

## Değişiklik Özeti
- Yapılan değişikliklerin kısa maddeler halinde özeti.

## Teknik Detaylar
- Dokunulan modüller, fonksiyonlar, endpoint’ler, DB değişiklikleri.
- Gerekirse kod snippet’leri.

## Neden Bu Karar Alındı?
- Gereksinim, problem ve seçilen çözümün gerekçesi.

## Etkisi
- Mevcut akışlara etkisi, geriye dönük uyumluluk, performans vs.

## Yapılacaklar (Opsiyonel)
- Bir sonraki adımda ele alınacak maddeler.

Bu format, projenin teknik hafızasını tutar; mimari evrim geriye dönük izlenebilir.

⸻

6. Karar: Bu Blueprint’in “Donmuş” Kısımları

Bu dokümanda değişmeyecek kabul edilen alanlar:
	•	Klasör iskeleti:
	•	core/, shared/, prompts/, modules/, jobs/, tests/, docs/devlogs/
	•	Temel modül seti:
	•	discovery, intel, brain, outreach, crm, auth, whatsapp, admin
	•	Modül yapısı:
	•	routes.js, controller.js, service.js, repo.js, index.js pattern’i
	•	Devlog formatı ve konumu:
	•	docs/devlogs/ klasörü
	•	Standart başlıklar: Özet, Teknik Detaylar, Neden, Etki, Yapılacaklar

Bu blueprint, backend-v2 için referans mimari sözleşmesi olarak kabul edilir.
Gelecekte yapılacak eklemeler, bu yapıyı bozmadan, yalnızca yeni modüller veya mevcut modüllerin içindeki dosyalar üzerinden yapılmalıdır.

---

Bundan sonrası çok net:

- Bu dosyayı `backend-v2/docs/ARCHITECTURE.md` olarak koyuyorsun.
- İleriki adımlarda backend-v2’yi doldururken **hiç klasör mimarisi tartışmıyoruz**; direkt bu şemaya kod yazıyoruz.
- Sen “bugünlük bu kadar” dediğin her gün için ben `docs/devlogs/` formatında günlük çıkarıyorum.