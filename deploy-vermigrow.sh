#!/usr/bin/env bash
# =============================================================================
# Basnayaka VermiGrow — deploy: pull latest from GitHub, apply server config
# from the repo, rebuild, restart.  Run as root:   sudo deploy-vermigrow
#
# The GitHub repo is the SINGLE SOURCE OF TRUTH for site code AND server config
# (this script, Caddyfile.production, basnayaka.service). Data is NOT in git:
#   - SQLite DB      /var/www/basnayakavermigrow/db/custom.db   (untouched)
#   - uploads        /var/www/basnayakavermigrow/uploads        (untouched)
#   - real env       /etc/basnayakavermigrow.env  (server-local secrets,
#                     never committed; this script never overwrites it)
# =============================================================================
set -euo pipefail

APP=/var/www/basnayakavermigrow/app
cd "$APP"

echo "=== pull site code + config from GitHub ==="
git pull --ff-only origin main

# Self-resync: if this file lives in /usr/local/bin and the repo copy changed,
# refresh /usr/local/bin and re-exec so the new script logic runs this time.
REPO_SCRIPT="$APP/deploy-vermigrow.sh"
if [ "$0" != "$REPO_SCRIPT" ] && [ -f "$REPO_SCRIPT" ] && ! cmp -s "$0" "$REPO_SCRIPT"; then
  echo "deploy script changed in repo -> refreshing /usr/local/bin and re-running"
  install -m 0755 "$REPO_SCRIPT" /usr/local/bin/deploy-vermigrow
  exec /usr/local/bin/deploy-vermigrow "$@"
fi

echo "[1/7] systemd unit (from repo: basnayaka.service)"
install -m 0644 "$APP/basnayaka.service" /etc/systemd/system/basnayaka.service
systemctl daemon-reload

echo "[2/7] Caddy config (from repo: Caddyfile.production)"
install -m 0644 "$APP/Caddyfile.production" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

echo "[3/7] env (server-local: /etc/basnayakavermigrow.env)"
set -a; . /etc/basnayakavermigrow.env; set +a
case "${NEXTAUTH_URL:-}" in
  https://*) ;;
  *) echo "NEXTAUTH_URL is not https in /etc/basnayakavermigrow.env -> fix it and rerun."; exit 1 ;;
esac
echo "  NEXTAUTH_URL=$NEXTAUTH_URL"

echo "[4/7] npm ci + prisma generate"
npm ci --include=dev --no-audit --no-fund --loglevel=error
npx prisma generate

echo "[5/7] build (public URL baked: $NEXTAUTH_URL)"
npm run build

echo "[6/7] restart + local health"
systemctl restart basnayaka
sleep 3
systemctl is-active basnayaka
curl -s -o /dev/null -w "home=%{http_code}\n" http://127.0.0.1:3001/

echo "[7/7] done"
echo "DEPLOY_OK"
