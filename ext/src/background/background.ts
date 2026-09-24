import { canonicalUrl, groupBookmarks, normalizeBookmark, normalizeBookmarks, type Bookmark } from '../bookmarks'
import { localizeRuntimeError } from '../runtime-i18n'
// Serialize read/modify/write across tabs; do not cache MV3 worker state.
let pending: Promise<unknown> = Promise.resolve()
let captureSaveQueue: Promise<unknown> = Promise.resolve()
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
  const changedUrls = new Set<string>()
  if (request.action === 'addBookmark') changedUrls.add(normalizeBookmark(request.bookmark).url)
  else if (request.action === 'deleteBookmark' || request.action === 'updateBookmark') {
    const changed = normalizeBookmark(request.bookmark)
    changedUrls.add(changed.url)
    if (request.action === 'updateBookmark' && request.originalTime !== undefined) changedUrls.add(changed.url)
  } else if (request.action === 'deleteVideo') changedUrls.add(canonicalUrl(String(request.url)))
  else if (request.action === 'importBookmarks') {
    for (const item of [...bookmarks, ...next]) changedUrls.add(item.url)
  }
  for (const url of changedUrls) {
    try { await queueMarkdownRefresh(url) } catch { /* Bookmark storage remains authoritative if a file download is unavailable. */ }
  }
  return { success: true, bookmarks: next }
}

function safeCaptureSegment(value: unknown, fallback: string): string {
  const cleaned = String(value ?? '').slice(0, 500)
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
  return cleaned || fallback
}

function markdownText(value: unknown): string {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+.!|>~-]/g, '\\$&').replace(/[\r\n]+/g, ' ').trim()
}

function captureMarkdown(video: Record<string, unknown>, captures: Array<Record<string, unknown>>, bookmarks: Bookmark[]): string {
  const title = markdownText(video.title || video.videoId)
  const videoUrl = String(video.videoUrl)
  const entries = [
    ...captures.map(item => {
    const date = new Date(String(item.capturedAt))
    const captured = Number.isNaN(date.getTime()) ? String(item.capturedAt) : date.toLocaleString('fr-FR')
    const position = String(item.playbackLabel)
    const image = String(item.imagePath).split('/').at(-1) || ''
      return { time: Number(item.playbackTime), html: `### ${position}\n\n![Capture à ${position}](./captures/${encodeURIComponent(image)})  \n*Capture du ${captured}*` }
    }),
    ...bookmarks.filter(item => item.note.trim()).map(item => ({
      time: item.time,
      html: `### ${markdownText(item.formattedTime)}\n\n${markdownText(item.note)}`,
    })),
  ].sort((a, b) => a.time - b.time)
  return `# ${title}\n\nChaîne : ${markdownText(video.channel || 'YouTube')}  \nVidéo : ${videoUrl}\n\n${entries.map(item => item.html).join('\n\n')}${entries.length ? '\n' : ''}`
}

async function queueMarkdownRefresh(url: string): Promise<void> {
  const task = captureSaveQueue.then(() => refreshMarkdownForVideo(url))
  captureSaveQueue = task.catch(() => undefined)
  await task
}

async function refreshMarkdownForVideo(url: string): Promise<void> {
  const videoUrl = canonicalUrl(url)
  const videoId = new URL(videoUrl).searchParams.get('v')!
  const storage = await chrome.storage.local.get(['captureNotesByVideo', 'bookmarks'])
  const indexes = storage.captureNotesByVideo && typeof storage.captureNotesByVideo === 'object' ? storage.captureNotesByVideo as Record<string, Record<string, unknown>> : {}
  const matching = (Array.isArray(storage.bookmarks) ? normalizeBookmarks(storage.bookmarks) : []).filter(item => item.url === videoUrl)
  const previous = indexes[videoId]
  if (!previous && !matching.length) return
  const title = safeCaptureSegment(matching.find(item => item.title)?.title || previous?.title || videoId, videoId)
  const channel = safeCaptureSegment(matching.find(item => item.channel)?.channel || previous?.channel || 'YouTube', 'YouTube')
  const root = String(previous?.root || `ReplayGlows/${channel}/${title} [${videoId}]`)
  const video: Record<string, unknown> = { ...(previous || {}), root, title, channel, videoId, videoUrl }
  indexes[videoId] = video
  await chrome.storage.local.set({ captureNotesByVideo: indexes })
  const captures = Array.isArray(video.captures) ? video.captures as Array<Record<string, unknown>> : []
  const markdown = captureMarkdown(video, captures, matching)
  const id = await chrome.downloads.download({ url: toDataUrl(markdown), filename: `${root}/Notes.md`, conflictAction: 'overwrite', saveAs: false })
  await waitForDownload(id)
}

function toDataUrl(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:text/markdown;base64,${btoa(binary)}`
}

async function waitForDownload(downloadId: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false
    const finish = (error?: Error, filename = '') => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      chrome.downloads.onChanged.removeListener(listener)
      if (error) reject(error)
      else resolve(filename)
    }
    const inspect = async () => {
      try {
        const [item] = await chrome.downloads.search({ id: downloadId })
        if (item?.state === 'complete') finish(undefined, item.filename)
        else if (item?.state === 'interrupted') finish(new Error('Download interrupted'))
      } catch { finish(new Error('Unable to inspect download')) }
    }
    const listener = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id === downloadId && delta.state) void inspect()
    }
    const timeout = setTimeout(() => finish(new Error('Download timed out')), 60000)
    chrome.downloads.onChanged.addListener(listener)
    void inspect()
  })
}

async function saveLocalCapture(capture: Record<string, unknown>) {
  const videoId = String(capture.videoId ?? '')
  const playbackTime = Number(capture.playbackTime)
  const capturedAt = String(capture.capturedAt ?? '')
  const imageDataUrl = String(capture.imageDataUrl ?? '')
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !Number.isFinite(playbackTime) || playbackTime < 0 ||
      !Number.isFinite(Date.parse(capturedAt)) || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl) || imageDataUrl.length > 48_000_000) {
    throw new Error('Invalid capture data')
  }
  if (capture.videoUrl !== `https://www.youtube.com/watch?v=${videoId}`) throw new Error('Invalid capture video URL')
  const captureChannel = safeCaptureSegment(capture.channel, 'YouTube')
  const captureTitle = safeCaptureSegment(capture.title, videoId)
  const date = new Date(capturedAt)
  const dateStamp = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`
  const totalSeconds = Math.floor(playbackTime)
  const playbackLabel = `${String(Math.floor(totalSeconds / 3600)).padStart(2, '0')}-${String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0')}-${String(totalSeconds % 60).padStart(2, '0')}`
  const storage = await chrome.storage.local.get('captureNotesByVideo')
  const indexes = storage.captureNotesByVideo && typeof storage.captureNotesByVideo === 'object' ? storage.captureNotesByVideo as Record<string, Record<string, unknown>> : {}
  const previous = indexes[videoId]
  const root = typeof previous?.root === 'string' && previous.root.startsWith('ReplayGlows/')
    ? previous.root
    : `ReplayGlows/${captureChannel}/${captureTitle} [${videoId}]`
  const channel = typeof previous?.channel === 'string' ? previous.channel : captureChannel
  const title = typeof previous?.title === 'string' ? previous.title : captureTitle
  const existing = previous ? { ...previous, root, channel, title, videoUrl: capture.videoUrl } : { root, channel, title, videoUrl: capture.videoUrl, captures: [] }
  const captures = Array.isArray(existing.captures) ? existing.captures as Array<Record<string, unknown>> : []
  const base = `${dateStamp}_${playbackLabel}`
  let filename = `${base}.png`
  let suffix = 2
  while (captures.some(item => item.filename === filename)) filename = `${base}_${String(suffix++).padStart(2, '0')}.png`
  const requestedImagePath = `${root}/captures/${filename}`
  const imageDownload = await chrome.downloads.download({ url: imageDataUrl, filename: requestedImagePath, conflictAction: 'uniquify', saveAs: false })
  const completedImagePath = await waitForDownload(imageDownload)
  const actualFilename = completedImagePath.split(/[\\/]/).at(-1) || filename
  const imagePath = `${root}/captures/${actualFilename}`
  const nextCaptures = [...captures, { capturedAt, playbackTime, playbackLabel, filename: actualFilename, imagePath }]
  const nextVideo = { ...existing, root, channel, title, videoUrl: capture.videoUrl, captures: nextCaptures }
  indexes[videoId] = nextVideo
  await chrome.storage.local.set({ captureNotesByVideo: indexes })
  const storedBookmarks = await chrome.storage.local.get('bookmarks')
  const videoBookmarks = (Array.isArray(storedBookmarks.bookmarks) ? normalizeBookmarks(storedBookmarks.bookmarks) : []).filter(item => item.url === capture.videoUrl)
  const markdown = captureMarkdown(nextVideo, nextCaptures, videoBookmarks)
  const markdownDownload = await chrome.downloads.download({ url: toDataUrl(markdown), filename: `${root}/Notes.md`, conflictAction: 'overwrite', saveAs: false })
  await waitForDownload(markdownDownload)
  return { success: true, imagePath, markdownPath: `${root}/Notes.md` }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false
  if (request?.action === 'rg:captureLocal') {
    if (!sender.url || new URL(sender.url).origin !== 'https://www.youtube.com') return false
    const task = captureSaveQueue.then(() => saveLocalCapture(request.capture as Record<string, unknown>))
    captureSaveQueue = task.catch(() => undefined)
    void task.then(sendResponse, error => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Local capture download failed' }))
    return true
  }
  if (typeof request?.action === 'string' && request.action.startsWith('rg:')) return false
  const operation = pending.then(() => handle(request))
  pending = operation.catch(() => undefined)
  operation.then(sendResponse, async error => sendResponse({ error: await localizeRuntimeError(error instanceof Error ? error.message : 'Échec de sauvegarde') }))
  return true
})
