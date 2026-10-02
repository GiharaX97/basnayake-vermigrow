#!/usr/bin/env node
/**
 * Replace the site's stock imagery, rename the brand, and empty the galleries
 * that have no real coverage — in the DATABASE, where the live content lives.
 *
 *   node scripts/migrate-site-content.mjs [--db <path>] [--dry-run] [--no-backup]
 *
 * WHY THIS IS A SCRIPT AND NOT AN EDIT TO content-defaults.ts
 *
 * The site reads one JSON blob from `SiteContent` where key = 'site-content',
 * and merges it over the defaults with `deepMergeDefaults`. That merge takes
 * arrays WHOLE — `stored` wins outright whenever it is an array
 * (src/lib/content-defaults.ts:419-421). So every array in the defaults is dead
 * code the moment the row exists, which it already does on localhost and on the
 * VPS. Changing content-defaults.ts alone changes nothing anyone can see; it
 * only affects a brand-new, empty database.
 *
 * Both must therefore be updated together: content-defaults.ts by hand (the
 * fresh-seed path), and this script for the databases that already exist.
 *
 * Safe to re-run. Each step is written as an absolute destination, not a
 * find-and-replace, so running it twice lands on the same result.
 *
 * Does NOT touch anything outside the one content row. It never deletes rows,
 * and it takes a timestamped backup first unless told not to.
 */
import { DatabaseSync } from 'node:sqlite'
import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const DRY = process.argv.includes('--dry-run')
const NO_BACKUP = process.argv.includes('--no-backup')
const DB_PATH = path.resolve(ROOT, arg('db', 'db/custom.db'))

const CONTENT_KEY = 'site-content'

/* ------------------------------------------------------------------ spec -- */

const PHOTOS = [
  { id: 'p1', src: '/images/farm-about.jpg', caption: 'Finished vermicompost, ready to use', category: 'Farm Environment' },
  { id: 'p2', src: '/images/training-day.jpg', caption: 'A training day with local growers', category: 'Training' },
]

const PROJECTS = [
  { logo: '/images/brand-gedavila.png', image: '/images/farm-about.jpg', title: 'Gedavila', category: 'Fertilizer' },
  { logo: '/images/brand-pananala.png', image: '/images/farm-hero.jpg', title: 'Pananala', category: 'Integrated farming' },
  { logo: '/images/brand-pinwantha.png', image: '/images/training-day.jpg', title: 'Pinwantha', category: 'Project' },
]

const MAP_PHOTOS = ['/images/farm-hero.jpg', '/images/farm-about.jpg', '/images/training-day.jpg']

const STOCK_RE = /images\.unsplash\.com|commondatastorage\.googleapis\.com|encrypted-tbn0\.gstatic\.com|gstatic\.com/

/* ------------------------------------------------------------- migration -- */

function migrate(c) {
  const changes = []
  // `undefined` is a normal value here: the blob predates the event/training
  // sections entirely, so those keys are simply absent rather than empty.
  // JSON.stringify(undefined) returns undefined, not a string, hence the guard.
  const show = (v) => {
    if (typeof v === 'string') return v
    if (v === undefined) return '(absent)'
    return JSON.stringify(v) ?? String(v)
  }
  const note = (where, before, after) => {
    const b = show(before)
    const a = show(after)
    if (b !== a) changes.push({ where, before: b, after: a })
  }

  // -- hero: keep the client's own headline, drop the two fabricated slides.
  const first = Array.isArray(c.heroSlides) ? c.heroSlides[0] : undefined
  note('heroSlides', c.heroSlides, '1 slide')
  c.heroSlides = [
    {
      id: 'h1',
      type: 'image',
      src: '/images/farm-hero.jpg',
      title: first?.title || 'Growing soil, growing life',
      subtitle: first?.subtitle || 'Organic fertilizer & vegetables from Karandeniya, Sri Lanka',
    },
  ]

  note('aboutImage', c.aboutImage, '/images/farm-about.jpg')
  c.aboutImage = '/images/farm-about.jpg'

  // -- photos: only what the farm actually has.
  note('photos', c.photos, `${PHOTOS.length} real photos`)
  c.photos = PHOTOS

  // -- videos: Google's gtv-videos-bucket demo clips, not farm footage.
  note('videos', c.videos, '[]')
  c.videos = []
  note('eventPhotos', c.eventPhotos, '[]')
  c.eventPhotos = []
  note('trainingPhotos', c.trainingPhotos, '[]')
  c.trainingPhotos = []
  note('trainingVideos', c.trainingVideos, '[]')
  c.trainingVideos = []

  // -- projects: real brand marks. description/year are carried over from the
  //    existing cards rather than invented; they still need the client's copy.
  if (Array.isArray(c.projects)) {
    c.projects = c.projects.map((p, i) => {
      const spec = PROJECTS[i]
      if (!spec) return p
      return { ...p, ...spec, description: p.description ?? '', year: p.year ?? '' }
    })
    note('projects', '(3 cards)', PROJECTS.map((p) => p.title).join(' / '))
  }

  // -- founder
  if (c.founder) {
    note('founder.image', c.founder.image, '/images/founder.jpg')
    c.founder.image = '/images/founder.jpg'
  }

  // -- map popups
  if (Array.isArray(c.mapLocations)) {
    c.mapLocations = c.mapLocations.map((loc, i) => ({
      ...loc,
      photos: MAP_PHOTOS[i] ? [MAP_PHOTOS[i]] : [],
    }))
    note('mapLocations[].photos', '(stock)', 'real photos')
  }

  // -- the brand rename, applied last so it also catches any string set above.
  let renamed = 0
  const walk = (v) => {
    if (typeof v === 'string') return v.replace(/VermiGrow/g, 'Vermigrow')
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out = {}
      for (const [k, val] of Object.entries(v)) out[k] = walk(val)
      return out
    }
    return v
  }
  const before = JSON.stringify(c)
  const renamedDoc = walk(c)
  renamed = (before.match(/VermiGrow/g) || []).length
  if (renamed) note('brand strings', `${renamed} x "VermiGrow"`, `${renamed} x "Vermigrow"`)

  return { content: renamedDoc, changes }
}

/** Every stock URL still present anywhere in the object, with its path. */
function findStock(c) {
  const hits = []
  ;(function walk(o, p) {
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${p}[${i}]`))
    if (o && typeof o === 'object') return Object.entries(o).forEach(([k, v]) => walk(v, p ? `${p}.${k}` : k))
    if (typeof o === 'string' && STOCK_RE.test(o)) hits.push(`${p} -> ${o}`)
  })(c, '')
  return hits
}

/* ------------------------------------------------------------------ main -- */

function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`No database at ${DB_PATH}`)
    process.exit(1)
  }

  const db = new DatabaseSync(DB_PATH, { readOnly: DRY })
  const row = db.prepare('SELECT value FROM SiteContent WHERE key = ?').get(CONTENT_KEY)
  if (!row) {
    console.error(`No '${CONTENT_KEY}' row in ${DB_PATH} — nothing to migrate (the site would be using content-defaults.ts).`)
    db.close()
    process.exit(1)
  }

  const original = JSON.parse(row.value)
  const { content, changes } = migrate(structuredClone(original))
  const encoded = JSON.stringify(content)

  console.log(`db:       ${DB_PATH}`)
  console.log(`blob:     ${row.value.length} -> ${encoded.length} bytes`)
  console.log(`stock URLs before: ${findStock(original).length}\n`)

  if (changes.length === 0) {
    console.log('Already migrated — nothing to do.')
  } else {
    for (const { where, before, after } of changes) {
      const trim = (s) => (s.length > 64 ? s.slice(0, 61) + '...' : s)
      console.log(`  ${where}`)
      console.log(`    - ${trim(before)}`)
      console.log(`    + ${trim(after)}`)
    }
  }

  const left = findStock(content)
  if (left.length) {
    console.log(`\nWARNING: ${left.length} stock URL(s) still present after migration:`)
    left.forEach((l) => console.log(`  ${l}`))
  } else {
    console.log('\nNo stock URLs remain in the content blob.')
  }

  if (DRY) {
    console.log('\n[dry-run] nothing written.')
    db.close()
    return
  }

  if (!NO_BACKUP) {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const stamp =
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    // Collision-proof: two runs inside the same second would otherwise write the
    // same filename, so the second would overwrite the genuine pre-migration
    // backup with an already-migrated copy — exactly when a backup is most
    // needed. Suffix until the name is free.
    let backup = `${DB_PATH}.backup-${stamp}`
    for (let n = 1; existsSync(backup); n++) backup = `${DB_PATH}.backup-${stamp}-${n}`
    copyFileSync(DB_PATH, backup)
    console.log(`\nbackup:   ${path.relative(ROOT, backup)}`)
  }

  db.prepare('UPDATE SiteContent SET value = ?, updatedAt = ? WHERE key = ?').run(
    encoded,
    new Date().toISOString(),
    CONTENT_KEY
  )
  db.close()
  console.log('Content row updated.')
}

main()
