# CNG AI Agent — BACKEND V2 MASTER ROADMAP  
**Sürüm:** v2.0 ZeroPoint  
**Durum:** Aktif geliştirme  
**Bu dosya sistemin resmi yol haritasıdır.**

Bu roadmap, Backend‑V2’nin *tam kapsamlı gelişim aşamalarını*, *her fazda yapılacak tüm adımları*, *tamamlanan maddeleri* ve *gelecek planlarını* içerir.  
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
- [x] ARCHITECTURE.md güncellendi (Backend‑V2 mimari haritası)  
- [x] MODULES.md oluşturuldu (modül bazlı derin anlatımlar)  
- [x] Godmode roadmap entegrasyonu tamamlandı  
- [x] Süper hafıza giriş noktası sistemi kuruldu  
- [x] Tüm dokümantasyon yapısı stabilize edildi  

---

# 📌 FAZ 1 — CORE SYSTEMS (Tamamlandı)  
**Backend‑V2’nin omurgasının oluştuğu aşama.**

### 1.A — Core infrastructure  
- [x] HTTP/server layer  
- [x] Core DB (SQLite dual‑db: app + crm)  
- [x] Migrations sistemi  
- [x] Logger, middleware, security layer  
- [x] Core utilities & shared services  

### 1.B — Authentication System  
- [x] JWT tabanlı auth  
- [x] User migration  
- [x] Register/Login/Session flow  
- [x] AUTH.md dokümantasyonu  

### 1.C — CRM Engine v1  
- [x] Lead storing  
- [x] Lead updates  
- [x] CRM Brain entegrasyonu (özet + analiz)  
- [x] CRM.md dokümantasyonu  

### 1.D — Discovery Engine v1 (modül içi detay GODMODE roadmap dosyasında)  
- [x] Provider Mode: mock & live  
- [x] Google Places entegrasyonu  
- [x] Lead enrichment v1  
- [x] Discovery endpoints  

### 1.E — Intel Engine v1  
- [x] On‑page SEO Analyzer  
- [x] Basic competitor lookup  
- [x] INTEL.md dokümanı  

### 1.F — Research Engine v1  
- [x] Competitor, Ads, Benchmarking, Socials, Websearch servisleri  
- [x] RESEARCH.md dokümanı  

---

# 📌 FAZ 2 — GODMODE & OMNI-DISCOVERY (Aktif)  
**Amaç: Çoklu sağlayıcılarla çalışan, veri birleştiren ve tam otomatik discovery motoru.**

Bu fazın tüm ayrıntılı teknik planı için:  
➡ `src/modules/godmode/docs/GODMODE_ROADMAP.md`

### 2.A — Provider Abstraction Layer (PAL)  
- [x] PAL interface tasarımı  
- [x] Provider runner revizyonu  
- [ ] Provider health check  
- [ ] Rate‑limit balancing

### 2.B — Multi‑Provider Discovery  
**Aktif aşama**

Providers:  
- [x] Google Places (finalize edildi)  
- [ ] LinkedIn Company Finder  
- [ ] Instagram Business Search  
- [ ] Meta/Facebook Business  
- [ ] Yelp/Foursquare  
- [ ] MERSIS / Ticaret Sicil  
- [ ] Web Scraping discovery  
- [ ] Sector‑specific directories  

### 2.C — Duplicate Detection & Merging  
- [ ] Lead fingerprinting  
- [ ] Multi‑provider confidence scoring  
- [ ] Duplicate merging pipeline  
- [ ] “Already‑discovered protection” (Aynı firmayı tekrar işlememe sistemi)

### 2.D — Deep Enrichment v2  
- [ ] Tech stack detection (Wappalyzer‑Lite)  
- [ ] Social footprint  
- [ ] SEO scoring  
- [ ] Ad signals (Meta/Google tags)  
- [ ] AI‑ranker integration v2  

---

# 📌 FAZ 3 — BRAIN & INTELLIGENCE EXPANSION  
**Amaç: Keşfedilen her firmanın otomatik analiz edilmesi ve satış fırsatlarının çıkarılması.**

### 3.A — AI Lead Analyzer  
- [ ] Lead AI Score v3  
- [ ] Opportunity scoring  
- [ ] Risk scoring  
- [ ] Category Positioning Analysis  

### 3.B — Auto‑SWOT Engine  
- [ ] Lead SWOT  
- [ ] Competitor‑based SWOT  
- [ ] Sector SWOT  
- [ ] SWOT history tracking  

### 3.C — AI‑Driven Strategy Engine  
- [ ] Auto Sales Entry Strategy  
- [ ] Opening sentence generator  
- [ ] Red Flag Detector  
- [ ] Category‑specific recommendations  

---

# 📌 FAZ 4 — OUTREACH AUTOMATION SYSTEM  
**Keşif → Analiz → Fırsat → Otomatik satış akışı bütünlüğü.**

### 4.A — Outreach Scheduler v2  
- [ ] Trigger‑based outreach  
- [ ] Daily/weekly scanning scheduler  
- [ ] Smart throttling  
- [ ] Multi‑channel outreach paths  

### 4.B — Messaging Engine v2  
- [ ] Persona‑based message generation  
- [ ] Opening + follow‑up sequences  
- [ ] Lead context memory  
- [ ] Multi‑platform: Email, WhatsApp, Instagram  

### 4.C — Autonomous Outreach  
- [ ] Lead threshold > 80 → Auto‑Outreach  
- [ ] AI Selected Target Set  
- [ ] Post‑reply analysis  
- [ ] CRM Auto‑Update  

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

### 5.C — Multi‑Tenant Architecture  
- [ ] Workspace system  
- [ ] Org‑level role structure  
- [ ] Project‑level isolation  
- [ ] Billing & subscription  

---

# 📌 FAZ 6 — GLOBAL AI AGENT PLATFORM  
**CNG Medya sistemi → küresel SaaS AI Agent platformuna dönüşüm.**

- [ ] White‑label architecture  
- [ ] Industry‑specific agent templates  
- [ ] Plugin ecosystem  
- [ ] AI‑rules engine  
- [ ] AppStore for Agent Modules  

---

# 📌 Ek Notlar  
- Bu roadmap düzenli olarak güncellenir.  
- Tüm GODMODE detayları ayrı dosyadadır.  
- Yeni modüller bu dosyaya işlendiğinde MODULES.md senkronize edilir.  
