import { canonicalUrl, groupBookmarks, normalizeBookmark, normalizeBookmarks, type Bookmark } from '../bookmarks'
// Serialize read/modify/write across tabs; do not cache MV3 worker state.
let pending: Promise<unknown> = Promise.resolve()
async function handle(request: Record<string, unknown>) {
  const result = await chrome.storage.local.get('bookmarks')
  const bookmarks: Bookmark[] = normalizeBookmarks(result.bookmarks ?? [])
  if (request.action === 'getBookmarks') return { bookmarks }
  if (request.action === 'getGroupedBookmarks') return { groupedBookmarks: groupBookmarks(bookmarks) }
  let next: Bookmark[]
  if (request.action === 'addBookmark') {
    const b = normalizeBookmark(request.bookmark)
    if (bookmarks.some(item => item.url === b.url && item.time === b.time)) throw new Error('Un marque-page existe déjà à ce moment. Modifiez sa note dans la liste.')
    next = [...bookmarks, b]
  } else if (request.action === 'deleteBookmark' || request.action === 'updateBookmark') {
    const b = normalizeBookmark(request.bookmark)
    const originalTime = request.originalTime ?? b.time
    const index = bookmarks.findIndex(item => item.url === b.url && item.time === originalTime)
    if (index < 0) throw new Error('Ce marque-page n’existe plus. Rechargez la liste.')
    next = bookmarks.filter((_, i) => i !== index)
    if (request.action === 'updateBookmark') {
      if (next.some(item => item.url === b.url && item.time === b.time)) throw new Error('Un marque-page existe déjà à ce moment.')
      next.splice(index, 0, b)
    }
  } else if (request.action === 'deleteVideo') {
    const url = canonicalUrl(String(request.url))
    next = bookmarks.filter(b => b.url !== url)
  } else if (request.action === 'importBookmarks') next = normalizeBookmarks(request.bookmarks)
  else throw new Error('Action non reconnue')
  await chrome.storage.local.set({ bookmarks: next, groupedBookmarks: groupBookmarks(next) })
  return { success: true, bookmarks: next }
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false
  if (typeof request?.action === 'string' && request.action.startsWith('rg:')) return false
  const operation = pending.then(() => handle(request))
  pending = operation.catch(() => undefined)
  operation.then(sendResponse, error => sendResponse({ error: error instanceof Error ? error.message : 'Échec de sauvegarde' }))
  return true
})
