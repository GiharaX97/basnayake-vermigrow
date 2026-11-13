#!/usr/bin/env node
/**
 * Copy the rewritten marketing copy from `content-defaults.ts` into the
 * `site-content` row, which is what the site actually renders.
 *
 * The store merges the stored blob OVER the defaults and takes arrays whole, so
 * editing content-defaults.ts alone changes nothing on a site whose database row
 * already exists. This script copies only the copy-bearing fields and leaves
 * every other CMS-owned value (contact details, SEO fields, images, stats)
 * untouched, so a client edit elsewhere is never clobbered.
 *
 *   node scripts/humanize-content.mjs [--db <path>] [--dry-run]
 *
 * Takes a timestamped backup of the database first.
 */
import { DatabaseSync } from 'node:sqlite'
import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defaultContent } from '../src/lib/content-defaults.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const DRY = process.argv.includes('--dry-run')
const DB_PATH = path.resolve(ROOT, arg('db', 'db/custom.db'))
const CONTENT_KEY = 'site-content'

/** Fields whose text was rewritten. Everything else in the blob is left alone. */
const COPY_FIELDS = [
  'tagline',
  'heroSlides',
  'aboutBody',
  'mission',
  'vision',
  'products',
  'projects',
  'founder',
  'mapLocations',
  'notices',
]

const DASH = /[–—]/

function dashes(obj, out = [], at = '') {
  if (typeof obj === 'string') {
    if (DASH.test(obj)) out.push(`${at || '(root)'}: ${obj.slice(0, 80)}`)
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => dashes(v, out, `${at}[${i}]`))
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) dashes(v, out, at ? `${at}.${k}` : k)
  }
  return out
}

function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`No database at ${DB_PATH}`)
    process.exit(1)
  }

  const db = new DatabaseSync(DB_PATH, { readOnly: DRY })
  const row = db.prepare('SELECT value FROM SiteContent WHERE key = ?').get(CONTENT_KEY)
  if (!row) {
    console.error(`No '${CONTENT_KEY}' row in ${DB_PATH}. The site would fall back to content-defaults.ts, which is already updated.`)
    db.close()
    process.exit(1)
  }

  const stored = JSON.parse(row.value)
  const next = { ...stored }
  const changed = []
  for (const key of COPY_FIELDS) {
    const before = JSON.stringify(stored[key])
    const after = JSON.stringify(defaultContent[key])
    if (before !== after) changed.push(key)
    next[key] = structuredClone(defaultContent[key])
  }

  const encoded = JSON.stringify(next)
  console.log(`db:    ${DB_PATH}`)
  console.log(`bytes: ${row.value.length} -> ${encoded.length}`)
  console.log(`fields updated: ${changed.length ? changed.join(', ') : '(none)'}`)

  const left = dashes(next)
  console.log(left.length ? `\nWARNING: ${left.length} dash(es) remain:\n  ${left.join('\n  ')}` : '\nNo em or en dashes remain in the content blob.')

  if (DRY) {
    console.log('\n[dry-run] nothing written.')
    db.close()
    return
  }
  if (changed.length === 0) {
    console.log('\nContent row already matches the defaults; left untouched.')
    db.close()
    return
  }

  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  let backup = `${DB_PATH}.backup-${stamp}`
  for (let n = 1; existsSync(backup); n++) backup = `${DB_PATH}.backup-${stamp}-${n}`
  copyFileSync(DB_PATH, backup)
  console.log(`\nbackup: ${path.relative(ROOT, backup)}`)

  db.prepare('UPDATE SiteContent SET value = ?, updatedAt = ? WHERE key = ?').run(
    encoded,
    new Date().toISOString(),
    CONTENT_KEY
  )
  db.close()
  console.log('Content row updated.')
}

main()
