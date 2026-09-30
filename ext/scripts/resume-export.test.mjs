import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { canonicalUrl, formatTime } from '../src/bookmarks.ts'

const source = ts.transpileModule(readFileSync(new URL('../src/resume-export.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const context = { exports: {}, require: () => ({ canonicalUrl, formatTime }) }
vm.runInNewContext(source, context)
const { markdownBookmarksAndHistory, normalizeResumeVideos } = context.exports

const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'

test('Markdown exports current video positions including hidden profiles and omits completed entries', () => {
  const history = normalizeResumeVideos([
    { url, title: 'Cours [partie 1]', position: 45, duration: 100, lastAccess: 3, completed: false },
    { url: 'https://www.youtube.com/watch?v=abcdefghijk', title: 'hidden', position: 20, duration: 100, lastAccess: 2, completed: false, dismissed: true },
    { url: 'https://www.youtube.com/watch?v=lmnopqrstuv', title: 'done', position: 100, duration: 100, lastAccess: 1, completed: true },
  ])

  const markdown = markdownBookmarksAndHistory([], history)
  assert.match(markdown, /## Vidéos en cours de lecture/)
  assert.ok(markdown.includes('Cours \\[partie 1\\]'))
  assert.match(markdown, /\?v=jNQXAC9IVRw&t=45s/)
  assert.match(markdown, /45 \/ 1:40 \(45 %\)/)
  assert.match(markdown, /hidden/)
  assert.doesNotMatch(markdown, /done/)
})

test('JSON history normalization canonicalizes URLs and rejects invalid positions', () => {
  const records = normalizeResumeVideos([
    { url: `${url}&t=12`, title: 'Video', position: 101, duration: 100, lastAccess: 0, completed: false },
  ])
  assert.equal(records[0].url, url)
  assert.equal(records[0].position, 100)
  assert.throws(() => normalizeResumeVideos([
    { url, title: 'Bad', position: 150, duration: 100, lastAccess: 0, completed: false },
  ]))
})
