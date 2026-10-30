// Render every slide of the deck to a PNG for visual verification.
import fs from 'node:fs'
import path from 'node:path'

const DEBUG = 'http://localhost:9222'
const FILE = 'file:///H:/My_Projects/basnayake-glm5.2/deck/qr-system.html'
const OUT = path.resolve('deck/preview')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.listeners = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`))
        else resolve(msg.result)
        return
      }
      if (msg.method) for (const fn of this.listeners.get(msg.method) || []) fn(msg.params)
    })
  }
  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', reject, { once: true })
    })
    return new CDP(ws)
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, [])
    this.listeners.get(method).push(fn)
  }
}

async function evaluate(cdp, expression, awaitPromise = false) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  })
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text)
  return result.value
}

const target = await (await fetch(`${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json()
const cdp = await CDP.connect(target.webSocketDebuggerUrl)
await cdp.send('Page.enable')
await cdp.send('Runtime.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  mobile: false,
  screenWidth: 1280,
  screenHeight: 720,
})

const loaded = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve))
await cdp.send('Page.navigate', { url: FILE })
await loaded
await sleep(1500)
await evaluate(
  cdp,
  `Promise.all([
    document.fonts.ready,
    ...[...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r }))
  ]).then(() => true)`,
  true
)
await sleep(600)

const count = await evaluate(cdp, `document.querySelectorAll('.slide').length`)
console.log('slides', count)

for (let i = 0; i < count; i++) {
  const rect = await evaluate(
    cdp,
    `(() => { const el = document.querySelectorAll('.slide')[${i}]; const b = el.getBoundingClientRect();
      return { x: b.x + window.scrollX, y: b.y + window.scrollY, width: b.width, height: b.height }; })()`
  )
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: rect.x, y: rect.y, width: 1280, height: 720, scale: 1 },
  })
  const file = path.join(OUT, `slide-${String(i + 1).padStart(2, '0')}.png`)
  fs.writeFileSync(file, Buffer.from(data, 'base64'))
  console.log('saved', file)
}

cdp.ws.close()
process.exitCode = 0
