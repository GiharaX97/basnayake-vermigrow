#!/usr/bin/env bash
#
# Run the full end-to-end suite (scripts/e2e.mjs) against a throwaway COPY of the
# working database.
#
#   bash scripts/run-e2e.sh
#
# Why a script and not just `node scripts/e2e.mjs`: /api/orders carries a GLOBAL
# 60-orders-per-hour throttle held in process memory. Running the suite twice
# against the same server process spends that budget twice and the second run
# starts refusing orders — which looks like a failure but is the guard working.
# So every run gets a fresh server, and a fresh copy of the DB.
#
# The working DB (db/custom.db) is never opened for writing: it is copied to
# db/e2e.db and every request the suite makes is served against that copy.
#
# Env overrides: E2E_PORT (default 3001), E2E_ADMIN_PASSWORD (default admin123).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${E2E_PORT:-3001}"

# Prisma wants a Windows-style path on this machine; cygpath -m gives H:/... .
if command -v cygpath >/dev/null 2>&1; then
  ROOT_FS="$(cygpath -m "$ROOT")"
else
  ROOT_FS="$ROOT"
fi
DB_URL="file:${ROOT_FS}/db/e2e.db"

echo "[e2e] copying db/custom.db -> db/e2e.db (the working DB is left untouched)"
cp db/custom.db db/e2e.db

if [ ! -f .next/BUILD_ID ]; then
  echo "[e2e] no build found — running npm run build"
  npm run build
fi

echo "[e2e] starting the standalone server on :$PORT against the copy"
pushd .next/standalone >/dev/null
PORT="$PORT" HOSTNAME=127.0.0.1 NODE_ENV=production \
  DATABASE_URL="$DB_URL" \
  NEXTAUTH_URL="http://localhost:$PORT" \
  UPLOADS_DIR="${ROOT_FS}/public/uploads" \
  node server.js > "${TMPDIR:-/tmp}/e2e-server.log" 2>&1 &
SRV=$!
popd >/dev/null

cleanup() {
  kill "$SRV" 2>/dev/null || true
  wait "$SRV" 2>/dev/null || true
}
trap cleanup EXIT

echo "[e2e] waiting for the server to answer"
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/api/catalog"; then break; fi
  sleep 1
done

echo "[e2e] running the suite"
E2E_BASE="http://127.0.0.1:$PORT" DATABASE_URL="$DB_URL" node scripts/e2e.mjs
