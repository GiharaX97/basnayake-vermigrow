#!/usr/bin/env bash
#
# Run the automatic-SMS end-to-end suite (scripts/e2e-sms.mjs).
#
#   bash scripts/run-e2e-sms.sh
#
# The main suite (scripts/run-e2e.sh) runs with NO gateway configured, which is
# the safe default but means it can never exercise a send. This one starts a
# fresh server per phase WITH a gateway, so the transmit path is covered too:
#
#   mock    SMS_PROVIDER=mock, SMS_DAILY_CAP=3 — sends for real (to a log file),
#           the cap holds the 4th back, the admin can still push it through.
#   fail    SMS_MOCK_FAIL=1 — the gateway refuses everything, and the sale must
#           survive anyway.
#   manual  No gateway — unchanged behaviour, and bulk-send must refuse.
#   webhook SMS_PROVIDER=mock plus HTTPSMS_WEBHOOK_SECRET — the inbound httpSMS
#           callback: a signed delivery receipt must land on the right message, a
#           customer's CONFIRM must move a paid order, CANCEL must cancel an
#           unpaid one and only FLAG a paid one, and an unsigned or missigned
#           request must be refused without writing anything.
#
# Nothing here can spend money: the mock provider writes to .sms-outbox.log and
# never opens a socket to a gateway.
#
# The working DB (db/custom.db) is never opened for writing — each phase gets its
# own fresh copy at db/sms-e2e.db.
#
# Env overrides: E2E_PORT (default 3002).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${E2E_PORT:-3002}"

# Prisma wants a Windows-style path on this machine; cygpath -m gives H:/... .
if command -v cygpath >/dev/null 2>&1; then
  ROOT_FS="$(cygpath -m "$ROOT")"
else
  ROOT_FS="$ROOT"
fi
DB_URL="file:${ROOT_FS}/db/sms-e2e.db"
LOG="${ROOT_FS}/.sms-outbox.log"
SERVER_LOG="${TMPDIR:-/tmp}/e2e-sms-server.log"

# The webhook signing key, given to BOTH the server and the test process. The test
# signs its own events with it (independently of the app's verifier, so the check
# is a real one); if only the server had it, every correctly-signed event would
# look like a forgery and the whole inbound phase would fail for the wrong reason.
# Set for every phase, since only the webhook phase reads it.
WEBHOOK_SECRET="e2e-webhook-secret"

if [ ! -f .next/BUILD_ID ]; then
  echo "[sms-e2e] no build found — running npm run build"
  npm run build
fi

TOTAL_FAILED=0

# One phase = one fresh DB copy + one fresh server process. Two reasons it cannot
# be one process: SMS_PROVIDER and SMS_MOCK_FAIL are read from the environment at
# call time and cannot be flipped mid-run, and /api/orders carries a 60-per-hour
# in-memory throttle that a shared process would spend across phases.
run_phase() {
  local phase="$1"; shift

  echo
  echo "[sms-e2e] ── phase: $phase ────────────────────────────────────"
  echo "[sms-e2e] copying db/custom.db -> db/sms-e2e.db (the working DB is untouched)"
  cp db/custom.db db/sms-e2e.db

  pushd .next/standalone >/dev/null
  PORT="$PORT" HOSTNAME=127.0.0.1 NODE_ENV=production \
    DATABASE_URL="$DB_URL" \
    NEXTAUTH_URL="http://localhost:$PORT" \
    UPLOADS_DIR="${ROOT_FS}/public/uploads" \
    SMS_MOCK_LOG="$LOG" \
    HTTPSMS_WEBHOOK_SECRET="$WEBHOOK_SECRET" \
    "$@" \
    node server.js > "$SERVER_LOG" 2>&1 &
  local srv=$!
  popd >/dev/null

  local ready=0
  for _ in $(seq 1 60); do
    if curl -sf -o /dev/null "http://127.0.0.1:$PORT/api/catalog"; then ready=1; break; fi
    sleep 1
  done
  if [ "$ready" != "1" ]; then
    echo "[sms-e2e] server did not come up — last log lines:"
    tail -20 "$SERVER_LOG" || true
    kill "$srv" 2>/dev/null || true
    wait "$srv" 2>/dev/null || true
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
    return 0
  fi

  if ! E2E_BASE="http://127.0.0.1:$PORT" DATABASE_URL="$DB_URL" SMS_MOCK_LOG="$LOG" \
       HTTPSMS_WEBHOOK_SECRET="$WEBHOOK_SECRET" \
       node scripts/e2e-sms.mjs "$phase"; then
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi

  kill "$srv" 2>/dev/null || true
  wait "$srv" 2>/dev/null || true
  return 0
}

run_phase mock   env SMS_PROVIDER=mock SMS_MOCK_FAIL=0 SMS_DAILY_CAP=3
run_phase fail   env SMS_PROVIDER=mock SMS_MOCK_FAIL=1 SMS_DAILY_CAP=200
run_phase manual env SMS_PROVIDER= SMS_DAILY_CAP=200
run_phase webhook env SMS_PROVIDER=mock SMS_MOCK_FAIL=0 SMS_DAILY_CAP=200

echo
if [ "$TOTAL_FAILED" -eq 0 ]; then
  printf '[sms-e2e] \033[32mall phases passed\033[0m\n'
  exit 0
else
  printf '[sms-e2e] \033[31m%s phase(s) failed\033[0m\n' "$TOTAL_FAILED"
  exit 1
fi
