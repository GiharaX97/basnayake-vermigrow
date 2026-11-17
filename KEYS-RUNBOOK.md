# Keys and codes — storage and rotation runbook

Plain-language version for a non-technical reader: **SECURITY-GUIDE.md**.

No secret values live in this file, or in the repo. Values live in the password
manager (master copy) and in exactly two derived copies: `.env` on the dev
machine and `/etc/basnayakavermigrow.env` on the VPS. Anything else is a leak.

Last reviewed: 2026-11-15.

## Where each secret belongs

| Secret | Master copy | Derived copies | Notes |
|---|---|---|---|
| `ADMIN_PASSWORD` (hash) | Password manager | seeded from env; changed in Admin settings | The live value is client-chosen; rotate in the admin UI, not by editing env |
| `NEXTAUTH_SECRET` | Password manager | `.env`, prod env | Per-deployment value; rotating logs every admin out |
| `TEXTLK_API_TOKEN` | Text.lk dashboard + password manager | `.env`, prod env | Rotate at Text.lk (Settings → API). Keep it quoted in the env file |
| `PAYMENTS_LK_SECRET_KEY` | Payments.lk dashboard + password manager | `.env` (test), prod env (live) | `sk_test_` is test-only; prod gets `sk_live_` only |
| `PAYMENTS_LK_WEBHOOK_SECRET` | Payments.lk dashboard (per endpoint) | `.env`, prod env | Changes when the endpoint URL or mode changes |
| GitHub access | GitHub + Git Credential Manager | none on disk in plaintext | SSH deploy keys on the VPS; GCM on the dev PC |

## Storage rules

1. **Master copy is the password manager.** `.env` and the systemd env file are
   working copies; if they differ, the password manager wins.
2. **File permissions.** Dev PC: secrets are ACL-restricted to the local account,
   SYSTEM and Administrators. VPS: `/etc/basnayakavermigrow.env` and its backups
   are `600 root:root`.
3. **Never commit.** `.gitignore` covers `.env*`, `SECRETS*.local.md`, key
   material and credential stores. `.githooks/pre-commit` blocks known secret
   shapes. Enable per clone: `git config core.hooksPath .githooks`.
4. **Never paste into chat, tickets or logs.** If a value has been exposed in a
   transcript, treat it as compromised and rotate it.
5. **No stale copies.** Old env backups are deleted, not kept "just in case".
   The VPS keeps dated backups only because deploys need rollback; they are
   `600 root` and should be pruned when no longer needed.
6. **Backups are encrypted.** DB and uploads backups contain customer personal
   data; encrypt them before they leave the server (age or gpg, key in the
   password manager).

## Rotation procedure (provider by provider)

### Text.lk token
1. Text.lk dashboard → API tokens → revoke the old token, create a new one.
2. Update `.env` and `/etc/basnayakavermigrow.env` (keep the quotes).
3. Restart: `systemctl restart basnayaka` on the VPS; restart `npm run dev` locally.
4. Verify: place a local order with `SMS_AUTOSEND=0` to check queueing, then one
   real send on a number you control.

### Payments.lk keys
1. app.payments.lk → API keys → rotate the test key (`sk_test_`).
2. Webhook endpoint → copy the signing secret (`whsec_`) for the current endpoint.
3. Update `.env`; restart the dev server.
4. Verify: create an order, start a checkout, pay a sandbox card, confirm the
   webhook settles it (Admin → Orders shows `paid`, method `card`).
5. For live: create live-mode keys, register
   `https://www.basnayakavermigrow.lk/api/payments/webhook`, subscribe to
   `payment.succeeded`, `payment.failed`, `checkout.expired`, then put the live
   pair in the prod env only.

### NextAuth secret
1. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
2. Write it directly into the env file (do not echo it into a terminal log).
3. Restart the app. Every admin session is invalidated by design.

### Admin password
1. Change it from Admin → Settings in the running app (the DB hash is the source
   of truth once the app has started).
2. Store the new value in the password manager.
3. Login throttling/lockout is already in place; there is no TOTP yet.

### GitHub access
1. Revoke the compromised PAT at github.com/settings/tokens.
2. Create a fine-grained PAT scoped to the two repos, or use GCM's browser login.
3. The dev PC uses Git Credential Manager (`credential.helper=manager`).
   The VPS uses SSH deploy keys (`git@github.com:…`); no token on its disk.
4. Enable secret scanning + push protection on the repos.

## Incident checklist (a key leaked)

1. Rotate it at the provider first — revoking beats cleaning up.
2. Update both env copies, restart the app.
3. Check logs for use between exposure and rotation.
4. If it touched money (Payments.lk), reconcile the dashboard against the ledger:
   intents with `status=succeeded` and no matching paid order need a refund check.
5. If it touched SMS credit, review the Text.lk message log for unknown sends.
