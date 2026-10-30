import sharp from 'sharp'
import fs from 'node:fs'

fs.mkdirSync('deck/assets', { recursive: true })

const jobs = [
  ['order-top', 0, 0, 3200, 1880],
  ['order-products', 0, 0, 3200, 1880],
  ['donations-top', 0, 0, 3200, 1880],
  ['donations-wall', 0, 140, 3200, 1480],
  ['receipt', 0, 0, 3200, 1500],
  ['admin-catalog', 0, 0, 3200, 1880],
  ['admin-warehouse', 0, 0, 3200, 1880],
]

for (const [name, left, top, width, height] of jobs) {
  await sharp(`deck/shots/${name}.png`)
    .extract({ left, top, width, height })
    .resize({ width: 1600 })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(`deck/assets/${name}.jpg`)
  console.log('prepared', name)
}

await sharp('public/images/farm-hero.jpg')
  .resize({ width: 2000 })
  .modulate({ brightness: 0.72, saturation: 0.9 })
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile('deck/assets/cover.jpg')

// The supplied logo has its black Sinhala word ("බස්නායක") flattened to pure
// white, so it disappears the moment the logo sits on a white surface — which is
// exactly what happens on the cover's white card. Recolour only those opaque
// white pixels to the brand's near-black, then trim the transparent margin so
// the lockup fills the card instead of shrinking inside it.
const logo = sharp('public/logos/logo-main.png')
const { data, info } = await logo.ensureAlpha().raw().toBuffer({ resolveWithObject: true })

for (let i = 0; i < data.length; i += 4) {
  const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
  if (a > 8 && r > 200 && g > 200 && b > 200) {
    data[i] = 20
    data[i + 1] = 20
    data[i + 2] = 20
  }
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ threshold: 1 })
  .resize({ width: 900 })
  .png()
  .toFile('deck/assets/logo.png')

console.log('done')
