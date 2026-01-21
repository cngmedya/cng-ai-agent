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
**Mevcut durum:** Google Places, Provider Abstraction Layer üzerinden stabilize edildi.  
Deep-enrichment hattı **aktif ve çalışır durumdadır** (website + tech fingerprint); SEO, social ve ad sinyalleri faz-içi geliştirme kapsamındadır.

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
**Durum:** Aktif – kısmi tamamlandı

- [x] 2.D.3.1 Website fetch (Google Places + Place Details fallback)
- [x] 2.D.3.1 Tech fingerprint (stub, provider-safe)
- [x] Deep enrichment manuel consumer (job bazlı tetikleme)
- [x] Observability & job event logs
- [x] Idempotent enrichment execution (jobId + placeId)

- [ ] 2.D.3.2 SEO signals (indexability, meta, schema)
- [ ] 2.D.3.3 Social footprint enrichment
- [ ] 2.D.3.4 Ad / tracking signals
- [x] 2.D.3.5 AI-ranker integration v2 (GODMODE AI decision artifacts: lead ranking / strategy / draft)  

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

### 4.D — Outreach Execution Guardrails (v1)
- [x] Execution mode separation (send_now vs schedule)
- [x] Kill-switch / policy blocking (DB logged)
- [x] Daily cap enforcement (restart-safe)
- [x] Dry-run SENT/FAILED events for analytics/CRM chain proof
- [x] Mini smoke + Full smoke proof (DB assertions)

### 4.C — Autonomous Outreach  
- [x] Lead threshold > 80 → Auto-Outreach (GODMODE auto-trigger)
- [x] AI Selected Target Set (AI ranking + target selection)
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
- Mini smoke testler (ör: `scripts/smoke_godmode_min.sh`) küçük faz geçişlerinde kullanılır; faz kapanışında full smoke (`scripts/smoke_test.sh`) gate’dir.  
- “Roadmap’te yoksa yoktur” kuralı: Yeni faz/başlık eklenmeden önce bu dosyaya işlenir; sonra implementasyona geçilir.

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
- [x] Job create
- [x] Job run
- [x] Job progress
- [x] Job summary
- [x] ProviderRunner v2
- [x] Multi-provider interface
- [x] Deep-enrichment hook
- [x] Job event logs
- [x] AI decision artifacts (lead ranking / auto-swot / entry strategy / outreach draft)
- [x] Outreach auto-trigger v1 (enqueue + dry-run/send_now modes)
- [x] Outreach execution guardrails v1 (kill-switch, daily cap, policy logs)
- [x] Mini smoke + Full smoke gates (DB assertions)
- [ ] Worker orchestration (advanced)
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
- [ ] Email provider adapter v1 (first channel) + WhatsApp/Instagram stubs (later)  
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