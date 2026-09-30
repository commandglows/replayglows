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
/* Native modern YouTube groups cover the transparent gap behind our toolbar. */.ytp-left-controls,.ytp-right-controls{z-index:59;pointer-events:auto}</style></head><body><div class="html5-video-player"><video src="data:audio/wav;base64,${wav.toString('base64')}"></video><div class="ytp-chrome-bottom"><div class="ytp-progress-bar"></div><div class="ytp-chrome-controls"><div class="ytp-left-controls"><button class="ytp-button">▶</button><span class="ytp-time-display">0:00 / 0:30</span><span class="ytp-chapter-title">Introduction</span></div><div class="ytp-right-controls"><button class="ytp-button">⚙</button><button class="ytp-button">□</button></div></div></div></div><script>(()=>{const v=document.querySelector('video'),p=document.querySelector('.ytp-progress-bar');const sync=()=>p.style.setProperty('--progress',String(v.currentTime/v.duration));v.addEventListener('timeupdate',sync);v.addEventListener('seeked',sync)})()</script></body></html>`
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
  await page.evaluate(() => {
    window.__rgSeekEvents = 0
    document.querySelector('video').addEventListener('seeking', () => window.__rgSeekEvents++)
  })
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
  for (const rate of [2.5, 3, 3.5, 4]) {
    await bar.getByRole('button', { name: `${rate}×`, exact: true }).click()
    await rateIs(rate)
  }
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
  // Enable through the real settings UI and verify persistence after reopening.
  await control.reload()
  const attachOption = control.getByRole('checkbox', { name: /Attacher le pointeur à la barre de vitesse/ })
  assert.equal(await attachOption.isChecked(), false)
  await attachOption.check()
  await control.waitForFunction(() => chrome.storage.local.get('playbackSettings').then(v => v.playbackSettings.attachPointerToSpeedBar === true))
  await control.reload()
  assert.equal(await attachOption.isChecked(), true)
  await page.bringToFront()
  const rect = await slider.boundingBox()
  const x = fraction => rect.x + 8 + (rect.width - 16) * fraction
  const y = rect.y + rect.height / 2
  await page.mouse.move(x(0.2), y)
  await rateIs(1)
  assert.equal(await bar.getAttribute('data-pointer-attached'), 'true')
  assert.equal(await slider.evaluate(e => getComputedStyle(e).cursor), 'none')
  await page.mouse.down()
  await page.mouse.up()
  assert.equal(await bar.getAttribute('data-pointer-attached'), null)
  assert.notEqual(await slider.evaluate(e => getComputedStyle(e).cursor), 'none')
  await page.mouse.move(x(0.8), y)
  await page.waitForTimeout(150)
  await rateIs(1) // Click fixes the hovered rate even as the pointer moves within the bar.
  await page.mouse.move(x(0.8), rect.y - 70)
  await rateIs(1)
  await page.mouse.move(x(0.2), y)
  await rateIs(1)
  assert.equal(await bar.getAttribute('data-pointer-attached'), 'true')

  await page.mouse.move(x(0.6), rect.y - 20)
  await rateIs(2.5)
  await page.mouse.move(x(0.8), rect.y - 50)
  assert.equal(await bar.getAttribute('data-pointer-attached'), null)
  assert.notEqual(await slider.evaluate(e => getComputedStyle(e).cursor), 'none')
  await page.waitForTimeout(150)
  await rateIs(2.5)
  await page.mouse.move(x(0.8), rect.y - 20)
  await rateIs(2.5) // No reacquisition until the actual slider is reached.
  await page.mouse.move(x(0.8), y)
  await rateIs(3.25)
  await page.mouse.move(rect.x + rect.width - 1, y)
  await rateIs(4)
  await page.mouse.move(rect.x + 1, y)
  await rateIs(0.25)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  assert.equal(await bar.getAttribute('data-pointer-attached'), null)
  assert.notEqual(await slider.evaluate(e => getComputedStyle(e).cursor), 'none')
  await send({ action: 'rg:settings', settings: { attachPointerToSpeedBar: false } })
  await page.mouse.move(x(0.6), y)
  await page.waitForTimeout(150)
  await rateIs(0.25)
  await control.reload()
  const scrubOption = control.getByRole('checkbox', { name: /Maintenir Alt pour parcourir la vidéo/ })
  assert.equal(await scrubOption.isChecked(), false)
  await scrubOption.check()
  await control.waitForFunction(() => chrome.storage.local.get('playbackSettings').then(v => v.playbackSettings.altSeekOnSpeedBar === true))
  await control.reload()
  assert.equal(await scrubOption.isChecked(), true)
  await send({ action: 'rg:settings', settings: { attachPointerToSpeedBar: true } })
  await page.bringToFront()
  await page.evaluate(async () => { const v = document.querySelector('video'); v.currentTime = 15; v.muted = true; await v.play(); v.muted = false; v.volume = 0.6 })
  await page.mouse.move(x(0.4), y)
  await rateIs(1.75)
  await page.keyboard.down('Alt')
  assert.equal(await bar.getAttribute('data-scrubbing'), 'true')
  assert.equal(await slider.inputValue(), '0')
  assert.equal(await page.locator('video').evaluate(v => v.muted), true)
  assert.equal(await page.locator('video').evaluate(v => v.paused), false)
  await page.waitForFunction(() => document.querySelector('video').currentTime > 15.1)
  await page.waitForFunction(() => Number(document.querySelector('.ytp-progress-bar').style.getPropertyValue('--progress')) > 0.5)
  assert.ok(await page.locator('.ytp-progress-bar').evaluate(element => Number(element.style.getPropertyValue('--progress'))) > 0.5,
    'The timeline keeps moving during neutral Alt scrub')
  const scrubRect = await slider.boundingBox()
  const half = (scrubRect.width - 16) / 2
  await page.mouse.move(x(0.4) - half * 0.65, y)
  await page.waitForFunction(() => document.querySelector('video').currentTime < 14)
  await page.mouse.move(x(0.4), y)
  await page.waitForFunction(() => !document.querySelector('video').seeking)
  await page.waitForTimeout(100)
  const parked = await page.evaluate(() => ({ time: document.querySelector('video').currentTime, seeks: window.__rgSeekEvents }))
  await page.waitForTimeout(150)
  const afterPark = await page.evaluate(() => ({ time: document.querySelector('video').currentTime, seeks: window.__rgSeekEvents }))
  assert.equal(afterPark.seeks, parked.seeks, 'a stationary neutral pointer sends no more seek requests')
  assert.ok(afterPark.time >= parked.time, 'the playing video does not move backwards while the pointer is parked')
  await page.mouse.move(x(0.4) + half * 0.8, y)
  await page.waitForFunction(t => document.querySelector('video').currentTime > t + 1, parked.time)
  await page.keyboard.up('Alt')
  assert.equal(await bar.getAttribute('data-scrubbing'), null)
  assert.deepEqual(await page.locator('video').evaluate(v => ({ muted: v.muted, volume: v.volume, paused: v.paused, rate: v.playbackRate })), { muted: false, volume: 0.6, paused: false, rate: 1.75 })
  assert.equal(await slider.getAttribute('min'), '0.25')
  // Preserve an already-muted paused video; scrubbing must not start it, including on blur.
  await page.locator('video').evaluate(v => { v.pause(); v.muted = true })
  await page.mouse.move(x(0.4), y)
  await page.keyboard.down('Alt')
  assert.equal(await page.locator('video').evaluate(v => v.paused), true)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  assert.equal(await page.locator('video').evaluate(v => v.paused), true)
  assert.equal(await page.locator('video').evaluate(v => v.muted), true)
  assert.equal(await page.locator('.html5-video-player').evaluate(e => e.classList.contains('rg-speedbar-scrubbing')), false)
  await page.keyboard.up('Alt')
  // Detachment stops seeking and restores sound without changing playback; bounds stay inside the video.
  await page.locator('video').evaluate(v => { v.pause(); v.muted = false; v.currentTime = 0.1 })
  await page.mouse.move(x(0.4), y)
  await page.keyboard.down('Alt')
  await page.mouse.move(x(0.4) - half, y)
  await page.waitForFunction(() => document.querySelector('video').currentTime === 0)
  await page.mouse.move(x(0.4) + half, y)
  await page.locator('video').evaluate(v => { v.currentTime = 29.9 })
  await page.waitForFunction(() => document.querySelector('video').currentTime === 30)
  await page.mouse.move(x(0.4), y - 80)
  assert.equal(await bar.getAttribute('data-scrubbing'), null)
  assert.equal(await page.locator('video').evaluate(v => v.muted), false)
  await page.keyboard.up('Alt')
  await page.locator('video').evaluate(v => { v.currentTime = 15 })
  await page.mouse.move(x(0.4), y)
  await page.keyboard.down('Alt')
  await send({ action: 'rg:settings', settings: { enabled: false } })
  await page.waitForFunction(() => !document.querySelector('.html5-video-player').classList.contains('rg-speedbar-scrubbing'))
  assert.equal(await page.locator('video').evaluate(v => v.muted), false)
  await page.keyboard.up('Alt')
  await send({ action: 'rg:settings', settings: { enabled: true } })
  // Reproduce long-stream seeks: decoding remains busy for 250ms per seek.
  // Patch the video in the actual extension isolated world, not the host page.
  const cdp = await context.newCDPSession(page)
  const worlds = []
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context))
  await cdp.send('Runtime.enable')
  const extensionWorld = worlds.find(world => world.origin === `chrome-extension://${id}` || world.name === `chrome-extension://${id}`)
  assert.ok(extensionWorld, JSON.stringify(worlds.map(w => ({ name: w.name, origin: w.origin }))))
  const isolated = async expression => {
    const response = await cdp.send('Runtime.evaluate', { contextId: extensionWorld.id, expression, returnByValue: true })
    assert.equal(response.exceptionDetails, undefined, JSON.stringify(response.exceptionDetails))
    return response.result.value
  }
  // On a media element without video frames, the fallback must still advance
  // the target while issuing fewer decoder seeks than the old 10 Hz loop.
  await page.locator('video').evaluate(v => { v.pause(); v.currentTime = 10 })
  await isolated(`(() => {
    const video = document.querySelector('video');
    const nativeTime = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
    let writes = 0;
    Object.defineProperty(video, 'currentTime', { configurable: true,
      get: () => nativeTime.get.call(video),
      set: value => { writes++; nativeTime.set.call(video, value) },
    });
    globalThis.fastSeekWrites = () => writes;
    globalThis.restoreFastSeekCount = () => { delete video.currentTime; delete globalThis.fastSeekWrites; delete globalThis.restoreFastSeekCount };
  })()`)
  await page.mouse.move(x(0.4), y)
  await page.keyboard.down('Alt')
  const previewRect = await slider.boundingBox()
  await page.mouse.move(x(0.4) + (previewRect.width - 16) / 4, y)
  await page.waitForTimeout(1250)
  await page.keyboard.up('Alt')
  const previewWrites = await isolated('globalThis.fastSeekWrites()')
  assert.ok(previewWrites >= 2 && previewWrites <= 9, `preview seeks should be coalesced, got ${previewWrites}`)
  assert.ok(await page.locator('video').evaluate(v => v.currentTime) > 11, 'preview still advances the media')
  await isolated('globalThis.restoreFastSeekCount()')
  console.log(`PASS Alt preview backpressure: ${previewWrites} seeks in 1.25 seconds without video frames`)
  await isolated(`(() => {
    const video = document.querySelector('video'); video.pause();
    let position = 3600, seeking = false, latestApplied = 3600, discarded = 0;
    Object.defineProperties(video, {
      duration: { configurable: true, get: () => 7200 },
      currentTime: { configurable: true, get: () => position, set: value => {
        if (seeking) { discarded++; return; }
        position = value; latestApplied = value; seeking = true;
        video.dispatchEvent(new Event('timeupdate'));
        setTimeout(() => { seeking = false; video.dispatchEvent(new Event('seeked')); }, 250);
      } },
      seeking: { configurable: true, get: () => seeking },
    });
    const progress = document.querySelector('.ytp-progress-bar');
    const syncProgress = () => progress.style.setProperty('--progress', String(video.currentTime / video.duration));
    video.addEventListener('timeupdate', syncProgress);
    video.addEventListener('seeked', syncProgress);
    globalThis.restoreSlowSeekProgress = () => {
      video.removeEventListener('timeupdate', syncProgress);
      video.removeEventListener('seeked', syncProgress);
    };
    globalThis.slowSeekStats = () => ({ position, latestApplied, discarded });
  })()`)
  await isolated(`(() => {
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    globalThis.restoreScrubSend = () => { chrome.runtime.sendMessage = send };
    chrome.runtime.sendMessage = message => message.action === 'rg:command' && message.command === 'clearLoop' ? new Promise(() => {}) : send(message);
  })()`)
  await page.mouse.move(x(0.4), y)
  await page.keyboard.down('Alt')
  const longRect = await slider.boundingBox()
  await page.mouse.move(x(0.4) - (longRect.width - 16) / 2, y)
  await page.waitForTimeout(1500)
  const longPosition = await isolated("document.querySelector('video').currentTime")
  console.log(`Long-video rewind: ${3600 - longPosition} video seconds in 1.5 seconds`)
  // The host hides controls after inactivity; holding Alt must keep our UI active.
  await page.locator('.ytp-chrome-bottom').evaluate(element => { element.style.opacity = '0'; element.style.visibility = 'hidden' })
  await page.evaluate(() => history.replaceState(null, '', `${location.pathname}${location.search}&t=42`))
  await page.waitForTimeout(5500)
  assert.equal(await bar.getAttribute('data-scrubbing'), 'true', 'Host auto-hide must not end Alt scrub')
  assert.ok(longPosition < 2700, `Long-video rewind too slow: ${3600 - longPosition} seconds in 1.5 seconds`)
  assert.equal(await isolated("document.querySelector('video').currentTime"), 0, 'Maximum rewind reaches the beginning of a two-hour video')
  await page.mouse.move(x(0.4) + longRect.width, y) // Horizontal overshoot clamps, not detaches.
  await page.waitForTimeout(7500)
  assert.equal(await bar.getAttribute('data-scrubbing'), 'true')
  assert.equal(await isolated("document.querySelector('video').currentTime"), 7200, 'Maximum forward reaches the end')
  const slowSeekStats = await isolated('globalThis.slowSeekStats()')
  assert.equal(slowSeekStats.discarded, 0, 'No currentTime write should be attempted while a seek is active')
  assert.equal(slowSeekStats.position, slowSeekStats.latestApplied, 'The final media position must match the last applied target')
  assert.equal(slowSeekStats.latestApplied, 7200, 'The target reached at the forward bound must be applied')
  assert.equal(await page.locator('.ytp-progress-bar').evaluate(element => Number(element.style.getPropertyValue('--progress'))), 1,
    'The fixture timeline must follow the applied media position')
  await page.keyboard.up('Alt')
  assert.equal(await bar.getAttribute('data-scrubbing'), null)
  assert.equal(await page.locator('video').evaluate(v => v.muted), false)
  await page.locator('.ytp-chrome-bottom').evaluate(element => { element.style.opacity = ''; element.style.visibility = '' })
  await isolated(`(() => { const video = document.querySelector('video'); globalThis.restoreSlowSeekProgress(); delete globalThis.restoreSlowSeekProgress; delete video.currentTime; delete video.duration; delete video.seeking; delete globalThis.slowSeekStats; globalThis.restoreScrubSend(); delete globalThis.restoreScrubSend })()`)
  await cdp.detach()
  console.log('PASS sustained Alt scrub: slow decoder, two-hour video to both bounds, host auto-hide, overshoot, restoration')
  await send({ action: 'rg:settings', settings: { altSeekOnSpeedBar: false } })
  await page.mouse.move(x(0.5), y)
  await page.keyboard.down('Alt')
  assert.equal(await bar.getAttribute('data-scrubbing'), null)
  await page.keyboard.up('Alt')
  // Four hover zones use the video surface without stealing toolbar scrolling.
  await control.reload()
  const splitsOption = control.getByRole('checkbox', { name: /Contrôler la vidéo avec quatre zones au survol/ })
  assert.equal(await splitsOption.isChecked(), false)
  await splitsOption.check()
  await control.waitForFunction(() => chrome.storage.local.get('playbackSettings').then(v => v.playbackSettings.videoHoverSplits === true))
  await control.reload()
  assert.equal(await splitsOption.isChecked(), true)
  await page.bringToFront()
  await page.locator('video').evaluate(v => { v.volume = 0.5; v.muted = false; v.currentTime = 15 })
  const vr = await page.locator('video').boundingBox()
  const hoverZone = async index => page.mouse.move(vr.x + vr.width * (index + 0.5) / 4, vr.y + vr.height / 2)
  const wheel = async delta => { await page.mouse.wheel(0, delta); await page.waitForTimeout(220) }
  const splits = page.locator('.rg-video-splits')
  await hoverZone(0)
  await splits.waitFor({ state: 'visible' })
  assert.equal(await splits.locator(':scope > div').count(), 4)
  await page.mouse.wheel(0, -100)
  await page.waitForTimeout(40)
  const chartEdges = await splits.locator(':scope > div').first().evaluate(band => {
    const fill = band.querySelector('.rg-video-split-fill').getBoundingClientRect()
    const above = band.querySelector('.rg-video-split-above').getBoundingClientRect()
    const threshold = band.querySelector('.rg-video-split-threshold').getBoundingClientRect()
    return { fillTop: fill.top, aboveBottom: above.bottom, thresholdBottom: threshold.bottom }
  })
  assert.ok(Math.abs(chartEdges.fillTop - chartEdges.thresholdBottom) <= 1, JSON.stringify(chartEdges))
  assert.ok(Math.abs(chartEdges.fillTop - chartEdges.aboveBottom) <= 1, JSON.stringify(chartEdges))
  await page.waitForTimeout(180)
  assert.ok(Math.abs(await page.locator('video').evaluate(v => v.volume) - 0.51) < 0.001)
  assert.equal(await page.locator('video').evaluate(v => getComputedStyle(v).cursor), 'none')
  assert.equal(await splits.locator(':scope > div').nth(1).evaluate(e => getComputedStyle(e).visibility), 'hidden')
  assert.ok(Math.abs(await splits.locator(':scope > div').first().evaluate(e => parseFloat(e.style.getPropertyValue('--level'))) - 51) < 0.001)
  assert.equal(await splits.locator('.rg-video-split-threshold').first().evaluate(e => getComputedStyle(e).height), '2px')
  await page.screenshot({ path: join(output, 'split-volume-interacting.png') })
  await page.waitForFunction(() => !document.querySelector('video').classList.contains('rg-video-splits-interacting'))
  assert.notEqual(await page.locator('video').evaluate(v => getComputedStyle(v).cursor), 'none')
  await page.waitForFunction(() => document.querySelector('.rg-video-splits').classList.contains('rg-video-splits-fading'))
  await splits.waitFor({ state: 'hidden' })
  await hoverZone(0)
  await page.locator('video').evaluate(v => { v.volume = 0.37123 })
  await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('.rg-video-splits > div').style.getPropertyValue('--level')) - 37.123) < 0.0001)
  await wheel(1) // Even a sub-step wheel event enters interaction immediately.
  assert.equal(await page.locator('video').evaluate(v => getComputedStyle(v).cursor), 'none')
  await page.mouse.move(5, 5)
  assert.equal(await splits.isVisible(), false)
  assert.equal(await page.locator('video').evaluate(v => v.classList.contains('rg-video-splits-interacting')), false)
  await page.locator('video').evaluate(v => { v.volume = 0.55 })
  await hoverZone(1); await wheel(-100)
  assert.equal(await splits.locator('.rg-icon-rays').first().evaluate(e => getComputedStyle(e).animationName), 'rg-sun-pulse')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await splits.locator('.rg-icon-rays').first().evaluate(e => getComputedStyle(e).animationName), 'none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  assert.match(await page.locator('video').evaluate(v => v.style.filter), /brightness\(1.0175\)/)
  await send({ action: 'rg:rate', tabId, rate: 1 })
  await hoverZone(2); await wheel(-100); await rateIs(1.0375)
  await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('.rg-video-splits > div:nth-child(3)').style.getPropertyValue('--needle-angle')) - (-120 + (1.0375 - 0.25) / 3.75 * 240)) < 0.001)
  await hoverZone(3); await wheel(100)
  assert.equal(await page.locator('video').evaluate(v => v.currentTime), 10)
  await wheel(-100)
  assert.equal(await page.locator('video').evaluate(v => v.currentTime), 15)
  await hoverZone(0)
  await page.locator('video').evaluate(v => { v.volume = 0.371 })
  await page.keyboard.down('Control'); await wheel(-100); await page.keyboard.up('Control')
  assert.ok(Math.abs(await page.locator('video').evaluate(v => v.volume) - 0.4) < 0.001)
  await hoverZone(2)
  await send({ action: 'rg:rate', tabId, rate: 1.13 }); await rateIs(1.13)
  await page.keyboard.down('Control'); await wheel(-100); await page.keyboard.up('Control')
  await rateIs(1.15)
  await page.evaluate(() => {
    const panel = document.createElement('div'); panel.id = 'test-chapters';
    for (const time of ['0:00', '0:10', '0:20']) {
      const row = document.createElement('ytd-macro-markers-list-item-renderer');
      const stamp = document.createElement('span'); stamp.id = 'time'; stamp.textContent = time;
      row.append(stamp); panel.append(row);
    }
    document.body.append(panel);
  })
  await hoverZone(3)
  await page.keyboard.down('Control'); await wheel(-100)
  assert.equal(await page.locator('video').evaluate(v => v.currentTime), 20)
  await wheel(100)
  assert.equal(await page.locator('video').evaluate(v => v.currentTime), 10)
  await page.keyboard.up('Control')
  await page.evaluate(() => document.querySelector('#test-chapters').remove())
  await page.keyboard.down('Control'); await wheel(-100); await page.keyboard.up('Control')
  assert.equal(await page.locator('video').evaluate(v => v.currentTime), 10)
  await page.locator('video').evaluate(v => { v.currentTime = 15; v.volume = 0.55 })
  console.log('PASS Ctrl wheel: aligned volume/speed steps, next/previous chapter, missing chapters preserve position')
  // A full mouse notch changes the real value immediately, with no delayed drift.
  await hoverZone(0)
  const samples = await page.locator('video').evaluate(async v => {
    v.volume = 0.5;
    const r = v.getBoundingClientRect();
    v.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: r.x + r.width / 8, clientY: r.y + r.height / 2 }));
    const immediate = v.volume;
    await new Promise(resolve => setTimeout(resolve, 70));
    const middle = v.volume;
    await new Promise(resolve => setTimeout(resolve, 150));
    return { immediate, middle, end: v.volume };
  })
  assert.ok(Math.abs(samples.immediate - 0.51) < 0.00001)
  assert.equal(samples.middle, samples.immediate)
  assert.ok(Math.abs(samples.end - 0.51) < 0.00001)
  console.log('PASS immediate wheel response without delayed drift', samples)
  // Unmodified fine wheel input must change each parameter before any 40px threshold.
  await hoverZone(0); await wheel(-2)
  assert.ok(Math.abs(await page.locator('video').evaluate(v => v.volume) - 0.5102) < 0.00001)
  await hoverZone(1)
  const priorFilter = await page.locator('video').evaluate(v => v.style.filter)
  await wheel(-2)
  assert.notEqual(await page.locator('video').evaluate(v => v.style.filter), priorFilter)
  assert.equal(await splits.locator('.rg-icon-rays').count(), 8)
  assert.equal(await splits.locator('.rg-icon-waves').count(), 2)
  assert.equal(new Set(await splits.locator('.rg-icon-rays').evaluateAll(nodes => nodes.map(e => getComputedStyle(e).animationDelay))).size, 8)
  await hoverZone(2)
  await send({ action: 'rg:rate', tabId, rate: 1 }); await rateIs(1)
  await wheel(-2); await rateIs(1.00075)
  await hoverZone(3)
  await page.locator('video').evaluate(v => { v.volume = 0.55 })
  console.log('PASS continuous non-Ctrl input and individually phased icon parts')
  // Leaving cancels partial Ctrl trackpad accumulation.
  await page.keyboard.down('Control')
  await wheel(20); await page.mouse.move(5, 5)
  await splits.waitFor({ state: 'hidden' })
  await hoverZone(3); await wheel(20)
  assert.equal(await page.locator('video').evaluate(v => v.currentTime), 15)
  await page.keyboard.up('Control')
  await page.locator('video').evaluate(v => { v.currentTime = 29 })
  await wheel(-100)
  assert.equal(await page.locator('video').evaluate(v => v.currentTime), 30)
  await page.locator('#bookmark-button').hover()
  await splits.waitFor({ state: 'hidden' })
  await send({ action: 'rg:settings', settings: { videoHoverSplits: false } })
  await page.waitForFunction(() => document.querySelector('video').style.filter === '')
  await hoverZone(0); await wheel(-100)
  assert.equal(await splits.isVisible(), false)
  assert.ok(Math.abs(await page.locator('video').evaluate(v => v.volume) - 0.55) < 0.001)
  console.log('PASS four hover splits: settings persistence, all controls, direction, bounds, exit cancellation, toolbar exclusion and filter restoration')
  // Visibility is shared with existing tabs and persisted for new tabs/reloads.
  const other = await context.newPage()
  await other.goto('https://www.youtube.com/watch?v=rgVisibilityTest')
  const otherBar = other.locator('.rg-yt-speedbar')
  await otherBar.waitFor({ state: 'visible' })
  await other.locator('#bookmark-button').hover()
  await other.getByRole('menuitemcheckbox', { name: 'Masquer la barre de vitesse', exact: true }).click()
  await otherBar.waitFor({ state: 'hidden' })
  await bar.waitFor({ state: 'hidden' })
  await page.reload()
  await page.locator('#bookmark-button').waitFor()
  assert.equal(await bar.isVisible(), false)
  await page.locator('#bookmark-button').hover()
  await page.getByRole('menuitemcheckbox', { name: 'Montrer la barre de vitesse', exact: true }).click()
  await bar.waitFor({ state: 'visible' })
  await otherBar.waitFor({ state: 'visible' })
  await other.reload()
  await otherBar.waitFor({ state: 'visible' })
  await other.evaluate(() => document.dispatchEvent(new Event('yt-navigate-finish')))
  await otherBar.waitFor({ state: 'visible' })
  assert.equal(await control.evaluate(() => chrome.storage.local.get('speedBarVisible').then(v => v.speedBarVisible)), true)
  await other.close()
  console.log('PASS global speedbar visibility: new tab, hide/show propagation, reload and SPA persistence')
  console.log('PASS Alt scrubbing: option persistence, neutral center, reverse, forward, release, paused/playing/muted restoration, blur and opt-out')
  console.log('PASS pointer attachment: settings persistence, no-click entry, tolerance, detach/freeze, reentry, bounds, blur, disabled mode')
  console.log('PASS packaged YouTube speedbar: toggle, preset, slider queue, favorite, popup/shared service sync, pin, resize, SPA, suspension')
} finally { await context.close() }
