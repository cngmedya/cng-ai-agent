# Backend V2 — Modules Overview (Deep Dive)

Bu doküman, **backend-v2/src/modules** altında yer alan tüm modüllerin mimarisini, sorumluluklarını, ana veri akışlarını ve aralarındaki ilişkileri detaylı şekilde özetler.  
Hedef: Yeni gelen bir geliştirici bu dosyayı okuduğunda, sadece “hangi modül ne iş yapıyor?” değil, aynı zamanda **“hangi modül hangi veriyi nereden alıyor, nereye akıtıyor, hangi senaryolarda devreye giriyor?”** sorularının cevabını da görebilsin.

> Not:  
> - Çekirdek altyapı (core, shared, prompts vb.) için `docs/ARCHITECTURE.md` ve `src/core/docs/CORE_DB.md` dokümanları referans alınmalıdır.  
> - Bu dosya **modül seviyesi** referansıdır; tablo şemalarının tam detayı için DB dokümanlarına bakılmalıdır.

---

# Modüles Mimarisi

modules
├── _template
│   ├── api
│   │   ├── controller.js
│   │   └── routes.js
│   ├── docs
│   │   ├── CHANGELOG.md
│   │   └── TEMPLATE.md
│   ├── repo.js
│   └── service.js
├── admin
│   ├── api
│   │   ├── controller.js
│   │   └── routes.js
│   ├── docs
│   │   ├── ADMIN.md
│   │   └── CHANGELOG.md
│   ├── repo
│   │   └── adminRepo.js
│   └── service
│       └── adminService.js
├── auth
│   ├── api
│   │   ├── controller.js
│   │   └── routes.js
│   ├── docs
│   │   ├── AUTH.md
│   │   └── CHANGELOG.md
│   ├── repo.js
│   ├── service
│   │   └── authService.js
│   └── utils
│       ├── hash.js
│       └── jwt.js
├── brain
│   ├── api
│   │   ├── controller.js
│   │   └── routes.js
│   ├── docs
│   │   ├── BRAIN.md
│   │   └── CHANGELOG.md
│   └── service
│       └── brainService.js
├── crm
│   ├── api
│   │   ├── controller.js
│   │   └── routes.js
│   ├── docs
│   │   ├── CHANGELOG.md
│   │   └── CRM.md
│   ├── index.js
│   ├── prompts
│   │   └── crm_brain_summary.md
│   └── service
│       └── crmBrainService.js
├── discovery
│   ├── aiRanker.js
│   ├── controller.js
│   ├── docs
│   │   ├── CHANGELOG.md
│   │   └── DISCOVERY.md
│   ├── placesClient.js
│   ├── repo.js
│   ├── routes.js
│   └── service.js
├── email
│   ├── controller.js
│   ├── docs
│   │   ├── CHANGELOG.md
│   │   └── EMAIL.md
│   ├── repo.js
│   ├── routes.js
│   └── service.js
├── godmode
│   ├── api
│   │   ├── controller.js
│   │   └── routes.js
│   ├── docs
│   │   ├── GODMODE_ROADMAP.md
│   │   └── GODMODE.md
│   ├── pipeline
│   │   └── discoveryPipeline.js
│   ├── providers
│   │   ├── googlePlacesProvider.js
│   │   ├── index.js
│   │   └── providersRunner.js
│   ├── repo.js
│   ├── service.js
│   ├── validator.js
│   └── workers
│       ├── dataFeederWorker.js
│       ├── economicAnalyzerWorker.js
│       └── entityResolverWorker.js
├── intel
│   ├── controller.js
│   ├── docs
│   │   ├── CHANGELOG.md
│   │   └── INTEL.md
│   ├── repo.js
│   ├── routes.js
│   ├── seoOnpageService.js
│   └── service.js
├── leadDashboard
│   ├── controller.js
│   ├── docs
│   │   ├── CHANGELOG.md
│   │   └── LEAD_DASHBOARD.md
│   ├── repo.js
│   ├── routes.js
│   └── service.js
├── outreach
│   ├── controller.js
│   ├── docs
│   │   ├── CHANGELOG.md
│   │   └── OUTREACH.md
│   ├── first_contact_message.md
│   ├── repo.js
│   ├── routes.js
│   └── service.js
├── outreachScheduler
│   ├── controller.js
│   ├── docs
│   │   ├── CHANGELOG.md
│   │   └── OUTREACH_SCHEDULER.md
│   ├── repo.js
│   ├── routes.js
│   └── service.js
├── research
│   ├── ai
│   │   └── research_master_prompt.md
│   ├── api
│   │   └── routes.js
│   ├── controller
│   │   └── controller.js
│   ├── docs
│   │   ├── CHANGELOG.md
│   │   └── RESEARCH.md
│   ├── repo
│   │   └── researchRepo.js
│   ├── repo.js
│   └── service
│       ├── adsService.js
│       ├── benchmarkService.js
│       ├── competitorService.js
│       ├── competitorsService.js
│       ├── researchService.js
│       ├── socialsService.js
│       └── websearchService.js
├── whatsapp
│   ├── controller.js
│   ├── docs
│   │   ├── CHANGELOG.md
│   │   └── WHATSAPP.md
│   ├── repo.js
│   ├── routes.js
│   └── service.js
└── xyz

51 directories, 106 files

---

## Genel Modül Prensipleri

Tüm modüller mümkün olduğunca aynı pattern’i takip eder:

- **api/**
  - `controller.js` → HTTP handler’lar (request → service → response akışını koordine eder)
  - `routes.js` → Express router tanımları (`/api/<module>/*`)
- **docs/**
  - `<MODULE>.md` → Modülün ana tasarım dokümanı (domain tanımı, use-case’ler, endpointler, örnek akışlar)
  - `CHANGELOG.md` → Versiyon ve değişiklik geçmişi
- **repo(.js) / repo/**
  - Veri erişim katmanı (SQLite / DB abstraction)
  - `core/db.js` ve migration’larla tanımlanan tablolar üzerinde çalışır
- **service(.js) / service/**
  - Domain iş mantığı, kurallar, orkestrasyon
  - Gerekirse başka modüllerin repo/service katmanlarıyla konuşur
- Opsiyonel klasörler:
  - `prompts/` → LLM prompt şablonları (metin içerikler ve AI task’leri)
  - `ai/` → AI / LLM entegrasyonuna özel servisler ve promptlar
  - `utils/` → Küçük yardımcı fonksiyonlar (auth util’leri, string helpers vb.)
  - `workers/` → Background job worker’ları (cron, queue, async işler)
  - `pipeline/` → Çok adımlı pipeline orkestrasyonları (multi-step data flow)

**Genel Mimari Akış:**

1. **Discovery / GODMODE** yeni lead’ler bulur ve normalize ederek DB’ye yazar.  
2. **Intel / Research** bu lead’ler hakkında derin analiz ve intelligence üretir.  
3. **Brain** ve **CRM** bu verileri toplayarak “lead beyni” ve özetler üretir.  
4. **Outreach / Email / WhatsApp / OutreachScheduler** potansiyel müşterilere ulaşmak için aksiyon üretir.  
5. **LeadDashboard** tüm veriyi tek bir ekranda toplar.  
6. **Admin** ve **Auth** sistemin üst seviye kontrolünü ve güvenliğini sağlar.

---

## `_template` Modülü

**Amaç:** Yeni modül oluştururken kopyalanan “boş şablon”. Domain-agnostik, sadece pattern gösterir.  
**Konum:** `src/modules/_template`

### Yapı

- `api/controller.js` → Örnek controller iskeleti
- `api/routes.js` → Örnek router tanımı
- `docs/TEMPLATE.md` → Yeni modül dokümantasyonu için şablon
- `docs/CHANGELOG.md` → Değişiklik kayıtları için boş şablon
- `repo.js` → Örnek repo katmanı
- `service.js` → Örnek service katmanı

### Sorumluluklar

- Yeni bir modül eklerken:
  - API → Controller / Routes iskeletini hazır verir.
  - Repo → DB erişim pattern’ini gösterir.
  - Service → İş mantığı katmanını nasıl bölmemiz gerektiğini gösterir.
  - Docs → Her modül için oluşturulması gereken minimum doküman formatını belirler.

### Kullanım Akışı

1. Yeni bir domain ihtiyacı çıktığında (`pipeline`, `notifications`, vb.), `_template` klasörü kopyalanır.
2. Klasör ismi ve içerdeki referanslar yeni modül adına göre güncellenir.
3. İlk iş olarak:
   - `<MODULE>.md` yazılır (TEMPLATE.md referans alınarak).
   - `CHANGELOG.md` içine v1.0.0 initial release kaydı yazılır.

---

## `admin` Modülü

**Amaç:** Sistem yöneticileri için backend yönetim fonksiyonlarını sağlamak (dashboard verileri, sistem sağlığı, metrikler).  
**Konum:** `src/modules/admin`

### Yapı

- `api/controller.js`
  - Admin endpoint’leri (istatistikler, bazı yönetim aksiyonları vb.)
- `api/routes.js` → `/api/admin/*`
- `docs/ADMIN.md` → Admin modül tasarımı, endpoints, yetki modeli
- `docs/CHANGELOG.md`
- `repo/adminRepo.js` → Admin’e özel DB sorguları
- `service/adminService.js` → Admin iş mantığı

### Sorumluluklar

- Yönetim paneline veri sağlayan API’ler:
  - Toplam lead sayıları
  - Son X günde eklenen lead’ler
  - Discovery / GODMODE job istatistikleri (ileride)
  - Outreach performans özetleri
- Sistemin genel sağlık durumuna, istatistiklerine, metriklerine üst seviyeden erişim.
- Yetki kontrolü ile sadece admin kullanıcılarının görebileceği dataları sağlar.

### Örnek Kullanım Senaryosu

- Admin panel UI’si, tek bir “System Overview” sayfası için:
  - `/api/admin/stats` endpoint’inden discovery + intel + outreach özetlerini çeker.
  - Gelecekte:
    - GODMODE job sayıları, son hata log’ları, worker sağlık durumu gibi metrikleri de buradan alabilir.

---

## `auth` Modülü

**Amaç:** Kimlik doğrulama ve yetkilendirme katmanını yönetmek. Tüm modüllerin güvenlik kapısı.  
**Konum:** `src/modules/auth`

### Yapı

- `api/controller.js` → Login, register, refresh token vb. endpoint’ler
- `api/routes.js` → `/api/auth/*`
- `docs/AUTH.md` → Auth akışı, token yapısı, güvenlik notları
- `docs/CHANGELOG.md`
- `repo.js` → Kullanıcı tablosu (users) ile ilgili DB işlemleri
- `service/authService.js` → Auth iş mantığı
- `utils/hash.js` → Şifre hashing / verify (örn. bcrypt)
- `utils/jwt.js` → JWT üretimi / doğrulama yardımcıları

### Sorumluluklar

- Kullanıcı kayıt ve giriş işlemleri (email/password tabanlı auth).
- Access / refresh token üretimi ve doğrulaması.
- Şifre güvenliği (hash + salt).
- Diğer modüllerin:
  - **kimlik doğrulanmış kullanıcı**ya özel endpointler açabilmesi için temel oluşturmak.

### Diğer Modüllerle İlişki

- `core/middleware/authRequired.js` ve `authOptional.js` üzerinden, neredeyse tüm modüllerle entegredir.
- Özellikle:
  - `admin`, `crm`, `outreach`, `outreachScheduler`, `intel`, `research`, `leadDashboard` → genellikle auth zorunlu.
- Multi-tenant / user-based data isolation gibi konular bu modülden başlar.

---

## `brain` Modülü

**Amaç:** Sistemin farklı yerlerinden gelen sinyalleri (discovery, intel, crm, outreach) birleştirerek lead’ler için **üst seviye skor ve kararlar** üretmek.  
**Konum:** `src/modules/brain`

### Yapı

- `api/controller.js`
- `api/routes.js` → `/api/brain/*`
- `docs/BRAIN.md`
- `docs/CHANGELOG.md`
- `service/brainService.js` → Brain iş mantığı

### Sorumluluklar

- Lead bazlı “AI Brain” çıktıları:
  - Lead AI Score (örneğin 0–100 arası potansiyel skoru).
  - Fırsat / risk skorları.
  - Segment / cluster atamaları.
- Diğer modüllerden gelen veriyi birleştirme:
  - GODMODE / discovery (lead kaynağı ve sayısı),
  - Intel (website/SEO bilgileri),
  - Research (sektör & rakip analizi),
  - CRM (ilişki durumu, geçmiş görüşmeler),
  - Outreach (yanıt oranı, ilgi düzeyi).

### Örnek Akış

1. UI, belirli bir lead için “AI değerlendirme” ister.
2. `brainService`, ilgili lead’in:
   - Discovery kayıtlarını,
   - Intel / Research sonuçlarını,
   - CRM notlarını,
   - Outreach geçmişini
   toplar ve LLM / scoring fonksiyonuna gönderir.
3. Çıkan skorlar DB’de tutulur (tablo detayları CORE_DB dokümanında) ve LeadDashboard üzerinden görüntülenir.

---

## `crm` Modülü

**Amaç:** Lead’lerin CRM tarafındaki beyin ve zaman çizelgesi: notlar, özetler, ilişki durumu.  
**Konum:** `src/modules/crm`

### Yapı

- `api/controller.js`
- `api/routes.js` → `/api/crm/*`
- `docs/CRM.md` + `docs/CHANGELOG.md`
- `index.js` → CRM modül entrypoint’i
- `prompts/crm_brain_summary.md` → CRM Brain özetini üreten LLM prompt’u
- `service/crmBrainService.js` → CRM beyni oluşturma / güncelleme iş mantığı

### Sorumluluklar

- Lead odaklı CRM katmanı:
  - Görüşme notları,
  - Sonraki aksiyon planları,
  - Lead ile ilişki durumu (yeni → sıcak → müşteri…).
- LLM ile “CRM Brain Summary” üretmek:
  - Bir lead hakkında dağınık notları tek bir anlamlı özet hâline getirmek.
- Lead’in yaşam döngüsü içinde “ne oldu?” sorusuna cevap verecek özetleri saklamak.

### Veri ve Tablolar

- `lead_crm_brains` (isim CORE_DB’ye göre değişebilir):
  - Lead bazlı CRM beyni / özeti.
- `lead_crm_notes`:
  - Tarihçeli notlar, görüşme kayıtları, hızlı etiketler.

### Diğer Modüllerle İlişki

- `leadDashboard` bu modülden gelen özet ve notları gösterir.
- `outreach` ve `whatsapp/email` sonuçları, CRM notlarıyla ilişkilendirilebilir.
- `brain` modülü skor üretirken CRM verisini bağlam olarak kullanır.

---

## `discovery` Modülü

**Amaç:** GODMODE’dan önceki “klasik” discovery akışını yönetmek; daha basit, tek-provider odaklı lead keşfi ve AI ranker.  
**Konum:** `src/modules/discovery`

### Yapı

- `controller.js`
- `routes.js` → `/api/discovery/*`
- `docs/DISCOVERY.md` + `docs/CHANGELOG.md`
- `placesClient.js` → Google Places gibi dış kaynaklarla konuşan client
- `repo.js` → Discovery sonuçlarının DB katmanı
- `service.js` → Discovery iş mantığı
- `aiRanker.js` → Discovery sonuçlarına AI bazlı skor verme

### Sorumluluklar

- Basit discovery istekleri:
  - Tek parametre seti ile şehir / kategori bazlı lead bulma.
- LLM veya rule-based bir `aiRanker` ile bulunan lead’leri puanlama.
- Eski / legacy projelerde veya daha hafif kullanım senaryolarında kullanılmak üzere GODMODE’a alternatif sunmak.

### Diğer Modüllerle İlişki

- `godmode` bu modülün “evolved / enterprise” versiyonu sayılabilir.
- `leadDashboard` ve `intel` gibi modüller, discovery kaynaklı lead’leri de gösterebilir.

---

## `email` Modülü

**Amaç:** Email gönderimi ve email tabanlı outreach akışlarını backend tarafında yönetmek.  
**Konum:** `src/modules/email`

### Yapı

- `controller.js`
- `routes.js` → `/api/email/*`
- `docs/EMAIL.md` + `docs/CHANGELOG.md`
- `repo.js` → Email log’ları, template kullanımı vb.
- `service.js` → Email gönderimi, template doldurma, kayıt altına alma

### Sorumluluklar

- SMTP veya üçüncü parti email sağlayıcıları (SendGrid, SES vb.) ile entegrasyon.
- Outreach modülünden gelen email kampanyalarını fiilen göndermek.
- Gönderim log’larını tutmak:
  - Hangi lead’e, hangi template ile, ne zaman gönderildi,
  - Geri dönüş/yanıt metadatası (mümkünse).

### Örnek Akış

1. `outreach` modülü, lead için ilk temas email içeriğini üretir.
2. `email` modülü bu içeriği seçili sağlayıcıya iletir.
3. Sonuç (başarılı / hata) repo katmanına yazılır.
4. `leadDashboard` ve `crm` bu bilgiyi lead timeline’ında gösterir.

---

## `godmode` Modülü

**Amaç:** Sistemin “GODMODE Discovery Engine” olarak adlandırılan, çok sağlayıcılı (multi-provider), yüksek zekâlı discovery motorunu yönetmek.  
**Konum:** `src/modules/godmode`

### Yapı

- `api/controller.js`
  - `/api/godmode/status`
  - `/api/godmode/jobs`
  - `/api/godmode/jobs/:id`
  - `/api/godmode/jobs/discovery-scan`
  - `/api/godmode/jobs/:id/run`
- `api/routes.js` → `/api/godmode/*`
- `docs/GODMODE.md` → GODMODE modülünün genel mimarisi ve versiyon notları
- `docs/GODMODE_ROADMAP.md` → Faz bazlı gelişim roadmap’i
- `pipeline/discoveryPipeline.js` → Discovery pipeline orkestrasyonu
- `providers/`
  - `googlePlacesProvider.js` → Google Places provider’ı
  - `index.js` → Provider registry ve export’lar
  - `providersRunner.js` → Multi-provider runner / orchestration
- `repo.js` → GODMODE ile ilgili tabloların repo katmanı:
  - `godmode_jobs`
  - `godmode_job_progress`
  - `godmode_job_results`
  - `godmode_job_logs`
  - `potential_leads`
- `service.js` → Job yönetimi, discovery engine, provider çağrıları, sonuç özetleri
- `validator.js` → Discovery job input validasyonu (city, country, categories, rating, maxResults, channels vb.)
- `workers/`
  - `dataFeederWorker.js` → GODMODE çıktısını `potential_leads` tablosuna besleyen worker
  - `economicAnalyzerWorker.js` → Ekonomik analiz için placeholder worker
  - `entityResolverWorker.js` → Entity/lead birleştirme ve normalizasyon için placeholder worker

### Sorumluluklar

- **Job Management:**
  - Discovery işlerini oluşturma, listeleme, detay görüntüleme.
  - Job status: `queued`, `running`, `completed`, `failed`.
  - Job progress alanları: yüzde, bulunan/enrich edilen lead sayıları.
  - Job log sistemi (`godmode_job_logs`) ile adım adım event geçmişi (QUEUED, RUN_START, PROVIDER_PAGE, COMPLETED, FAILED).

- **Multi-Provider Discovery Engine:**
  - Faz 1: Google Places ile canlı discovery (şu an aktif).
  - Faz 2: LinkedIn, Instagram, Facebook, Yelp/Foursquare, resmi kayıtlar (MERSİS vb.) gibi ek provider’lar için altyapı.

- **Data Pipeline:**
  - Provider’dan gelen ham veriyi normalize edip ortak lead formatına dönüştürmek.
  - `potential_leads` tablosuna upsert ederek aynı lead’in tekrar tekrar eklenmesini engellemek (dedup).
  - İleride CRM / Intel / Brain modüllerine beslenmek üzere sağlam bir lead havuzu oluşturmak.

### Örnek Full Flow (Faz 1 + Faz 2 başlangıcı)

1. `/api/godmode/jobs/discovery-scan` ile yeni job oluşturulur.
2. Job DB’ye `queued` olarak yazılır, event log’a `QUEUED` eklenir.
3. `/api/godmode/jobs/:id/run` çağrıldığında:
   - Job `running` olur, log’a `RUN_START` yazılır.
   - `providersRunner` devreye girer, şu an için `google_places` çağrılır.
   - Her sayfa / batch için `PROVIDER_PAGE` event’leri loglanır.
4. Provider sonuçları normalize edilir ve `potential_leads` tablosuna upsert edilir.
5. Summary hazırlanır (`providers_used`, `used_categories`, stats) ve job `completed` olur, log’a `COMPLETED` yazılır.

---

## `intel` Modülü

**Amaç:** Lead’ler için derinlemesine “intelligence” (özellikle web sitesi ve SEO sinyalleri) üretmek.  
**Konum:** `src/modules/intel`

### Yapı

- `controller.js`
- `routes.js` → `/api/intel/*`
- `docs/INTEL.md` + `docs/CHANGELOG.md`
- `repo.js` → Lead intel tablolarına erişim
- `service.js` → Intel iş mantığı
- `seoOnpageService.js` → On-page SEO analizi ( `shared/seo/onpageAnalyzer.js` ile entegre )

### Sorumluluklar

- Bir lead’in web sitesi üzerinden:
  - On-page SEO analizi (title, meta, H etiketleri, içerik yoğunluğu vb.)
  - İçerik, marka mesajı, iş alanı gibi sinyallerin çıkarılması.
- İleride:
  - Backlink, Domain Authority gibi metrikler,
  - Sosyal medya bağlantıları,
  - Blog / içerik stratejisi gibi detaylar da bu modüle eklenebilir.

### Diğer Modüllerle İlişki

- `research` modülünden gelen daha geniş pazar/veri analizleri ile birlikte yorumlanabilir.
- `brain` lead seviyesinde SEO / site kalitesi skoru sağlar.
- `leadDashboard` lead detay sayfasında “website / SEO intel” sekmesini bu modülden besler.

---

## `leadDashboard` Modülü

**Amaç:** Lead merkezli dashboard / özet görünümünü besleyen backend katmanı.  
**Konum:** `src/modules/leadDashboard`

### Yapı

- `controller.js`
- `routes.js` → `/api/lead-dashboard/*` (veya benzeri prefix)
- `docs/LEAD_DASHBOARD.md` + `docs/CHANGELOG.md`
- `repo.js` → Dashboard sorgularını yapan DB katmanı
- `service.js` → UI’ın ihtiyacı olan birleştirilmiş lead datalarını hazırlayan iş mantığı

### Sorumluluklar

- Tek bir endpoint seti üzerinden, lead için:
  - Discovery / GODMODE kaynak bilgileri,
  - Intel (website/SEO) çıktıları,
  - Research sonuçları,
  - CRM notları ve beyin özetleri,
  - Outreach / Email / WhatsApp geçmişini
  bir araya getirmek.
- “Read model” gibi davranır:
  - Yazma/güncelleme genellikle diğer modüller üzerinden yapılır,
  - LeadDashboard bu verileri sadece **okur** ve UI’a uygun formatta döner.

### Örnek Akış

1. UI, lead detay sayfası açmak istediğinde `/api/lead-dashboard/:leadId` gibi bir endpoint çağırır.
2. `leadDashboardService` arka planda:
   - GODMODE / discovery kaynak tablosunu,
   - Intel / Research sonuçlarını,
   - CRM beyni ve notlarını,
   - Outreach, Email, WhatsApp log’larını
   okuyup tek bir JSON içinde birleştirir.
3. Böylece frontend, tek request ile komple lead evrenine sahip olur.

---

## `outreach` Modülü

**Amaç:** Lead’lere yapılacak ilk temas (first contact) ve devam eden iletişim için **strateji ve içerik** üretmek.  
**Konum:** `src/modules/outreach`

### Yapı

- `controller.js`
- `routes.js` → `/api/outreach/*`
- `docs/OUTREACH.md` + `docs/CHANGELOG.md`
- `first_contact_message.md` → İlk temas mesajı için prompt / metin şablonu
- `repo.js` → Outreach kayıtları, kampanya / mesaj log’ları
- `service.js` → Outreach kampanyası iş mantığı

### Sorumluluklar

- Farklı kanallar (email, WhatsApp, sosyal medya) için uygun ilk mesaj taslaklarını üretmek.
- Mesajların tonu ve içeriğini:
  - Brain skorları,
  - CRM durumu,
  - Research ve Intel çıktıları
  ile uyumlu hale getirmek.
- Kampanya mantığı:
  - Belirli bir lead seti için A/B test mesajları,
  - Farklı segmentler için farklı pitch’ler.

### Diğer Modüllerle İlişki

- `outreachScheduler` zamanlama/otomasyon tarafını yönetirken, içerik ve strateji `outreach`’ten gelir.
- `email` ve `whatsapp` modülleri teknik gönderimi yapar.
- `crm` ve `leadDashboard`, outreach sonuçlarını lead timeline’ında gösterir.

---

## `outreachScheduler` Modülü

**Amaç:** Outreach aksiyonlarının **zamanlanmasını ve otomatikleştirilmesini** yönetmek.  
**Konum:** `src/modules/outreachScheduler`

### Yapı

- `controller.js`
- `routes.js` → `/api/outreach-scheduler/*`
- `docs/OUTREACH_SCHEDULER.md` + `docs/CHANGELOG.md`
- `repo.js` → Zamanlanmış görevler, queue kayıtları
- `service.js` → Zamanlama ve tetikleme iş mantığı

### Sorumluluklar

- Belirli bir tarihte / koşulda gönderilecek outreach görevlerini planlamak.
- Cron / job runner sistemleri ile entegre edilerek, zaman geldiğinde:
  - `outreach` + `email` + `whatsapp` modüllerini devreye almak.
- Lead skorlarına veya event’lere göre otomatik tetikler:
  - Örn: Brain skoru > 80 olan lead’ler için 24 saat içinde otomatik email gönder.

### Örnek Senaryo

1. Kullanıcı, belirli bir segment lead listesi için 3 adımlı bir outreach sekansı planlar.
2. `outreachScheduler` her adım için zamanlanmış görevler oluşturur.
3. Zaman geldiğinde:
   - `outreach` üzerinden içerik hazırlanır,
   - `email` / `whatsapp` üzerinden gönderilir,
   - Sonuçlar CRM ve LeadDashboard’a yansıtılır.

---

## `research` Modülü

**Amaç:** Markalar / rakipler / sektörler için derin araştırma yapmak ve AI destekli, uzun formlu analizler üretmek.  
**Konum:** `src/modules/research`

### Yapı

- `ai/research_master_prompt.md` → Araştırma için kullanılan ana LLM prompt’u
- `api/routes.js` → `/api/research/*`
- `controller/controller.js` → HTTP controller
- `docs/RESEARCH.md` + `docs/CHANGELOG.md`
- `repo/researchRepo.js` + `repo.js` → Araştırma kayıt tabanları için repo katmanı
- `service/`:
  - `adsService.js` → Reklam analizleri (Meta Ads, Google Ads, kreatifler vb.)
  - `benchmarkService.js` → Benchmark / kıyaslama analizleri
  - `competitorService.js` → Tekil rakip analizi
  - `competitorsService.js` → Çoklu rakip analizi
  - `researchService.js` → Ana research orchestrator servisi
  - `socialsService.js` → Sosyal medya analizi (Instagram, Facebook, LinkedIn vb. içerik ve etkileşim)
  - `websearchService.js` → Web araması bazlı analizler

### Sorumluluklar

- Hedef marka / firma için:
  - Web sitesi, sosyal medya hesapları, reklam kreatifleri, rakipler ve pazar konumlandırması hakkında derin analiz.
- LLM tabanlı raporlar:
  - SWOT analizi,
  - Fırsatlar / tehditler,
  - Farklılaşma noktaları,
  - Önerilen iletişim stratejileri.
- Uzun formlu PDF / rapor çıktıları için backend tarafında bağlam hazırlamak.

### Diğer Modüllerle İlişki

- `intel` ile birlikte “firma dış dünya sinyalleri” tarafını oluşturur.
- `brain` lead / marka skorlamasında research sonuçlarını kullanabilir.
- `crm` ve `leadDashboard`, müşteri/proje bazlı background bilgilerini bu modülden alabilir.

---

## `whatsapp` Modülü

**Amaç:** WhatsApp tabanlı iletişim ve mesaj gönderimi için backend katmanını sağlamak.  
**Konum:** `src/modules/whatsapp`

### Yapı

- `controller.js`
- `routes.js` → `/api/whatsapp/*`
- `docs/WHATSAPP.md` + `docs/CHANGELOG.md`
- `repo.js` → WhatsApp mesaj log’ları ve entegrasyon kayıtları
- `service.js` → WhatsApp gönderim / alım iş mantığı

### Sorumluluklar

- Resmi WhatsApp Business API veya üçüncü parti sağlayıcılarla entegrasyonu sarmalamak.
- Outreach kampanyaları için WhatsApp kanalını aktif şekilde kullanmak:
  - İlk mesaj,
  - Hatırlatma mesajları,
  - Otomatik cevaplar (ileri fazlarda).
- Giden / gelen mesajların kaydını tutarak:
  - CRM notlarına ve LeadDashboard timeline’ına bağlamak.

### Örnek Akış

1. `outreach` modülü, lead için WhatsApp mesaj taslağı üretir.
2. `whatsapp` modülü bu mesajı WhatsApp API üzerinden gönderir.
3. Yanıt geldiğinde (webhook veya polling ile) repo’ya kaydedilir.
4. `crm` ve `leadDashboard` bu mesajı lead geçmişinde gösterir.

---

## `xyz` Modülü

**Amaç:** Şu an için placeholder / playground modülü. Üretim öncesi denemeler için güvenli alan.  
**Konum:** `src/modules/xyz`

### Sorumluluklar

- Yeni fikirlerin hızlıca test edilmesi:
  - Küçük PoC’ler (ör. yeni bir provider denemesi, mini worker, farklı bir rapor tipi).
- Stabil hale gelen denemelerin:
  - Yeni bir modüle taşınmadan önce burada iteratif olarak geliştirilmesi.

### Notlar

- `xyz` içerisinde kalıcı iş mantığı tutulmamalıdır.
- Bir özellik üretim için hazır hale geldiğinde:
  - İlgili domain’e uygun yeni bir modül açılmalı veya mevcut modüle taşınmalıdır.

---

## Özet

- Backend V2; **Discovery → GODMODE → Research + Intel → Brain → Outreach/Email/WhatsApp → CRM + LeadDashboard → Admin/Auth** zinciri etrafında tasarlanmış **modüler bir AI destekli B2B lead & intelligence platformu**dur.
- Her modül kendi `docs/` klasöründe detaylı tasarım dokümanına sahiptir; bu `MODULES.md` ise tüm modüllerin **kuş bakışı ve detaylı haritası**dır.
- Yeni modül eklerken:
  1. `_template` klasörü kopyalanmalı,
  2. Kendi `<MODULE>.md` ve `CHANGELOG.md` dosyaları yazılmalı,
  3. Gerekirse bu dosyada yeni bir başlık açılarak kısa özet eklenmelidir,


---

## Derinlemesine Örnek Senaryolar

Bu bölüm, modüllerin birlikte nasıl çalıştığını göstermek için uçtan uca (end-to-end) örnek akışları anlatır.  
Amaç: Yeni bir geliştirici ya da product tarafı, gerçek dünyadaki bir iş ihtiyacının backend’de hangi modülleri nasıl tetiklediğini net görebilsin.

### Senaryo 1 — Yeni Pazar için Lead Keşfi ve İlk Outreach (GODMODE → Intel/Research → Brain → Outreach/Email/WhatsApp → CRM → LeadDashboard)

**İş ihtiyacı:**  
CNG, “İstanbul’daki mimarlık ofisleri ve belirli segmentte güzellik merkezleri” için yeni bir müşteri edinme kampanyası başlatmak istiyor.

**Adım adım akış:**

1. **GODMODE Discovery Job Oluşturma**
   - Kullanıcı (veya internal job) şuna benzer bir payload ile istek atar:
     - `city`: "İstanbul"
     - `country`: "Türkiye"
     - `categories`: ["mimarlık ofisi", "güzellik merkezi"]
     - `minGoogleRating`: 3.5
     - `maxResults`: 250
     - `channels`: ["google_places", ... (ileride diğer provider’lar)]
   - İstek, `godmode/api/controller.js` içindeki `createDiscoveryScanJob` handler’ına gelir.
   - Controller:
     - `validator.js` ile input’u doğrular.
     - `service.js` içindeki `createDiscoveryScanJob` fonksiyonunu çağırır.
     - `repo.js` üzerinden:
       - `godmode_jobs` tablosuna yeni satır eklenir.
       - `godmode_job_logs` tablosuna `QUEUED` event’i yazılır.

2. **Discovery Job Çalıştırma (Run)**
   - `/api/godmode/jobs/:id/run` çağrılır.
   - Controller, `godmodeService.runJob(jobId)` fonksiyonunu tetikler.
   - `runJob`:
     - Job’ı DB’den yükler (`repo.getJobById`).
     - Status → `running` yapar, `godmode_job_logs`’a `RUN_START` yazar.
     - `providersRunner.runProvidersForJob(...)` fonksiyonu üzerinden:
       - Şu an için `googlePlacesProvider` devrededir.
       - Faz 2’de diğer provider’lar (LinkedIn, Instagram, Facebook, vb.) buraya eklenir.
     - Her provider sayfası için:
       - Ham sonuçlar normalize edilir.
       - `potential_leads` tablosuna **upsert** edilir (duplicateler engellenir).
       - `godmode_job_logs` tablosuna `PROVIDER_PAGE` event’i yazılır.
     - Job tamamlandığında:
       - `godmode_job_results` tablosuna özet (`result_summary_json`) ve gerekirse `raw_results_json` yazılır.
       - `godmode_jobs` → `status = completed`, `progress_percent = 100`.
       - `godmode_job_logs` → `COMPLETED` event’i eklenir.

3. **Lead Havuzunun Oluşması (potential_leads)**
   - `dataFeederWorker` (workers/dataFeederWorker.js) pipeline sonunda tetiklenir.
   - Bu worker:
     - Job’ın normalize edilmiş lead’lerini alır.
     - `potential_leads` tablosuna şehir / kategori / provider bilgileriyle beraber kaydeder.
     - Varsayılan dedup mantığı ile aynı place_id / provider kombinasyonunun tekrar eklenmesini engeller.
   - Sonuç: Artık sistemde, İstanbul’daki mimarlık ofisleri ve güzellik merkezleri için normalize edilmiş ve tekilleştirilmiş bir lead havuzu vardır.

4. **Intel & Research ile Derin Analiz**
   - Sistem, belirli lead’ler için:
     - `intel` modülü üzerinden:
       - Web sitesi on-page analizini (`seoOnpageService` + `shared/seo/onpageAnalyzer`) çalıştırır.
       - SEO / içerik / marka mesajı sinyalleri çıkarır.
     - `research` modülü üzerinden:
       - Reklam, sosyal medya, rakip ve pazar analizleri (`adsService`, `socialsService`, `competitorService`, `websearchService`) çalıştırılabilir.
   - Bu çağrılar:
     - İster manuel (UI’den) ister otomatik (worker / job) tetiklenebilir.
   - Elde edilen sonuçlar:
     - İlgili intel / research tablolarına yazılır ve lead ile ilişkilendirilir.

5. **Brain ile AI Tabanlı Değerlendirme**
   - `brain` modülü, belirli lead’ler için:
     - Discovery kaynak bilgisi (GODMODE / discovery),
     - Intel (website/SEO),
     - Research (pazar/rakip),
     - CRM (varsa),
     - Outreach geçmişi (varsa)
     gibi verileri bir araya getirir.
   - `brainService` bu sinyallerden:
     - Lead AI Score,
     - Fırsat / risk skorları,
     - Önerilen segment / kategori gibi üst seviye çıktılar üretir.
   - Bu skorlar DB’de saklanır ve LeadDashboard’a açılır.

6. **Outreach + Email + WhatsApp ile İlk Temas**
   - Satış ekibi veya otomasyon sistemi, belirli bir segment (örneğin AI score > 80 ve belirli bir kategori) için kampanya başlatır.
   - `outreach` modülü:
     - `first_contact_message.md` ve diğer prompt’lar üzerinden kanal bazlı mesaj içerikleri üretir:
       - Email için uzun / orta uzunlukta metin,
       - WhatsApp için daha kısa, direkt mesaj,
       - Gerekirse sosyal medya DM için adaptasyonlar.
   - `email` ve `whatsapp` modülleri:
     - Üretilen mesajı ilgili kanala gönderir.
     - Başarılı / başarısız log’ları DB’ye yazar.
   - `outreachScheduler`:
     - Eğer kampanya bir sekans içeriyorsa, sonraki adım mesajlarını zamanlar.
     - Gecikmeli follow-up, hatırlatma vb. görevleri yönetir.

7. **CRM ve LeadDashboard’da Görünürlük**
   - `crm` modülü:
     - Görüşme notları,
     - Otomatik / manuel eklenen durum değişiklikleri,
     - LLM ile üretilen CRM Brain özetlerini saklar.
   - `leadDashboard`:
     - Tek bir endpoint üzerinden:
       - GODMODE / discovery kaynağını,
       - Intel / Research sonuçlarını,
       - Brain skorlarını,
       - Outreach (email/whatsapp) geçmişini,
       - CRM notlarını ve beyin özetlerini
       birleştirir ve UI’a döner.
   - Sonuç: Satış ekibi tek ekranda hem lead’in “nereden geldiğini” hem de “aradaki tüm akışı” görebilir.

---

### Senaryo 2 — Mevcut Müşteri için Derin Marka Analizi (Research → Intel → Brain → CRM)

**İş ihtiyacı:**  
Halihazırda müşterimiz olan bir markanın, yeni kampanya planlaması öncesi “derin analiz raporu” hazırlanmak isteniyor.

1. **Müşteri / Marka Seçimi**
   - UI veya internal bir araç üzerinden müşteri seçilir.
   - İlgili müşteri / lead ID’si üzerinden:
     - Website URL,
     - Sosyal medya profilleri,
     - Reklam hesapları (varsa) gibi bilgiler okunur (genellikle `intel` ve `research` modüllerinin girdi seti).

2. **Research Modülünün Çalışması**
   - `researchService`:
     - `websearchService` ile markanın genel web görünürlüğünü tarar.
     - `socialsService` ile Instagram, Facebook, LinkedIn gibi platformlar üzerinden:
       - İçerik sıklığı,
       - Gönderi türleri,
       - Etkileşim oranlarını analiz eder.
     - `adsService` ile reklam kreatifleri, mesaj tonları, call-to-action kalıpları incelenebilir (imkan olduğu ölçüde).
     - `competitorService` ve `competitorsService` ile:
       - Rakip listesi ve rakiplerin konumlanması çıkarılır.
     - Sonuçlar:
       - `researchRepo` üzerinden ilgili tabloya yazılır ve müşteri/lead ile ilişkilendirilir.

3. **Intel ile Website / SEO Katmanı**
   - `intel` modülü, markanın web sitesi için:
     - On-page SEO analizi (title, meta, H1-H2 yapısı, içerik, teknik detaylar),
     - İçerik / sayfa yapısı,
     - Marka mesajlaşması (hangi söylemler öne çıkarılmış?) gibi sinyaller üretir.
   - Çıktılar intel tablolarına kaydedilir.

4. **Brain Üzerinden Stratejik Özet**
   - `brainService`, hem `research` hem `intel` çıktılarıyla birlikte:
     - Sektördeki konumu,
     - Rakiplerine göre avantaj/dezavantajları,
     - Dijital varlık kalitesi,
     - Perfect-fit müşteri segmentleri gibi noktaları skorlayabilir.
   - Bu skorlar, markaya özel bir “brain snapshot” oluşturmak için kullanılabilir.

5. **CRM ve Dokümantasyon**
   - `crm` modülü:
     - Bu analiz sürecine ait notları ve genel özetleri lead/müşteri kartına işler.
     - LLM tabanlı bir “kısa özet” ve “uzun stratejik özet” üretilebilir.
   - Swagger / dış doküman ile birlikte:
     - Müşteriye sunulacak PDF veya sunumun veri kaynağı bu modüllerden alınır.

---

### Senaryo 3 — Admin Paneli ile Sistem Sağlığı ve Performans İzleme (Admin → GODMODE → Outreach → DB)

**İş ihtiyacı:**  
Admin kullanıcı, sistemin genel durumunu hızlıca görmek istiyor: son discovery job’ları, hata oranları, outreach performansı vb.

1. **Admin İsteği**
   - Admin panel UI, oturum açmış bir admin kullanıcı için `/api/admin/stats` veya benzeri endpoint’i çağırır.
   - Bu endpoint, `admin/api/controller.js` içinde tanımlıdır ve `adminService`’i kullanır.

2. **AdminService’in Veri Toplaması**
   - `adminService`:
     - `godmode.repo` üzerinden:
       - Son X job,
       - Başarılı / başarısız job sayıları,
       - Ortalama job süresi gibi istatistikleri çeker.
     - Discovery / potential_leads tablolarından:
       - Son günlerde bulunan yeni lead sayısını,
       - Provider bazlı dağılımı (Google Places, ileride LinkedIn vb.).
     - Outreach / email / whatsapp modüllerinin repo’larından:
       - Gönderilen mesaj sayıları,
       - Başarılı / hata oranları,
       - Kampanya bazlı performanslar.

3. **Özet JSON Dönüşü**
   - Controller, tüm bu verileri tek bir JSON içinde toparlayarak UI’a döner.
   - UI bu bilgiyi:
     - Grafikler,
     - Kartlar,
     - Tablo görünümleri ile admin’e gösterir.

4. **Sorun Analizi**
   - Örneğin son 24 saatte GODMODE job hata oranı yükseldiyse:
     - Admin, job log’larını (`godmode_job_logs`) inceleyerek hangi provider’ın sık hata verdiğini görebilir.
     - Gerekirse ilgili provider geçici olarak devre dışı bırakılabilir (Faz 2 PAL / provider health check).

---

### Senaryo 4 — Basit Discovery ve AI Ranker ile Hızlı Fırsat Listesi (Discovery → Brain / LeadDashboard)

**İş ihtiyacı:**  
Daha basit bir kullanımda, GODMODE’u kullanmadan sadece `discovery` modülü ile kısa süre içinde “ilk bakış lead listesi” oluşturmak.

1. **Discovery API Çağrısı**
   - UI veya script, `/api/discovery/search` gibi bir endpoint’e (modül tasarımına göre) şehir + kategori parametreleriyle istek atar.
   - `discovery/controller.js` istek parametrelerini alır, `discovery/service.js`’i çağırır.

2. **PlacesClient ile Veri Çekme**
   - `placesClient.js`, Google Places gibi kaynaklardan basit arama yapar.
   - Sonuçlar normalize edilir ve `discovery/repo.js` üzerinden DB’ye kaydedilebilir veya direkt response olarak dönebilir.

3. **AI Ranker ile Önceliklendirme**
   - `aiRanker.js`, bulunan lead’leri iş kurallarına / AI modeline göre skorlar:
     - Örneğin:
       - Rating,
       - Review sayısı,
       - Belirli anahtar kelimeler,
       - Konum gibi parametreleri kullanarak.

4. **LeadDashboard Entegrasyonu**
   - Discovery modülü, lead’leri `potential_leads` veya discovery’ye özel tablolara yazar.
   - `leadDashboard` bu lead’leri çekerek basit bir “quick wins list” üretmek için kullanılabilir.

---

Bu senaryolar, modüllerin birbirleriyle nasıl konuştuğunu gösteren temel örneklerdir.  
Yeni özellikler eklendikçe ve GODMODE Faz 2–3–4 ilerledikçe, buraya yeni senaryolar (örneğin tam otomatik outreach, sektör bazlı sürekli tarama, multi-tenant kullanım vb.) eklenmelidir.


