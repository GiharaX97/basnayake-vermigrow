# Handoff — Basnayaka VermiGrow — 2026-10-30 (desktop → laptop, farm session)

Read this first. It is written so a fresh Claude Code session on the laptop can pick up
with no access to this desktop's chat history. Two companion documents: `PAYMENTS-PLAN.md`
(the full payments design) and `SECURITY-AUDIT-2026-10-09.html` (open in a browser).

**Status 2026-10-30 (later):** everything in this doc is now **committed on `main`** — the
payments feature as `c0d5182`, plus docs/tools commits. The only things still outside git are
`.env`, `SECRETS.local.md`, `db/*.db` and any scratch files (all gitignored, §6). Pushing to
GitHub is the remaining step and needs your own credentials (§3).

---

## 0. TL;DR

| Where | State |
|---|---|
| **Live site** | https://www.basnayakavermigrow.lk — HTTP 200, systemd `basnayaka` active |
| **VPS app HEAD** | `3a6f397` (QR sticker sheets) — **prod is 2 commits behind local** |
| **Local repo** | `H:\My_Projects\basnayake-glm5.2`, branch `main`, **all work committed** (see below), working tree clean apart from gitignored files |
| **GitHub** | **PUSHED 2026-10-30** to `GiharaX97/basnayake-vermigrow` (`personal`), `3a6f397..cb4dbe0`. The repo moved from `Giharax97` → **`GiharaX97`** (capital X) |
| **Committed, not deployed** | Payments.lk card payments (Phase 5) + "Apeksha Hospital" copy changes |
| **Verified** | `tsc --noEmit` clean; `next build --webpack` succeeded; demo card flow exercised end-to-end on 2026-10-29 |

**The one risk that matters (now resolved):** the commits are on GitHub at
`https://github.com/GiharaX97/basnayake-vermigrow` as of 2026-10-30. You can clone instead of
copying the folder; only the gitignored files (`.env`, `SECRETS.local.md`, `db/*.db`, the SSH key)
still need to be copied by hand (§6).

---

## 1. What was done in the last session (payments Phase 5 — card payments)

Payments.lk hosted checkout is **implemented, committed (`c0d5182`) and demo-tested locally**,
but not pushed and not deployed. `PAYMENTS-PLAN.md` said "Phase 5 not started"; that is now stale — Phase 5 is ~80% done.

### New files (committed in `c0d5182`)

| Path | Purpose |
|---|---|
| `src/lib/payments-lk.ts` | Provider client: `createCheckout`, signature verify, config/mode. Server-only, hand-rolled HMAC, no SDK. |
| `src/app/api/payments/start/route.ts` | Public. Takes **only** `orderRef`; re-reads total from DB; opens checkout. Never accepts an amount. |
| `src/app/api/payments/webhook/route.ts` | Public. Signature-first, raw-body HMAC, idempotent, settles via `settleOrderTx`. |
| `src/app/api/payments/demo/route.ts` | Demo-only stand-in for the hosted page. Refuses unless `PAYMENTS_LK_DEMO=1` **and** no real secret key. Signs a realistic event and posts it to our own webhook. |
| `src/app/api/orders/status/route.ts` | Public read-only order status for the return page. Returns status + total only. |
| `src/app/order/complete/` | Return page after a real hosted checkout — displays state, writes nothing. |
| `src/app/order/demo-pay/` | Fake hosted checkout page for the demo flow. |
| `src/components/site/order-complete-client.tsx`, `demo-pay-client.tsx` | Their clients. |
| `src/types/assets.d.ts` | Asset module typing. |
| `scripts/simulate-payment.mjs` | Signs and posts a realistic webhook. `node scripts/simulate-payment.mjs VG-O-XXXXXX [--outcome failed\|expired] [--amount N] [--bad-signature] [--replay]`. |

### Changed files (committed in `c0d5182`)

- `prisma/schema.prisma` — **two NEW models only**: `PaymentIntent` (`orderRef`/`checkoutId`/`paymentId` unique) and `PaymentWebhookEvent` (`eventId` unique). No existing model touched (deliberate — a unique added to an existing table aborts `prisma db push`).
- `src/lib/order-actions.ts` — new exported `settleOrderTx(tx, …)`: the single transactional settlement path (status flip, vouchers, fund entry, receipt, timeline, queued SMS). Both the admin button and the webhook call it.
- `src/app/api/admin/orders/[orderRef]/settle/route.ts` — now a thin caller of `settleOrderTx`.
- `src/app/api/orders/route.ts` — returns `cardPayment: boolean` (gateway configured + total ≥ Rs. 10).
- `src/components/site/order-client.tsx` — "Pay by card now" button; sends only the order ref.
- `src/app/order/page.tsx`, `src/app/donations/page.tsx`, `src/app/r/[token]/page.tsx`, `src/components/site/donations-client.tsx`, `src/lib/notify.ts`, `src/lib/payments.ts` — copy: **"community fund" → "Apeksha Hospital"**, `card` method label, donation-wall wording.
- `src/app/r/[token]/page.tsx` — also narrows `notFound()`'s return type (Next 16 typing).

### Evidence the flow works (local `db/custom.db`)

- 2 `PaymentIntent` rows, both `succeeded`: `VG-O-SBQHT2`, `VG-O-YC4VML` (demo checkouts, VISA 4242).
- 5 `PaymentWebhookEvent` rows (including refusal cases).
- Both orders are `Sale.status = paid`, `paymentMethod = card`.
- Demo mode is on: `.env` has `PAYMENTS_LK_DEMO=1`.

### NOT done (this is where the laptop session starts)

1. **Admin reconciliation UI** — `src/app/admin/orders/[orderRef]/page.tsx` is untouched. Plan step 9: show intent (checkout/payment ids, fee/net, card scheme+last4), a **Reconcile** action (`GET /v1/checkouts/{id}`), and a **stuck-intent list** on `/admin/orders`. Silent failure is the real danger: a misconfigured webhook means money succeeds at the provider while orders stay pending here.
2. **`scripts/e2e-payments.mjs`** — not created. The test plan is in `PAYMENTS-PLAN.md` §5 ("Test plan"). Mirror `scripts/e2e.mjs` + `scripts/simulate-payment.mjs`; run over a DB copy, never `custom.db`.
3. **Real sandbox pass** — needs a Payments.lk account application submitted at `app.payments.lk` (owner action; sandbox checkouts do not work before that). No `PAYMENTS_*` keys exist anywhere yet.
4. **Push + deploy** — the feature is committed (`c0d5182`) but not on GitHub and not deployed. Prod is at `3a6f397`, before any of it.
5. **Security fixes F01–F19** — status: F02 partially done (installed `next` is **16.4.2**, already ≥ 16.3.8; `sharp` is **0.34.5**, target 0.35.5). F03 remote URL cleaned, but the leaked PAT still needs rotation at GitHub. F01 (login throttle/lockout), F04, F05, F06 and the rest are **not done**. See `PAYMENTS-PLAN.md` §3.

---

## 2. Live production facts (verified 2026-10-30)

- **URL:** https://www.basnayakavermigrow.lk — **www is canonical**; apex 301s to it. Caddy auto-TLS. Admin: `/admin/login`.
- **Server:** Contabo VPS, host `vmi3559693`, **161.97.120.230**, Ubuntu 24.04, 4 vCPU / 8 GB / 96 GB. ufw allows 22/80/443.
- **SSH:** `root@161.97.120.230`, key `~/.ssh/id_ed25519_contabo` (comment `deploy@basnayakavermigrow`). Verified working from this desktop today.
- **App dir:** `/var/www/basnayakavermigrow/app` (git clone, HEAD `3a6f397`, tracked & clean).
- **DB:** `/var/www/basnayakavermigrow/db/custom.db` (SQLite).
- **Uploads:** `/var/www/basnayakavermigrow/uploads` (Caddy serves `/uploads/*`).
- **Env file:** `/etc/basnayakavermigrow.env` (root-only). Vars present: `NODE_ENV HOSTNAME PORT DATABASE_URL UPLOADS_DIR NEXTAUTH_URL NEXTAUTH_SECRET SMS_PROVIDER TEXTLK_API_TOKEN TEXTLK_SENDER_ID SMS_COUNTRY_CODE SMS_DAILY_CAP SMS_AUTOSEND`. **No `PAYMENTS_*` keys — card payments are off in prod.**
- **Service:** `systemctl status basnayaka` (User=www-data, WorkingDirectory=`…/app/.next/standalone`, `ExecStart node server.js`, port 3001 behind Caddy).
- **Prod data (counts only, 2026-10-30):** Sale=2, Pack=1, Payment=1, FundEntry=2, OrderEvent=1, SmsEvent=0, Donor=2, Product=1. **The client is now using the live system — the DB is no longer empty. Treat it as real customer data.**
- **Deploy script:** `sudo /usr/local/bin/deploy-vermigrow` — pull → env → `npm ci --include=dev` → `prisma generate` → `prisma db push` → `npm run build` → restart → verify. It self-resyncs from the repo copy.
- **Domains/DNS:** `.lk` at domains.lk, NS delegated to clouDNS; apex+www A → 161.97.120.230.
- **Backups:** persistent data is `db/custom.db` + `uploads/`. **No cron backup yet.**

### Hard rules
- **Never copy the live DB to a dev machine** (customer phone numbers/orders). To test a change, copy it to a scratch path **on the VPS** and point `DATABASE_URL` there.
- **Never add a unique constraint or FK to an existing table** — `prisma db push` aborts the deploy.
- The live admin password is **not** the one in `SECRETS.local.md` (the client changed it; the file's value returns 401). Do not reset it unasked.

---

## 3. Where the code is (three copies)

| Copy | Commit | Notes |
|---|---|---|
| Desktop working tree | `main` @ the docs commit | **The only copy of the new commits** |
| VPS `/var/www/.../app` | `3a6f397` | Deployed, running |
| `origin` GitHub (`basnayakavermigrowdev-alt/basnayaka-vermigrow`) | behind `3a6f397` | Push needs credentials |
| `personal` GitHub (`GiharaX97/basnayake-vermigrow`) | **`cb4dbe0`** | Pushed 2026-10-30 (repo moved: `Giharax97` → `GiharaX97`) |

**Commits added 2026-10-30 (unpushed):**

| Commit | What |
|---|---|
| `c0d5182` | payments: Payments.lk hosted checkout, webhook, `settleOrderTx`, order UI, `simulate-payment.mjs`, Apeksha copy |
| *docs commit* | `PAYMENTS-PLAN.md`, `SECURITY-AUDIT-2026-10-09.html`, this handoff, `AGENTS.md` |
| *tools commit* | `deck/` QR sources + PDFs, `scripts/_*.mjs` probes, `.gitignore` scratch/DB rules |

**Push completed 2026-10-30:** `git push personal main` → `3a6f397..cb4dbe0`. The stored
credential (`credential.helper=store`) worked even though `git@github.com` has no key and `gh` is
not installed. `personal` now points at `GiharaX97/basnayake-vermigrow` (the old `Giharax97`
spelling redirects).

`origin` (the client's `basnayakavermigrowdev-alt` repo) may still be behind; the VPS pulls from
`origin`, so a deploy needs the commits reachable from whatever remote the VPS clone reads
(§8). Clone URL for the laptop:

```powershell
git clone https://github.com/GiharaX97/basnayake-vermigrow.git
```

---

## 4. Immediate next steps (in order)

1. Get the code onto the laptop — `git clone` once the push succeeds, otherwise copy the folder (§6) — and verify it runs (§7).
2. `npx tsc --noEmit` + open `http://localhost:3001`, place a test order, click **Pay by card** → demo page → confirm the order turns `paid` and a fund entry appears.
3. Confirm the commits arrived: `git log --oneline -5` should show `c0d5182` and the docs/tools commits.
4. Build the admin reconciliation UI (stuck intents + Reconcile).
5. Write `scripts/e2e-payments.mjs` from `PAYMENTS-PLAN.md` §5.
6. Only then deploy: the payments commit is additive (two new tables), but prod now has real data — dry-run `prisma db push` against a **copy on the VPS** first.
7. Owner action, in parallel: apply at `app.payments.lk`, mint test keys, add webhook `https://www.basnayakavermigrow.lk/api/payments/webhook`, subscribe only to `payment.succeeded`, `payment.failed`, `checkout.expired`, put `whsec_…` in `/etc/basnayakavermigrow.env`.

---

## 5. Local environment (this desktop, reproduce on laptop)

- Node **v24.16.0**, npm **11.13.0**. `bun` is **not installed** — `npm start` (standalone) uses bun, so use `npm run dev` or `node .next/standalone/server.js` manually.
- `next` **16.4.2**, `sharp` 0.34.5, Prisma 6.11.
- Dev server: `npm run dev` → **port 3001**.
- **Desktop-only quirk (2026-10-30):** this desktop's `node_modules` has no `.bin/next` shim and its
  native SWC binding is rejected by Windows, so `npm run build` fails locally with
  `Turbopack is not supported on this platform`. The code itself builds fine:
  `node node_modules/next/dist/bin/next build --webpack` **succeeded** (all routes emitted,
  including `/api/payments/*`, `/order/complete`, `/order/demo-pay`). On the laptop a clean
  `npm ci` should restore both; if Turbopack still complains, use `--webpack`.
- `.env` (gitignored) keys: `DATABASE_URL`, `ADMIN_PASSWORD`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, SMS block (`SMS_PROVIDER=text-lk`, `SMS_DAILY_CAP`, `SMS_AUTOSEND`, `HTTPSMS_WEBHOOK_SECRET`, `HTTPSMS_FROM`, `SMS_COUNTRY_CODE`, `TEXTLK_API_TOKEN`, `TEXTLK_SENDER_ID`), payments (`PAYMENTS_LK_DEMO=1`, `PAYMENTS_LK_WEBHOOK_SECRET`).
- Local admin password (dev DB): `admin123`.
- Local DB `db/custom.db` holds the demo orders/intents; `db/e2e.db`, `db/sms-e2e.db`, `db/deck-demo.db`, `db/custom.db.backup-*` are copies.

**Text.lk caveats (from the last sessions):** the account is paid (`TextLKDemo` sender currently replaces delivered bodies with a TEST SMS notice); `Gedawila` sender ID is **not authorised yet**; the `{id}|{key}` token **must stay quoted** in the server env file; inbound webhook format differs from our httpSMS route.

---

## 6. Copy to the laptop — checklist

**Preferred: clone from GitHub once the push in §3 succeeds.** The clone gives you every commit,
including the QR PDFs and the payments feature. You still need the files in the table below by
hand, because they are gitignored.

**Fallback (or if the push is blocked):** copy the folder. Total size excluding
`node_modules`/`.next` is **~32 MB** (`.git` is 7.5 MB), so a USB stick or network share is fine.

**Do NOT copy:** `node_modules/`, `.next/` (rebuild on the laptop). **Do copy** `.git/` — the two unpushed commits and history live there.

### Must-copy list (everything else comes with the folder)

| Item | Why |
|---|---|
| whole project folder minus `node_modules`, `.next` | source + `.git` history + unpushed commits |
| `.env` | local secrets/config (gitignored) |
| `.env.bak` (optional) | older local config |
| `SECRETS.local.md` | admin credentials notes (gitignored) |
| `db/custom.db` | local content blob + demo orders (gitignored) |
| `.claude/settings.local.json` | project-local permission allow-list |
| `~/.ssh/id_ed25519_contabo` + `.pub` | **VPS access** |
| `~/.ssh/known_hosts` (optional) | avoids the host-key prompt |
| `C:\Users\Gihara\.claude\projects\H--My-Projects-basnayake-glm5-2\memory\` | Claude's project memory (see below) |

### PowerShell (adjust `$dst` to the laptop path — USB drive or `\\LAPTOP\Share\...`)

```powershell
$src = "H:\My_Projects\basnayake-glm5.2"
$dst = "E:\basnayake-glm5.2"          # <-- laptop copy target
robocopy $src $dst /E /XD node_modules .next /XF *.log
# verify the important gitignored files made it:
Test-Path "$dst\.env", "$dst\SECRETS.local.md", "$dst\db\custom.db", "$dst\.git"
```

### SSH key on the laptop

```powershell
# copy id_ed25519_contabo (+ .pub) into C:\Users\<you>\.ssh\ on the laptop, then:
icacls "$env:USERPROFILE\.ssh\id_ed25519_contabo" /inheritance:r /grant:r "$env:USERNAME:(R)"
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_contabo" root@161.97.120.230 hostname
```

### Claude memory on the laptop

Copy the desktop's `...\.claude\projects\H--My-Projects-basnayake-glm5-2\memory\` folder into
`C:\Users\<you>\.claude\projects\<encoded-laptop-project-path>\memory\`.
The encoded folder name is the project path with `:` and `\` replaced by `-`
(e.g. `H:\My_Projects\basnayake-glm5.2` → `H--My-Projects-basnayake-glm5-2`). If the laptop path
differs, start a session once in the project, look at which `projects\<name>` folder appears, and
drop the memory files there. `MEMORY.md` is the index — keep it.

### Scratch/untracked files — do not commit

`.cardtest.tmp`, `.cookies.tmp` (may contain an admin session cookie), `.payments-openapi.tmp.json`,
`.sms-outbox*.log`, `dev*.log`, `server.log`, `build.log`, `cloudflared.log`,
`scripts/_e2e-order.mjs`, `scripts/_inspect-*.mjs`, `scripts/_probe-textlk.mjs`.
The real new source lives under `src/app/api/payments/`, `src/app/order/{complete,demo-pay}/`,
`src/lib/payments-lk.ts`, `src/types/`, and `scripts/simulate-payment.mjs`.

---

## 7. Start on the laptop

```powershell
# clone (if pushed) …
git clone https://github.com/Giharax97/basnayake-vermigrow.git basnayake-glm5.2
cd basnayake-glm5.2

# … then copy .env, SECRETS.local.md and db/custom.db into it (§6 table)
npm ci
npx prisma generate
npx prisma db push          # local DB is already up to date; safe no-op
npx tsc --noEmit            # must be clean (it was on the desktop)
npm run dev                 # http://localhost:3001
```

Smoke test the card flow:

1. Open `http://localhost:3001/order`, add something, place the order.
2. Click **Pay by card now** → lands on `/order/demo-pay?...` (because `PAYMENTS_LK_DEMO=1`).
3. Approve → returns to `/order/complete?...`; then check the order is `paid`, `paymentMethod=card`, and the donation wall total rose.
4. CLI alternative: `node scripts/simulate-payment.mjs VG-O-XXXXXX` (add `--outcome failed`, `--bad-signature`, `--replay` to prove refusals). Requires the dev server running and `PAYMENTS_LK_WEBHOOK_SECRET` in `.env`.

**Do not test against prod.** For schema dry-runs, copy the DB to a scratch path on the VPS.

---

## 8. Verify production / deploy from the laptop

```bash
# health
ssh -i ~/.ssh/id_ed25519_contabo root@161.97.120.230 \
  'cd /var/www/basnayakavermigrow/app && git log --oneline -1 && systemctl is-active basnayaka'
curl -s -o /dev/null -w "%{http_code}\n" https://www.basnayakavermigrow.lk/
```

Deploy (after the work is committed **and pushed to the remote the VPS pulls from**):

```bash
ssh -i ~/.ssh/id_ed25519_contabo root@161.97.120.230 'sudo /usr/local/bin/deploy-vermigrow'
```

If a push is impossible, the 2026-10-21 fallback was to fast-forward the VPS clone from the
`personal` remote — same idea, but the commit must reach a remote the VPS can read.

---

## 9. House rules that must not be broken

- **`Sale.status` is money; `Sale.fulfillment` is fulfilment.** Never merge them.
- Money is always derived server-side. Never accept a price, donation, total or status from a client.
- All money writers go through **one** transactional function (`settleOrderTx`).
- SMS is queued inside the transaction and sent **after** commit (`autoDeliver`).
- Webhook: **verify the signature over the raw body first**, then parse. Fulfil from `payment.succeeded`. The browser return proves nothing.
- Vouchers are minted at payment, `donationAmount: 0`; the seat's donation rides on the Sale line (no double counting).
- Never add a unique constraint or FK to an existing table.
- The public fund total comes from the fund ledger (`FundEntry`), not a per-channel sum.
- Content trap: the DB blob beats `content-defaults.ts`, and the live blob diverges from local. Always `--dry-run` a content migration against the live DB.

---

## 10. Known open items (not blockers for the farm session)

- **F01** login has no rate limit/lockout and a 4-char floor — highest-value security fix.
- **F03** rotate the GitHub PAT that leaked on 2026-09-27.
- **F04–F13** remaining Mediums/Lows (CMS `javascript:` hrefs, inquiry throttle, SVG upload, spoofable IP, admin middleware, CSP/HSTS, `rel=noopener`).
- `sharp` 0.34.5 → 0.35.5.
- `next` is already 16.4.2 (F02 target met).
- Content copy still contains invented placeholder text the owner has not reviewed (founder bio, stats, project years/dates).
- No cron backup for `db/custom.db` + `uploads/`.
- `.env` exists in plaintext on the desktop — rotate anything sensitive if that machine is ever backed up/shared.

---

## 11. Companion documents in the repo

- `PAYMENTS-PLAN.md` — decisions D1–D10, findings, files, test plan, order of work.
- `SECURITY-AUDIT-2026-10-09.html` — full audit report (open in a browser).
- `AGENTS.md` — auto-generated by `next dev`; commit it with your work.
- `DEPLOYMENT.md`, `PROJECT-STATUS.md`, `LAUNCH-PLAN.md`, `AUDIT-ISSUES.md` — **dated 2026-07/10, partly stale; the code is truth.**
