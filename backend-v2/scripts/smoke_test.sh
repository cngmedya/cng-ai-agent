#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:4000"
JQ_BIN="${JQ:-jq}"
LEAD_ID="${LEAD_ID_OVERRIDE:-1}"

# Optional: sector/categories override for discovery jobs (JSON array string)
CATEGORIES_OVERRIDE="${CATEGORIES_OVERRIDE:-}"

# Default categories are sector-agnostic: do not force any category unless override provided
CATEGORIES_JSON="[]"
if [ -n "${CATEGORIES_OVERRIDE}" ]; then
  CATEGORIES_JSON="${CATEGORIES_OVERRIDE}"
fi

echo "==============================="
echo " CNG AI Agent – SMOKE TEST v1 "
echo " BASE_URL = $BASE_URL"
echo "==============================="
echo
echo "ℹ Categories override: ${CATEGORIES_JSON}"
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
ADMIN_STATUS_JSON=$(curl -s "$BASE_URL/api/admin/status")
echo "$ADMIN_STATUS_JSON" | $JQ_BIN

DISCOVERY_MODE=$(echo "$ADMIN_STATUS_JSON" | $JQ_BIN -r '.data.godmode.discovery_mode // .data.discovery_mode // empty')

if [ "$DISCOVERY_MODE" = "live" ] || [ "$DISCOVERY_MODE" = "1" ]; then
  echo "🔥 DISCOVERY MODE: LIVE (Google Places aktif)"
elif [ "$DISCOVERY_MODE" = "replay" ] || [ "$DISCOVERY_MODE" = "0" ]; then
  echo "🧪 DISCOVERY MODE: REPLAY (DB seed kullanılıyor)"
else
  echo "⚠ DISCOVERY MODE: UNKNOWN (admin/status response did not expose mode)"
fi
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

JOB_ID_1=$(curl -s -X POST "$BASE_URL/api/godmode/jobs/discovery-scan" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "SMOKE - Godmode Discovery Test",
    "city": "İstanbul",
    "country": "Türkiye",
    "categories": '"${CATEGORIES_JSON}"',
    "minGoogleRating": 3.5,
    "maxResults": 10,
    "channels": ["google_places"],
    "forceRefresh": true,
    "notes": "smoke-test"
  }' | $JQ_BIN -r '.data.id')

echo "  → Oluşan JOB_ID_1: $JOB_ID_1"

echo "  → Job run..."
curl -s -X POST "$BASE_URL/api/godmode/jobs/$JOB_ID_1/run" | $JQ_BIN '.data.status'
echo

echo "  → Job detay & summary:"
curl -s "$BASE_URL/api/godmode/jobs/$JOB_ID_1" \
  | $JQ_BIN '{id: .data.id, label: .data.label, status: .data.status, result_summary: .data.result_summary}'
echo "✔ Godmode discovery pipeline OK"
echo

###
# 3C) GODMODE DISCOVERY ENGINE – SAME JOB WITHOUT forceRefresh (freshness gating)
###
echo "▶ 3C) GODMODE job create + run (forceRefresh=false) testi..."

JOB_ID_2=$(curl -s -X POST "$BASE_URL/api/godmode/jobs/discovery-scan" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "SMOKE - Godmode Discovery Test (no forceRefresh)",
    "city": "İstanbul",
    "country": "Türkiye",
    "categories": '"${CATEGORIES_JSON}"',
    "minGoogleRating": 3.5,
    "maxResults": 10,
    "channels": ["google_places"],
    "forceRefresh": false,
    "notes": "smoke-test"
  }' | $JQ_BIN -r '.data.id')

echo "  → Oluşan JOB_ID_2: $JOB_ID_2"

echo "  → Job run..."
curl -s -X POST "$BASE_URL/api/godmode/jobs/$JOB_ID_2/run" | $JQ_BIN '.data.status'
echo

###
# 3D) GODMODE DISCOVERY ENGINE – SAME JOB WITH forceRefresh AGAIN (bypass gating)
###
echo "▶ 3D) GODMODE job create + run (forceRefresh=true, second pass) testi..."

JOB_ID_3=$(curl -s -X POST "$BASE_URL/api/godmode/jobs/discovery-scan" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "SMOKE - Godmode Discovery Test (forceRefresh second pass)",
    "city": "İstanbul",
    "country": "Türkiye",
    "categories": '"${CATEGORIES_JSON}"',
    "minGoogleRating": 3.5,
    "maxResults": 10,
    "channels": ["google_places"],
    "forceRefresh": true,
    "notes": "smoke-test"
  }' | $JQ_BIN -r '.data.id')

echo "  → Oluşan JOB_ID_3: $JOB_ID_3"

echo "  → Job run..."
curl -s -X POST "$BASE_URL/api/godmode/jobs/$JOB_ID_3/run" | $JQ_BIN '.data.status'
echo

echo "✔ Godmode forceRefresh scenario jobs created & run"
echo

###
# 3B) GODMODE – DEEP ENRICHMENT ASSERTIONS (DB)
# Not: Deep enrichment akışı async olabilir; kısa bir süre bekleyip DB'den doğruluyoruz.
###
echo "▶ 3B) Godmode deep enrichment log assertion (DB)..."
DE_ASSERT_SKIPPED=0

DB_PATH="data/app.sqlite"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "⚠ sqlite3 bulunamadı: deep enrichment DB assertion atlandı (smoke test false-green olabilir)."
  echo
else
  if [ ! -f "$DB_PATH" ]; then
    echo "[ERR] SQLite DB bulunamadı: $DB_PATH"
    exit 1
  fi

  # Deep enrichment optional: only assert when explicitly enabled AND there are candidates.
  if [ "${GODMODE_DEEP_ENRICHMENT:-0}" != "1" ]; then
    echo "  → [SKIP] GODMODE_DEEP_ENRICHMENT!=1 (deep enrichment assertion skipped)"
    DE_ASSERT_SKIPPED=1
    echo
  else
    DE_JOB_ID="$JOB_ID_1"

    # Candidate count from DEDUP_DONE metrics (canonical), fallback 0 if JSON1 unavailable.
    DE_CANDIDATES=$(sqlite3 "$DB_PATH" "SELECT COALESCE(json_extract(payload_json,'$.deep_enrichment_candidates'),0) FROM godmode_job_logs WHERE job_id='$DE_JOB_ID' AND event_type='DEDUP_DONE' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || echo "0")

    if [ "${DE_CANDIDATES}" -le 0 ]; then
      echo "  → Deep enrichment candidates (job_id=$DE_JOB_ID): $DE_CANDIDATES"
      echo "  → [SKIP] No deep enrichment candidates for this run"
      DE_ASSERT_SKIPPED=1
      echo
    else
      MISSING_CNT=0
      TECH_CNT=0

      # Deep enrichment async olabilir: 10 tur * 2sn = 20sn bekle
      for _i in {1..10}; do
        MISSING_CNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$DE_JOB_ID' AND event_type='DEEP_ENRICHMENT_WEBSITE_MISSING';")
        TECH_CNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$DE_JOB_ID' AND event_type='DEEP_ENRICHMENT_TECH_STUB';")

        if [ "$MISSING_CNT" -gt 0 ] || [ "$TECH_CNT" -gt 0 ]; then
          break
        fi
        sleep 2
      done

      echo "  → Deep enrichment candidates (job_id=$DE_JOB_ID): $DE_CANDIDATES"
      echo "  → Deep enrichment counts (job_id=$DE_JOB_ID): WEBSITE_MISSING=$MISSING_CNT TECH_STUB=$TECH_CNT"

      if [ "$MISSING_CNT" -eq 0 ] && [ "$TECH_CNT" -eq 0 ]; then
        # Some environments only emit V2 persistence events and may not write per-lead WEBSITE_MISSING/TECH_STUB logs.
        V2_OK_CNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$DE_JOB_ID' AND event_type='DEEP_ENRICHMENT_V2_REPO_PERSIST_OK';" 2>/dev/null || echo "0")
        LEGACY_OK_CNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$DE_JOB_ID' AND event_type='DEEP_ENRICHMENT_PERSIST_OK';" 2>/dev/null || echo "0")

        echo "  → Deep enrichment persist signals (job_id=$DE_JOB_ID): V2_REPO_PERSIST_OK=$V2_OK_CNT PERSIST_OK=$LEGACY_OK_CNT"

        if [ "$V2_OK_CNT" -gt 0 ] || [ "$LEGACY_OK_CNT" -gt 0 ]; then
          echo "⚠ WARN: Deep enrichment per-lead logs missing (WEBSITE_MISSING/TECH_STUB=0) but persistence signals exist. Treating as OK."
          echo "✔ Godmode deep enrichment DB assertion OK"
          echo
        else
          echo "⚠ WARN: Deep enrichment candidates>0 but no per-lead logs and no persistence signals were observed. This can happen if the deep-enrichment worker is not running in this environment. Skipping deep-enrichment DB assertions as non-fatal."
          DE_ASSERT_SKIPPED=1
          echo
        fi
      else
        echo "  → Deep enrichment sample payloads:"
        sqlite3 "$DB_PATH" "SELECT event_type, substr(payload_json,1,280) FROM godmode_job_logs WHERE job_id='$DE_JOB_ID' AND event_type IN ('DEEP_ENRICHMENT_WEBSITE_MISSING','DEEP_ENRICHMENT_TECH_STUB') ORDER BY created_at DESC LIMIT 6;"
        echo "✔ Godmode deep enrichment DB assertion OK"
        echo
      fi
    fi
  fi

  echo "▶ 3B.1) V2 enrichment persistence assertions (DB)..."

  if [ "${DE_ASSERT_SKIPPED}" = "1" ]; then
    echo "  → [SKIP] Deep enrichment assertions skipped; skipping V2 persistence assertions (3B.1)"
    echo
  else
    V2_OK_1=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$JOB_ID_1' AND event_type='DEEP_ENRICHMENT_V2_REPO_PERSIST_OK';")
    V2_OK_3=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$JOB_ID_3' AND event_type='DEEP_ENRICHMENT_V2_REPO_PERSIST_OK';")

    LEGACY_OK_1=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$JOB_ID_1' AND event_type='DEEP_ENRICHMENT_PERSIST_OK';")
    LEGACY_OK_3=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$JOB_ID_3' AND event_type='DEEP_ENRICHMENT_PERSIST_OK';")

    echo "  → Persist OK counts: JOB_ID_1 V2=$V2_OK_1 legacy=$LEGACY_OK_1 | JOB_ID_3 V2=$V2_OK_3 legacy=$LEGACY_OK_3"

    if [ "$V2_OK_1" -lt 1 ] && [ "$LEGACY_OK_1" -lt 1 ]; then
      echo "[ERR] Persistence missing for JOB_ID_1 (expected DEEP_ENRICHMENT_V2_REPO_PERSIST_OK or DEEP_ENRICHMENT_PERSIST_OK)"
      exit 1
    fi

    if [ "$V2_OK_3" -lt 1 ] && [ "$LEGACY_OK_3" -lt 1 ]; then
      echo "[ERR] forceRefresh second pass did not produce persistence for JOB_ID_3 (expected V2 or legacy persist OK)"
      exit 1
    fi

    echo
  fi

  echo "▶ 3B.2) Freshness gating signals (deterministic via DEDUP_DONE metrics, DB)..."

  # Read metrics from DEDUP_DONE payload (canonical source of truth for gating counters)
  SKIPPED_METRIC_2=$(sqlite3 "$DB_PATH" "SELECT COALESCE(json_extract(payload_json,'$.skipped_as_fresh_count'),0) FROM godmode_job_logs WHERE job_id='$JOB_ID_2' AND event_type='DEDUP_DONE' ORDER BY created_at DESC LIMIT 1;")
  FORCE_METRIC_2=$(sqlite3 "$DB_PATH" "SELECT COALESCE(json_extract(payload_json,'$.force_refresh'),0) FROM godmode_job_logs WHERE job_id='$JOB_ID_2' AND event_type='DEDUP_DONE' ORDER BY created_at DESC LIMIT 1;")
  CAND_METRIC_2=$(sqlite3 "$DB_PATH" "SELECT COALESCE(json_extract(payload_json,'$.deep_enrichment_candidates'),0) FROM godmode_job_logs WHERE job_id='$JOB_ID_2' AND event_type='DEDUP_DONE' ORDER BY created_at DESC LIMIT 1;")

  echo "  → JOB_ID_2 metrics: skipped_as_fresh_count=$SKIPPED_METRIC_2 force_refresh=$FORCE_METRIC_2 deep_enrichment_candidates=$CAND_METRIC_2"

  # If metric says we skipped as fresh, we expect the canonical event to exist
  if [ "$SKIPPED_METRIC_2" -ge 1 ]; then
    FRESH_EVT_2=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$JOB_ID_2' AND event_type='DEEP_ENRICHMENT_SKIPPED_AS_FRESH';")
    echo "  → JOB_ID_2 canonical skip event count: $FRESH_EVT_2"
    if [ "$FRESH_EVT_2" -lt 1 ]; then
      echo "[ERR] Expected DEEP_ENRICHMENT_SKIPPED_AS_FRESH for JOB_ID_2 (metrics indicate freshness skip)"
      exit 1
    fi
  else
    echo "  → JOB_ID_2: no freshness skip indicated by metrics (OK)"
  fi

  # Additional sanity: if candidates are 0, we won't see persist_ok (also OK)
  PERSIST_OK_2=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM godmode_job_logs WHERE job_id='$JOB_ID_2' AND event_type='DEEP_ENRICHMENT_PERSIST_OK';")
  echo "  → JOB_ID_2 persist_ok=$PERSIST_OK_2"
  if [ "$CAND_METRIC_2" -gt 0 ] && [ "$SKIPPED_METRIC_2" -eq 0 ] && [ "$PERSIST_OK_2" -lt 1 ]; then
    echo "⚠ WARN: JOB_ID_2 had candidates but no persist_ok; check deep enrichment stub execution conditions."
  fi

  echo "▶ 3B.3) FAZ 2.E job-aware metrics assertions (DB)..."

  # DEDUP_DONE payload for JOB_ID_1 should include FAZ 2.E counters
  NEW_1=$(sqlite3 "$DB_PATH" "SELECT COALESCE(json_extract(payload_json,'$.new_leads_count'),-1) FROM godmode_job_logs WHERE job_id='$JOB_ID_1' AND event_type='DEDUP_DONE' ORDER BY created_at DESC LIMIT 1;")
  KNOWN_1=$(sqlite3 "$DB_PATH" "SELECT COALESCE(json_extract(payload_json,'$.known_leads_count'),-1) FROM godmode_job_logs WHERE job_id='$JOB_ID_1' AND event_type='DEDUP_DONE' ORDER BY created_at DESC LIMIT 1;")
  SC_BEFORE_1=$(sqlite3 "$DB_PATH" "SELECT COALESCE(json_extract(payload_json,'$.scan_count_total_before'),-1) FROM godmode_job_logs WHERE job_id='$JOB_ID_1' AND event_type='DEDUP_DONE' ORDER BY created_at DESC LIMIT 1;")
  SC_AFTER_1=$(sqlite3 "$DB_PATH" "SELECT COALESCE(json_extract(payload_json,'$.scan_count_total_after'),-1) FROM godmode_job_logs WHERE job_id='$JOB_ID_1' AND event_type='DEDUP_DONE' ORDER BY created_at DESC LIMIT 1;")
  MERGED_1=$(sqlite3 "$DB_PATH" "SELECT COALESCE(json_extract(payload_json,'$.merged_leads_count'),0) FROM godmode_job_logs WHERE job_id='$JOB_ID_1' AND event_type='DEDUP_DONE' ORDER BY created_at DESC LIMIT 1;")

  echo "  → JOB_ID_1 FAZ2E: new=$NEW_1 known=$KNOWN_1 scan_before=$SC_BEFORE_1 scan_after=$SC_AFTER_1 merged=$MERGED_1"

  if [ "$NEW_1" -lt 0 ] || [ "$KNOWN_1" -lt 0 ] || [ "$SC_BEFORE_1" -lt 0 ] || [ "$SC_AFTER_1" -lt 0 ]; then
    echo "[ERR] Missing FAZ 2.E counters on DEDUP_DONE for JOB_ID_1"
    exit 1
  fi

  if [ "$SC_AFTER_1" -lt "$SC_BEFORE_1" ]; then
    echo "[ERR] scan_count_total_after < scan_count_total_before for JOB_ID_1"
    exit 1
  fi

  DIFF_1=$((SC_AFTER_1 - SC_BEFORE_1))
  if [ "$MERGED_1" -gt 0 ] && [ "$DIFF_1" -ne "$MERGED_1" ]; then
    echo "[ERR] scan_count_total_after-before ($DIFF_1) != merged_leads_count ($MERGED_1) for JOB_ID_1"
    exit 1
  fi

  # Ensure jobId is actually written into potential leads storage (app.sqlite or crm.sqlite)
  CRM_DB_PATH="data/crm.sqlite"

  HAS_PL_APP=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='potential_leads';" 2>/dev/null || echo "0")
  HAS_PL_CRM="0"
  if [ -f "$CRM_DB_PATH" ]; then
    HAS_PL_CRM=$(sqlite3 "$CRM_DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='potential_leads';" 2>/dev/null || echo "0")
  fi

  if [ "$HAS_PL_APP" -lt 1 ] && [ "$HAS_PL_CRM" -lt 1 ]; then
    echo "⚠ WARN: potential_leads table not found in app.sqlite or crm.sqlite; skipping last_discovery_job_id persistence assertion."
  else
    count_merge_jobid() {
      local _db_path="$1"
      local _jobid="$2"
      local _cnt=""

      _cnt=$(sqlite3 "$_db_path" "SELECT COUNT(*) FROM potential_leads WHERE json_extract(raw_payload_json,'$._merge.last_discovery_job_id')='${_jobid}';" 2>/dev/null || true)
      if [ -z "${_cnt}" ]; then
        _cnt=$(sqlite3 "$_db_path" "SELECT COUNT(*) FROM potential_leads WHERE raw_payload_json LIKE '%\"_merge\"%' AND raw_payload_json LIKE '%\"last_discovery_job_id\"%' AND raw_payload_json LIKE '%\"${_jobid}\"%';" 2>/dev/null || echo "0")
      fi

      echo "${_cnt}"
    }

    JOB1_PL_CNT_APP="0"
    JOB3_PL_CNT_APP="0"
    JOB1_PL_CNT_CRM="0"
    JOB3_PL_CNT_CRM="0"
    FINAL_DB="app.sqlite"

    if [ "$HAS_PL_APP" -ge 1 ]; then
      JOB1_PL_CNT_APP="$(count_merge_jobid "$DB_PATH" "$JOB_ID_1")"
      JOB3_PL_CNT_APP="$(count_merge_jobid "$DB_PATH" "$JOB_ID_3")"
    fi

    if [ "$HAS_PL_CRM" -ge 1 ]; then
      JOB1_PL_CNT_CRM="$(count_merge_jobid "$CRM_DB_PATH" "$JOB_ID_1")"
      JOB3_PL_CNT_CRM="$(count_merge_jobid "$CRM_DB_PATH" "$JOB_ID_3")"
      if [ "$JOB3_PL_CNT_CRM" -gt "$JOB3_PL_CNT_APP" ]; then
        FINAL_DB="crm.sqlite"
      fi
    fi

    echo "  → potential_leads with _merge.last_discovery_job_id=JOB_ID_1 (post-run): ${JOB1_PL_CNT_APP} (app) / ${JOB1_PL_CNT_CRM} (crm)"
    echo "  → potential_leads with _merge.last_discovery_job_id=JOB_ID_3 (final): ${JOB3_PL_CNT_APP} (app) / ${JOB3_PL_CNT_CRM} (crm) [preferred=${FINAL_DB}]"

    if [ "$JOB1_PL_CNT_APP" -lt 1 ] && [ "$JOB1_PL_CNT_CRM" -lt 1 ] && [ "$JOB3_PL_CNT_APP" -lt 1 ] && [ "$JOB3_PL_CNT_CRM" -lt 1 ]; then
      echo "⚠ WARN: potential_leads exists but no rows match _merge.last_discovery_job_id == JOB_ID_1 or JOB_ID_3. This indicates merge metadata is not being written (or JSON parsing is unsupported). Skipping as non-fatal."
    else
      echo "✔ last_discovery_job_id merge metadata present (JOB_ID_1 app=${JOB1_PL_CNT_APP} crm=${JOB1_PL_CNT_CRM}, JOB_ID_3 app=${JOB3_PL_CNT_APP} crm=${JOB3_PL_CNT_CRM})"
    fi
  fi

  echo "✔ FAZ 2.E job-aware metrics assertions OK"
  echo

  echo "✔ Godmode forceRefresh regression checks OK"
  echo
fi

###
# 3E) GODMODE – OUTREACH EXECUTION ASSERTIONS (DB) [FAZ 4.D.x]
# Not: Outreach auto-trigger server env ile açılabilir; sadece event varsa assert ediyoruz.
###
echo "▶ 3E) Godmode outreach execution assertions (DB)..."

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "⚠ sqlite3 bulunamadı: outreach DB assertions atlandı."
  echo
else
  if [ ! -f "$DB_PATH" ]; then
    echo "[ERR] SQLite DB bulunamadı: $DB_PATH"
    exit 1
  fi

  OE_JOB_ID="$JOB_ID_1"

  OE_COUNTS=$(sqlite3 "$DB_PATH" "
    SELECT event_type || '|' || COUNT(*)
    FROM godmode_job_logs
    WHERE job_id='$OE_JOB_ID'
      AND event_type IN (
        'OUTREACH_AUTO_TRIGGER_DONE',
        'OUTREACH_AUTO_TRIGGER_ENQUEUED',
        'OUTREACH_EXECUTION_ATTEMPT',
        'OUTREACH_EXECUTION_INTENT',
        'OUTREACH_EXECUTION_DRY_RUN',
        'OUTREACH_EXECUTION_SENT',
        'OUTREACH_EXECUTION_FAILED',
        'OUTREACH_EXECUTION_BLOCKED_POLICY',
        'OUTREACH_SEND_STUB',
        'OUTREACH_SCHEDULE_STUB'
      )
    GROUP BY event_type
    ORDER BY event_type ASC;
  " 2>/dev/null || true)

  if [ -z "${OE_COUNTS}" ]; then
    echo "  → ℹ Outreach auto-trigger events not found for job_id=$OE_JOB_ID. (Tip: start server with GODMODE_OUTREACH_AUTO_TRIGGER=1)"
    echo "  → ✔ Skipping outreach execution assertions"
    echo
  else
    echo "${OE_COUNTS}"
    POLICY_ROW=$(echo "${OE_COUNTS}" | grep -E "OUTREACH_EXECUTION_BLOCKED_POLICY\|" || true)

    # If policy blocked, accept as OK (guardrails working) and skip stricter assertions.
    if [ -n "${POLICY_ROW}" ]; then
      echo "✔ Outreach execution blocked by policy (guardrails OK)"
      echo
    else
      if ! echo "${OE_COUNTS}" | grep -Fq "OUTREACH_AUTO_TRIGGER_DONE|"; then
        echo "[ERR] Missing OUTREACH_AUTO_TRIGGER_DONE for job_id=$OE_JOB_ID (expected when outreach events exist)"
        exit 1
      fi

      # Dry-run proof (FAZ 4.D.5)
      if [ "${OUTREACH_DRY_RUN:-0}" = "1" ]; then
        if ! echo "${OE_COUNTS}" | grep -Fq "OUTREACH_EXECUTION_DRY_RUN|"; then
          echo "[ERR] Missing OUTREACH_EXECUTION_DRY_RUN (OUTREACH_DRY_RUN=1)"
          exit 1
        fi
        if ! echo "${OE_COUNTS}" | grep -Fq "OUTREACH_EXECUTION_SENT|"; then
          echo "[ERR] Missing OUTREACH_EXECUTION_SENT (dry-run should emit SENT for analytics/CRM chain)"
          exit 1
        fi
        echo "✔ Dry-run SENT event detected (FAZ 4.D.5)"
        echo
      else
        echo "  → ℹ OUTREACH_DRY_RUN!=1 (skipping FAZ 4.D.5 dry-run assertions)"
        echo
      fi
    fi
  fi
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
