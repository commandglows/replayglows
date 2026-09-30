import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../contentscript.js', import.meta.url), 'utf8')
const scriptFile = ts.createSourceFile('contentscript.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
const methods = new Map()
function findBookmarker(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(scriptFile) === 'YouTubeBookmarker' && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
    for (const property of node.initializer.properties) {
      if (ts.isMethodDeclaration(property) && property.name) methods.set(property.name.getText(scriptFile), property.getText(scriptFile))
    }
  }
  ts.forEachChild(node, findBookmarker)
}
findBookmarker(scriptFile)
function runMethod(name, context = {}) {
  const method = methods.get(name)
  assert.ok(method, `production method ${name} exists`)
  return vm.runInNewContext(`({ ${method} }).${name}`, context)
}
function element() {
  const classes = new Set()
  return {
    style: {}, children: [], listeners: {}, offsetWidth: 234, offsetHeight: 140,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
    setAttribute() {}, removeAttribute() {},
    addEventListener(name, fn) { this.listeners[name] = fn },
    appendChild(child) { child.parentNode = this; this.children.push(child) },
    contains(child) { return child === this || this.children.includes(child) },
    getBoundingClientRect() { return { left: 480, top: 260, bottom: 290 } },
  }
}
test('scrub release restores mute only on the same connected video and never changes playback state', () => {
  const fragment = source.slice(source.indexOf('    const videoIdentity ='), source.indexOf('    let pointerAttached ='))
  for (const change of ['none', 'navigation', 'source', 'detached']) {
    const video = { isConnected: true, currentSrc: 'old', muted: true, paused: false, currentTime: 10, plays: 0, play() { this.plays++; return Promise.resolve() }, removeEventListener() {} }
    const location = { pathname: '/watch', href: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' }
    const seekCalls = []
    const context = { video, location, URL, player: element(), bar: element(), slider: element(), cancelAnimationFrame() {}, clearTimeout() {}, showError() {}, renderRate() {} }
    const factory = vm.runInNewContext(`(function() { let scrub = { source: 'old', identity: '/watch:jNQXAC9IVRw', muted: false, target: 20, committed: 10 }; ${fragment}; return stopScrub; })`, context)
    const release = factory.call({ t: () => 'speed', seekVideo: (time, target) => { seekCalls.push({ time, target }); target.currentTime = time } })
    if (change === 'navigation') location.href = 'https://www.youtube.com/watch?v=aaaaaaaaaaa'
    if (change === 'source') video.currentSrc = 'new'
    if (change === 'detached') video.isConnected = false
    release()
    assert.equal(video.muted, change === 'none' ? false : true, change)
    assert.equal(video.currentTime, change === 'none' ? 20 : 10, change)
    assert.equal(video.paused, false, change)
    assert.equal(video.plays, 0, change)
    assert.deepEqual(seekCalls.map(call => call.time), change === 'none' ? [20] : [])
    if (change === 'none') assert.equal(seekCalls[0].target, video)
    release()
    assert.equal(video.plays, 0, 'release never starts playback')
  }
})

test('superseded navigation initialization cannot overwrite the latest locale or reset state', async () => {
  const reads = []
  const removed = { count: 0, remove() { this.count++ } }
  const calls = []
  const fixture = {
    generation: 0,
    speedBarVisibilityRevision: 0,
    speedBarVisible: false,
    locale: 'en',
    currentUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    state: { bookmarkInputContainer: removed },
    events: new AbortController(),
    dragCleanup() { calls.push('drag cleanup'); this.dragCleanup = null },
    restoreBookmarkPlayback() { calls.push('restore playback') },
    waitForYouTubePlayer: async () => ({ player: true }),
    async resetState(player) {
      calls.push(`reset ${this.generation}`)
      this.state = { player, currentVideo: { isConnected: true } }
    },
    async addBookmarkButton() { calls.push(`button ${this.generation}`) },
    setupSpeedBar() {}, setupVideoSplits() {}, setupOverflowMenu() {},
    async setupHotkeys() {}, async updateUIElements() {}, setupEventListeners() {},
  }
  const context = {
    chrome: { storage: { local: { get: () => new Promise(resolve => reads.push(resolve)) } } },
    navigator: { languages: ['en-US'] },
    window: { location: { pathname: '/watch' } },
    document: { querySelectorAll: () => [] },
    clearTimeout() {},
    setTimeout() { return 1 },
    AbortController,
  }
  const init = runMethod('init', context)
  const oldInit = init.call(fixture)
  const currentInit = init.call(fixture)
  reads[1]({ language: 'fr', speedBarVisible: true })
  await currentInit
  reads[0]({ language: 'en', speedBarVisible: false })
  await oldInit

  assert.equal(fixture.locale, 'fr')
  assert.equal(fixture.speedBarVisible, true)
  assert.equal(fixture.generation, 2)
  assert.equal(removed.count, 1, 'the superseded initialization does not remove current state again')
  assert.deepEqual(calls, ['drag cleanup', 'restore playback', 'restore playback', 'reset 2', 'button 2'])
})

test('bookmark editor cleanup resumes only its captured playing video and clears editor state', () => {
  const video = { isConnected: true, paused: true, resumes: 0, play() { this.resumes++; return Promise.resolve() } }
  const input = { remove() { this.removed = true } }
  const instance = {
    bookmarkVideo: video,
    bookmarkUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    bookmarkWasPlaying: true,
    currentUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    state: { bookmarkInputContainer: input, bookmarkInputElement: {}, bookmarkContainerVisible: true, bookmarkTime: 40, wasPlayingBeforeBookmark: true },
  }
  runMethod('restoreBookmarkPlayback').call(instance)
  assert.equal(video.resumes, 1)
  assert.equal(input.removed, true)
  assert.equal(instance.state.bookmarkInputContainer, null)
  assert.equal(instance.state.bookmarkInputElement, null)
  assert.equal(instance.state.bookmarkContainerVisible, false)
  assert.equal(instance.bookmarkVideo, null)

  const alreadyPlaying = { isConnected: true, paused: false, resumes: 0, play() { this.resumes++ } }
  instance.bookmarkVideo = alreadyPlaying
  instance.bookmarkUrl = instance.currentUrl
  instance.bookmarkWasPlaying = true
  runMethod('restoreBookmarkPlayback').call(instance)
  assert.equal(alreadyPlaying.resumes, 0, 'cleanup never calls play for media that was not paused')

  const replaced = { isConnected: false, paused: true, resumes: 0, play() { this.resumes++ } }
  instance.bookmarkVideo = replaced
  instance.bookmarkUrl = instance.currentUrl
  instance.bookmarkWasPlaying = true
  runMethod('restoreBookmarkPlayback').call(instance)
  assert.equal(replaced.resumes, 0, 'a detached previous video is never restarted')

  const reused = { isConnected: true, paused: true, resumes: 0, play() { this.resumes++ } }
  instance.bookmarkVideo = reused
  instance.bookmarkUrl = 'https://www.youtube.com/watch?v=old-video'
  instance.bookmarkWasPlaying = true
  runMethod('restoreBookmarkPlayback').call(instance)
  assert.equal(reused.resumes, 0, 'a reused player node is not restarted for a different video')
})

test('bookmark marker refresh cancels active drag listeners and cannot persist stale position', async () => {
  const docListeners = new Map()
  const messages = []
  const document = {
    addEventListener(name, fn) { const list = docListeners.get(name) ?? new Set(); list.add(fn); docListeners.set(name, list) },
    removeEventListener(name, fn) { docListeners.get(name)?.delete(fn) },
    fire(name, event) { for (const fn of [...(docListeners.get(name) ?? [])]) fn(event) },
  }
  function node(rect = { left: 20, width: 10, top: 0, bottom: 10, right: 30 }) {
    const classes = new Set()
    return {
      style: {}, children: [], listeners: new Map(), dataset: {},
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      setAttribute() {}, appendChild(child) { child.parentNode = this; this.children.push(child) },
      addEventListener(name, fn) { this.listeners.set(name, fn) },
      remove() { this.removed = true },
      contains(target) { return this === target || this.children.some(child => child.contains?.(target)) },
      getBoundingClientRect() { return rect },
    }
  }
  document.createElement = () => node()
  const progressBar = node({ left: 0, width: 100, top: 0, bottom: 10, right: 100 })
  const video = { duration: 100, currentTime: 20 }
  const instance = {
    generation: 1,
    state: { progressBar, currentVideo: video, player: node() },
    CONSTANTS: { BOOKMARK_ICON_CONTAINER_CLASS: 'bookmark-container', BOOKMARK_ICON_CLASS: 'bookmark-icon', BOOKMARK_DELETE_ICON_CLASS: 'delete-icon' },
    t: key => key, formatTime: time => String(time),
    refreshBookmarks: async () => {}, deleteBookmark() {},
  }
  const context = { document, chrome: { runtime: { sendMessage: async message => { messages.push(message); return {} } } } }
  await runMethod('addBookmarkIcon', context).call(instance, { time: 20, note: '' })
  const marker = progressBar.children[0]
  marker.listeners.get('mousedown')({ button: 0, target: marker, clientX: 20, stopPropagation() {}, preventDefault() {} })
  assert.equal(docListeners.get('mousemove').size, 1)
  const staleMouseUp = [...docListeners.get('mouseup')][0]
  document.fire('mousemove', { clientX: 80 })
  assert.notEqual(marker.style.left, '20%')

  instance.CONSTANTS.BOOKMARK_ICON_CONTAINER_CLASS = 'bookmark-container'
  instance.state.bookmarksForThisUrl = []
  instance.state.player = { querySelectorAll: () => [marker] }
  await runMethod('loadBookmarks', context).call(instance)
  assert.equal(marker.removed, true, 'refresh replaces the prior marker')
  assert.equal(docListeners.get('mousemove').size, 0)
  assert.equal(docListeners.get('mouseup').size, 0)
  assert.equal(marker.classList.contains('dragging'), false)
  assert.equal(marker.style.left, '20%')
  document.fire('mouseup', {})
  assert.equal(messages.length, 0, 'removed mouseup listener cannot save the old position')

  instance.generation++
  await staleMouseUp({})
  assert.equal(messages.length, 0, 'stale pointer release cannot update the old bookmark')
})

test('initialization discards a storage response that finishes after resetState started on a newer page', async () => {
  const storageReads = []
  const resets = []
  const calls = []
  const fixture = {
    generation: 0, speedBarVisibilityRevision: 0, state: {},
    currentUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    dragCleanup: null, restoreBookmarkPlayback() {},
    waitForYouTubePlayer: async () => ({}),
    resetState(player) {
      this.state = { player, currentVideo: { isConnected: true } }
      return new Promise(resolve => resets.push({ generation: this.generation, resolve }))
    },
    async addBookmarkButton() { calls.push(`button ${this.generation}`) },
    setupSpeedBar() {}, setupVideoSplits() {}, setupOverflowMenu() {},
    async setupHotkeys() {}, async updateUIElements() {}, setupEventListeners() {},
  }
  const context = {
    chrome: { storage: { local: { get: () => new Promise(resolve => storageReads.push(resolve)) } } },
    navigator: { languages: ['en-US'] }, window: { location: { pathname: '/watch' } },
    document: { querySelectorAll: () => [] }, clearTimeout() {}, setTimeout() { return 1 },
    AbortController,
  }
  const init = runMethod('init', context)
  const oldInit = init.call(fixture)
  storageReads[0]({ language: 'en' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(resets.length, 1)
  const currentInit = init.call(fixture)
  storageReads[1]({ language: 'fr' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(resets.length, 2)
  resets[1].resolve()
  await currentInit
  resets[0].resolve()
  await oldInit
  assert.deepEqual(resets.map(reset => reset.generation), [1, 2])
  assert.deepEqual(calls, ['button 2'], 'the stale continuation stops before installing controls')
})

test('player readiness polling stops on abort and is bounded by its timeout', async () => {
  for (const ending of ['abort', 'timeout']) {
    const controller = new AbortController()
    const scheduled = { intervals: [], timeouts: [], cleared: [] }
    const context = {
      document: { querySelector: () => null, querySelectorAll: () => [] },
      window: { location: { pathname: '/watch' } },
      setInterval(fn, ms) { scheduled.intervals.push({ fn, ms }); return 'interval' },
      clearInterval(id) { scheduled.cleared.push(id) },
      setTimeout(fn, ms) { scheduled.timeouts.push({ fn, ms }); return 'timeout' },
      clearTimeout(id) { scheduled.cleared.push(id) },
    }
    const instance = { events: controller, generation: 4, state: {}, currentUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' }
    const wait = runMethod('waitForYouTubePlayer', context).call(instance, 4, 250)
    assert.equal(scheduled.timeouts[0].ms, 250)
    if (ending === 'abort') controller.abort()
    else scheduled.timeouts[0].fn()
    assert.equal(await wait, null, ending)
    assert.ok(scheduled.cleared.includes('interval'), `${ending}: interval is cleared`)
    assert.ok(scheduled.cleared.includes('timeout'), `${ending}: timeout is cleared`)
  }
})
