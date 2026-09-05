import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const compiled = ts.transpileModule(readFileSync(new URL('../src/playback/media.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText

async function harness() {
  class Events {
    listeners = new Map()
    addEventListener(name, fn) {
      const list = this.listeners.get(name) ?? []
      list.push(fn)
      this.listeners.set(name, list)
    }
    fire(name, values = {}) {
      const event = { preventDefault() { this.defaultPrevented = true }, composedPath: () => [], ...values }
      for (const fn of this.listeners.get(name) ?? []) fn(event)
      return event
    }
  }
  class Element extends Events {
    tagName = 'DIV'
    isConnected = true
    isContentEditable = false
    children = []
    scans = 0
    querySelectorAll() {
      this.scans++
      const flatten = elements => elements.flatMap(child => [child, ...flatten(child.children)])
      return flatten(this.children)
    }
    contains(target) { return this.children.some(child => child === target || child.contains(target)) }
    getBoundingClientRect() { return { width: 640, height: 360 } }
  }
  class Media extends Element {
    tagName = 'VIDEO'
    playbackRate = 1
    currentTime = 10
    duration = 100
    currentSrc = 'https://media.test/video.mp4'
    paused = false
    ended = false
    seeking = false
    async play() { this.paused = false }
    pause() { this.paused = true }
  }
  class Document extends Events {
    children = []
    hidden = false
    title = 'Test video'
    scans = 0
    querySelectorAll() { this.scans++; return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]) }
  }
  const video = new Media()
  const document = new Document()
  document.children.push(video)
  const window = new Events()
  const sent = [], timeouts = [], intervals = []
  const context = {
    rate: 1.5, pinned: false,
    settings: { rate: 1.5, favorite: 2.5, step: 0.1, enabled: true, keys: {
      slower: 'ALT+SHIFT+S', faster: 'ALT+SHIFT+D', reset: 'ALT+SHIFT+R',
      favorite: 'ALT+SHIFT+F', boost: 'ALT+SHIFT+G', markA: 'ALT+SHIFT+A',
      markB: 'ALT+SHIFT+B', clearLoop: 'ALT+SHIFT+C', suspend: 'ALT+SHIFT+V',
    } },
  }
  let observer, receiver
  const location = { href: 'https://media.test/watch' }
  vm.runInNewContext(compiled, {
    exports: {}, document, window, location,
    Element, HTMLElement: Element, HTMLMediaElement: Media,
    getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
    MutationObserver: class { constructor(callback) { observer = callback } observe() {} },
    setTimeout: fn => timeouts.push(fn), setInterval: (fn, ms) => intervals.push({ fn, ms }),
    chrome: { runtime: { id: 'test-extension',
      sendMessage: async message => { sent.push(message); return context },
      onMessage: { addListener: fn => { receiver = fn } },
    } },
  })
  await new Promise(resolve => setImmediate(resolve))
  const request = message => {
    let response
    receiver(message, { id: 'test-extension' }, value => { response = value })
    return response
  }
  const key = (name, values = {}) => document.fire(name, {
    key: 'G', code: 'KeyG', altKey: true, shiftKey: true, ...values,
  })
  return {
    video, document, window, sent, location, context, Media, Element, intervals, key,
    snapshot: () => request({ action: 'rg:snapshot' }),
    command: (command, extra = {}) => request({ action: 'rg:control', command, ...extra }),
    apply: next => request({ action: 'rg:apply', context: next }),
    mutate: (addedNodes = []) => { observer([{ addedNodes }]); while (timeouts.length) timeouts.shift()() },
  }
}

test('logical AZERTY shortcuts match options and editable/repeated keys stay untouched', async () => {
  const h = await harness()
  const before = h.sent.length
  h.key('keydown', { key: 'A', code: 'KeyQ' })
  assert.equal(h.snapshot().loop.a, 10)
  h.key('keydown', { key: 'D', repeat: true })
  const input = new h.Element(); input.tagName = 'INPUT'
  h.key('keydown', { key: 'D', composedPath: () => [input] })
  assert.equal(h.sent.length, before)
  h.key('keydown', { key: 'D', code: 'KeyE' })
  assert.equal(h.sent.at(-1).action, 'rg:rate')
  assert.equal(h.sent.at(-1).delta, 0.1)
})

test('held boost restores on physical key release, blur and suspension', async () => {
  const h = await harness()
  h.key('keydown', { code: 'KeyH' })
  assert.equal(h.video.playbackRate, 3)
  h.key('keyup', { key: 'g', code: 'KeyH', altKey: false, shiftKey: false })
  assert.equal(h.video.playbackRate, 1.5)
  h.key('keydown')
  h.window.fire('blur')
  assert.equal(h.video.playbackRate, 1.5)
  h.key('keydown')
  h.apply({ ...h.context, settings: { ...h.context.settings, enabled: false } })
  assert.equal(h.video.playbackRate, 1.5)
  h.video.playbackRate = 1
  h.video.fire('play')
  assert.equal(h.video.playbackRate, 1)
})

test('A-B repeats then clears on outside seek, media source and SPA navigation', async () => {
  const h = await harness()
  h.command('loopRange', { a: 10, b: 20 })
  h.video.currentTime = 20
  h.video.fire('timeupdate')
  assert.equal(h.video.currentTime, 10)
  h.video.currentTime = 30
  h.video.fire('seeking')
  assert.equal(h.snapshot().loop, null)
  h.command('loopRange', { a: 10, b: 20 })
  h.video.currentSrc = 'https://media.test/next.mp4'
  h.video.fire('loadedmetadata')
  assert.equal(h.snapshot().loop, null)
  h.command('loopRange', { a: 10, b: 20 })
  h.location.href += '?next=1'
  assert.equal(h.snapshot().loop, null)
  assert.ok(h.command('loopRange', { a: 30, b: 20 }).error)
})

test('subtree discovery avoids rescanning document and reinsertions do not duplicate handlers', async () => {
  const h = await harness()
  const originalListeners = h.video.listeners.get('play').length
  const originalScans = h.document.scans
  h.video.isConnected = false
  h.document.children = []
  h.mutate()
  assert.equal(h.snapshot().available, false)
  h.video.isConnected = true
  h.document.children = [h.video]
  h.mutate([h.video])
  assert.equal(h.video.listeners.get('play').length, originalListeners)
  assert.equal(h.document.scans, originalScans)
  const wrapper = new h.Element(), added = new h.Media()
  wrapper.children = [added]
  h.document.children.push(wrapper)
  h.mutate([wrapper])
  assert.equal(added.playbackRate, 1.5)
  assert.equal(h.document.scans, originalScans)
  assert.equal(h.intervals[0].ms, 10000)
})

test('site rate overrides are surfaced without rate fighting', async () => {
  const h = await harness()
  h.video.playbackRate = 1
  h.video.fire('ratechange')
  assert.equal(h.video.playbackRate, 1)
  assert.ok(h.snapshot().error)
})

test('boost at a fast base rate accelerates up to the limit and restores the base', async () => {
  const h = await harness()
  h.apply({ ...h.context, rate: 3 })
  h.key('keydown')
  assert.equal(h.video.playbackRate, 4)
  assert.equal(h.snapshot().error, '')
  h.video.fire('play')
  assert.equal(h.video.playbackRate, 4)
  h.key('keyup')
  assert.equal(h.video.playbackRate, 3)
})

test('playing media wins over paused video, with video preferred among playing media', async () => {
  const h = await harness()
  h.video.paused = true
  const audio = new h.Media()
  audio.tagName = 'AUDIO'
  h.document.children.push(audio)
  h.mutate([audio])
  assert.equal(h.snapshot().kind, 'audio')
  h.video.paused = false
  h.video.fire('play')
  assert.equal(h.snapshot().kind, 'video')
})
