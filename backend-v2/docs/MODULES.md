# Backend V2 — Modules Overview (Deep Dive)

Bu doküman, **backend-v2/src/modules** altında yer alan tüm modüllerin mimarisini, sorumluluklarını, ana veri akışlarını ve aralarındaki ilişkileri detaylı şekilde özetler.  
Hedef: Yeni gelen bir geliştirici bu dosyayı okuduğunda, sadece “hangi modül ne iş yapıyor?” değil, aynı zamanda **“hangi modül hangi veriyi nereden alıyor, nereye akıtıyor, hangi senaryolarda devreye giriyor?”** sorularının cevabını da görebilsin.

> Not:  
> - Çekirdek altyapı (core, shared, prompts vb.) için `docs/ARCHITECTURE.md` ve `src/core/docs/CORE_DB.md` dokümanları referans alınmalıdır.  
> - Bu dosya **modül seviyesi** referansıdır; tablo şemalarının tam detayı için DB dokümanlarına bakılmalıdır.

---

# Modüller Mimarisi

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
**Versiyon:** v1.0.0  
**Konum:** `src/modules/admin`  
**Durum:** Aktif – Sistem durum ve konfigürasyon yönetimi API’si  
**Son Güncelleme:** 2025-12-06

### Amaç
Admin modülü, sistemin tüm operasyonel durumunu, modül sağlık bilgilerini, konfigürasyon ayarlarını ve genel backend özetini tek noktadan expose eden yönetim katmanıdır.

### Sorumluluklar
- Sistem durumunu raporlama (uptime, node sürümü, bellek, host loadavg)
- Backend uygulamasının versiyon ve çalışma ortamı bilgilerini sağlama
- Tüm modüllerin sağlık ve versiyon durumu
- Config & Feature flag’leri expose etme
- Admin panel için merkezi overview datası sağlama

### Teknik Yapı
- `api/controller.js` — status, modules, config, overview endpoint’leri
- `api/routes.js` — `/api/admin/*`
- `service/adminService.js` — tüm veri toplama ve birleşik JSON hazırlama mantığı
- `repo/adminRepo.js` — admin’e özel DB işlemleri
- `docs/ADMIN.md` — tüm teknik tasarım ve örnek response’lar
- `docs/CHANGELOG.md` — versiyon geçmişi

### Endpointler
- `GET /api/admin/status` — sistem & node & memory bilgisi
- `GET /api/admin/modules` — modül sağlık & versiyon listesi
- `GET /api/admin/config` — environment + feature flag bilgisi
- `GET /api/admin/overview` — status + modules + db health birleşik JSON

### Veri Akışı
1. Controller istek alır  
2. `adminService` gerekli modüllerin repo ve servisleriyle konuşur  
3. Sistem + modüller + db sağlık bilgisi toplanır  
4. Tek unified JSON döndürülür  

### Diğer Modüllerle İlişki
- Discovery / GODMODE job istatistikleri ileride bu modüle bağlanacak
- Outreach / email / whatsapp sonuçları üzerinden sistem performans metrikleri sunabilir
- Auth entegrasyonu ile sadece admin rolü bu endpointleri görebilecek

### Önemli Notlar
- DB health check henüz gerçek değil (dummy)
- Endpointler şu anda auth’suz; production’da JWT + role kontrolü zorunlu
- Feature flags roadmap’e göre genişletilecek

---

## `auth` Modülü
**Versiyon:** v1.0.0  
**Konum:** `src/modules/auth`  
**Durum:** ✔ Aktif ve stabil  
**Son Güncelleme:** 2025-12-06

### Amaç
Auth modülü, tüm sistemin **kimlik doğrulama (authentication)** ve **yetkilendirme (authorization)** altyapısını yönetir.  
Backend-v2’nin güvenlik kapısıdır ve diğer tüm modüllerin güvenli şekilde çalışabilmesi için temel oluşturur.

### Sorumluluklar
- Email + şifre tabanlı kullanıcı oluşturma ve giriş sistemi
- JWT access + refresh token üretimi, doğrulama, yenileme
- Şifre hashing (bcrypt) ve güvenli karşılaştırma
- Modüller arası güvenli erişim:
  - Admin panelleri
  - CRM işlemleri
  - Outreach işlemleri
  - LeadDashboard
  - Research / Intel
- Kullanıcı oturum yönetimi ve kimlik doğrulama middlewar’ları

### Teknik Yapı
- `api/controller.js`
  - login
  - register
  - refresh-token
  - logout (v2’de gelecek)
- `api/routes.js`
  - `/api/auth/*`
- `docs/AUTH.md`
  - Auth flow, örnek JWT payload’ları, güvenlik best practices
- `repo.js`
  - Users tablosu ile ilgili tüm DB işlemleri
- `service/authService.js`
  - Login / register / refresh mantığı
  - Token üretimi
  - Kullanıcı doğrulama
- `utils/hash.js`
  - bcrypt tabanlı hash + compare
- `utils/jwt.js`
  - Access ve refresh token üretimi
  - verify & decode fonksiyonları

### Endpointler
- `POST /api/auth/register`
  - Yeni kullanıcı kaydı
- `POST /api/auth/login`
  - Email + şifre ile giriş
- `POST /api/auth/refresh`
  - Refresh token ile yeni access token üretimi
- `GET /api/auth/me` (Roadmap)
  - Kullanıcının kendi profilini döner

### Veri Modeli
Users tablosu (migration 006_create_users.js’de)
- id  
- email  
- password_hash  
- role (admin/user gibi)  
- created_at  
- updated_at  

### Diğer Modüllerle İlişki
- `core/middleware/authRequired.js` → tüm kritik endpointler için güvenlik katmanı
- `admin` → admin rolü ile tam kontrol paneli
- `crm`, `outreach`, `intel`, `research`, `leadDashboard` → kullanıcı bazlı veri işlemleri
- `brain` → lead değerlendirmelerini kullanıcı ile ilişkilendirebilir

### Önemli Notlar
- Şu anda role-based access control (RBAC) **temel seviyede**
- Roadmap:
  - “role: admin / operator / agent” seviyesinde genişletilmiş RBAC
  - Token metrikleri ve IP rate limit
  - OAuth 2.0 entegrasyonu opsiyonel

### Derin Senaryo Örneği
**Senaryo: CRM ekranına erişim**

1. Kullanıcı `/api/auth/login` üzerinden giriş yapar → access + refresh token alır  
2. Frontend access token ile `/api/crm/lead/:id` endpoint’ine istek atar  
3. `authRequired.js`:
   - JWT kontrolü yapar  
   - Token geçerliyse kullanıcı request context’e işlenir  
4. CRM modülü kullanıcıya özel lead verilerini döner  
5. Token süresi dolarsa frontend `refresh-token` ile yeni token alır  

Auth modülü, sistemin tüm “kim, neye erişebilir?” sorusunun temelini oluşturur.

---

## `brain` Modülü

**Versiyon:** v1.0.0  
**Konum:** `src/modules/brain`  
**Durum:** Aktif – Lead skorlaması ve sinyal birleştirme motoru  
**Son Güncelleme:** 2025-12-06

### Amaç
Brain modülü, sistemdeki tüm modüllerden toplanan sinyallerin birleşerek **lead seviyesinde zekâ, skor ve stratejik değerlendirme ürettiği merkez beyin katmanıdır**.  
GODMODE → Intel → Research → CRM → Outreach → LeadDashboard arasında köprü görevi görür.

### Çekirdek Sorumluluklar
- Lead için “AI Lead Brain Snapshot” oluşturmak.
- Çoklu kaynaktan toplanan sinyalleri birleştirmek:
  - Discovery / GODMODE sinyalleri (kaynak, provider, kategori)
  - Intel (website & SEO analizleri)
  - Research (rakip, pazar, sosyal medya, marka analizi)
  - CRM (notlar, ilişki durumu, görüşme geçmişi)
  - Outreach (email/whatsapp etkileşim sinyalleri)
- Lead AI Score üretmek:
  - 0–100 arası potansiyel skoru
  - Fırsat/Risk seviyeleri
  - Lead segmentasyonu
- Lead için stratejik çıktı üretmek:
  - “Bu lead neden önemli?”
  - “Hangi sinyaller pozitif/negatif?”
  - “Önerilen ilk temas yaklaşımı”

### Teknik Yapı
- `api/controller.js`
  - `/api/brain/lead/:id`
  - Lead bazlı brain snapshot endpoint’i
- `api/routes.js`
- `service/brainService.js`
  - Tüm modüllerden veri toplayıp LLM’e gönderir
  - Skor, segment, özet üretir
  - Güncel snapshot’ı DB’ye kaydeder
- `docs/BRAIN.md` → Modülün tam teknik tasarımı ve örnek payload’lar  
- `docs/CHANGELOG.md`

### Kullanılan Veri Kaynakları
- **GODMODE**
  - lead discovery kaynağı
  - provider listesi
  - kategori & rating sinyalleri
  - job sonuç özetleri
- **Intel**
  - Website/SEO kalitesi
  - Marka mesajı analizi
- **Research**
  - Rakip analizi
  - Sosyal medya analizi
  - Reklam stratejisi
  - Pazar konumlandırma
- **CRM**
  - Notlar
  - Görüşme geçmişi
  - CRM Brain Summary
- **Outreach**
  - Email gönderimleri
  - WhatsApp mesajları
  - Yanıt/okunma durumu

### Brain Çıktı Formatı (Örnek)
Brain modülünün ürettiği JSON genel olarak şu alanları içerir:

```
{
  "lead_id": 123,
  "score": 84,
  "opportunity_level": "high",
  "risk_level": "low",
  "segment": "architecture A-tier",
  "key_signals": {
    "seo": "strong",
    "socials": "active",
    "reviews": "high-rated",
    "website_quality": "professional"
  },
  "summary": "Firma güçlü dijital varlığa sahip...",
  "recommended_strategy": "İlk temas profesyonel yaklaşım..."
}
```

### Derin Akış Senaryosu
1. Lead seçilir → `/api/brain/lead/:id` çağrılır.
2. `brainService` arka planda şu modüller ile konuşur:
   - GODMODE → kaynak & provider sinyalleri
   - Intel → website/SEO sonuçları
   - Research → rakip/pazar analizleri
   - CRM → notlar & özetler
   - Outreach → iletişim geçmişi
3. Toplanan sinyaller LLM’e gönderilir.
4. LLM’den gelen skorlar + özet DB’ye kaydedilir.
5. LeadDashboard bu snapshot’ı gösterir.

### Diğer Modüllerle İlişki
- **LeadDashboard** brain snapshot’larını gösteren UI katmanıdır.
- **CRM** brain özetlerinden yararlanarak lead ilişkisini geliştirmeyi sağlar.
- **Outreach** mesaj tonunu brain skoruna göre ayarlar.
- **GODMODE** → Brain için temel ham veri kaynağıdır.

---

## `crm` Modülü
**Versiyon:** v1.1.0  
**Konum:** `src/modules/crm`  
**Durum:** Aktif – Lead CRM beyni, not yönetimi, zaman çizelgesi, ilişki süreci yönetimi  
**Son Güncelleme:** 2025-12-09

### Amaç
CRM modülü, bir lead’in tüm ilişki geçmişini, notlarını, LLM tarafından oluşturulan CRM Brain özetlerini, ilişki durumunu ve yaşam döngüsünü (lifecycle) yöneten kritik modüldür.  
GODMODE → Intel → Research → Brain akışından sonra gelen **insan temasını** yöneten modüldür.

### Çekirdek Sorumluluklar
- Lead için tüm CRM notlarını yönetmek (timeline yönetimi).
- LLM tabanlı CRM Brain Summary üretmek:
  - Tüm notları anlamlı bir özet halinde birleştirmek.
  - Lead’in ilişki geçmişini tek cümlede özetleyebilmek.
- Lead ilişki durumlarını yönetmek:
  - new → warm → hot → client → lost
- Görüşme geçmişi & müşteri durumları işlemek.
- Outreach / Email / WhatsApp çıktılarını CRM timeline'ına yansıtmak.

---

### Teknik Yapı Bileşenleri

#### 📌 API
- `api/controller.js`
  - Not ekleme / listeleme
  - CRM Brain oluşturtma
  - Lead CRM durum yönetimi
- `api/routes.js` → `/api/crm/*`

#### 📌 Service
- `service/crmBrainService.js`
  - Tüm CRM kayıtlarını toplayıp LLM'e göndererek CRM Brain üretir.
  - Lead ID bazlı özet oluşturur ve DB’ye kaydeder.
- Lead notları ve durum güncellemeleri için servis fonksiyonları.

#### 📌 Repo
- `repo.js` veya `repo/` altındaki fonksiyonlar:
  - `lead_crm_notes`
  - `lead_crm_brains`
  - `lead_crm_status`
  tabloları ile çalışır.

#### 📌 Prompts
- `prompts/crm_brain_summary.md`
  - LLM’in CRM beyni oluşturması için ana prompt.

#### 📌 Docs
- `docs/CRM.md`
  - Modülün tam tasarımı, endpointler ve örnek akışlar.

---

### Veri Modelleri

#### 🗂 `lead_crm_notes`
Lead ile ilgili tüm zaman çizelgesi kayıtlarını tutar:
- note_id  
- lead_id  
- user_id  
- note  
- created_at  

#### 🧠 `lead_crm_brains`
LLM tarafından oluşturulmuş CRM özetlerini tutar:
- id  
- lead_id  
- summary_text  
- key_points_json  
- created_at  

#### 🔖 `lead_crm_status`
Lead'in CRM durumlarını takip eder:
- id  
- lead_id  
- status (new, warm, hot, client, lost)
- updated_at

---

### Diğer Modüllerle Etkileşim

| Modül | Etkileşim Tipi | Açıklama |
|-------|----------------|----------|
| **leadDashboard** | Veri sağlar | CRM notları + CRM beyni dashboard'da gösterilir. |
| **outreach / email / whatsapp** | Data tüketir | Gönderilen mesajlar CRM timeline’a işlenebilir. |
| **brain** | Bağlam sağlar | Brain oluşturulurken CRM özetleri + notlar bağlam olarak kullanılır. |
| **godmode** | Lead kaynağı | GODMODE’dan gelen lead CRM modülüne giriş yapabilir. |

---

### Derin Kullanım Senaryosu

#### Senaryo — Bir lead’in tüm geçmişinden otomatik CRM Brain üretimi

1. Kullanıcı lead hakkında notlar ekler (görüşme, toplantı, problem, fırsat vb.).  
2. Outreach modülü lead’e email/whatsapp gönderir → CRM notlarına otomatik işlenir.  
3. Sistem `/api/crm/brain/:leadId` endpoint’ini tetikler.  
4. `crmBrainService`:
   - Tüm notları toplar  
   - LLM’e gönderir  
   - "CRM Brain Summary" döner  
   - DB’ye kaydeder  
5. `leadDashboard` bu özeti lead detay sayfasında gösterir.

---

### Önemli Notlar
- CRM Brain özetleri şu anda manuel tetikleniyor; Faz 2’de otomatik tetikleyici eklenecek.
- Notlar lead bazında tutulur, kullanıcı bazlı filtreleme ilerleyen fazlarda eklenecek.
- CRM Brain bir “mini-stratejik özet” olduğu için lead’in pazarlama / satış yaklaşımını belirlemede kritik rol oynar.

---

### Roadmap (CRM)

- [x] Not sistemi
- [x] CRM Brain Summary v1
- [x] Lead ilişki durum yönetimi
- [ ] Otomatik CRM Brain oluşturma tetikleyicisi
- [ ] Yazılımsal görüşme özetleri (AI Meeting Summary)
- [ ] CRM → Outreach akıllı öneri entegrasyonu

## `discovery` Modülü
**Versiyon:** v1.0.0  
**Konum:** `src/modules/discovery`  
**Durum:** Aktif – GODMODE’un temelini oluşturan klasik discovery motoru  
**Son Güncelleme:** 2025-12-09

### Amaç
Discovery modülü, GODMODE’dan önceki “standalone / lightweight” keşif motorudur.  
Tek provider (Google Places) ile çalışır ve daha basit kullanım senaryolarında hızlı lead keşfi sağlar.

### Çekirdek Sorumluluklar
- Google Places tabanlı lead arama (şehir + kategori + rating filtreleri ile)
- Ham sonuçları normalize ederek ortak discovery formatına dönüştürme
- AI Ranker ile lead’lere skor atama (potansiyel değere göre sıralama)
- Basit veya legacy projelerde GODMODE’a alternatif olarak kullanılma
- Lead sonuçlarını discovery’ye özel repo üzerinden saklama (opsiyonel)
- LeadDashboard gibi modüllere hızlı tüketilebilir discovery dataları sağlama

### Teknik Yapı

#### 📌 API
- `controller.js`
  - `/api/discovery/search`
  - `/api/discovery/rank`
- `routes.js`  
  → `/api/discovery/*`

#### 📌 Service
- `service.js`
  - Discovery arama işlemlerinin tamamı
  - Google Places’ten gelen verinin normalize edilmesi
  - AI Ranker entegrasyonu

#### 📌 Repo
- `repo.js`
  - Discovery sonuçlarının DB’ye kaydedilmesi
  - Lead sonuçlarının okunması
  - Basit dedup mantığı (place_id/provider bazlı)

#### 📌 AI Ranker
- `aiRanker.js`
  - LLM veya rule-based scoring fonksiyonları
  - Rating, yorum sayısı, kategori, konum gibi metriklerden skor üretir

#### 📌 Docs
- `docs/DISCOVERY.md`
  - Tam teknik açıklama, endpoint örnekleri, normalization yapısı  
- `docs/CHANGELOG.md`

---

### Normalizasyon Yapısı

Discovery modülü, Google Places ham datayı şu formatta normalize eder:

```
{
  provider: "google_places",
  place_id: "...",
  name: "...",
  address: "...",
  city: "...",
  country: "...",
  rating: 4.7,
  user_ratings_total: 31,
  types: [...],
  business_status: "...",
  location: { lat: ..., lng: ... },
  raw: {...}
}
```

Bu format GODMODE ile tamamen uyumludur.

---

### Derinlemesine Akış Senaryosu

**Senaryo: İstanbul'daki “mimarlık ofisi” kategorisini hızlıca tarama**

1. UI veya internal script:  
   `/api/discovery/search?city=İstanbul&category=mimarlık ofisi&minRating=4`
2. `controller.js` → input doğrulaması
3. `service.js` → `placesClient.searchPlaces()` çağrısı
4. Sonuçlar normalize edilir
5. `aiRanker.js` çalışır → Lead skorları hesaplanır
6. Response UI’a döner; DB’ye yazmak opsiyoneldir

**Bu modül GODMODE’un Faz 1'de %100 tamamladığı yapının daha basit sürümüdür.**

---

### Diğer Modüllerle Etkileşim

| Modül | Etkileşim | Açıklama |
|-------|-----------|---------|
| **godmode** | Alternatif / temel motor | GODMODE → multi-provider, Discovery → tek-provider |
| **leadDashboard** | Veri tüketir | Discovery sonuçları hızlı şekilde dashboard’da gösterilebilir |
| **intel** | Bağlam sağlar | Discovery lead’leri intel analizine gönderilebilir |
| **brain** | Sinyal üretir | Discovery skorları brain motoruna sinyal olarak gider |

---

### Roadmap (Discovery)
- [x] Google Places tabanlı discovery
- [x] Normalization (GODMODE ile %100 uyumlu)
- [x] AI Ranker v1
- [ ] Multi-query batching
- [ ] Ek provider (Yelp/Foursquare) mini entegrasyon
- [ ] Discovery → GODMODE otomatik geçiş köprüsü


## `email` Modülü  
**Versiyon:** v0.1.0  
**Konum:** `src/modules/email`  
**Durum:** Temel – SMTP entegrasyonu yok, sadece log sistemi  
**Son Güncelleme:** 2025-12-06  

### Amaç  
Email modülü, CNG AI Agent’in ileride kullanacağı email gönderim altyapısının çekirdeğini oluşturur.  
Bu sürümde **gerçek email gönderimi yapılmaz**, tüm işlemler simüle edilir ve SQLite’a log olarak yazılır.

### Sorumluluklar  
#### ✔ Email Loglama  
Gönderilmek istenen email içerikleri `email_logs` tablosuna yazılır.  
Alanlar:  
- `to_email`  
- `subject`  
- `body`  
- `meta` (JSON)  
- `created_at`  

#### ✔ Test Endpoint  
Modülün çalışıp çalışmadığını doğrulamak için kullanılır.  
SMTP ile bağlantı kurulmaz; yalnızca log üretilir.

### Teknik Yapı  
```
src/modules/email
  ├── api
  │   ├── controller.js
  │   └── routes.js
  ├── repo.js
  ├── service.js
  └── docs
      ├── EMAIL.md
      └── CHANGELOG.md
```

- `controller.js` → `sendTestEmailHandler`  
- `service.js` → `sendTestEmail()`  
- `repo.js` → `logEmail()`  
- `EMAIL.md` → Tam teknik doküman  

### API Endpoints  
| Method | Endpoint | Açıklama |  
|--------|----------|----------|  
| POST | `/api/email/test` | Test amaçlı email log oluşturur |

**Response (örnek)**  
```
{
  "ok": true,
  "data": {
    "ok": true,
    "id": 1,
    "note": "Email module v0.1.0 — SMTP entegrasyonu henüz eklenmedi, sadece log kaydı oluşturuldu."
  }
}
```

### Database — `email_logs`  
Alanlar:  
- `id` (PK)  
- `to_email`  
- `subject`  
- `body`  
- `meta`  
- `created_at`  
Tablo repo seviyesinde CREATE TABLE IF NOT EXISTS ile lazy initialize edilir.

### Known Limitations  
- SMTP yok  
- Auth yok → endpoint public  
- Queue / retry / delivery status yok  

### Future Improvements  
- SMTP / SendGrid / Mailgun / SES entegrasyonu  
- Template bazlı HTML email sistemi  
- Gönderim queue + scheduler  
- Admin UI log görüntüleme  
- Auth zorunluluğu  

## `godmode` Modülü
**Versiyon:** v1.0.0-live  
**Konum:** `src/modules/godmode`  
**Durum:** Production-grade stable — Faz 1 %100 tamamlandı  
**Son Güncelleme:** 2025-12-08  

### Amaç
GODMODE, CNG AI Agent ekosisteminin **omni-provider discovery engine**’idir.  
Faz 1’de tek provider (Google Places) ile çalışan yüksek kapasiteli bir keşif motoru sunar.  
Faz 2–3–4 ile çok sağlayıcılı, paralel çalışan, AI destekli bir “Discovery Brain”e dönüşecektir.

Modül, büyük ölçekli veri taramaları, job yönetimi, event-log tabanlı izleme ve normalize edilmiş lead üretimi için sistemin çekirdeğidir.

---

### Öne Çıkan Özellikler (Faz 1 Final)
- Google Places Text Search + Place Details entegrasyonu  
- Twin-phase pipeline: **discovery → enrichment**
- Persistent job store (SQLite kalıcılığı)  
- Event log tabanlı zaman çizelgesi:
  - `QUEUED`
  - `RUN_START`
  - `PROVIDER_PAGE`
  - `COMPLETED`
  - `FAILED`
- Sağlam validasyon katmanı (`validator.js`)
- Normalize provider error formatı:
```
{ "provider": "google_places", "error_code": "…", "error_message": "…" }
```
- Worker orchestration stub:
  - `dataFeederWorker` aktif
  - Faz 2–3: `entityResolverWorker`, `economicAnalyzerWorker`

- Lead pipeline entegrasyonu:
  - Normalize edilmiş veriler **potential_leads** tablosuna UPSERT edilir
  - Duplicate koruması vardır

---

### Teknik Yapı
- `api/controller.js` — Job oluşturma, listeleme, alma, çalıştırma
- `api/routes.js` — `/api/godmode/*`
- `docs/GODMODE.md` — Teknik doküman
- `docs/GODMODE_ROADMAP.md` — Faz bazlı roadmap
- `pipeline/discoveryPipeline.js` — Provider → Normalize → Summary orkestrasyonu
- `providers/`
  - `googlePlacesProvider.js`
  - `providersRunner.js` → Provider orchestration
  - `index.js` → Provider registry
- `repo.js`
  - `godmode_jobs`
  - `godmode_job_results`
  - `godmode_job_logs`
  - `godmode_job_progress`
  - `potential_leads`
- `service.js` — Job state machine + iş mantığı
- `validator.js` — Input doğrulama
- `workers/`
  - `dataFeederWorker.js`
  - `economicAnalyzerWorker.js`
  - `entityResolverWorker.js`

---

### Çekirdek Sorumluluklar
#### ✔ Job Management (Persistent)
- Job state machine:
  - `queued → running → completed` veya `failed`
- Job log sistemi (zaman çizelgesi)
- Job progress:
  - `percent`, `found_leads`, `enriched_leads`
- Summary üretimi:
  - `providers_used`
  - `used_categories`
  - `provider_errors`
  - `stats`

#### ✔ Multi‑Provider Discovery Engine (Faz 2 için hazır)
- Provider abstraction layer tamamlandı
- `providersRunner` paralel çalışmaya hazır
- Hata yönetimi normalize edildi
- Faz 2’de eklenecek provider’lar:
  - LinkedIn
  - Instagram
  - Facebook
  - Yelp / Foursquare
  - MERSİS (resmi kayıtlar)

#### ✔ Lead Pipeline Integration
- Normalize lead formatı:
```
{
  provider,
  place_id,
  name,
  address,
  city,
  country,
  rating,
  user_ratings_total,
  types,
  business_status,
  location: { lat, lng },
  raw: {...}
}
```
- UPSERT → potential_leads  
- Duplicate merging altyapısı Faz 2’de gelecek

---

### API Endpoints
- `GET /api/godmode/status`
- `POST /api/godmode/jobs/discovery-scan`
- `POST /api/godmode/jobs/:id/run`
- `GET /api/godmode/jobs`
- `GET /api/godmode/jobs/:id`

---

### Job Yaşam Döngüsü (Özet)
1. **Job oluşturma**
   - Validasyon
   - `godmode_jobs` insert
   - Log → `QUEUED`

2. **Çalıştırma**
   - Status → `running`
   - Log → `RUN_START`

3. **Provider Pipeline**
   - Her batch → `PROVIDER_PAGE`
   - Normalize lead
   - UPSERT → potential_leads

4. **Tamamlama**
   - Summary builder
   - Status → `completed`
   - Log → `COMPLETED`
   - Worker tetikleme

5. **Hata**
   - Status → `failed`
   - Log → `FAILED`

---

### Environment Variables
- `GOOGLE_PLACES_API_KEY`
- `GODMODE_DISCOVERY_MODE` (`mock`, `live`)
- `GODMODE_MAX_RESULTS`

---

### Faz 2 Hazırlık Durumu
Faz 1 altyapısı, Faz 2 için tamamen hazır:
- Provider abstraction layer
- Parallel runner mimarisi
- Error normalization
- Worker hook sistemi
- Lead pipeline stabilization
- Tamamlanmış state machine

Faz 2 hedefleri:
- 5+ provider
- Confidence scoring
- Duplicate merging engine
- Provider health check
- Parallel batching

---

### Sonuç
GODMODE Faz 1 ile:
- Discovery motoru %100 stabil
- Üretim seviyesinde kullanılabilir
- Büyük ölçekli taramalar için hazır

Faz 2’de GODMODE, çok sağlayıcılı bir **Omni‑Data Discovery AI Engine** haline getirilecektir.

## `intel` Modülü
**Versiyon:** v1.3.0  
**Konum:** `src/modules/intel`  
**Durum:** Aktif – Çok katmanlı lead intelligence ve website analizi motoru  
**Son Güncelleme:** 2025-12-06

### Amaç
Intel modülü, bir firmanın **web sitesi + dijital varlığı** üzerinden toplanan sinyalleri, AI destekli bir şekilde işleyip:
- hızlı "ilk bakış" intel,
- detaylı website / marka analizi,
- teknik on‑page SEO sinyalleri
üreten **lead intelligence beyni**dir.

GODMODE / discovery tarafından bulunan lead’lerin, pazarlama ve satış açısından **ne kadar güçlü / hazır / profesyonel** olduklarını anlamak için kullanılır.

### Katmanlı Yapı (3 Seviye Intel)
INTEL.md’de tanımlandığı gibi modül üç ana seviyede çalışır:

1. **Basic Intel — Lead Search Intel Snapshot (v1.0)**  
   Hızlı tarama çıktısı; tek endpoint ile hızlı okunabilir özet üretir:
   - Kategori tespiti ve temel segment (ör. mimarlık ofisi, güzellik merkezi, ajans, vb.)
   - Web varlığı durumu (site var mı, aktif mi, çok eski mi?)
   - Dijital olgunluk seviyesi (zayıf / orta / güçlü)
   - Basit SWOT sinyalleri (güçlü yanlar, zayıflıklar, fırsatlar, tehditler)
   - Mesajlaşma–tasarım uyumu (kurumsal mı, karışık mı?)
   - Önerilen ilk temas açısı (fiyat odaklı mı, strateji odaklı mı, tasarım odaklı mı?)
   
   Bu seviye çıktıları **lead_search_intel** tablosuna “snapshot” olarak kaydedilir.

2. **Deep Website Intel — Lead Intelligence Report v1 (v1.1)**  
   Firma web sitesini ve dijital varlığını **sayfa sayfa** inceleyen derin analiz katmanı:
   - Ana sayfa, hizmet sayfaları, referanslar, blog vb. üzerinden full content taraması
   - Bilgi mimarisi (information architecture) değerlendirmesi
   - CTA yapısı (net mi, dağınık mı?)
   - Branding & görsel kalite değerlendirmesi
   - Güven sinyalleri (referans, sosyal kanıt, sertifikalar)
   - Riskler ve kaçırılan fırsatlar
   - Uzun formlu, AI üretimli **Lead Intelligence Report** metni
   
   Çıktılar **lead_intel_reports** benzeri rapor tablosuna yazılır (CORE_DB ile uyumlu).

3. **SEO Technical Intel — Onpage SEO v1 (v1.3.0)**  
   `seoOnpageService.js` ve `shared/seo/onpageAnalyzer.js` ile entegre çalışan teknik analiz katmanı:
   - Title / meta description / H1–H2 yapısı
   - URL yapısı ve slug kalitesi
   - İçerik yoğunluğu ve anahtar kelime sinyalleri
   - Temel teknik on‑page kontroller (indexlenebilirlik sinyalleri, temel yapısal hatalar)
   
   Bu katman, Basic/Deep Intel akışlarında otomatik olarak tetiklenebilir ve intel snapshot’larına gömülü olarak gelir.

---

### Teknik Yapı
- `controller.js`  
  - HTTP isteklerini alır, validasyon sonrası ilgili servis fonksiyonlarına yönlendirir.
- `routes.js`  
  - `/api/intel/*` endpoint’lerini tanımlar.
- `service.js`  
  - Basic Intel, Deep Website Intel ve SEO Technical Intel akışlarını koordine eder.
  - Web fetch, HTML parse, LLM çağrısı ve DB yazma adımlarını orkestre eder.
- `seoOnpageService.js`  
  - `shared/web/fetchWebsite.js` ve `shared/seo/onpageAnalyzer.js` ile birlikte teknik SEO analizini yapar.
- `repo.js`  
  - `lead_search_intel` ve `lead_intel_reports` tabloları ile çalışan veri erişim katmanıdır.
- `docs/INTEL.md`  
  - Tüm bu akışların detaylı tasarımını, örnek request/response’ları ve LLM prompt yapısını içerir.

---

### Endpointler (INTEL.md ile uyumlu)

- `POST /api/intel/analyze`
  - **Basic Intel + Onpage SEO baseline** üretir.
  - Beklenen payload (özet):
    - `url` (zorunlu)
    - `leadId` (opsiyonel – lead ile ilişkilendirme)
    - `context` / `notes` (opsiyonel iş bağlamı)
  - Çıktı:
    - Basic intel snapshot (kategori, olgunluk, kısa SWOT, önerilen yaklaşım)
    - Temel on‑page SEO sinyalleri
    - `lead_search_intel` kaydı (varsa güncelleme / yoksa insert)

- `POST /api/intel/deep-analyze`
  - **Deep Website Intel + AI Intelligence Report** üretir.
  - Daha ağır ve uzun süren bir işlemdir; tam website içeriği ve marka mesajı analiz edilir.
  - Çıktı:
    - Ayrıntılı lead intelligence raporu (uzun metin)
    - Öne çıkan güçlü/zayıf alanlar
    - Önerilen aksiyon listesi
    - İlgili rapor tablosuna kayıt (lead bazlı ilişkilendirme)

Gelecekte INTEL.md’de tanımlı ek endpointler (örneğin sadece SEO check, sadece classification vb.) aktif edildiğinde bu liste genişletilecektir.

---

### Diğer Modüllerle İlişki

| Modül | Etkileşim Tipi | Açıklama |
|-------|----------------|----------|
| **godmode / discovery** | Veri kaynağı | Bulunan lead’lerin domain/URL bilgisi intel analizine giriş olarak kullanılır. |
| **brain** | Sinyal sağlayıcı | Brain skorlaması için "website quality", "seo_strength", "brand_maturity" gibi sinyaller sağlar. |
| **research** | Tamamlayıcı | Araştırma modülünün daha geniş pazar/rakip analizleri ile birlikte yorumlanır. |
| **leadDashboard** | Görselleştirme | Lead detay ekranında intel snapshot’ları ve rapor özetlerini gösterir. |
| **crm** | Bağlam | CRM notları ve süreç bilgisi, intel raporları yorumlanırken LLM’e bağlam olarak verilebilir. |

---

### Derin Akış Senaryosu (Örnek)

**Senaryo – Yeni keşfedilen mimarlık ofisi için hızlı intel + rapor hazırlama**

1. GODMODE, İstanbul’daki bir mimarlık ofisini `potential_leads` tablosuna ekler ve lead’e ait web sitesi URL’sini kaydeder.
2. Kullanıcı veya otomatik job, `/api/intel/analyze` endpoint’ini `url` + `leadId` ile çağırır.
3. `intel/service.js`:
   - Siteyi indirir (`fetchWebsite`),
   - HTML’i parse eder,
   - On‑page SEO analizini çalıştırır,
   - LLM’e gönderilecek özet bağlamı hazırlar,
   - Basic Intel snapshot’ı ve kısa SWOT + öneri üretir,
   - Sonuçları `lead_search_intel` tablosuna yazar.
4. Lead satış açısından önemli görünüyorsa, `/api/intel/deep-analyze` ile derin analiz tetiklenir.
5. Deep rapor çıktısı:
   - `lead_intel_reports` tablosuna kaydedilir,
   - `brain` ve `leadDashboard` tarafından kullanılır.

Bu sayede CNG ekibi, bir firmayı aramadan önce o firma hakkında **gerçekten derin ve AI destekli bir resme** sahip olur.

## `leadDashboard` Modülü

**Versiyon:** v1.2.0  
**Konum:** `src/modules/leadDashboard`  
**Durum:** Aktif – tek endpoint üzerinden AI destekli, multi‑kaynak lead özetleri üretir  
**Son Güncelleme:** 2025-12-06  

### Amaç

`leadDashboard` modülü, CNG AI Agent içindeki tüm zekâ katmanlarını (GODMODE, Intel, Research/CIR, CRM Brain, Outreach) **tek bir JSON** içinde birleştiren **read‑model / orchestrator** katmanıdır.

Amaç:

- Frontend’in **tek API çağrısı** ile bir lead hakkında “her şeyi” görebilmesini sağlamak,
- Brain/LLM için **bağlam dostu (brain‑friendly)** bir JSON üretmek,
- Tüm alt modüllerin (discovery/godmode, intel, research, crm, outreach) verilerini **standart bir şemada** toplamak,
- Sadece “read” yapan, yazma işini diğer modüllere bırakan, **stabil ve cache’lenebilir bir sorgu katmanı** olmak.

Detaylı tasarım ve örnekler için: `src/modules/leadDashboard/docs/LEAD_DASHBOARD.md`.

---

### Sorumluluklar

`LEAD_DASHBOARD.md`’de tanımlandığı haliyle çekirdek sorumluluklar:

1. **Tek Endpointten Lead Özeti**
   - Bir lead hakkında:
     - Kaynak / segment bilgisi,
     - Intel + Research/CIR özetleri,
     - CRM Brain ve ilişki durumu,
     - Outreach geçmişi / AI önerileri
     tek JSON içinde döner.
   - “Üst seviye lead görünümü” için ana kaynak API’dir.

2. **Multi‑Kaynak Orkestrasyon**
   - Aşağıdaki modüllerden veri toplar:
     - **GODMODE / Discovery**  
       - Lead kaynak bilgisi, provider, kategori, rating vb.
     - **Intel**  
       - `lead_search_intel` + `lead_intel_reports` üzerinden:
         - website / SEO kalitesi,
         - dijital olgunluk,
         - teknik on‑page SEO sinyalleri.
     - **Research / CIR (CNG Intelligence Report)**  
       - `research` modülünden:
         - son CIR JSON’u (`cir_json`),
         - `priority_score`, `sales_notes`,
         - `social_presence`, `ad_intel`, `web_presence`, `benchmark` özetleri.
     - **CRM Brain**  
       - `crm` modülünden:
         - lead CRM beyni (`lead_brain_summary`),
         - `ai_score_band`, `risk_level`, `opportunities`, `next_actions` vb.
     - **Outreach**  
       - `outreach` + `email` + `whatsapp` modüllerinden:
         - son giden mesajlar,
         - open / reply metrikleri (uygulandığı ölçüde),
         - AI tabanlı ilk temas / sekans önerileri.
   - Tüm bu kaynaklardan gelen veriyi **tek, tutarlı bir şema** altında birleştirir.

3. **Read‑Model / Aggregation Katmanı**
   - Kendi başına yeni tablo yazmaz; ana sorumluluğu:
     - Diğer modüllerin tablolarından okuma yapmak,
     - Bu verileri frontend ve AI için anlamlı hâle getirmek.
   - Böylece:
     - DB şeması bozulmadan yeni görünüm / alan eklemek kolaylaşır,
     - Dashboard API’si UI ihtiyaçlarına göre evrimleşebilir.

4. **Brain‑Friendly JSON Üretimi**
   - Çıktı formatı LLM/Brain tarafından beslenmeye uygun olacak şekilde tasarlanmıştır:
     - Net bölümler,
     - Her bölümde “özet + detay” kombinasyonu,
     - Gereksiz gürültüden arındırılmış, ama bağlam açısından zengin alanlar.

---

### Teknik Yapı

- `controller.js`
  - HTTP isteklerini alır, parametreleri parse eder ve service katmanına yönlendirir.
- `routes.js`
  - `LEAD_DASHBOARD.md` ile uyumlu olarak şu endpoint’leri tanımlar:
    - `GET /api/leads`  
      - Basit lead listeleme (id, isim, domain, şehir, segment vb.)
    - `GET /api/leads/:leadId/ai-dashboard`  
      - Tek bir lead için AI dashboard JSON’u döner.
- `service.js`
  - Lead bazlı dashboard verisini oluşturur:
    - GODMODE/discovery repo fonksiyonları üzerinden lead kaynağını çeker,
    - Intel ve Research/CIR sonuçlarını toplar,
    - CRM beyni ve not özetlerini bağlar,
    - Outreach geçmişinden özet metrikler üretir,
    - Tümünü tek response objesi olarak birleştirir.
- `repo.js`
  - LeadDashboard’a özel okuma sorgularını içerir:
    - Lead + kaynak bilgisi,
    - İlgili intel / research / crm / outreach kayıtlarının join’lenmesi.
  - Yazma işlemleri yine ilgili modüllerin repo’ları üzerinden yapılır.

- `docs/LEAD_DASHBOARD.md`
  - Tam teknik tasarım,
  - Örnek response şemaları,
  - UI tarafının beklediği alanlar,
  - Brain/LLM kullanım senaryoları.

---

### Response Şeması (Özet)

`LEAD_DASHBOARD.md`’de tanımlanan AI dashboard response’u üst seviyede şu bölümlerden oluşur:

- `lead`  
  - Kimlik ve temel bilgiler:
    - `id`, `name`, `domain`, `segment`, `city`, `country`
    - `source_tags` (ör. `["godmode", "google_places", "mimarlık ofisi"]`)
    - rating / review özetleri (varsa)
- `intel`  
  - Website / SEO / dijital olgunluk özetleri:
    - `seo_score`, `website_quality`, `brand_maturity`
    - ana riskler ve fırsatlar
- `research`  
  - CIR’den gelen özet alanlar:
    - `priority_score`
    - kısa SWOT / fırsat / tehdit sinyalleri
    - sosyal / reklam / web varlığına dair highlight’lar
- `brain`  
  - Brain modülünden:
    - `ai_score`, `ai_score_band`
    - `opportunity_level`, `risk_level`
    - `lead_brain_summary` (headline, why_now, red_flags, next_actions vb.)
- `crm`  
  - CRM modülünden:
    - son not özetleri,
    - ilişki durumu (`status`: new/warm/hot/client/lost),
    - CRM Brain kısa özeti (varsa).
- `outreach`  
  - Email / WhatsApp / diğer kanallardan gelen:
    - son gönderim özetleri,
    - varsa cevap / open bilgileri,
    - planlanmış sekans bilgileri (ileriki fazlar için).
- `meta`  
  - Dashboard versiyonu,
  - Kullanılan veri kaynakları listesi,
  - Üretilme zamanı gibi teknik metaveriler.

Bu şema sayesinde frontend, tek bir endpoint ile hem UI hem de AI kullanım senaryoları için yeterli bağlama sahip olur.

---

### Diğer Modüllerle İlişki

| Modül            | Rolü                                | Açıklama                                                                 |
|------------------|-------------------------------------|--------------------------------------------------------------------------|
| `godmode`        | Lead kaynağı                        | Job ve provider bazlı discovery sonuçlarını lead seviyesinde özetler.    |
| `discovery`      | Alternatif/simple discovery kaynağı | Legacy/standalone discovery çıktıları varsa bunları da okuyabilir.       |
| `intel`          | Website/SEO zekâ kaynağı            | Basic ve Deep Intel çıktıları, dashboard’ın intel bölümünü besler.       |
| `research` (CIR) | Derin pazar / rakip zekâsı          | CIR JSON + puanlar, dashboard’ın stratejik analiz kısmını oluşturur.     |
| `brain`          | AI lead beyni                       | Lead AI skoru ve stratejik özetler, dashboard’un “beyin” katmanını kurar.|
| `crm`            | İlişki geçmişi / CRM Brain          | Notlar, süreç, CRM Brain özetleri dashboard’un ilişki kısmını besler.    |
| `outreach`       | Mesaj & kampanya geçmişi            | İlk temas mesajları, sekanslar ve cevaplar outreach alanına yansır.      |
| `email`/`whatsapp` | Kanal seviyesinde log             | Gönderim log’ları outreach/CRM/leadDashboard kombinasyonunda görünür.    |
| `admin`          | Health ve raporlama                 | İleride dashboard performans metrikleri admin üzerinden izlenebilir.     |

---

### Kullanım Senaryosu (Özet)

**Senaryo – Satış ekibinin bir lead’e bakarken “her şeyi tek ekranda görmesi”**

1. UI, lead detay sayfasını açarken `GET /api/leads/:leadId/ai-dashboard` çağrısını yapar.
2. `leadDashboard.controller` isteği alır, `leadDashboardService` fonksiyonunu tetikler.
3. Service:
   - GODMODE/discovery üzerinden lead kaynağını ve temel meta veriyi çeker,
   - Intel + Research/CIR sonuçlarını toparlar,
   - Brain, CRM ve Outreach modüllerinden gerekli özetleri alır,
   - Bunları yukarıda anlatılan `lead/intel/research/brain/crm/outreach/meta` şemasında birleştirir.
4. UI bu JSON’u:
   - Kartlar,
   - Sekmeler,
   - Timeline ve KPI bileşenleri halinde görselleştirir.
5. Aynı JSON, gerekirse Brain veya başka AI katmanları için de doğrudan kullanılabilir.

LeadDashboard böylece, CNG AI Agent ekosisteminde **“tek bakışta her şey”** deneyimini sağlayan kritik okuma modülü hâline gelir.

## `outreach` Modülü
**Versiyon:** v2.1.0  
**Konum:** `src/modules/outreach`  
**Durum:** Stable — Production Ready  
**Son Güncelleme:** 2025-12-06

### Amaç
Outreach modülü, CNG Medya’nın satış pipeline’ındaki ilk iletişim ve takip süreçlerini otomatikleştiren iletişim motorudur.

Görevleri:
- WhatsApp / Email / Instagram DM için **ilk temas mesajı (v1)** oluşturmak
- Lead + Intel verilerini işleyerek **çok adımlı outreach sequence (v2)** üretmek
- Tonlama / dil / kanal uyumunu sağlayarak premium ve sektöre uygun iletişim tasarlamak

### Sorumluluklar
#### ✔ v1 — İlk Temas Motoru
- Tek seferlik ilk mesaj üretimi
- Kanal: whatsapp / email / instagram_dm
- Ton: premium / kurumsal / samimi
- Dil: tr / en
- Prompt: `first_contact_message.md`

#### ✔ v2 — Multi-Step Sequence Motoru
- Lead ID bazlı, çok adımlı AI outreach sekansı üretir
- Kullanılan parametreler:
  - channel
  - tone
  - language
  - objective
  - max_followups
- INTEL modülünden gelen SWOT + digital_status + priority_score entegre edilir
- Prompt: `outreach_sequence_v2.md` (Universal Voice Edition)

### Teknik Yapı
modules/outreach/
- `controller.js`
- `service.js`
- `repo.js`
- `first_contact_message.md`
- `outreach_sequence_v2.md`
- `docs/OUTREACH.md`
- `docs/CHANGELOG.md`

### API Endpoints
| Method | Endpoint | Version | Açıklama |
|--------|----------|---------|----------|
| POST | `/api/outreach/first-contact` | v1.x | Tek seferlik ilk temas mesajı üretir |
| POST | `/api/outreach/sequence/:leadId` | v2.x | Çok adımlı AI outreach sekansı üretir |

### Veri Akışı
#### v1 — First Contact Flow
Client → Controller → Service.generateFirstContact() → promptLoader → llmClient → JSON output

#### v2 — Multi-Step Sequence Flow
Client → Controller → Service.generateSequenceForLead() → repo.getLeadById() → intel.analyzeLead() → promptLoader → llmClient → ai_context + sequence[]

### AI Prompts
- **first_contact_message.md** — kısa premium v1 mesaj motoru
- **outreach_sequence_v2.md** — Universal Voice Edition, strict JSON, çok adımlı sekans motoru

### Output Format
**ai_context:**
```
{
  "ai_score_band": "A",
  "priority_score": 75,
  "why_now": "string",
  "risk_level": "medium",
  "ideal_entry_channel": "whatsapp"
}
```
**sequence[]:**
```
{
  "step": 1,
  "type": "initial",
  "send_after_hours": 0,
  "subject": null,
  "message": "string"
}
```

### Dependencies
- shared/ai/llmClient.js
- shared/ai/promptLoader.js
- modules/intel/service.js → analyzeLead()
- core/db.js

### Future Improvements
- Sector Packs (industry-specific bundles)
- Follow-up scheduling (jobs/)
- WhatsApp Cloud API entegrasyonu
- UI dashboard sequence embed
- Sequence archive sistemi

### Versioning
Detaylar: `CHANGELOG.md`

## `outreachScheduler` Modülü  
**Versiyon:** v0.1.0  
**Konum:** `src/modules/outreachScheduler`  
**Durum:** Temel — Sequence üretiyor fakat gerçek zamanlama/cron/queue henüz yok  
**Son Güncelleme:** 2025-12-06  

### Amaç  
Outreach Scheduler modülü, CNG AI Agent’in **“Yapay Satış Otomasyonu”** için temel zamanlama ve sekans yönetim katmanıdır.  
Şu anki sürümde gerçek zamanlama/cron sistemi bulunmaz; ana görevi outreach modülünde üretilen AI sekanslarını sarmalamak ve gelecekte queue sistemi için altyapı oluşturmaktır.

---

### Sorumluluklar  

#### ✔ 1. Sequence Generation Wrapper  
Outreach modülündeki `generateOutreachSequenceForLead` fonksiyonunu çağırarak lead bazlı AI sekansı üretir.  
Parametreler:  
- `leadId`  
- `channel` (whatsapp / email)  
- `tone` (premium / kurumsal / samimi…)  
- `language` (tr / en)  
- `objective` (örn: ilk_temas)  
- `max_followups` (örn: 2)

#### ✔ 2. Enqueue Interface (Future-Proof)  
Modülün API tasarımı, ileride:  
- `outreach_jobs` veya `outreach_queue` DB tabloları  
- worker / cron / scheduler altyapısı  
- otomatik mesaj gönderimi  
ile entegre olabilecek şekilde hazırlanmıştır.

---

### Teknik Yapı  

```
src/modules/outreachScheduler
  ├── api
  │   ├── controller.js
  │   └── routes.js
  ├── service.js
  ├── repo.js
  └── docs
      ├── OUTREACH_SCHEDULER.md
      └── CHANGELOG.md
```

---

### API ve Veri Akışı  

#### Endpoint  
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| **POST** | `/api/outreach-scheduler/enqueue/:leadId` | Lead için outreach sequence oluşturur |

#### Flow  
Client  
→ controller.enqueueOutreachSequenceHandler  
→ outreachSchedulerService.enqueueSequenceForLead  
→ outreachService.generateOutreachSequenceForLead  
→ (Gelecek sürümlerde) repo.saveSequenceJob  
→ JSON output  

#### Request Body (örnek)  
```
{
  "channel": "whatsapp",
  "tone": "kurumsal",
  "language": "tr",
  "objective": "ilk_temas",
  "max_followups": 2
}
```

#### Response (örnek, kısaltılmış)  
```
{
  "ok": true,
  "data": {
    "lead_id": 139,
    "channel": "whatsapp",
    "tone": "kurumsal",
    "language": "tr",
    "objective": "ilk_temas",
    "ai_context": {
      "ai_score_band": "A",
      "priority_score": 70,
      "why_now": "…",
      "risk_level": "medium",
      "ideal_entry_channel": "whatsapp"
    },
    "sequence": [
      {
        "step": 1,
        "type": "initial",
        "send_after_hours": 0,
        "message": "Merhaba…"
      },
      {
        "step": 2,
        "type": "follow_up",
        "send_after_hours": 48,
        "message": "İyi günler…"
      }
    ]
  }
}
```

---

### Dependencies  
- `modules/outreach/service.js` → `generateOutreachSequenceForLead`  
- İleride:  
  - `modules/whatsapp`  
  - `modules/email`  
  - gerçek scheduler / worker sistemi  

---

### Known Limitations (v0.1.0)  
- Gerçek cron/queue sistemi yok  
- DB’de job kayıtları henüz tutulmuyor  
- Gönderim işlemleri yapılmıyor  
- Endpoint auth’suz (public)  
- Multichannel paralel gönderim yok  

---

### Future Improvements  
- `outreach_jobs` tablosu  
- Worker / cron / retry mekanizması  
- WhatsApp & Email modülleri ile gerçek entegrasyon  
- Admin panel job görünümü (cancel / reschedule)  
- Lead history’e “planned outreach” loglama  

---

### Versioning  
Detaylar: `OUTREACH_SCHEDULER.md`

## `research` Modülü
**Versiyon:** v1.4.0  
**Konum:** `src/modules/research`  
**Durum:** Aktif — CNG Intelligence Report (CIR) motoru  
**Son Güncelleme:** 2025-12-06

### Amaç
Research modülü, tek bir lead için farklı kaynaklardan gelen tüm istihbaratı birleştirip **CNG Intelligence Report (CIR)** üretir.  
CIR, satış ekibinin bir firmayı birkaç saniyede anlayabilmesini sağlayan, sektör bağımsız, tamamen normalize edilmiş bir istihbarat raporudur.

Modülün görevi:  
- intel_basic  
- intel_deep  
- web search (OSINT)  
- social presence v2.0  
- ad_intel  
- competitors  
- benchmark  

gibi farklı kaynaklardan gelen verileri toplayıp **tek birleşik standart formatta** CIR üretmek ve bunu lead’e bağlı olarak saklamaktır.

---

### Sorumluluklar (Updated v1.4.0)
- Lead bazlı tam araştırma pipeline’ını çalıştırmak  
- Tüm modüllerden gelen sinyalleri toplamak:
  - `intel_basic`
  - `intel_deep`
  - `web_presence`
  - `social_presence v2.0` (HTML, OSINT, multi-platform normalizasyon)
  - `ad_intel`
  - `competitors`
  - `benchmark`
- CIR Output Standardization Engine ile tüm veriyi normalize etmek:
  - Sektör bağımsız format
  - Ortak alanlar: `swot`, `digital_status`, `seo`, `agency_opportunities`, `recommended_services`
  - Model hiçbir sektöre özel davranamaz — yalnızca lead’in verisine göre çalışır
- CIR sonucunu `lead_intel_reports` tablosuna kaydetmek
- CIR geçmişini (score + timestamp) sağlamak

---

### Public API (Updated)

#### **POST /api/research/full-report**
Çalıştırır:
- CIR pipeline  
- Normalize edilmiş CIR üretimi  
- DB’ye rapor kaydı  

Response örneği:
```
{
  "ok": true,
  "data": {
    "leadId": 139,
    "leadName": "Firma",
    "cir": { ... },
    "raw": { ... }
  }
}
```

#### **GET /api/research/latest/:leadId**
Lead’in en son CIR raporunu döner.

#### **GET /api/research/all/:leadId**
Lead’e ait tüm CIR raporlarını döner.

#### **GET /api/research/history/:leadId**
Skor + timestamp geçmişini döner:
```
[
  { "id": 4, "leadId": 139, "created_at": "...", "score": 75 }
]
```

---

### Alt Modüller (Updated)

#### **intel_basic**
- `analyzeLead({ leadId })`
- Çıktılar:
  - SWOT
  - digital_status
  - sales_notes
  - fırsatlar (kısa/uzun vade)
  - priority_score

#### **intel_deep**
- `analyzeLeadDeep({ leadId })`
- Sadece web sitesi varsa çalışır
- Derin website + SEO + strategic quick wins analizi

#### **Web Search (OSINT)**
- `runWebSearch(lead)`
- Sonuç kategorileri:
  - directories  
  - news mentions  
  - blog mentions  
  - third‑party profiles  
  - risk flags  

#### **Social Presence v2.0 (NEW)**
- Platform taraması:
  - instagram, facebook, linkedin, youtube, tiktok  
  - twitter/x, behance, dribbble, pinterest  
- Kaynaklar:
  - website HTML
  - OSINT
- activity_score: 0 / 20 / 40 / 60 / 80 / 100

#### **Ads Intelligence**
- Pixel + analytics sinyalleri
- active_ads
- google_analytics_detected
- pixel_detected

#### **Competitors**
- Şehir + kategori bazlı rakip çıkarımı
- 0–100 arası rakip güç skorları

#### **Benchmark**
- Pazar ortalaması + lead’in konumu
- benchmark_score
- strengths_vs_market
- weaknesses_vs_market

---

### CIR Output Standardization Engine (NEW v1.4.0)

CIR artık tamamen **sektör bağımsız**, güvenli ve normalize edilmiş bir JSON formatına sahip.

Standart alanlar:
- `swot`
- `digital_status`
- `website_evaluation`
- `seo`
- `social_presence`
- `ad_intel`
- `competitors`
- `benchmark`
- `agency_opportunities`
- `recommended_services`
- `priority_score`
- `notes_for_sales`

Kurallar:
- ❗ Sektöre özel ifadeler üretilmez  
- ❗ Tüm değerlendirme yalnızca lead’in kendi verisine göre yapılır  
- ❗ Model sektörlere öncelik veremez  

Bu motor `researchService.js` içinde LLM yanıtını normalize eder.

---

### Diğer Modüllerle Etkileşim

| Modül | Açıklama |
|-------|----------|
| **intel** | Basic + Deep intel verilerini sağlar |
| **brain** | CIR skorunu lead değerlendirmesinde kullanır |
| **crm** | CIR özetleri CRM kartında görünür |
| **leadDashboard** | CIR raporunun özetini UI’a sunar |
| **godmode** | Lead kaynağı |

---

### Derin Senaryo Örneği

**Senaryo — Yeni müşteri için derin marka analizi**

1. `/api/research/full-report` çağrılır.  
2. Pipeline:
   - intel_basic  
   - intel_deep  
   - web search  
   - social_presence v2.0  
   - competitors  
   - benchmark  
3. `CIR Output Standardization Engine` çalışır.  
4. Rapor:
   - Lead hakkındaki tüm sinyalleri  
   - SWOT  
   - SEO  
   - website evaluation  
   - social presence  
   - risk & fırsatlar  
   - recommended services  
   olarak normalize eder.  
5. Sonuç DB’ye yazılır ve LeadDashboard’a açılır.

---

### Roadmap (Research)

- [x] CIR Pipeline v1.4.0  
- [x] Social Presence v2.0  
- [x] Benchmark Engine  
- [x] Competitor Engine  
- [ ] Ads real‑time crawler  
- [ ] Sector Packs (premium industry models)  
- [ ] Multi-brand comparison mode  

---

## `whatsapp` Modülü
**Versiyon:** v0.1.0  
**Konum:** `src/modules/whatsapp`  
**Durum:** Temel – Cloud API entegrasyonu yok, sadece log sistemi  
**Son Güncelleme:** 2025-12-06

### Amaç
WhatsApp modülü, ilerleyen sürümlerde WhatsApp Cloud API ile entegre olacak iletişim katmanının çekirdeğidir.  
Şu anki rolü tamamen altyapı hazırlamaya yöneliktir:

- WhatsApp mesaj gönderimi **simülasyonu**
- DB’ye WhatsApp mesaj log’u yazmak
- Outreach / OutreachScheduler modüllerinin ileri fazdaki entegrasyonuna temel oluşturmak

Bu sürümde **gerçek WhatsApp API çağrısı yoktur**.

---

### Sorumluluklar

#### ✔ WhatsApp Mesaj Loglama
Gönderim denemeleri `whatsapp_logs` tablosuna kaydedilir.

Alanlar:
- `lead_id` (opsiyonel)
- `phone`
- `message`
- `status` (örn: `"pending"`, `"simulated"`)
- `meta` (JSON string)
- `created_at`

#### ✔ Test Endpoint
Modülün doğru şekilde:
- controller
- service
- repo
- DB tablosu

entegre olup olmadığını test etmek için kullanılır.

Gerçek gönderim YOK → yalnızca **simüle edilmiş işlem + log kaydı**.

---

### Teknik Yapı

```
src/modules/whatsapp
  ├── api
  │   ├── controller.js
  │   └── routes.js
  ├── repo.js
  ├── service.js
  └── docs
      ├── WHATSAPP.md
      └── CHANGELOG.md
```

- `controller.js`  
  - `sendTestWhatsappHandler` fonksiyonu → test amaçlı log kaydı
- `service.js`  
  - `sendTestMessage()` → WhatsApp mesajını simüle eder, repo’ya log yazdırır
- `repo.js`  
  - `logWhatsapp()` → `whatsapp_logs` tablosuna insert
- `docs/WHATSAPP.md`  
  - Teknik tasarım, veri modeli ve kullanım örnekleri

---

### API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| **POST** | `/api/whatsapp/test` | Test amaçlı WhatsApp mesaj log’u oluşturur |

#### Örnek Response
```
{
  "ok": true,
  "data": {
    "ok": true,
    "id": 1,
    "note": "WhatsApp module v0.1.0 — Cloud API entegrasyonu henüz yok, sadece log kaydı."
  }
}
```

---

### Data Flow

Client  
→ `POST /api/whatsapp/test`  
→ controller (`sendTestWhatsappHandler`)  
→ service (`sendTestMessage`)  
→ repo (`logWhatsapp`)  
→ SQLite (`whatsapp_logs` tablosu)  
→ JSON response  

---

### Database — `whatsapp_logs`

Alanlar (v0.1.0):

- `id` — INTEGER PRIMARY KEY AUTOINCREMENT  
- `lead_id` — INTEGER (nullable)  
- `phone` — TEXT  
- `message` — TEXT  
- `status` — TEXT (`"simulated"`)  
- `meta` — TEXT (JSON)  
- `created_at` — TEXT (ISO)

Tablo lazy-initialize edilir (CREATE TABLE IF NOT EXISTS).

---

### Known Limitations (v0.1.0)

- ❌ Gerçek WhatsApp Cloud API entegrasyonu yok  
- ❌ Rate limit / queue / retry mekanizması yok  
- ❌ Auth kontrolü yok → `/api/whatsapp/test` public  
- ❌ Delivery / read receipts takibi yok  
- ❌ Mesaj şablon sistemi yok  

---

### Future Improvements

- ✔ WhatsApp Cloud API gerçek entegrasyonu  
- ✔ Şablon sistemi (Outreach Sequence entegrasyonu)  
- ✔ Gönderim & okunma durum takibi  
- ✔ Admin panelden log görüntüleme / filtreleme  
- ✔ Queue + Retry + Rate limit altyapısı  

---

### Versioning
Detaylar: `src/modules/whatsapp/docs/CHANGELOG.md`

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
3. Gerekirse bu dosyada yeni bir başlık açılarak kısa özet eklenmelidir.


---

## Derinlemesine Örnek Senaryolar

Bu bölüm, backend-v2 içindeki **güncel modül mimarisine** göre uçtan uca çalışan iş akışlarını modernize eder.  
Amaç: Yeni gelen bir geliştirici veya ürün yöneticisi, gerçek iş süreçlerinin backend’de hangi modüller tarafından nasıl yürütüldüğünü tek bakışta anlayabilsin.

---

# 🟦 Senaryo 1 — Yeni Pazar Tarama → Derin Intel → CIR → Brain → Outreach → CRM → LeadDashboard
**Amaç:** İstanbul mimarlık ofisleri için yeni müşteri edinme sürecini otomatik yürütmek.

### 1) GODMODE ile Discovery (Faz 1 – v1.0.0-live)
- `/api/godmode/jobs/discovery-scan`
- Job oluşturulur → `queued`
- Çalıştırma (`/run`) → `running`
- Google Places provider çalışır
- Normalize lead’ler → `potential_leads` tablosuna UPSERT edilir
- Event logs: `QUEUED` → `RUN_START` → `PROVIDER_PAGE` → `COMPLETED`

**Sonuç:** Tekilleştirilmiş, normalize edilmiş lead havuzu oluştu.

---

### 2) Intel Basic + SEO On-Page Tarama (v1.3.0)
Lead seçildi →  
`POST /api/intel/analyze`  
- Website HTML çekilir  
- Basic intel üretimi  
- On‑Page SEO sinyalleri  
- SWOT + digital_status + priority_score  
- Kayıt: `lead_search_intel`

**Sonuç:** Lead’in dijital olgunluğu ve temel SWOT hazır.

---

### 3) Intel Deep Website Analysis (v1.3.0)
`POST /api/intel/deep-analyze`
- Tüm site yapısı incelenir
- Branding, CTA, IA, mesaj analizi
- SEO derin tarama
- Kayıt: `lead_intel_reports`

**Sonuç:** Lead için tam website raporu hazır.

---

### 4) Research v1.4.0 — CNG Intelligence Report (CIR)
`POST /api/research/full-report`
- intel_basic
- intel_deep
- web_search (OSINT)
- social_presence v2.0
- competitors
- benchmark
- Ads intel (pixel/analytics)

CIR Output Standardization Engine devreye girer → sektör bağımsız normalize rapor.

Kayıt: `lead_intel_reports` (CIR türü)

**Sonuç:** Tek formatta birleşik istihbarat raporu.

---

### 5) Brain — Lead AI Brain Snapshot (v1.0)
`GET /api/brain/lead/:id`
- GODMODE sinyalleri
- Intel sinyalleri
- CIR sonuçları
- CRM notları
- Outreach geçmişi

LLM üzerinden:
- AI Score
- Opportunity level
- Risk level
- Key signals
- Strategy summary

Kayıt: `lead_brain_snapshots`

**Sonuç:** Lead’in tam yapay zekâ değerlendirmesi hazır.

---

### 6) Outreach Sequence (v2.1.0)
`POST /api/outreach/sequence/:leadId`
- Kanal: whatsapp/email
- Tone: premium/kurumsal/samimi
- objective
- max_followups
- INTEL + CIR + Brain sinyalleri kullanılır

**Sonuç:** Çok adımlı AI outreach sekansı üretilir.

---

### 7) Outreach Scheduler (v0.1.0)
`POST /api/outreach-scheduler/enqueue/:leadId`
- Sequence sarılır
- Gelecekte queue/cron için hazır API yapısı

**Sonuç:** Sequence planlama API’si (future-proof).

---

### 8) CRM — Lead Relationship Management (v1.1.0)
- Notlar → `lead_crm_notes`
- Status → new/warm/hot/client/lost
- CRM Brain Summary → `lead_crm_brains`

**Sonuç:** Lead’in ilişki geçmişi + AI CRM özetleri hazır.

---

### 9) LeadDashboard v1.2.0 — Tek Endpointte Tüm Özet
`GET /api/leads/:leadId/ai-dashboard`

Toplanan tüm modül çıktıları tek JSON’da birleşir:
- lead
- intel
- research (CIR)
- brain
- crm
- outreach
- meta

**Sonuç:** Satış ekibinin ihtiyaç duyduğu tüm bilgi tek API çağrısında.

---

# 🟩 Senaryo 2 — Mevcut Müşteri için Derin Marka Analizi (Intel + CIR + Brain)
1. Müşteri seçilir → website + sosyal profiller biliniyor.  
2. Intel Analyze → Basic Intel + SEO teknik analiz  
3. Intel Deep → tam site içeriği + IA + CTA + branding  
4. Research Full Report → derin OSINT + rakip + benchmark + social presence v2.0  
5. Brain → AI Score + fırsat/tehdit seviyesi + stratejik özet  
6. CRM → analiz notları + CRM Brain  
7. LeadDashboard → tek ekranda marka durumu

**Sonuç:** Müşteri için tam kapsamlı stratejik analiz.

---

# 🟧 Senaryo 3 — Admin Panel Üzerinden Sistem Sağlığı İzleme
1. `/api/admin/status`  
2. `/api/admin/modules`  
3. `/api/admin/overview`

AdminService:
- GODMODE job istatistikleri
- Discovery lead sayıları
- Outreach test logları (email/whatsapp)
- DB health snapshot

**Sonuç:** Sistem yöneticisi backend’in tüm durumunu tek ekrandan izler.

---

# 🟨 Senaryo 4 — Discovery Modülü ile Hızlı Fırsat Listesi
Discovery (eski hafif tarama motoru):
1. `/api/discovery/search`
2. Normalize leads → opsiyonel DB log
3. AI Ranker → skor üretimi
4. LeadDashboard → hafif hızlı görünüm

**Sonuç:** GODMODE’a gerek olmadan çok hızlı discovery + skor listesi.

---

# 🟪 Senaryo 5 — Tam Otomatik Outreach (Future Scenario)
Faz 2–3 entegrasyonuyla:
- GODMODE → sürekli tarama
- Intel → otomatik basic intel
- Research → otomatik CIR
- Brain → AI score tetikleyici
- OutreachScheduler → job queue + cron
- WhatsApp/Email → gerçek API gönderimleri

**Sonuç:** CNG AI Agent tam otomatik müşteri edinme makinesine dönüşür.
