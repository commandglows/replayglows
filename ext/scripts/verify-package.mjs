import { readFileSync, statSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'))
const files = new Set([
  manifest.action?.default_popup,
  manifest.background?.service_worker,
  manifest.options_page,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons ?? {}),
  ...manifest.content_scripts?.flatMap(script => [...script.js ?? [], ...script.css ?? []]) ?? [],
  ...manifest.web_accessible_resources?.flatMap(entry => entry.resources) ?? [],
].filter(Boolean))

const failures = []
for (const file of files) {
  const target = resolve(root, file)
  const path = relative(root, target)
  if (isAbsolute(path) || path.startsWith('..')) {
    failures.push(`${file}: outside package`)
    continue
  }
  try {
    if (!statSync(target).isFile()) failures.push(`${file}: not a file`)
  } catch {
    failures.push(`${file}: missing`)
  }
}
if (failures.length) {
  throw new Error(`Invalid extension package:\n${failures.join('\n')}`)
}
console.log(`Extension package verified: ${files.size} manifest resources exist.`)
