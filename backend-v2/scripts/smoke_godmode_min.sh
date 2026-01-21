#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT_OVERRIDE:-4000}"
BASE="http://localhost:${PORT}"
SMOKE_FORCE_AB="${SMOKE_FORCE_AB:-0}"
OUTREACH_EXECUTION_MODE="${OUTREACH_EXECUTION_MODE:-queue_only}"

# Discovery mode control
# Default: REPLAY (no external Google Places calls)
# Set LIVE_SMOKE=1 to enable real Google Places
if [ "${LIVE_SMOKE:-0}" = "1" ]; then
  export GODMODE_DISCOVERY_MODE=1
  echo "ℹ LIVE_SMOKE=1 → GODMODE_DISCOVERY_MODE=LIVE"
else
  export GODMODE_DISCOVERY_MODE=0
  echo "ℹ Default DISCOVERY_MODE=REPLAY (no external calls)"
fi

echo "▶ MINI SMOKE — GODMODE (PORT=${PORT})"

echo "▶ 1) Admin status..."
curl -fsS "${BASE}/api/admin/status" >/dev/null
echo "✔ Admin status OK"

echo "▶ 2) Godmode providers health..."
curl -fsS "${BASE}/api/godmode/providers/health" >/dev/null
echo "✔ Providers health OK"

echo "▶ 3) Create + run GODMODE discovery job (forceRefresh=true)..."
PAYLOAD='{"city":"İstanbul","country":"Türkiye","maxResults":10,"channels":["google_places"],"forceRefresh":true}'

if [ "${SMOKE_FORCE_AB}" = "1" ]; then
  echo "ℹ SMOKE_FORCE_AB=1 → using broader categories to surface A/B leads and exercise SWOT/Draft/Persist"
  PAYLOAD='{"label":"smoke-force-ab","city":"Istanbul","country":"TR","minGoogleRating":0,"maxResults":60,"channels":["google_places"],"forceRefresh":true}'
fi

JOB_ID=$(curl -fsS -X POST "${BASE}/api/godmode/jobs/discovery-scan" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);console.log(j.id||j.data?.id||'');});")

if [ -z "${JOB_ID}" ]; then
  echo "✖ Could not read JOB_ID from response"
  exit 1
fi
echo "  → JOB_ID=${JOB_ID}"

curl -fsS -X POST "${BASE}/api/godmode/jobs/${JOB_ID}/run" >/dev/null
echo "✔ Job run triggered"

echo "▶ 3.1) Wait for job completion..."
DEADLINE=$((SECONDS + 60))
DONE_COUNTS=""
DONE_PAYLOAD=""
while [ $SECONDS -lt $DEADLINE ]; do
  DONE_COUNTS=$(sqlite3 data/app.sqlite "SELECT event_type, COUNT(*) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type IN ('RUN_START','QUEUED','COMPLETED') GROUP BY event_type;" 2>/dev/null || true)
  if echo "${DONE_COUNTS}" | grep -Fq "COMPLETED|1"; then
    DONE_PAYLOAD=$(sqlite3 data/app.sqlite "SELECT result_summary_json FROM godmode_job_results WHERE job_id='${JOB_ID}' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || true)
    break
  fi
  sleep 1
done

echo "▶ 4) DB assertions (job lifecycle events must exist)..."
echo "${DONE_COUNTS}"

if ! echo "${DONE_COUNTS}" | grep -Fq "RUN_START|1"; then
  echo "✖ Missing RUN_START"
  exit 1
fi

if ! echo "${DONE_COUNTS}" | grep -Fq "QUEUED|1"; then
  echo "✖ Missing QUEUED"
  exit 1
fi

if ! echo "${DONE_COUNTS}" | grep -Fq "COMPLETED|1"; then
  echo "✖ Missing COMPLETED"
  exit 1
fi

echo "✔ Lifecycle check OK"

echo "▶ 4.1) DB assertions (progress payload must include found/enriched leads)..."
echo "${DONE_PAYLOAD}"

FOUND_LEADS=$(echo "${DONE_PAYLOAD}" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s||'{}');const v=j?.progress?.found_leads ?? j?.stats?.found_leads ?? 0;process.stdout.write(String(v));}catch(e){process.stdout.write('0');}});")
ENRICHED_LEADS=$(echo "${DONE_PAYLOAD}" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s||'{}');const v=j?.progress?.enriched_leads ?? j?.stats?.enriched_leads ?? 0;process.stdout.write(String(v));}catch(e){process.stdout.write('0');}});")

if [ "${FOUND_LEADS}" -lt 1 ]; then
  echo "✖ found_leads is 0"
  exit 1
fi

if [ "${ENRICHED_LEADS}" -lt 1 ]; then
  echo "✖ enriched_leads is 0"
  exit 1
fi

echo "✔ Progress payload check OK (found_leads=${FOUND_LEADS}, enriched_leads=${ENRICHED_LEADS})"

echo "▶ 4.2) DB optional checks (AI ranking / SWOT / drafts / channel strategy)..."
AI_OPT=$(sqlite3 data/app.sqlite "SELECT event_type, COUNT(*) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type IN ('AI_LEAD_RANKED','AI_LEAD_RANKING_DONE','AI_AUTO_SWOT_GENERATED','AI_AUTO_SWOT_DONE','AI_OUTREACH_DRAFT_GENERATED','AI_OUTREACH_DRAFT_DONE','AI_OUTREACH_DRAFT_PERSISTED','AI_OUTREACH_DRAFT_PERSIST_ERROR','AI_CHANNEL_STRATEGY_GENERATED','AI_CHANNEL_STRATEGY_DONE','AI_CHANNEL_STRATEGY_PERSISTED','AI_CHANNEL_STRATEGY_PERSIST_ERROR') GROUP BY event_type;" 2>/dev/null || true)
if [ -n "${AI_OPT}" ]; then
  echo "${AI_OPT}"
else
  echo "ℹ No AI_* optional events found (OK for mini smoke)"
fi

echo "▶ 4.3) Optional: Outreach Draft + Channel Strategy persistence sanity..."
DRAFT_COUNTS=$(sqlite3 data/app.sqlite "SELECT event_type, COUNT(*) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type IN ('AI_OUTREACH_DRAFT_GENERATED','AI_OUTREACH_DRAFT_DONE','AI_OUTREACH_DRAFT_PERSISTED','AI_OUTREACH_DRAFT_PERSIST_ERROR') GROUP BY event_type;" 2>/dev/null || true)
if [ -n "${DRAFT_COUNTS}" ]; then
  echo "${DRAFT_COUNTS}"
  if echo "${DRAFT_COUNTS}" | grep -Fq "AI_OUTREACH_DRAFT_PERSIST_ERROR"; then
    echo "✖ AI_OUTREACH_DRAFT_PERSIST_ERROR present"
    exit 1
  fi
else
  echo "ℹ No outreach draft events (OK for mini smoke)"
fi

CHAN_COUNTS=$(sqlite3 data/app.sqlite "SELECT event_type, COUNT(*) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type IN ('AI_CHANNEL_STRATEGY_GENERATED','AI_CHANNEL_STRATEGY_DONE','AI_CHANNEL_STRATEGY_PERSISTED','AI_CHANNEL_STRATEGY_PERSIST_ERROR') GROUP BY event_type;" 2>/dev/null || true)
if [ -n "${CHAN_COUNTS}" ]; then
  echo "${CHAN_COUNTS}"
  if echo "${CHAN_COUNTS}" | grep -Fq "AI_CHANNEL_STRATEGY_PERSIST_ERROR"; then
    echo "✖ AI_CHANNEL_STRATEGY_PERSIST_ERROR present"
    exit 1
  fi
else
  echo "ℹ No channel strategy events (OK for mini smoke)"
fi

echo "✔ Optional AI persistence sanity OK"

echo "▶ 4.4) DB assertions (Outreach Auto-Trigger + Guardrails)..."
AUTO_COUNTS=$(sqlite3 data/app.sqlite "SELECT event_type, COUNT(*) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type IN ('OUTREACH_AUTO_TRIGGER_ENQUEUED','OUTREACH_AUTO_TRIGGER_SKIP','OUTREACH_AUTO_TRIGGER_ERROR','OUTREACH_AUTO_TRIGGER_DONE','OUTREACH_EXECUTION_BLOCKED_POLICY','OUTREACH_EXECUTION_DRY_RUN','OUTREACH_SEND_STUB','OUTREACH_SCHEDULE_STUB','OUTREACH_EXECUTION_SENT','OUTREACH_EXECUTION_FAILED','OUTREACH_EXECUTION_INTENT','OUTREACH_EXECUTION_ATTEMPT') GROUP BY event_type;" 2>/dev/null || true)
echo "${AUTO_COUNTS}"
if [ -z "${AUTO_COUNTS}" ]; then
  echo "ℹ Outreach auto-trigger events not found. (Tip: start server with GODMODE_OUTREACH_AUTO_TRIGGER=1)"
  echo "✔ Skipping 4.4 assertions"
else

if echo "${AUTO_COUNTS}" | grep -Fq "OUTREACH_AUTO_TRIGGER_ERROR"; then
  echo "✖ OUTREACH_AUTO_TRIGGER_ERROR present"
  exit 1
fi

if echo "${AUTO_COUNTS}" | grep -Fq "OUTREACH_EXECUTION_BLOCKED_POLICY|"; then
  POLICY_ROW=$(sqlite3 data/app.sqlite "SELECT substr(payload_json,1,240) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type='OUTREACH_EXECUTION_BLOCKED_POLICY' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || true)
  echo "  policy_payload: ${POLICY_ROW}"

  if echo "${POLICY_ROW}" | grep -Fq "KILL_SWITCH"; then
    echo "✔ Outreach execution blocked by policy (KILL_SWITCH)"
  elif echo "${POLICY_ROW}" | grep -Fq "DAILY_CAP_REACHED"; then
    echo "✔ Outreach execution blocked by policy (DAILY_CAP_REACHED)"
  else
    echo "✔ Outreach execution blocked by policy (UNKNOWN_REASON)"
  fi
else
  if ! echo "${AUTO_COUNTS}" | grep -Fq "OUTREACH_AUTO_TRIGGER_DONE|1"; then
    echo "✖ Missing OUTREACH_AUTO_TRIGGER_DONE"
    exit 1
  fi

  if echo "${AUTO_COUNTS}" | grep -Fq "OUTREACH_EXECUTION_DRY_RUN|"; then
    echo "✔ Dry-run mode detected"
  fi

  # 4.D.5 — Dry-run SENT/FAILED proof (only when not policy-blocked)
  if echo "${AUTO_COUNTS}" | grep -Fq "OUTREACH_EXECUTION_DRY_RUN|"; then
    if ! echo "${AUTO_COUNTS}" | grep -Fq "OUTREACH_EXECUTION_SENT|"; then
      echo "✖ Missing OUTREACH_EXECUTION_SENT (dry-run should emit SENT for analytics/CRM chain)"
      exit 1
    fi
    echo "✔ Dry-run SENT event detected"
  fi

  # Mode assertions: in dry-run we expect SENT/FAILED (not stubs). In non-dry-run we expect stubs.
  if echo "${AUTO_COUNTS}" | grep -Fq "OUTREACH_EXECUTION_DRY_RUN|"; then
    echo "ℹ Skipping stub assertions (dry-run enabled)"
  else
    if [ "${OUTREACH_EXECUTION_MODE}" = "send_now" ]; then
      if ! echo "${AUTO_COUNTS}" | grep -Fq "OUTREACH_SEND_STUB|"; then
        echo "✖ Missing OUTREACH_SEND_STUB (OUTREACH_EXECUTION_MODE=send_now)"
        exit 1
      fi
      echo "✔ Send stub detected"
    elif [ "${OUTREACH_EXECUTION_MODE}" = "schedule" ]; then
      if ! echo "${AUTO_COUNTS}" | grep -Fq "OUTREACH_SCHEDULE_STUB|"; then
        echo "✖ Missing OUTREACH_SCHEDULE_STUB (OUTREACH_EXECUTION_MODE=schedule)"
        exit 1
      fi
      echo "✔ Schedule stub detected"
    fi
  fi

  if ! echo "${AUTO_COUNTS}" | grep -Fq "OUTREACH_AUTO_TRIGGER_ENQUEUED|"; then
    echo "✖ Missing OUTREACH_AUTO_TRIGGER_ENQUEUED"
    exit 1
  fi

  echo "✔ Outreach Auto-Trigger check OK"
fi
fi

echo "▶ 5) Print COMPLETED summary payload..."
sqlite3 data/app.sqlite "SELECT substr(payload_json,1,900) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type='COMPLETED' ORDER BY id DESC LIMIT 1;"

echo ""
echo "▶ 5.1) Print Outreach Draft summary payload..."
sqlite3 data/app.sqlite "SELECT substr(payload_json,1,900) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type='AI_OUTREACH_DRAFT_DONE' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || true

echo ""
echo "▶ 5.1.1) Print Channel Strategy summary payload..."
sqlite3 data/app.sqlite "SELECT substr(payload_json,1,900) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type='AI_CHANNEL_STRATEGY_DONE' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || true

echo ""
echo "▶ 5.2) Print a persisted ai_artifacts row (if any)..."
sqlite3 data/app.sqlite "SELECT id, artifact_type, substr(artifact_json,1,700) FROM ai_artifacts WHERE job_id='${JOB_ID}' AND artifact_type='outreach_draft_v1' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || true

echo "==============================="
echo " MINI SMOKE TAMAMLANDI ✅"
echo "==============================="
