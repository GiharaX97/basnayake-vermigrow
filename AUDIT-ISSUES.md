# Basnayaka VermiGrow — Comprehensive Audit & Issues

> Generated: 2026-07-09  
> Project: Next.js 16 + Tailwind v4 + Prisma/SQLite  
> Type: Organic farm marketing website with admin CMS

---

## 🔴 CRITICAL Issues

### 1. Plaintext Password Storage (Security)
- **File:** `src/lib/admin-auth.ts`, `prisma/schema.prisma`
- **Issue:** Admin password is stored in `SiteContent` table as plaintext value with key `admin:password`. No hashing (bcrypt/argon2) whatsoever.
- **Risk:** DB file (`custom.db`) exposure => full admin access.
- **Fix:** Hash passwords with `bcrypt` or `bcryptjs` before storing.

### 2. Weak Cookie-Based Session (Security)
- **File:** `src/middleware.ts`, `src/lib/admin-auth.ts`
- **Issue:** Admin session cookie value is the static string `"authenticated"`. Anyone who discovers this can forge admin access.
- **Risk:** Session hijacking, CSRF, trivial forgery.
- **Fix:** Use JWT tokens or NextAuth.js properly with session tokens.

### 3. Hardcoded Fallback Password (Security)
- **File:** `src/lib/admin-auth.ts:43`
- **Issue:** `if (password === 'admin123') return true;` — hardcoded fallback bypasses all security.
- **Risk:** Anyone who reads this code can access admin panel.
- **Fix:** Remove hardcoded fallback entirely after seeding.

### 4. No File Upload Validation (Security)
- **File:** `src/app/api/upload/route.ts`
- **Issue:** No file type validation (MIME check), no size limit, no malware scanning. Uses `path.extname()` which is trivially bypassed.
- **Risk:** Arbitrary file upload leading to RCE or data exfiltration.
- **Fix:** Validate MIME type, limit file size (e.g., 10MB), restrict to image/video types.

### 5. Missing XSS Protections (Security)
- **File:** All API routes that accept JSON content
- **Issue:** Content from DB/API is rendered via `dangerouslySetInnerHTML`-equivalent patterns. User-submitted content from inquiries displayed without sanitization.
- **Risk:** Stored XSS when admin views inquiries.
- **Fix:** Sanitize HTML output, escape user-generated content.

### 6. Duplicate Prisma Client Instances (Reliability)
- **File:** `src/lib/prisma.ts` and `src/lib/db.ts`
- **Issue:** Both files create PrismaClient singletons. `db.ts` is unused but still code. Can cause connection pool issues.
- **Risk:** Database connection exhaustion in production.
- **Fix:** Remove `db.ts`, use only `prisma.ts`.

### 7. Duplicate Content Defaults (Maintainability)
- **File:** `src/store/content-store.ts` (`defaultContent`) and `src/app/api/content/route.ts` (`SEED_CONTENT`)
- **Issue:** The exact same ~200 lines of default content defined twice. Will drift over time.
- **Risk:** Mismatched data shapes between client and server.
- **Fix:** Import from a shared constant file.

### 8. `z-ai-web-dev-sdk` Dependency (Supply Chain)
- **File:** `package.json:79`
- **Issue:** Unknown/obscure SDK package `z-ai-web-dev-sdk` in production dependencies.
- **Risk:** Potential supply chain vulnerability.
- **Fix:** Audit and remove if unused.

---

## 🟠 HIGH Issues

### 9. No CSRF Protection (Security)
- **File:** All API routes
- **Issue:** No anti-CSRF tokens on state-changing endpoints (POST/PUT/DELETE).
- **Risk:** Cross-site request forgery attacks on admin actions.
- **Fix:** Implement CSRF tokens or use SameSite cookies properly.

### 10. No Rate Limiting (Security/Stability)
- **File:** `src/app/api/auth/login/route.ts`, `src/app/api/inquiries/route.ts`
- **Issue:** No rate limiting on login (brute force) or inquiry submission (spam).
- **Risk:** Brute force password guessing, inquiry spam.
- **Fix:** Add rate limiting with `express-rate-limit` equivalent or middleware.

### 11. Inquiries API — No Input Validation (Security)
- **File:** `src/app/api/inquiries/route.ts`
- **Issue:** No email format validation, no message length limits, no sanitization.
- **Risk:** Spam, XSS stored in DB, invalid data.
- **Fix:** Validate email format with zod, limit message length, sanitize HTML.

### 12. No `next-auth` Integration (Architecture)
- **File:** `package.json:61` (next-auth dependency), middleware
- **Issue:** `next-auth` installed but not used — custom auth built instead (cookie-based).
- **Risk:** Unnecessary dependency, reinventing auth poorly.
- **Fix:** Either use NextAuth or remove the dependency.

### 13. `content-store.ts` — Duplicate `storage` Key (Bug)
- **File:** `src/store/content-store.ts:335-336`
- **Issue:** `storage: safeStorage` appears twice in the persist config object. Second overwrites first (so no actual bug) but it's a code smell.
- **Fix:** Remove duplicate.

### 14. All Admin Pages are Client Components (Performance)
- **File:** All files in `src/app/admin/`
- **Issue:** Every admin page uses `'use client'`, preventing SSR and SEO benefits.
- **Risk:** Poor initial load performance, larger JS bundles.
- **Fix:** Use server components where possible, isolate client sections.

### 15. No Pagination on Inquiries (UX/Performance)
- **File:** `src/app/api/inquiries/route.ts`, `src/app/admin/inquiries/page.tsx`
- **Issue:** All inquiries fetched at once — no pagination, no limit.
- **Risk:** Performance degradation with many inquiries.
- **Fix:** Add server-side pagination (limit/offset or cursor-based).

### 16. Media Library — No Database Tracking (Reliability)
- **File:** `src/app/api/media/route.ts`
- **Issue:** Media list reads filesystem directly (`readdir` + `stat`). No DB record. Hard to track usage or sync.
- **Risk:** Orphaned files, inconsistent state if manual deletions occur.
- **Fix:** Store media metadata in Upload model.

### 17. No Image Optimization (Performance)
- **File:** All site components
- **Issue:** All images use raw `<img>` tags instead of Next.js `<Image>` component. No lazy loading optimization or responsive images.
- **Risk:** Poor Lighthouse scores, slow page loads.
- **Fix:** Use Next.js `Image` with proper sizing.

### 18. Admin Password Change — No Re-authentication (Security)
- **File:** `src/app/api/settings/password/route.ts`
- **Issue:** Password change API only checks current password, but if session is already hijacked, attacker can change password.
- **Risk:** Permanent lockout of legitimate admin.
- **Fix:** Require re-authentication or use 2FA for sensitive actions.

---

## 🟡 MEDIUM Issues

### 19. Weak NEXTAUTH_SECRET (Security)
- **File:** `.env`
- **Issue:** `NEXTAUTH_SECRET="basnayaka-vermigrow-secret-key-2026"` — predictable string.
- **Risk:** If NextAuth were used, sessions could be forged.
- **Fix:** Use a proper random secret (e.g., `openssl rand -base64 32`).

### 20. No Metadata on Admin Pages (UX/SEO)
- **File:** `src/app/admin/layout.tsx`
- **Issue:** Admin pages have no custom `<title>` or meta tags — all show "Basnayaka VermiGrow".
- **Fix:** Add per-page metadata.

### 21. Tailwind v4 Deprecated Classes (Code Quality)
- **File:** `src/app/admin/login/page.tsx:63` and others
- **Issue:** `animate-in`, `slide-in-from-top-1`, `rotate-135`, `safe-area-pb` — these are Tailwind v3 classes not available in v4.
- **Risk:** Visual glitches, build warnings.
- **Fix:** Replace with v4 equivalents or custom CSS.

### 22. No Error Boundaries (UX/Reliability)
- **File:** All React components
- **Issue:** No `ErrorBoundary` wrappers anywhere. Any runtime error crashes the entire page.
- **Risk:** Blank screen on error.
- **Fix:** Add ErrorBoundary at app level and section level.

### 23. No Loading/Error States for Media Upload (UX)
- **File:** `src/components/admin/file-upload.tsx`
- **Issue:** Shows spinner during upload but no error message if upload fails.
- **Fix:** Show error toasts and handle failure states.

### 24. `confirm()` Dialogs (UX)
- **File:** `src/app/admin/inquiries/page.tsx:77`, `src/app/admin/media/page.tsx:77`
- **Issue:** Uses browser's native `confirm()` instead of custom modal.
- **Risk:** Inconsistent UI, poor mobile experience.
- **Fix:** Use shadcn AlertDialog or custom modal.

### 25. Content Editor — No Validation (UX)
- **File:** `src/app/admin/content/page.tsx`
- **Issue:** Can save empty content, duplicate IDs, missing required fields.
- **Risk:** Broken site after saving invalid content.
- **Fix:** Add form validation with zod schemas.

### 26. No Reorder Capability in Admin (UX)
- **File:** `src/app/admin/content/page.tsx`
- **Issue:** Products, photos, projects cannot be reordered (no drag-and-drop).
- **Risk:** Users must delete and re-add to change order.
- **Fix:** Add dnd-kit drag-and-drop reordering.

### 27. Inquiries Page — No Auto-Refresh (UX)
- **File:** `src/app/admin/inquiries/page.tsx`
- **Issue:** New inquiries don't appear unless page is manually refreshed.
- **Risk:** Missed inquiries.
- **Fix:** Add polling or WebSocket for real-time updates.

### 28. No SEO Configuration in CMS (Feature Gap)
- **File:** `src/store/content-store.ts` — `SiteContent` type
- **Issue:** No fields for meta description, OG tags, or page-specific SEO.
- **Risk:** Poor search engine visibility for managed content.
- **Fix:** Add seoTitle, seoDescription, ogImage fields.

### 29. API Route — Hardcoded Upload Path (Maintainability)
- **File:** `src/app/api/upload/route.ts`, `src/app/api/media/route.ts`
- **Issue:** Upload directory `public/uploads` hardcoded in multiple files.
- **Fix:** Use a shared constant.

### 30. No Robots.txt or Sitemap (SEO)
- **Issue:** Missing `robots.txt` and `sitemap.xml` for search engines.
- **Fix:** Add both files.

---

## 🔵 LOW Issues

### 31. Unused Import — `ShieldCheck` in Admin Layout
- **File:** `src/app/admin/layout.tsx:16`
- **Issue:** `ShieldCheck` imported but never used.
- **Fix:** Remove unused import.

### 32. Unused Imports in Services Component
- **File:** `src/components/site/services.tsx:3`
- **Issue:** `ShoppingBag` and `Star` unused in the iconMap (used directly in JSX).
- **Fix:** Keep for clarity or clean up.

### 33. `toast` Import in Edit Panel But May Not Show Errors
- **File:** `src/components/site/edit-panel.tsx:19`
- **Issue:** `toast` imported from sonner but only used for success (export/reset), not for API errors.
- **Fix:** Add error toasts for failed operations.

### 34. No TypeScript Strict Mode
- **Issue:** Assumed from `any` usage throughout — TypeScript strict mode likely not enabled in `tsconfig.json`.
- **Fix:** Enable `strict: true` and fix type errors.

### 35. Hardcoded Help Text and Descriptions (Localization)
- **Files:** All admin pages
- **Issue:** All admin text is hardcoded in Sinhala/English mix. No i18n support despite `next-intl` being installed.
- **Fix:** Either remove `next-intl` or implement localization.

### 36. Unused Dependencies (Package Bloat)
- **Issues:** `z-ai-web-dev-sdk`, `next-intl`, potentially others.
- **Fix:** Audit and remove unused packages.

### 37. Missing Docker/Deployment Configuration
- **Issue:** No Dockerfile, no CI/CD configuration, no `next.config.js`.
- **Fix:** Add deployment configuration.

---

## Summary by Category

| Category | Count | Key Concerns |
|----------|-------|-------------|
| 🔴 Critical | 8 | Plaintext passwords, cookie forgery, XSS, file upload |
| 🟠 High | 9 | CSRF, rate limiting, pagination, validation |
| 🟡 Medium | 11 | Deprecated classes, error handling, SEO, reordering |
| 🔵 Low | 7 | Unused imports, code cleanup, bloat |

**Total: 35 issues identified**

---

## Next Steps

1. ✅ Security fixes (password hashing, session tokens, input validation)
2. ✅ Code quality fixes (deduplication, remove unused files)
3. ✅ UX improvements (pagination, error handling, reordering)
4. ✅ Complete admin panel (missing features, better UI)
5. ✅ Performance (Next.js Image optimization, server components)
