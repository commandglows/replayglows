import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const modulePath = process.env.PLAYWRIGHT_MODULE
const executablePath = process.env.PLAYWRIGHT_CHROMIUM
if (!modulePath || !executablePath) throw new Error('Set PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM to the installed runtime.')
const { chromium } = await import(pathToFileURL(modulePath).href)
const output = process.env.PLAYBACK_PROOF_DIR ?? join(tmpdir(), 'replayglows-playback-proof')
mkdirSync(output, { recursive: true })
const extension = resolve('dist')
for (const file of ['content.js', 'media.js']) assert.ok(!/^\s*(?:import|export)\s/m.test(readFileSync(join(extension, file), 'utf8')), `${file} must be classic`)
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'rg-playback-')), {
  executablePath, headless: true, chromiumSandbox: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--autoplay-policy=no-user-gesture-required'],
})
const failures = []
const check = async (name, fn) => { await fn(); console.log(`PASS ${name}`) }
const wav = Buffer.alloc(44 + 8000 * 2 * 30)
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
const source = `data:audio/wav;base64,${wav.toString('base64')}`
const fixture = (tag = 'video') => `<html><head><title>ReplayGlows ${tag} fixture</title></head><body><h1>Playback proof</h1><${tag} controls src="${source}" style="width:640px;height:240px"></${tag}><input aria-label="Note"><div id="dynamic"></div></body></html>`
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const id = new URL(worker.url()).host
  // Extension pages send messages from an extension origin; service-worker sendMessage is not delivered to itself.
  const control = await context.newPage()
  await control.goto(`chrome-extension://${id}/src/options/options.html`)
  const send = request => control.evaluate(request => chrome.runtime.sendMessage(request), request)
  const tabId = async page => {
    const tabs = await worker.evaluate(() => chrome.tabs.query({}))
    return tabs.find(tab => tab.url === page.url())?.id
  }
  await context.route('https://example.com/rg-proof', route => route.fulfill({ contentType: 'text/html', body: fixture() }))
  await context.route('https://example.org/rg-proof', route => route.fulfill({ contentType: 'text/html', body: fixture('audio') }))
  const first = await context.newPage(); await first.goto('https://example.com/rg-proof')
  const second = await context.newPage(); await second.goto('https://example.org/rg-proof')
  await first.waitForFunction(() => document.querySelector('video').duration === 30)
  await second.waitForFunction(() => document.querySelector('audio').duration === 30)
  const one = await tabId(first); const two = await tabId(second)
  await check('registered two origins with real HTMLMediaElement', async () => {
    await first.waitForTimeout(300)
    const result = await send({ action: 'rg:get', tabId: one })
    assert.ok(!result.error, JSON.stringify({one,two,result}))
    assert.equal(result.media?.available, true)
    assert.equal((await send({ action: 'rg:get', tabId: two })).media.kind, 'audio')
  })
  const rateIs = (page, rate) => page.waitForFunction(rate => Math.abs(document.querySelector('video,audio').playbackRate - rate) < .001, rate)
  await check('global speed propagates video + audio', async () => {
    assert.ok(!(await send({ action: 'rg:rate', tabId: one, rate: 1.5 })).error)
    await rateIs(first, 1.5); await rateIs(second, 1.5)
  })
  await check('pin isolates; global changes; reload retains pin; unpin rejoins latest global', async () => {
    await send({ action: 'rg:pin', tabId: two, pinned: true })
    await send({ action: 'rg:rate', tabId: two, rate: .5 })
    await send({ action: 'rg:rate', tabId: one, rate: 2 })
    await rateIs(first, 2); await rateIs(second, .5)
    await second.reload(); await rateIs(second, .5)
    await send({ action: 'rg:pin', tabId: two, pinned: false }); await rateIs(second, 2)
  })
  await check('dynamic media and embedded frame inherit global', async () => {
    await first.evaluate(source => {
      const host = document.createElement('div'); document.body.append(host)
      const shadow = host.attachShadow({mode:'open'}); const audio = document.createElement('audio'); audio.src=source; shadow.append(audio)
      const frame = document.createElement('iframe'); frame.src='https://example.org/rg-proof'; document.body.append(frame)
    }, source)
    await first.waitForFunction(() => [...document.querySelectorAll('div')].some(x => x.shadowRoot?.querySelector('audio')?.playbackRate === 2))
    await first.frameLocator('iframe').locator('audio').waitFor({state:'attached'})
    const frame = first.frames().find(f => f.url().includes('example.org'))
    await frame.waitForFunction(() => document.querySelector('audio')?.playbackRate === 2)
  })
  await check('A-B loop, invalid bounds, clear loop', async () => {
    assert.ok((await send({action:'rg:command',tabId:one,command:'loopRange',a:5,b:2})).error)
    const response = await send({action:'rg:command',tabId:one,command:'loopRange',a:1,b:2})
    assert.deepEqual(response.loop, {a:1,b:2})
    await first.evaluate(() => { const v=document.querySelector('video'); v.currentTime=1.9; return v.play() })
    await first.waitForTimeout(800)
    const time = await first.evaluate(() => document.querySelector('video').currentTime)
    assert.ok(time < 2.5, `loop escaped: ${time}`)
    await send({action:'rg:command',tabId:one,command:'clearLoop'})
    assert.equal((await send({action:'rg:get',tabId:one})).media.loop, null)
    await first.evaluate(() => document.querySelector('video').pause())
  })
  await check('shortcuts ignore input and held boost restores', async () => {
    await send({action:'rg:rate',tabId:one,rate:1.5})
    await first.bringToFront()
    await first.locator('input').focus(); await first.keyboard.press('Alt+Shift+D'); await rateIs(first,1.5)
    await first.locator('h1').click(); await first.keyboard.press('Alt+Shift+D'); await rateIs(first,1.6)
    await first.keyboard.down('Alt'); await first.keyboard.down('Shift'); await first.keyboard.down('g'); await rateIs(first,3.2)
    await first.keyboard.up('g'); await first.keyboard.up('Shift'); await first.keyboard.up('Alt'); await rateIs(first,1.6)
  })
  await check('popup UI targets tab and applies preset', async () => {
    const popup = await context.newPage()
    await first.bringToFront()
    await popup.goto(`chrome-extension://${id}/src/popup/index.html`)
    await popup.getByRole('button',{name:'1.5×',exact:true}).click()
    await rateIs(first,1.5)
    await popup.locator('main').screenshot({path:join(output,'popup.png')})
    const dimensions=await popup.locator('main').boundingBox()
    assert.ok(dimensions.width<=800 && dimensions.height<=600)
    assert.ok(await popup.getByText('Ouvrez une vidéo YouTube pour ajouter un marque-page à un moment précis.').isVisible())
    const emptyBox=await popup.locator('.sg-empty-state').boundingBox()
    assert.ok(emptyBox.height >= 100, 'speed card must leave useful space for bookmarks')
    await popup.close()
  })
  await check('options load/save and suspension', async () => {
    await control.reload()
    await control.locator('input[type="number"]').first().fill('1.75')
    await control.getByRole('button',{name:'Enregistrer la lecture'}).click()
    await control.getByText('Réglages de lecture enregistrés.').waitFor()
    assert.equal((await send({action:'rg:context'})).settings.favorite,1.75)
    const addKey = control.locator('.hotkey-input').first().locator('input')
    await addKey.focus(); await addKey.press('Alt+Shift+S')
    await control.getByText('Ce raccourci est déjà utilisé pour la lecture ou un autre marque-page.').waitFor()
    const stored = await control.evaluate(() => chrome.storage.local.get('hotkeys'))
    assert.notEqual(stored.hotkeys?.['add-bookmark'], 'ALT+SHIFT+S')
    await send({action:'rg:settings',settings:{enabled:false}})
    await first.evaluate(() => {document.querySelector('video').playbackRate=1})
    await first.waitForTimeout(300); await rateIs(first,1)
    await send({action:'rg:settings',settings:{enabled:true}}); await rateIs(first,1.5)
  })
  await check('no-media page returns explicit unavailable state', async () => {
    const empty=await context.newPage(); await empty.goto('about:blank'); const emptyId=await tabId(empty)
    const result=await send({action:'rg:get',tabId:emptyId}); assert.equal(result.media,null)
    await empty.close()
  })
  await check('YouTube bookmark pair starts loop and navigation clears stale choices', async () => {
    const url='https://www.youtube.com/watch?v=rgProofVideo'
    await context.route('https://www.youtube.com/watch?v=rgProof*', route=>route.fulfill({contentType:'text/html',body:fixture()}))
    const youtube=await context.newPage(); await youtube.goto(url)
    await youtube.waitForFunction(()=>document.querySelector('video').duration===30)
    await control.evaluate(async url=> {
      await chrome.runtime.sendMessage({action:'addBookmark',bookmark:{url,time:1,note:'Début du passage'}})
      await chrome.runtime.sendMessage({action:'addBookmark',bookmark:{url,time:3,note:'Fin du passage'}})
    },url)
    const popup=await context.newPage(); await youtube.bringToFront()
    await popup.goto(`chrome-extension://${id}/src/popup/index.html`)
    await popup.locator('summary').click()
    await popup.locator('select').nth(0).selectOption('1')
    await popup.locator('select').nth(1).selectOption('3')
    await popup.getByRole('button',{name:'Répéter entre ces marque-pages'}).click()
    await popup.getByText('A 0:01 → B 0:03 · répétition active').waitFor()
    await popup.locator('main').screenshot({path:join(output,'popup-loop.png')})
    await youtube.evaluate(()=>history.pushState({},'', '/watch?v=rgProofNext'))
    await popup.waitForFunction(()=>document.querySelectorAll('select').length===0)
    await popup.close(); await youtube.close()
  })
  if (process.env.PLAYBACK_NATIVE_POPUP === '1') {
    await first.bringToFront()
    try {
      await worker.evaluate(()=>chrome.action.openPopup())
      const popup=context.pages().find(page=>page.url().includes('/src/popup/index.html')) ?? await context.waitForEvent('page',{timeout:5000})
      await popup.getByRole('button',{name:'1.5×',exact:true}).waitFor()
      await popup.screenshot({path:join(output,'native-popup.png')})
      console.log(`NATIVE_POPUP_PASS ${popup.url()}`)
      await popup.close()
    } catch(error) { console.log(`NATIVE_POPUP_LIMIT ${error.message}`) }
  }
  if (process.env.PLAYBACK_PUBLIC_PROOF === '1') {
    for (const url of ['https://www.w3schools.com/html/html5_video.asp', 'https://www.youtube.com/watch?v=5x8Kg8ahxjM']) {
      const page = await context.newPage()
      try {
        await page.goto(url, {waitUntil:'domcontentloaded',timeout:25000})
        await page.locator('video').first().waitFor({state:'attached',timeout:20000})
        const publicId=await tabId(page)
        await send({action:'rg:rate',tabId:publicId,rate:1.25})
        await page.waitForFunction(() => document.querySelector('video')?.playbackRate===1.25)
        const snapshot=await send({action:'rg:get',tabId:publicId})
        assert.equal(snapshot.media.rate,1.25)
        console.log(`PUBLIC_PASS ${url} ${JSON.stringify(snapshot.media)}`)
        await page.screenshot({path:join(output,url.includes('youtube')?'youtube.png':'mdn.png')})
      } catch(error) { console.log(`PUBLIC_LIMIT ${url} ${error.message}`) }
      await page.close()
    }
  }
  console.log(`PROOF_DIR ${output}`)
} catch(error) { failures.push(error); console.error(error) }
finally { await context.close() }
if(failures.length) process.exitCode=1
