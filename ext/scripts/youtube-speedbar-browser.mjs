import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const output = process.env.PLAYBACK_PROOF_DIR ?? join(tmpdir(), 'replayglows-speedbar-proof')
mkdirSync(output, { recursive: true })
const extension = resolve('dist')
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'rg-speedbar-')), {
  executablePath: process.env.PLAYWRIGHT_CHROMIUM, headless: true,
  viewport: { width: 1280, height: 720 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})
const wav = Buffer.alloc(44 + 8000 * 2 * 30)
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
const html = `<html lang="fr"><head><meta charset="utf-8"><title>YouTube speedbar fixture</title><style>
html{font-size:10px}body{margin:0;background:#171717;color:white;font-family:Arial}.html5-video-player{position:relative;width:calc(100% - 40px);height:450px;margin:20px;background:#333}video{width:100%;height:100%}.ytp-chrome-bottom{position:absolute;bottom:0;left:12px;right:12px}.ytp-progress-bar{position:relative;height:4px;background:#f03;margin-bottom:8px}.ytp-chrome-controls{display:flex;position:relative;height:48px;width:100%;line-height:48px;pointer-events:auto}.ytp-left-controls{flex:1;min-width:0;display:flex;align-items:center;height:48px}.ytp-right-controls{flex-shrink:0;display:flex;align-items:center;height:48px;width:140px}.ytp-time-display{width:70px}.ytp-chapter-title{width:110px;white-space:nowrap;overflow:hidden}.ytp-button{width:40px;height:40px;border:0;color:white;background:transparent}
/* Native modern YouTube groups cover the transparent gap behind our toolbar. */.ytp-left-controls,.ytp-right-controls{z-index:59;pointer-events:auto}</style></head><body><div class="html5-video-player"><video src="data:audio/wav;base64,${wav.toString('base64')}"></video><div class="ytp-chrome-bottom"><div class="ytp-progress-bar"></div><div class="ytp-chrome-controls"><div class="ytp-left-controls"><button class="ytp-button">▶</button><span class="ytp-time-display">0:00 / 0:30</span><span class="ytp-chapter-title">Introduction</span></div><div class="ytp-right-controls"><button class="ytp-button">⚙</button><button class="ytp-button">□</button></div></div></div></div></body></html>`
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const id = new URL(worker.url()).host
  const control = await context.newPage()
  await control.goto(`chrome-extension://${id}/src/options/options.html`)
  await control.evaluate(() => chrome.storage.local.set({ language: 'fr' }))
  const send = request => control.evaluate(request => chrome.runtime.sendMessage(request), request)
  await context.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: html }))
  const page = await context.newPage()
  await page.goto('https://www.youtube.com/watch?v=rgSpeedTest')
  await page.locator('#bookmark-button').waitFor()
  await page.waitForFunction(() => document.querySelector('video').duration === 30)
  const tabs = await worker.evaluate(() => chrome.tabs.query({}))
  const tabId = tabs.find(tab => tab.url === page.url()).id
  const bar = page.locator('.rg-yt-speedbar')
  assert.equal(await bar.isVisible(), false)
  // YouTube can replace controls between initialization and the menu click.
  await page.locator('.rg-yt-speedbar').evaluate(element => element.remove())
  await page.locator('#bookmark-button').hover()
  await page.getByRole('menuitemcheckbox', { name: 'Montrer la barre de vitesse', exact: true }).click()
  await bar.waitFor({ state: 'visible' })
  const assertPointerTargets = async () => {
    const targets = await bar.locator('input, button').evaluateAll(elements =>
      elements.filter(element => element.getClientRects().length).map(element => {
        const rect = element.getBoundingClientRect()
        const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        return { control: element.getAttribute('aria-label') || element.textContent,
          receivesPointer: element === target || element.contains(target) }
      }))
    assert.ok(targets.length > 0)
    assert.ok(targets.every(target => target.receivesPointer), JSON.stringify(targets))
  }
  await assertPointerTargets()
  const rateIs = rate => page.waitForFunction(rate => document.querySelector('video').playbackRate === rate, rate)
  await bar.getByRole('button', { name: '2×', exact: true }).click()
  await rateIs(2)
  assert.equal((await send({ action: 'rg:get', tabId })).media.rate, 2)
  const slider = bar.locator('input[type="range"]')
  await slider.click();
  await rateIs(Number(await slider.inputValue()))
  await slider.fill('1.25'); await rateIs(1.25)
  await send({ action: 'rg:settings', settings: { favorite: 1.75 } })
  await bar.getByRole('button', { name: /favorite/i }).click(); await rateIs(1.75)
  await send({ action: 'rg:rate', tabId, rate: 0.5 })
  await page.waitForFunction(() => Number(document.querySelector('.rg-yt-speedbar input').value) === 0.5)
  const popup = await context.newPage()
  await page.bringToFront()
  await popup.goto(`chrome-extension://${id}/src/popup/index.html`)
  await popup.getByRole('button', { name: '1.5×', exact: true }).click()
  await rateIs(1.5)
  await page.waitForFunction(() => Number(document.querySelector('.rg-yt-speedbar input').value) === 1.5)
  await popup.close()
  await page.bringToFront()
  const pin = bar.locator('.rg-yt-speedbar__pin')
  await pin.click()
  await page.waitForFunction(() => document.querySelector('.rg-yt-speedbar__pin').getAttribute('aria-pressed') === 'true')
  await bar.getByRole('button', { name: '2×', exact: true }).click(); await rateIs(2)
  assert.equal((await send({ action: 'rg:context' })).rate, 1.5, 'Pinned tab must not change global speed')
  assert.equal((await send({ action: 'rg:get', tabId })).pinned, true)
  await send({ action: 'rg:rate', tabId: (await worker.evaluate(() => chrome.tabs.query({}))).find(tab => tab.url.includes('/src/options/')).id, rate: 1.25 })
  await rateIs(2)
  await pin.click(); await rateIs(1.25)
  assert.equal((await send({ action: 'rg:get', tabId })).pinned, false)
  await send({ action: 'rg:pin', tabId, pinned: true })
  await page.waitForFunction(() => document.querySelector('.rg-yt-speedbar__pin').getAttribute('aria-pressed') === 'true')
  const geometry = () => page.evaluate(() => {
    const r = selector => document.querySelector(selector).getBoundingClientRect()
    const bar = r('.rg-yt-speedbar'), left = r('.ytp-left-controls'), right = r('.ytp-right-controls')
    return { fits: bar.left >= Math.max(...[...document.querySelector('.ytp-left-controls').children].map(e => e.getBoundingClientRect().right)) - 1 && bar.right <= right.left + 1, width: bar.width }
  })
  assert.ok((await geometry()).fits, JSON.stringify(await geometry()))
  await page.screenshot({ path: join(output, 'wide.png') })
  await page.setViewportSize({ width: 900, height: 600 })
  await page.waitForTimeout(150)
  assert.ok((await geometry()).fits, JSON.stringify(await geometry()))
  await assertPointerTargets()
  await page.screenshot({ path: join(output, 'compact.png') })
  await page.locator('#bookmark-button').hover()
  await page.getByRole('menuitemcheckbox', { name: 'Masquer la barre de vitesse', exact: true }).click()
  assert.equal(await bar.isVisible(), false)
  await page.locator('#bookmark-button').hover()
  await page.getByRole('menuitemcheckbox', { name: 'Montrer la barre de vitesse', exact: true }).click()
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.evaluate(() => document.dispatchEvent(new Event('yt-navigate-finish')))
  await page.waitForTimeout(300)
  assert.equal(await bar.count(), 1)
  await bar.waitFor({ state: 'visible' })
  assert.equal(await pin.getAttribute('aria-pressed'), 'true')
  await bar.getByRole('button', { name: '1×', exact: true }).click(); await rateIs(1)
  await slider.evaluate(input => {
    for (const rate of [0.25, 4, 1.75]) { input.value = String(rate); input.dispatchEvent(new Event('input', { bubbles: true })) }
  })
  await rateIs(1.75)
  await send({ action: 'rg:settings', settings: { enabled: false } })
  await page.waitForFunction(() => document.querySelector('.rg-yt-speedbar input').disabled)
  assert.ok(await bar.locator('.rg-yt-speedbar__error').isVisible())
  await send({ action: 'rg:settings', settings: { enabled: true } })
  await page.waitForFunction(() => !document.querySelector('.rg-yt-speedbar input').disabled)
  console.log('PASS packaged YouTube speedbar: toggle, preset, slider queue, favorite, popup/shared service sync, pin, resize, SPA, suspension')
} finally { await context.close() }
