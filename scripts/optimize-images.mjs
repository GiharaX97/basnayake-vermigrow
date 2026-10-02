#!/usr/bin/env node
/**
 * Prepare the farm's real photographs for the web.
 *
 *   node scripts/optimize-images.mjs [--src <dir>] [--out <dir>] [--dry-run]
 *
 * Reads a manifest of source files and writes optimised copies into the repo's
 * `public/images/`, so the deploy — which is a plain `git pull` followed by a
 * build on the VPS (see deploy-vermigrow.sh:19) — carries them along. Anything
 * added to public/ at RUNTIME is not served and is lost on redeploy; committed
 * files are not, which is the whole reason these live here rather than in
 * UPLOADS_DIR.
 *
 * The originals are 3840x2160 / 4.7 MB camera files. Most of the saving is the
 * downscale, not the quality knob: 4.7 MB -> ~250 KB with no visible difference
 * at the sizes the site actually renders.
 *
 * Re-runnable. Drop more files in the source directory, add a manifest row, run
 * again — existing outputs are simply overwritten.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const DRY = process.argv.includes('--dry-run')
const SRC_DIR = arg('src', 'C:/Users/Gihara/Downloads')
const OUT_DIR = path.resolve(ROOT, arg('out', 'public/images'))

/**
 * `width`/`height` are the LONG-EDGE target, except for `exact: true` logos
 * which are already small and kept as-is.
 *
 * `cutout` converts a logo photographed/flattened onto white into a PNG with a
 * real alpha channel. The project cards render their logo over an emerald
 * gradient header (src/components/site/projects.tsx), so a JPEG's white box
 * would be plainly visible.
 */
const MANIFEST = [
  { from: 'hero-slide.jpg',            to: 'farm-hero.jpg',   width: 1920, height: 1080 },
  { from: 'about-us.jpg',              to: 'farm-about.jpg',  width: 1200, height: 1500 },
  { from: 'founder-photo.jpg',         to: 'founder.jpg',     width: 1000, height: 1333 },
  { from: 'event-training-day.jpg',    to: 'training-day.jpg', width: 1600, height: 1200 },
  { from: 'PROJECT-LOGO_GEDAVILA.jpg', to: 'brand-gedavila.png',  cutout: true },
  { from: 'PROJECT-LOGO_PANANALA.jpg', to: 'brand-pananala.png',  cutout: true },
  { from: 'PROJECT-LOGO_PINWANTHA.jpg', to: 'brand-pinwantha.png', cutout: true },
]

/**
 * White -> transparent, by luminance.
 *
 * alpha is a linear ramp between two measured points rather than a raw
 * "distance from white":
 *
 *   alpha = 255 * (WHITE - min(r,g,b)) / (WHITE - CORE)   clamped to 0..255
 *
 * The naive `255 - min` was tried first and is wrong here: these marks are a
 * desaturated maroon whose darkest channel sits around 30, not 0, so nothing
 * ever reached full opacity and the whole logo rendered ~87% opaque — visibly
 * washed out over the emerald gradient header. Anchoring CORE at the actual
 * darkest colour makes the solid strokes genuinely solid while leaving
 * antialiased edges as a soft ramp.
 *
 * CORE is derived per-image (5th percentile of the non-white pixels) so the same
 * rule works across marks of differing contrast. RGB is never touched, so colour
 * cannot shift.
 *
 * These are all dark-on-white. A LIGHT logo would need the inverse rule.
 */
const WHITE = 240

async function cutoutWhite(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info

  const mins = []
  for (let i = 0; i < data.length; i += channels) {
    mins.push(Math.min(data[i], data[i + 1], data[i + 2]))
  }
  const ink = mins.filter((v) => v < WHITE).sort((a, b) => a - b)
  const core = ink.length ? ink[Math.floor(0.05 * (ink.length - 1))] : WHITE - 1
  // Guard: a flat/near-white source would give span ~0 and divide to infinity.
  const span = Math.max(1, WHITE - core)

  const out = Buffer.alloc(width * height * 4)

  for (let i = 0, o = 0; i < data.length; i += channels, o += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const alpha = Math.max(0, Math.min(255, Math.round((255 * (WHITE - Math.min(r, g, b))) / span)))
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    out[o + 3] = alpha
  }

  // trim() drops the now-transparent border so the mark fills its box rather
  // than floating in the original's whitespace.
  return sharp(out, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 10 })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  let total = 0
  const rows = []

  for (const item of MANIFEST) {
    const input = path.join(SRC_DIR, item.from)
    const output = path.join(OUT_DIR, item.to)

    let src
    try {
      src = await readFile(input)
    } catch {
      rows.push([item.to, 'MISSING', `no such file: ${input}`])
      continue
    }

    const buf = item.cutout
      ? await cutoutWhite(src)
      : await sharp(src)
          .resize(item.width, item.height, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: 82, mozjpeg: true, progressive: true })
          .toBuffer()

    if (!DRY) await writeFile(output, buf)

    const outMeta = item.cutout ? null : await sharp(buf).metadata()
    const inMeta = await sharp(src).metadata()
    total += buf.length
    rows.push([
      item.to,
      `${(src.length / 1024).toFixed(0)} KB -> ${(buf.length / 1024).toFixed(0)} KB`,
      `${inMeta.width}x${inMeta.height}${outMeta ? ` -> ${outMeta.width}x${outMeta.height}` : ' (cutout)'}`,
    ])
  }

  const w = Math.max(...rows.map((r) => r[0].length))
  for (const [name, size, dims] of rows) {
    console.log(`${name.padEnd(w)}  ${size.padEnd(24)} ${dims}`)
  }
  console.log(`\n${DRY ? '[dry-run] ' : ''}${rows.length} entries, ${(total / 1024).toFixed(0)} KB written -> ${OUT_DIR}`)
  if (rows.some((r) => r[1] === 'MISSING')) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
