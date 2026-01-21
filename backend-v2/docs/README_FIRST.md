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

## ⚡ İlk 30 Saniye / Quick Start Checklist

Yeni bir ortamda veya yeni bir sohbette sistemi ayağa kaldırmak için **minimum doğrulama adımları**:

1. **Server’ı başlat**
   ```
   npm start
   ```

2. **Health kontrolü**
   ```
   curl http://localhost:4000/admin/status
   ```

3. **Godmode smoke job oluştur**
   - README’deki Godmode Job Create CURL komutunu kullan

4. **Mini smoke test**
   ```
   ./scripts/smoke_godmode_min.sh
   ```

5. ✅ Mini smoke yeşil ise geliştirmeye devam  
   ❌ Kırmızı ise: **Count → Queue → Worker → Write** zincirini kontrol et

---

# 📌 2. Environment (.env) Dosyası

Aşağıdaki değişkenler sistem için kritiktir:

```
PORT=4000

⚠️ **Not (Bağlayıcı):**
- Bu dosyada **gerçek API key / secret tutulmaz**
- Gerçek anahtarlar **runtime / secret manager** üzerinden enjekte edilir
- `.env` yalnızca **rol, mod, flag ve davranış kontrolü** içindir
```

---

# 📌 3. Database Yapısı

### **Ana Veritabanı Dosyaları**

```
backend-v2/data/app.sqlite       → lead, discovery ve intel için ana DB
backend-v2/data/crm.sqlite       → CRM modülü için ayrı DB
```

### **Kilit Tablolar**

#### GODMODE:
- godmode_jobs
- godmode_job_logs
- godmode_job_results
- godmode_job_progress
- ai_artifacts

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
sqlite3 backend-v2/data/app.sqlite "
SELECT id, job_id, event_type, substr(created_at,1,19)
FROM godmode_job_logs
ORDER BY id DESC LIMIT 20;
"
```

### Belirli job’a göre log:
```
sqlite3 backend-v2/data/app.sqlite "
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

❗ **Kritik Mimari Kural**
GODMODE:
- discovery + enrichment + **AI decision artifact** üretir
- **email / whatsapp / outreach execution yapmaz**
- yalnızca downstream modüller için *intent + veri* üretir

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

❗ **Kanal Stratejisi Notu (Bağlayıcı)**

- İlk ve varsayılan outreach kanalı **EMAIL**’dir
- Bunun nedeni:
  - Her firmanın email adresi vardır
  - WhatsApp / diğer kanallar opsiyoneldir
- GODMODE:
  - Email içeriği **hazırlar** (draft + strateji)
  - **Gönderim yapmaz**
- Email modülü:
  - Provider, credential, retry, delivery, bounce süreçlerinin **tek sorumlusudur**

---

# 📌 7. Manuel DB Silme / Reset Notları

### **Yanlış DB dosyasını silme riski!**

**Doğru DB yolu:**
```
backend-v2/data/app.sqlite
backend-v2/data/crm.sqlite
```

Eğer DB yenilemek istenirse:
```
rm backend-v2/data/app.sqlite
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
tam bağlamlı şekilde hafızama yükleyeceğim ve
ARCHITECTURE / MODULES / ROADMAP / ZEROPOINT ile **çelişmeyen**
bir çalışma başlatacağım.

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

### Execution Mode & Guardrails Özeti

Outreach ve Email zinciri **korumalı (guarded)** şekilde çalışır:

- `send_now` → Gerçek gönderim (prod / kontrollü)
- `dry_run` → Gönderilmiş gibi raporlanır, **gerçek send yok**
- Guardrails:
  - Günlük limit (daily cap)
  - Kill-switch (acil durdurma)
  - Policy block (DB log’lu)

Bu mekanizmalar:
- Mini smoke testte
- Full smoke testte

ayrı ayrı doğrulanır.

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

---

## 📌 11. Mini Smoke Test (Godmode Odaklı)

Küçük faz geçişleri ve hızlı regresyon kontrolü için kullanılır.

### Kapsam
- Godmode discovery job create/run
- AI decision artifacts üretimi
- Outreach auto-trigger (enqueue / dry-run)
- Guardrails (cap / kill-switch)

### Çalıştırma
```
./scripts/smoke_godmode_min.sh
```

⚠️ **Kural:**
- Mini smoke → *faz içi doğrulama*
- Full smoke → *faz kapatma gate’i*
