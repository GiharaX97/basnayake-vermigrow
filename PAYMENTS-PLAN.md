# Payments.lk integration + security remediation — working plan

**Status: AWAITING APPROVAL. No code has been written.** Read-only audit completed 2026-10-09.

Companion document: `SECURITY-AUDIT-2026-10-09.html` (open in a browser) — the full report with
severity-coded findings and code excerpts. This file is the actionable summary.

- Audit scope: source trace of the whole app, plus verification of the Payments.lk contract against
  the provider's own OpenAPI spec (`api.payments.lk/v1/openapi.json`).
- No files were modified, no production data was read, no live payment was made, no secret value
  was printed anywhere.

---

## 1. The approval gate

Nothing starts until these are answered. "Use your recommendations" is a valid answer.

| # | Decision | Recommendation |
|---|---|---|
| D1 | Upgrade Next.js 16.2.10 → 16.3.8+ and sharp 0.35.5? | **Yes** — mandatory pre-work, own deploy cycle |
| D2 | Revoke the leaked GitHub PAT? | **Yes** — user action at GitHub; cannot be done from here |
| D3 | Fix the four "do first" items now? | **Yes** — F01, F04, F05, F06 |
| D4 | Release held seats when a checkout expires? | **Yes** — on `checkout.expired` only, never on a paid order |
| D5 | Card payment alongside counter payment, or replacing it? | **Alongside** — walk-in flow untouched |
| D6 | Refunds in scope now? | **Later** — dashboard first; one money path in release 1 |
| D7 | Official Node SDK or plain `fetch` + `node:crypto`? | **No SDK** — hand-roll HMAC, mirror `sms/webhook-verify.ts` |
| D8 | Orders under Rs. 10 (provider minimum)? | Order proceeds, card not offered, office settles by hand |
| D9 | Text the customer the payment link? | **No** — on screen already; costs an SMS per order |
| D10 | Show provider fee / net amounts in admin? | **Yes** — makes bank reconciliation honest |

---

## 2. Blocking prerequisite

Production was last measured on **2026-10-04** as the **pre-SMS build**
(`/api/sms/webhook` → 404; `/`, `/order`, `/api/catalog` → 200). The order-book and inbound-SMS
work is committed (`d5069be`) but there is no evidence it is deployed.

Everything the payments work builds on lives in that undeployed code. **Deploy and verify current
`main` on its own, with its schema push, before writing any gateway code.** Otherwise every failure
afterwards is ambiguous.

---

## 3. Findings

**Headline: no critical vulnerability in the application's own code.** The money paths are
structurally sound. The weak point is the admin credential.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F01 | High | No rate limit, no lockout, 4-char floor on `POST /api/auth/login` | Per-IP + global throttle, escalating delay, 10-char minimum |
| F02 | High | next 16.2.10: 17 advisories, 3 critical RCE | `next` ≥16.3.8, `sharp` 0.35.5, then both E2E suites |
| F03 | High | GitHub PAT plaintext in `.git/config` | Revoke at GitHub; remote → plain HTTPS; clear stored credential |
| F04 | Med | CMS hrefs accept `javascript:` (`contact.tsx:105`, `navbar.tsx:79,148`) | Scheme allow-list at save time in the content schema |
| F05 | Med | `POST /api/inquiries` public, no throttle | Same throttle treatment as the order route |
| F06 | Med | Uploads accept SVG, trust client MIME; Caddy serves `/uploads/*` past `nosniff` | Drop SVG from the allow-list |
| F07 | Med | `clientIp()` reads spoofable first XFF hop; donations routes lack a global bucket | Add global buckets; fix the trusted-hop position |
| F08 | Med | `/admin` middleware checks cookie *length*, not validity | Validate the session in the admin layout |
| F09 | Low | Unguarded `GET /api/settings/password` performs a DB write | Remove, or move seeding to the deploy script |
| F10 | Low | `PATCH /api/inquiries/[id]` writes unvalidated status | `z.enum(['new','read'])` |
| F11 | Low | Payment/voucher idempotency is app-checked, not constrained | Solved by the new `PaymentIntent` table (below) |
| F12 | Low | No CSP, no HSTS | HSTS at Caddy; CSP report-only first (Leaflet + inline JSON-LD) |
| F13 | Low | Two same-origin `target="_blank"` links lack `rel="noopener"` | Add the attribute |
| F14 | Low | Live admin password unverifiable from here | Owner either tests it or authorises a reset |
| F15 | Info | Dead `getAdminPassword()` returns the stored hash | Delete it |
| F16 | Info | Pre-seed password compare not constant-time | Tidy when the file is next touched |
| F17 | Info | Live credentials in `.env` / `.env.bak` on the dev machine | Rotate if the machine is ever backed up or shared |
| F18 | Info | Malformed JSON to login → 500 | try/catch → 400 |
| F19 | Info | Build-time transitive advisories | Clears with `npm audit fix` alongside F02 |

### Verified safeguards — do NOT "fix" these

Prices/donations/totals re-derived from the DB · every one of the 31 admin route methods calls
`isAdminAuthenticated()` first · `FundEntry @@unique([channel, refId])` prevents double-counting ·
money snapshotted on `Sale`/`Pack` · vouchers minted inside the payment transaction at
`donationAmount: 0` · no `eval`/`innerHTML` sinks · JSON-LD escapes `<` · SMS webhook is
signature-first, HS256-only, constant-time, idempotent · money fields zod-bounded with
`Number.isFinite` before any ledger write · no mass assignment · 192-bit CSPRNG receipt tokens with
uniform 404s · upload/delete paths traversal-safe · no endpoint returns or logs a secret.

---

## 4. Payments.lk — verified contract

Verified against the provider's OpenAPI document, not from memory.

- Base `https://api.payments.lk`. **No separate sandbox host** — the key prefix picks the mode.
- `Authorization: Bearer sk_test_…` / `sk_live_…`, **server-side only** (publishable keys cannot be
  called cross-origin).
- `POST /v1/checkouts` — **`Idempotency-Key` header required**.
- Amount is **integer LKR cents** (Rs. 10 = 1000, max Rs. 1,000,000). No currency field. Fractional
  is refused, never rounded. Spec: *"Take it from your own records, never from the browser."*
- 201 → `id` (`chk_…`), `url`, `expiresAt` (30 min), nested `payment`.
- Webhook: `Payments-Signature: t=<unix>,v1=<hex HMAC-SHA256("<t>.<rawBody>")>`, plus
  `Payments-Event-Id`. 300 s tolerance. **Verify before parsing.** Retries 1m/5m/30m/2h/6h/12h.
  2xx within 10 s. During rotation the header carries one `v1` per secret — accept any match.
- Fulfil from **`payment.succeeded`**. Spec on `successUrl`: *"It proves nothing; confirm from the
  webhook."*
- Reconcile: `GET /v1/checkouts/{id}`, `GET /v1/payments/{id}`, `GET /v1/events?since=`.
- Refunds exist (`POST /v1/refunds`) — deliberately out of release 1 (D6).
- Sandbox: test cards, outcome from expiry (`01/39` approved, `05/39` declined, `04/27` expired).
  **Sandbox needs a submitted application.**

Undocumented, so the design does not rely on it: whether the provider appends query params to
`successUrl`/`cancelUrl`. We store `checkout.id` against the order at creation instead.

---

## 5. Design

Customer orders → server derives the real total → `POST /v1/checkouts` with the secret key and
`Idempotency-Key: orderRef` → browser redirected to the hosted page → customer pays on the
provider's page → **signed webhook** to our endpoint → verify signature over the raw body first →
check type / mode / amount / currency / order association → settle in **one transaction** through
the *same function the admin "Mark paid" button uses*.

The property that matters: the browser return and the webhook travel separately, and only the
webhook can move money. The return page reads order state from our own database and writes nothing.

Card data never touches the app (structural; `Permissions-Policy: payment=()` already blocks the
Payment Request API). No card number or CVV is ever received, transmitted or stored. The only card
data that arrives is `{scheme, last4}` from the webhook.

---

## 6. Files

| Path | Change |
|---|---|
| `src/lib/payments-lk.ts` | **New** — create/retrieve checkout, verify webhook signature. Server-only, no SDK. |
| `src/app/api/payments/webhook/route.ts` | **New** — signature → validate → settle. Mirrors `api/sms/webhook/route.ts`. |
| `src/app/api/payments/start/route.ts` | **New** — takes `orderRef`, re-reads the expected total from the DB. **Never accepts an amount.** |
| `src/lib/order-actions.ts` | **Changed** — extract settlement into one exported transactional function. Most important structural change; a refactor, not a rewrite. |
| `src/app/api/admin/orders/[orderRef]/settle/route.ts` | **Changed** — becomes a thin caller of that function. |
| `src/app/api/orders/route.ts` | **Changed** — optionally create the intent + return a checkout URL. Manual flow stays default. |
| `src/app/order/page.tsx`, `src/components/site/order-client.tsx` | **Changed** — "Pay by card" + return page. Only customer-visible change. |
| `src/app/admin/orders/[orderRef]/page.tsx` | **Changed** — intent, provider ids, Reconcile action. |
| `prisma/schema.prisma` | **Changed** — two new models. **No change to any existing model.** |
| `scripts/simulate-payment.mjs` | **New** — signs a realistic event; mirrors `simulate-reply.mjs`. |
| `scripts/e2e-payments.mjs` | **New** suite over a DB copy with a mock provider. |

### Schema — two new tables

```
PaymentIntent         orderRef @unique, checkoutId @unique, paymentId @unique,
                      mode, amountCents, status, checkoutUrl, expiresAt,
                      failureMessage, feeCents, netCents, cardScheme, cardLast4

PaymentWebhookEvent   eventId @unique, eventType, mode, orderRef?, rawPayload,
                      processedAt, note
```

**Why new tables and not columns on `Payment`:** a unique index on a *new* table is created inside
`CREATE TABLE` and is free. Adding one to an *existing* table makes `prisma db push` **abort** under
the deploy script's data-loss gate. `providerRef` on `Sale` was rejected for the same reason, and
because it would let the money column and gateway state drift into each other.

### Migration and rollback

- **Forward:** `prisma db push` creates two tables. No existing table redefined, no column added to
  an existing table, no data touched. Dry-run against a copy of the live DB first.
- **Feature off by default:** with no `PAYMENTS_LK_SECRET_KEY`, the start route returns "card payment
  unavailable" and the order flow behaves exactly as today.
- **Rollback:** unset the env vars, redeploy the previous commit. The tables stay — additive and
  unread. No data loss, no schema reversal.
- **Hard constraint:** never add a unique constraint or FK to an existing table in this schema.

### Environment variables (names only)

`PAYMENTS_LK_SECRET_KEY` · `PAYMENTS_LK_WEBHOOK_SECRET` · `PAYMENTS_LK_MODE` (`test`|`live`)

All in `/etc/basnayakavermigrow.env` on the server. **Never paste a value into chat.**

### Payments.lk dashboard

1. **Apply at `app.payments.lk`** — sandbox checkouts do not work until the application is
   submitted. Owner action, and it is first.
2. Mint the test key pair. (Live keys take no payments until the account is activated.)
3. Add webhook endpoints, separate for test and live:
   `https://www.basnayakavermigrow.lk/api/payments/webhook`
4. Subscribe to **`payment.succeeded`, `payment.failed`, `checkout.expired` — nothing else.** The
   other 30 types are subscriptions, invoices, cards and billing alerts.
5. Copy each `whsec_…` (shown once) into the server env file.
6. Test with the dashboard ping; confirm our logs record a valid signature.

### Test plan (mock provider, DB copy, no live money)

Successful payment → paid + one fund entry + receipt + SMS + vouchers · declined → intent failed,
order still pending, no ledger row · cancelled/expired → nothing settled · invalid signature → 401,
order/fund/inventory provably unchanged · **amount tampered** → rejected on the amount check ·
unknown reference → recorded, nothing written · **duplicate delivery** → 200, one settlement ·
out-of-order (succeeded after expired) → succeeded wins on a pending order · double-clicked checkout
→ one intent, one checkout · **test-mode event vs live order** → rejected by mode check · another
customer's order/receipt → refused with the same message as nonexistent · insufficient seats →
refused at order time · provider timeout → pending, no duplicate · **browser returns with no
webhook** → order stays pending and the page says so.

### Deployment risks

Production is behind the repo (verify `main` first) · the Next.js upgrade is the riskiest single
change · SQLite is a single writer, and webhook+admin concurrency must be tested, not assumed · the
webhook must answer within 10 s (the "send SMS after commit" house rule already satisfies this) ·
**silent failure is the real danger** — a misconfigured webhook means payments succeed at the
provider while orders stay pending here, so Reconcile and the stuck-intent list must be visible in
admin · no new public exposure is needed; the HTTPS domain already exists.

---

## 7. Order of work

1. **F02** — Next.js + sharp upgrade, deployed and tested alone.
2. **F03** — token rotation (owner), then remote URL cleanup.
3. **F01** — login throttle, global bucket, password floor. Gate on everything else.
4. **F04, F05, F06** — the three "do first" hardening items.
5. **F07–F13** — remaining Mediums and Lows in one commit.
6. **Deploy and verify current `main` in production** (schema push included). See §2.
7. **Gateway code** — `payments-lk.ts`, webhook route, start route, the `order-actions.ts` refactor.
8. **Sandbox end-to-end** — a real test-card payment settling a real pending order on a DB copy.
9. **Reconciliation admin** + the stuck-intent list.
10. Live keys last, after a sandbox pass.

Each fix gets a regression test in the existing E2E style. The suites already run against a copy of
the database and already have a signed-webhook simulator to model `simulate-payment.mjs` on.

## 8. House rules that must not be broken

- `Sale.status` is **money**; `Sale.fulfillment` is **fulfilment**. Never merge them.
- Money is always derived server-side; never accept a price, donation, total or status from a client.
- All money writers go through one transactional function — one writer per state machine.
- Messages are queued inside the transaction and sent only after the commit.
- Webhook: verify the signature over the **raw body first**, then parse.
- Never add a unique constraint or FK to an existing table (it aborts `prisma db push`).
