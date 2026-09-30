// Domain types mirroring the ReplayGlows product Convex backend as consumed by
// the Flutter app (contract extracted from app/lib/providers on 2026-09-15).

export interface YouTubeVideo {
  _id: string
  _creationTime?: number
  youtubeVideoId: string
  /** Some backend readers resolve the YouTube id as `id` instead of `youtubeVideoId`. */
  id?: string
  title: string
  channelId?: string
  channelTitle?: string
  channelThumbnailUrl?: string
  thumbnailUrl?: string
  description?: string
  /** ISO-8601 duration (e.g. PT6M34S) returned by some backend readers. */
  duration?: string
  /** Duration in seconds. */
  durationSeconds?: number | null
  publishedAt?: string | null
  isShortForm?: boolean
  position?: number | null
  watched?: boolean
  hidden?: boolean
}

/** Paginated envelope returned by `youtube:getAllVideos`. */
export interface YouTubeVideosPage {
  page: YouTubeVideo[]
  isDone: boolean
  continueCursor: string | null
}

export interface YouTubePlaylist {
  _id: string
  _creationTime?: number
  youtubePlaylistId: string
  title: string
  description?: string
  thumbnailUrl?: string
  color?: string | null
  videoCount?: number
  updatedAt?: string
}

export interface YouTubeChannel {
  youtubeChannelId: string
  title: string
  description?: string
  thumbnailUrl?: string
}

export interface ConnectionStatus {
  hasTokens: boolean
  connected: boolean
  channelId?: string
  channelTitle?: string
  lastSyncAt?: string
}

export interface SyncJob {
  status: string
  phase?: string
  current?: number
  total?: number
}

export interface VirtualFeed {
  _id: string
  _creationTime?: number
  title: string
  description?: string
  includeWatched: boolean
  sortOrder: 'newest' | 'oldest' | 'sourceOrder'
  color?: string | null
  icon?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface FeedSource {
  _id: string
  sourceType: 'channel' | 'playlist' | 'subscriptions'
  sourceId: string
  sourceTitle: string
  isActive?: boolean
  position?: number
  videoCount?: number
}

export interface FeedDetails {
  feed?: VirtualFeed | null
  videos: YouTubeVideo[]
  sources: FeedSource[]
  stats?: {
    sourceCount: number
    activeSourceCount: number
    staleSourceCount: number
    matchedVideoCount: number
  }
  isDone: boolean
  continueCursor: string | null
  sortOrder: string
}

export interface PlaylistChannelCandidate {
  youtubeChannelId: string
  title: string
  thumbnailUrl?: string
  videoCount: number
  alreadyAdded: boolean
  isSubscribed: boolean
}

export interface Note {
  _id: string
  _creationTime?: number
  userId: string
  youtubeVideoId: string
  content: string
  timestamp?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface NotificationsSettings {
  email: boolean
  push: boolean
  newComments: boolean
  newLikes: boolean
  newVideos: boolean
  feedRefreshIntervalMinutes?: number
  pushCadence?: string
  notifyAllSources?: boolean
  selectedFeedIds?: string[]
  selectedChannelSourceIds?: string[]
  transcriptReady: boolean
  system: boolean
  androidPush?: {
    enabled: boolean
    cadence: string
    types: { new_video: boolean; transcript_ready: boolean; system: boolean }
  }
}

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  language: 'en' | 'fr' | 'es' | 'de' | 'pt'
  notifications?: NotificationsSettings
  playback?: {
    autoplay?: boolean
    defaultQuality?: string
    defaultSpeed?: number
    mobileControlsPosition?: string
    captionsEnabled?: boolean
    autoMarkWatchedThreshold?: number
  }
  notes?: {
    defaultTimestamped?: boolean
    sortOrder?: 'asc' | 'desc'
  }
  channelSync?: {
    autoSyncOnVisit?: boolean
    syncIntervalMinutes?: number
  }
  transcripts?: {
    defaultLanguage?: string
    autoAttemptYoutubeCaptions?: boolean
    autoAttemptLocalFallback?: boolean
    sortBy?: string
    defaultProvider?: string | null
  }
}

export interface Subscription {
  _id: string
  userId: string
  plan: 'free' | 'pro' | 'team'
  status: string
  features?: {
    maxVideos: number
    maxNotesPerVideo: number
    maxPlaylists: number
    aiSummaries: boolean
    exportNotes: boolean
  }
  cancelAtPeriodEnd?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ProductAccessStatus {
  hasAccess?: boolean
  access?: string
  entitlementActive?: boolean
  accountRecognized?: boolean
  recognized?: boolean
  userKnown?: boolean
  reasonCode?: string | null
}

export interface HiddenItem {
  _id: string
  itemType: 'video' | 'playlist'
  youtubeId: string
  hiddenAt?: string
}

export interface WatchedVideo {
  _id: string
  youtubeVideoId: string
  watchedAt?: string
}

export interface VideoProgress {
  _id: string
  youtubeVideoId: string
  progressSeconds: number
  durationSeconds?: number | null
  updatedAt?: string
}

export interface Notification {
  _id: string
  userId: string
  type: 'new_video' | 'transcript_ready' | 'system'
  title: string
  body?: string
  youtubeVideoId?: string
  youtubeChannelId?: string
  thumbnailUrl?: string
  read: boolean
  createdAt?: string
}

export interface TranscriptEntry {
  start: number
  duration: number
  text: string
  speaker?: string
}

export interface Transcript {
  entries: TranscriptEntry[]
}

export interface TranscriptVersion {
  _id?: string
  id?: string
  provider?: string
  version?: string
  status: string
  sourceType?: string
  estimatedCostUsd?: number
  warnings?: string[]
  errorMessage?: string
  previewText?: string
  createdAt?: string
  isActive?: boolean
}

export interface TranscriptJob {
  _id?: string
  id?: string
  provider?: string
  status: string
  progressMessage?: string
  errorMessage?: string
  versionId?: string
  createdAt?: string
  updatedAt?: string
  startedAt?: string
  finishedAt?: string
}

export interface TranscriptProvider {
  id: string
  label: string
  description?: string
  type: string
  requiresSecret?: boolean
  secretProvider?: string
  requiresWorker?: boolean
  priceLabel?: string
  speedLabel?: string
  qualityLabel?: string
  recommendedUse?: string
  isAvailable?: boolean
  available?: boolean
  unavailableReason?: string
  maskedSecret?: string
  maskedValue?: string
}

export interface SecretStatus {
  provider: string
  maskedValue: string
  updatedAt?: string
}

export interface ChannelLink {
  _id: string
  youtubeChannelId: string
  channelTitle: string
  youtubePlaylistId: string
  linkedAt?: string
  lastSyncedAt?: string
  isActive?: boolean
}

export interface QuotaUsage {
  used: number
  limit: number
  percentage?: number
  recentCalls?: unknown[]
  dailyHistory?: unknown[]
  syncs?: number
  videosFetched?: number
  playlistCount?: number
}

export interface VideoOrderChange {
  playlistId: string
  orderedIds: string[]
}