export interface Bookmark {
  url: string
  time: number
  formattedTime: string
  note: string
  title?: string
}
export function canonicalUrl(value: string): string {
  const url = new URL(value)
  const id = url.searchParams.get('v')
  if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) || url.pathname !== '/watch' || !id || !/^[\w-]+$/.test(id)) throw new Error('URL vidéo YouTube invalide')
  return `https://www.youtube.com/watch?v=${id}`
}
export function formatTime(time: number): string {
  const seconds = Math.round(time)
  const minutes = Math.floor(seconds / 60)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
export function normalizeBookmark(input: unknown): Bookmark {
  if (!input || typeof input !== 'object') throw new Error('Marque-page invalide')
  const b = input as Record<string, unknown>
  const time = b.time ?? b.timestamp
  const url = b.url ?? (typeof b.videoId === 'string' ? `https://www.youtube.com/watch?v=${b.videoId}` : undefined)
  if (typeof url !== 'string' || typeof time !== 'number' || !Number.isFinite(time) || time < 0 || (b.note !== undefined && typeof b.note !== 'string') || (b.title !== undefined && typeof b.title !== 'string')) throw new Error('Marque-page invalide : URL, temps ou note')
  return { url: canonicalUrl(url), time, formattedTime: formatTime(time), note: (b.note as string | undefined) ?? '', ...(typeof b.title === 'string' ? { title: b.title } : {}) }
}
export function normalizeBookmarks(input: unknown): Bookmark[] {
  if (!Array.isArray(input)) throw new Error('Le fichier doit contenir une liste de marque-pages')
  const unique = new Map<string, Bookmark>()
  for (const item of input) {
    const bookmark = normalizeBookmark(item)
    unique.set(`${bookmark.url}:${bookmark.time}`, bookmark)
  }
  return [...unique.values()]
}
export function groupBookmarks(bookmarks: Bookmark[]) {
  const groups: Record<string, { url: string; title: string; bmList: Bookmark[] }> = {}
  for (const b of bookmarks) {
    groups[b.url] ??= { url: b.url, title: b.title || 'Vidéo YouTube', bmList: [] }
    groups[b.url].bmList.push(b)
  }
  return groups
}
export function markdownBookmarks(bookmarks: Bookmark[]): string {
  const escape = (s: string) => s.replace(/[\\[\]()*_`<>]/g, '\\$&').replace(/\r?\n/g, ' ')
  return bookmarks.map(b => `- [${escape(b.title || b.formattedTime)}](${b.url}&t=${b.time}s) - ${escape(b.note)}`).join('\n')
}
