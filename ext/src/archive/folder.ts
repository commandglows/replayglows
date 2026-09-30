const DB_NAME = 'replayglows-local-archive'
const STORE_NAME = 'handles'
const FOLDER_KEY = 'chosen-folder'
const STATUS_KEY = 'archiveFolderStatus'
const FOLDER_ID_KEY = 'archiveFolderId'

export type ArchiveFolderStatus = {
  state: 'unsupported' | 'unconfigured' | 'ready' | 'paused'
  folderName?: string
  error?: string
  updatedAt?: number
}

type WritableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
}
type PickerWindow = { showDirectoryPicker?: (options?: { mode?: 'readwrite' }) => Promise<WritableDirectoryHandle> }

export function archiveFolderSupported(): boolean {
  return typeof indexedDB !== 'undefined' && typeof (globalThis as PickerWindow).showDirectoryPicker === 'function'
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(FOLDER_KEY)
      request.onsuccess = () => resolve(request.result as WritableDirectoryHandle | undefined)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(handle, FOLDER_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally { db.close() }
}

export async function setArchiveFolderStatus(status: ArchiveFolderStatus): Promise<ArchiveFolderStatus> {
  const next = { ...status, updatedAt: Date.now() }
  await chrome.storage.local.set({ [STATUS_KEY]: next })
  return next
}

async function permission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  return (handle as WritableDirectoryHandle).queryPermission({ mode: 'readwrite' })
}

export async function getArchiveFolderStatus(): Promise<ArchiveFolderStatus> {
  if (typeof indexedDB === 'undefined') return { state: 'unsupported' }
  try {
    const handle = await readHandle()
    if (!handle) return { state: archiveFolderSupported() ? 'unconfigured' : 'unsupported' }
    const stored = (await chrome.storage.local.get(STATUS_KEY))[STATUS_KEY] as ArchiveFolderStatus | undefined
    const access = await permission(handle)
    if (access !== 'granted') return { state: 'paused', folderName: handle.name, error: 'Folder access needs reconnection.', updatedAt: stored?.updatedAt }
    if (stored?.state === 'paused' && stored.error && stored.error !== 'Folder access needs reconnection.') return { ...stored, folderName: handle.name }
    return { state: 'ready', folderName: handle.name, updatedAt: stored?.updatedAt }
  } catch (error) {
    return { state: 'paused', error: error instanceof Error ? error.message : 'Folder status unavailable.' }
  }
}

// Keep the picker as the first asynchronous operation in a click handler.
export async function chooseArchiveFolder(): Promise<ArchiveFolderStatus> {
  if (!archiveFolderSupported()) return { state: 'unsupported' }
  let handle: WritableDirectoryHandle
  try {
    handle = await (globalThis as PickerWindow).showDirectoryPicker!({ mode: 'readwrite' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return getArchiveFolderStatus()
    throw error
  }
  const access = await handle.queryPermission({ mode: 'readwrite' }) === 'granted'
    ? 'granted'
    : await handle.requestPermission({ mode: 'readwrite' })
  if (access !== 'granted') return getArchiveFolderStatus()
  const previous = await readHandle()
  const sameFolder = previous ? await handle.isSameEntry(previous).catch(() => false) : false
  const existingId = sameFolder ? await archiveFolderId() : undefined
  await saveHandle(handle)
  await chrome.storage.local.set({ [FOLDER_ID_KEY]: existingId ?? crypto.randomUUID() })
  return setArchiveFolderStatus({ state: 'ready', folderName: handle.name })
}

export async function reconnectArchiveFolder(): Promise<ArchiveFolderStatus> {
  const handle = await readHandle()
  if (!handle) return getArchiveFolderStatus()
  const access = await (handle as WritableDirectoryHandle).requestPermission({ mode: 'readwrite' })
  if (access !== 'granted') return getArchiveFolderStatus()
  return setArchiveFolderStatus({ state: 'ready', folderName: handle.name })
}

// Called by the worker only. A worker never asks for permission.
export async function writableArchiveFolder(): Promise<FileSystemDirectoryHandle | undefined> {
  const handle = await readHandle()
  if (!handle) return undefined
  const access = await permission(handle)
  if (access !== 'granted') {
    await setArchiveFolderStatus({ state: 'paused', folderName: handle.name, error: 'Folder access needs reconnection.' })
    return undefined
  }
  return handle
}

export async function hasArchiveFolder(): Promise<boolean> {
  return (await readHandle()) !== undefined
}

export async function archiveFolderId(): Promise<string | undefined> {
  const value = (await chrome.storage.local.get(FOLDER_ID_KEY))[FOLDER_ID_KEY]
  return typeof value === 'string' ? value : undefined
}

export async function writeArchiveFile(folder: FileSystemDirectoryHandle, path: string[], contents: Blob | string): Promise<void> {
  let directory = await folder.getDirectoryHandle('ReplayGlows', { create: true })
  for (const segment of path.slice(0, -1)) directory = await directory.getDirectoryHandle(segment, { create: true })
  const file = await directory.getFileHandle(path.at(-1)!, { create: true })
  const writable = await file.createWritable()
  try { await writable.write(contents); await writable.close() }
  catch (error) { await writable.abort().catch(() => undefined); throw error }
}
