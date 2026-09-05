# Basnayaka VermiGrow — Project Status

> Last updated: 2026-07-11
> Branch: `main`
> Server: Production (standalone) on `http://localhost:3000`

---

## ✅ Completed Work

### 🔒 Security Fixes
- [x] Password hashing with bcryptjs (12 rounds) instead of plaintext
- [x] Cryptographically random session tokens (48-byte hex) replacing static `"authenticated"` cookie
- [x] Removed hardcoded `admin123` fallback password
- [x] File upload validation — MIME type whitelist, 20MB size cap, extension check
- [x] Input validation with Zod schemas (inquiries, password changes, content saves)
- [x] Session expiry (24h) with DB-stored hashed tokens
- [x] Admin password seed endpoint (`GET /api/settings/password`)

### 🏗️ Code Quality
- [x] Shared content defaults (`src/lib/content-defaults.ts`) — single source of truth for client + server
- [x] Removed duplicate Prisma client (`src/lib/db.ts` now re-exports from `prisma.ts`)
- [x] Fixed duplicate `storage` key in Zustand persist config
- [x] Enabled React strict mode in `next.config.ts`
- [x] Added image remote patterns for Unsplash and Google CDN
- [x] Cleaned up unused imports

### 🎨 UI/UX Fixes
- [x] Replaced all `confirm()` dialogs with proper AlertDialogs (inquiries, media, edit-panel)
- [x] Added `ErrorBoundary` component wrapping the app
- [x] Removed deprecated Tailwind v3 classes (`animate-in`, `slide-in-from-top-1`, `safe-area-pb`, `rotate-135`)
- [x] Added file upload error states and toast messages
- [x] Fixed hydration mismatch from browser extension (`bis_skin_checked` attribute) with inline script

### 🛍️ Admin Panel
- [x] Dashboard with stats (products, inquiries, media, projects)
- [x] Content Editor with tabs (General, Hero, About, Stats, Products, Gallery, Videos, Projects, Founder, Contact)
- [x] Move up/down reordering buttons on all list sections
- [x] File upload component with preview + URL paste
- [x] Inquiries management (list, read, delete with confirmation)
- [x] Media Library (upload, search, copy URL, delete with confirmation)
- [x] Password change settings
- [x] Admin layout with sidebar navigation + mobile bottom nav
- [x] Proper metadata (`noindex, nofollow`) and `<title>` for admin pages

### 🌐 SEO & Configuration
- [x] `public/robots.txt` — updated with admin/api disallow + sitemap URL
- [x] `src/app/sitemap.ts` — dynamic sitemap with all sections
- [x] `public/site.webmanifest` — PWA manifest
- [x] `.env.example` — documented environment variables
- [x] `next.config.ts` — strict mode, image optimization config

### 🧑‍🌾 Lolitha Basnayaka Founder Section
- [x] `src/components/site/founder.tsx` — profile card, bio, quote, achievement timeline, CTA
- [x] Data in content defaults (name, title, image, bio, quote, 5 achievements)
- [x] Navbar + footer links to `#founder`
- [x] Editable from Admin → Content Editor → Founder tab
- [x] Added to home page between Projects and Contact sections

---

## 🚧 Known Issues / Not Yet Fixed

### Security
- [ ] No CSRF protection on state-changing API endpoints
- [ ] No rate limiting on login or inquiry submission
- [ ] No email validation on inquiry form beyond Zod schema (no verification)
- [ ] NEXTAUTH_SECRET in `.env` is still a weak hardcoded string (not used currently but next-auth is installed)

### Features Missing
- [ ] Inquiry reply system (currently opens `mailto:` link only)
- [ ] No pagination on inquiries list (fetches all at once)
- [ ] No drag-and-drop reordering (only move up/down buttons)
- [ ] No image optimization (still uses `<img>` not Next.js `<Image>`)
- [ ] No analytics / visit tracking
- [ ] No email notification for new inquiries
- [ ] No backup/restore UI in admin (data export exists in edit-panel)
- [ ] No audit log for admin actions
- [ ] No user management (single admin only)

### Code Cleanup
- [x] Fixed all TypeScript build errors (edit-panel generic scope, missing AlertDialogTrigger import, safeStorage type mismatch)
- [x] Removed `typescript.ignoreBuildErrors: true` from next.config.ts — build now runs full type checking
- [x] Removed 17 unused dependencies: `@dnd-kit/*`, `@hookform/resolvers`, `@mdxeditor/editor`, `@reactuses/core`, `@tanstack/react-query`, `@tanstack/react-table`, `next-auth`, `next-intl`, `react-hook-form`, `react-markdown`, `react-syntax-highlighter`, `uuid`, `z-ai-web-dev-sdk`
- [x] Deleted unused shadcn `form.tsx` component (was the only consumer of react-hook-form)
- [x] Excluded `examples/` from tsconfig (standalone demo files with external deps)

### Admin UX
- [ ] All admin pages are `'use client'` — no server components
- [ ] No loading skeletons for dashboard stats
- [ ] No empty state for content editor when no default content loaded
- [ ] Media library uses filesystem directly — no DB tracking (orphaned files possible)

---

## 📐 Architecture

```
src/
├── app/
│   ├── admin/           # Admin panel pages (all 'use client')
│   │   ├── login/       # Admin login
│   │   ├── dashboard/   # Stats overview
│   │   ├── content/     # Full CMS editor
│   │   ├── inquiries/   # Contact form submissions
│   │   ├── media/       # File browser + upload
│   │   └── settings/    # Password change + DB info
│   ├── api/             # REST API routes
│   │   ├── auth/        # login, logout, check
│   │   ├── content/     # GET (public), POST (auth required)
│   │   ├── inquiries/   # GET/POST/DELETE
│   │   ├── media/       # GET/DELETE (filesystem)
│   │   ├── upload/      # POST (file upload)
│   │   └── settings/    # password change + seed
│   ├── layout.tsx       # Root layout (head, theme, error boundary)
│   ├── page.tsx         # Home page (all site sections)
│   └── sitemap.ts       # Dynamic sitemap
├── components/
│   ├── admin/           # file-upload.tsx
│   ├── site/            # navbar, hero, stats, about, services, 
│   │                    # photo-carousel, video-showcase, projects,
│   │                    # founder, contact, footer, edit-panel,
│   │                    # loading-overlay, error-boundary
│   └── ui/              # 39 shadcn/ui components
├── lib/
│   ├── prisma.ts        # Prisma client singleton
│   ├── db.ts            # Deprecated — re-exports prisma.ts
│   ├── utils.ts         # cn() helper
│   ├── admin-auth.ts    # Auth logic (bcrypt, session tokens)
│   ├── content-service.ts # Server-side content CRUD
│   └── content-defaults.ts # Shared types + default content
├── store/
│   └── content-store.ts # Zustand with localStorage persist
└── middleware.ts         # Admin route protection
```

---

## 🔧 Commands

```bash
npm run dev           # Start dev server (port 3000)
npm run build         # Production build
npm start             # Start production server
npx prisma generate   # Regenerate Prisma client
npx prisma db push    # Push schema to DB
```

### Production Server
```bash
# Build
npx next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

# Start (accessible from LAN/ngrok/Cloudflare)
HOST=0.0.0.0 NODE_ENV=production node .next/standalone/server.js
```

---

## 🔑 Admin Access

- **URL:** `http://localhost:3000/admin/login`
- **Default password:** `admin123` (change after first login)
- **Session:** 24-hour auto-expiry

---

## 📊 Database

- **File:** `db/custom.db` (SQLite)
- **Tables:** `SiteContent`, `Inquiry`, `Upload`, `AdminUser`
- **Content storage:** JSON blob in `SiteContent` with key `site-content`
- **Sessions:** Stored in `SiteContent` with key prefix `session:`
- **Password:** Stored as bcrypt hash in `SiteContent` with key `admin:password`
