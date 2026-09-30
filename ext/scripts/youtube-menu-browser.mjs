import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
  await page.setContent('<style>#player{position:relative;width:100%;height:100%;background:#222}html,body{margin:0;height:100%}#trigger{position:absolute;bottom:5px;right:5px}</style><div id="player"><button id="trigger">RG</button></div>')
  await page.addStyleTag({ content: readFileSync(new URL('../src/styles/styles-youtube.css', import.meta.url), 'utf8') })
  const source = readFileSync(new URL('../contentscript.js', import.meta.url), 'utf8')
  await page.evaluate(code => {
    window.chrome = { storage: { onChanged: { addListener() {} } } }
    window.calls = []
    eval(code + '\nwindow.subject = YouTubeBookmarker;')
    subject.events = new AbortController()
    subject.state.bookmarkButton = document.querySelector('#trigger')
    subject.openInApp = route => window.calls.push(route)
    subject.setupOverflowMenu()
  }, source.slice(0, source.lastIndexOf('YouTubeBookmarker.init();')))
  async function assertBounds() {
    await page.waitForTimeout(160)
    const menu = await page.locator('.rg-yt-menu').boundingBox()
    const viewport = page.viewportSize()
    assert.ok(menu.x >= 0 && menu.y >= 0 && menu.x + menu.width <= viewport.width && menu.y + menu.height <= viewport.height, JSON.stringify(menu))
  }
  await page.locator('#trigger').hover()
  await assertBounds()
  await page.getByRole('menuitem', { name: 'Open in the local app' }).click()
  assert.deepEqual(await page.evaluate(() => window.calls), ['watch'])
  await page.locator('#trigger').evaluate(button => button.addEventListener('click', () => document.querySelector('#player').requestFullscreen(), { once: true }))
  await page.locator('#trigger').click()
  await page.waitForFunction(() => document.fullscreenElement?.id === 'player')
  await page.locator('#trigger').hover()
  await page.locator('#trigger').dispatchEvent('mouseenter')
  await assertBounds()
  assert.equal(await page.locator('.rg-yt-menu').evaluate(menu => document.fullscreenElement.contains(menu)), true)
  await page.getByRole('menuitem', { name: 'Open in the cloud' }).click()
  assert.deepEqual(await page.evaluate(() => window.calls), ['watch', 'play'])
  await page.evaluate(() => document.exitFullscreen())
  await page.waitForFunction(() => !document.fullscreenElement)
  assert.equal(await page.locator('.rg-yt-menu').evaluate(menu => menu.parentElement === document.body), true)
  await page.setViewportSize({ width: 180, height: 120 })
  await page.locator('#trigger').hover()
  await assertBounds()
  await page.evaluate(() => subject.events.abort())
  assert.equal(await page.locator('.rg-yt-menu').evaluate(menu => menu.classList.contains('rg-yt-menu--open')), false)
  console.log('PASS: source menu in Chromium fixture: viewport bounds, real fullscreen, local/cloud clicks, exit, tiny viewport, abort.')
} finally { await browser.close() }
