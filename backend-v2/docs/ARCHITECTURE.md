# CNG AI Agent — Backend V2 Architecture Blueprint (2025-12-09)

Bu döküman, CNG AI Agent **backend-v2** için güncel ve referans mimari rehberidir.  
Tüm yeni geliştirmeler, refactor kararları ve modül eklemeleri bu yapı üzerinden düşünülmelidir.

---

## 1. Amaç ve End-to-End Akış

Backend-v2, CNG Medya için **her sektörden potansiyel müşteri (lead) bulup, bunları analiz eden, zekâ üreten ve satış / iletişim süreçlerini destekleyen** çok modüllü bir ajans motorudur.

Yüksek seviye lifecycle:

1. **Discovery / Godmode**
   - Dış kaynaklardan (özellikle Google Places) potansiyel firmaları avlar.
   - GODMODE discovery engine ile şehir / kategori bazlı derin taramalar yapılır.
2. **Research**
   - Rakipler, reklamlar, sosyal medya ve web görünürlüğü hakkında detaylı araştırma yapar.
3. **Intel**
   - Lead’in web sitesi, SEO durumu, teknik altyapısı ve dijital ayak izini analiz eder.
4. **Brain**
   - Toplanan ham veriyi AI üzerinden işleyip özetler, yorumlar, aksiyon listeleri çıkarır.
5. **Outreach & Outreach Scheduler & Email & WhatsApp**
   - Uygun kanallar üzerinden ilk temas mesajlarını, senaryoları ve zamanlamayı üretir.
6. **CRM & Lead Dashboard**
   - Lead’leri, durumlarını, notlarını, intel özetlerini ve pipeline sürecini yönetir.
7. **Admin & Auth**
   - Kullanıcı / müşteri yönetimi, güvenlik ve internal admin operasyonlarını sağlar.

---

## 2. Top-Level Klasör Yapısı

```text
backend-v2/
  package.json
  package-lock.json
  migrate_old_leads.js
  migrate_add_ai_columns.js

  docs/
    ARCHITECTURE.md
    API.md
    MODULES.md
    devlogs/
      YYYY-MM-DD-*.md   # Günlük teknik log dosyaları

  src/
    app.js
    server.js
    core/
    data/
    jobs/
    modules/
    prompts/
    shared/
    tests/
```

### 2.1 `docs/`

- **ARCHITECTURE.md** → Bu dosya. Backend-v2 mimari sözleşmesi.
- **API.md** → Ana endpoint referansları.
- **MODULES.md** → Modül bazlı açıklamalar ve durum.
- **devlogs/** → Günlük teknik günlükler.  
  - Örnek: `2025-12-07-08-09-init.md`, `BACKEND_V2_SNAPSHOT-2025-12-06.md`
  - Her dosyada: değişiklik özeti, teknik detaylar, karar gerekçeleri, etkiler.

### 2.2 Root migration script’leri

- **migrate_old_leads.js**
  - Eski lead datasını backend-v1’den backend-v2 şemasına taşımak için kullanılır.
- **migrate_add_ai_columns.js**
  - AI ile ilgili yeni kolonları (örneğin skorlar, özetler) eklemek için tek seferlik script.

---

## 3. Core Katmanı (`src/core`)

Backend’in omurgasıdır; tüm modüllerin üzerinde durduğu, **tekil DB bağlantısı, config ve HTTP helper** katmanıdır.

```text
src/core/
  config.js
  db.js
  http.js
  logger.js
  docs/CORE_DB.md
  middleware/
    authOptional.js
    authRequired.js
    errorHandler.js
    notFoundHandler.js
    requestLogger.js
  migrations/
    003_create_lead_search_intel.js
    004_create_lead_intel_reports.js
    006_create_users.js
```

### 3.1 `config.js`

- `.env` dosyasını okuyup tüm sisteme yayar.
- Önemli ayarlar:
  - Port, ENV (`NODE_ENV`)
  - DB path’leri (app.sqlite, crm.sqlite)
  - Feature flags (ileride Godmode, Brain, vb. için).

### 3.2 `db.js`

- `better-sqlite3` ile **tek bir app DB instance** yönetir.
- Tüm modüller doğrudan sqlite açmak yerine buradan DB nesnesini alır.
- `CORE_DB.md` içinde DB kullanım prensipleri ve tabloların genel mantığı anlatılır.

### 3.3 `http.js`

- `ok(res, data)`, `fail(res, errorCode, message)`, validation error helper’ları gibi ortak HTTP yanıt şablonlarını içerir.
- Tüm controller’lar bu helper’lar üzerinden standart JSON response döner.

### 3.4 Middleware’ler

- **requestLogger.js** → Her isteği (metod, path, süre, vs.) log’lar.
- **errorHandler.js** → Tüm hataları yakalar ve `fail()` formatında dışarı verir.
- **notFoundHandler.js** → Tanımsız endpoint’leri 404 olarak yakalar.
- **authOptional.js** → Varsa user’ı request’e enjekte eder, zorunlu değildir.
- **authRequired.js** → Auth zorunlu endpoint’lerde kullanılır; yetkisiz istekleri reddeder.

### 3.5 Core migrations

- **003_create_lead_search_intel.js**
- **004_create_lead_intel_reports.js**
- **006_create_users.js**

Bu migration’lar `app.sqlite` içinde lead intel ve kullanıcı yönetimi için gerekli tabloları oluşturur.

---

## 4. Data Katmanı (`src/data`)

```text
src/data/
  app.sqlite   # Ana uygulama DB’si
  crm.sqlite   # CRM’e özel DB (lead & müşteri süreçleri)
```

- **app.sqlite**
  - Discovery, intel, research, godmode, vb. modüllerin teknik verilerini ve raporlarını içerir.
- **crm.sqlite**
  - Lead durumları, notlar, teklif aşamaları gibi CRM odaklı verileri (özellikle CRM / Lead Dashboard modülleri için) tutar.

---

## 5. Jobs & Maintenance (`src/jobs`)

```text
src/jobs/
  migrateOldLeads.js
  migrate_add_cir_support.js
```

- Tek seferlik veya periyodik çalışacak scriptler:
  - Eski veriyi yeni şemaya taşımak.
  - CIR (CNG Intelligence Report) gibi yeni özellikler için kolon / veri hazırlığı yapmak.
- İleride buraya gerçek cron benzeri job’lar (periodik discovery refresh vb.) eklenecek.

---

## 6. Shared & Prompts

### 6.1 `src/shared/`

```text
src/shared/
  ai/
    llmClient.js
    promptLoader.js
    LLM.md
    CHANGELOG.md
  seo/
    onpageAnalyzer.js
  types/
  utils/
  web/
    fetchWebsite.js
```

- **shared/ai/**
  - `llmClient.js` → OpenAI / LLM entegrasyonu için tek geçit noktası.
  - `promptLoader.js` → `src/prompts/` altındaki markdown prompt dosyalarını yükler.
  - `LLM.md` → LLM kullanım kuralları, rate-limiting stratejileri, vs.
- **shared/seo/onpageAnalyzer.js**
  - On-page SEO analizi yapan merkezi yardımcı fonksiyon.
- **shared/web/fetchWebsite.js**
  - HTTP üzerinden website HTML’ini çeken helper.
- **shared/utils**, **shared/types**
  - Ortak tipler ve yardımcı fonksiyonlar (ilerleyen iterasyonlarda doldurulacak).

### 6.2 `src/prompts/`

```text
src/prompts/
  intel/
    lead_deep_website_analysis.md
    lead_intel_analysis.md
  lead/
    ai_rank_lead.md
  offers/
  outreach/
    first_contact_message.md
    outreach_sequence_v2.md
  research/
    research_master_prompt.md
  seo/
  social/
  universal/
```

- Tüm prompt metinleri **markdown dosyaları** olarak burada tutulur.
- Kod tarafında sadece `promptLoader` üzerinden bu dosyalar okunur; prompt logic JS içinde yazılmaz.
- Ana gruplar:
  - **intel/** → Lead bazlı teknik/dijital analiz prompt’ları.
  - **lead/** → Lead ranking / AI skorlaması.
  - **outreach/** → İlk temas mesajları, seri mesaj akışları.
  - **research/** → Araştırma ve rakip analizi için master prompt.
  - **universal/**, **seo/**, **social/** → Genel ajans zekâsı, SEO ve sosyal medya içerikleri (ileride doldurulacak).

---

## 7. Modül Katmanı (`src/modules`)

Tüm iş mantığı, modüller altında izole edilir. Her modül kendi docs dosyasına sahiptir.

### 7.1 Template Modülü (`_template/`)

```text
src/modules/_template/
  api/
    controller.js
    routes.js
  docs/
    TEMPLATE.md
    CHANGELOG.md
  repo.js
  service.js
```

- Yeni modül oluştururken kopyalanacak referans iskelet.
- Minimal pattern:
  - `routes.js` → Express router & URL tanımı.
  - `controller.js` → HTTP katmanı (validation + response).
  - `service.js` → İş mantığı.
  - `repo.js` → DB erişimi.

### 7.2 Auth Modülü (`auth/`)

```text
src/modules/auth/
  api/
    controller.js
    routes.js
  docs/
    AUTH.md
    CHANGELOG.md
  repo.js
  service/authService.js
  utils/hash.js
  utils/jwt.js
```

- Kullanıcı ve oturum yönetimi.
- Parola hash’leme, JWT üretimi ve doğrulaması.
- AUTH.md içinde login / register akışları ve token yapısı tanımlıdır.

### 7.3 Admin Modülü (`admin/`)

```text
src/modules/admin/
  api/
    controller.js
    routes.js
  docs/
    ADMIN.md
    CHANGELOG.md
  repo/adminRepo.js
  service/adminService.js
```

- CNG internal admin endpoint’leri (dashboard verileri, istatistikler, yönetim API’leri).
- Bu modül, diğer modüllerden veri okuyup admin ekranlarına servis eder.

### 7.4 Discovery Modülü (`discovery/`)

```text
src/modules/discovery/
  routes.js
  controller.js
  service.js
  repo.js
  aiRanker.js
  placesClient.js
  docs/DISCOVERY.md
```

- Backend-v2’nin “klasik” discovery motoru.
- Görevleri:
  - Google Places üzerinden lead bulma (placesClient).
  - AI tabanlı lead ranking (`aiRanker`) ile puanlama.
  - Bulunan lead’leri DB’ye kaydetme ve raporlama.
- GODMODE’dan farklı olarak:
  - Daha basit, tek akışlı bir keşif modülü
  - Godmode ise bunun “enterprise / multi-job / multi-provider” versiyonudur.

### 7.5 Godmode Modülü (`godmode/`)

```text
src/modules/godmode/
  api/
    controller.js
    routes.js
  docs/
    GODMODE.md
    GODMODE_ROADMAP.md
  pipeline/
    discoveryPipeline.js
  providers/
    googlePlacesProvider.js
    index.js
    providersRunner.js
  workers/
    dataFeederWorker.js
    economicAnalyzerWorker.js
    entityResolverWorker.js
  service.js
  repo.js
  validator.js
```

- **GODMODE Discovery Engine** bu modülün içindedir.
- Özellikler:
  - Job bazlı discovery sistemi:
    - `/api/godmode/jobs/discovery-scan` → yeni job yaratır.
    - `/api/godmode/jobs/:id/run` → job’ı çalıştırır (mock veya live).
  - Provider abstraction:
    - Şu an aktif: `google_places` (Google Places API).
    - Faz 2 ve sonrası: LinkedIn, Instagram, vb. gibi ek provider’lara hazır altyapı.
  - Pipeline:
    - `discoveryPipeline.js` job → provider (lar) → lead normalization → DB upsert akışını yönetir.
  - Workers:
    - `dataFeederWorker` → bulunan lead’leri `potential_leads` ve ilgili tablolara besler.
    - `entityResolverWorker`, `economicAnalyzerWorker` → ileriki fazlar için ayrılmıştır.
  - Roadmap:
    - **GODMODE_ROADMAP.md** ile faz bazlı gelişim (Faz 1: core engine, Faz 2: omni-data feeder, vs.) takip edilir.

### 7.6 Research Modülü (`research/`)

```text
src/modules/research/
  api/routes.js
  controller/controller.js
  docs/RESEARCH.md
  repo/researchRepo.js
  repo.js
  service/
    researchService.js
    competitorService.js
    competitorsService.js
    adsService.js
    socialsService.js
    benchmarkService.js
  ai/research_master_prompt.md
```

- Amaç: Bir lead veya sektör için **derin pazar / rakip / reklam / sosyal medya araştırması** yapmak.
- Çok parçalı service yapısı:
  - `researchService` → ana orkestrasyon.
  - `competitor(s)Service`, `adsService`, `socialsService`, `benchmarkService` → alt alanlara dair spesifik analizler.
- `research_master_prompt.md` ile AI araştırma zekâsı beslenir.

### 7.7 Intel Modülü (`intel/`)

```text
src/modules/intel/
  routes.js
  controller.js
  service.js
  repo.js
  seoOnpageService.js
  docs/INTEL.md
```

- Bir lead’in **website, SEO, teknik altyapı ve dijital izlerini** analiz eder.
- `seoOnpageService` + `shared/seo/onpageAnalyzer.js` birleşimiyle on-page SEO raporları üretir.
- Sonuçlar, `lead_search_intel` ve `lead_intel_reports` gibi tablolara yazılır.

### 7.8 Brain Modülü (`brain/`)

```text
src/modules/brain/
  api/
    controller.js
    routes.js
  service/brainService.js
  docs/BRAIN.md
```

- Toplanan discovery + intel + research çıktılarından **SWOT, fırsat listeleri, teklif fikirleri, yapılacaklar** gibi akıllı özetler üretir.
- LLM çağrılarını `shared/ai/llmClient` üzerinden yapar ve prompts klasöründen gelen şablonlarla çalışır.

### 7.9 Outreach & Outreach Scheduler & Email

```text
src/modules/outreach/
  routes.js
  controller.js
  service.js
  repo.js
  docs/OUTREACH.md
  first_contact_message.md

src/modules/outreachScheduler/
  routes.js
  controller.js
  service.js
  repo.js
  docs/OUTREACH_SCHEDULER.md

src/modules/email/
  routes.js
  controller.js
  service.js
  repo.js
  docs/EMAIL.md
```

- **outreach**:
  - Lead’lere gönderilecek ilk temas mesajları, DM script’leri, senaryolar.
  - `first_contact_message.md` ile içerik şablonları.
- **outreachScheduler**:
  - Bu mesajların **zamanlamasını ve tekrarlarını** planlayan modül.
  - İleride jobs ile entegre edilerek otomatik tetikleyici haline gelecek.
- **email**:
  - Email bazlı outbound iletişim için tasarlanmış modül.
  - Template, loglama ve gönderim orkestrasyonu gibi görevleri üstlenir.

### 7.10 CRM & Lead Dashboard

```text
src/modules/crm/
  api/
    controller.js
    routes.js
  service/crmBrainService.js
  prompts/crm_brain_summary.md
  docs/CRM.md

src/modules/leadDashboard/
  routes.js
  controller.js
  service.js
  repo.js
  docs/LEAD_DASHBOARD.md
```

- **crm**:
  - Lead’lerin pipeline içindeki durumlarını, notlarını ve “CRM beyni”nin özetlerini yönetir.
  - `crmBrainService` → lead datası + AI ile CRM odaklı özetler çıkarır.
- **leadDashboard**:
  - Lead listesini, skorları, son intel durumunu ve aksiyonları görselleştiren backend katmanı.
  - Genellikle frontend dashboard ekranlarının data kaynağıdır.

### 7.11 Intel/Research/Brain ile Entegrasyon

- Discovery / Godmode → lead & potential_leads
- Research + Intel → lead_search_intel, lead_intel_reports
- Brain → AI özetleri ve skorlar
- CRM / Lead Dashboard → bunları tek ekranlık bir pipeline deneyimine dönüştürür.

### 7.12 WhatsApp Modülü (`whatsapp/`)

```text
src/modules/whatsapp/
  routes.js
  controller.js
  service.js
  repo.js
  docs/WHATSAPP.md
```

- WhatsApp entegrasyonu için hazırlanmış modül.
- Amaç:
  - Lead’ler ile WhatsApp üzerinden mesajlaşma.
  - Geçmiş konuşmaların AI tarafından analiz edilmesi (ileriki fazlarda).

---

## 8. Testler (`src/tests/`)

```text
src/tests/
  http/
  unit/
```

- **http/**:
  - API endpoint’lerini manuel veya yarı otomatik test etmek için HTTP senaryoları (REST Client, Thunder, vs).
- **unit/**:
  - Fonksiyonel unit testler için ayrılmış alan.
- Test stratejisi:
  - Modül tabanlı ilerlemek: discovery, intel, brain vb. için ayrı test dosyaları oluşturmak.

---

## 9. Devlog Sistemi

`docs/devlogs/` klasörü, backend-v2’nin **zaman içindeki evrimini** kayıt altında tutar.

- Dosya adı standardı:
  - `YYYY-MM-DD-*.md` (gerekirse iki-üç günü birleştiren aralıklar da olabilir, örn: `2025-12-07-08-09-init.md`).
- İçerik standardı:
  - Değişiklik özeti
  - Teknik detaylar
  - “Neden bu karar alındı?”
  - Etki analizi
  - Bir sonraki adımlar (opsiyonel)

Bu sistem sayesinde:
- Eski kararların neden alındığına hızlıca geri dönülebilir.
- Godmode gibi modüllerin faz faz ilerleyişi izlenebilir.
- Refactor veya debug süreçlerinde zaman çizgisi net kalır.

---

## 10. Mimari Sözleşme (Değişmeyecek Kısımlar)

Bu blueprint ile **sabit kabul edilen** ana prensipler:

1. **Core / Shared / Modules ayrımı**
   - `core/` → altyapı ve iskelet
   - `shared/` → tüm modüllerin ortak kullandığı yardımcılar
   - `modules/` → tüm iş mantığı
2. **LLM & Prompt prensibi**
   - Tüm LLM çağrıları `shared/ai/llmClient.js` üzerinden gider.
   - Tüm prompt metni `src/prompts/` veya ilgili modül altındaki `.md` dosyalarında tutulur.
3. **Modül pattern’i**
   - İdeal pattern: `routes.js`, `controller.js`, `service.js`, `repo.js`, `docs/<MODUL>.md`.
   - Bazı modüller (research, godmode, admin) bu pattern’i genişleterek alt dosyalara böler ama ana fikir değişmez.
4. **DB erişimi**
   - DB bağlantısı `core/db.js` üzerinden yönetilir.
   - Modüller DB’yi doğrudan açmak yerine repo katmanı üzerinden kullanır.
5. **Devlog zorunluluğu**
   - Büyük değişiklikler ve mimari kararlar mutlaka `docs/devlogs/` altına işlenir.

Bu dosya, backend-v2 için **güncel mimari harita** olarak kabul edilmelidir.  
Yeni modüller eklerken veya büyük refactor’lar yaparken, önce buradaki yapıya uyum kontrol edilir; gerekirse bu blueprint kontrollü şekilde güncellenir.


# Güncel Mimari


backend-v2
├── docs
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── devlogs
│   │   ├── 2025-12-02-init.md
│   │   ├── 2025-12-03-init.md
│   │   ├── 2025-12-04-05-init.md
│   │   ├── 2025-12-05-06-07-08-init.md
│   │   ├── 2025-12-07-08-09-init.md
│   │   └── BACKEND_V2_SNAPSHOT-2025-12-06.md
│   └── MODULES.md
├── migrate_add_ai_columns.js
├── migrate_old_leads.js
├── package-lock.json
├── package.json
└── src
    ├── app.js
    ├── core
    │   ├── config.js
    │   ├── db.js
    │   ├── docs
    │   │   └── CORE_DB.md
    │   ├── http.js
    │   ├── logger.js
    │   ├── middleware
    │   │   ├── authOptional.js
    │   │   ├── authRequired.js
    │   │   ├── errorHandler.js
    │   │   ├── notFoundHandler.js
    │   │   └── requestLogger.js
    │   └── migrations
    │       ├── 003_create_lead_search_intel.js
    │       ├── 004_create_lead_intel_reports.js
    │       └── 006_create_users.js
    ├── data
    │   ├── app.sqlite
    │   └── crm.sqlite
    ├── jobs
    │   ├── migrate_add_cir_support.js
    │   └── migrateOldLeads.js
    ├── modules
    │   ├── _template
    │   │   ├── api
    │   │   │   ├── controller.js
    │   │   │   └── routes.js
    │   │   ├── docs
    │   │   │   ├── CHANGELOG.md
    │   │   │   └── TEMPLATE.md
    │   │   ├── repo.js
    │   │   └── service.js
    │   ├── admin
    │   │   ├── api
    │   │   │   ├── controller.js
    │   │   │   └── routes.js
    │   │   ├── docs
    │   │   │   ├── ADMIN.md
    │   │   │   └── CHANGELOG.md
    │   │   ├── repo
    │   │   │   └── adminRepo.js
    │   │   └── service
    │   │       └── adminService.js
    │   ├── auth
    │   │   ├── api
    │   │   │   ├── controller.js
    │   │   │   └── routes.js
    │   │   ├── docs
    │   │   │   ├── AUTH.md
    │   │   │   └── CHANGELOG.md
    │   │   ├── repo.js
    │   │   ├── service
    │   │   │   └── authService.js
    │   │   └── utils
    │   │       ├── hash.js
    │   │       └── jwt.js
    │   ├── brain
    │   │   ├── api
    │   │   │   ├── controller.js
    │   │   │   └── routes.js
    │   │   ├── docs
    │   │   │   ├── BRAIN.md
    │   │   │   └── CHANGELOG.md
    │   │   └── service
    │   │       └── brainService.js
    │   ├── crm
    │   │   ├── api
    │   │   │   ├── controller.js
    │   │   │   └── routes.js
    │   │   ├── docs
    │   │   │   ├── CHANGELOG.md
    │   │   │   └── CRM.md
    │   │   ├── index.js
    │   │   ├── prompts
    │   │   │   └── crm_brain_summary.md
    │   │   └── service
    │   │       └── crmBrainService.js
    │   ├── discovery
    │   │   ├── aiRanker.js
    │   │   ├── controller.js
    │   │   ├── docs
    │   │   │   ├── CHANGELOG.md
    │   │   │   └── DISCOVERY.md
    │   │   ├── placesClient.js
    │   │   ├── repo.js
    │   │   ├── routes.js
    │   │   └── service.js
    │   ├── email
    │   │   ├── controller.js
    │   │   ├── docs
    │   │   │   ├── CHANGELOG.md
    │   │   │   └── EMAIL.md
    │   │   ├── repo.js
    │   │   ├── routes.js
    │   │   └── service.js
    │   ├── godmode
    │   │   ├── api
    │   │   │   ├── controller.js
    │   │   │   └── routes.js
    │   │   ├── docs
    │   │   │   ├── GODMODE_ROADMAP.md
    │   │   │   └── GODMODE.md
    │   │   ├── pipeline
    │   │   │   └── discoveryPipeline.js
    │   │   ├── providers
    │   │   │   ├── googlePlacesProvider.js
    │   │   │   ├── index.js
    │   │   │   └── providersRunner.js
    │   │   ├── repo.js
    │   │   ├── service.js
    │   │   ├── validator.js
    │   │   └── workers
    │   │       ├── dataFeederWorker.js
    │   │       ├── economicAnalyzerWorker.js
    │   │       └── entityResolverWorker.js
    │   ├── intel
    │   │   ├── controller.js
    │   │   ├── docs
    │   │   │   ├── CHANGELOG.md
    │   │   │   └── INTEL.md
    │   │   ├── repo.js
    │   │   ├── routes.js
    │   │   ├── seoOnpageService.js
    │   │   └── service.js
    │   ├── leadDashboard
    │   │   ├── controller.js
    │   │   ├── docs
    │   │   │   ├── CHANGELOG.md
    │   │   │   └── LEAD_DASHBOARD.md
    │   │   ├── repo.js
    │   │   ├── routes.js
    │   │   └── service.js
    │   ├── outreach
    │   │   ├── controller.js
    │   │   ├── docs
    │   │   │   ├── CHANGELOG.md
    │   │   │   └── OUTREACH.md
    │   │   ├── first_contact_message.md
    │   │   ├── repo.js
    │   │   ├── routes.js
    │   │   └── service.js
    │   ├── outreachScheduler
    │   │   ├── controller.js
    │   │   ├── docs
    │   │   │   ├── CHANGELOG.md
    │   │   │   └── OUTREACH_SCHEDULER.md
    │   │   ├── repo.js
    │   │   ├── routes.js
    │   │   └── service.js
    │   ├── research
    │   │   ├── ai
    │   │   │   └── research_master_prompt.md
    │   │   ├── api
    │   │   │   └── routes.js
    │   │   ├── controller
    │   │   │   └── controller.js
    │   │   ├── docs
    │   │   │   ├── CHANGELOG.md
    │   │   │   └── RESEARCH.md
    │   │   ├── repo
    │   │   │   └── researchRepo.js
    │   │   ├── repo.js
    │   │   └── service
    │   │       ├── adsService.js
    │   │       ├── benchmarkService.js
    │   │       ├── competitorService.js
    │   │       ├── competitorsService.js
    │   │       ├── researchService.js
    │   │       ├── socialsService.js
    │   │       └── websearchService.js
    │   ├── whatsapp
    │   │   ├── controller.js
    │   │   ├── docs
    │   │   │   ├── CHANGELOG.md
    │   │   │   └── WHATSAPP.md
    │   │   ├── repo.js
    │   │   ├── routes.js
    │   │   └── service.js
    │   └── xyz
    ├── prompts
    │   ├── intel
    │   │   ├── controller.js
    │   │   ├── lead_deep_website_analysis.md
    │   │   ├── lead_intel_analysis.md
    │   │   ├── routes.js
    │   │   └── service.js
    │   ├── lead
    │   │   └── ai_rank_lead.md
    │   ├── offers
    │   ├── outreach
    │   │   ├── first_contact_message.md
    │   │   └── outreach_sequence_v2.md
    │   ├── research
    │   │   └── research_master_prompt.md
    │   ├── seo
    │   ├── social
    │   └── universal
    ├── server.js
    ├── shared
    │   ├── ai
    │   │   ├── CHANGELOG.md
    │   │   ├── LLM.md
    │   │   ├── llmClient.js
    │   │   └── promptLoader.js
    │   ├── seo
    │   │   └── onpageAnalyzer.js
    │   ├── types
    │   ├── utils
    │   └── web
    │       └── fetchWebsite.js
    └── tests
        ├── http
        └── unit

79 directories, 153 files