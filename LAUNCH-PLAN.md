# Basnayaka Vermigrow — Launch Plan & Setup Checklist

> Target launch: today (5-hour execution window)
> Public URL: **https://basnayakavermigrow.lk**
> App: Next.js 16 (standalone) + Prisma/SQLite + custom admin CMS

---

## ⚠️ Assumptions (confirm before starting)

- Domain to register: **`basnayakavermigrow.lk`** (full `.lk` package, ~LKR 8,000–8,500/yr)
  — matches brand, code, email and sitemap.
- VPS: **Contabo Cloud VPS S @ Singapore** (nearest DC to Sri Lanka = fastest local loads),
  Ubuntu 24.04, ~US$7.99/mo (~LKR 2,900/mo).
- Payment and legal identity (NIC / business registration) are **the owner's** —
  Claude cannot buy services or register domains on your behalf.

---

## 💰 Cost summary

| Item | Cost | Frequency |
|---|---|---|
| `.lk` domain (CAT1 standard) | ~LKR 6,500–8,500 (agent-dependent) | yearly |
| Contabo Cloud VPS S @ Singapore | ~US$7.99 (~LKR 2,900) | monthly |
| VPS setup fee | ~€4.99 (may be waived on promo) | once |

---

## ✅ Phase 1 — Register the domain (START FIRST — approval can take ~1 working day)

Estimated: 15–30 min now.

1. Pick a registrar (LK Domain Registry agent):
   - [LankaHost](https://www.lankahost.lk/lk-domain-registration) — ~LKR 6,500
   - [SriLankaHosting](https://www.srilankahosting.lk/lk-domain-registration) — ~LKR 7,500
   - [Provider.lk](https://www.provider.lk/blog/how-to-get-your-lk-domain-fast-complete-registration-guide/)
2. Request **`basnayakavermigrow.lk`**, 1 year, category **CAT1 (Standard / full package)**.
3. Submit registrant details:
   - Full name + NIC copy (individual) **or** Business Registration (company)
   - Organization name
   - Reason: *"Official website of Basnayaka Vermigrow organic farm, Karandeniya, Sri Lanka"*
4. Save the **DNS panel login** you receive — you will add an `A` record in Phase 5.

> `.lk` registration is subject to registry approval. Some agents activate in ~15–30 min;
> others take 1–3 days. Start this before anything else.

---

## ✅ Phase 2 — Buy & order the Contabo VPS (in parallel)

Estimated: 30–45 min.

1. Create account at [contabo.com](https://contabo.com) (verify email).
2. Order **Cloud VPS S**:
   - Datacenter: **Singapore**
   - OS: **Ubuntu 24.04 LTS**
   - Networking: 1 × IPv4
3. Pay by **card or PayPal**. (Some Sri Lankan cards are declined — PayPal is the reliable
   fallback.)
4. On delivery Contabo emails you: **server IP, root password, SSH port**. Store these safely —
   do not commit them anywhere.

---

## ✅ Phase 3 — Get code + data to the server

Estimated: 20 min.

> ⚠️ **Do NOT copy the Windows `.next` build** — Prisma & sharp bundle OS-specific native
> binaries. A Windows build will not run on Linux. **The app is built on the VPS.**

Upload the **source** (not `node_modules/` or `.next/`):

| Files to include | Notes |
|---|---|
| `package.json`, `package-lock.json` | deps |
| `src/`, `public/`, `prisma/` | app code |
| `db/custom.db` | **live content** (must ship) |
| `next.config.ts`, `tsconfig.json` | config |
| `.env.example` | template |

| Option | How | When |
|---|---|---|
| **A (recommended)** | Claude `scp`/`rsync` source from this PC → VPS | needs server access |
| **B** | Push to a **private** GitHub repo → `git clone` on VPS | needs GitHub account |
| C | Manual `scp` | — |

---

## ✅ Phase 4 — Provision the server (one command)

Estimated: 30–60 min (mostly the Next.js build).

> Claude generates **`provision-vps.sh`** on request. Running it as root:

1. `apt update`; install **Node.js 22 LTS**, **Caddy**, `unzip`, `sqlite3`.
2. Create runtime user + dirs:
   - `/var/www/basnayakavermigrow/app/` — app source
   - `/var/www/basnayakavermigrow/db/` — SQLite (outside app dir → survives redeploys)
3. Write server env `.env.production`:
   ```bash
   NODE_ENV=production
   PORT=3001
   HOSTNAME=127.0.0.1        # Caddy is the only public listener
   DATABASE_URL="file:/var/www/basnayakavermigrow/db/custom.db"
   NEXTAUTH_URL="https://basnayakavermigrow.lk"
   NEXTAUTH_SECRET="<openssl rand -base64 32>"
   ADMIN_PASSWORD="<strong, first-seed only>"
   ```
4. `npm ci`
5. `npx prisma generate` && `npx prisma db push`
6. `npx next build`  ← **NEXTAUTH_URL must be set — it is baked into the build (sitemap.xml)**
7. `cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`
8. Run under **systemd** (`Restart=always`, logs via journald) — see `DEPLOYMENT.md`.
9. Firewall: open **80/443** only.
10. Seed admin: `GET /api/settings/password` once (stores the hashed admin password).

### 🔑 Admin credential at launch
- The bundled DB has a strong password (rotated; `admin123` is disabled).
- Store & read it from **`SECRETS.local.md`** (gitignored) — not in tracked docs.
- **Change it in Admin → Settings on first login.**

---

## ✅ Phase 5 — DNS + HTTPS

Estimated: 30–60 min (mostly propagation).

1. In the registrar's DNS panel add:
   ```
   basnayakavermigrow.lk        A   <VPS_IP>
   www.basnayakavermigrow.lk    A   <VPS_IP>
   ```
2. Wait for propagation — check [dnschecker.org](https://dnschecker.org).
3. Caddy auto-issues the Let's Encrypt certificate once DNS resolves.
   (If a cert error shows, wait and reload.)

Caddyfile (auto-HTTPS):

```caddyfile
basnayakavermigrow.lk, www.basnayakavermigrow.lk {
	reverse_proxy 127.0.0.1:3001

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
	}
	encode gzip zstd
}
```

---

## ✅ Phase 6 — Go-live verification

Estimated: 20 min. Mark each off:

- [ ] `https://basnayakavermigrow.lk` → HTTP 200, images load
- [ ] `/admin/login` → change password → log out → log back in with the new one
- [ ] `/sitemap.xml` → shows `https://basnayakavermigrow.lk` URLs
- [ ] Contact form submission appears in Admin → Inquiries
- [ ] Security headers present (`curl -I`): nosniff, SAMEORIGIN, Referrer-Policy, Permissions-Policy
- [ ] Test on a phone (mobile layout)

---

## ✅ Phase 7 — Post-launch (today or tomorrow)

- [ ] Cron nightly DB backup (`sqlite3 <db> ".backup '<file>'"`) + rsync of `public/uploads/`
- [ ] Email alert when a new inquiry arrives (currently only visible in Admin)
- [ ] Analytics (site visits)
- [ ] Uptime monitoring + log rotation

---

## 🔍 Known gaps still open for a commercial site (triage)

- **Rate limiting** on `/api/auth/login` (brute force) and `/api/inquiries` (spam) — not yet done
- **CSRF tokens** on admin state-changing endpoints (SameSite=lax mitigates, not eliminates)
- **Uploads persistence** — media lives in `public/uploads`; must survive redeploys (mount outside app dir)
- **Email/notification** for inquiries
- **Backups** scheduled + tested restore

---

## 🧩 Division of work

| Step | Who |
|---|---|
| Buy VPS, register domain, pay | Owner (Claude cannot) |
| DNS records | Owner (Claude can guide) |
| Upload source to server | Claude (given SSH access) |
| Provision server + build + deploy | Claude |
| First-login password change | Owner |
| Post-launch hardening | Claude |

## 🔗 Reference files in this repo
- `DEPLOYMENT.md` — detailed Linux VPS runbook (systemd, Caddyfile, backups)
- `AUDIT-ISSUES.md` / `PROJECT-STATUS.md` — outstanding security & feature gaps
