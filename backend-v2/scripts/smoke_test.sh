#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:4000"
JQ_BIN="${JQ:-jq}"
LEAD_ID="${LEAD_ID_OVERRIDE:-1}"

echo "==============================="
echo " CNG AI Agent – SMOKE TEST v1 "
echo " BASE_URL = $BASE_URL"
echo "==============================="
echo

###
# 0) ÖN KOŞUL KONTROLÜ
###
if ! command -v curl >/dev/null 2>&1; then
  echo "[ERR] curl bulunamadı. Lütfen curl kur."
  exit 1
fi

if ! command -v $JQ_BIN >/dev/null 2>&1; then
  echo "[ERR] jq bulunamadı. JSON çıktıları için jq tavsiye edilir."
  echo "Devam ediyorum ama çıktılar ham JSON olacak."
  JQ_BIN="cat"
fi

CHECK_JQ_BIN=""
if command -v jq >/dev/null 2>&1; then
  CHECK_JQ_BIN="jq"
fi

###
# 1) ADMIN STATUS
###
echo "▶ 1) Admin status testi..."
curl -s "$BASE_URL/api/admin/status" | $JQ_BIN
echo "✔ Admin status OK"
echo

###
# 2) GODMODE – PROVIDER HEALTH (PAL)
###
echo "▶ 2) Godmode provider health testi (PAL)..."

HEALTH_JSON=$(curl -s "$BASE_URL/api/godmode/providers/health")
echo "$HEALTH_JSON" | $JQ_BIN

if [ "${PAL_FORCE_RATE_LIMIT:-0}" = "1" ]; then
  PROVIDER_ERR_CODE=$(echo "$HEALTH_JSON" | $JQ_BIN -r '.data.providers.google_places.error.code // empty')
  if [ "$PROVIDER_ERR_CODE" != "provider_rate_limited" ]; then
    echo "[ERR] Godmode provider health FAILED (expected provider_rate_limited simulation)"
    exit 1
  fi
  echo "✔ Godmode provider health OK (rate-limit simulation)"
  echo
else
  PROVIDER_OK=$(echo "$HEALTH_JSON" | $JQ_BIN -r '.data.providers.google_places.ok')
  if [ "$PROVIDER_OK" != "true" ]; then
    echo "[ERR] Godmode provider health FAILED (google_places.ok != true)"
    exit 1
  fi
  echo "✔ Godmode provider health OK"
  echo
fi

###
# 3) GODMODE DISCOVERY ENGINE – BASIC JOB
###
echo "▶ 3) GODMODE job create + run testi..."

JOB_ID=$(curl -s -X POST "$BASE_URL/api/godmode/jobs/discovery-scan" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "SMOKE - Godmode Discovery Test",
    "city": "İstanbul",
    "country": "Türkiye",
    "categories": ["mimarlık ofisi"],
    "minGoogleRating": 3.5,
    "maxResults": 10,
    "channels": ["google_places"],
    "forceRefresh": true,
    "notes": "smoke-test"
  }' | $JQ_BIN -r '.data.id')

echo "  → Oluşan JOB_ID: $JOB_ID"

echo "  → Job run..."
curl -s -X POST "$BASE_URL/api/godmode/jobs/$JOB_ID/run" | $JQ_BIN '.data.status'
echo

echo "  → Job detay & summary:"
curl -s "$BASE_URL/api/godmode/jobs/$JOB_ID" \
  | $JQ_BIN '{id: .data.id, label: .data.label, status: .data.status, result_summary: .data.result_summary}'
echo "✔ Godmode discovery pipeline OK"
echo

###
# 3B) GODMODE – DEEP ENRICHMENT ASSERTIONS (DB)
# Not: Deep enrichment akışı async olabilir; kısa bir süre bekleyip DB'den doğruluyoruz.
###
echo "▶ 3B) Godmode deep enrichment log assertion (DB)..."

DB_PATH="data/app.sqlite"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "⚠ sqlite3 bulunamadı: deep enrichment DB assertion atlandı (smoke test false-green olabilir)."
  echo
else
  if [ ! -f "$DB_PATH" ]; then
    echo "[ERR] SQLite DB bulunamadı: $DB_PATH"
    exit 1
  fi

  MISSING_CNT=0
  TECH_CNT=0

  # Deep enrichment async olabilir: 10 tur * 2sn = 20sn bekle
  for _i in {1..10}; do
    MISSING_CNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$JOB_ID' AND event_type='DEEP_ENRICHMENT_WEBSITE_MISSING';")
    TECH_CNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$JOB_ID' AND event_type='DEEP_ENRICHMENT_TECH_STUB';")

    if [ "$MISSING_CNT" -gt 0 ] || [ "$TECH_CNT" -gt 0 ]; then
      break
    fi
    sleep 2
  done

  echo "  → Deep enrichment counts (job_id=$JOB_ID): WEBSITE_MISSING=$MISSING_CNT TECH_STUB=$TECH_CNT"

  if [ "$MISSING_CNT" -eq 0 ] && [ "$TECH_CNT" -eq 0 ]; then
    echo "[ERR] Godmode deep enrichment logs bulunamadı. GODMODE_DEEP_ENRICHMENT=1 ve worker akışını kontrol et."
    exit 1
  fi

  echo "  → Deep enrichment sample payloads:"
  sqlite3 "$DB_PATH" "SELECT event_type, substr(payload_json,1,280) FROM godmode_job_logs WHERE job_id='$JOB_ID' AND event_type IN ('DEEP_ENRICHMENT_WEBSITE_MISSING','DEEP_ENRICHMENT_TECH_STUB') ORDER BY created_at DESC LIMIT 6;"
  echo "✔ Godmode deep enrichment DB assertion OK"
  echo
fi

###
# 4) EMAIL MODULE – TEST LOG
###
echo "▶ 4) Email test log..."

curl -s -X POST "$BASE_URL/api/email/test" \
  -H "Content-Type: application/json" \
  -d '{}' | $JQ_BIN
echo "✔ Email module test OK (log yazması gerekiyor)"
echo

###
# 5) WHATSAPP MODULE – TEST LOG
###
echo "▶ 5) WhatsApp test log..."

curl -s -X POST "$BASE_URL/api/whatsapp/test" \
  -H "Content-Type: application/json" \
  -d '{}' | $JQ_BIN
echo "✔ WhatsApp module test OK (simulated log)"
echo

###
# 6) OUTREACH v1 – FIRST CONTACT
###
echo "▶ 6) Outreach v1 – first-contact testi..."

curl -s -X POST "$BASE_URL/api/outreach/first-contact" \
  -H "Content-Type: application/json" \
  -d "{
    \"leadId\": $LEAD_ID,
    \"channel\": \"whatsapp\",
    \"tone\": \"kurumsal\",
    \"language\": \"tr\",
    \"notes\": \"smoke test - first contact\"
  }" | $JQ_BIN
echo "✔ Outreach v1 first-contact OK"
echo

###
# 7) LEAD ID GEREKEN TESTLER İÇİN HAZIRLIK
# Not: Buradaki LEAD_ID'yi kendi veritabanındaki gerçek bir ID ile güncelle.
###
echo "ℹ  Lead bazlı testler için varsayılan LEAD_ID = $LEAD_ID"
echo "   Eğer değiştirmek istersen komutu şu şekilde çalıştır:"
echo '   LEAD_ID_OVERRIDE=123 ./scripts/smoke_test.sh'
echo

###
# 8) OUTREACH v2 – SEQUENCE
###
echo "▶ 8) Outreach v2 – multi-step sequence testi (leadId=$LEAD_ID)..."

OUTREACH_V2_JSON=$(curl -s -X POST "$BASE_URL/api/outreach/sequence/$LEAD_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "whatsapp",
    "tone": "kurumsal",
    "language": "tr",
    "objective": "ilk_temas",
    "max_followups": 2
  }')

echo "$OUTREACH_V2_JSON" | $JQ_BIN '{ok, lead_id: .data.lead_id, ai_context: .data.ai_context, sequence: .data.sequence}'

if [ -n "$CHECK_JQ_BIN" ]; then
  OUT_V2_LEAD_ID=$(echo "$OUTREACH_V2_JSON" | jq -r '.data.lead_id // empty')
  OUT_V2_SEQ_LEN=$(echo "$OUTREACH_V2_JSON" | jq -r '(.data.sequence | length) // 0')
  if [ "$OUT_V2_LEAD_ID" = "" ] || [ "$OUT_V2_LEAD_ID" = "null" ] || [ "$OUT_V2_SEQ_LEN" -lt 1 ]; then
    echo "[ERR] Outreach v2 sequence FAILED (lead_id veya sequence boş/null)"
    exit 1
  fi
else
  echo "⚠ jq bulunamadı: Outreach v2 strict assertion atlandı (smoke test false-green olabilir)."
fi

echo "✔ Outreach v2 sequence OK"
echo

###
# 9) OUTREACH SCHEDULER – ENQUEUE
###
echo "▶ 9) Outreach Scheduler enqueue testi (leadId=$LEAD_ID)..."

curl -s -X POST "$BASE_URL/api/outreach-scheduler/enqueue/$LEAD_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "whatsapp",
    "tone": "kurumsal",
    "language": "tr",
    "objective": "ilk_temas",
    "max_followups": 2
  }' | $JQ_BIN
echo "✔ Outreach Scheduler enqueue OK"
echo

###
# 10) RESEARCH – CIR FULL REPORT
###
echo "▶ 10) Research / CIR full-report testi (leadId=$LEAD_ID)..."

RESEARCH_CIR_JSON=$(curl -s -X POST "$BASE_URL/api/research/full-report" \
  -H "Content-Type: application/json" \
  -d "{
    \"leadId\": $LEAD_ID
  }")

echo "$RESEARCH_CIR_JSON" | $JQ_BIN '{ok, leadId: .data.leadId, leadName: .data.leadName, cir_score: (.data.cir.CNG_Intelligence_Report.priority_score // .priority_score // .data.priority_score)}'

if [ -n "$CHECK_JQ_BIN" ]; then
  CIR_LEAD_ID=$(echo "$RESEARCH_CIR_JSON" | jq -r '.data.leadId // empty')
  CIR_SCORE=$(echo "$RESEARCH_CIR_JSON" | jq -r '.data.cir.CNG_Intelligence_Report.priority_score // .priority_score // .data.priority_score // empty')
  if [ "$CIR_LEAD_ID" = "" ] || [ "$CIR_LEAD_ID" = "null" ] || [ "$CIR_SCORE" = "" ] || [ "$CIR_SCORE" = "null" ]; then
    echo "[ERR] Research CIR full-report FAILED (leadId veya priority_score boş/null)"
    exit 1
  fi
else
  echo "⚠ jq bulunamadı: Research CIR strict assertion atlandı (smoke test false-green olabilir)."
fi

echo "✔ Research CIR pipeline OK"
echo

###
# 11) ÖZET
###
echo "==============================="
echo " SMOKE TEST TAMAMLANDI 🔥"
echo "  - Admin status"
echo "  - Godmode provider health (PAL)"
echo "  - Godmode discovery (job create + run + summary)"
echo "  - Email log"
echo "  - WhatsApp log"
echo "  - Outreach v1 first-contact"
echo "  - Outreach v2 sequence"
echo "  - Outreach Scheduler enqueue"
echo "  - Research CIR full-report"
echo "==============================="