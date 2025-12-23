✅ GÜNCEL — RESEARCH.md (v1.4.1)

RESEARCH Module – CNG Intelligence Report (CIR)

Modül Versiyonu: v1.4.1
Amaç: Tek bir lead için çok kaynaklı istihbaratı (intel_basic, intel_deep, web search, sosyal medya, reklam izi, rakipler, benchmark) birleştirip satış ekibi için CNG Intelligence Report (CIR) üretmek ve rapor geçmişini saklamak.

> **Stabilizasyon Notu (2025-12-23):**
> CIR full-report hattında smoke test sırasında kırmızıya düşen senaryolar giderildi.
> DB/migration uyumsuzlukları temizlendi, research → outreach veri akışı stabilize edildi.

⸻

1. Sorumluluklar (Updated)
	•	Lead bazlı tam araştırma pipeline’ı çalıştırmak
	•	Farklı modüllerden gelen verileri toparlamak:
	•	intel_basic
	•	intel_deep
	•	web_presence
	•	social_presence v2.0 (website HTML + OSINT + multi-platform normalizasyon)
	•	ad_intel
	•	competitors
	•	benchmark
	•	Tüm sonuçları CIR Output Standardization Engine ile normalize etmek:
	•	Sektör bağımsız, multi-industry güvenli format
	•	Ortak alanlar: swot, digital_status, seo, agency_opportunities, recommended_services
	•	Sektöre özel ifadeler yasak, modeller sadece lead’in gerçek verisine göre davranır
	•	CIR sonucunu lead_intel_reports tablosuna kaydetmek
	•	Geçmiş rapor skorlarını (history) vermek

⸻

2. Public API

2.1. Routes

POST /api/research/full-report
	•	Body: { "leadId": number }
	•	Çıktı:

{
  "ok": true,
  "data": {
    "leadId": 139,
    "leadName": "Firma",
    "cir": { ... },
    "raw": { ... }
  }
}

	•	Yan Etkiler:
	•	CIR pipeline çalışır
	•	DB’ye rapor kaydı yapılır
	•	last_cir_score + timestamp güncellenir
	•	Aynı lead için ardışık çağrılar idempotent davranır; yeni CIR yalnızca gerekli olduğunda üretilir

GET /api/research/latest/:leadId
	•	En son CIR raporunu döner.

GET /api/research/all/:leadId
	•	Lead için tüm CIR kayıtlarını döner.

GET /api/research/history/:leadId
	•	Skor + timestamp listesi döner:

[
  { "id": 4, "leadId": 139, "created_at": "...", "score": 75 }
]


⸻

3. Alt Modüller (Updated)

### 3.x Pipeline Stabilite & Çalışma Notları

- CIR pipeline smoke test ile doğrulanmıştır.
- CIR üretimi sırasında oluşan tüm DB yazımları transaction-safe kabul edilir.
- CIR başarısız olursa outreach tarafına veri akışı tetiklenmez.

3.1. intel_basic
	•	Fonksiyon: analyzeLead({ leadId })
	•	Çıktılar:
	•	SWOT
	•	Digital status
	•	Sales notes
	•	Kısa & uzun vadeli fırsatlar
	•	Priority score

3.2. intel_deep
	•	Fonksiyon: analyzeLeadDeep({ leadId })
	•	Yalnızca web sitesi varsa çalışır
	•	Çıktılar:
	•	Deep SWOT
	•	Website evaluation
	•	SEO evaluation
	•	Quick wins & strategic projects
	•	Priority score

3.3. Web Search (OSINT)
	•	Fonksiyon: runWebSearch(lead)
	•	Google/Bing sorguları üretir
	•	Sonuçları şu kategorilere ayırır:
	•	directories
	•	news mentions
	•	blog mentions
	•	third-party profiles
	•	risk flags

3.4. Social Presence v2.0 (NEW)
	•	Dosya: socialsService.js
	•	Çıkış standartları:
	•	Website HTML taraması (<a href=""> + JS render fallback)
	•	OSINT sosyal link normalizasyonu
	•	Desteklenen platformlar:
	•	instagram, facebook, linkedin, youtube, tiktok
	•	twitter/x, behance, dribbble, pinterest
	•	Her linkte:

{ "platform": "instagram", "url": "...", "source": "website_html" }


	•	activity_score:
	•	0 → hiçbir platform yok
	•	20 → tek platform
	•	40 → 2 platform
	•	60 → 3+ platform
	•	80 → 4–5 platform
	•	100 → 6+ platform

3.5. Ads Intelligence
	•	Pixel & analytics sinyalleri
	•	ad_intel.active_ads
	•	google_analytics_detected
	•	pixel_detected

3.6. Competitors
	•	Aynı şehir + aynı kategori
	•	0–100 arası rakip güç skoru

3.7. Benchmark
	•	Pazar ortalaması + lead’in konumu
	•	benchmark_score
	•	strengths_vs_market
	•	weaknesses_vs_market

⸻

4. CIR Output Standardization Engine (NEW — v1.4.0)

CIR artık tamamen sektör bağımsız, güvenli ve normalize edilmiş bir JSON formatına sahip.

Tüm başlıklar her sektörde geçerli olacak şekilde standardize edildi:
	•	swot
	•	digital_status
	•	website_evaluation
	•	seo
	•	social_presence
	•	ad_intel
	•	competitors
	•	benchmark
	•	agency_opportunities
	•	recommended_services
	•	priority_score
	•	notes_for_sales

Model çıktılarında:
❗ Belirli sektöre özel ifadeler üretmek yasak
❗ Her lead yalnızca kendi verisiyle değerlendirilecek
❗ CIR hiçbir sektöre ayrıcalıklı yaklaşmayacak

Bu motor researchService.js içinde LLM yanıtı normalize eder.

Bu standart, outreach ve satış modülleri tarafından **tek referans gerçeklik** olarak kabul edilir.
Downstream modüller (outreach, CRM) ham LLM çıktısını değil, yalnızca normalize edilmiş CIR objesini kullanır.

⸻

---

### Değişiklik Geçmişi (Özet)

- **v1.4.1 (2025-12-23)**  
  - CIR full-report smoke test stabilizasyonu  
  - DB/migration uyumsuzluklarının giderilmesi  
  - Outreach entegrasyonu için güvenli davranış
