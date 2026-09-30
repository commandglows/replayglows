import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { computed, ref } from 'vue'
import * as bookmarks from '../src/bookmarks.ts'

const record = time => bookmarks.normalizeBookmark({ url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', time, note: 'saved' })
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function harness() {
  let data = [record(0), record(5)]
  const messages = []
  const reads = []
  let unmount
  const source = readFileSync(new URL('../src/app/views/LocalLibrary.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const compiled = ts.transpileModule(source + '\nglobalThis.state = { bookmarks, editing, note, busy, error, loadError, draftDeleted, groups, load, startEdit, cancelEdit, saveEdit, mutate, onStorage };', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const context = {
    exports: {},
    require: id => id === 'vue' ? { computed, ref, onMounted() {}, onUnmounted(fn) { unmount = fn } } : id === '@/bookmarks' ? bookmarks : { useAppI18n: () => ({ t: key => key }) },
    chrome: {
      runtime: { sendMessage(message) { const request = deferred(); messages.push({ ...request, message }); return request.promise } },
      storage: { local: { get() { return reads.length ? reads.shift().promise : Promise.resolve({ bookmarks: structuredClone(data) }) } }, onChanged: { removeListener() {} } },
    },
  }
  vm.runInNewContext(compiled, context)
  return { state: context.state, messages, reads, setData(next) { data = next }, unmount: () => unmount() }
}

test('storage refresh retains draft identity and keeps externally deleted draft reachable', async () => {
  const h = harness(); const s = h.state
  await s.load(); s.startEdit(s.bookmarks.value[0]); s.note.value = 'draft'
  h.setData([{ ...record(0), note: 'external' }, record(5)])
  await s.load()
  assert.equal(s.note.value, 'draft')
  assert.equal(s.editing.value.time, s.groups.value[0].bmList[0].time)
  h.setData([]); await s.load()
  assert.equal(s.groups.value[0].bmList[0].time, 0)
  assert.equal(s.draftDeleted.value, true)
  s.saveEdit(); assert.equal(h.messages.length, 0)
  s.cancelEdit()
  assert.equal(s.groups.value.length, 0)
})

test('a recovered load clears only its own error', async () => {
  const h = harness(); const s = h.state
  const failed = deferred(); h.reads.push(failed)
  const pending = s.load(); failed.reject(new Error('storage unavailable')); await pending
  assert.equal(s.loadError.value, 'local.loadError')
  s.error.value = 'common.error'
  await s.load()
  assert.equal(s.loadError.value, ''); assert.equal(s.error.value, 'common.error')
})

test('old save cannot close another editor or discard edits typed while saving', async () => {
  const h = harness(); const s = h.state
  await s.load(); s.startEdit(record(0)); s.note.value = 'submitted'
  const first = s.mutate('updateBookmark', { ...record(0), note: s.note.value })
  s.startEdit(record(5)); s.note.value = 'other draft'
  h.messages[0].resolve({ success: true }); await first
  assert.equal(s.editing.value.time, 5); assert.equal(s.note.value, 'other draft')
  const second = s.mutate('updateBookmark', { ...record(5), note: s.note.value })
  s.note.value = 'newer draft'
  h.messages[1].resolve({ success: true }); await second
  assert.equal(s.editing.value.time, 5); assert.equal(s.note.value, 'newer draft')
})

test('pending state is per record and duplicate requests are ignored', async () => {
  const h = harness(); const s = h.state
  const first = s.mutate('deleteBookmark', record(0))
  await s.mutate('deleteBookmark', record(0))
  const second = s.mutate('deleteBookmark', record(5))
  assert.equal(h.messages.length, 2); assert.equal(s.busy.value.size, 2)
  h.messages[0].resolve({ success: true }); await first
  assert.equal(s.busy.value.size, 1)
  h.messages[1].resolve(undefined); await second
  assert.equal(s.busy.value.size, 0); assert.equal(s.error.value, 'common.error')
})

test('canceling and reopening the same record starts a new editor session', async () => {
  const h = harness(); const s = h.state
  await s.load(); s.startEdit(record(0))
  const pending = s.mutate('updateBookmark', record(0))
  s.cancelEdit(); s.startEdit(record(0))
  h.messages[0].resolve({ success: true }); await pending
  assert.equal(s.editing.value.time, 0)
})

test('late storage reads and responses after unmount cannot replace current state', async () => {
  const h = harness(); const s = h.state
  const stale = deferred(); h.reads.push(stale)
  const pending = s.load()
  h.setData([record(5)]); await s.load()
  stale.resolve({ bookmarks: [record(0)] }); await pending
  assert.equal(s.bookmarks.value[0].time, 5)
  const afterUnmount = deferred(); h.reads.push(afterUnmount)
  const last = s.load(); h.unmount()
  afterUnmount.resolve({ bookmarks: [] }); await last
  assert.equal(s.bookmarks.value.length, 1)
})
