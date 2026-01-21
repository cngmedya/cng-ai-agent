# CNG AI Agent — Backend V2 ZEROPOINT

Bu dosya, **CNG AI Agent Backend V2** için **üst seviye beyin haritası ve SIFIR NOKTASI**dır.
Sistem şu an için **sadece CNG Medya** bünyesinde kullanılmak üzere tasarlanmıştır.
İlerleyen fazlarda, bu altyapı kurumsal müşterilere ve farklı sektörlere uyarlanabilen
**çok kiracılı (multi-tenant) bir AI Agent platformuna** dönüştürülecektir.

ZEROPOINT, diğer dokümanlarla birlikte çalışır:

- `docs/ARCHITECTURE.md` → Teknik mimari, katmanlar, core yapılar
- `docs/MODULES.md` → Modül bazlı derin inceleme (hangi modül ne iş yapıyor?)
- `docs/ROADMAP.md` → Projenin genel yol haritası, fazlar, öncelikler, anlık durum
- `src/modules/**/docs/*.md` → Her modülün kendi domain dokümanı

Bu dosyanın amacı:

1. Sistemin **genel mantığını**, **başlangıç hedefini** ve **scope’unu** özetlemek
2. Ana **iş akışını** ve **modüller arası ilişkiyi** tek bakışta göstermek
3. “Şu anki durum”u (2025-12-23 itibarıyla) kayda geçirmek
4. Gelecekteki sohbetlerde **“süper hafıza giriş noktası (ZeroPoint)”** olarak kullanılmak

---

## 0.1 Son Güncelleme — 2025-12-23 (Yeni Sohbete Devir Notu)

Bu bölüm, son geliştirme oturumunda yapılan kritik değişiklikleri **kayıt altına almak** ve yeni sohbete geçtiğimizde **hafıza kaybı yaşamadan** devam edebilmek için eklenmiştir.

### 0.1.1 Bu oturumda dokunulan modüller

- **godmode** (ana odak): discovery job akışı, provider runner, enrichment tetikleme, job log/summary doğrulamaları
- **research**: CIR (full report) tarafındaki kırmızı hataların giderilmesi ve smoke test stabilizasyonu
- **outreach**: CIR sonrası akışta kırmızıya düşen senaryoların toparlanması (smoke test uyumu)
- **core/app**: `app.js` route mount ve genel başlatma/smoke test akışında kırılgan noktaların kapatılması

### 0.1.2 Operasyonel doğrular (kanıtlanmış)

- **Servis portu:** `4000` (lokal geliştirme standardı)
- **Smoke test standardı:** `./scripts/smoke_test.sh` 
- **DB canonical yolları:** `data/app.sqlite` ve `data/crm.sqlite`
- `.env` değişkenleri terminale **export edilmeden** çalıştırıldığında `MISSING` görülebilir; standart kullanım `.env` + `npm start` üzerinden doğrulanır.

### 0.1.3 Godmode — Faz 2 ilerleme özeti

- Discovery job create/run akışı stabil doğrulandı.
- Provider katmanında canlı testlerde **rate-limit riski** nedeniyle 429 kovalamak yerine kontrollü yaklaşım benimsendi.
- Deep enrichment tetikleme/consumer çağırma tarafı için izlenebilirlik (logs) güçlendirildi.
- Job log ve job progress kontrolleri ile "stuck" senaryolarının teşhisi standardize edildi.

### 0.1.4 Research (CIR) — stabilizasyon notu

- CIR full report kırmızıya düşüren sorunlar giderildi; smoke testte **yeşil** hedeflendi.
- CIR ile ilgili DB/migration tarafında isimlendirme ve yol uyumsuzluklarına karşı troubleshooting yaklaşımı netleştirildi.

### 0.1.5 Yeni sohbetten devam edeceğimiz yer

- **Godmode Roadmap:** Faz 2 içinde bir sonraki adım **2.b.6.2**
- Devam etmeden önce yapılacaklar:
  - `./scripts/smoke_test.sh` → **yeşil**
  - Ardından `src/modules/godmode/docs/GODMODE_ROADMAP.md` üzerinden kaldığımız adımı doğrula

---

## 1. Ürün Vizyonu ve Genel Mantık

**CNG AI Agent Backend V2**, Arcves / CNG Medya için tasarlanmış,
**AI destekli B2B lead & intelligence platformu**dur.

Temel vizyon:

- Doğru şirketleri ve kişileri otomatik keşfetmek (discovery / GODMODE)
- Bu şirketler hakkında **derin zeka** üretmek (intel + research)
- Tüm bilgiyi tek bir “lead beyni”nde toplayıp skorlamak (brain + crm)
- Doğru zamanda, doğru kanaldan, doğru mesajla ulaşmak (outreach + email + whatsapp + outreachScheduler)
- Tüm süreci tek bir panelden izlenebilir hale getirmek (leadDashboard + admin)

**Kısaca:**
> “Dış dünyadan veri toplayan, bunu anlamlı hale getiren ve satış aksiyonuna dönüştüren, uçtan uca otomatik bir AJANS BEYNİ.”

---

## 2. Ana İş Akışı (Core Loop)

Sistemin ana akışı, tek cümlede şöyle:

> **Discover → Understand → Decide → Reach Out → Learn & Update**

Bunu adım adım modüllerle açarsak:

1. **Discover (Keşfet)**
   - Modüller: `godmode`, `discovery`
   - GODMODE, Google Places (ve ileride diğer provider’lar) üzerinden şirketleri bulur.
   - Sonuçlar normalize edilip `potential_leads` ve ilgili tablolara yazılır.
   - Dedup mekanizması ile aynı şirketi tekrar tekrar listeye eklememeye çalışır.

2. **Understand (Anla / Intel)**
   - Modüller: `intel`, `research`
   - `intel`: Website / SEO / on-page sinyallerini toplar.
   - `research`: Rakipler, reklamlar, sosyal medya, sektör pozisyonu gibi derin analizler üretir.
   - Çıktı: Her lead için “dış dünya zeka paketi”.

3. **Decide (Karar Ver / Brain)**
   - Modüller: `brain`, `crm`
   - `brain`:
     - Lead AI Score, fırsat / risk skorları, segmentler üretir.
   - `crm`:
     - Notlar, görüşme geçmişi, CRM brain özetleri.
   - Çıktı: “Bu lead ne kadar değerli, ne yapmalıyız?” sorusunun cevabı.

4. **Reach Out (Ulaş / Outreach)**
   - Modüller: `outreach`, `email`, `whatsapp`, `outreachScheduler`
   - `outreach`: İçerik ve strateji (ilk mesaj, ton, pitch).
   - `email` / `whatsapp`: Teknik gönderim, loglama.
   - `outreachScheduler`: Zamanlama ve otomasyon (sekanslar, tetikleyiciler).

5. **Learn & Update (Öğren / Güncelle)**
   - Modüller: `crm`, `leadDashboard`, `admin`
   - Gelen yanıtlar, yeni bilgiler, skor değişimleri:
     - CRM notlarına girilir,
     - Brain yeniden hesaplayabilir,
     - LeadDashboard tüm resmi güncel gösterir,
     - Admin modülü sistem düzeyinde metrikleri sunar.

Bu döngü tekrarlandıkça sistem:

- Hangi kaynakların daha iyi lead getirdiğini,
- Hangi mesajların daha iyi çalıştığını,
- Hangi segmentlerin daha değerli olduğunu

daha iyi öğrenir ve “CNG AI Agent” gerçekten bir ajans beyni gibi davranmaya başlar.

---

## 3. Ana Bileşenler (Kısa Özet)

Detaylar `docs/MODULES.md` içinde var; burada sadece **yüksek seviye harita**:

- **Core Katman (`src/core`, `src/shared`, `src/prompts`)**
  - Config, DB, HTTP, logger, middleware, LLM client, SEO analyzer, web fetcher
  - Tüm modüller bu çekirdek üstünde koşar.

- **Kimlik & Yönetim**
  - `auth` → Login, token, kullanıcı güvenliği
  - `admin` → Sistem istatistikleri, dashboard verileri

- **Discovery / GODMODE**
  - `discovery` → Legacy / basit discovery + AI ranker
  - `godmode` → Faz bazlı gelişen, multi-provider discovery engine
    - Job management, job logs, provider runner, potential_leads pipeline

- **Intelligence & Research**
  - `intel` → Website / SEO / on-page intel
  - `research` → Rakipler, pazar, reklamlar, sosyal medya; derin AI raporları

- **Brain & CRM**
  - `brain` → Skorlar, kararlar, lead beyni
  - `crm` → Notlar, ilişkiler, CRM brain özetleri

- **Outreach & İletişim**
  - `outreach` → Strateji ve içerik üretimi
  - `email` → Email gönderimi, loglama
  - `whatsapp` → WhatsApp entegrasyonu
  - `outreachScheduler` → Zamanlama ve otomasyon

- **Görüntüleme / UI Besleyiciler**
  - `leadDashboard` → Lead merkezli birleşik görünüm
  - `admin` → Sistem seviyesi görünüm

- **Diğer**
  - `_template` → Yeni modüller için şablon
  - `xyz` → Playground / PoC alanı

---

## 3.1 Modüller Arası Veri Kontratları (System Contract Map)

Bu bölüm, **modüller arası sınırları netleştirmek**, GODMODE’un şişmesini önlemek ve
her modülün **tek sorumluluk prensibi** ile çalışmasını garanti altına almak için eklenmiştir.

Amaç:
- “Bu veri nerede üretilir?”
- “Kim tüketir?”
- “Kim icra eder, kim sadece karar üretir?”
sorularını **tek bakışta** cevaplamak.

---

### Ortak Çekirdek Kavramlar

#### Lead (Tekil Gerçek)
Sistemdeki **tek merkezli varlık**tır.

- `lead_id` → tüm modüller arası bağlayıcı anahtar
- Discovery / GODMODE yalnızca **lead üretir**
- Intel / Research / Brain **lead’i zenginleştirir**
- Outreach / Email / WhatsApp **lead üzerinde aksiyon alır**
- CRM / LeadDashboard **lead’in zaman çizelgesini tutar**

---

#### Job (Pipeline Birimi)
Özellikle GODMODE tarafında kullanılan, **izlenebilir işlem birimi**.

- `job_id`
- Job bazlı loglama, progress ve kanıt zinciri tutulur.
- Job, **lead değildir**; lead üreten bir süreçtir.

---

#### Event Log (Kanıt Katmanı)
Tüm kritik pipeline’lar için **kanıtlanabilirlik** sağlar.

Her kritik akış şu zinciri üretmek zorundadır:
1. **Count** (kaç adet iş/lead hedeflendi)
2. **Queue** (iş kuyruğa alındı mı)
3. **Worker** (iş gerçekten çalıştı mı)
4. **Write** (DB’ye yazıldı mı)

Bu zincir tamamlanmadan sistem “çalışıyor” kabul edilmez.

---

## Modül Bazlı Kontratlar

### Discovery
**Rol:** Hızlı / legacy lead keşfi  
**Üretir:** Ham + normalize edilmiş lead adayları  
**Yazar:** (opsiyonel) discovery tabanlı lead kayıtları  
**İcra:** Yok  
**Not:** GODMODE’un basit alternatifi

---

### GODMODE
**Rol:** Omni‑provider discovery + karar artefaktları  
**Üretir:**
- Normalize edilmiş lead’ler
- Discovery sinyalleri
- Karar artefaktları (rank, kanal önerisi, outreach taslağı)

**Yazar:**
- `godmode_jobs`
- `godmode_job_logs`
- `potential_leads`

**Kesin Kural:**
- **Email / WhatsApp göndermez**
- **Provider credential / retry / delivery yönetmez**

**Tüketiciler:**
- Intel / Research (derin analiz)
- Outreach (sadece *intent* + taslak)

---

### Intel
**Rol:** Website + SEO + dijital sinyal analizi  
**Üretir:** Lead intelligence snapshot / rapor  
**Yazar:** `lead_search_intel`, `lead_intel_reports`  
**İcra:** Yok  
**Tüketiciler:** Brain, Research, LeadDashboard

---

### Research (CIR)
**Rol:** Derin pazar / rakip / sektör zekâsı  
**Üretir:** CIR (CNG Intelligence Report)  
**Yazar:** CIR rapor tabloları  
**İcra:** Yok  
**Tüketiciler:** Brain, CRM, LeadDashboard

---

### Brain
**Rol:** Karar birleştirme ve stratejik özet  
**Üretir:**
- AI lead score
- Fırsat / risk seviyesi
- Önerilen aksiyonlar

**Yazar:** Brain snapshot / özet kayıtları  
**İcra:** Yok  
**Tüketiciler:** CRM, Outreach, LeadDashboard

---

### CRM
**Rol:** İnsan ilişkisi ve lifecycle yönetimi  
**Üretir:** Notlar, durumlar, CRM brain özetleri  
**Yazar:** `lead_crm_notes`, `lead_crm_status`, `lead_crm_brains`  
**İcra:** İnsan destekli  
**Tüketiciler:** Brain, LeadDashboard

---

### Outreach
**Rol:** İletişim stratejisi ve orkestrasyon  
**Üretir:** Mesaj içeriği + kanal stratejisi  
**İcra:** **Hayır** (sadece hazırlar)  
**Tüketiciler:** OutreachScheduler, Email, WhatsApp

---

### OutreachScheduler
**Rol:** Zamanlama ve sekans yönetimi  
**Üretir:** Enqueue / schedule planı  
**İcra:** Worker tetikleme  
**Tüketiciler:** Email / WhatsApp

---

### Email
**Rol:** Email kanalının teknik icrası  
**Üretir:** Gönderim sonucu, delivery log  
**Yazar:** `email_logs`  
**İcra:** **Evet (tek sorumlu)**

---

### WhatsApp
**Rol:** WhatsApp kanalının teknik icrası  
**Üretir:** Gönderim sonucu, delivery log  
**Yazar:** `whatsapp_logs`  
**İcra:** **Evet (tek sorumlu)**

---

### LeadDashboard
**Rol:** Read‑model / birleşik görünüm  
**Üretir:** Tek JSON “lead 360”  
**Yazar:** Yazmaz (okur)  
**İcra:** Yok

---

## Kritik Mimari Kural (Bağlayıcı)

- GODMODE **keşfeder**, icra etmez  
- Intel / Research **anlar**, icra etmez  
- Brain **karar verir**, icra etmez  
- Outreach **hazırlar**, icra etmez  
- Email / WhatsApp **icra eder**  
- CRM **insan temasını** yönetir  

Bu sınırlar ihlal edilirse:
- Modüller şişer
- Roadmap anlamını kaybeder
- Debug imkânsız hale gelir

Bu kontrat, backend‑v2 için **bağlayıcı mimari sözleşme** olarak kabul edilir.

---

Sistemde her şeyin merkezinde **lead** kavramı var.
Lead = “Potansiyel müşteri / şirket / proje”.

Temel prensipler:

- Discovery / GODMODE → yeni lead adayları üretir (`potential_leads`, vb.)
- Intel / Research → mevcut lead’i zenginleştirir (site, seo, sosyal, rakipler)
- CRM → lead ile olan ilişkiyi modelleyen zaman çizelgesi
- Brain → lead’in skorunu ve önceliğini belirler
- Outreach → lead’e yönelik aksiyonları yönetir
- LeadDashboard → tüm bu katmanların birleşmiş halini gösterir

Lead, bu modüller arasında **ID**’ler ve ilişkili tablolar üzerinden bağlanır.
DB şemalarının detayı: `src/core/docs/CORE_DB.md`

---

## 5. Şu Anki Durum (2025-12-23 Snapshot)

Bu bölüm, backend-v2’nin “şu an nerede olduğu”nu kayda geçirir.
Her büyük değişiklik sonrası güncellenmelidir.

### 5.1. Genel Durum

- Backend V2 ana iskeleti oturmuş durumda:
  - Core katmanlar, modül pattern’i, docs yapısı stabil.
- Temel modüller (auth, admin, discovery, email, intel, research, outreach, outreachScheduler, crm, leadDashboard, whatsapp) **çalışan bir mimari** etrafında konumlanmış durumda.
- Godmode modülü, discovery tarafının **gelecekteki ana motoru** olarak konumlandı.
- Smoke test, sistem bütünlüğünün "tek komut" doğrulaması olarak standartlaştırıldı.
- Port standardı `4000` olarak netleşti; dokümantasyon ve test komutları buna göre hizalandı.
- DB canonical konumlandırma `data/` altında kabul edildi (legacy yollar sadece uyumluluk için kullanılabilir).

### 5.2. GODMODE Durumu

- **Faz 1 — Core Discovery Engine (MVP → Stable)**
  - Tamamlandı, `src/modules/godmode/docs/GODMODE_ROADMAP.md` içinde **%100 DONE** olarak işaretli.
  - Özellikler:
    - Job yönetimi (SQLite kalıcı store)
    - Mock/live provider switch
    - Google Places canlı entegrasyon
    - Job progress + summary + logs (godmode_job_logs)
    - potential_leads pipeline (dedup destekli upsert)
    - dataFeederWorker stub entegrasyonu

- **Faz 2 — Omni-Data Feeder (Multi Provider Discovery Engine)**
  - Başlatıldı, yine `src/modules/godmode/docs/GODMODE_ROADMAP.md` içinde detaylandırıldı.
  - Şu an:
    - Provider abstraction layer için altyapı hazırlanmış durumda
    - `google_places` provider’ı üzerinden `providers_used`, `used_categories` alanları besleniyor
    - Ek provider’lar (LinkedIn, Instagram, Facebook, Yelp/Foursquare, resmi kayıtlar) için yer ayrıldı

### 5.3. Diğer Modüller

Bu oturumda **doğrudan müdahale edilen** modüller: `research` (CIR), `outreach` (CIR sonrası akış), `core/app` (route mount & startup dayanıklılığı).

- **Research (CIR)** → Smoke testte kırmızıya düşen CIR full-report hattı stabilize edildi.
- **Outreach** → CIR ile ilişkili senaryolarda smoke test uyumu sağlandı.
- **Core / App** → `app.js` route mount ve çalıştırma akışında kırılgan noktalar kapatıldı.

Diğer modüller genel olarak mevcut mimari içinde çalışır durumdadır; ayrıntı ve değişiklik geçmişi için ilgili modül dokümanları ve `docs/devlogs/` referans alınır.

---

## 6. Geliştirme Prensipleri

## Smoke Test Politikası (Mini vs Full)

Bu projede iki seviyeli smoke test standardı uygulanır. Amaç; küçük değişikliklerde hızlı ilerlerken, büyük değişikliklerde sistem genelinde regresyon riskini kontrol altında tutmaktır.

### 1) Mini Smoke (Hızlı Doğrulama — 20–60 sn)
Amaç: Küçük değişikliklerde kritik zincirin kırılmadığını hızlıca kanıtlamak.

- Script: `./scripts/smoke_godmode_min.sh`
- Kanıtladığı zincir:
  1) API ayakta (admin status)
  2) Providers health
  3) GODMODE job create + run
  4) DB write: `AI_LEAD_RANKED` ve `AI_LEAD_RANKING_DONE`

Ne zaman koşturulur:
- Prompt / schema değişiklikleri
- Küçük service veya repo düzeltmeleri
- Job log / metric eklemeleri
- Lokal iterasyon ve hızlı deneme adımları

Mini smoke, sistemin tamamını değil; **kritik ana akışın çalıştığını** kanıtlar.

---

### 2) Full Smoke (Release Gate — Uzun Test)
Amaç: Sistem genelinde regresyon olmadığını doğrulamak.

- Script: `./scripts/smoke_test.sh`

Ne zaman **zorunlu**:
- Migration veya DB schema değişikliği
- Worker / queue zinciri değişikliği
- ProvidersRunner veya discovery pipeline büyük değişiklikleri
- `shared/*` klasörü (özellikle `shared/ai/llmClient.js`) değişiklikleri
- Birden fazla modülü etkileyen refactor
- PR öncesi veya gün sonu “release check”

---

### Kural ve Disiplin
- Mini smoke, **hızlı lokal doğrulama** içindir.
- Full smoke, **release ve büyük değişiklik doğrulaması**dır.
- Mini smoke geçti diye full smoke **atlanmaz**.
- Hangi testin koşulacağı, yapılan değişikliğin kapsamına göre belirlenir.

Backend V2 için bazı sabit prensipler:

1. **Modülerlik**
   - Her domain kendi modülünde yaşar.
   - Ortak kod → `core` veya `shared` içinde.

2. **Dokümantasyon Zorunlu**
   - Yeni modül → `_template`’ten türetilir.
   - En az:
     - `<MODULE>.md`
     - `CHANGELOG.md`
   - `ARCHITECTURE.md`, `MODULES.md` ve `ROADMAP.md` ile tutarlı olmalı.

3. **DB Önce Doküman**
   - Yeni tablo / kolon → önce `CORE_DB.md` güncellenir.
   - Sonra migration ve repo/service katmanı.

4. **AI / LLM Entegrasyonu**
   - Tüm prompt’lar `src/prompts` veya modül içi `prompts/` / `ai/` klasörlerinde tutulur.
   - LLM çağrıları `shared/ai/llmClient.js` üzerinden yapılır (veya burada tanımlı pattern’le uyumlu olur).

5. **Test / Smoke Checks**
   - Büyük değişiklikler sonrası:
     - En azından HTTP smoke testleri (`curl + jq` script’leri) çalıştırılır.
   - GODMODE gibi kritik modüller için roadmap’te tanımlı testler uygulanır.

---

## 7. ZEROPOINT’in “Süper Hafıza” Olarak Kullanımı

Yeni bir sohbette backend-v2 ile ilgili çalışmaya başlanacaksa:

1. **ZeroPoint / giriş noktası:**
   - `docs/ZEROPOINT.md`
2. **Mimari:**
   - `docs/ARCHITECTURE.md`
3. **Modül detayları:**
   - `docs/MODULES.md`
4. **Genel proje roadmap’i ve anlık durum:**
   - `docs/ROADMAP.md`
5. **Modül spesifik iş:**
   - İlgili modül yolu: `src/modules/<module>/docs/<MODULE>.md`

referans gösterildiğinde, **AI asistan (ChatGPT)** bu dosyaları okuyarak:

- Sistemin genel mantığını,
- Modüllerin rollerini,
- Godmode ve diğer kritik parçaların durumunu,
- Ana veri akışlarını
- Projenin hangi fazda olduğunu ve sıradaki adımları

hızlıca hafızasına yükleyebilir.

> Özet:
> Bu dört ana dosya (`ZEROPOINT`, `ARCHITECTURE`, `MODULES`, `ROADMAP`) + modül dokümanları =
> **“CNG AI Agent Backend V2 Süper Hafıza Paketi”**
> Tüm yeni geliştirmeler ve tartışmalar bu çerçeveye yaslanmalıdır.


————————————————


# README_FIRST.md — CNG AI Agent Backend V2
Bu dosya, tüm sistemi yeniden hatırlamak ve yeni bir sohbete geçtiğimizde **kritik bilgileri hızlıca yüklemek** için oluşturulmuştur.
Backend-V2’nin çalışması, portlar, environment değişkenleri, API anahtarları, DB yapısı, test komutları ve hayati operasyonel bilgiler burada tutulur.

---

# 📌 1. Sistem Genel Bilgiler

### **Backend Port**
- Sistem **4000 portunda** çalışır.
- Başlatma komutu:
```
npm start

"bsc" komutu githuba push commit yapar
```

### **Sunucu Framework**
- Node.js (v24)
- Express.js
- better-sqlite3 (DB)
- OpenAI / LLM entegrasyonu (shared/ai)

### **Ana Entry Points**
- `src/server.js`
- `src/app.js`

---

# 📌 2. Environment (.env) Dosyası

Aşağıdaki değişkenler sistem için kritiktir:

```
PORT=4000


⚠️ **Not:** Bu dosyada gerçek anahtar saklama! Sadece roller listesi burada bulunur.

---

# 📌 3. Database Yapısı

### **Ana Veritabanı Dosyaları**

```
src/data/app.sqlite       → lead, discovery ve intel için ana DB
src/data/crm.sqlite       → CRM modülü için ayrı DB
```

### **Kilit Tablolar**

#### GODMODE:
- `godmode_jobs`
- `godmode_job_logs`
- `godmode_job_results`
- `godmode_job_progress`

#### LEAD PIPELINE:
- `potential_leads`
- `lead_search_intel`
- `lead_intel_reports`
- `lead_crm_brains`
- `lead_crm_notes`

#### OUTREACH:
- v2.1 motor kullanır, DB kaydı yok
(gelecekte `outreach_jobs`)

#### EMAIL:
- `email_logs`

#### WHATSAPP:
- `whatsapp_logs`

---

# 📌 4. Godmode Test CURL Komutları

### **Job Create**
```
curl -s -X POST "http://localhost:4000/api/godmode/jobs/discovery-scan" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Smoke Test",
    "city": "İstanbul",
    "country": "Türkiye",
    "categories": ["mimarlık ofisi"],
    "minGoogleRating": 3.5,
    "maxResults": 10,
    "channels": ["google_places"],
    "notes": "smoke-test"
  }' | jq
```

### **Job Run**
```
curl -s -X POST "http://localhost:4000/api/godmode/jobs/<JOB_ID>/run" | jq
```

### **Job Details**
```
curl -s "http://localhost:4000/api/godmode/jobs/<JOB_ID>" | jq
```

---

# 📌 5. Job Log Kontrol Komutları

### Tüm loglar (son 20)
```
sqlite3 src/data/app.sqlite "
SELECT id, job_id, event_type, substr(created_at,1,19)
FROM godmode_job_logs
ORDER BY id DESC LIMIT 20;
"
```

### Belirli job’a göre log:
```
sqlite3 src/data/app.sqlite "
SELECT id, event_type, created_at
FROM godmode_job_logs
WHERE job_id = '<JOB_ID>'
ORDER BY id;
"
```

---

# 📌 6. Sistemde Önemli Pipeline'lar

### **Godmode Discovery Engine**
- Provider Runner → Google Places
- Discovery Pipeline → normalization
- UPSERT → `potential_leads`
- Summary Builder → job sonuçları
- Worker Stub → `dataFeederWorker`

### **Research Pipeline (CIR v1.4.0)**
- intel_basic
- intel_deep
- web search
- social presence v2.0
- competitors
- benchmark
- CIR normalization

### **Outreach v2.1**
- first-contact motoru (v1)
- multi-step sequence motoru (v2)
- strict JSON output

---

# 📌 7. Manuel DB Silme / Reset Notları

### **Yanlış DB dosyasını silme riski!**

**Doğru DB yolu:**
```
src/data/app.sqlite
src/data/crm.sqlite
```

Eğer DB yenilemek istenirse:
```
rm src/data/app.sqlite
npm start
```
→ Tüm tablolar kendisi yeniden oluşur.

---

# 📌 8. Kritik Teknik Notlar

- `godmodeService.getJobById` sorunu düzeltildi (service → repo mapping)
- Provider errors artık normalize ediliyor
- `used_categories` correct fallback: criteria.categories
- DB dosyasının *yanlış klasörde oluşması* eski sorundu → çözülmüş durumda
- Worker mekanizması v1 stub çalışıyor

---

# 📌 9. Yeni Sohbet Başlangıç Komutu

Yeni bir sohbette, bana sadece:

```
Sistemi yükle
```

demen yeterli.

Ben de bu README_FIRST.md dosyasını okuyarak:
- Portu
- DB yollarını
- Godmode test komutlarını
- CIR pipeline özelliklerini
- Outreach motor mantığını
- Env değişkenlerini
%100 hafızama yükleyeceğim.

---

## 📌 10. Smoke Test (smoke_test.sh)

Sistem bütünlüğünü hızlıca test etmek için hazırlanmış tam otomatik bir script’tir.
Aşağıdaki alanlarda backend’in çalıştığını doğrular:

- Admin status
- Godmode discovery (job create + run + summary)
- Email test log
- WhatsApp test log
- Outreach v1 first-contact
- Outreach v2 sequence
- Outreach Scheduler enqueue
- Research CIR full-report

### **Çalıştırma Komutu**
```
./scripts/smoke_test.sh
```

### **LEAD_ID Override**
Bazı testler varsayılan olarak leadId=1 üzerinden çalışır.
Farklı lead denemek için:

```
LEAD_ID_OVERRIDE=123 ./scripts/smoke_test.sh
```

### **Script Konumu**
```
backend-v2/scripts/smoke_test.sh
```

- Do not modify any other part of the file.



———————————————


# CNG AI Agent — Backend V2 Architecture Blueprint (2025-12-09)

Bu döküman, CNG AI Agent **backend-v2** için güncel ve referans mimari rehberidir.
Tüm yeni geliştirmeler, refactor kararları ve modül eklemeleri bu yapı üzerinden düşünülmelidir.

---

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


————————————————


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


————————————


# CNG AI Agent — BACKEND V2 MASTER ROADMAP
**Sürüm:** v2.0 ZeroPoint
**Durum:** Aktif geliştirme
**Bu dosya sistemin resmi yol haritasıdır.**

Bu roadmap, Backend-V2’nin *tam kapsamlı gelişim aşamalarını*, *her fazda yapılacak tüm adımları*, *tamamlanan maddeleri* ve *gelecek planlarını* içerir.
Godmode gibi tek modüle özel roadmap’lerin aksine, **bu dosya tüm sistemin üst seviye gelişim haritasıdır**.

Her sprint sonunda güncellenir.
Tüm modüllerle ilgili genel mimari için → `docs/ARCHITECTURE.md`
Modül tanımları ve detaylı açıklamalar için → `docs/MODULES.md`
Godmode özel roadmap → `src/modules/godmode/docs/GODMODE_ROADMAP.md`

---

# 📌 FAZ 0 — ZEROPOINT (Tamamlandı)
**Sıfır noktası – sistem bilinci, mimari ve hafıza temelinin oluşturulması.**

### Tamamlananlar:
- [x] ZEROPOINT.md oluşturuldu
- [x] ARCHITECTURE.md güncellendi (Backend-V2 mimari haritası)
- [x] MODULES.md oluşturuldu (modül bazlı derin anlatımlar)
- [x] Godmode roadmap entegrasyonu tamamlandı
- [x] Süper hafıza giriş noktası sistemi kuruldu
- [x] Tüm dokümantasyon yapısı stabilize edildi

---

# 📌 FAZ 1 — CORE SYSTEMS (Tamamlandı)
**Backend-V2’nin omurgasının oluştuğu aşama.**

### 1.A — Core infrastructure
- [x] HTTP/server layer (`src/server.js`, `src/app.js`, core/http)
- [x] Core DB (SQLite dual-db: `app.sqlite` + `crm.sqlite`)
- [x] Migrations sistemi (core/migrations/*)
- [x] Logger, middleware, security layer
- [x] Core utilities & shared services

### 1.B — Authentication System
- [x] JWT tabanlı auth (authService + utils/jwt)
- [x] User migration (`006_create_users.js`)
- [x] Register/Login/Session flow
- [x] AUTH.md dokümantasyonu

### 1.C — CRM Engine v1
- [x] Lead storing
- [x] Lead updates
- [x] CRM Brain entegrasyonu (özet + analiz akışı)
- [x] CRM.md dokümantasyonu

### 1.D — Discovery Engine v1
*(Modül içi detay GODMODE ve DISCOVERY roadmap dosyalarında)*

- [x] Provider Mode: mock & live
- [x] Google Places entegrasyonu (discovery + godmode)
- [x] Lead enrichment v1
- [x] Discovery endpoints
- [x] GODMODE Discovery Engine Faz 1.0.0
  - Job persistence (SQLite)
  - Job progress & status
  - Job result summary + sample leads
  - Job event log sistemi (`godmode_job_logs`)

### 1.E — Intel Engine v1
- [x] On-page SEO Analyzer (shared/seo + intel/seoOnpageService)
- [x] Basic competitor lookup
- [x] INTEL.md dokümanı

### 1.F — Research Engine v1
- [x] Competitor, Ads, Benchmarking, Socials, Websearch servisleri
- [x] RESEARCH.md dokümanı

---

# 📌 FAZ 2 — GODMODE & OMNI-DISCOVERY (Aktif)
**Amaç: Çoklu sağlayıcılarla çalışan, veri birleştiren ve tam otomatik discovery motoru.**
**Mevcut durum:** Google Places, Provider Abstraction Layer üzerinden stabilize edildi; diğer providerlar ve deep-enrichment henüz plan/faz-içi aşamada.

Bu fazın tüm ayrıntılı teknik planı için:
➡ `src/modules/godmode/docs/GODMODE_ROADMAP.md`

### 2.A — Provider Abstraction Layer (PAL)
- [x] PAL interface tasarımı (`providers/index.js`)
- [x] Provider runner revizyonu (`providersRunner.js` + `discoveryPipeline.js`)
- [ ] Provider health check
- [ ] Rate-limit balancing

### 2.B — Multi-Provider Discovery
**Aktif aşama**

Providers:
- [x] Google Places (finalize edildi, v1.1.0-live)
- [ ] LinkedIn Company Finder
- [ ] Instagram Business Search
- [ ] Meta/Facebook Business
- [ ] Yelp/Foursquare
- [ ] MERSIS / Ticaret Sicil
- [ ] Web Scraping discovery
- [ ] Sector-specific directories

### 2.C — Duplicate Detection & Merging
- [ ] Lead fingerprinting
- [ ] Multi-provider confidence scoring
- [ ] Duplicate merging pipeline
- [ ] “Already-discovered protection” (Aynı firmayı tekrar işlememe sistemi)

### 2.D — Deep Enrichment v2
- [ ] Tech stack detection (Wappalyzer-Lite)
- [ ] Social footprint
- [ ] SEO scoring
- [ ] Ad signals (Meta/Google tags)
- [ ] AI-ranker integration v2

---

# 📌 FAZ 3 — BRAIN & INTELLIGENCE EXPANSION
**Amaç: Keşfedilen her firmanın otomatik analiz edilmesi ve satış fırsatlarının çıkarılması.**

### 3.A — AI Lead Analyzer
- [ ] Lead AI Score v3
- [ ] Opportunity scoring
- [ ] Risk scoring
- [ ] Category Positioning Analysis

### 3.B — Auto-SWOT Engine
- [ ] Lead SWOT
- [ ] Competitor-based SWOT
- [ ] Sector SWOT
- [ ] SWOT history tracking

### 3.C — AI-Driven Strategy Engine
- [ ] Auto Sales Entry Strategy
- [ ] Opening sentence generator
- [ ] Red Flag Detector
- [ ] Category-specific recommendations

---

# 📌 FAZ 4 — OUTREACH AUTOMATION SYSTEM
**Keşif → Analiz → Fırsat → Otomatik satış akışı bütünlüğü.**

### 4.A — Outreach Scheduler v2
- [ ] Trigger-based outreach
- [ ] Daily/weekly scanning scheduler
- [ ] Smart throttling
- [ ] Multi-channel outreach paths

### 4.B — Messaging Engine v2
- [ ] Persona-based message generation
- [ ] Opening + follow-up sequences
- [ ] Lead context memory
- [ ] Multi-platform: Email, WhatsApp, Instagram

### 4.C — Autonomous Outreach
- [ ] Lead threshold > 80 → Auto-Outreach
- [ ] AI Selected Target Set
- [ ] Post-reply analysis
- [ ] CRM Auto-Update

---

# 📌 FAZ 5 — ENTERPRISE MODE & ANALYTICS HUB
**Sistemin uçtan uca “kurumsal AI agent platformu” haline gelmesi.**

### 5.A — Insight Dashboard
- [ ] Discovery heatmaps
- [ ] Category trends
- [ ] Provider accuracy metrics
- [ ] Lead quality graphs

### 5.B — Intelligence Report Engine
- [ ] Automatic PDF generation
- [ ] Sector intelligence
- [ ] Region maps & opportunity charts
- [ ] Weekly “Market Brain Report”

### 5.C — Multi-Tenant Architecture
- [ ] Workspace system
- [ ] Org-level role structure
- [ ] Project-level isolation
- [ ] Billing & subscription

---

# 📌 FAZ 6 — GLOBAL AI AGENT PLATFORM
**CNG Medya sistemi → küresel SaaS AI Agent platformuna dönüşüm.**

- [ ] White-label architecture
- [ ] Industry-specific agent templates
- [ ] Plugin ecosystem
- [ ] AI-rules engine
- [ ] AppStore for Agent Modules

---

# 📌 Ek Notlar
- Bu roadmap düzenli olarak güncellenir.
- Tüm GODMODE detayları ayrı dosyadadır.
- Yeni modüller bu dosyaya işlendiğinde MODULES.md senkronize edilir.

# 📌 Sprint‑Based Roadmap (Modül Bazlı Mini‑Checklist Yapısı)

## Sprint Yapısı
Her sprint maksimum 7 gün olup odaklanılan modülün sadece ilgili alt‑özellikleri geliştirilir.
Aşağıdaki mini‑checklist'ler her modülün sprint sırasında tamamlanması gereken atomic görevlerini içerir.

---

# 🧩 Modül Bazlı Mini‑Checklist’ler

## 1) AUTH MODULE
- [ ] JWT login
- [ ] JWT refresh
- [ ] Role-based routes
- [ ] AuthRequired middleware
- [ ] AuthOptional middleware
- [ ] Password hashing cycle
- [ ] Token invalidation design (v2)

---

## 2) CRM MODULE
- [ ] Lead create
- [ ] Lead update
- [ ] Lead notes
- [ ] Lead tags
- [ ] CRM Brain v1 summary generation
- [ ] CRM Brain snapshot storage
- [ ] CRM UI data-shaping layer

---

## 3) DISCOVERY MODULE
- [ ] Places text search v1
- [ ] Places detail enrichment
- [ ] Deduplication basic mode
- [ ] Category normalizer
- [ ] Discovery result → CRM insert pipe
- [ ] AI Ranker v1
- [ ] Discovery history tracking

---

## 4) GODMODE MODULE
- [ ] Job create
- [ ] Job run
- [ ] Job progress
- [ ] Job summary
- [ ] ProviderRunner v2
- [ ] Multi-provider interface
- [ ] Deep-enrichment hook
- [ ] Worker orchestration
- [ ] Job event logs
- [ ] Duplicate protection (fingerprinting)
- [ ] Already‑discovered prevention
- [ ] Error propagation system
- [ ] GODMODE Dashboard API (v1)

---

## 5) INTEL MODULE
- [ ] SEO Onpage Analyzer
- [ ] Competitor signals
- [ ] Intel Report (JSON)
- [ ] Intel scoring model
- [ ] Intel + CRM enrichment pipeline (v2)

---

## 6) RESEARCH MODULE
- [ ] Ads intelligence
- [ ] Competitor lookup
- [ ] Benchmark suite
- [ ] Social presence
- [ ] Websearch integrator
- [ ] Research master prompt
- [ ] Research page intelligence export

---

## 7) OUTREACH MODULE
- [ ] First message generator
- [ ] Follow‑up sequence generator
- [ ] Outreach history
- [ ] Outreach AI pipeline
- [ ] WhatsApp + Email + Instagram API integration stubs
- [ ] Outreach Brain

---

## 8) OUTREACH SCHEDULER MODULE
- [ ] Queue-based scheduler
- [ ] Smart throttle
- [ ] Time‑window rules
- [ ] Auto‑trigger when LeadScore > 80
- [ ] Failure retry mechanism

---

## 9) BRAIN MODULE
- [ ] Lead AI Score v2
- [ ] AI category detection
- [ ] Opportunity scoring
- [ ] SWOT generator v1
- [ ] Sales entry strategy v1
- [ ] Red flag detector
- [ ] Multi-model LLM support

---

# 🗺️ Sistem Diyagramı (Metinsel Blueprint)

```
                       ┌──────────────────────┐
                       │      HTTP Layer      │
                       │  (Express App Layer) │
                       └──────────┬───────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │        Core Layer         │
                    │ config / db / logger ... │
                    └─────────────┬─────────────┘
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      │                           │                           │
 ┌────▼────┐                ┌─────▼─────┐                ┌────▼────┐
 │  AUTH   │                │   CRM     │                │DISCOVERY│
 │  Module │                │  Module   │                │ Module  │
 └────┬────┘                └────┬──────┘                └────┬────┘
      │                           │                           │
      │                           │                           │
      │                 ┌─────────▼─────────┐                 │
      │                 │     INTEL         │                 │
      │                 └─────────┬─────────┘                 │
      │                           │                           │
      │                 ┌─────────▼─────────┐                 │
      │                 │    RESEARCH       │                 │
      │                 └─────────┬─────────┘                 │
      │                           │                           │
      │                     ┌─────▼──────┐                    │
      │                     │  OUTREACH  │                    │
      │                     └─────┬──────┘                    │
      │                           │                           │
      │                    ┌──────▼────────┐                  │
      │                    │ OUTREACH-SCH  │                  │
      │                    └──────┬────────┘                  │
      │                           │                           │
      │          ┌────────────────▼────────────────┐          │
      │          │             BRAIN               │          │
      │          └────────────────┬───────────────┘          │
      │                           │                           │
      │                           │                           │
      │         ┌─────────────────▼──────────────────┐        │
      │         │             GODMODE                │◄───────┘
      │         │ (Omni-Discovery + Orchestration)  │
      │         └────────────────────────────────────┘
```


———————————
