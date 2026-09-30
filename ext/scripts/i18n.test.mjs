import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../src/i18n.ts', import.meta.url), 'utf8')
const content = await readFile(new URL('../contentscript.js', import.meta.url), 'utf8')
const parsed = ts.createSourceFile('i18n.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
const messagesDeclaration = parsed.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText() === 'messages'))
const messagesObject = messagesDeclaration.declarationList.declarations.find(item => item.name.getText() === 'messages').initializer.expression
const localeKeys = name => messagesObject.properties.find(item => item.name.getText() === name).initializer.properties.map(item => item.name.getText()).sort()
test('French and English application dictionaries have identical keys', () => {
  assert.deepEqual(localeKeys('fr'), localeKeys('en')); assert.ok(localeKeys('fr').length > 70)
})
test('automatic locale resolves French browser languages and otherwise English', () => {
  const resolve = (value, languages) => value === 'fr' || value === 'en' ? value : languages.some(item => item.toLowerCase().startsWith('fr')) ? 'fr' : 'en'
  assert.equal(resolve('auto', ['fr-FR']), 'fr'); assert.equal(resolve('auto', ['de-DE']), 'en'); assert.equal(resolve('en', ['fr-FR']), 'en')
})
test('language preference is persisted and observed live', () => {
  assert.match(source, /chrome\.storage\.local\.set\(\{ \[STORAGE_KEY\]: value \}\)/); assert.match(source, /chrome\.storage\.onChanged\.addListener/)
})
test('YouTube controls expose matching bilingual strings and react live', () => {
  const keys = block => [...block.matchAll(/(?:^|, )([a-zA-Z][a-zA-Z0-9]+):\s*'/g)].map(match => match[1]).sort()
  const fr = content.match(/fr: \{([^\n]+)\}/)?.[1] ?? ''; const en = content.match(/en: \{([^\n]+)\}/)?.[1] ?? ''
  assert.deepEqual(keys(fr), keys(en)); assert.match(content, /if \(changes\.language\) YouTubeBookmarker\.init\(\)/)
})
