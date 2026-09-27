#!/usr/bin/env bash
# =============================================================================
# diagnose-ledger-deploy.sh — why did `prisma db push` exit 0 without creating
# the new tables on the live VPS?
#
#   Run on the VPS as root:
#     sudo bash scripts/diagnose-ledger-deploy.sh            # READ-ONLY (default)
#     sudo bash scripts/diagnose-ledger-deploy.sh --apply    # backup + push
#
# READ-ONLY by default. Nothing is written unless you pass --apply.
#
# Background: the 2026-09-22 deploy of 85a801e printed DEPLOY_OK, but
# /var/www/basnayakavermigrow/db/custom.db still has only the 4 original tables
# (AdminUser, Inquiry, SiteContent, Upload) and /order returns 500.
# The suspect: the Prisma CLI resolved DATABASE_URL to a DIFFERENT file than the
# running service does. An earlier check ran `find / -xdev`, which cannot cross a
# mount boundary — if /var/www is its own mount, that check proved nothing.
# =============================================================================

APP=${APP:-/var/www/basnayakavermigrow/app}
DB=${DB:-/var/www/basnayakavermigrow/db/custom.db}
ENVF=${ENVF:-/etc/basnayakavermigrow.env}
# APP/DB/ENVF are overridable so this can be dry-run against a scratch copy:
#   DB=/tmp/scratch.db bash scripts/diagnose-ledger-deploy.sh
#
# FIND_ROOT stays "/" on the VPS — the whole point of section 3 is crossing mount
# boundaries. It is overridable only so the script can be smoke-tested off-box.
FIND_ROOT=${FIND_ROOT:-/}

# --- table listing that works with or without the sqlite3 CLI ---------------
list_tables() {
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$1" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
  elif command -v python3 >/dev/null 2>&1; then
    python3 - "$1" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
for row in c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
    print(row[0])
PY
  else
    echo "(neither sqlite3 nor python3 available)"
  fi
}

count_tables() {
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$1" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
  else
    python3 - "$1" <<'PY'
import sqlite3, sys
print(sqlite3.connect(sys.argv[1]).execute(
    "SELECT COUNT(*) FROM sqlite_master WHERE type='table'").fetchone()[0])
PY
  fi
}

# The 11 tables that must exist once the migration lands.
EXPECTED="CustomerLink CustomerMessage Dispatch Donation Donor FundEntry Pack Payment Product Sale ScanEvent"
count_expected() {
  local n=0
  for t in $EXPECTED; do
    # `if` rather than `&&`: under `set -e` in the --apply path a failing
    # compound command as the loop body's last statement aborts the subshell.
    if list_tables "$DB" | grep -qx "$t"; then n=$((n + 1)); fi
  done
  echo "$n"
}

# =============================================================================
# READ-ONLY DIAGNOSTICS
# =============================================================================
diagnose() {
  echo "################ BLOCK A — read-only diagnostics ################"

  echo
  echo "=== 1. repo HEAD ==="
  git -C "$APP" rev-parse --short HEAD 2>&1
  git -C "$APP" status --porcelain 2>&1 | head

  echo
  echo "=== 2. is /var/www its own mount? (decides if the earlier -xdev find proved anything) ==="
  findmnt -no SOURCE,TARGET,FSTYPE /var/www || echo "(not a separate mount — then -xdev was valid)"
  df -h "$DB" 2>&1 | tail -1

  echo
  echo "=== 3. every .db on the box, crossing mounts  <-- THE KEY SECTION ==="
  find "$FIND_ROOT" -name '*.db' -not -path '*/node_modules/*' \
       -not -path '/proc/*' -not -path '/sys/*' -not -path '/snap/*' \
       -printf '%TY-%Tm-%Td %TH:%TM  %10s  %p\n' 2>/dev/null | sort

  echo
  echo "=== 4. live DB: mtime, hash, tables ==="
  stat -c '%y  %s  %n' "$DB" 2>&1
  sha256sum "$DB" 2>&1
  list_tables "$DB"
  echo "tables: $(count_tables "$DB")   new-model tables present: $(count_expected)/11"

  echo
  echo "=== 5. DATABASE_URL as the Prisma CLI would see it (path only, no other secrets) ==="
  grep -H '^DATABASE_URL' "$ENVF" "$APP/.env" "$APP/prisma/.env" 2>/dev/null \
    || echo "(none of: $ENVF, $APP/.env, $APP/prisma/.env)"
  echo "(note: Prisma CLI loads ./.env from its cwd, but an already-exported"
  echo " DATABASE_URL wins over it — so if the deploy sourced the env file first,"
  echo " the CLI should have used $ENVF's value.)"

  echo
  echo "=== 6. what the deployed deploy script actually runs ==="
  grep -n 'prisma' /usr/local/bin/deploy-vermigrow 2>&1

  echo
  echo "=== 7. what systemd actually feeds the service ==="
  systemctl show basnayaka -p EnvironmentFiles -p ExecStart 2>&1

  echo
  echo "################ END BLOCK A ################"
  echo "Read section 3 first. A custom.db dated 2026-09-22 in an unexpected place"
  echo "(e.g. $APP/prisma/db/) means the CLI wrote to a different file than the"
  echo "service reads. Re-run with --apply only once you have seen this output."
}

# =============================================================================
# APPLY — backup, then push with output visible
# =============================================================================
apply() {
  echo "################ BLOCK B — apply migration ################"
  set -euo pipefail
  cd "$APP"

  set -a; . "$ENVF"; set +a
  echo "DATABASE_URL=$DATABASE_URL"

  local backup="$DB.backup-pre-dbpush-$(date +%Y%m%d-%H%M%S)"
  cp -a "$DB" "$backup"
  echo "backup: $backup"
  echo "--- before ---"
  sha256sum "$DB"
  echo "tables: $(count_tables "$DB")   new-model tables: $(count_expected)/11"

  echo
  echo "--- npx prisma db push (output NOT suppressed) ---"
  npx prisma db push --schema prisma/schema.prisma --skip-generate
  echo "db push exit=$?"

  echo
  echo "--- after ---"
  sha256sum "$DB"
  echo "backup hash (must equal 'before'): $(sha256sum "$backup" | cut -d' ' -f1)"
  echo "tables: $(count_tables "$DB")   new-model tables: $(count_expected)/11"
  list_tables "$DB"

  echo
  echo "VERDICT:"
  if [ "$(count_expected)" -eq 11 ]; then
    echo "  11/11 new tables present -> schema applied to the DB the service reads."
    echo "  Next: run the deploy (or restart the service) and check https://www.basnayakavermigrow.lk/order"
  else
    echo "  $(count_expected)/11 new tables — db push did NOT write to $DB."
    echo "  Do NOT retry it. Apply the migration directly instead:"
    echo "    cd $APP && set -a && . $ENVF && set +a"
    echo "    npx prisma migrate diff --from-url \"\$DATABASE_URL\" \\"
    echo "        --to-schema-datamodel prisma/schema.prisma --script > /tmp/ledger.sql"
    echo "    less /tmp/ledger.sql   # confirm: 11 CREATE TABLE, 0 ALTER, 0 DROP"
    echo "    sqlite3 \"$DB\" < /tmp/ledger.sql"
  fi
  echo "################ END BLOCK B ################"
}

case "${1:-}" in
  --apply) apply ;;
  ""|--diagnose) diagnose ;;
  *) echo "usage: $0 [--diagnose|--apply]" >&2; exit 2 ;;
esac
