#!/usr/bin/env bash
# =============================================================================
# Basnayaka Vermigrow — Ubuntu 24.04 VPS provisioner (fresh server bootstrap)
#
# Run ON a fresh VPS, as root, from inside the git clone (repo root has
# package.json + the server config files):
#
#     sudo bash provision-vps.sh
#
# Canonical public host is www:  https://www.basnayakavermigrow.lk
# (apex redirects to www via Caddy). DNS must point BOTH of these at the VPS:
#     basnayakavermigrow.lk  A  <server IP>
#     www.basnayakavermigrow.lk  A  <server IP>
#
# Expected layout (matches deploy-vermigrow.sh):
#   /var/www/basnayakavermigrow/app/{package.json, prisma, src, public,
#                                     db/custom.db, Caddyfile.production,
#                                     basnayaka.service, deploy-vermigrow.sh, ...}
# The repo is the single source of truth for code + config. Data (db, uploads)
# and the real env file (/etc/basnayakavermigrow.env) live outside git.
# =============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="${DOMAIN:-basnayakavermigrow.lk}"
PUBLIC_URL="https://www.${DOMAIN}"
BASE="/var/www/basnayakavermigrow"
DB_DIR="$BASE/db"
DB_FILE="$DB_DIR/custom.db"

log()  { echo -e "\n\033[1;32m[$1]\033[0m $2"; }
warn() { echo -e "\n\033[1;33m[!]\033[0m $1"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0"; exit 1
fi

if [ ! -f "$APP_DIR/package.json" ]; then
  echo "package.json not found in $APP_DIR. Run this script from the git clone root."
  exit 1
fi

log "1/10" "Prerequisites: Node 22 + Caddy + sqlite3"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
# Node 22 LTS (NodeSource)
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs || warn "nodejs install failed"
fi
# Caddy (official repo)
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy || warn "caddy install failed"
fi
apt-get install -y unzip sqlite3 >/dev/null
node -v; npm -v; caddy version || true

log "2/10" "Directories + DB placement"
mkdir -p "$BASE/db" "$BASE/backups"
if [ ! -f "$DB_FILE" ] && [ -f "$APP_DIR/db/custom.db" ]; then
  cp "$APP_DIR/db/custom.db" "$DB_FILE"
  log "2/10" "DB copied from source → $DB_FILE"
else
  warn "Using existing DB at $DB_FILE (if missing, restore db/custom.db into the repo first)."
fi

log "3/10" "Environment file (/etc/basnayakavermigrow.env, server-local)"
umask 077
cat > /etc/basnayakavermigrow.env <<EOF
NODE_ENV="production"
PORT="3001"
HOSTNAME="127.0.0.1"
DATABASE_URL="file:${DB_FILE}"
NEXTAUTH_URL="${PUBLIC_URL}"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
EOF
chmod 600 /etc/basnayakavermigrow.env
warn "Secrets generated. ADMIN_PASSWORD is NOT set — the bundled DB already has a strong admin password (see SECRETS.local.md)."

log "4/10" "npm ci + Prisma"
cd "$APP_DIR"
export NEXTAUTH_URL="$PUBLIC_URL"
export DATABASE_URL="file:$DB_FILE"
export NEXT_TELEMETRY_DISABLED=1
npm ci --include=dev --no-audit --no-fund
npx prisma generate
npx prisma db push --skip-generate

log "5/10" "Next.js production build (URL baked: $NEXTAUTH_URL)"
npx next build

log "6/10" "Assemble standalone + persistent uploads dir"
mkdir -p .next/standalone
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
mkdir -p .next/standalone/public/uploads
chown -R www-data:www-data "$APP_DIR/.next/standalone" "$DB_DIR"

log "7/10" "systemd unit (from repo: basnayaka.service)"
install -m 0644 "$APP_DIR/basnayaka.service" /etc/systemd/system/basnayaka.service
systemctl daemon-reload
systemctl enable --now basnayaka

log "8/10" "Caddy config (from repo: Caddyfile.production -> auto-HTTPS)"
install -m 0644 "$APP_DIR/Caddyfile.production" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl restart caddy

log "8b/10" "Deploy script -> /usr/local/bin/deploy-vermigrow"
install -m 0755 "$APP_DIR/deploy-vermigrow.sh" /usr/local/bin/deploy-vermigrow
echo "Run 'sudo deploy-vermigrow' after every 'git push' to update the server."

log "9/10" "Firewall (80/443/22)"
ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
if [ "${UFW_ENABLE:-0}" = "1" ]; then
  ufw --force enable
else
  warn "UFW rules added but NOT enabled (set UFW_ENABLE=1 to enable)."
fi

log "10/10" "Health check"
sleep 4
if curl -fsS http://127.0.0.1:3001/api/content >/dev/null 2>&1; then
  log "OK" "App responds on 127.0.0.1:3001"
else
  warn "App not responding yet — check: journalctl -u basnayaka -n 50"
fi

echo ""
echo "=============================================================="
echo " Server IP:     $(hostname -I | awk '{print $1}')"
echo " App:           http://127.0.0.1:3001 (behind Caddy)"
echo " Public URL:    $PUBLIC_URL   (once DNS below points here)"
echo " Admin:         $PUBLIC_URL/admin/login"
echo " Logs:          journalctl -u basnayaka -f"
echo " Admin password: see SECRETS.local.md (change on first login)"
echo ""
echo " NEXT: add these DNS records at clouDNS (zone basnayakavermigrow.lk):"
echo "   www.${DOMAIN}    A   $(hostname -I | awk '{print $1}')"
echo "   ${DOMAIN}        A   $(hostname -I | awk '{print $1}')   (redirects to www)"
echo " Then:  sudo deploy-vermigrow"
echo "=============================================================="
