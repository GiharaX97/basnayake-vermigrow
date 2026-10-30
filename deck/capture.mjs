/**
 * Capture the presentation screenshots from the running demo app using the
 * Chrome DevTools Protocol directly (no Puppeteer dependency).
 */
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:3001'
const DEBUG = 'http://localhost:9222'
const PASSWORD = process.env.DECK_ADMIN_PASSWORD || 'deck-demo-pass-2026'
const RECEIPT_TOKEN = process.env.RECEIPT_TOKEN || 'oveFczLuO1j9-gIRL2KEiqNM'
const OUT = path.resolve('deck/shots')
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
      if (msg.method) {
        const fns = this.listeners.get(msg.method) || []
        for (const fn of fns) fn(msg.params)
      }
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

  waitEvent(method, timeoutMs = 90000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), timeoutMs)
      this.on(method, (params) => {
        clearTimeout(timer)
        resolve(params)
      })
    })
  }

  close() {
    this.ws.close()
  }
}

async function evaluate(cdp, expression, awaitPromise = false) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  })
  if (exceptionDetails) {
    const text = exceptionDetails.exception?.description || exceptionDetails.text
    throw new Error(`evaluate failed: ${text}`)
  }
  return result.value
}

async function waitFor(cdp, expression, label, timeoutMs = 120000) {
  const start = Date.now()
  let lastErr
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evaluate(cdp, `!!(${expression})`)) return
    } catch (e) {
      lastErr = e
    }
    await sleep(300)
  }
  throw new Error(`timeout waiting for ${label}${lastErr ? `: ${lastErr.message}` : ''}`)
}

async function goto(cdp, url, readyExpr, label) {
  const loaded = cdp.waitEvent('Page.loadEventFired', 120000).catch(() => {})
  await cdp.send('Page.navigate', { url })
  await loaded
  await waitFor(cdp, `document.readyState === 'complete'`, `${label} load`)
  await waitFor(cdp, readyExpr, label, 120000)
  // Let fonts, images and entry animations settle.
  await sleep(1200)
}

async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  })
  const file = path.join(OUT, `${name}.png`)
  fs.writeFileSync(file, Buffer.from(data, 'base64'))
  console.log('saved', file)
}

async function shotElement(cdp, name, selector) {
  const rect = await evaluate(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.max(0, b.x + window.scrollX), y: Math.max(0, b.y + window.scrollY), width: b.width, height: b.height };
    })()`
  )
  if (!rect || rect.width < 10 || rect.height < 10) {
    throw new Error(`element ${selector} has no usable rect: ${JSON.stringify(rect)}`)
  }
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
  })
  const file = path.join(OUT, `${name}.png`)
  fs.writeFileSync(file, Buffer.from(data, 'base64'))
  console.log('saved', file, `${Math.round(rect.width)}x${Math.round(rect.height)}`)
}

async function shotFullPage(cdp, name, maxHeight = 4000) {
  const height = await evaluate(cdp, 'Math.min(document.documentElement.scrollHeight, ' + maxHeight + ')')
  const width = await evaluate(cdp, 'document.documentElement.clientWidth')
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  })
  const file = path.join(OUT, `${name}.png`)
  fs.writeFileSync(file, Buffer.from(data, 'base64'))
  console.log('saved', file, `${width}x${Math.round(height)}`)
}

async function scrollToText(cdp, text, offset = 160) {
  await evaluate(
    cdp,
    `(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (walker.currentNode.nodeValue && walker.currentNode.nodeValue.includes(${JSON.stringify(text)})) {
          const el = walker.currentNode.parentElement;
          window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - ${offset});
          return true;
        }
      }
      return false;
    })()`
  )
  await sleep(700)
}

async function clickText(cdp, text, tag = 'button') {
  return evaluate(
    cdp,
    `(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(tag)})];
      const el = els.find((e) => (e.innerText || '').trim().includes(${JSON.stringify(text)}));
      if (!el) return false;
      el.click();
      return true;
    })()`
  )
}

async function main() {
  const target = await (await fetch(`${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json()
  const cdp = await CDP.connect(target.webSocketDebuggerUrl)
  let pageErrors = []

  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  cdp.on('Runtime.exceptionThrown', (p) => {
    pageErrors.push(p.exceptionDetails?.text || 'exception')
  })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 2,
    mobile: false,
    screenWidth: 1600,
    screenHeight: 1000,
  })

  // ---------- public pages ----------
  await goto(cdp, `${BASE}/order`, `document.body.innerText.includes('Vermigrow Organic Fertilizer')`, 'order')
  await shot(cdp, 'order-top')
  await scrollToText(cdp, 'Hand-turned vermicompost', 110)
  await shot(cdp, 'order-products')

  await goto(cdp, `${BASE}/donations`, `document.body.innerText.includes('Nimal Perera')`, 'donations')
  await shot(cdp, 'donations-top')
  await scrollToText(cdp, 'Scanned your pack?', 80)
  await shot(cdp, 'donations-wall')

  await goto(cdp, `${BASE}/r/${RECEIPT_TOKEN}`, `document.body.innerText.includes('Nadeesha')`, 'receipt')
  await shotFullPage(cdp, 'receipt', 2600)

  // ---------- admin login ----------
  await goto(cdp, `${BASE}/admin/login`, `!!document.querySelector('#password')`, 'login')
  const status = await evaluate(
    cdp,
    `fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: ${JSON.stringify(PASSWORD)} }) }).then(r => r.status)`,
    true
  )
  console.log('login status', status)
  if (status !== 200) throw new Error(`admin login failed: ${status}`)

  await goto(cdp, `${BASE}/admin/catalog`, `document.body.innerText.includes('Vermigrow Organic Fertilizer — 1 kg')`, 'catalog')
  await shot(cdp, 'admin-catalog')

  await goto(cdp, `${BASE}/admin/warehouse`, `document.body.innerText.includes('Generate pack codes')`, 'warehouse')
  await shot(cdp, 'admin-warehouse')

  // Dispatches tab → print the small Colombo dispatch
  await clickText(cdp, 'Dispatches', 'button')
  await waitFor(cdp, `document.body.innerText.includes('Lanka Garden Hub')`, 'dispatches list')
  await sleep(800)
  await shot(cdp, 'admin-dispatches')
  const clicked = await evaluate(
    cdp,
    `(() => {
      const row = [...document.querySelectorAll('div,li,tr')].find((el) => (el.innerText || '').includes('Lanka Garden Hub') && el.querySelector('button[title="Print QR sheet"]'));
      const btn = row ? row.querySelector('button[title="Print QR sheet"]') : [...document.querySelectorAll('button[title="Print QR sheet"]')][0];
      if (!btn) return false;
      btn.click();
      return true;
    })()`
  )
  console.log('print button clicked:', clicked)
  await waitFor(cdp, `document.querySelectorAll('.print-sheet img').length >= 10`, 'sticker preview')
  await sleep(1200)
  await shotElement(cdp, 'sticker-sheet', '.print-sheet')
  // Close the dialog (Escape) so the next pages are clean.
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 })
  await sleep(700)

  await goto(cdp, `${BASE}/admin/orders`, `document.body.innerText.includes('VG-2026-1042')`, 'orders')
  await shot(cdp, 'admin-orders')

  await goto(cdp, `${BASE}/admin/orders/VG-2026-1042`, `document.body.innerText.includes('VG-2026-1042')`, 'order detail')
  await sleep(800)
  await shot(cdp, 'admin-order-detail')
  await shotFullPage(cdp, 'admin-order-detail-full', 3200)

  await goto(cdp, `${BASE}/admin/donations`, `document.body.innerText.includes('Total raised')`, 'admin donations')
  await shot(cdp, 'admin-donations')

  await goto(cdp, `${BASE}/admin`, `document.body.innerText.length > 100`, 'admin home')
  await shot(cdp, 'admin-dashboard')

  console.log('page errors:', pageErrors.slice(0, 10))
  cdp.close()
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
