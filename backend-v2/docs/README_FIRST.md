# README_FIRST.md — CNG AI Agent Backend V2
Bu dosya, tüm sistemi yeniden hatırlamak ve yeni bir sohbete geçtiğimizde **kritik bilgileri hızlıca yüklemek** için oluşturulmuştur.  
Backend-V2’nin çalışması, portlar, environment değişkenleri, API anahtarları, DB yapısı, test komutları ve hayati operasyonel bilgiler burada tutulur.

---

# 📌 1. Sistem Genel Bilgiler

### **Backend Port**
- Sistem **4000 portunda** çalışır.
- Başlatma komutu:
```
npm start

"bsc" komutu githuba push commit yapar
```

### **Sunucu Framework**
- Node.js (v24)
- Express.js
- better-sqlite3 (DB)
- OpenAI / LLM entegrasyonu (shared/ai)

### **Ana Entry Points**
- `src/server.js`
- `src/app.js`

---

# 📌 2. Environment (.env) Dosyası

Aşağıdaki değişkenler sistem için kritiktir:

```
PORT=4000


⚠️ **Not:** Bu dosyada gerçek anahtar saklama! Sadece roller listesi burada bulunur.

---

# 📌 3. Database Yapısı

### **Ana Veritabanı Dosyaları**

```
src/data/app.sqlite       → lead, discovery ve intel için ana DB
src/data/crm.sqlite       → CRM modülü için ayrı DB
```

### **Kilit Tablolar**

#### GODMODE:
- `godmode_jobs`
- `godmode_job_logs`
- `godmode_job_results`
- `godmode_job_progress`

#### LEAD PIPELINE:
- `potential_leads`
- `lead_search_intel`
- `lead_intel_reports`
- `lead_crm_brains`
- `lead_crm_notes`

#### OUTREACH:
- v2.1 motor kullanır, DB kaydı yok  
(gelecekte `outreach_jobs`)

#### EMAIL:
- `email_logs`

#### WHATSAPP:
- `whatsapp_logs`

---

# 📌 4. Godmode Test CURL Komutları

### **Job Create**
```
curl -s -X POST "http://localhost:4000/api/godmode/jobs/discovery-scan" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Smoke Test",
    "city": "İstanbul",
    "country": "Türkiye",
    "categories": ["mimarlık ofisi"],
    "minGoogleRating": 3.5,
    "maxResults": 10,
    "channels": ["google_places"],
    "notes": "smoke-test"
  }' | jq
```

### **Job Run**
```
curl -s -X POST "http://localhost:4000/api/godmode/jobs/<JOB_ID>/run" | jq
```

### **Job Details**
```
curl -s "http://localhost:4000/api/godmode/jobs/<JOB_ID>" | jq
```

---

# 📌 5. Job Log Kontrol Komutları

### Tüm loglar (son 20)
```
sqlite3 src/data/app.sqlite "
SELECT id, job_id, event_type, substr(created_at,1,19)
FROM godmode_job_logs
ORDER BY id DESC LIMIT 20;
"
```

### Belirli job’a göre log:
```
sqlite3 src/data/app.sqlite "
SELECT id, event_type, created_at
FROM godmode_job_logs
WHERE job_id = '<JOB_ID>'
ORDER BY id;
"
```

---

# 📌 6. Sistemde Önemli Pipeline'lar

### **Godmode Discovery Engine**
- Provider Runner → Google Places
- Discovery Pipeline → normalization
- UPSERT → `potential_leads`
- Summary Builder → job sonuçları
- Worker Stub → `dataFeederWorker`

### **Research Pipeline (CIR v1.4.0)**
- intel_basic
- intel_deep
- web search
- social presence v2.0
- competitors
- benchmark
- CIR normalization

### **Outreach v2.1**
- first-contact motoru (v1)
- multi-step sequence motoru (v2)
- strict JSON output

---

# 📌 7. Manuel DB Silme / Reset Notları

### **Yanlış DB dosyasını silme riski!**

**Doğru DB yolu:**
```
src/data/app.sqlite
src/data/crm.sqlite
```

Eğer DB yenilemek istenirse:
```
rm src/data/app.sqlite
npm start
```
→ Tüm tablolar kendisi yeniden oluşur.

---

# 📌 8. Kritik Teknik Notlar

- `godmodeService.getJobById` sorunu düzeltildi (service → repo mapping)
- Provider errors artık normalize ediliyor
- `used_categories` correct fallback: criteria.categories
- DB dosyasının *yanlış klasörde oluşması* eski sorundu → çözülmüş durumda
- Worker mekanizması v1 stub çalışıyor

---

# 📌 9. Yeni Sohbet Başlangıç Komutu

Yeni bir sohbette, bana sadece:

```
Sistemi yükle
```

demen yeterli.

Ben de bu README_FIRST.md dosyasını okuyarak:
- Portu
- DB yollarını
- Godmode test komutlarını
- CIR pipeline özelliklerini
- Outreach motor mantığını
- Env değişkenlerini
%100 hafızama yükleyeceğim.

---

## 📌 10. Smoke Test (smoke_test.sh)

Sistem bütünlüğünü hızlıca test etmek için hazırlanmış tam otomatik bir script’tir.  
Aşağıdaki alanlarda backend’in çalıştığını doğrular:

- Admin status
- Godmode discovery (job create + run + summary)
- Email test log
- WhatsApp test log
- Outreach v1 first-contact
- Outreach v2 sequence
- Outreach Scheduler enqueue
- Research CIR full-report

### **Çalıştırma Komutu**
```
./scripts/smoke_test.sh
```

### **LEAD_ID Override**
Bazı testler varsayılan olarak leadId=1 üzerinden çalışır.  
Farklı lead denemek için:

```
LEAD_ID_OVERRIDE=123 ./scripts/smoke_test.sh
```

### **Script Konumu**
```
backend-v2/scripts/smoke_test.sh
```

- Do not modify any other part of the file.
