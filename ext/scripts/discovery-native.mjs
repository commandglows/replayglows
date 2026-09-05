import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

assert.ok(process.env.PLAYWRIGHT_MODULE, 'Set PLAYWRIGHT_MODULE to the Playwright entry module')
assert.ok(process.env.PLAYWRIGHT_CHROMIUM, 'Set PLAYWRIGHT_CHROMIUM to full Chromium (not headless shell)')
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const output = process.env.DISCOVERY_PROOF_DIR ?? mkdtempSync(join(tmpdir(), 'rg-discovery-native-evidence-'))
mkdirSync(output, { recursive: true })
const extension = resolve('dist')
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'rg-discovery-native-')), {
  executablePath: process.env.PLAYWRIGHT_CHROMIUM, headless: true, chromiumSandbox: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--autoplay-policy=no-user-gesture-required'],
})
const wav = Buffer.alloc(44 + 8000 * 2 * 30)
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
const report = { screenshots: [], checks: [] }
try {
  await context.route('https://example.com/discovery-native', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Native discovery fixture</title><video controls src="data:audio/wav;base64,${wav.toString('base64')}"></video>` }))
  const media = context.pages()[0] ?? await context.newPage()
  await media.goto('https://example.com/discovery-native')
  await media.waitForFunction(() => document.querySelector('video').duration === 30)
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  await worker.evaluate(() => chrome.action.openPopup())
  const session = await context.newCDPSession(media)
  let target
  for (let tries = 0; tries < 100 && !target; tries++) {
    target = (await session.send('Target.getTargets')).targetInfos.find(item => item.url.endsWith('/src/popup/index.html'))
    if (!target) await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(target, 'Chrome action popup target must exist')
  assert.ok(!context.pages().some(page => page.url() === target.url), 'Native popup must be separate from ordinary tabs')
  report.targetType = target.type
  const { sessionId } = await session.send('Target.attachToTarget', { targetId: target.targetId, flatten: false })
  let requestId = 0
  async function cdp(method, params = {}) {
    const id = ++requestId
    return await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); session.off('Target.receivedMessageFromTarget', receive) }
      const receive = event => {
        if (event.sessionId !== sessionId) return
        const message = JSON.parse(event.message)
        if (message.id !== id) return
        cleanup()
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result)
      }
      const timer = setTimeout(() => { cleanup(); reject(new Error(`Native CDP timeout: ${method}`)) }, 15000)
      session.on('Target.receivedMessageFromTarget', receive)
      session.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(error => { cleanup(); reject(error) })
    })
  }
  async function read(expression) {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  async function until(expression) {
    for (let tries = 0; tries < 100; tries++) {
      const result = await read(expression)
      if (result) return result
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`Native condition timed out: ${expression}`)
  }
  const button = text => `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})`
  async function click(expression) {
    await until(`Boolean(${expression})`)
    await read(`(${expression}).scrollIntoView({block:'nearest'})`)
    const point = await read(`(()=>{const r=(${expression}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
  }
  async function screenshot(name) {
    const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const path = join(output, `${name}.png`)
    writeFileSync(path, Buffer.from(shot.data, 'base64'))
    report.screenshots.push(path)
  }
  await until("document.querySelector('#discovery-topic')?.value === 'speed'")
  await new Promise(resolve => setTimeout(resolve, 1500))
  report.initial = await read(`(()=>{const rect=s=>document.querySelector(s)?.getBoundingClientRect().toJSON();return {width:innerWidth,height:innerHeight,body:rect('body'),guide:rect('.sg-discovery'),pane:rect('.sg-bookmark-scroll'),playback:rect('.sg-speed-card'),footer:rect('footer'),text:document.body.innerText}})()`)
  await screenshot('native-guide-first')
  console.log('Native evidence directory: ' + output)
  assert.ok(report.initial.pane.height >= 250, 'First-run guide needs a readable pane, not a narrow strip')
  const headingVisible = await read("(()=>{const r=document.querySelector('.sg-discovery h2').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight})()")
  assert.ok(headingVisible, 'First guide heading must initially be visible')
  assert.equal(await read('scrollY'), 0, 'Initial native document must not scroll outside the popup')
  await click(button('Masquer les conseils'))
  await until("!document.querySelector('.sg-discovery') && document.activeElement?.textContent.trim() === 'Découvrir / Aide'")
  report.checks.push('Hide removes guide and returns focus to help button')
  await screenshot('native-guide-hidden')
  await click(button('Découvrir / Aide'))
  await until("document.activeElement?.textContent.trim() === 'Votre prochain petit pas'")
  report.checks.push('Reopen focuses guide heading')
  await click(button('Pour plus tard'))
  await until("document.querySelector('#discovery-topic')?.value === 'pin'")
  report.checks.push('Skip advances to pin lesson')
  await click("document.querySelector('#discovery-topic')")
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await until("document.querySelector('#discovery-topic')?.value === 'speed'")
  await click(button('Reprendre cet exercice'))
  await until(`Boolean(${button('Pour plus tard')})`)
  report.checks.push('Native select keyboard navigation and resume restore skipped speed lesson')
  await click(button('Aller aux commandes'))
  report.practiceFocus = await read("({tag:document.activeElement.tagName,role:document.activeElement.getAttribute('aria-label'),text:document.activeElement.textContent.trim()})")
  assert.equal(report.practiceFocus.role, 'Vitesse de lecture', 'Practice should focus speed input')
  assert.equal(await read('scrollY'), 0, 'Practice must scroll the popup container, not the document')
  const headerVisible = await read("(()=>{const r=document.querySelector('.sg-brand-row').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight})()")
  assert.ok(headerVisible, 'Sticky help/header must remain visible after practice')
  await screenshot('native-guide-practice')
  await click(button('1.5×'))
  await media.waitForFunction(() => document.querySelector('video').playbackRate === 1.5)
  await until("document.querySelector('.sg-discovery')?.innerText.includes('1 / 5 réussites confirmées')")
  report.checks.push('Native preset changes media rate and records confirmed achievement')
  await screenshot('native-guide-speed-confirmed')
  const wheelPoint = await read("(()=>{const r=document.querySelector('.sg-speed-card').getBoundingClientRect();return {x:r.x+r.width/2,y:Math.min(innerHeight-30,r.y+r.height/2)}})()")
  await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', ...wheelPoint, deltaX: 0, deltaY: 600 })
  await until("(()=>{const r=document.querySelector('footer').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight})()")
  assert.equal(await read('scrollY'), 0, 'Reaching the footer must keep outer document stationary')
  assert.ok(await read("(()=>{const r=document.querySelector('.sg-brand-row').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight})()"), 'Help/header must remain visible at bottom')
  report.checks.push('Normal popup wheel reaches loop/footer while sticky header remains visible and document stays stationary')
  await screenshot('native-guide-playback-bottom')
  report.final = await read("({width:innerWidth,height:innerHeight,footer:document.querySelector('footer').getBoundingClientRect().toJSON()})")
  console.log(JSON.stringify(report, null, 2))
  writeFileSync(join(output, 'native-discovery-report.json'), JSON.stringify(report, null, 2))
} finally { await context.close() }
