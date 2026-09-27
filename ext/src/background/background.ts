import { canonicalUrl, formatTime, groupBookmarks, normalizeBookmark, normalizeBookmarks, type Bookmark } from '../bookmarks'
import { normalizeResumeVideos } from '../resume-export'
import { localizeRuntimeError } from '../runtime-i18n'
import { archiveFolderId, getArchiveFolderStatus, hasArchiveFolder, setArchiveFolderStatus, writableArchiveFolder, writeArchiveFile } from '../archive/folder'
// Serialize read/modify/write across tabs; do not cache MV3 worker state.
let pending: Promise<unknown> = Promise.resolve()
let captureSaveQueue: Promise<unknown> = Promise.resolve()
let resumePending: Promise<unknown> = Promise.resolve()
let archivePending: Promise<unknown> = Promise.resolve()
type ResumeVideo = { url: string; title: string; position: number; duration: number; lastAccess: number; completed: boolean; dismissed?: boolean }
async function handleResume(request: Record<string, unknown>, sender: chrome.runtime.MessageSender) {
  const action = String(request.action)
  const ui = sender.url?.startsWith(chrome.runtime.getURL('')) === true
  const youtube = sender.frameId === 0 && sender.url?.startsWith('https://www.youtube.com/') === true
  if ((!ui && !youtube) || sender.tab?.incognito) throw new Error('Émetteur non autorisé.')
  const data = await chrome.storage.local.get(['resumeVideos', 'bookmarks'])
  const records = data.resumeVideos && typeof data.resumeVideos === 'object' ? data.resumeVideos as Record<string, ResumeVideo> : {}
  const write = async (next: Record<string, ResumeVideo>) => { await chrome.storage.local.set({ resumeVideos: next }); return { success: true } }
  if (action === 'resume:list') return { videos: Object.values(records) }
  if (action === 'resume:progress') {
    if (!youtube || typeof request.url !== 'string' || typeof request.title !== 'string' || typeof request.position !== 'number' || typeof request.duration !== 'number' || typeof request.completed !== 'boolean') throw new Error('Progression invalide.')
    const url = canonicalUrl(request.url)
    if (![request.position, request.duration].every(Number.isFinite) || request.duration <= 0 || request.position < 0 || request.position > request.duration + 2) throw new Error('Progression invalide.')
    const previous = records[url]
    if (previous?.dismissed && request.started !== true) return { success: true }
    const bookmarks = Array.isArray(data.bookmarks) ? normalizeBookmarks(data.bookmarks) : []
    const hasBookmarks = bookmarks.some(item => item.url === url)
    const next = { ...records }
    if (request.completed && !hasBookmarks) delete next[url]
    else next[url] = { url, title: request.title.slice(0, 500), position: Math.min(request.position, request.duration), duration: request.duration, lastAccess: Date.now(), completed: request.completed }
    return write(next)
  }
  if (!ui || typeof request.url !== 'string') throw new Error('Action réservée au popup.')
  const url = canonicalUrl(request.url)
  if (action === 'resume:dismiss') return write({ ...records, [url]: { ...(records[url] ?? { url, title: '', position: 0, duration: 0, lastAccess: Date.now(), completed: false }), dismissed: true } })
  if (action === 'resume:open') {
    const record = records[url]
    const position = record?.completed ? 0 : record?.position ?? 0
    const next = { ...records }
    if (record) next[url] = { ...record, lastAccess: Date.now(), dismissed: false }
    await chrome.storage.local.set({ resumeVideos: next })
    const tabs = await chrome.tabs.query({ url: `${url}*` })
    const existing = tabs.find(tab => typeof tab.id === 'number')
    if (existing?.id !== undefined) {
      await chrome.tabs.update(existing.id, { active: true })
      if (typeof existing.windowId === 'number') await chrome.windows.update(existing.windowId, { focused: true })
      if (position > 0) await chrome.tabs.sendMessage(existing.id, { action: 'resume:seek', position }).catch(() => undefined)
    } else await chrome.tabs.create({ url: position > 0 ? `${url}&t=${Math.floor(position)}s` : url })
    return { success: true }
  }
  throw new Error('Action non reconnue.')
}
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
  const importedProgress = request.action === 'importBookmarks' && Object.hasOwn(request, 'resumeVideos')
    ? normalizeResumeVideos(request.resumeVideos)
    : undefined
  await chrome.storage.local.set({
    bookmarks: next,
    groupedBookmarks: groupBookmarks(next),
    ...(importedProgress === undefined ? {} : { resumeVideos: Object.fromEntries(importedProgress.map(video => [video.url, video])) }),
  })
  const changedUrls = new Set<string>()
  if (request.action === 'addBookmark' || request.action === 'updateBookmark' || request.action === 'deleteBookmark') {
    changedUrls.add(normalizeBookmark(request.bookmark).url)
  } else if (request.action === 'deleteVideo') changedUrls.add(canonicalUrl(String(request.url)))
  else if (request.action === 'importBookmarks') {
    for (const item of [...bookmarks, ...next]) changedUrls.add(item.url)
  }
  // The browser profile is authoritative. A failed archive mirror must not fail a saved note.
  await queueArchive(async () => {
    for (const url of changedUrls) await mirrorVideo(url, bookmarks.find(item => item.url === url))
  }).catch(() => undefined)
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

function captureMarkdown(video: Record<string, unknown>, captures: Array<Record<string, unknown>>, bookmarks: Bookmark[], destination: string, progress?: { position: number; duration: number }): string {
  const title = markdownText(video.title || video.videoId)
  const videoUrl = String(video.videoUrl)
  const entries = [
    ...captures.filter(item => item.destination === destination || (destination === 'downloads' && item.destination === undefined)).map(item => {
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
  const progressSection = progress && progress.duration > 0
    ? `\n\n## Vidéo en cours\n\n[Reprendre à ${formatTime(progress.position)} / ${formatTime(progress.duration)}](${videoUrl}&t=${Math.floor(progress.position)}s)`
    : ''
  return `# ${title}\n\nChaîne : ${markdownText(video.channel || 'YouTube')}  \nVidéo : ${videoUrl}${progressSection}\n\n${entries.map(item => item.html).join('\n\n')}${entries.length ? '\n' : ''}`
}

function queueArchive<T>(task: () => Promise<T>): Promise<T> {
  const next = archivePending.then(task)
  archivePending = next.catch(() => undefined)
  return next
}

function archiveVideoPath(videoId: string, channel: unknown, title: unknown): string[] {
  return [safeCaptureSegment(channel, 'YouTube'), `${safeCaptureSegment(title, videoId)} [${videoId}]`]
}

async function mirrorVideo(url: string, oldBookmark?: Bookmark): Promise<boolean> {
  let folder: FileSystemDirectoryHandle | undefined
  try { folder = await writableArchiveFolder() }
  catch (error) {
    await setArchiveFolderStatus({ state: 'paused', error: error instanceof Error ? error.message : 'Archive unavailable.' })
    return false
  }
  if (!folder) return false
  try {
    const videoUrl = canonicalUrl(url)
    const videoId = new URL(videoUrl).searchParams.get('v')!
    const storage = await chrome.storage.local.get(['captureNotesByVideo', 'bookmarks', 'resumeVideos'])
    const indexes = storage.captureNotesByVideo && typeof storage.captureNotesByVideo === 'object' ? storage.captureNotesByVideo as Record<string, Record<string, unknown>> : {}
    const previous = indexes[videoId]
    const matching = (Array.isArray(storage.bookmarks) ? normalizeBookmarks(storage.bookmarks) : []).filter(item => item.url === videoUrl)
    const sample = matching[0] ?? oldBookmark
    if (!sample && !previous) return true
    const channel = previous?.channel || sample?.channel || 'YouTube'
    const title = previous?.title || sample?.title || videoId
    const path = archiveVideoPath(videoId, channel, title)
    const video: Record<string, unknown> = { ...(previous ?? {}), channel, title, videoId, videoUrl }
    if (!previous) {
      indexes[videoId] = video
      await chrome.storage.local.set({ captureNotesByVideo: indexes })
    }
    const captures = Array.isArray(video.captures) ? video.captures as Array<Record<string, unknown>> : []
    const progress = (storage.resumeVideos as Record<string, { position?: number; duration?: number; completed?: boolean }> | undefined)?.[videoUrl]
    const progressPosition = progress && !progress.completed && typeof progress.position === 'number' && typeof progress.duration === 'number'
      ? { position: progress.position, duration: progress.duration }
      : undefined
    const destination = `folder:${await archiveFolderId() ?? 'legacy-folder'}`
    await writeArchiveFile(folder, [...path, 'Notes.md'], captureMarkdown(video, captures, matching, destination, progressPosition))
    await setArchiveFolderStatus({ state: 'ready', folderName: folder.name })
    return true
  } catch (error) {
    await setArchiveFolderStatus({ state: 'paused', folderName: folder.name, error: error instanceof Error ? error.message : 'Archive write failed.' })
    return false
  }
}

async function refreshArchive(): Promise<{ success: boolean; status: Awaited<ReturnType<typeof getArchiveFolderStatus>> }> {
  const storage = await chrome.storage.local.get(['bookmarks', 'captureNotesByVideo'])
  const urls = new Set<string>((Array.isArray(storage.bookmarks) ? normalizeBookmarks(storage.bookmarks) : []).map(item => item.url))
  const indexes = storage.captureNotesByVideo && typeof storage.captureNotesByVideo === 'object' ? storage.captureNotesByVideo as Record<string, Record<string, unknown>> : {}
  for (const [videoId, video] of Object.entries(indexes)) {
    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) urls.add(`https://www.youtube.com/watch?v=${videoId}`)
  }
  for (const url of urls) {
    if (!await mirrorVideo(url)) break
  }
  const status = await getArchiveFolderStatus()
  return { success: status.state === 'ready', status }
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
  const channel = typeof previous?.channel === 'string' ? previous.channel : captureChannel
  const title = typeof previous?.title === 'string' ? previous.title : captureTitle
  const path = archiveVideoPath(videoId, channel, title)
  const root = `ReplayGlows/${path.join('/')}`
  const existing = previous ? { ...previous, root, channel, title, videoUrl: capture.videoUrl } : { root, channel, title, videoUrl: capture.videoUrl, captures: [] }
  const captures = Array.isArray(existing.captures) ? existing.captures as Array<Record<string, unknown>> : []
  const base = `${dateStamp}_${playbackLabel}`
  let filename = `${base}.png`
  let suffix = 2
  while (captures.some(item => item.filename === filename)) filename = `${base}_${String(suffix++).padStart(2, '0')}.png`
  const requestedImagePath = `${root}/captures/${filename}`
  let folder: FileSystemDirectoryHandle | undefined
  try { folder = await writableArchiveFolder() }
  catch (error) {
    await setArchiveFolderStatus({ state: 'paused', error: error instanceof Error ? error.message : 'Folder access unavailable.' })
    throw new Error('Archive folder unavailable. Reconnect it in extension settings.')
  }
  if (!folder && await hasArchiveFolder()) throw new Error('Archive folder access was removed. Reconnect it in extension settings before saving a capture.')
  const destination = folder ? `folder:${await archiveFolderId() ?? 'legacy-folder'}` : 'downloads'
  let actualFilename = filename
  if (folder) {
    try {
      const imageBlob = await (await fetch(imageDataUrl)).blob()
      await writeArchiveFile(folder, [...path, 'captures', filename], imageBlob)
    } catch (error) {
      await setArchiveFolderStatus({ state: 'paused', folderName: folder.name, error: error instanceof Error ? error.message : 'Capture archive failed.' })
      throw error
    }
  } else {
    const imageDownload = await chrome.downloads.download({ url: imageDataUrl, filename: requestedImagePath, conflictAction: 'uniquify', saveAs: false })
    const completedImagePath = await waitForDownload(imageDownload)
    actualFilename = completedImagePath.split(/[\\/]/).at(-1) || filename
  }
  const imagePath = `${root}/captures/${actualFilename}`
  const nextCaptures = [...captures, { capturedAt, playbackTime, playbackLabel, filename: actualFilename, imagePath, destination }]
  const nextVideo = { ...existing, root, channel, title, videoUrl: capture.videoUrl, captures: nextCaptures }
  indexes[videoId] = nextVideo
  await chrome.storage.local.set({ captureNotesByVideo: indexes })
  const storedBookmarks = await chrome.storage.local.get(['bookmarks', 'resumeVideos'])
  const videoBookmarks = (Array.isArray(storedBookmarks.bookmarks) ? normalizeBookmarks(storedBookmarks.bookmarks) : []).filter(item => item.url === capture.videoUrl)
  const resumeVideos = storedBookmarks.resumeVideos && typeof storedBookmarks.resumeVideos === 'object' ? storedBookmarks.resumeVideos as Record<string, { position?: number; duration?: number; completed?: boolean }> : {}
  const progress = resumeVideos[canonicalUrl(capture.videoUrl)]
  const progressPosition = progress && !progress.completed && typeof progress.position === 'number' && typeof progress.duration === 'number'
    ? { position: progress.position, duration: progress.duration }
    : undefined
  const markdown = captureMarkdown(nextVideo, nextCaptures, videoBookmarks, destination, progressPosition)
  if (folder) {
    try {
      await writeArchiveFile(folder, [...path, 'Notes.md'], markdown)
      await setArchiveFolderStatus({ state: 'ready', folderName: folder.name })
    } catch (error) {
      await setArchiveFolderStatus({ state: 'paused', folderName: folder.name, error: error instanceof Error ? error.message : 'Capture index failed.' })
      throw error
    }
  } else {
    const markdownDownload = await chrome.downloads.download({ url: toDataUrl(markdown), filename: `${root}/Notes.md`, conflictAction: 'overwrite', saveAs: false })
    await waitForDownload(markdownDownload)
  }
  return { success: true, imagePath, markdownPath: `${root}/Notes.md` }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false
  if (request?.action === 'archive:status' || request?.action === 'archive:refresh') {
    if (!sender.url?.startsWith(chrome.runtime.getURL('')) || sender.tab?.incognito) return false
    const task = request.action === 'archive:status'
      ? getArchiveFolderStatus().then(status => ({ success: true, status }))
      : queueArchive(refreshArchive)
    void task.then(sendResponse, error => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Archive unavailable.' }))
    return true
  }
  if (typeof request?.action === 'string' && request.action.startsWith('resume:')) {
    const operation = resumePending.then(() => handleResume(request, sender))
    resumePending = operation.catch(() => undefined)
    operation.then(sendResponse, error => sendResponse({ error: error instanceof Error ? error.message : 'Échec de la progression.' }))
    return true
  }
  if (request?.action === 'rg:captureLocal') {
    if (!sender.url || new URL(sender.url).origin !== 'https://www.youtube.com') return false
    const task = captureSaveQueue.then(() => queueArchive(() => saveLocalCapture(request.capture as Record<string, unknown>)))
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
