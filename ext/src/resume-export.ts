import { canonicalUrl, formatTime, type Bookmark } from './bookmarks'

export interface ResumeVideo {
  url: string
  title: string
  position: number
  duration: number
  lastAccess: number
  completed: boolean
  dismissed?: boolean
}

export function normalizeResumeVideos(input: unknown): ResumeVideo[] {
  if (!Array.isArray(input)) throw new Error('La progression doit être une liste de vidéos.')
  const unique = new Map<string, ResumeVideo>()
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Progression vidéo invalide.')
    const video = item as Record<string, unknown>
    if (typeof video.url !== 'string' || typeof video.title !== 'string'
      || typeof video.position !== 'number' || !Number.isFinite(video.position) || video.position < 0
      || typeof video.duration !== 'number' || !Number.isFinite(video.duration) || video.duration < 0
      || typeof video.lastAccess !== 'number' || !Number.isFinite(video.lastAccess) || video.lastAccess < 0
      || typeof video.completed !== 'boolean'
      || (video.dismissed !== undefined && typeof video.dismissed !== 'boolean')
      || (video.duration > 0 && video.position > video.duration + 2)) {
      throw new Error('Progression vidéo invalide.')
    }
    const url = canonicalUrl(video.url)
    unique.set(url, {
      url,
      title: video.title.slice(0, 500),
      position: video.duration > 0 ? Math.min(video.position, video.duration) : video.position,
      duration: video.duration,
      lastAccess: video.lastAccess,
      completed: video.completed,
      ...(video.dismissed === true ? { dismissed: true } : {}),
    })
  }
  return [...unique.values()]
}

export function markdownBookmarksAndHistory(bookmarks: Bookmark[], resumeVideos: ResumeVideo[]): string {
  const escape = (value: string) => value.replace(/[\\\[\]()*_`<>]/g, '\\$&').replace(/\r?\n/g, ' ')
  const sections: string[] = []
  if (bookmarks.length) {
    sections.push(`## Marque-pages\n\n${bookmarks.map(bookmark =>
      `- [${escape(bookmark.title || bookmark.formattedTime)}](${bookmark.url}&t=${bookmark.time}s) - ${escape(bookmark.note)}`,
    ).join('\n')}`)
  }
  const inProgress = resumeVideos
    .filter(video => !video.completed && video.duration > 0)
    .sort((a, b) => b.lastAccess - a.lastAccess)
  if (inProgress.length) {
    sections.push(`## Vidéos en cours de lecture\n\n${inProgress.map(video => {
      const percent = Math.min(100, Math.round(video.position / video.duration * 100))
      return `- [${escape(video.title || 'Vidéo YouTube')}](${video.url}&t=${Math.floor(video.position)}s) — ${formatTime(video.position)} / ${formatTime(video.duration)} (${percent} %)`
    }).join('\n')}`)
  }
  return sections.join('\n\n')
}
