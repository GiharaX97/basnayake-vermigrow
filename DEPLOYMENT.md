# Basnayaka VermiGrow — Production Deployment Runbook

> Target: Linux VPS + Caddy (auto-HTTPS). Public domain: **https://basnayakavermigrow.lk**
> App: Next.js 16 (standalone) + Prisma/SQLite + custom admin CMS.

**⚡ Quickstart:** upload the source to `/var/www/basnayakavermigrow/app`, then run
`sudo bash provision-vps.sh` on the VPS — it does steps 0–4 automatically. This file
documents what that script does, for manual runs / troubleshooting.

---

## 0. Build on the SERVER (or CI) with the production URL

`sitemap.xml` reads `NEXTAUTH_URL`, and Next **bakes it into the build** (confirmed — a runtime
override does not change it). Always build with the public URL set:

```bash
export NEXT_TELEMETRY_DISABLED=1
export NEXTAUTH_URL="https://basnayakavermigrow.lk"
export DATABASE_URL="file:/var/www/basnayakavermigrow/db/custom.db"

npm ci
npx next build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
```

Artifact to copy to the server = the contents of **`.next/standalone`**.

---

## 1. Server file layout (example)

```
/var/www/basnayakavermigrow/
├── app/                      # contents of .next/standalone
│   ├── server.js
│   ├── .next/…
│   ├── public/…              # includes uploads/ at runtime
│   └── node_modules/
├── db/
│   └── custom.db             # OUTSIDE the app dir → survives redeploys
└── uploads-backup/           # optional
```

Runtime env for the service (set via systemd unit, do **not** commit):

```bash
NODE_ENV=production
PORT=3001
HOSTNAME=127.0.0.1            # Caddy is the only public listener
DATABASE_URL="file:/var/www/basnayakavermigrow/db/custom.db"
NEXTAUTH_URL="https://basnayakavermigrow.lk"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"     # generate once, keep private
# ADMIN_PASSWORD is only needed to seed the FIRST login. Set a strong value,
# hit /api/settings/password once, then it is stored hashed in the DB.
```

---

## 2. Caddyfile (auto-HTTPS on the public domain)

```caddyfile
basnayakavermigrow.lk, www.basnayakavermigrow.lk {
	reverse_proxy 127.0.0.1:3001

	header {
		# HSTS — force HTTPS after you confirm the cert issues
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
	}
	encode gzip zstd
	# Optional: static uploads caching
	@uploads path /uploads/*
	header @uploads Cache-Control "public, max-age=604800"
}
```

Caddy auto-issues Let's Encrypt certs. Add A/AAAA + CNAME DNS records first.

---

## 3. Run it (systemd)

`/etc/systemd/system/basnayaka.service`:

```ini
[Unit]
Description=Basnayaka VermiGrow (Next.js standalone)
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/basnayakavermigrow/app
EnvironmentFile=/etc/basnayakavermigrow.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now basnayaka
journalctl -u basnayaka -f     # logs
```

---

## 4. First login (important)

The bundled `db/custom.db` shipped with a **rotated** admin password:

- Admin URL: `https://basnayakavermigrow.lk/admin/login`
- Current password: see **`SECRETS.local.md`** (gitignored, owner-only).
  ← change it immediately in Admin → Settings.
- Because the DB now stores the hash, the old `admin123` is rejected (env no longer overrides).

---

## 5. Persistent data you must back up

| Data | Location | Note |
|---|---|---|
| SQLite DB | `…/db/custom.db` | All content, inquiries, sessions |
| Uploads | `…/app/public/uploads/` | Media added via Admin |
| Caddy certs | auto in `/var/lib/caddy/` | Self-managed |

Backup DB safely (avoid copying a hot file): stop the service first, **or**:

```bash
sqlite3 /var/www/basnayakavermigrow/db/custom.db ".backup '/backups/custom-$(date +%F).db'"
```

Suggested cron: nightly DB backup + `rsync` of `public/uploads/`.

---

## 6. Before you go fully public — still missing (see full report)

- [ ] Change admin password on first login (step 4)
- [ ] Confirm DNS for `basnayakavermigrow.lk` + `www`
- [ ] SMTP/email: inquiries currently only arrive in the Admin panel (no email alert)
- [ ] Rate limiting on `/api/auth/login` (brute force) and `/api/inquiries` (spam)
- [ ] CSRF tokens on admin state-changing endpoints (SameSite=lax mitigates, not eliminates)
- [ ] Daily DB + uploads backup actually scheduled + tested restore
- [ ] Decide host for uploads that survives redeploys (volume or off-app dir)
- [ ] Remove secrets from git history (`.env` was committed earlier with `admin123`); rotate again after push history is cleaned if the repo ever goes public
- [ ] Analytics + uptime monitoring + log rotation
