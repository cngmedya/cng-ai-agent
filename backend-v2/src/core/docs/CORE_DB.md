# Core / DB System — v1.2.0

DB katmanı migration sistemi, schema yönetimi ve lifecycle kontrolünü sağlar.

---

## 🏗 Dosya Yapısı
- `core/db.js`
- `migrations/001_create_leads_table.js`
- `migrations/...`

---

## 🔥 Özellikler
- Migration runner
- Auto-init
- Migration tekrar çalıştırmayı engelleyen `migrations` tablosu
- Eski DB → yeni DB taşımaya uygun yapı

---

# 📌 CHANGELOG (v1.2.0)

## Added
- Migration runner
- Schema auto-initializer
- Research + Discovery uyumluluğu

## Version
```
v1.2.0
```