# CODEBASE-TREE.md

Structural map of Basnayaka VermiGrow. One line per entry, no code bodies.
**Purpose:** stop re-discovering the same layout every session.
Keep this updated when files are added or removed.

Last updated: 2026-09-22 · HEAD `ff60d1b` + uncommitted catalog/orders/ledger/customer-messaging work, plus the SEO/server-rendering change (see "SEO & rendering").

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 6 + SQLite · Tailwind 4 · Zustand · sonner (toasts) · lucide-react icons. Package manager `npm`. Build output `standalone`.

**Dev:** `npm run dev` → port **3001**. **DB:** `db/custom.db` via `DATABASE_URL` in `.env`. **No migrations dir** — schema changes go through `prisma db push`.

---

## Routes — public

| Path | Kind | Notes |
|---|---|---|
| `/` | server | Composes every `<section id="…">` (each is still a client component). **Server-rendered**: reads the CMS via `readSiteContent()` so the content is in the HTML crawlers get, and emits the `LocalBusiness` + `WebSite` JSON-LD. Was `'use client'` + `loadFromServer()` until 2026-09-22 — see "SEO & rendering". |
| `/donations` | server → client | Thin server page (`metadata` + `alternates.canonical`) rendering `donations-client.tsx`. |
| `/order` | server → client | `dynamic = 'force-dynamic'` — reads the DB for catalog + seat counts, so it must not be prerendered into the standalone bundle. Renders `order-client.tsx`. Also emits `Product` JSON-LD, **but only for priced items** — see "SEO & rendering". |
| `/r/[token]` | server | **The only public per-record page.** A customer's private receipt, keyed on `CustomerLink.token` (CSPRNG, base64url, **case-sensitive**). Unknown / expired / revoked all render the SAME 404. `force-dynamic`, `robots: noindex`, masked phone. Branches on `link.refType` into order / pack / gift / sale views. See "Customer messaging" below. |

There is **no shared public layout** — each public page renders its own `<NoticeTicker/><Navbar/><main/><Footer/>` shell. `/r/[token]` is the exception: it renders a minimal logo-plus-one-link header instead, because the real `<Navbar/>` is `fixed` and styled to sit transparently over the home-page hero.

Section anchors in use: `work` `products` `map` `photos` `events` `notices` `training` `training-videos` `videos` `about` `founder` `contact`.

## Routes — admin (all behind `admin_session` cookie)

| Path | Notes |
|---|---|
| `/admin` | `export { default } from './dashboard/page'` |
| `/admin/login` | Only `/admin` route not behind middleware |
| `/admin/dashboard` | Counts only (inquiries/media/content). No money metrics. Own `quickActions` + `stats` arrays. |
| `/admin/content` | The real CMS editor (~958 lines). Duplicates the whole type set locally. Single "Save All". |
| `/admin/catalog` | Products **and** services CRUD: kind/price/unit/description/image/eventDate/location/capacity/active. Flags over-capacity and unpriced rows. (`/donations` used to own product CRUD.) |
| `/admin/donations` | Tabs: `orders` (default) · `sales` · `direct` · `payments` · `messages` · `qr`. Product CRUD moved to `/admin/catalog`; the newer tabs are extracted components. **`messages` is a TAB and not a 9th nav item on purpose** — the mobile bottom bar is already full at 8. |
| `/admin/warehouse` | ~707 lines. Tabs: `dispatch` (generate + dispatch), `dispatches`, `lookup`, `flags`. |
| `/admin/inquiries` | List + detail pane, mark read. |
| `/admin/media` | Uploads grid, copy-URL, delete. |
| `/admin/settings` | Password change only. **(No `/api/settings/route.ts` exists.)** |

## Routes — API

**Public:** `GET|POST /api/content` (GET public, POST admin) · `GET|POST /api/donations` · `POST /api/donations/scan` · `POST /api/inquiries` · `GET /api/catalog` · `POST /api/orders`.

**Admin:** `auth/{login,logout,check}` · `admin/products` + `[id]` · `admin/sales` + `[id]` · `admin/packs` · `admin/dispatches` + `[id]` · `admin/orders` · `admin/orders/[orderRef]/settle` · `admin/donations` + `[id]` · `admin/payments` · `admin/messages` + `[id]` · `inquiries` (GET) + `[id]` · `media` · `upload` · `settings/password`.

**Conventions every route follows:**
- Admin gate is the **first statement**: `if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`.
- `middleware.ts` matches `/admin/:path*` and `/r/:path*` — API routes are self-guarded. The `/r/` branch exists to pin `Cache-Control: no-store, private`, which Next overrides on a dynamic page response; see "Customer messaging".
- Envelopes: `400 {error:'Validation failed',details}` · `400 {error:'Invalid JSON body'}` · `401` · `404` (on catch, for update) · `409` (FK-blocked delete or bad state transition) · `201` create · `200 {success:true}` delete.
- Next 16 params are a Promise: `{ params }: { params: Promise<{ id: string }> }` then `await params`.
- Prisma import is always `@/lib/prisma`. **Never `@/lib/db`** (deprecated shim).
- Zod v4 via `safeParse` + `error.flatten().fieldErrors`. Numbers arrive as strings → `z.coerce.number()`.
- `export const dynamic = 'force-dynamic'` appears in exactly two places: `/api/catalog` and `/order` — the only public entry points that read the DB.

---

## Prisma models (`prisma/schema.prisma`)

| Model | Key fields | Notes |
|---|---|---|
| `SiteContent` | `key @unique`, `value` | Generic KV. Holds `site-content`, `admin:password`, `session:<bcrypt>`. |
| `Product` | `name`, `kind @default("product")`, `price`, `unit`, `description`, `imageUrl?`, `eventDate?`, `location?`, `capacity?`, `donationPerUnit @default(20)`, `active` | The single catalog item — `kind` is `product` or `service`. `price <= 0` ⇒ not orderable online. |
| `Sale` | `productId`, `quantity`, `unitPrice`, `retailer` **(required)**, `donationAmount`, `status @default("paid")`, `source @default("admin")`, `customerName/Phone/Email?`, `paymentMethod`, `paidAt?`, `orderRef?`, `note?` | One row per **line item**, for admin and online alike. `retailer` stays required (SQLite can't drop NOT NULL) — online orders write the `ONLINE_RETAILER` sentinel. |
| `Pack` | `code @unique`, `productId`, `donationAmount`, `status`, `scanCount`, `donorId @unique`, `deliveredAt?`, `redeemedAt?`, `holderName?`, `holderPhone?`, `saleId?`, `orderRef?` | The universal sellable unit. Product lifecycle `in_warehouse → dispatched → sold`; service lifecycle `issued → redeemed`. |
| `Donation` | `amount`, `method`, `donorName?`, `donorPhone?`, `note?`, `status`, `createdAt` | Gifts with no purchase — `Sale` can't hold them (`productId` is a required FK). `donorPhone` exists **only** so the giver can be thanked; it never reaches a public surface. |
| `Payment` | `amount`, `method`, `reference?`, `receivedBy?`, `note?`, `receivedAt`, `saleId?`, `donationId?`, `orderRef?` | One row per **money-receiving event**. A multi-line order is ONE receipt, so `saleId` is set only when the order has a single line and `orderRef` carries the link otherwise. |
| `FundEntry` | `amount`, `channel`, `refId?`, `status`, `createdAt`, `@@unique([channel, refId])` | The donation ledger. `channel` ∈ `sale \| pack \| direct \| machine`. |
| `Dispatch` | `retailer`, `note` | Stock sent to a retailer. |
| `ScanEvent` | `packId`, `userAgent` | Append-only scan log. Does not affect totals. |
| `Donor` | `name`, `amount`, `packId @unique` | Public wall. `amount 0` = name-only entry. **No phone column, deliberately** — every wall visitor fetches this table. |
| `CustomerLink` | `token @unique`, `refType`, `refId`, `expiresAt?`, `revokedAt?`, `@@unique([refType, refId])` | The receipt key. `refId` is **required, never NULL** — a NULL never collides in a SQLite unique index, which would make the idempotency guard a hole. No FK (an FK to an existing table forces a full redefine). |
| `CustomerMessage` | `linkId`, `toName?`, `toPhone?`, `template`, `body`, `status`, `sentAt?`, `sentBy?`, `error?`, `@@unique([linkId, template])` | The outbox. Written **inside the caller's transaction** alongside the money movement, exactly like `FundEntry`. `body` is frozen at creation — a record of what was actually said. |
| `Inquiry` | `name`, `email`, `message`, `status`, `readAt?` | Contact form. |
| `Upload`, `AdminUser` | — | **Dead schema** — written by nothing. |

**No `Settings` model, no `Order`/`OrderItem` model** (multi-line orders group by `Sale.orderRef` in the read model; the DB stays row-shaped). No enums (SQLite connector), no migrations.

## Money / donation math

**The public total is one query** — `fundTotal()` in `src/lib/fund.ts`:
`fundEntry.aggregate({ where: { status: 'paid' }, _sum: { amount } })`. Four channels write to it:

| Channel | Writer | Carries the amount on |
|---|---|---|
| `sale` | `POST /api/admin/sales`, order settle | the `Sale` line |
| `pack` | `POST /api/donations/scan` | the `Pack` |
| `direct` | `POST /api/admin/donations` | the `Donation` |
| `machine` | *not built* — reverse vending machines | — |

**The double-count invariant:** a unit is counted by exactly ONE channel. Product packs sold through the warehouse flow carry it on the `Pack`; online sales carry it on the `Sale` and mint **no** pack. Service vouchers are minted for delivery tracking with **`donationAmount = 0`** *on purpose* — the seat's donation is already on the `Sale` line — and they never reach `status='sold'` (they go `issued → redeemed`). Two independent reasons a voucher can't double-count; the schema comment warns against "fixing" the zero.

Idempotency is the database's job: `@@unique([channel, refId])` + an upsert means a retried scan or double-clicked "Mark paid" is a no-op, not a second contribution.

`Donor.amount` is **excluded** from the total (it would double-count). Pack QR points at `${origin}/donations?c=CODE`; `vg_scan_claim` cookie attributes a pack's amount to the first name submitted; `Donor.packId @unique` is the double-claim guard.

**Seat capacity** is `sum(Sale.quantity) where status ∈ {pending, paid}` vs `Product.capacity` — `_count.sales` is wrong (a 3-seat booking is 1 row), which is why `/api/admin/products` returns `seatsTaken` from a `groupBy`.

---

## Customer messaging (`src/lib/notify.ts` + `/r/[token]`)

**One rule decides everything:** a message exists **if and only if** there is a phone to send it to. `queueMessage()` returns `{status:'no_phone'}` and writes nothing when `toPhone` is blank. Consequence to remember — a record with no phone also gets **no receipt link**, so `/r/<token>` and a `CustomerMessage` row are created together or not at all.

**Queueing is transactional; sending is not.** `queueMessage(tx, …)` writes inside the caller's existing `$transaction`, like `recordFundEntry`, so a message can never exist for an event that rolled back. It must never do network I/O.

**Nothing on a public path ever sends.** `POST /api/orders` and the anonymous donor-wall claim both accept a phone from an unauthenticated caller behind a throttle keyed on a **spoofable** `x-forwarded-for`. Auto-sending from either would hand a stranger a paid-SMS primitive aimed at any number they type. Delivery is a separate, admin-triggered step.

**Transport seam:** `activeTransport()` is `'http'` when `SMS_GATEWAY_URL` is set, else `'manual'`. Manual = the admin taps Copy / Open SMS app and marks it sent. The `http` path **claims first** (`updateMany` on `status:'queued'`) then sends, so a double-tap cannot send twice; a provider error is recorded into `error`.

**Events wired:** `order_placed` + `order_paid` + `order_cancelled` (orders), `sale_thanks` (admin sale), `scan_thanks` (pack claim), `gift_thanks` (admin gift).

**Receipt-page security properties — do not weaken:**
- Keyed on the CSPRNG `CustomerLink.token` **only**. Never on `orderRef` or `Pack.code` (both short, one printed on stickers), and never a `?ref=` parameter.
- The token is looked up **exactly as received**. Every other code lookup in this app normalises with `.toUpperCase()` — doing that here would break most base64url links. The *reference* typed into the voucher gate is normalised; the token is not.
- Unknown, expired and revoked all give the **same 404**.
- Voucher codes are **never in the page HTML** — they are fetched by a Server Action after the order reference is entered (`src/lib/receipt-actions.ts`). Verified: 0 occurrences in the rendered page.
- `order_paid` deliberately names **no** reference and carries no QR: the link and the reference are the two halves of that gate, and one forwarded SMS must not hand over both.
- `Cache-Control: no-store, private` lives in **`middleware.ts`**, not just `next.config.ts` — Next overrides the config value on a dynamic page response. Measured: dev emits `no-cache, must-revalidate`, a production build emits `no-store, private`. The `next.config.ts` block must stay **after** the catch-all so `Referrer-Policy: no-referrer` overrides the site-wide `strict-origin-when-cross-origin`.

---

## `src/lib/`

| File | Purpose |
|---|---|
| `admin-auth.ts` | Cookie sessions. `isAdminAuthenticated()` is **O(sessions) bcrypt** — loads every `session:%` row and compares sequentially. Sessions live in `SiteContent`. |
| `catalog.ts` | `getCatalog()` — public read model: active items + `remainingSeats`, `orderable` flag. |
| `content-defaults.ts` | `SiteContent` interfaces + the whole `defaultContent` literal + `deepMergeDefaults()`. **Add a field here and it appears everywhere.** |
| `content-service.ts` | `getContent()` / `saveContent()` / `seedDefaultContent()` for the `site-content` row, plus **`readSiteContent()`** — the render-time read path (parse → `deepMergeDefaults`, wrapped in React `cache()`, **never throws**, **never writes**). Used by the root layout and `/`. |
| `structured-data.ts` | `buildSiteJsonLd()` (LocalBusiness + WebSite), `buildProductsJsonLd()` (Product `ItemList`, priced items only), `serializeJsonLd()` (escapes `<` so CMS text can't close the script tag). |
| `currency.ts` | `formatLkr()` — the single formatter. |
| `fund.ts` | `recordFundEntry()` (idempotent, transactional), `fundTotal()`, `cancelFundEntry()`. **All donation math lives here.** |
| `notify.ts` | `queueMessage()`, `renderMessage()`, `ensureLink()`, `deliverMessage()`, `revokeLink()`, `maskPhone()`, `requiredPhone`/`optionalPhone`, `linkExpiry()`. **Queues; never sends from a public path.** See "Customer messaging". |
| `receipt-actions.ts` | `'use server'` · `revealVouchers(token, reference)` — the gated reveal of workshop voucher codes on `/r/[token]`. Throttled 8/15min. |
| `orders.ts` | `ONLINE_RETAILER` sentinel, `generateOrderRef()`, order caps, `ACTIVE_SALE_STATUSES`, `CapacityError`, `seatsTaken()`, `assertSeatsAvailable()`. |
| `pack-codes.ts` | `generatePackCode(s)`, `PACK_CODE_REGEX = /^VG-[A-HJ-NP-Z2-9]{6}$/`. 32-char ambiguity-free alphabet. |
| `payments.ts` | The money vocabulary: `paymentMethodSchema`, labels, `optionalText()`, `deriveOrderStatus()`, `OrderStateError`, `settleSchema`, `STALE_PENDING_HOURS`. |
| `prisma.ts` | The `PrismaClient` singleton. |
| `product-schema.ts` | `productSchema` / `productUpdateSchema`. Note: zod `.partial()` does **not** neutralize `.default()`. |
| `throttle.ts` | `clientIp()`, `createThrottle({windowMs,max,maxKeys})`. `check()` returns **true when throttled**. Map is capped. |
| `uploads.ts` | `uploadsDir()` → `UPLOADS_DIR` env or `public/uploads`. |
| `utils.ts` | `cn()` = twMerge(clsx()). |
| `db.ts` | **Deprecated.** Do not import. |

**Security:** `ONLINE_RETAILER` is a server-only sentinel — **never import it into a client component** (a customer could impersonate a retailer's recorded sale). `POST /api/orders` is throttled per-IP (5/30min) **and** globally (60/hour), because `x-forwarded-for` is spoofable so per-IP alone bounds nothing; it also caps body size, checks `Origin`, and re-derives `unitPrice`/`donationAmount` from the DB — the client sends only `{productId, quantity}`. There is deliberately **no public order-status lookup** (enumerable, leaks name/phone/email).

## `src/components/`

- `ui/*` — 48 shadcn primitives. Admin actually uses only: button, card, input, label, switch, tabs, select, dialog, table, alert-dialog, badge, alert, textarea. `breadcrumb`, `chart`, `sidebar`, `command`, `carousel`, `calendar`, `pagination`, `form` are **unused**. `react-hook-form` is **not a dependency** — all forms are plain controlled `useState`. `toast.tsx`/`toaster.tsx`/`use-toast.ts` are the legacy set; **sonner** is what's mounted.
- `admin/` — `file-upload.tsx`, plus the tabs extracted out of `/admin/donations`: `orders-tab.tsx` (grouped orders, settle, stale badge), `direct-donations-tab.tsx`, `payments-tab.tsx`, `messages-tab.tsx` (the outbox).
- `site/*` — one file per home-page section. `edit-panel.tsx` is **dead code** (writes only to localStorage, mounted nowhere). `donations-client.tsx` is the live donation page; `order-client.tsx` is the ordering page; `receipt-vouchers.tsx` is the `/r/[token]` voucher reveal (renders the QR codes in-browser, same `QRCode.toDataURL` pattern as the admin QR tab).

## Content model

Store `src/store/content-store.tsx` (**`.tsx`** — it exports a provider component). **Not a
singleton and not persisted anymore.** `createContentStore(content)` builds a vanilla store; a
`ContentProvider` in the root layout holds one per request/mount and is seeded from
`readSiteContent()`. Why it matters: a module-level store is shared across concurrent server
requests, so seeding one per-request would render one visitor's content into another's page.
`persist`/localStorage is gone — server content is the single source of truth, and rehydrating to
content the server hadn't rendered was a hydration mismatch.
`useContentStore(selector?)` keeps its old signature (falls back to a default store with no
provider), so the ~17 consumers are unchanged. `loaded` is now `true` from the start.

Blob is stored as one row in `SiteContent` under `site-content`. `GET /api/content` is public and
auto-seeds; `POST` is admin-gated (validates only `body.brand`).
**Two writers:** `/admin/content` (live, POSTs to the API) and `edit-panel.tsx` (dead, localStorage only).

## SEO & rendering

**Rendering contract.** The root layout is `async`, reads the CMS, and wraps everything in
`ContentProvider`, with `export const revalidate = 300`. Confirmed in build output: `/` is
`○ (Static)` with `Revalidate 5m`. **An admin save does not wait out that window** —
`POST /api/content` calls `revalidatePath('/', 'layout')` after `saveContent()`. Measured on the
standalone build: `x-nextjs-cache: HIT` with `s-maxage=300` before the save, new content served
after it. Next 16 removed `revalidate` from route segment config *only when `cacheComponents` is
enabled* — it is not enabled here, so the previous model applies. `/order` and `/r/[token]` stay
`force-dynamic` on purpose.

**A trap worth knowing:** running `next dev` on top of a production `.next` makes `/api/content`
404 while `/` still returns 200 — the dev server picks up stale build artifacts. `rm -rf .next`
before `npm run dev` if a route inexplicably 404s. Not caused by this refactor.

**Metadata comes from the CMS.** `generateMetadata()` in the root layout reads `seoTitle`,
`seoDescription` and `ogImage` (all three existed in `content-defaults.ts` for months and were read
by nothing until 2026-09-22). Each field falls back independently to a hardcoded default.
`/admin/content` has an **SEO** tab for them. Per-page metadata on `/donations` and `/order` still
overrides.

**Structured data.** `LocalBusiness` + `WebSite` on `/` only. `Product` `ItemList` on `/order`
**only for priced items** — a `price` of 0 is this app's "not set yet" sentinel, and Google requires
a real price, so an unpriced item is omitted rather than advertised at LKR 0.
The type is `LocalBusiness`, **not `Farm`**: `schema.org/Farm` is a 404 and the type tree does not
list it (several SEO blogs claim otherwise). Google also does not support `additionalType`, so
there is no valid way to be more specific.

**Still open:** `next/image` is used in one component only (the rest use raw `<img>`, so no
responsive sizing/lazy loading); the sitemap lists fragment URLs (`/#work`, …) which are not
distinct URLs to a crawler.

**Careful — two unrelated "product" concepts:**
1. `content.products` (`ProductItem` in `content-defaults.ts`) — CMS marketing cards, **free-text** prices (`'Rs 350'`), no ids. Rendered by `site/services.tsx`.
2. Prisma `Product` — the real catalog item with a numeric price. **The DB is authoritative for ordering**; the two lists are not yet unified.

---

## Components editing checklist (no shared route config)

- **Public nav** → `navItems` in `site/navbar.tsx` (module-level array; `/#hash` for anchors, `/path` for real routes) **and** the duplicated list in `site/footer.tsx` **and** `src/app/sitemap.ts`. Footer/navbar anchors must be `/#hash`, not bare `#hash`, or they only work on `/`.
- **Admin nav** → `navItems` **and** `breadcrumbLabels` in `admin/admin-layout-client.tsx`. Breadcrumb lookup is **exact-path only**; active state is `pathname === item.href`. Mobile bottom nav is **8 items**, fitted with per-item `short` labels + `text-[9px]` + `truncate` — a 9th needs a rethink, not another entry.
- **New dashboard tile** → `quickActions` / `stats` arrays in `admin/dashboard/page.tsx`.

## Deploy

| File | Purpose |
|---|---|
| `deploy-vermigrow.sh` | 7 steps. **[4/7]** `prisma generate` + `prisma db push` (bare, under `set -euo pipefail`, non-TTY). **[6/7]** restart. Schema-at-4/restart-at-6 is safe (old code + new schema). |
| `provision-vps.sh` | One-time VPS setup. |
| `Caddyfile` / `Caddyfile.production` | Reverse proxy. Production sets canonical host → `www`. |
| `basnayaka.service` | systemd unit. |

**Schema discipline (protects live data — 249 in-warehouse packs and the existing sales):**
1. **Never rename `Product` or `Pack`** — a rename recreates the table and destroys its rows.
2. **No new unique constraint on an existing table** — Prisma's data-loss gate fires and `db push` is non-TTY, so the deploy **aborts**. A unique on a **new** table is fine (`FundEntry` relies on this).
3. **No new `@default(now())` columns on existing tables** — every existing row would be stamped with the ALTER-time timestamp. Use a nullable `DateTime?`.
4. **Never make `Sale.retailer` optional** — SQLite can't drop NOT NULL via ALTER TABLE.
5. **Never add `--accept-data-loss`** to the deploy script.
6. Check with `npx prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --script`: expect only `ALTER TABLE … ADD COLUMN` + `CREATE TABLE`. `CREATE TABLE "new_Sale"` / `DROP TABLE` means a redefine — stop.

**Live:** Contabo VPS `161.97.120.230`. Secrets in `SECRETS.local.md`.
`NEXTAUTH_URL` drives `metadataBase`, sitemap base, and the `secure` cookie flag. `NEXTAUTH_SECRET` is **dead config** — read nowhere.

## Known gotchas

- `next.config.ts` sends `Permissions-Policy: payment=()` site-wide → blocks the Payment Request API. Fine today (all money is offline), relevant if a gateway is ever added.
- `admin/sales/route.ts` has `take: 200` on the sales table; `admin/payments` has `take: 200`. Multi-line orders can straddle that cut.
- `/admin/donations` "Total raised" reads `publicTotal` (the ledger), so it matches the wall exactly. `totalDonated` in the same response is **sales-only** — it is context for the table, not the wall's number.
- `isAdminAuthenticated()` is O(sessions) bcrypt. Every admin API request pays it; the Donations page fires several.
- **A `session:<bcrypt>` row's `value` is the session's EXPIRY in epoch ms, not a flag.** `isAdminAuthenticated()` compares it against `Date.now()` and **deletes the row** when it has passed. Writing a placeholder (e.g. `'1'`) therefore mints a session that authenticates once and then silently vanishes — and the middleware only checks `cookie.length >= 20`, so `/admin` still renders 200 for a forged cookie while every `/api/admin/*` call 401s. That gap between the middleware check and the real check is why "the admin page loads" proves nothing about being logged in. Rows are only pruned lazily, by a lookup that finds them expired.
- **Nothing sends itself.** There is still no mailer and no SMTP, and no SMS gateway is connected (`transport: 'manual'`). Messages queue reliably; a human taps Send. If nobody opens the Messages tab, nobody gets told — the queued badge is the mitigation, a gateway is the fix.
- `Sale.unitPrice` was `0` for every admin-recorded sale before the receipt page existed. It is now snapshotted from `Product.price` at creation. Products whose catalog `price` is still 0 therefore produce a receipt with **no Total row** (the row is dropped rather than printing a false "Total LKR 0") and a `sale_thanks` body that states the fund amount only. Set the catalog price.
- Seat capacity is not perfectly race-free on SQLite: the loser of a concurrent booking may get `SQLITE_BUSY`/`P2034` rather than a clean 409. The "never overbook" invariant holds either way.
- Docs `PROJECT-STATUS.md`, `AUDIT-ISSUES.md`, `DEPLOYMENT.md` are **stale vs the code**.
