# Basnayaka VermiGrow Website — Work Log

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
Task: Rebrand MakeFarm → Basnayaka VermiGrow (organic fertilizer farm in Karandeniya, Sri Lanka). Logo 05 is the main brand; logos 02/03/04 are the 3 sub-brand project logos.

Work Log:
- Copied user-uploaded logos from /home/z/my-project/upload/ to /home/z/my-project/public/logos/:
  - logo-main.png (05 — main Basnayaka VermiGrow logo)
  - logo-project-1.png (02)
  - logo-project-2.png (03)
  - logo-project-3.png (04)
- Rewrote src/store/content-store.ts with new default content:
  - Brand: "Basnayaka VermiGrow"
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
- Updated layout.tsx SEO metadata: title, description, keywords, OpenGraph, Twitter cards for Basnayaka VermiGrow.
- Updated section headings: "Photo stories" → "From the farm"; "Recent films" → "Farm films"; "Services grown with care" → "Products & practices"; "Have a story to grow?" → "Want to grow with us?"; form placeholder now farm-appropriate.
- Verified with Agent Browser (fresh localStorage): title is "Basnayaka VermiGrow — Organic Fertilizer & Vegetables, Karandeniya, Sri Lanka"; all sections render with new content; all 5 logo images load (navbar + 3 project cards + footer); no console errors.
- Preview screenshot saved to /home/z/my-project/download/basnayaka-preview.png.

Stage Summary:
- Site fully rebranded from a generic creative studio portfolio to Basnayaka VermiGrow, an organic fertilizer & vegetable farm in Karandeniya, Sri Lanka.
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

**Neither real product has a price, so nothing is orderable online.** `VermiGrow Fertilizer 1kg`
and `Vermicompost 5kg` are both `price = 0`, which the system reads as "no price set yet":
`/order` shows *"Ask for price"* and `POST /api/orders` rejects them. There are also **no
workshop services in the catalog at all.** The CMS cards say *Vermicompost — Rs 350*, but the DB
product is *Vermicompost 5kg* with no unit set, and *VermiGrow Fertilizer 1kg* has no CMS
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
