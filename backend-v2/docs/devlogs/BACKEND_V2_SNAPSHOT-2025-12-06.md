CNG AI Agent – Backend V2 Snapshot (2025-12-06)

Bu döküman, backend-v2 projesinin mevcut mimarisini, modüllerin durumunu, kuralları ve sıradaki işleri özetler.
Yeni bir sohbete yapıştırıldığında, sistemin tamamını hızlıca yeniden yüklemek için referans olarak kullanılacak.

⸻

1. Projenin Ana Amacı

CNG AI Agent Backend V2, ajansın B2B satış süreçlerini uçtan uca destekleyen bir altyapı:
	•	Google Places ve benzeri kaynaklardan potansiyel lead’leri toplar (discovery).
	•	Her lead için dijital istihbarat ve SWOT üretir (intel + research).
	•	Bu verileri kullanarak CNG Intelligence Report (CIR) üretir ve arşivler (research).
	•	Satış ekibi için “Lead Brain / CRM Brain” özetleri çıkarır (crm).
	•	İleride:
	•	Outreach mesajları (WhatsApp / e-posta / IG DM),
	•	WhatsApp entegrasyonu,
	•	Admin & auth,
	•	Global brain vb. ile genişleyecek.

⸻

2. Klasör Mimarisi – Üst Seviye

Root:
	•	data/ → Runtime SQLite DB (şu an: app.sqlite).
	•	docs/
	•	API.md, ARCHITECTURE.md, MODULES.md
	•	devlogs/ → günlük devlog dosyaları (2025-12-02 / 03 / 04-05).
	•	migrate_*.js → migration helper script’leri.
	•	src/ → asıl backend kodu.

src altı:
	•	app.js → Express app tanımı, modül router’ları burada mount ediliyor.
	•	server.js → HTTP server bootstrap.
	•	core/ → config, DB, logger, middleware, migrations.
	•	data/crm.sqlite → ana CRM / lead veritabanı.
	•	jobs/ → migration / import script’leri.
	•	modules/ → feature bazlı modüller.
	•	prompts/ → eski / bazı prompt dosyaları (kısmen modüllere taşındı).
	•	shared/ → ortak AI, SEO, utils katmanı.
	•	tests/ → http / unit test iskeleti (şimdilik boş).

⸻

3. Core & Shared Katmanı

3.1. src/core
	•	config.js → env okuma, temel config.
	•	db.js → crm.sqlite bağlantısı, getDb() fonksiyonu.
	•	logger.js → log helper (şu an konsol ağırlıklı).
	•	http.js → Express app setup helper’ı.
	•	middleware/* → authOptional, authRequired, errorHandler, requestLogger, notFoundHandler.
	•	migrations/*
	•	003_create_lead_search_intel.js
	•	004_create_lead_intel_reports.js

3.2. src/shared
	•	shared/ai/
	•	llmClient.js → OpenAI Responses API wrapper’ı.
	•	promptLoader.js → modül içi prompt dosyalarını okuma helper’ı.
	•	LLM.md + CHANGELOG.md → AI katmanı dökümanı.
	•	shared/seo/onpageAnalyzer.js → basit on-page analiz helper’ı.
	•	shared/web/fetchWebsite.js → website fetch & snapshot.

Bu katman modüller arası ortak: discovery, intel, research, crm hepsi burayı kullanıyor / kullanacak.

⸻

4. Modül Envanteri (Durum Özeti)

Aşağıda src/modules altındaki modüller ve durumları var.

4.1. _template (Şablon)
	•	Dosyalar: routes.js, controller.js, index.js, repo.js, service.js
	•	Amaç: Yeni modül açarken kopyalanacak skeleton.

⸻

4.2. discovery – Lead Keşfi (BİTTİ – v2.x)

Dosyalar
	•	aiRanker.js
	•	controller.js
	•	docs/DISCOVERY.md, docs/CHANGELOG.md
	•	placesClient.js
	•	repo.js
	•	routes.js
	•	service.js

Sorumluluk
	•	Google Places / dış kaynaklardan lead çekme.
	•	AI ile AI score + kategori üretme.
	•	Eski backend’den gelen lead’lerin yeni tabloya taşınmasıyla uyumlu.

Durum
	•	Devlog’larda da geçtiği gibi:
	•	Modern Responses API formatına taşındı.
	•	rankMissingLeads yeniden ayağa kaldırıldı.
	•	Discovery modülü stabil ve üretim için hazır kabul ediliyor.

⸻

4.3. intel – Lead Intel (BİTTİ – v5.x)

Dosyalar
	•	controller.js, routes.js, service.js, repo.js
	•	seoOnpageService.js
	•	docs/INTEL.md, docs/CHANGELOG.md

Sorumluluk
	•	analyzeLead({ leadId }) → basic intel:
	•	SWOT
	•	digital_status
	•	agency_opportunities
	•	priority_score
	•	notes_for_sales
	•	analyzeLeadDeep({ leadId }) (website varsa):
	•	Deep SWOT
	•	website_evaluation
	•	SEO evaluation
	•	agency_opportunities (quick_wins/strategic_projects)
	•	recommended_services

Durum
	•	Responses API’ye tam uyumlu.
	•	Research pipeline için ana bilgi kaynağı olarak kullanılıyor.
	•	Mimari ve dökümanları tamamlanmış durumda.

⸻

4.4. outreach – İlk Temas Mesajları (BİTTİ – v1.1)

Dosyalar
	•	controller.js, routes.js, service.js, repo.js
	•	docs/OUTREACH.md, docs/CHANGELOG.md
	•	first_contact_message.md (modül içi prompt)

Sorumluluk
	•	WhatsApp, e-posta, Instagram DM için ton bazlı ilk mesajlar üretmek.
	•	Premium / kurumsal / samimi ton destekleri.

Durum
	•	Temel ilk temas üreticisi çalışır durumda.
	•	İleride CRM + Research ile daha derin entegre edilebilir (multi-step sequence, follow-up vb.).

⸻

4.5. leadDashboard – Lead Listing (BİTTİ – v1.1 civarı)

Dosyalar
	•	controller.js, routes.js, service.js, repo.js

Sorumluluk
	•	/api/leads ve benzeri endpointlerle:
	•	lead listesi,
	•	sayfalama,
	•	filtreleme,
	•	toplam kayıt sayısı.

Durum
	•	Discovery modülü ile uyumlu çalışacak şekilde güncellendi.
	•	Temel dashboard API olarak stabil.

⸻

4.6. research – CIR: CNG Intelligence Report (BİTTİ – v1.3.0)

Klasör Yapısı
	•	ai/research_master_prompt.md
	•	api/routes.js
	•	controller/controller.js
	•	docs/RESEARCH.md, docs/CHANGELOG.md
	•	repo/researchRepo.js + repo.js (DB erişimi)
	•	service/
	•	researchService.js (ana pipeline)
	•	websearchService.js
	•	socialsService.js
	•	adsService.js
	•	competitorsService.js
	•	benchmarkService.js
	•	(Eski competitorService.js büyük ihtimalle artık kullanılmayan bir dosya, ileride temizlenebilir.)

Ana Pipeline

POST /api/research/full-report için:
	1.	Lead’i DB’den çek (potential_leads).
	2.	intel.analyzeLead + intel.analyzeLeadDeep.
	3.	websearchService.runWebSearch → OSINT web presence.
	4.	socialsService.detectSocials → website HTML + OSINT üzerinden sosyal medya izi (IG, FB, LinkedIn, YouTube, TikTok, vb.), activity_score.
	5.	adsService → pixel / analytics tespiti (Meta Pixel, GA, vb.) → ad_intel.
	6.	competitorsService.findCompetitors → aynı şehir + kategoriye göre rakip listesi + competitor_strength_score.
	7.	benchmarkService.benchmarkLead → pazar farkı: benchmark_score, strengths_vs_market, weaknesses_vs_market.
	8.	Tüm bu raw veri LLM’e gönderilir (research_master_prompt) ve tek bir CIR JSON üretilir.

DB & API
	•	CIR sonuçları lead_intel_reports tablosuna yazılıyor.
	•	potential_leads.last_cir_score & last_cir_created_at alanları güncelleniyor.
	•	Endpoint’ler:
	•	POST /api/research/full-report
	•	GET /api/research/latest/:leadId
	•	GET /api/research/all/:leadId
	•	GET /api/research/history/:leadId → skor ve timestamp listesi.

Durum
	•	Hane Mimarlık (139) ve Two Plus (140) ile test edildi; social + benchmark + ads + intel tüm pipeline çalışıyor.
	•	RESEARCH.md & CHANGELOG.md modül versiyonlamasını takip ediyor (v1.3.0).

⸻

4.7. crm – CRM Brain / Lead Brain (BİTTİ – v1.0.0)

Klasör Yapısı
	•	api/controller.js, api/routes.js
	•	docs/CRM.md, docs/CHANGELOG.md
	•	prompts/crm_brain_summary.md
	•	service/crmBrainService.js
	•	index.js (modül entry)

Endpoint
	•	GET /api/crm/lead-brain/:leadId

Ne Yapıyor?
	1.	potential_leads tablosundan lead’i alıyor.
	2.	Lead’in AI skoruna göre band tanımlıyor (A/B/C vb. – biz şu an 100 → A/yüksek potansiyel örneğini gördük).
	3.	lead_intel_reports tablosundan son CIR kaydını çekiyor:
	•	priority_score
	•	notes_for_sales
	•	tam CIR JSON’u (cir_json) → burada Hane Mimarlık örneğinde tüm SWOT / SEO / social / benchmark geldi.
	4.	Bunlardan ham CRM brain objesini oluşturuyor:
	•	lead
	•	ai_score_band
	•	cir (exists, last_cir_created_at, priority_score, sales_notes, raw CIR).
	5.	Bu brain’i crm_brain_summary.md prompt’u ile LLM’e gönderip, satışçı için kısa bir özet çıkarıyor:
	•	headline
	•	one_line_positioning
	•	why_now
	•	risk_level
	•	ideal_entry_channel
	•	opening_sentence
	•	key_opportunities[]
	•	red_flags[]
	•	recommended_next_actions[]

Örnek Test (139 – Hane Mimarlık)
	•	ai_score_band: A / yüksek potansiyel
	•	CIR’den gelen SWOT + SEO + social verisi aynen geliyor.
	•	LLM özetinde:
	•	“İstanbul’da potansiyeli yüksek, dijital görünürlüğü geliştirilebilir bir mimarlık ofisi”
	•	İdeal giriş kanalı: phone
	•	net “neden şimdi aramalıyız” + aksiyon maddeleri.

Durum
	•	Modül çalışır ve entegre durumda.
	•	LLm entegrasyonu aktif (artık mock değil).
	•	CRM modülü v1.0 hedefi: tek lead için satışçıya “ne, neden, nasıl yaklaşayım?” cevabı vermek → başarıyla karşılanıyor.

⸻

4.8. Diğer Modüller (Şu An İçin Boş / Taslak)
	•	admin/ → şimdilik boş (gelecekte admin panel / config API).
	•	auth/ → auth iskeleti, henüz doldurulmadı.
	•	brain/ → global “CNG Brain” için ayrılmış ama içerik yok.
	•	whatsapp/ → ileride WhatsApp v3 entegrasyonu için.

⸻

4.9. src/prompts Klasörü
	•	prompts/intel/* → eski / ortak intel prompt’ları (modül içine de kopyaları var).
	•	prompts/research/research_master_prompt.md → muhtemelen eski kopya, şu an aktif olan dosya modules/research/ai/research_master_prompt.md.
	•	prompts/outreach/first_contact_message.md → outreach ile ilişkili.
	•	lead/ai_rank_lead.md, seo/, social/, universal/ → diğer amaçlı prompt’lar.

Not: Uzun vadede her modülün kendi içindeki prompts veya ai klasörünü kullanıp, src/prompts içindeki eski kopyaları temizlemek mantıklı.

⸻

5. Ortak Kurallar & Standartlar

Bu projede uyduğumuz kalıcı kurallar:
	1.	Her modülün kendi dokümantasyonu olmak zorunda
	•	modules/<module>/docs/<MODULE>.md
	•	modules/<module>/docs/CHANGELOG.md
	2.	Her kod değişikliğinde CHANGELOG güncellenir
	•	Modül versiyonu (v1.2.0 tarzı) ve tarihle birlikte.
	3.	Tüm AI entegrasyonları shared/ai/llmClient.js üzerinden geçer
	•	Model, input formatı, error handling burada merkezi.
	4.	Prompt dosyaları versiyon kontrollü
	•	Mümkün olduğunca modül içi prompts/ veya ai/ klasöründe.
	5.	Günün sonunda devlog
	•	docs/devlogs/YYYY-MM-DD-*.md formatında.
	6.	Yeni modül açarken _template kullanılacak
	•	api/controller.js, api/routes.js, service/, docs/, prompts/, index.js standardize.
    7.  Her modülün ve önemli dosyaların dökümanında klasör ağacı açıklamalı olarak yer alacak.

⸻

6. Şu Anki Durum & Sıradaki Adımlar

6.1. Tamamlanan Ana Modüller
	•	✅ core (config, db, middleware, logger)
	•	✅ discovery
	•	✅ intel
	•	✅ outreach (v1.1 – ilk temas üreticisi)
	•	✅ leadDashboard
	•	✅ research (CIR v1.3.0, tüm alt modüller)
	•	✅ crm (CRM Brain v1.0.0, LLM summary entegre)

6.2. Teknik Borç / Temizlik
	•	modules/research/service/competitorService.js büyük ihtimalle kullanılmıyor → ileride kaldırılmalı.
	•	src/prompts/research/research_master_prompt.md eski kopya olabilir → aktif kullanılan tek kaynağa indirilmeli (modules/research/ai).
	•	Uzun vadede modül başına tek prompt kaynağı standardize edilecek.

6.3. Gelecek Sprint İçin Olası Odaklar

Bunları yeni sohbette birlikte önceliklendirebiliriz:
	1.	Outreach v2
	•	CRM Brain + CIR verisini kullanarak:
	•	kanal bazlı (WhatsApp / mail / IG) kişiselleştirilmiş mesajlar,
	•	multi-step follow-up sekansları.
	2.	WhatsApp Modülü
	•	modules/whatsapp altında:
	•	mesaj şablonları,
	•	entegrasyon için API taslağı.
	3.	Admin & Auth
	•	modules/admin, modules/auth ile:
	•	basic user/role / API key yönetimi,
	•	feature flag’ler.
	4.	Global Brain (modules/brain)
	•	Tüm lead’ler, kampanyalar, performans üzerinden ajans düzeyinde içgörüler.

⸻

7. Yeni Sohbette Nasıl Devam Edeceğiz?

Yeni chat’te bana şunu yapman yeterli:
	1.	Bu dökümanı aynen kopyala & yapıştır.
	2.	Sonuna da mesela şöyle bir cümle ekle:
“Bu döküman backend-v2’nin güncel durumu. Buradan kaldığımız yer: [seçtiğin modül/sprint]. Hadi devam edelim.”

Ben bunu görünce:
	•	Modül mimarisini,
	•	Hangi modüllerin bittiğini,
	•	CRM + Research + Intel entegrasyonunu,
	•	Kurallarımızı

tek seferde yüklemiş olacağım ve hiç dağılmadan kaldığımız yerden devam edeceğiz.