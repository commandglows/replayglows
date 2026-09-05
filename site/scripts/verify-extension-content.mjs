import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const base = process.env.SITE_PROOF_URL
assert.ok(base, 'SITE_PROOF_URL must be a verified managed or hosted URL')
const output = process.env.SITE_PROOF_DIR
if (output) mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM, headless: true })
const pairs = [
  ['/extension', '/fr/extension'],
  ['/extension/guide', '/fr/extension/guide'],
  ['/blog/review-a-video-passage', '/fr/blog/reviser-un-passage-video'],
]
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    for (const pair of pairs) for (const [i, route] of pair.entries()) {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' })
      assert.equal(new URL(page.url()).origin, new URL(base).origin, 'Hosted access redirected away from the site; authenticate in the approved browser before verification')
      assert.equal(response.status(), 200, route)
      assert.equal(await page.locator('main h1').count(), 1, route)
      assert.equal(await page.locator('html').getAttribute('lang'), i ? 'fr' : 'en')
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://replayglows.com' + route)
      assert.equal(await page.locator(`link[hreflang="${i ? 'en' : 'fr'}"]`).getAttribute('href'), 'https://replayglows.com' + pair[1-i])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow: ${route} at ${width}`)
      assert.equal(await page.locator('a[href*="chromewebstore"]').count(), 0)
      assert.ok((await page.locator('main').innerText()).includes(i ? 'installation publique' : 'Public installation'))
      for (const href of await page.locator('main a[href^="/"]').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
        const result = await page.request.get(base + href)
        assert.equal(result.status(), 200, `Broken link ${route} -> ${href}`)
      }
      assert.equal(errors.length, 0, errors.join(' | '))
      if (output) await page.screenshot({ path: `${output}/${width}-${route.replaceAll('/', '_')}.png`, fullPage: true })
      console.log(`PASS ${width} ${route}`)
    }
    await page.goto(base + '/blog', { waitUntil: 'networkidle' })
    for (const route of pairs[2]) assert.ok(await page.locator(`a[href="${route}"]`).count())
    await page.goto(base + '/', { waitUntil: 'networkidle' })
    if (width < 768) await page.locator('#mobile-menu-btn').click()
    assert.ok(await page.locator('a[href="/extension"]').count())
    await page.close()
  }
  console.log('PASS six routes, locale alternates, responsive layout, blog discovery, links and browser errors')
} finally { await browser.close() }
