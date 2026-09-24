import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function worker(failure = false) {
  let listener
  const opened = []
  const chrome = {
    runtime: { id: 'test-extension', getURL: path => `chrome-extension://test-extension/${path}`, onMessage: { addListener(fn) { listener = fn } } },
    tabs: { async create(options) { if (failure) throw new Error('Tab creation failed'); opened.push(options) } },
  }
  const exports = {}
  const source = ts.transpileModule(readFileSync(new URL('../src/background/app-navigation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(source, { chrome, exports, URL, URLSearchParams, Error })
  exports.registerAppNavigation()
  const sender = { id: chrome.runtime.id, url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', tab: { id: 12 }, frameId: 0 }
  return { opened, sender, listener, send: (request, from = sender) => new Promise(resolve => listener(request, from, resolve)) }
}
const request = (overrides = {}) => ({ action: 'rg:openApp', route: 'watch', videoId: 'jNQXAC9IVRw', time: 0, ...overrides })

test('opens both internal routes, preserving zero and rounding finite timestamps', async () => {
  const w = worker()
  assert.equal((await w.send(request())).success, true)
  assert.equal((await w.send(request({ route: 'play', time: 12.7, url: 'https://evil.test' }))).success, true)
  assert.deepEqual(w.opened.map(item => item.url), [
    'chrome-extension://test-extension/src/app/index.html#/watch?v=jNQXAC9IVRw&t=0',
    'chrome-extension://test-extension/src/app/index.html#/play?v=jNQXAC9IVRw&t=13',
  ])
})
test('rejects untrusted senders, frames, routes, video identifiers and times without opening tabs', async () => {
  const w = worker()
  for (const from of [
    { ...w.sender, id: 'foreign' }, { ...w.sender, frameId: 1 }, { ...w.sender, frameId: undefined },
    { ...w.sender, url: 'https://www.youtube.com.evil.test/watch' }, { ...w.sender, url: 'http://www.youtube.com/watch' },
    { ...w.sender, url: 'invalid' }, { ...w.sender, tab: undefined },
  ]) assert.equal((await w.send(request(), from)).success, false)
  for (const override of [
    { route: 'preferences' }, { route: '../watch' }, { videoId: '' }, { videoId: 'abcdefghijk&x=1' },
    ...[-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '0', null, undefined].map(time => ({ time })),
  ]) assert.equal((await w.send(request(override))).success, false)
  assert.equal(w.opened.length, 0)
})
test('allows extension pages and reports failed tab creation with explicit failure', async () => {
  const w = worker()
  assert.equal((await w.send(request(), { id: 'test-extension', url: 'chrome-extension://test-extension/src/popup/index.html' })).success, true)
  assert.equal((await w.send(request(), { id: 'test-extension', url: 'chrome-extension://test-extension/src/app/index.html', tab: { id: 13 }, frameId: 0 })).success, true)
  const failure = await worker(true).send(request())
  assert.equal(failure.success, false)
  assert.equal(failure.error, 'Tab creation failed')
})
test('bookmark and playback workers leave app-navigation messages to their owner', () => {
  const listeners = []
  const chrome = { runtime: { id: 'test-extension', onMessage: { addListener(fn) { listeners.push(fn) } } }, tabs: { onRemoved: { addListener() {} } } }
  for (const file of ['../src/background/background.ts', '../src/playback/background.ts']) {
    const exports = {}
    const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    vm.runInNewContext(source, { chrome, exports, require: () => ({}) })
    exports.registerPlaybackBackground?.()
  }
  assert.equal(listeners.length, 2)
  for (const listener of listeners) assert.equal(listener(request(), { id: 'test-extension' }, () => assert.fail('wrong worker responded')), false)
})
test('ignores messages owned by other workers without responding', () => {
  const w = worker()
  for (const req of [null, {}, { action: 'getBookmarks' }, { action: 'rg:rate' }]) {
    assert.equal(w.listener(req, w.sender, () => assert.fail('unexpected response')), false)
  }
})
