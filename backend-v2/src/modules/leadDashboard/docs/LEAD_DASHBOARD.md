

# LEAD DASHBOARD MODULE – Full Technical Documentation
**Module Version:** v1.2.0  
**Last Update:** 2025-12-06  
**Maintainer:** CNG AI Agent Backend Team

---

## 📌 1. Purpose

`leadDashboard` modülü, tek bir endpoint üzerinden **lead’in tüm yapay zeka beynini** toplayan orkestrasyon katmanıdır.

Amaç:

- CRM / satış ekibi için **tek API çağrısıyla**:
  - Lead meta verisi
  - Intel basic + deep analizler
  - CIR (CNG Intelligence Report) çıktıları
  - CRM Brain özetleri
  - Outreach v1 (tek mesajlar)
  - Outreach v2 (multi-step sekans)

sunmak.

Bu sayede frontend tarafında “AI Lead Savaş Haritası” ekranı inşa edilebilir.

---

## 📁 2. Module Folder Structure

```txt
src/modules/leadDashboard
  ├── controller.js
  ├── repo.js
  ├── routes.js
  ├── service.js
  └── docs
      ├── LEAD_DASHBOARD.md
      └── CHANGELOG.md


⸻

📌 3. Responsibilities

3.1. Lead Listing & Pagination
	•	Basit lead listeleme ve filtreleme (/api/leads)
	•	Sayfalama (limit, page)
	•	Toplam kayıt sayısı döndürme

(v1.0.0 – v1.1.0 döneminin çekirdek fonksiyonu)

3.2. AI Lead Dashboard (FULL BRAIN)

Yeni v1.2.0 sürümü ile:
	•	Tek lead için aşağıdakileri toplar:

	1.	Lead Meta
	•	potential_leads tablosundan:
	•	id, name, address, city, country, category, phone, website
	•	ai_score, ai_notes
	•	last_cir_score, last_cir_created_at
	2.	Intel Basic & Deep
	•	intel modülünden:
	•	analyzeLead({ leadId })
	•	analyzeLeadDeep({ leadId })
	•	Çıktı:
	•	SWOT
	•	digital_status
	•	website_evaluation
	•	SEO skorları
	•	agency_opportunities
	•	recommended_services
	3.	Research / CIR (CNG Intelligence Report)
	•	research modülünden:
	•	getLatestCIR(leadId)
	•	Çıktı:
	•	CIR JSON (cir_json)
	•	priority_score
	•	sales_notes
	•	social_presence, ad_intel, web_presence, benchmark
	4.	CRM Brain
	•	crm modülünden:
	•	getLeadBrain(leadId)
	•	Çıktı:
	•	ai_score_band
	•	CIR özet bilgileri
	•	lead_brain_summary (headline, why_now, risk_level, opportunities, red_flags, next_actions)
	5.	Outreach Engine v1 & v2
	•	outreach modülünden:
	•	generateFirstContact({ leadId, channel, tone, language })
	•	generateSequenceForLead({ leadId, channel, tone, language, objective, max_followups })
	•	Çıktı:
	•	WhatsApp premium ilk mesaj
	•	Email kurumsal ilk mesaj
	•	WhatsApp çok adımlı sekans (initial + follow_up mesajlar)

⸻

🔌 4. API Endpoints

4.1. Lead Listing

Method	Endpoint	Açıklama
GET	/api/leads	Lead listesi + sayfalama + toplam kayıt

Query parametreleri:
	•	page → sayfa numarası (default: 1)
	•	limit → sayfa başına kayıt (default: 20)

Örnek:

curl "http://localhost:4000/api/leads?page=1&limit=20"


⸻

4.2. AI Lead Dashboard (FULL BRAIN)

Method	Endpoint	Açıklama
GET	/api/leads/:leadId/ai-dashboard	Lead için tam AI beyni (intel + CIR + CRM + outreach)

Örnek:

curl "http://localhost:4000/api/leads/139/ai-dashboard" \
  -H "Content-Type: application/json"

Response (özet şema):

{
  "ok": true,
  "data": {
    "lead": { /* potential_leads row + last_cir_* alanları */ },
    "intel": {
      "basic": { "ok": true, "json": { /* swot, digital_status, ... */ } },
      "deep": { "ok": true, "json": { /* website_evaluation, seo, ... */ } }
    },
    "research": {
      "exists": true,
      "last_cir_created_at": "...",
      "priority_score": 75,
      "sales_notes": "...",
      "cir_json": { /* full CIR JSON */ }
    },
    "crm": {
      "lead": { /* crm için minimal lead snapshot */ },
      "ai_score_band": { "score": 100, "band": "A", "label": "yüksek potansiyel" },
      "cir": { /* CIR meta + raw */ },
      "summary": {
        "ok": true,
        "json": {
          "lead_brain_summary": {
            "headline": "...",
            "one_line_positioning": "...",
            "why_now": "...",
            "risk_level": "...",
            "ideal_entry_channel": "...",
            "key_opportunities": [],
            "red_flags": [],
            "recommended_next_actions": []
          }
        }
      }
    },
    "outreach": {
      "whatsapp_tr_premium": { /* tek mesaj */ },
      "email_tr_kurumsal": { /* konu + gövde */ },
      "whatsapp_sequence_tr_kurumsal": {
        "sequence": [
          { "step": 1, "type": "initial", "send_after_hours": 0, "message": "..." },
          { "step": 2, "type": "follow_up", "send_after_hours": 48, "message": "..." },
          { "step": 3, "type": "follow_up", "send_after_hours": 72, "message": "..." }
        ]
      }
    }
  }
}


⸻

🧠 5. Internal Architecture

5.1. controller.js
	•	leadAiDashboardHandler(req, res, next)
	•	req.params.leadId alır
	•	service.getLeadAiDashboard({ leadId }) çağırır
	•	res.json({ ok: true, data }) döner

5.2. service.js

Ana akış:

async function getLeadAiDashboard({ leadId }) {
  const lead = getLeadById(leadId);

  const intelBasic = await intelService.analyzeLead({ leadId });
  const intelDeep = await intelService.analyzeLeadDeep({ leadId }).catch(() => null);

  const latestCIR = researchService.getLatestCIR(leadId);
  const crmBrain = await crmService.getLeadBrain(leadId);

  const whatsappPremium = await outreachService.generateFirstContact(...);
  const emailKurumsal = await outreachService.generateFirstContact(...);
  const outreachSeq = await outreachService.generateSequenceForLead(...);

  return { lead, intel, research, crm, outreach };
}

5.3. repo.js
	•	getLeadById(id) → potential_leads tablosundan tek kayıt döner.
	•	Gelecekte:
	•	Basit filtreleme
	•	Segment bazlı listeler için genişletilebilir.

⸻

⚠️ 6. Known Limitations
	•	ai-dashboard endpoint’i CPU / token maliyeti yüksek modüllerin çıktısını tek pakette döner; çok sık ve çok sayıda lead için eşzamanlı kullanılırsa LLM maliyeti dikkatle yönetilmelidir.
	•	Şu an sadece son CIR kaydı (getLatestCIR) üzerinden çalışır:
	•	Tarih bazlı filtreleme / versiyon seçimi yok.
	•	Outreach sekansı:
	•	Sadece WhatsApp / TR / kurumsal ton için entegre örnek.
	•	İleride kanal/ton/dil parametreleri dinamikleştirilebilir.

⸻

🚀 7. Future Improvements
	•	/api/leads/:leadId/ai-dashboard?mode=light
	•	Sadece meta + özet + tek mesajlar (düşük maliyet).
	•	/api/leads/:leadId/ai-dashboard/history
	•	CIR skor history + trend analizi grafiği için uygun JSON.
	•	Segment bazlı dashboard:
	•	/api/leads/dashboard/portfolio → birden fazla lead’in AI özetleri.

⸻

📚 8. Versioning

Detaylar için CHANGELOG.md dosyasına bakınız.

---

