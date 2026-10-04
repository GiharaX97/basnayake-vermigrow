# Basnayaka Vermigrow Website — Work Log

---
Task ID: 1
Agent: main
Task: Build MakeFarm portfolio website with video, sliding photos, all-editable content, info sections, pro grade.

Work Log:
- Initialized fullstack-dev environment (Next.js 16 + TS + Tailwind 4 + shadcn/ui).
- Created content store (`src/store/content-store.ts`) using Zustand + persist middleware (localStorage).
- Built site components in `src/components/site/`:
  - `navbar.tsx` — sticky transparent → solid navbar with mobile menu, theme toggle, edit-mode toggle.
  - `hero.tsx` — full-screen hero with mixed video/image slides, autoplay, pause/play, prev/next, dot indicators.
  - `stats.tsx` — animated stats counters.
  - `about.tsx` — about section with mission/vision cards.
  - `services.tsx` — 4-card service grid with Lucide icons.
  - `photo-carousel.tsx` — Embla carousel of photos with lightbox viewer.
  - `video-showcase.tsx` — video card grid with modal player.
  - `projects.tsx` — projects gallery grid.
  - `contact.tsx` — dark contact section with form (validated, toast feedback).
  - `footer.tsx` — sticky footer with brand + nav.
  - `edit-panel.tsx` — slide-out editor panel with collapsible sections for every content type, add/remove items, export/import JSON, reset to defaults.
- Updated `layout.tsx` (ThemeProvider + Sonner toaster + SEO metadata).
- Updated `page.tsx` to compose all sections inside `min-h-screen flex flex-col` (sticky footer pattern).
- Updated `globals.css` with smooth scroll, scroll-padding-top, line-clamp utility.
- Verified with Agent Browser:
  - All 8 sections render (Hero, Stats, About, Services, Photos, Videos, Projects, Contact).
  - Edit panel opens with 8 collapsible sections (Brand, Hero slides, About, Stats, Services, Photos, Videos, Projects, Backup).
  - Theme toggle (light/dark) works.
  - Mobile hamburger menu works at 390×844.
  - Photo lightbox opens with prev/next/close.
  - Contact form: validates empty → "Please fill in all fields" toast; valid submit → "Thanks!" toast.
  - No console errors, no page errors.

Stage Summary:
- Final deliverable: live Next.js portfolio site at http://localhost:3000.
- All content (videos, photos, hero slides, services, stats, projects, contact info) is editable via the in-app Edit panel (pencil icon top-right).
- Changes persist in localStorage (`makefarm-content` key).
- Export/import JSON for backup & restore.
- Standards followed: Next.js 16 App Router, TypeScript, Tailwind 4, shadcn/ui (New York), mobile-first responsive, ARIA labels & semantic HTML, Framer Motion animations, sticky footer pattern, no indigo/blue (warm amber/earth palette).
- Preview screenshot saved to `/home/z/my-project/download/makefarm-preview.png`.

---
Task ID: 2
Agent: main
Task: Rebrand MakeFarm → Basnayaka Vermigrow (organic fertilizer farm in Karandeniya, Sri Lanka). Logo 05 is the main brand; logos 02/03/04 are the 3 sub-brand project logos.

Work Log:
- Copied user-uploaded logos from /home/z/my-project/upload/ to /home/z/my-project/public/logos/:
  - logo-main.png (05 — main Basnayaka Vermigrow logo)
  - logo-project-1.png (02)
  - logo-project-2.png (03)
  - logo-project-3.png (04)
- Rewrote src/store/content-store.ts with new default content:
  - Brand: "Basnayaka Vermigrow"
  - Tagline: "Organic fertility, from soil to harvest"
  - Hero slides with farm/soil themes
  - About: family-run organic farm in Karandeniya, Galle District, Southern Province, Sri Lanka
  - Mission/vision: soil health, chemical-free, Sri Lankan farms
  - Stats: 3 generations / 100% organic / 12+ batches/yr / 0 synthetic chemicals
  - 4 Services → Products: Vermicompost, Compost blending, Organic vegetables, Fish ATE nutrients
  - Photos: compost rows, vermi-beds, harvest baskets, hand sorting, curing shed
  - Videos: "Inside the vermi-shed", "From dung to soil", "Harvest day"
  - 3 Projects → Basnayaka family of brands: VermiCompost, Organic Veg, Fish Nutrient — each with logo, cover image, category, year, description
  - Contact: hello@basnayakavermigrow.lk, +94 77 123 4567, Karandeniya, Galle District, Southern Province, Sri Lanka
  - Socials: Facebook, WhatsApp, YouTube
  - localStorage key changed: basnayaka-vermigrow-content
- Updated navbar.tsx to show main logo image (05) in desktop + mobile menu.
- Updated footer.tsx to show main logo image (05).
- Updated projects.tsx: redesigned as logo-forward sub-brand cards (gradient header with logo, category + year badge, description, "Enquire" link).
- Added `logo` and `description` fields to ProjectItem type.
- Updated edit-panel.tsx: added logo URL + description fields to Projects section; updated icon options to include Sprout/Recycle/Leaf/Droplets for farm context.
- Updated services.tsx icon map: added Recycle, Leaf, Droplets (in addition to existing icons).
- Replaced all amber color usage with emerald across hero, about, services, photo-carousel, video-showcase, contact, navbar, edit-panel toggle.
- Updated layout.tsx SEO metadata: title, description, keywords, OpenGraph, Twitter cards for Basnayaka Vermigrow.
- Updated section headings: "Photo stories" → "From the farm"; "Recent films" → "Farm films"; "Services grown with care" → "Products & practices"; "Have a story to grow?" → "Want to grow with us?"; form placeholder now farm-appropriate.
- Verified with Agent Browser (fresh localStorage): title is "Basnayaka Vermigrow — Organic Fertilizer & Vegetables, Karandeniya, Sri Lanka"; all sections render with new content; all 5 logo images load (navbar + 3 project cards + footer); no console errors.
- Preview screenshot saved to /home/z/my-project/download/basnayaka-preview.png.

Stage Summary:
- Site fully rebranded from a generic creative studio portfolio to Basnayaka Vermigrow, an organic fertilizer & vegetable farm in Karandeniya, Sri Lanka.
- Main logo (05) appears in navbar and footer.
- 3 sub-brand project cards (logos 02, 03, 04) feature prominently in the "Basnayaka family of brands" section.
- All copy reflects the actual business: cow dung, chicken dung, fish-waste composting, vermicompost, organic vegetable cultivation, Karandeniya/Sri Lanka context.
- Color palette shifted from amber (creative studio) to emerald (organic farm).
- All content remains fully editable via the pencil-icon Edit panel; localStorage key is basnayaka-vermigrow-content.

---
Task ID: 3
Agent: main
Task: Donation program + full pack tracking. Retailers/own store sell packs; LKR 20 per unit (configurable per product) goes to a donation fund shown LIVE on the site. Buyers scan a per-pack QR to verify the pack and add their name to a public donor wall. Warehouse tracks every pack out the door and flags misuse.

Work Log:
- Prisma schema + db push (deploy script now also runs `prisma db push`):
  - `Product` — name, donationPerUnit (default 20), active.
  - `Sale` — manual (non-QR) sales: product, quantity, retailer, donationAmount = qty × rate SNAPSHOTTED at entry (later rate edits never rewrite history).
  - `Donor` — buyer-entered wall names (public POST, zod 2–60 chars, IP-throttled 5/30min).
  - `Pack` — unique code `VG-XXXXXX` (unambiguous alphabet, no 0/O/1/I), product, donationAmount snapshot, status in_warehouse → dispatched → sold, dispatchedAt/soldAt, scanCount.
  - `Dispatch` — retailer, note; `ScanEvent` — every scan logged (userAgent kept for forensics).
- Public APIs:
  - `GET /api/donations` — total = sum(Sale.donationAmount) + sum(sold Pack.donationAmount); donorCount + latest 60 names.
  - `POST /api/donations` — add donor name.
  - `POST /api/donations/scan` — {code} → 404 unknown; logs ScanEvent; FIRST scan flips pack to sold (donation auto-counts via sold-status aggregate, so repeats can never double-count); 30 scans/min/IP throttle.
- Public `/donations` page (`donations-client.tsx`): emerald hero with live total (10s polling + rAF count-up), name-entry form with optimistic prepend, auto-scrolling donor wall (CSS marquee, pauses on hover, fade edges, static grid when < 8 names), "how it works" card. `?c=VG-XXXXXX` from pack QR → scan call → toast verify → code stripped from URL so refresh/share can't rescan.
- Admin `/admin/warehouse` (new, sidebar + breadcrumbs "Warehouse"):
  - Generate pack codes (per product, ≤5000/batch) → printable QR sticker sheet (22mm, 4-col, @media print isolates sheet; each QR = `${origin}/donations?c=CODE`).
  - Dispatch to retailer (FIFO oldest in-warehouse packs, stock check) → sheet auto-opens; own-storefront sales need no dispatch — first scan sells straight from in_warehouse.
  - Dispatches table: per-product breakdown, sold/sent, sell-through % (green ≥70 / amber ≥30 / red), unaccounted count, re-print sheet, delete (returns unsold packs to warehouse; 409 if any sold).
  - Pack lookup by code: status badge, timeline (created/dispatched/sold), donation value counted/pending, scan history with device strings.
  - Flags tab: re-scanned packs (scanCount > 1, red at >2) + per-retailer packs unsold ≥30 days ("unaccounted/misuse" signal).
- Admin `/admin/donations`: record manual sales (live preview of donation added), products CRUD (edit dialog notes: rate changes only affect new records), recent sales table, summary tiles; poster-QR tab reworded to point per-pack work to Warehouse.
- Nav wiring: navbar items now absolute (`/#work`…) + "Donations" entry; footer Donations link; sitemap `/donations` daily; seeded 2 starter products at LKR 20.
- Verified end-to-end on dev :3001 (build ✓, lint clean vs codebase baseline):
  - Manual sale 50 × 20 → public total 1000; donor add/validate/401-gating; /donations 200; /admin/donations 200 authed, 307 unauthed.
  - 3 packs generated → 2 dispatched → stats {warehouse 1, dispatched 2, sold 0} → scan → sold + total 20 → rescan "already" (total still 20) → unknown/bad-format 404 → lookup sold scans:2 → rescanned flag raised → delete-sold-dispatch 409 → unauth generate 401 → test data cleaned, total 0.
- Local dev DB note: stored admin hash had drifted from SECRETS.local.md; realigned local DB hash to the documented password (live VPS untouched — deploy will apply schema + this build).

Stage Summary:
- Live public donation wall at `/donations` with real-time total, buyer self-entry, auto-scrolling names.
- Per-pack QR codes give warehouse-grade traceability: generated → dispatched (retailer) → sold (first scan), with sell-through % per retailer and misuse flags (re-scans, long-unsold stock).
- Donation total = manual sales + auto scan-sales, both snapshot-based — no double counting, no retroactive rate changes.
- Deploy-ready: `deploy-vermigrow.sh` now runs `npx prisma db push` (step 4) so Product/Sale/Donor/Pack/Dispatch/ScanEvent tables are created on the VPS.

## 2026-09-11 — Per-customer donation amounts on the donor wall
- Schema: `Donor.amount Float @default(0)` + 1:1 `Donor.pack ↔ Pack.donor` (both sides @unique; Pack side `onDelete: SetNull`). `prisma db push` applied locally.
- Scan API (`/api/donations/scan`): on every successful scan (first or repeat) sets `vg_scan_claim` HttpOnly cookie (24h, secure keyed on NEXTAUTH_URL like the admin cookie).
- Donations POST: first name submitted against the claimed pack inherits its `donationAmount` server-side inside a transaction; `Donor.packId @unique` + race-fallback means a pack can fund exactly one wall entry ever. Claim cookie deleted after use. Name-only entries (no/spent claim) get amount 0.
- Wall UI: emerald LKR chip beside the donor name when amount > 0; GET payload now includes `amount`.
- Verified on dev :3001 (via curl cookie jars): scan VG-RNUSCM → name submit → amount 20 + packId linked; re-scan 'already' → second name → amount 0 (claim spent); no-cookie name → amount 0; fund total unchanged by claims (still aggregates packs+sales only). Page 200 local + via ngrok.
- Note: wall entries created before this feature (e.g. "Test Donor") show no amount — amounts exist only where a QR scan preceded the name.

## 2026-09-20 — Full system test run (local, `db/custom.db`)

Tested the whole system end to end on the working DB, then **restored the DB to its exact
pre-test baseline**. Working DB after the run: ledger 180, 249 `in_warehouse`, 4 sold,
1 sale, 5 donors, 0 links, 0 messages, 2 products.

### Fixed in this session

- **`Sale.unitPrice` was `0` on every admin-recorded sale.** Nothing rendered a total for one
  until `/r/<token>` existed, so a real purchase would have printed "Total LKR 0". Now
  snapshotted from `Product.price` at creation (`api/admin/sales/route.ts`).
- **`sale_thanks` left a dangling connective** when a product had no catalog price:
  *"thank you for buying from us. **and** LKR 60 of it went to the community fund."* The total
  is now its own sentence (`lib/notify.ts`).
- **A receipt for a zero-priced sale printed a false "Total LKR 0".** The Total row is now
  dropped when there is no total, rather than stating one that isn't real (`r/[token]/page.tsx`).
- **Repo junk removed** — a 935-line dumped agent transcript and a `.tmp-print-test/` scratch
  dir were sitting untracked in the root. `.gitignore` now also covers `db/*.backup-*`,
  `db/verify.db`, `.tmp-*/` and dumped-transcript filenames (the existing `db/*.db-*` pattern
  only matched SQLite sidecars).

### Trap worth remembering

`SiteContent` session rows store the session's **expiry in epoch ms** as `value`.
`isAdminAuthenticated()` compares it to `Date.now()` and **deletes the row** once passed — so a
placeholder `value` mints a session that works once and then silently disappears. Compounding
it: middleware only checks `cookie.length >= 20`, so `/admin` renders **200 for a forged cookie**
while every `/api/admin/*` call 401s. **"The admin page loads" proves nothing about being logged
in** — always probe an admin API. Both facts are now in `CODEBASE-TREE.md`.

### Verified (observed, not asserted)

| Flow | Result |
|---|---|
| Public pages | `/` `/order` `/donations` `/sitemap.xml` `/robots.txt` **200** |
| Admin pages | all 9 → **307** to login without a cookie, **200** with one; `/admin/login` 200 |
| Catalog CRUD | created a product + a service; both orderable, seats counted |
| Place order | `VG-O-LLNPTM`, total 13,000, fund 700, 1 message + 1 link; ledger **unmoved** (pending ≠ raised) |
| Receipt `/r/<token>` | full order, phone masked `077 ••• 4567`, **full phone absent from the HTML** |
| Key isolation | `/r/VG-O-LLNPTM` **404**, lowercased token **404** — the order ref is not a key |
| Settle paid | 1 payment, 2 vouchers (`donationAmount: 0` by design), ledger 180→880, **2 messages sharing 1 link** |
| Re-settle | **409**, no third message |
| Voucher reveal | wrong ref rejected; right / lowercase / spaced refs accepted; **codes absent from the page HTML** |
| Pack scan + wall claim | ledger 880→900, `scan_thanks` queued, wall returns only `{id,name,amount,createdAt}` |
| Admin sale + gift | `unitPrice=1500` snapshot; `sale_thanks` grammar correct; `donorPhone` stored |
| Message actions | send 200 → resend **409** → skip-sent **409**; skip 200; revoke 200 and the receipt **404**s |
| Message API guards | no auth **401**, bad action **400**, missing id **404** |
| Order validation | unpriced **409**, unknown product **409**, over-cap qty **400**, zero qty / bad phone / empty items / no name **400**, bad origin **403**, malformed JSON **400** |
| Order throttle | exactly 5 accepted per IP, 6th **429** |
| Static analysis | `tsc --noEmit` clean · `eslint` **10 errors + 1 warning** (baseline) · `npm run build` exit 0 |

Receipt headers in **dev** come back `Cache-Control: no-cache, must-revalidate` (Next overrides
the config value); a production build emits `no-store, private`. `Referrer-Policy: no-referrer`
and `X-Robots-Tag` are correct in both.

### Open — needs a business decision, deliberately not guessed

**Neither real product has a price, so nothing is orderable online.** `Vermigrow Fertilizer 1kg`
and `Vermicompost 5kg` are both `price = 0`, which the system reads as "no price set yet":
`/order` shows *"Ask for price"* and `POST /api/orders` rejects them. There are also **no
workshop services in the catalog at all.** The CMS cards say *Vermicompost — Rs 350*, but the DB
product is *Vermicompost 5kg* with no unit set, and *Vermigrow Fertilizer 1kg* has no CMS
counterpart. Prices and units are needed before the order flow is usable for real.

**The schema is pushed LOCALLY ONLY — the production VPS (161.97.120.230) has not been migrated.**

## 2026-09-22 — SEO: server-rendered CMS content + structured data

Two gaps found while auditing SEO. Both fixed and verified; **nothing was deployed** and the schema
did not change.

### The problem

**1. The CMS was invisible to crawlers.** `src/app/page.tsx` was `'use client'` and got its content
from `loadFromServer()` inside a `useEffect`. The store's initial state is the hardcoded
`defaultContent`, so the HTML Google received contained the **default** marketing copy — every edit
made in `/admin/content` reached the browser only after hydration. The same HTML also shipped a
full-screen `LoadingOverlay` over the content, because `loaded` started `false`.

**2. No structured data at all.** Zero `application/ld+json` in the repo — no local-business signal
for a business whose entire value is being local.

### What changed

- **`/` is now a server component.** All 18 sections are unchanged and remain client components; a
  server component may render them, so **no client boundary moved**. Confirmed by audit: all 23 files
  in `src/components/site/` were already `'use client'`, and every browser-global access in them sits
  inside a `useEffect`, an event handler, or a `typeof window` guard — nothing unguarded at render.
- **The store is no longer a singleton, and no longer persisted.** `content-store.ts` → **`.tsx`**
  (it now exports a provider). `createContentStore()` + a `ContentProvider` in the root layout gives
  each request/mount its own store seeded from the DB. This matters: a module-level store is shared
  across concurrent server requests, so seeding one per-request would render one visitor's content
  into another visitor's page. Dropping `persist` also removed a **pre-existing** hydration mismatch
  (localStorage rehydrating to content the server had not rendered). `useContentStore(selector?)`
  keeps its signature, so all ~17 consumers are untouched.
- **`readSiteContent()`** in `content-service.ts` — the render path. Reuses `deepMergeDefaults` like
  `GET /api/content` does, wrapped in React `cache()`. **Never writes** (a render must not have side
  effects) and **never throws** — a corrupt row falls back to defaults so `/admin/login` can never
  depend on content.
- **Caching:** `revalidate = 300` on the layout + `revalidatePath('/', 'layout')` on admin save.
- **Structured data:** `src/lib/structured-data.ts` — `LocalBusiness` + `WebSite` on `/`, `Product`
  `ItemList` on `/order`.
- **Three dead CMS fields wired up.** `seoTitle`, `seoDescription` and `ogImage` had been declared in
  `content-defaults.ts` for months and read by nothing. `generateMetadata()` now uses them (with
  independent fallbacks), which also closes the "no OG image" gap. New **SEO tab** in
  `/admin/content` to edit them.

### Two things worth remembering

- **`schema.org/Farm` does not exist.** It 404s, and the full schema.org type tree (570 KB) contains
  `LocalBusiness` 6 times and `Farm` **zero** times. Several SEO blogs recommend `Farm`; they are
  wrong. Google also states it does not support `additionalType`, so `LocalBusiness` is as specific
  as this can honestly get. Verified, not assumed.
- **Running `next dev` on top of a production `.next` makes `/api/content` 404** while `/` still
  returns 200. That cost time mid-verification and is a stale-artifact quirk, not a code fault —
  `rm -rf .next` fixes it.

### Verified (observed, not asserted)

Every test ran against a **copy** of `db/custom.db`; the working DB was confirmed **byte-identical**
(sha256) before and after. Test scripts and the copy were deleted afterwards.

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` | **10 errors + 1 warning** — exactly the documented baseline |
| `npm run build` | exit 0; `/` is `○ (Static)` with `Revalidate 5m` |
| **CMS content in raw HTML** | marker written via the **real authenticated `POST /api/content`** appears in the SSR HTML, and the hardcoded default `aboutTitle` is **absent** |
| Revalidation contract | `x-nextjs-cache: HIT`, `s-maxage=300` on first load; new content served immediately after a save — the 5-minute window is not waited out |
| JSON-LD on `/` | one block, parses, `LocalBusiness` with non-empty `name`/`address`/`telephone`, absolute `url`, no `""` values anywhere |
| `Product` markup | with a price set on one product: exactly one `Product` at price 350 / LKR / availability; **the unpriced product is not advertised** |
| Corrupt content row | `/admin/login` and `/` both still 200; falls back to defaults; JSON-LD still valid |
| No regressions | `/donations` `/order` `/sitemap.xml` `/robots.txt` 200; admin API still 401s without a cookie; no hydration warnings in the dev log |

### Still open (unchanged by this work)

- `next/image` is used in one component only; the rest use raw `<img>` — no responsive sizing or
  lazy loading (LCP).
- The sitemap still lists fragment URLs (`/#work`, `/#products`, …), which are not distinct URLs to
  a crawler.
- **Neither product has a price**, so `/order` still advertises nothing and `Product` markup stays
  empty until prices are set. The marketing CMS still shows *Vermicompost — Rs 350* with no
  counterpart in the DB catalog.
- **The schema is pushed LOCALLY ONLY** — the production VPS has still not been migrated.
  → **Resolved 2026-09-28** (see the entry below).

---

## 2026-09-28 — Production selling outage: root cause, fix applied, live re-test

**Reported as:** "test today live site with all product selling progress, catch any issues."

### What the live site was doing (external HTTP probe only)

| Endpoint | Before | After |
|---|---|---|
| `/order` | **500** | 200 |
| `GET /api/catalog` | **500** (empty body) | 200 `{"items":[]}` |
| `GET /api/donations` | **500** (empty body) | 200 `{"total":0,"donorCount":0,"donors":[]}` |
| `/r/<token>` | **500** for any token | **404** (the correct answer) |
| `POST /api/orders` (valid shape) | **500** `Could not place your order` | **409** `One of the items is no longer available` |

Unaffected and confirmed working: `/` (all 12 section anchors, CMS content and JSON-LD in the raw
HTML), `/admin/login`, `GET /api/content`, `/api/auth/check`, `/sitemap.xml`, `/robots.txt`, the
HTTP→HTTPS 308 and apex→www 301 redirects, admin guards (307 → login unauthenticated, 401 on the
admin APIs), and a clean 404 for an unknown path.

**The `/donations` page was the quiet one.** It returns **200** while being useless: the live total
and the donor wall both stay on loading skeletons forever, because `donations-client.tsx` does
`if (!res.ok) return` and swallows the failure. A visitor sees an endless spinner, never an error.

### Root cause (confirmed firsthand this time)

`sqlite3 /var/www/basnayakavermigrow/db/custom.db ".tables"` printed exactly **4** tables —
`AdminUser Inquiry SiteContent Upload`. The code expects **15**. The 2026-09-22 deploy invoked the
**stale installed** `/usr/local/bin/deploy-vermigrow` (dated 2026-09-08), which contained no
`npx prisma db push`. It regenerated the Prisma client, never pushed the schema, and honestly
printed `DEPLOY_OK` — every step it actually ran had succeeded.

It went unnoticed for **10 days** because `deploy-vermigrow.sh` step `[7/7]` health-checks **only**
`curl /`. A total selling outage passed the deploy's own gate.

### The fix (user authorized production changes)

1. `install -m 0755 /var/www/basnayakavermigrow/app/deploy-vermigrow.sh /usr/local/bin/deploy-vermigrow`
   — refreshed the stale copy; it now carries `prisma db push` (~line 51).
2. Backed up the live DB → `custom.db.bak-20260928-054500`, sha256 `c23030d2…`, identical to the
   live file at backup time.
3. Ran `sudo /usr/local/bin/deploy-vermigrow` — the full 7 steps, ending `DEPLOY_OK`.

### Verified after the fix

| Check | Result |
|---|---|
| Prod table count | **4 → 15**; all 11 new models created |
| `SiteContent` rows | **32 → 32** — preserved, no data lost |
| `db push` data-loss gate | did not fire; `--accept-data-loss` was **not** used and was not needed |
| Live endpoints | `/order` `/api/catalog` `/api/donations` all **200**; `/r/<bad>` **404** |
| Order path degrades cleanly | **409** with a customer-facing message instead of a 500 |
| Scan path degrades cleanly | unknown code → **404** `{"status":"unknown"}` |
| My probes wrote nothing | Sale / Donation / Payment / Pack / Product / FundEntry / Donor / Dispatch / ScanEvent / CustomerLink / CustomerMessage all still **0** |

Service restarted clean; `systemctl is-active basnayaka` = active.

### Local control run

`bash scripts/run-e2e.sh` — **405 passed, 0 failed**. The working DB was confirmed **byte-identical**
afterwards (sha256 `ed3bf730…`). This isolates the outage entirely to the production schema: the
code was never at fault.

### Still open

- **Nothing is on sale yet.** Every production business model is at **0 rows** — no catalog, no
  printed packs, no recorded sale or donation. `{"items":[]}` is expected, not a bug. The selling
  flow cannot be exercised end-to-end on live until an admin adds a product at `/admin/catalog` and
  generates pack codes at `/admin/warehouse`.
- **The admin UI could not be tested.** The password in `SECRETS.local.md` is **stale** —
  `POST /api/auth/login` returns `401 {"error":"Invalid password"}`, so it has been changed in
  Admin → Settings. It was **not** reset, because that would lock out whoever is using the current
  one. Needs the client's current password, or explicit authorization to reset the DB hash.
- **`deploy-vermigrow.sh` `[7/7]` still only curls `/`.** This is the defect that let a 10-day
  selling outage print `DEPLOY_OK`. It should also assert `/order` and `/api/catalog`. Offered to
  the user; not yet taken up.
- No `Strict-Transport-Security` header; `/favicon.ico` 404s (the icon link points at
  `/logos/logo-main.png`, which serves fine).

---

## 2026-10-04 — Order management page + httpSMS status updates (local only, NOT deployed)

**Asked for:** a real order screen in the admin so orders can be worked by hand, and all order-status
updates driven from the httpSMS system.

### What was built

**Fulfilment is a new axis, not an overloaded column.** `Sale.status` means *money* and drives seat
capacity, sold counts and the fund — packing a box must never touch it. So the pipeline
(New → Confirmed → Packed → Dispatched → Delivered) went into a **new nullable `Sale.fulfillment`**,
where `NULL` means New, so every existing order needed no backfill. `dispatched` is labelled
**"Sent to customer"** in the UI, because `Pack.status='dispatched'` already means stock sent to a
*retailer*.

**One writer for order state.** `src/lib/order-actions.ts` (`setStageTx` / `cancelOrderTx` /
`requestCancelTx` / `addNote` / `dismissCancelRequest`). The admin routes and the SMS webhook both go
through it, so cancelling cannot grow a second, subtly different implementation that moves money
differently. Money-safe cancel plus fund/seat rules were lifted verbatim out of the settle route.

**Admin UI.** `/admin/orders` (list: search, six client-side filters, summary tiles) and
`/admin/orders/[orderRef]` (every action: record payment, cancel, move stage, notes, dismiss a cancel
request, plus timeline + per-order SMS history). Deliberate split — a scrolling list is for *finding*
an order; money-touching and customer-texting actions live on the detail page. The `orders-tab.tsx`
component was deleted and the Orders tab removed from `/admin/donations`, so there is one order UI.
Nav gained Orders as item #2; the mobile bottom bar is now **9 items** — Warehouse→"Stock" and
Inquiries→"Inquiry" were shortened to fit, and the breadcrumb lookup was made prefix-aware so
`/admin/orders/<ref>` reads "Orders".

**Status SMS.** Four new templates (`order_confirmed|packed|dispatched|delivered`), queued inside the
stage-change transaction and sent after commit via `autoDeliver`. A **step back sends nothing** — it
gets an `OrderEvent` for the audit trail and stays quiet. `order_paid` and `order_confirmed` now
invite a reply, because the old copy never told anyone that CONFIRM/CANCEL existed.

**httpSMS correlation, both directions.** Every send carries `request_id = CustomerMessage.id`; the
gateway's `data.id` is persisted as `providerMessageId`. `deliveryStatus` is written **only** by a
webhook — a 2xx from httpSMS means "accepted into the phone's queue", never "delivered".

**Inbound: `POST /api/sms/webhook`** (new, public). HS256 JWT verified by hand with `node:crypto`
(`webhook-verify.ts`) — no JWT library is installed and `alg: none` is refused outright. Signature is
checked **before the body is parsed**. Idempotency is `SmsEvent.@@unique([eventType,
providerMessageId])` with the insert **inside the effect's transaction**, so a duplicate is a no-op
200 and a failure rolls back to let the retry succeed. `inbound.ts` holds the reply policy: bare
`YES`/`NO`/`1`/`0` count only as the *whole* message (so "no problem, thanks" never cancels), only
CONFIRM/CANCEL may open a short sentence, and `STOP` is deliberately **not** a cancel. A reply must
match **exactly one** live order for that number; a shared phone gets recorded and **nothing moves**.

**The policy the user chose, implemented as chosen:** `CANCEL` on a **paid** order sets
`cancelRequestedAt` and texts the customer something that does not claim a cancellation — the office
decides. `CANCEL` on an **unpaid** order really cancels it, through the same path the admin's Cancel
button uses. Unmatched replies now surface in the Messages tab (`inbound` list), because an inbound
path that silently ate a customer's CANCEL would be worse than having none.

### Verification (all against a DB **copy**; the working DB was never opened for writing)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run build` | **exit 0**; `/admin/orders`, `/admin/orders/[orderRef]`, `/api/sms/webhook` all in the route table |
| `bash scripts/run-e2e.sh` | **465 passed, 0 failed** |
| `bash scripts/run-e2e-sms.sh` | **156 passed, 0 failed** — phases `mock` 51, `fail` 13, `manual` 13, **`webhook` 79** |

The new `webhook` phase signs its own JWTs with `crypto` (an independent second implementation, so the
test does not verify the verifier with itself) and covers: unsigned / malformed / wrong-key /
`alg:none` / expired all **401 with nothing written**; a receipt setting `deliveryStatus` without
touching our own `status`; the same event twice being idempotent; the `request_id` fallback; CONFIRM on
an unpaid order recorded but **not** acted on; CONFIRM on a paid order advancing it and texting;
chatter stored but not obeyed; CANCEL flagging a paid order **without** cancelling it and leaving its
donation in the fund; CANCEL cancelling an unpaid one; a shared number refusing to guess; and an
unknown number matching nothing.

### Not done / still open

- **Not deployed.** Prod is untouched. The schema change is additive and nullable (`ALTER TABLE ADD
  COLUMN`; two new tables), so `prisma db push` on the live DB should not rewrite anything — but that
  has not been run against live and is the first thing to watch.
- **No human has looked at the pages yet.** Only the automated suites ran; a localhost walkthrough of
  `/admin/orders`, the detail page, the stepper and the Messages tab is still owed.
- **Mobile nav at 9 items** needs an eyeball at 360px.
- **SMS cost:** one text per stage change, bounded only by `SMS_DAILY_CAP` (200/day by default). Worth
  confirming that number is right for the farm before going live.
- **httpSMS operational reality:** the Android handset must stay on and online; the public webhook
  needs working HTTPS on the VPS, and `HTTPSMS_WEBHOOK_SECRET` must be set in the systemd env or the
  endpoint answers 503 to everything.

---

## 2026-10-04 (later) — Local test loop: sample orders, simulated replies, Cloudflare tunnel

Set up so the order + SMS pipeline can be exercised end to end without a gateway account and without
touching production. Everything below is **localhost only**; prod is unchanged.

### Two new scripts

- **`scripts/test-data.mjs`** — creates a priced `[LOCAL TEST]` product (the two real catalog items are
  price 0 and therefore not orderable at all) plus a PAID and an UNPAID order, then settles one as paid.
  Re-running reuses what it already made instead of piling up orders. Refuses to run against any host
  but localhost, because it writes real rows and the deployed site is one `BASE_URL` away.
  Written to `db/custom.db` — the working DB, not a copy. Undo with `--clean`.
- **`scripts/simulate-reply.mjs`** — signs the exact CloudEvents payload httpSMS posts and sends it to
  `/api/sms/webhook`. This is what makes CONFIRM/CANCEL testable with no gateway, no handset and no
  tunnel. Reads `HTTPSMS_WEBHOOK_SECRET` from `.env` if the environment has it.

**The unpaid order is deliberately on a different number.** `findOrderForPhone` refuses to act when a
number has more than one live order, so two live orders sharing a number would make *every* reply come
back "ambiguous — nothing was changed", which looks exactly like a broken webhook.

### Verified by hand (localhost, mock transport)

| Reply | Number | Result |
|---|---|---|
| `hello` | paid order's | 200, `orderRef: null`, "reply not recognised" |
| `CONFIRM` | paid order's | advanced `Sale.fulfillment` → `confirmed`; `order_confirmed` sent |
| `CANCEL` | **unpaid** order's | order cancelled; `order_cancelled` sent |
| `CANCEL` | **paid** order's | `cancelRequestedAt` set, `status` still **`paid`** — not cancelled |

Also confirmed: the same signed event through the **public tunnel** is accepted (200), and all four
replies appear on Donations → Messages with their outcome.

### Cloudflare tunnel

`cloudflared tunnel --url http://localhost:3001` → `https://<random>.trycloudflare.com`. The webhook URL
to register in httpSMS is `https://<tunnel>/api/sms/webhook`, and the signing key is whatever
`HTTPSMS_WEBHOOK_SECRET` holds. The free URL **changes on every restart**.

⚠️ **A quick tunnel publishes the whole site, including `/admin`.** Measured, so the risk is not
guesswork: `/admin` redirects without a cookie, but a **forged 96-character `admin_session` cookie
renders `/admin/orders` with HTTP 200** — the middleware checks the cookie's length, not its validity.
No business data leaks that way (the page is a client component; `/api/admin/orders` correctly answers
401), but the admin shell is public and **`/api/auth/login` has no rate limiting while
`ADMIN_PASSWORD` is `admin123`**. Change the password before pointing a tunnel at this, or gate the
tunnel with Cloudflare Access. Only `/api/sms/webhook` needs to be public.

### Notes

- Locally `SMS_PROVIDER=mock`: every "send" is appended to `.sms-outbox.log` and nothing leaves the
  machine. Real dispatch needs `SMS_PROVIDER=httpsms` + `HTTPSMS_API_KEY` + `HTTPSMS_FROM`.
- `/api/orders` throttles **5 orders per IP per 30 min** (60/hour global, per-process). Creating a
  third sample order inside that window returns 429 — the guard working, not a bug.
- `/api/admin/messages` is the **API**; the human-readable replies view is the **Messages tab under
  Donations**, not a page at `/admin/messages` (which 404s).

### The SMS suite was fragile to real data — fixed

Creating local test data broke `run-e2e-sms.sh` (16 failures), which is worth recording because the
cause was not the test data:

- `autoSentToday()` counts automatic sends since local midnight **across the whole database**, and
  every phase runs against a fresh copy of `db/custom.db`. Once that copy contained 13 real sends from
  today, the mock phase's `SMS_DAILY_CAP=3` was already spent, so nothing auto-sent and six assertions
  failed in a way indistinguishable from broken auto-send code.
- The webhook phase asserted `smsEvent.count() === 0`, which only holds on a database that has never
  received a webhook.

So the suite only passed on a DB that had never been used — i.e. it could not be run against anything
resembling production, which is exactly when it is worth running. Fixed:

- `resetDailyAutoSendCounter()` moves today's existing `sentBy='auto'` rows back a day at phase start
  (rows moved, never deleted — they belong to the working DB). The cap assertions then mean what they
  say.
- The bad-signature block counts `SmsEvent` as a **delta** from a baseline, which tests the same claim
  ("nothing was written") without requiring an empty table.

**156 passed, 0 failed** with the local test data present.

### And the main suite assumed a `.env` with no SMS

Adding `SMS_PROVIDER=mock` to `.env` for local testing broke `run-e2e.sh` (3 failures): the main suite
tests the **no-gateway** path and asserts `transport === 'manual'`, but the standalone server inherits
`.env`, so messages actually sent and three assertions flipped. The suite was depending on a file it
never mentions.

Fixed in `run-e2e.sh`: `SMS_PROVIDER=""` and `SMS_GATEWAY_URL=""` are set explicitly for its server.
Next.js never lets a `.env` file override a real environment variable, and `configuredProvider()`
treats `''` as unset and falls through to `'manual'` — so the suite now means what it says regardless
of how the machine is configured for local testing.

Same class of bug as the SMS-suite one above: **a suite must not depend on ambient machine state.**

| Suite | After the fixes |
|---|---|
| `bash scripts/run-e2e.sh` | **465 passed, 0 failed** |
| `bash scripts/run-e2e-sms.sh` | **156 passed, 0 failed** |

---

## 2026-10-04 (later) — Admin was O(n) bcrypt per request; every tab paid ~3s

Reported symptom: admin tabs take seconds to load, locally **and** on the deployed site.

Cause was in `isAdminAuthenticated()` (`src/lib/admin-auth.ts`), not in the cloud, the tunnel or dev
mode. Sessions were stored as `session:<bcrypt hash of the token>`, and because a bcrypt hash cannot be
looked up by equality, the cookie was verified by **bcrypt-comparing it against every session row**
until one matched. Two things made that fatal:

- bcrypt at cost 10 measured **82ms per comparison**;
- nothing ever deleted session rows. Every login added one and only the single row that happened to
  match was ever cleaned up, so the table grew without bound.

The working DB had accumulated **39 session rows — 13 valid, 26 expired**. Measured:

| | Before | After |
|---|---|---|
| `GET /api/admin/orders` | 2957 / 3004 / 2998 ms | 109 / 33 / 47 ms |
| `GET /api/admin/messages` | 2918 / 2922 / 2892 ms | 103 / 43 / 32 ms |
| `GET /admin/donations` (page) | ~3s *per API call it fires* | 224 / 113 / 97 ms |

An admin page fires several API calls, which is why a "tab" felt like it took forever.

### Fix

- `sessionKey()` is now `session:<sha256(token)>` — a deterministic digest, so
  `isAdminAuthenticated()` is **one indexed `findUnique`** with no bcrypt at all.
- `pruneStaleSessions()` runs on login (rare, and the one moment the table is already being written)
  and deletes both expired rows and legacy bcrypt-keyed rows, which can never match under the new
  scheme. Recognising them by shape is what avoids needing a migration script. It is deliberately NOT
  on the authentication path — sweeping per request would reintroduce the scan.

**Why sha256 is not a downgrade:** bcrypt is slow to defend *low-entropy* secrets a human chose. This
token is 48 random bytes — nothing to guess, no rainbow table — so the slow hash bought no security
while costing 80ms per request. The raw token is still never stored, so a DB leak still does not hand
over live sessions. `bcrypt` is still used for the admin password itself, where it belongs.

Effect on the DB: 39 session rows → 1. Everyone is logged out once, since the key scheme changed.

### Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `bash scripts/run-e2e.sh` | **465 passed, 0 failed** |
| `bash scripts/run-e2e-sms.sh` | **156 passed, 0 failed** |
| all 9 admin routes return real payloads | ✓ |
| no / forged / wrong-value cookie on an admin API | **401 / 401 / 401** |
| `/api/auth/check` | `authenticated:false` unauthenticated, `true` with a session |

The suites do not couple to the session scheme — only that login sets `admin_session` and that forged
cookies 401 — so they pass unchanged. Both were re-run **against a fresh build**: `run-e2e.sh` reuses
an existing `.next/standalone`, so running it after a source change without rebuilding silently tests
the old code.

## Live order test, and two order-path bugs (2026-10-04)

Goal: place an order from the public site and watch the whole SMS chain. Two real defects came out,
both in `src/app/api/orders/route.ts` — the one file in the flow nobody had driven from a browser.

### 1. Ordering through the tunnel was refused with 403

`originAllowed()` accepted an `Origin` only if its host matched the request's own host or
`NEXTAUTH_URL`'s. Behind a tunnel both are the internal `localhost:3001`, so a browser posting from
`https://<tunnel>` matched neither and every submit failed. It now also accepts `X-Forwarded-Host`
(first entry only — the rest of the chain is the proxy's own addressing). Not a CSRF hole: a page
cannot set `Host`/`Origin`, and adding `X-Forwarded-Host` cross-origin forces a preflight this route
never approves.

| Request | Before | After |
|---|---|---|
| tunnel origin | 403 | **400** (origin passed; empty probe body rejected) |
| `evil.example.com` origin | 403 | **403** |
| localhost origin | 400 | 400 |

Tunnel-only gap: on the VPS `NEXTAUTH_URL` is the real public URL so `Origin` matched and live
ordering was never broken. The fix drops the single-host assumption.

### 2. "We have your order" was queued but never sent

`POST /api/orders` queued `order_placed` inside the transaction and never called `autoDeliver` —
every other path does (settle, status, admin sales, donations, webhook). The acknowledgement sat
until an unrelated admin action flushed the queue, usually riding along with the payment text.

| Order | queued → sent |
|---|---|
| `VG-O-RN872U` (before) | 115,897 ms |
| `VG-O-HWPDYB` (after) | **9 ms** |

This was deliberate, not an oversight: the route comment justified it because the endpoint is public
and unauthenticated, so auto-sending lets a stranger post junk orders and burn `SMS_DAILY_CAP`. The
user was asked and chose to send immediately — the message is an acknowledgement of receipt, and one
arriving hours later glued to the payment text is worthless. Abuse stays bounded by the daily cap and
the route's per-IP/global throttle, the same trade the public donations route already makes. The send
now runs after the commit, wrapped so a gateway failure cannot turn a committed order into a 500.

`scripts/e2e-sms.mjs` §2 asserted the old behaviour (`'STILL QUEUED — a pending order is not a sale'`)
and was rewritten to the new policy. **It has not been run.** Cap arithmetic is unchanged: the same
3 sends before the cap bites, one of them earlier.

### Blocked: real SMS

`.env` is still `SMS_PROVIDER="mock"`, so nothing leaves the machine — sends append to
`.sms-outbox.log`. httpSMS is not a cloud API: it needs an account (`HTTPSMS_API_KEY`), a gateway
Android handset online running the app, and that handset's number in `HTTPSMS_FROM`.

The credentials did not land. `H:\My_Projects\basnayake-glm5.2\.env` was reported edited twice but was
identical both times: 1365 bytes, 30 lines, mtime 10:07, anchored counts `HTTPSMS_API_KEY` 0 /
`HTTPSMS_FROM` 0. `readlink -f` shows no junction. A second checkout, `basnayake-glm5.2-fixed/`, has
its own `.env` — most likely where the edits went. `SMS_PROVIDER` was deliberately NOT switched: the
provider declares `requires = ['HTTPSMS_API_KEY','HTTPSMS_FROM']`, so flipping it with no key moves
the failure from "quietly mocked" to "hard error mid-order". I also stopped rather than scan the
sibling repo's `.env` for the key — blocked as credential exploration, correctly.

### State when stopped

- Dev server up on 3001; tunnel restarted as `https://superb-aruba-rate-clerk.trycloudflare.com`
  (quick tunnels get a new URL on every restart).
- `SMS_PROVIDER` still `mock`. No restart performed — it would only have re-read the unchanged file.
- Everything above is **uncommitted**.
- Not verified: the rewritten e2e-sms assertions (need `npm run build` first — the runners reuse a
  stale `.next/standalone`), and no human walkthrough of `/admin/orders` yet.

---

## 2026-10-04 (later) — Resumed: suites verified, two defects found and fixed

Picked up from "State when stopped" above. **Still uncommitted, still not deployed.** Prod was
confirmed to be running the pre-SMS build: `GET https://www.basnayakavermigrow.lk/api/sms/webhook`
→ **404** (`/order` `/api/catalog` `/` all 200).

### Cleared the outstanding verification

`.next` was stale (source edited 11:23, build 10:47) — rebuilt from clean, then both suites re-run
**against the fresh build**:

| Suite | Result |
|---|---|
| `bash scripts/run-e2e.sh` | **466 passed, 0 failed** (was 465; one assertion added below) |
| `bash scripts/run-e2e-sms.sh` | **157 passed, 0 failed** — mock 52, fail 13, manual 13, webhook 79 |

The rewritten `order_placed` auto-send assertions (§2) pass, which was the specific thing left unrun.

### Local walkthrough (against a **copy**, `db/local-test.db`)

The working DB was byte-identical before and after (`sha256 ccdf03a3…`); the copy and the walkthrough
outbox log were deleted afterwards. Whole loop driven by hand:

| Step | Result |
|---|---|
| `node scripts/test-data.mjs` | creates a PAID + an UNPAID order on different numbers |
| placing an order | `order_placed` **auto-sends at once** (the 115,897 ms → 9 ms fix, still holding) |
| settling it | `order_paid` goes out, donation line correct, invites CONFIRM/CANCEL |
| text `CONFIRM` | `fulfillment → confirmed`, `status` still **`paid`**, timeline actor **`sms`**, reply text sent |
| text `CANCEL` (paid) | `cancelRequestedAt` SET, `status` **still `paid`**, donation still in the fund, reply does **not** claim cancellation |
| text `CANCEL` (unpaid) | order actually cancelled, `order_cancelled` sent |
| admin move forward | `order_packed` sent |
| admin step **back** | **nothing sent** — and see the defect below |

Pages were verified at HTTP level only (`/admin/orders` 200, `/admin/orders/<ref>` 200,
`/api/admin/orders` returns 10 orders with `stageCounts`, `/api/admin/messages` returns 24 outbound +
6 inbound replies with their reasons). **Nobody has still seen these in a browser.**

### Defect 1 — a step back told the admin the customer had no phone

`setStageTx` returned `{ status: 'no_phone' }` for a **revert** (a step back is deliberately silent).
But `no_phone` in `notify.ts` genuinely means *"nobody to send to"*, and the UI map turned it into the
toast **"No mobile on file — nothing was queued."** An admin stepping an order back was told the
customer had no phone number — while that number was on the screen beside it. A decision reading as a
data fault.

Fixed by giving the deliberate silence its own word: `StageMessageOutcome` (new type in
`order-actions.ts`) adds `{ status: 'reverted' }`, and `order-detail.tsx` describes it as
*"Moved back — no message sent."* Verified live: the route now answers `{"status":"reverted"}`.
Locked in with a new assertion in `scripts/e2e.mjs` (the 466th).

### Defect 2 — the suites reported failure while every assertion passed

`bash scripts/run-e2e-sms.sh` printed `[manual] 13 passed, 0 failed` and then
**`2 phase(s) failed`**. Cause was not the system under test:

```
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94
```

Both suites ended with `process.exit(failed === 0 ? 0 : 1)` immediately after `prisma.$disconnect()`.
On Windows, exiting while libuv still holds closing async handles aborts the process — measured exit
code **127** on a phase where all 13 assertions passed. The harness keys off the exit code, so it
counted a phantom failure. Flaky: it happened on one run and not the next.

Fixed in both `scripts/e2e.mjs` and `scripts/e2e-sms.mjs` by setting `process.exitCode` and letting
Node drain its own handles instead of calling `process.exit()`. Verified: exit code 0, and the process
still terminates on its own in ~1 s (undici's keep-alive sockets are not deferred by this). Both
harnesses now exit 0.

**Worth remembering: a suite that goes red when nothing is wrong is worse than no suite** — it teaches
whoever runs it to ignore the result.

### Known, not fixed (needs a judgement call)

- **The admin mobile bottom nav is 9 items** at `flex-1` / `text-[9px]`. At 360 px that is 40 px per
  item, so labels like "Donations" truncate. Not broken, but the farm's users are on phones. Options:
  five items + a "More" sheet, or a horizontally scrolling bar.
- `HTTPSMS_API_KEY` / `HTTPSMS_FROM` are **still empty** in `.env`, so `SMS_PROVIDER` stays `mock` and
  nothing leaves the machine. This is the remaining blocker for real SMS, and it needs an httpSMS
  account and the gateway handset — not a code change.
- One text per stage change, bounded by `SMS_DAILY_CAP` (200/day). A full order lifecycle is up to 6
  texts, so the cap is roughly 33 orders/day before automatic sends start being held.

## 2026-10-04 (evening) — httpSMS abandoned for Text.lk, and a cost bug that doubled every message

The handset arrived, so the gateway was exercised for real for the first time. **Still uncommitted,
still not deployed.** That is tomorrow's job, together with a Text.lk top-up and a full SMS test
against the live site.

### httpSMS: the SIM cannot send, and no gateway app will change that

Five sends to the customer number, `SMS_PROVIDER=httpsms` against the real Android gateway. All five:
`status=failed`, `failure_reason=GENERIC_FAILURE`, `sim=SIM1`, `send_attempt_count=1/2`, `sent_at` and
`delivered_at` null. Every one took **~2m15s** to fail (`14:45:30→14:47:41`, `14:50:44→14:53:21`,
`14:55:15→14:57:33`, `14:59:58→15:02:08`) — a timeout, not a refusal. Nothing arrived. The SIM's free
SMS counter decremented anyway: billed, not delivered.

Three pieces of evidence, in the order they landed:

- **The burst theory was tested and refuted.** The first two sends were three messages inside one
  second, which looked like the cause — but rows 3, 4 and 5 were sent **solo**, four minutes apart,
  phone idle, and failed identically. The "gets stuck when I send 5 or 6 at once" symptom is real but
  it is an *effect*: httpSMS transmits one at a time, so a queue drains at 2m15s per message and six
  messages is thirteen minutes of apparent hanging.
- **Two of the five never touched this codebase.** `a817ff1c` (14:55:14) and `62fbb159` (14:59:50) have
  no `CustomerMessage` row — sent by hand from the httpSMS app — and failed the same way. Our backend
  is not in their path.
- **`GENERIC_FAILURE` is `SmsManager.RESULT_ERROR_GENERIC_FAILURE`**, passed through verbatim by
  `SentReceiver.kt`. It is not `NO_SERVICE`, `RADIO_OFF`, `NULL_PDU` or `LIMIT_EXCEEDED`, so signal,
  radio and message format were all fine and the **network** declined it.

Do not retry httpSMS on this handset, and do not swap to another Android gateway app — every one
drives the same `SmsManager` on the same SIM.

### Text.lk: chosen, and verified with a real delivery

`text-lk` was already written from docs and is now exercised live. The request shape was right, but
two defects had to be fixed first, and either would have made the test lie:

- **`data.uid` was being discarded.** It is the gateway's id for the message and the key its receipts
  quote back, so a bare `{ ok: true }` left delivery receipts nothing to match on — the `providerMessageId`
  gap, closed. **The DLR machinery survives the provider change.**
- **A rejected message read as success.** Text.lk answers HTTP **200** with `{"status": false}` — a
  *boolean* — and the guard only tested `typeof status === 'string'`, so failures fell through to
  `{ ok: true }`. Both spellings are now caught.

Verified end to end: a real order through `POST /api/orders` → `providerMessageId=6ac26f1d2f964`, and
a demo text **arrived on the client's own phone**, confirmed by hand. That handset confirmation is the
only proof that counts here — it is exactly the assumption that httpSMS punished.

`TextLKDemo` is the free test sender and must not carry production traffic. The real `VermiGrow`
sender ID has to be requested (free, hours to ~3 days), and since **29 July 2026** TRCSL blocks
unregistered alphanumeric sender IDs to Dialog, Airtel and Hutch — which is every customer number on
this site.

### The cost bug: one invisible character doubled every message

`formatLkr` uses `Intl.NumberFormat('en-LK', { currency: 'LKR' })`, and ICU separates the currency
from the figure with **U+00A0 NO-BREAK SPACE**. It renders exactly like a space. It is **not in the
GSM-7 alphabet** — and one character outside GSM-7 flips the *whole* body to UCS-2, where a segment
holds **70** characters instead of 160.

So every message naming an amount, which is every order message, was sent at roughly double:

| Body | Chars | Was (UCS-2) | Now (GSM-7) |
|---|---|---|---|
| `order_placed` | 173 | 3 segments | 2 |
| `order_paid` | 259 | **4 segments** | 2 |

Found by reading the *stored* body out of `CustomerMessage` and listing its non-GSM-7 characters —
nothing on screen showed it, and the send response only hinted at it via `sms_count: 3`.

Fixed by `toGsm7()` in `src/lib/sms/gsm7.ts`, applied once in `renderMessage`, which is now a thin
wrapper over `renderRawMessage`. Doing it at that single point means the body **stored** is exactly
the body **transmitted**, and it covers every source at once — the amount formatter, a customer's
curly apostrophe, an admin's em dash.

**Deliberately not fixed in `currency.ts`**: U+00A0 does real work in HTML (it stops "LKR" and the
figure wrapping apart on the donation wall) and that file documents that its output must stay
byte-identical for that wall. The SMS boundary is where the encoding constraint belongs.

Re-measured after the fix: **0 of 8** bodies carried any non-GSM-7 character, and those same 8 bodies
went **22 segments → 13**.

### Verified after all of the above

`.next` rebuilt from clean first (the suites reuse a stale standalone and would otherwise report green
against code that never ran), then:

| Suite | Result |
|---|---|
| `bash scripts/run-e2e.sh` | **466 passed, 0 failed** |
| `bash scripts/run-e2e-sms.sh` | **157 passed, 0 failed** — all phases |

### Left open for tomorrow

- **Top up Text.lk, then test every SMS function against the live site.** Costs units, so the order
  matters: one probe, then one real order, then replies.
- **Request the `VermiGrow` sender ID** — the only item with real lead time.
- **Test data is sitting in the working DB** and was left alone deliberately: `VG-O-DDCE6T`, the
  `[LOCAL TEST]` product, and the duplicate pair on the customer number (`VG-O-66WW67` paid,
  `VG-O-SBQHT2` pending). That duplicate will make `findOrderForPhone` answer *ambiguous* for every
  reply, so clear it before testing CONFIRM/CANCEL.
- **The DLR route is still undecided** — trust the send response's `"status": "Delivered"` (which
  httpSMS never offered), poll `GET /api/v3/sms/{uid}`, or wire Text.lk's webhook into the existing
  `/api/sms/webhook`. Nothing depends on it yet.
