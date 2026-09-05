import test from 'node:test'
import assert from 'node:assert/strict'
import { achieved, confirmsSpeed, key, nextLesson, recordAchievement, withTimeout } from '../src/discovery/state.ts'

test('malformed flags never complete or skip; skipped lessons remain distinct from success', () => {
  const data = { [key('speed')]: 'true', [key('skip.speed')]: 1 }
  assert.equal(achieved(data, 'speed'), false)
  assert.equal(nextLesson(data), 'speed')
  data[key('skip.speed')] = true
  assert.equal(nextLesson(data), 'pin')
  assert.equal(achieved(data, 'speed'), false)
  data[key('speed')] = true
  assert.equal(achieved(data, 'speed'), true)
})
test('speed success requires a change accepted by the actual media, without an error', () => {
  const media = { available: true, rate: 1.5, error: '' }
  assert.equal(confirmsSpeed(1, 1.5, media), true)
  for (const [before, target, value] of [[1.5,1.5,media], [1,2,media], [undefined,1.5,media], [1,1.5,null], [1,1.5,{...media, available:false}], [1,1.5,{...media,error:'Rejected'}]]) {
    assert.equal(confirmsSpeed(before, target, value), false)
  }
})
test('unresponsive operations terminate with retry guidance', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 10), /Réessayez/)
  assert.equal(await withTimeout(Promise.resolve('saved'), 10), 'saved')
})
test('independent concurrent milestones survive worker/UI recreation and storage failure propagates', async () => {
  const data = { bookmarks: [{ note: 'Keep me' }] }
  globalThis.chrome = { storage: { local: {
    get: async name => ({ [name]: data[name] }),
    set: async value => { await Promise.resolve(); Object.assign(data, value) },
  } } }
  await Promise.all(['speed','pin','loop','note','opened','speed'].map(recordAchievement))
  for (const id of ['speed','pin','loop','note','opened']) assert.equal(achieved(data,id),true)
  assert.equal(nextLesson(data), undefined)
  assert.deepEqual(data.bookmarks, [{ note: 'Keep me' }])
  globalThis.chrome.storage.local.get = async () => { throw Error('unavailable') }
  await assert.rejects(recordAchievement('speed'), /unavailable/)
})
