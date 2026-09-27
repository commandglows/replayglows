import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

if (!process.env.PLAYWRIGHT_MODULE || !process.env.PLAYWRIGHT_CHROMIUM) {
  throw new Error('PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM are required')
}
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const extension = resolve('dist')
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'rg-archive-')), {
  executablePath: process.env.PLAYWRIGHT_CHROMIUM,
  headless: true,
  args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension],
})

try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const page = await context.newPage()
  await page.goto('chrome-extension://' + new URL(worker.url()).host + '/src/options/options.html?welcome=1')
  await page.getByRole('heading', { name: /Bienvenue dans ReplayGlows|Welcome to ReplayGlows/ }).waitFor()
  const state = await page.evaluate(async () => {
    const downloads = []
    chrome.downloads.onCreated.addListener(item => downloads.push(item.id))
    const response = await chrome.runtime.sendMessage({
      action: 'addBookmark',
      bookmark: { url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', time: 0, note: 'Archive check', title: 'Example', channel: 'Example' },
    })
    const saved = (await chrome.storage.local.get('bookmarks')).bookmarks
    return { picker: typeof window.showDirectoryPicker, response, saved, downloads }
  })
  assert.equal(state.response?.success, true)
  assert.equal(state.saved?.length, 1)
  assert.deepEqual(state.downloads, [], 'ordinary note save must not start a browser download')
  console.log(JSON.stringify({ picker: state.picker, welcome: true, noteSaved: true, downloads: 0 }))
} finally {
  await context.close()
}
