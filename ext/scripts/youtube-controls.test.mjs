import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../contentscript.js', import.meta.url), 'utf8')
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
    const video = { isConnected: true, currentSrc: 'old', muted: true, paused: false, currentTime: 10, plays: 0, play() { this.plays++; return Promise.resolve() } }
    const location = { pathname: '/watch', href: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' }
    const context = { video, location, URL, player: element(), bar: element(), slider: element(), cancelAnimationFrame() {}, showError() {}, renderRate() {} }
    const factory = vm.runInNewContext(`(function() { let scrub = { source: 'old', identity: '/watch:jNQXAC9IVRw', muted: false, target: 20, committed: 10 }; ${fragment}; return stopScrub; })`, context)
    const release = factory.call({ t: () => 'speed' })
    if (change === 'navigation') location.href = 'https://www.youtube.com/watch?v=aaaaaaaaaaa'
    if (change === 'source') video.currentSrc = 'new'
    if (change === 'detached') video.isConnected = false
    release()
    assert.equal(video.muted, change === 'none' ? false : true, change)
    assert.equal(video.currentTime, change === 'none' ? 20 : 10, change)
    assert.equal(video.paused, false, change)
    assert.equal(video.plays, 0, change)
    release()
    assert.equal(video.plays, 0, 'release never starts playback')
  }
})
