import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const protocol = new URL('../src/playback/protocol.ts', import.meta.url).href
const source = (await readFile(new URL('../src/playback/background.ts', import.meta.url), 'utf8')).replace("'./protocol'", JSON.stringify(protocol))
const { registerPlaybackBackground } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`)
const ui = { id: 'test-id', url: 'chrome-extension://test-id/popup.html' }
const page = (tab = 1, frame = 0) => ({ id: 'test-id', url: 'https://example.com/', tab: { id: tab }, frameId: frame })
const media = (kind = 'video', paused = false) => ({ available: true, kind, paused, rate: 1, currentTime: 3, duration: 10, title: 'Test', loop: null, error: '' })
function fixture() {
  const local = {}, session = {}, messages = [], listeners = [], removed = []
  let send = async () => media()
  const area = backing => ({
    get: async key => structuredClone({ [key]: backing[key] }),
    set: async value => { await Promise.resolve(); Object.assign(backing, structuredClone(value)) },
  })
  globalThis.chrome = {
    runtime: { id: 'test-id', getURL: path => `chrome-extension://test-id/${path}`, onMessage: { addListener: cb => listeners.push(cb) } },
    storage: { local: area(local), session: area(session) },
    tabs: {
      onRemoved: { addListener: cb => removed.push(cb) },
      sendMessage: async (tab, request, options) => { messages.push({ tab, ...request, ...options }); return send(tab, request, options) },
    },
  }
  registerPlaybackBackground()
  const request = (action, payload = {}, sender = ui) => new Promise(resolve => {
    if (!listeners.at(-1)({ action, ...payload }, sender, resolve)) resolve('unhandled')
  })
  return { local, session, messages, request, restart: registerPlaybackBackground, close: id => removed.at(-1)(id), respond: cb => { send = cb } }
}

test('shared rate, pinned exceptions, navigation and MV3 restart retain correct ownership', async () => {
  const f = fixture()
  await f.request('rg:register', {}, page(1))
  await f.request('rg:register', {}, page(2))
  await f.request('rg:rate', { tabId: 1, rate: 1.5 })
  await f.request('rg:pin', { tabId: 2, pinned: true })
  await f.request('rg:rate', { tabId: 1, rate: 2 })
  assert.equal((await f.request('rg:context', {}, page(2))).rate, 1.5)
  await f.request('rg:rate', { rate: 0.75 }, page(2))
  assert.equal(f.local.playbackSettings.rate, 2)
  f.restart()
  assert.equal((await f.request('rg:register', {}, page(2))).rate, 0.75)
  assert.equal((await f.request('rg:pin', { tabId: 2, pinned: false })).rate, 2)
  await f.request('rg:pin', { tabId: 2, pinned: true })
  f.close(2)
  await f.request('rg:context', {}, page(1)) // Barrier after asynchronous close.
  assert.equal(f.session.playbackSession.pins[2], undefined)
  assert.equal(f.session.playbackSession.frames[2], undefined)
})

test('sender identity, UI authority, invalid inputs and queue recovery', async () => {
  const f = fixture()
  assert.equal(await f.request('getBookmarks'), 'unhandled')
  assert.equal(await f.request('rg:apply'), 'unhandled')
  assert.ok((await f.request('rg:rate', { tabId: 1, rate: 2 }, { ...ui, id: 'hostile' })).error)
  assert.ok((await f.request('rg:rate', { tabId: 1, rate: 2 }, { ...ui, url: 'https://example.com' })).error)
  assert.ok((await f.request('rg:pin', { tabId: 1, pinned: true }, page())).error)
  assert.ok((await f.request('rg:settings', { settings: { rate: 3 } }, page())).error)
  assert.ok((await f.request('rg:settings', { settings: { enabled: 'no' } }, page())).error)
  for (const value of [NaN, Infinity, 0, 5, '2']) assert.ok((await f.request('rg:rate', { tabId: 1, rate: value })).error)
  assert.ok((await f.request('rg:rate', { tabId: 1, rate: 2, delta: 1 })).error)
  assert.ok((await f.request('rg:settings', { settings: { keys: {} } })).error)
  assert.ok((await f.request('rg:command', { tabId: 1, command: 'loopRange', a: 3, b: 2 })).error)
  await f.request('rg:pin', { tabId: 1, pinned: true })
  await f.request('rg:rate', { tabId: 999, rate: 1.75 }, page(1))
  assert.equal(f.session.playbackSession.pins[1], 1.75)
  assert.equal(f.local.playbackSettings, undefined)
  assert.equal((await f.request('rg:settings', { settings: { enabled: false } }, page())).enabled, false)
})

test('concurrent deltas preserve every update and failed receivers do not abort persistence', async () => {
  const f = fixture()
  await f.request('rg:register', {}, page(1))
  await f.request('rg:register', {}, page(2))
  f.respond(async tab => { if (tab === 2) throw new Error('Closed'); return media() })
  const results = await Promise.all(Array.from({ length: 10 }, () => f.request('rg:rate', { tabId: 1, delta: 0.1 })))
  assert.ok(results.every(result => !result.error))
  assert.equal(f.local.playbackSettings.rate, 2)
  assert.ok(f.messages.some(message => message.tab === 1 && message.action === 'rg:apply' && message.context.rate === 2))
})

test('shortcut modifier order is normalized and equivalent duplicates rejected', async () => {
  const f = fixture()
  const initial = await f.request('rg:context', { tabId: 1 })
  const keys = { ...initial.settings.keys, slower: 'SHIFT+ALT+CTRL+S' }
  const saved = await f.request('rg:settings', { settings: { keys } })
  assert.equal(saved.keys.slower, 'CTRL+ALT+SHIFT+S')
  assert.ok((await f.request('rg:settings', { settings: { keys: { ...keys, faster: 'ALT+SHIFT+CTRL+S' } } })).error)
  assert.equal(f.local.playbackSettings.keys.faster, initial.settings.keys.faster)
})

test('options reads global context without tab and inherited frames require trusted web origin', async () => {
  const f = fixture()
  await f.request('rg:rate', { tabId: 1, rate: 1.5 })
  const global = await f.request('rg:context')
  assert.equal(global.rate, 1.5)
  assert.equal(global.pinned, false)
  for (const url of ['about:blank', 'about:srcdoc', 'blob:https://example.com/id']) {
    assert.equal((await f.request('rg:register', {}, { ...page(), url, origin: 'https://example.com' })).rate, 1.5)
    assert.ok((await f.request('rg:register', {}, { ...page(), url, origin: 'null' })).error)
  }
  assert.ok((await f.request('rg:register', {}, { ...page(), url: 'file:///example.html', origin: 'https://example.com' })).error)
  assert.ok((await f.request('rg:context', {}, { ...page(), tab: {} })).error)
})

test('extension pages opened as tabs retain UI authority and explicit target tab', async () => {
  const f = fixture()
  const optionsTab = { ...ui, url: 'chrome-extension://test-id/options.html', tab: { id: 99 }, frameId: 0 }
  await f.request('rg:register', {}, page(1))
  assert.equal((await f.request('rg:context', {}, optionsTab)).rate, 1)
  await f.request('rg:pin', { tabId: 1, pinned: true }, optionsTab)
  await f.request('rg:rate', { tabId: 1, rate: 1.75 }, optionsTab)
  const result = await f.request('rg:get', { tabId: 1 }, optionsTab)
  assert.equal(result.rate, 1.75)
  assert.equal(result.pinned, true)
  assert.equal(f.session.playbackSession.pins[99], undefined)
  assert.ok((await f.request('rg:register', {}, optionsTab)).error)
})

test('worker rejects bookmark shortcut collisions with defaults and custom modifier order', async () => {
  const f = fixture()
  const keys = (await f.request('rg:context')).settings.keys
  assert.ok((await f.request('rg:settings', { settings: { keys: { ...keys, slower: 'ALT+B' } } })).error)
  assert.equal(f.local.playbackSettings, undefined)
  f.local.hotkeys = { 'add-bookmark': 'SHIFT+CTRL+J' }
  assert.ok((await f.request('rg:settings', { settings: { keys: { ...keys, slower: 'CTRL+SHIFT+J' } } })).error)
  const allowed = await f.request('rg:settings', { settings: { keys: { ...keys, slower: 'ALT+B' } } })
  assert.equal(allowed.keys.slower, 'ALT+B')
})

test('malformed media loop responses are rejected before reaching popup', async () => {
  const f = fixture()
  for (const loop of [undefined, {}, 'loop', { a: NaN, b: 4 }, { a: 3, b: 2 }, { a: 0, b: Infinity }]) {
    await f.request('rg:register', {}, page())
    f.respond(async () => ({ ...media(), loop }))
    assert.equal((await f.request('rg:get', { tabId: 1 })).media, null)
  }
  await f.request('rg:register', {}, page())
  f.respond(async () => ({ ...media(), loop: { a: 2, b: null } }))
  assert.deepEqual((await f.request('rg:get', { tabId: 1 })).media.loop, { a: 2, b: null })
})

test('media polling chooses playing media then video; commands target exact frame', async () => {
  const f = fixture()
  await f.request('rg:register', {}, page(1, 0))
  await f.request('rg:register', {}, page(1, 4))
  f.respond(async (_tab, request, { frameId }) => request.action === 'rg:snapshot' ? media(frameId === 4 ? 'audio' : 'video', frameId === 0) : { success: true })
  assert.equal((await f.request('rg:get', { tabId: 1 })).frameId, 4)
  assert.deepEqual(await f.request('rg:command', { tabId: 1, command: 'rewind' }), { success: true })
  assert.equal(f.messages.at(-1).frameId, 4)
  await f.request('rg:command', { tabId: 999, command: 'markA' }, page(1, 0))
  assert.equal(f.messages.at(-1).tab, 1)
  assert.equal(f.messages.at(-1).frameId, 0)
  f.respond(async (_tab, _request, { frameId }) => media(frameId === 4 ? 'audio' : 'video', false))
  assert.equal((await f.request('rg:get', { tabId: 1 })).frameId, 0)
})

test('failed-frame cleanup cannot erase a registration queued during polling', async () => {
  const f = fixture()
  await f.request('rg:register', {}, page(1, 4))
  let release, entered
  const started = new Promise(resolve => { entered = resolve })
  f.respond(async () => { entered(); await new Promise(resolve => { release = resolve }); throw new Error('Old document gone') })
  const poll = f.request('rg:get', { tabId: 1 })
  await started
  const register = f.request('rg:register', {}, page(1, 4))
  release()
  assert.equal((await poll).media, null)
  await register
  assert.deepEqual(f.session.playbackSession.frames[1], [4])
})
