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
3. “Şu anki durum”u (2025-12-25 itibarıyla) kayda geçirmek  
4. Gelecekteki sohbetlerde **“süper hafıza giriş noktası (ZeroPoint)”** olarak kullanılmak  

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

   GODMODE bu aşamada **karar artefaktları** da üretir (lead ranking, auto-SWOT, entry strategy, outreach draft),  
   ancak **hiçbir şekilde iletişim icrası yapmaz**. Bu çıktılar downstream modüller tarafından tüketilir.

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
  - `godmode` → Omni-provider discovery + enrichment + **AI decision artifact üretimi**
    - Job management, job logs, provider runner
    - potential_leads pipeline (dedup + upsert)
    - AI artefaktlar: ranking, auto-SWOT, entry strategy, outreach draft
    - ❗ Email / WhatsApp / outreach execution YOK

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

## 4. Veri Modeli ve “Lead” Kavramı

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

## 5. Şu Anki Durum (2025-12-25 Snapshot)

Bu bölüm, backend-v2’nin “şu an nerede olduğu”nu kayda geçirir.  
Her büyük değişiklik sonrası güncellenmelidir.

### 5.1. Genel Durum

- Backend V2 ana iskeleti oturmuş durumda:
  - Core katmanlar, modül pattern’i, docs yapısı stabil.
- Temel modüller (auth, admin, discovery, email, intel, research, outreach, outreachScheduler, crm, leadDashboard, whatsapp) **çalışan bir mimari** etrafında konumlanmış durumda.
- Godmode modülü, discovery tarafının **gelecekteki ana motoru** olarak konumlandı.

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

- **Faz 3 — AI Decision Artifacts (DONE)**
  - Lead Ranking (A/B/C, priority_score)
  - Auto-SWOT üretimi
  - Sales Entry Strategy (why_now, risk, angle)
  - Outreach Draft (hazırlık amaçlı)
  - Mini smoke + full smoke testleri ile kanıtlandı

- **Faz 4 — Outreach Auto-Trigger (v1)**
  - Skor bazlı auto-trigger (enqueue only)
  - Execution guardrails (dry-run, daily cap, kill-switch)
  - GODMODE yalnızca tetikler, icra etmez

### 5.3. Diğer Modüller

Detay per-modül statüleri modül dokümanlarında (`src/modules/**/docs/*.md`) tutulabilir, burada üst seviye:

- **Auth / Admin** → Sistemin temel güvenlik ve yönetim iskeleti olarak hazır.
- **Discovery** → Legacy / lightweight discovery ihtiyacı için kullanılabilir durumda.
- **Intel / Research** → Lead dış dünya zeka üretimi için ana taşıyıcı; geliştirme ve genişletme alanı büyük.
- **CRM / Brain** → Lead beyni ve ilişki durumu tarafını üstleniyor; zamanla daha da derinleştirilecek.
- **Outreach / Email / WhatsApp / OutreachScheduler** → Lead’lere ulaşma ve follow-up akışlarını omuzluyor.
- **LeadDashboard** → Tüm bu veriyi tek pencerede toplamak için okuma modeli gibi davranıyor.

---

## 6. Geliştirme Prensipleri

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
   - AI çıktısı üreten modül, **aksiyon alan modül değildir** (decision ≠ execution).

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

---

### ZEROPOINT Bağlayıcı Notu

Bu dosya, backend-v2 için:
- **“Neyi neden yaptık?”**
- **“Hangi modül neden var?”**
- **“İcra nerede başlar, nerede biter?”**

sorularının **tek referans cevabı**dır.

ARCHITECTURE.md, MODULES.md ve ROADMAP.md ile çelişen bir yorum  
**geçersiz kabul edilir**.

> Özet:  
> Bu dört ana dosya (`ZEROPOINT`, `ARCHITECTURE`, `MODULES`, `ROADMAP`) + modül dokümanları =  
> **“CNG AI Agent Backend V2 Süper Hafıza Paketi”**  
> Tüm yeni geliştirmeler ve tartışmalar bu çerçeveye yaslanmalıdır.