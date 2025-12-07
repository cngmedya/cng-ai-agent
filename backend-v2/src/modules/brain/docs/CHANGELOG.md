
# Brain Module – CHANGELOG

## v1.0.0 – İlk Stabil Sürüm

- `/api/brain/lead/:id` endpoint’i eklendi:
  - CRM lead bilgisi
  - AI score band
  - CIR / research raw JSON (SWOT, SEO, agency_opportunities, recommended_services, social_presence, ad_intel, web_presence, benchmark)
  - Brain summary nesnesi
- `/api/brain/lead/:id/summary` endpoint’i eklendi:
  - Lead için kısa “Sales Brain Summary”
  - Headline, one_line_positioning, why_now, risk_level, ideal_entry_channel
  - Recommended next actions
- Admin modülünde brain statüsü:
  - `brain: 'v1.0 — OK'` olarak işaretlendi.
- Feature flag:
  - `crmBrain: true` ile sistemde aktif hale getirildi.