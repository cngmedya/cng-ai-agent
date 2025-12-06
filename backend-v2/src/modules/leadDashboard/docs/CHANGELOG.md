
# Lead Dashboard Module – CHANGELOG

---

## v1.2.0 — 2025-12-06
### ⚡ AI Lead Dashboard (FULL BRAIN) Entegrasyonu
- Yeni endpoint: `GET /api/leads/:leadId/ai-dashboard`
- Intel modülü entegrasyonu:
  - `analyzeLead`
  - `analyzeLeadDeep`
- Research / CIR entegrasyonu:
  - `researchService.getLatestCIR(leadId)` ile son CIR kaydı çekilip dashboard’a bağlandı.
- CRM Brain entegrasyonu:
  - `crmBrainService.getLeadBrain(leadId)` ile satış odaklı özet veriler dashboard’a eklendi.
- Outreach v1 entegrasyonu:
  - `generateFirstContact` ile tekil WhatsApp & Email ilk temas mesajları eklendi.
- Outreach v2 entegrasyonu:
  - `generateSequenceForLead` ile çok adımlı WhatsApp sekansı dashboard altında gösterilebilir hale getirildi.
- JSON response standardize edildi:
  - `lead`, `intel`, `research`, `crm`, `outreach` ana blokları tanımlandı.

---

## v1.1.0 — 2025-12-03
### 📊 Gelişmiş Listeleme & Filtreleme
- `/api/leads` endpoint’i için sayfalama (`page`, `limit`) ve toplam kayıt sayısı eklendi.
- Basit filtreleme altyapısı hazırlandı (kategori / şehir gibi alanlar için zemin oluşturuldu).
- Dashboard için temel lead listing API stabil hale getirildi.

---

## v1.0.0 — 2025-12-02
### 🎉 İlk Sürüm
- `leadDashboard` modülü oluşturuldu.
- `/api/leads` endpoint’i ile temel lead listesi döndürülmeye başlandı.
- Modül için bağımsız dokümantasyon ve versiyonlama altyapısı kuruldu.


