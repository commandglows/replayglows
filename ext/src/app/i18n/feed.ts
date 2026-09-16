// Feed view localization. French keys are the source of truth; English mirrors them.
export const messages = {
  fr: {
    'feed.title': 'Bibliothèque',
    'feed.keepWatching': 'Reprendre la lecture',
    'feed.allVideos': 'Toutes les vidéos',
    'feed.resume': 'Reprendre',
    'feed.resumeAt': 'Reprendre à {time}',
    'feed.watch': 'Regarder',
    'feed.watched': 'Vu',
    'feed.markWatched': 'Marquer comme vu',
    'feed.markUnwatched': 'Marquer comme non vu',
    'feed.noVideosTitle': 'Aucune vidéo pour le moment',
    'feed.noVideosDesc':
      'Connectez votre chaîne YouTube et importez des playlists pour peupler votre bibliothèque.',
    'feed.loadFailed': 'Impossible de charger le fil.',
  } as const,
  en: {
    'feed.title': 'Library',
    'feed.keepWatching': 'Keep watching',
    'feed.allVideos': 'All videos',
    'feed.resume': 'Resume',
    'feed.resumeAt': 'Resume at {time}',
    'feed.watch': 'Watch',
    'feed.watched': 'Watched',
    'feed.markWatched': 'Mark as watched',
    'feed.markUnwatched': 'Mark as not watched',
    'feed.noVideosTitle': 'No videos yet',
    'feed.noVideosDesc':
      'Connect your YouTube channel and import playlists to populate your library.',
    'feed.loadFailed': 'Could not load the feed.',
  } as const,
} as const

export type FeedKey = keyof (typeof messages)['fr']