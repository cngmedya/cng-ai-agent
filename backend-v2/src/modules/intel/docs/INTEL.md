# Intel Module — v3.0.0

Intel, firmanın temel SWOT’unu ve website bazlı derin analizini oluşturan modüldür.

---

## 🚀 Modülün Görevi
Intel iki seviyeli analiz yürütür:

### 1) Basic Intel (AI Classification + SWOT)
`analyzeLead()`
- Kategori tespiti  
- AI score  
- SWOT  
- Dijital durum tahmini

### 2) Deep Intel (Website + SEO Audit)
`analyzeLeadDeep()`
- Website HTML snapshot alma  
- On-page SEO ölçümleri  
- UX, içerik kalitesi, eksikler  
- Derin SWOT üretimi

---

## 📄 Kullanılan Prompts
- `lead_intel_analysis.md`
- `lead_deep_website_analysis.md` *(tamamen yeniden yazıldı)*

---

## 🔗 Research ile Entegrasyon
Research modülü, CIR raporu oluştururken şu alanları kullanıyor:
- `intel_basic`
- `intel_deep`

Bu modül Research’e doğrudan veri sağlar.

---

# 📌 CHANGELOG (v3.0.0)

## Added
- SEO on-page analiz sistemi
- Yeni deep intel prompt
- Research entegrasyon pipeline

## Updated
- Basic Intel JSON modeli genişletildi

## Version
```
v3.0.0
```

---------

# INTEL MODULE – Full Technical Documentation
**Module Version:** v1.0.0  
**Last Update:** 2025-12-02  
**Maintainer:** CNG AI Agent Backend Team

---

# 📌 1. Purpose
Intel modülü, lead'ler için **derin araştırma, website analizi ve stratejik değerlendirme** üretir.

Görevleri:

- SWOT analizi  
- Website UX/Content değerlendirmesi  
- On-page SEO analizi  
- Ajans fırsatlarını belirleme  
- Satış ekibine özel notlar üretme  
- Lead’i "soğuk veri" olmaktan çıkarıp **insight’a dönüştürme**

Bu modül, satış pipeline’ının **orta aşamasında (MOFU)** yer alır.

---

# 📌 2. Responsibilities

### ✔ 1. Quick Intel
- Lead meta verisinden hızlı analiz  
- AI destekli SWOT + fırsatlar

### ✔ 2. Deep Intel
- Website snapshot alma (headless-free)  
- Title / meta description / headings analizi  
- İçerik snippet değerlendirme  
- SEO on-page rule-based analiz  
- AI tabanlı tam rapor üretme

---

# 📌 3. Technical Architecture

```
/api
  intelRoutes.js

/controller
  intelController.js

/service
  service.js (quick + deep analysis)

 /repo
   repo.js (lead fetch)

 /ai
   lead_intel_analysis.md
   lead_deep_website_analysis.md

 /docs
   INTEL.md
   CHANGELOG.md
```

---

# 📌 4. Data Flow

```
Lead → intel/analyze → AI → Quick SWOT

Lead + Website → intel/deep-analyze
 → Website Snapshot
 → SEO On-Page
 → AI Full Report
 → JSON Output
```

---

# 📌 5. Core Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|-----------|
| **POST** | `/api/intel/analyze` | Hızlı SWOT ve lead analizi |
| **POST** | `/api/intel/deep-analyze` | Website + SEO + SWOT + fırsat analizi |

---

# 📌 6. Dependencies

- shared/ai/llmClient  
- shared/web/fetchWebsite  
- shared/seo/onpageAnalyzer  
- shared/db/sqlite  

---

# 📌 7. AI Prompts

### `lead_intel_analysis.md`
→ Hızlı SWOT + fırsatlar

### `lead_deep_website_analysis.md`
→ Website + SEO → Stratejik rapor  
→ JSON formatını zorunlu kılar  
→ UX, içerik kalitesi, marka konumlandırma gibi kurumsal analiz üretir.

---

# 📌 8. Known Limitations

- Cloudflare Engeli olan sitelerde fetch yapılamayabilir  
- JS-rendered sayfalar analiz edilemez  
- SEO analiz rule-based olduğu için %100 gerçek SERP analizi değildir  
- Çok zayıf içerikli sitelerde AI tahmini sınırlıdır

---

# 📌 9. Future Improvements

- Çok sayfalı crawl  
- SERP analizi (Google Search sonuçlarını işleme)  
- Rakip analiz modülü  
- Müşteriye PDF formatında rapor üretme  
- İçerik kalitesi için NLP scoring (embedding-based)

---

# 📌 10. Versioning History  
(Bkz: CHANGELOG.md)