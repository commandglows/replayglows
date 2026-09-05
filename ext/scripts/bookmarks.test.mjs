import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { normalizeBookmark, normalizeBookmarks, groupBookmarks, markdownBookmarks } from '../src/bookmarks.ts'
const fixture = (time = 0, id = 'jNQXAC9IVRw') => ({ url: `https://www.youtube.com/watch?v=${id}`, time, note: '<img src=x onerror=alert(1)>' })
test('legacy and options formats retain zero, canonical URL, text and grouping', () => {
  const b = normalizeBookmark({ ...fixture(), url: fixture().url + '&t=7', title: 'Title' })
  assert.equal(b.time, 0)
  assert.equal(b.formattedTime, '0:00')
  assert.equal(b.url, fixture().url)
  assert.equal(groupBookmarks([b])[b.url].bmList.length, 1)
  assert.equal(normalizeBookmark({ timestamp: 0, videoId: 'jNQXAC9IVRw', note: 'hello' }).time, 0)
  assert.ok(markdownBookmarks([b]).includes('&t=0s'))
  assert.ok(markdownBookmarks([b]).includes('\\<img'))
})
test('imports reject unsafe URL, malformed records, negative and non-finite times atomically', () => {
  for (const bad of [null, {}, { ...fixture(), time: -1 }, { ...fixture(), time: Infinity }, { ...fixture(), url: 'javascript:alert(1)' }, { ...fixture(), url: 'https://evil.test/watch?v=x' }]) assert.throws(() => normalizeBookmarks([fixture(), bad]))
  assert.equal(normalizeBookmarks([fixture(), fixture()]).length, 1)
})
async function worker(storage) {
  let listener
  const domain = { normalizeBookmark, normalizeBookmarks, groupBookmarks, canonicalUrl: (await import('../src/bookmarks.ts')).canonicalUrl }
  const chrome = {
    runtime: { id: 'test-extension', onMessage: { addListener(fn) { listener = fn } } },
    storage: { local: {
      async get() { await new Promise(resolve => setTimeout(resolve, 2)); return structuredClone(storage) },
      async set(value) { Object.assign(storage, structuredClone(value)) },
    } },
  }
  const source = ts.transpileModule(readFileSync(new URL('../src/background/background.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(source, { chrome, exports: {}, require: () => domain, Promise, Error })
  return request => new Promise(resolve => listener(request, { id: 'test-extension' }, resolve))
}
test('concurrent tabs, update/delete identity, worker restart, invalid import preserve data', async () => {
  const storage = { bookmarks: [] }
  let send = await worker(storage)
  await Promise.all([send({ action: 'addBookmark', bookmark: fixture(0) }), send({ action: 'addBookmark', bookmark: fixture(5) }), send({ action: 'addBookmark', bookmark: fixture(5, 'otherVideo') })])
  assert.equal(storage.bookmarks.length, 3)
  assert.ok((await send({ action: 'addBookmark', bookmark: { ...fixture(0), note: 'replacement' } })).error)
  assert.notEqual(storage.bookmarks[0].note, 'replacement')
  await send({ action: 'deleteBookmark', bookmark: fixture(5) })
  assert.equal(storage.bookmarks.length, 2)
  assert.ok(storage.bookmarks.some(b => b.url.includes('otherVideo')))
  await send({ action: 'updateBookmark', bookmark: { ...fixture(2), note: 'edited' }, originalTime: 0 })
  assert.ok(storage.bookmarks.some(b => b.time === 2 && b.note === 'edited'))
  send = await worker(storage)
  assert.equal((await send({ action: 'getBookmarks' })).bookmarks.length, 2)
  const before = structuredClone(storage)
  assert.ok((await send({ action: 'importBookmarks', bookmarks: [fixture(), null] })).error)
  assert.deepEqual(storage, before)
  await send({ action: 'addBookmark', bookmark: fixture(9) })
  assert.equal(storage.bookmarks.length, 3, 'failure must not poison queue')
})
test('content navigation shortcuts use per-video timestamps and never repeat while typing', async () => {
  const listeners = {}
  const document = { addEventListener(name, fn) { listeners[name] = fn } }
  const chrome = { storage: { local: { async get() { return {} } }, onChanged: { addListener() {} } } }
  const context = { document, chrome, AbortController, window: { location: { pathname: '/watch', href: fixture().url } }, URL }
  const source = readFileSync(new URL('../contentscript.js', import.meta.url), 'utf8')
  const lastInit = source.lastIndexOf('YouTubeBookmarker.init();')
  vm.runInNewContext(source.slice(0, lastInit) + 'globalThis.subject = YouTubeBookmarker;', context)
  const subject = context.subject
  subject.state.currentVideo = { currentTime: 3 }
  subject.state.bookmarksForThisUrl = [fixture(0), fixture(9)]
  await subject.navigateBookmarks('next')
  assert.equal(subject.state.currentVideo.currentTime, 9)
  await subject.navigateBookmarks('prev')
  assert.equal(subject.state.currentVideo.currentTime, 0)
  let added = 0
  subject.addBookmark = () => { added++ }
  await subject.setupHotkeys()
  const event = { key: 'b', code: 'KeyB', altKey: true, target: { closest: () => null }, preventDefault() {}, stopPropagation() {} }
  listeners.keydown(event)
  listeners.keydown({ ...event, repeat: true })
  listeners.keydown({ ...event, target: { closest: () => ({}) } })
  assert.equal(added, 1)
})
test('a delayed save never closes or resumes a replacement note editor', async () => {
  let resolveSave
  const saveResponse = new Promise(resolve => { resolveSave = resolve })
  const document = { title: 'Public test - YouTube', querySelector: () => null, addEventListener() {} }
  const chrome = { runtime: { sendMessage: () => saveResponse }, storage: { onChanged: { addListener() {} } } }
  const context = { document, chrome, window: { location: { pathname: '/watch', href: fixture().url } }, URL }
  const source = readFileSync(new URL('../contentscript.js', import.meta.url), 'utf8')
  vm.runInNewContext(source.slice(0, source.lastIndexOf('YouTubeBookmarker.init();')) + 'globalThis.subject = YouTubeBookmarker;', context)
  const subject = context.subject
  subject.generation = 1
  subject.state.currentVideo = { currentTime: 0 }
  subject.state.bookmarkInputContainer = { name: 'original' }
  let closed = 0
  subject.closeBookmarkInput = async () => { closed++ }
  subject.refreshBookmarks = async () => {}
  subject.afficherMessage = () => {}
  const saving = subject.saveBookmark('original note')
  const replacement = { name: 'unsaved replacement' }
  subject.generation = 2
  subject.state.currentVideo = { currentTime: 5 }
  subject.state.bookmarkInputContainer = replacement
  resolveSave({ success: true })
  await saving
  assert.equal(closed, 0)
  assert.equal(subject.state.bookmarkInputContainer, replacement)
  await subject.saveBookmark('replacement note')
  assert.equal(closed, 1, 'a save for the current editor still closes it')
})
