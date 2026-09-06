import path from 'path'

/**
 * Directory where admin media uploads are stored.
 *
 * Default (dev): `<cwd>/public/uploads` — Next dev serves these live.
 * Production: set `UPLOADS_DIR` to an OFF-APP directory (e.g.
 * `/var/www/basnayakavermigrow/uploads`) that Caddy/nginx serves directly at
 * `/uploads/*`. Next standalone only serves files present in `public/` at
 * startup, so runtime-added uploads would otherwise 404 until restart — and
 * files in `public/` are wiped on redeploy.
 */
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads')
}
