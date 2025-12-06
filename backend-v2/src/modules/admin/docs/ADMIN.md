# ADMIN MODULE – Full Technical Documentation
**Module Version:** v1.0.0  
**Last Update:** 2025-12-06  
**Maintainer:** CNG AI Agent Backend Team

---

# 📌 1. Purpose

Admin modülü, CNG AI Agent backend’inin **operasyonel kontrol paneli API’si**dir.

Görevi:

- Sistem durumunu (status) raporlamak
- Modül versiyon / health bilgisini tek endpoint’te sunmak
- Environment & feature flag’leri expose etmek
- Frontend admin paneli için backend bilgilerini standardize etmek

---

# 📌 2. Responsibilities

### ✔ 1. System Status
- Node.js sürümü, uptime, memory usage, host bilgisi
- Uygulama adı, versiyon, env, port

### ✔ 2. Module Status
- Tüm çekirdek modüllerin versiyon ve durum bilgisi:
  - discovery, intel, research, crm, leadDashboard, outreach, outreachScheduler, email, whatsapp, auth, admin, brain

### ✔ 3. Config & Feature Flags
- `NODE_ENV`, `PORT`, `OPENAI_MODEL`, `GOOGLE_PLACES_ENABLED` vb.
- Feature flags:
  - `outreachScheduler`
  - `crmBrain`
  - `emailLogging`
  - `whatsappLogging`

### ✔ 4. Overview
- system + modules + db health tek JSON çıktıda birleşir.

---

# 📌 3. Technical Architecture

```bash
src/modules/admin
  ├── api
  │   ├── controller.js
  │   └── routes.js
  ├── service
  │   └── adminService.js
  └── docs
      ├── ADMIN.md
      └── CHANGELOG.md

📌 4. Endpoints

Method
Endpoint
Açıklama
GET
/api/admin/status
Sistem durumunu döner (app + node + host + memory).
GET
/api/admin/modules
Tüm modüllerin versiyon / health durumunu listeler.
GET
/api/admin/config
Env + feature flag configlerini döner.
GET
/api/admin/overview
system + modules + db health birleşik JSON.


📌 5. Sample Responses

🔹 /api/admin/status

{
  "ok": true,
  "data": {
    "app": {
      "name": "cng-ai-agent-backend-v2",
      "version": "1.0.0",
      "env": "development",
      "port": "4000",
      "timestamp": "2025-12-06T14:15:44.151Z",
      "uptime_seconds": 3.79
    },
    "node": {
      "version": "v24.11.1",
      "platform": "darwin",
      "pid": 11330
    },
    "host": {
      "hostname": "Bugra-MacBook-Pro.local",
      "loadavg": [ 2.08, 1.93, 1.90 ],
      "totalmem": 19327352832,
      "freemem": 514129920
    },
    "memory": {
      "rss": 88801280,
      "heapTotal": 36323328,
      "heapUsed": 17049200,
      "external": 3567471,
      "arrayBuffers": 110789
    }
  }
}

🔹 /api/admin/modules

{
  "ok": true,
  "data": [
    { "key": "discovery",         "status": "v2.x — OK" },
    { "key": "intel",             "status": "v5.x — OK" },
    { "key": "research",          "status": "v1.3 — OK" },
    { "key": "crm",               "status": "v1.0 — OK" },
    { "key": "leadDashboard",     "status": "v1.1 — OK" },
    { "key": "outreach",          "status": "v2.0 — OK" },
    { "key": "outreachScheduler", "status": "v0.1 — OK" },
    { "key": "email",             "status": "v0.1 — OK" },
    { "key": "whatsapp",          "status": "v0.1 — OK" },
    { "key": "auth",              "status": "v1.0 — OK" },
    { "key": "admin",             "status": "v1.0 — OK" },
    { "key": "brain",             "status": "pending" }
  ]
}

🔹 /api/admin/config

{
  "ok": true,
  "data": {
    "env": {
      "NODE_ENV": "development",
      "PORT": "4000",
      "OPENAI_MODEL": null,
      "GOOGLE_PLACES_ENABLED": "false"
    },
    "feature_flags": {
      "outreachScheduler": true,
      "crmBrain": true,
      "emailLogging": true,
      "whatsappLogging": true
    }
  }
}

🔹 /api/admin/overview

{
  "ok": true,
  "data": {
    "system": { /* status output */ },
    "modules": { /* module status map */ },
    "db": {
      "ok": false,
      "error": "db health check not implemented"
    }
  }
}

📌 6. Dependencies
	•	os (loadavg, mem)
	•	process (uptime, memoryUsage, env)
	•	core/db (ileride health check için kullanılacak)

⸻

📌 7. Known Limitations
	•	DB health kontrolü şimdilik dummy:
	•	db.ok = false
	•	error: "db health check not implemented"
	•	Admin endpointleri şu an auth korumasız (v1.0); production öncesi JWT + role kontrolü eklenecek.

⸻

📌 8. Future Improvements
	•	DB health implementation:
	•	Basit bir SELECT 1 check
	•	Migration versiyon bilgisi
	•	Auth entegrasyonu:
	•	Sadece admin rolüne açık endpointler
	•	Frontend admin panel ile tam entegrasyon:
	•	Monitoring dashboard
	•	Feature flag toggle

⸻

📌 9. Versioning History

Detaylar için: CHANGELOG.md