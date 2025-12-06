
# CHANGELOG – CRM Module

## [1.0.0] – 2025-12-06
### 🎉 CRM Brain Engine İlk Sürüm

- `/api/crm/lead-brain/:leadId` endpoint’i eklendi.
- Lead kartı verileri şekillendirildi (`buildLeadObject`).
- AI Score bantlama sistemi eklendi (`scoreBand` → A / B / C / D).
- CIR entegrasyonu tamamlandı:
  - Son CIR raporu tespit ediliyor.
  - priority_score + sales_notes + raw CIR çıktısı CRM Brain’e bağlandı.
- LLM tabanlı satış özeti üretildi:
  - headline
  - positioning
  - why_now
  - opening_sentence
  - entry_channel
  - key_opportunities
  - red_flags
  - recommended_next_actions
- Prompt sistemi kuruldu (`crm_brain_summary.md`).
- Discovery/LLM fallback sistemi eklendi (LLM kapalıyken fake summary döner).
- Dosya yapısı standardize edildi ve dökümante edildi.

---

## Gelecek Planlanan Sürümler

### [1.1.0] (Planlanan)
- Lead rekabet girdisi (competitors) CRM Brain’e eklenebilir.
- CRM Brain scoring v2 (CIR + AI Score + Social Activity + Ad Intel).
- Lead “urgency score” hesaplanması.

### [1.2.0] (Planlanan)
- Lead lifecycle & pipeline aşaması (cold → warm → hot).
- Otomatik outreach önerileri.