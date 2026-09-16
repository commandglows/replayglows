// Typed client API for the ReplayGlows product Convex backend. Function names,
// argument shapes and consumed result fields mirror the Flutter app's usage
// (contract extracted from app/lib/providers on 2026-09-15). All calls fail
// closed when no authenticated session is present.
import { getConvexClient } from './client'
import { convexTokenValidOrThrow } from './auth'
import type { FunctionReference } from 'convex/server'
import type {
  ChannelLink,
  ConnectionStatus,
  FeedDetails,
  HiddenItem,
  Note,
  Notification,
  PlaylistChannelCandidate,
  ProductAccessStatus,
  QuotaUsage,
  SecretStatus,
  Settings,
  Subscription,
  SyncJob,
  Transcript,
  TranscriptJob,
  TranscriptProvider,
  TranscriptVersion,
  VideoProgress,
  VirtualFeed,
  WatchedVideo,
  YouTubeChannel,
  YouTubePlaylist,
  YouTubeVideo,
  YouTubeVideosPage,
} from './types'

function client() {
  convexTokenValidOrThrow()
  return getConvexClient()
}

// The Convex runtime resolves plain string paths (getFunctionName handles
// strings); only the TypeScript surface requires a FunctionReference.
function ref<F extends 'query' | 'mutation' | 'action'>(path: string): FunctionReference<F> {
  return path as unknown as FunctionReference<F>
}

function query<T>(path: string, args: Record<string, unknown> = {}): Promise<T> {
  return client().query(ref<'query'>(path), args as never) as Promise<T>
}

function mutate<T>(path: string, args: Record<string, unknown> = {}): Promise<T> {
  return client().mutation(ref<'mutation'>(path), args as never) as Promise<T>
}

function act<T>(path: string, args: Record<string, unknown> = {}): Promise<T> {
  return client().action(ref<'action'>(path), args as never) as Promise<T>
}

// Users and product access
export const usersApi = {
  ensureUser: (args: { email: string; name?: string; avatarUrl?: string }) =>
    mutate<string>('users:ensureUser', args),
  getCurrentUser: () => query<Record<string, unknown> | null>('users:getCurrentUser'),
  getProductAccessStatus: (args: { productId: string; legacyProductIds: string[] }) =>
    query<ProductAccessStatus>('users:getProductAccessStatus', args),
}

// Videos and YouTube library
export const videosApi = {
  getAll: (sortOrder: 'desc' | 'asc', includeWatched = true) =>
    query<YouTubeVideo[] | YouTubeVideosPage>('youtube:getAllVideos', { sortOrder, includeWatched }),
  getByYoutubeId: (youtubeVideoId: string) =>
    query<YouTubeVideo | null>('youtube:getVideoByYoutubeId', { youtubeVideoId }),
  getPlaylists: () => query<YouTubePlaylist[]>('youtube:getYoutubePlaylists'),
  getChannels: () => query<YouTubeChannel[]>('youtube:getYoutubeChannels'),
  getConnectionStatus: () => query<ConnectionStatus>('youtube:getYoutubeConnectionStatus'),
  getLatestSyncJob: () => query<SyncJob | null>('youtube:getLatestYoutubeSyncJob'),
  getPlaylistVideos: (playlistId: string) =>
    query<YouTubeVideo[]>('youtube:getPlaylistVideos', { playlistId }),
  startQuotaSafeSync: () => act<void>('youtube:startQuotaSafeSync'),
  disconnect: () => mutate<void>('youtube:disconnectYoutube'),
  importPlaylistByUrl: (url: string) => act<{ id?: string }>('youtube:importPlaylistByUrl', { url }),
  createYoutubePlaylist: (args: { title: string; description?: string; privacyStatus: 'public' | 'private' }) =>
    act<{ id: string }>('youtube:createYoutubePlaylist', args),
  updateYoutubePlaylist: (args: { playlistId: string; title?: string; description?: string }) =>
    act<void>('youtube:updateYoutubePlaylist', args),
  deleteYoutubePlaylist: (playlistId: string) => act<void>('youtube:deleteYoutubePlaylist', { playlistId }),
  addVideoToPlaylist: (playlistId: string, videoId: string) =>
    act<void>('youtube:addVideoToYoutubePlaylist', { playlistId, videoId }),
  removeVideoFromPlaylist: (playlistId: string, playlistItemId: string) =>
    act<void>('youtube:removeVideoFromYoutubePlaylist', { playlistId, playlistItemId }),
  moveVideoInPlaylist: (args: { playlistId: string; playlistItemId: string; videoId: string; newPosition: number }) =>
    act<void>('youtube:moveVideoInYoutubePlaylist', args),
  updatePlaylistDetails: (playlistId: string, color: string) =>
    mutate<void>('youtube:updatePlaylistDetails', { playlistId, color }),
  fetchYoutubePlaylists: () => act<void>('youtube:fetchYoutubePlaylists'),
}

// Virtual feeds
export const feedsApi = {
  list: (includeInactive = true) => query<VirtualFeed[]>('virtualFeeds:listFeeds', { includeInactive }),
  details: (args: {
    virtualFeedId: string
    includeHidden: boolean
    includeWatched: boolean
    sortOrder: 'oldest' | 'newest' | 'sourceOrder'
    cursor?: string | null
    pageSize?: number
  }) => query<FeedDetails>('virtualFeeds:getFeedDetails', args),
  candidates: (virtualFeedId: string, youtubePlaylistId: string) =>
    query<{ playlist: { youtubePlaylistId: string; title: string; videoCount: number } | null; candidates: PlaylistChannelCandidate[]; missingMetadataCount: number; totalVideoCount: number }>(
      'virtualFeeds:listPlaylistChannelCandidates',
      { virtualFeedId, youtubePlaylistId },
    ),
  create: (args: { title: string; description?: string; includeWatched: boolean; sortOrder: string; color?: string | null; icon?: string | null; isActive: boolean }) =>
    mutate<{ _id: string }>('virtualFeeds:createFeed', args),
  update: (args: { virtualFeedId: string; title?: string; description?: string; includeWatched: boolean; sortOrder?: string; color?: string | null; icon?: string | null; isActive?: boolean }) =>
    mutate<void>('virtualFeeds:updateFeed', args),
  remove: (virtualFeedId: string) => mutate<void>('virtualFeeds:deleteFeed', { virtualFeedId }),
  addSource: (args: { virtualFeedId: string; sourceType: string; sourceId: string; sourceTitle: string; isActive: boolean }) =>
    mutate<{ _id: string }>('virtualFeeds:addFeedSource', args),
  addSources: (args: { virtualFeedId: string; sources: { sourceType: 'channel'; sourceId: string; sourceTitle: string; isActive: boolean }[] }) =>
    mutate<{ addedCount: number; alreadyAddedCount: number; rejectedCount: number }>('virtualFeeds:addFeedSources', args),
  removeSource: (virtualFeedSourceId: string) => mutate<void>('virtualFeeds:removeFeedSource', { virtualFeedSourceId }),
  reorderSources: (virtualFeedId: string, sourceIds: string[]) =>
    mutate<void>('virtualFeeds:reorderFeedSources', { virtualFeedId, sourceIds }),
  toggleSource: (virtualFeedSourceId: string, isActive?: boolean) =>
    mutate<void>('virtualFeeds:toggleFeedSource', { virtualFeedSourceId, isActive }),
}

// Notes
export const notesApi = {
  list: () => query<Note[]>('notes:getNotes'),
  listByVideo: (youtubeVideoId: string) =>
    query<Note[]>('notes:getNotesByYoutubeVideo', { youtubeVideoId }),
  createForVideo: (youtubeVideoId: string, content: string, timestamp?: number | null) =>
    mutate<{ _id: string }>('notes:createNoteForYoutubeVideo', { youtubeVideoId, content, timestamp }),
  update: (id: string, content: string) => mutate<void>('notes:updateNote', { id, content }),
  remove: (noteId: string) => mutate<void>('notes:deleteNote', { noteId }),
  exportForVideo: (youtubeVideoId: string) =>
    query<{ markdown: string }>('notes:exportNotesForVideo', { youtubeVideoId }),
}

// Hidden / watched / progress
export const hiddenApi = {
  list: () => query<HiddenItem[]>('hidden:getHiddenItems'),
  hide: (youtubeId: string, itemType: 'video' | 'playlist') =>
    mutate<void>('hidden:hideItem', { youtubeId, itemType }),
  unhide: (args: { youtubeId: string; itemType?: 'video' | 'playlist' } | { hiddenItemId: string }) =>
    mutate<void>('hidden:unhideItem', args),
}

export const watchedApi = {
  list: () => query<WatchedVideo[]>('watched:getWatchedVideos'),
  mark: (youtubeVideoId: string) => mutate<void>('watched:markAsWatched', { youtubeVideoId }),
  unmark: (youtubeVideoId: string) => mutate<void>('watched:unmarkAsWatched', { youtubeVideoId }),
}

export const progressApi = {
  getAll: () => query<VideoProgress[]>('progress:getAllProgress'),
  get: (youtubeVideoId: string) => query<VideoProgress | null>('progress:getProgress', { youtubeVideoId }),
  save: (args: { youtubeVideoId: string; progressSeconds: number; durationSeconds?: number | null }) =>
    mutate<void>('progress:saveProgress', args),
}

// Settings, subscription, notifications
export const settingsApi = {
  get: () => query<Settings | null>('settings:getSettings'),
  updateAll: (settings: Partial<Settings>) => mutate<void>('settings:updateAllSettings', settings),
}

export const subscriptionApi = {
  get: () => query<Subscription | null>('subscriptions:getSubscription'),
}

export const notificationsApi = {
  list: () => query<Notification[]>('notifications:getNotifications'),
  unreadCount: () => query<number>('notifications:getUnreadCount'),
  markAsRead: (notificationId: string) => mutate<void>('notifications:markAsRead', { notificationId }),
  markAllAsRead: () => mutate<void>('notifications:markAllAsRead'),
}

export const metricsApi = {
  todayQuota: () => query<QuotaUsage>('metrics:getTodayQuotaUsage'),
}

// Transcripts
export const transcriptsApi = {
  active: (youtubeVideoId: string, language: string) =>
    query<Transcript | null>('transcripts:getActiveTranscript', { youtubeVideoId, language }),
  providers: () => query<TranscriptProvider[]>('transcripts:getProviderCatalog'),
  versions: (youtubeVideoId: string, language: string) =>
    query<TranscriptVersion[]>('transcripts:getTranscriptVersions', { youtubeVideoId, language }),
  latestJob: (youtubeVideoId: string, language: string) =>
    query<TranscriptJob | null>('transcripts:getLatestTranscriptJob', { youtubeVideoId, language }),
  selectVersion: (versionId: string) => mutate<void>('transcripts:selectTranscriptVersion', { versionId }),
  generate: (youtubeVideoId: string, language: string, provider?: string) =>
    act<Record<string, unknown>>('transcriptGeneration:generateTranscript', { youtubeVideoId, language, activate: true, provider }),
  secretsStatus: () => query<SecretStatus[]>('transcriptSecrets:getSecretsStatus'),
  upsertSecret: (provider: string, apiKey: string) => mutate<void>('transcriptSecrets:upsertSecret', { provider, apiKey }),
  deleteSecret: (provider: string) => mutate<void>('transcriptSecrets:deleteSecret', { provider }),
  testSecret: (provider: string) => act<{ ok?: boolean; message?: string }>('transcriptSecrets:testSecret', { provider }),
}

// Channel links
export const channelLinksApi = {
  list: () => query<ChannelLink[]>('channelLinks:getChannelLinks'),
  linkChannelToPlaylist: (args: { youtubeChannelId: string; channelTitle: string; youtubePlaylistId: string }) =>
    mutate<void>('channelLinks:linkChannelToPlaylist', args),
  unlink: (linkId: string) => mutate<void>('channelLinks:unlinkChannel', { linkId }),
  toggle: (linkId: string) => mutate<void>('channelLinks:toggleLinkStatus', { linkId }),
  syncPastVideos: (args: { youtubeChannelId: string; channelTitle: string; youtubePlaylistId: string }) =>
    act<{ message?: string; addedCount: number }>('channelLinks:syncPastVideosFromChannel', args),
}

// Local playlist helpers and social
export const playlistApi = {
  removeVideo: (playlistId: string, videoId: string) =>
    mutate<void>('playlists:removeVideoFromPlaylist', { playlistId, videoId }),
}

export const videoOrderApi = {
  update: (args: { playlistId: string; orderedIds: string[] }) =>
    mutate<void>('videoOrder:updateOrder', args),
}

export const likesApi = {
  // The product backend routes youtube-video likes through youtubeInteractions.
  toggle: (youtubeVideoId: string, type: 'like' | 'dislike') =>
    mutate<void>('youtubeInteractions:toggleLike', { youtubeVideoId, type }),
  getStatus: (youtubeVideoId: string) =>
    query<{ like?: boolean; dislike?: boolean } | null>('youtubeInteractions:getLikeStatus', { youtubeVideoId }),
}

export const commentsApi = {
  create: (youtubeVideoId: string, content: string) =>
    mutate<void>('comments:createComment', { youtubeVideoId, content }),
}

export const feedbackApi = {
  isAdmin: () => query<boolean>('feedback:isAdmin'),
  createText: (args: { message: string; platform: string; locale: string }) =>
    mutate<void>('feedback:createText', args),
}