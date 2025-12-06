--

## v1.0.0 — 2025-12-06
### 🧩 Initial Admin API
- `/api/admin/status` ile sistem durum endpoint’i eklendi.
- `/api/admin/modules` ile modül versiyon & durum listesi eklendi.
- `/api/admin/config` ile env + feature flag bilgileri expose edildi.
- `/api/admin/overview` ile system + modules + db birleşik çıktı üretildi.
- DB health, şimdilik `"db health check not implemented"` mesajı ile dummy olarak işaretlendi.