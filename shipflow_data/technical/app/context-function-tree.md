---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.1.0"
project: "replayglowz-app"
created: "2026-04-26"
updated: "2026-05-31"
status: "reviewed"
source_skill: sf-docs
scope: "file"
owner: "Diane"
confidence: "high"
risk_level: "medium"
security_impact: "medium"
docs_impact: "yes"
linked_systems:
  - "Flutter"
  - "Riverpod"
  - "Clerk"
  - "Convex"
  - "Vercel"
depends_on:
  - "shipflow_data/technical/app/context.md"
  - "shipflow_data/technical/app/architecture.md"
supersedes:
  - artifact_version: "0.1.0"
evidence:
  - "lib/main.dart"
  - "lib/app/router.dart"
  - "lib/app/build_info.dart"
  - "lib/auth/auth_state.dart"
  - "lib/auth/clerk_service.dart"
  - "lib/convex/convex_client.dart"
  - "lib/convex/convex_provider.dart"
  - "lib/providers/providers.dart"
  - "lib/providers/mutations.dart"
  - "lib/widgets/app_shell.dart"
  - "lib/utils/browser_environment.dart"
  - "lib/screens/videos/videos_screen.dart"
  - "lib/screens/play/play_screen.dart"
  - "lib/screens/playlists/virtual_feed_detail_screen.dart"
  - "api/auth/_youtube.js"
  - "api/auth/youtube.js"
  - "api/auth/youtube/callback.js"
  - "tool/check_shared_backend_contract.dart"
next_step: "Refresh when provider names, route graph, feed/source behavior, Play controls, or OAuth handler flow changes."
---

# CONTEXT FUNCTION TREE

## Bootstrap and app composition

```text
main()
├── WidgetsFlutterBinding.ensureInitialized()
├── FlutterError.onError -> AppLogger
├── PlatformDispatcher.instance.onError -> AppLogger
├── AppLogger build/config diagnostics
├── if convexUrl.isNotEmpty -> ConvexService.initialize(convexUrl)
└── runApp(ProviderScope(child: _AppBootstrap))

_AppBootstrapState.initState()
└── addPostFrameCallback(_bootstrap)

_AppBootstrapState._bootstrap()
├── if Convex and Clerk config exist
│   ├── ref.read(clerkServiceProvider)
│   ├── await clerk.ready
│   ├── ref.read(convexServiceProvider)
│   ├── await convex.setAuth(() => clerk.getConvexToken())
│   └── if clerk.isAuthenticated -> clerk.waitForConvexTokenReady()
├── else log skipped wiring
└── set _initialised=true

_AppBootstrapState.build()
├── loading MaterialApp while bootstrap runs
├── _ConfigFallbackScreen on bootstrap error or missing required config
└── ReplayGlowzApp on success
```

## Routing and shell

```text
routerProvider -> GoRouter(initialLocation: /videos)
├── redirect()
│   ├── unauthenticated protected route -> /sign-in?tf_redirect=...
│   ├── authenticated /sign-in -> resolved tf_redirect or /videos
│   └── public feedback routes bypass auth redirect
├── /sign-in -> ClerkSignInPage
├── /feedback -> FeedbackScreen
├── /feedback/admin -> FeedbackAdminScreen
└── ShellRoute -> AppShell
    ├── /videos -> VideosScreen
    ├── /play -> PlayScreen(videoId from query)
    ├── /playlists -> PlaylistsScreen
    │   ├── create -> CreatePlaylistScreen
    │   └── :id -> PlaylistDetailScreen
    ├── /notes -> NotesScreen
    │   └── :slug -> NoteDetailScreen
    ├── /notifications -> NotificationsScreen
    ├── /preferences -> PreferencesScreen
    ├── /hidden -> HiddenScreen
    └── /stats -> StatsScreen

AppShell
├── width >= 600 -> NavigationRail
└── width < 600 -> NavigationBar
    ├── active Play tap -> temporary playback controls when a video is active
    ├── Play long press -> toggle persistent playback controls
    └── Play swipe up -> show current-video action bar
```

## Auth tree

```text
authStateProvider -> AuthNotifier
├── setLoading()
├── setAuthenticated(AuthUser)
└── setUnauthenticated()

clerkServiceProvider -> ClerkService
├── ready
├── authState
├── isAuthenticated / currentUser
├── _init()
│   ├── initClerkWebBridge()
│   ├── _handleWebOAuthRedirectIfNeeded()
│   ├── ClerkAuthState.create()
│   ├── _restoreWebSessionOnStartup()
│   └── _syncAuthNotifier()
├── getConvexToken() -> Clerk session token with Convex audience
├── waitForConvexTokenReady()
├── signOut()
└── convexAuthReadyProvider
```

## Convex tree

```text
ConvexService
├── initialize(url)
├── instance
├── setAuth(tokenProvider)
├── setAuthToken(token)
├── clearAuth()
├── query(path, args)
│   ├── optional web HTTP bridge
│   ├── _waitForConnection()
│   └── _decode()
├── mutate(path, args)
│   ├── optional web HTTP bridge
│   ├── _waitForConnection()
│   └── _decode()
├── action(path, args)
│   ├── optional web HTTP bridge
│   ├── _waitForConnection()
│   └── _decode()
├── subscribe(path, args)
└── dispose()

convexServiceProvider
convexQueryProvider
convexSubscriptionProvider
```

## Typed read providers

```text
providers.dart
├── videosProvider -> youtube:getAllVideos subscription
├── playlistsProvider -> youtube:getYoutubePlaylists
├── virtualFeedsProvider -> virtualFeeds:getVirtualFeeds
├── virtualFeedDetailsProvider -> virtualFeeds:getVirtualFeedDetails
├── appPlaybackControllerProvider -> shell-to-Play command state
├── playbackSessionProvider -> active Feed/playlist/ReplayGlowz feed/direct Up next context
├── notesProvider -> notes:getNotes
├── settingsProvider -> settings:getSettings
├── subscriptionProvider -> subscriptions:getSubscription
├── currentUserProvider -> users:getCurrentUser plus auth fallback
├── youtubeConnectionProvider -> youtube:getYoutubeConnectionStatus
├── preferencesDataProvider -> settings + subscription + user composition
├── feedbackIsAdminProvider -> feedback:isAdmin
├── feedbackAdminEntriesProvider -> feedback:listAdmin
├── hiddenItemsProvider
├── watchedVideosProvider
├── videoProgressProvider(videoId)
├── quotaUsageProvider
├── playlistVideosProvider
├── notificationsProvider -> notifications:getNotifications
├── unreadNotificationCountProvider -> notifications:getUnreadCount
└── videoNotesProvider(videoId)
```

## Mutation and action entrypoints

```text
mutations.dart
├── Notes
│   ├── createNote() -> notes:createNote
│   ├── updateNote() -> notes:updateNote
│   └── deleteNote() -> notes:deleteNote
├── Hidden items
│   ├── hideVideo() -> hidden:hideItem
│   ├── hidePlaylist() -> hidden:hideItem
│   ├── unhideVideo() -> hidden:unhideItem
│   └── unhideItem() -> hidden:unhideItem
├── Watch history
│   ├── markWatched() -> watched:markWatched
│   └── unmarkWatched() -> watched:unmarkWatched
├── Playback progress
│   ├── saveProgress() -> progress:saveProgress
│   └── upsertProgress() -> progress:upsertProgress
├── Playlists / YouTube
│   ├── syncAllPlaylists() -> youtube:startQuotaSafeSync
│   ├── syncAllPlaylistsWithContainer()
│   ├── syncPlaylist() -> youtube:startQuotaSafeSync
│   ├── disconnectYoutube() -> youtube:disconnectYoutube
│   ├── removeVideoFromPlaylist() -> playlists:removeVideoFromPlaylist
│   └── createPlaylist() -> playlists:createPlaylist
├── ReplayGlowz feeds
│   ├── createVirtualFeed() -> virtualFeeds:createVirtualFeed
│   ├── updateVirtualFeed() -> virtualFeeds:updateVirtualFeed
│   ├── deleteVirtualFeed() -> virtualFeeds:deleteVirtualFeed
│   ├── addVirtualFeedSource() -> virtualFeeds:addFeedSource
│   ├── addVirtualFeedChannelSources() -> virtualFeeds:addChannelSourcesFromPlaylist
│   ├── removeVirtualFeedSource() -> virtualFeeds:removeFeedSource
│   └── reorderVirtualFeedSources() -> virtualFeeds:reorderFeedSources
├── Likes
│   └── toggleLike()
├── Comments
│   └── createComment()
├── Notifications
│   ├── markNotificationRead()
│   └── markAllNotificationsRead()
├── Settings
│   └── updateSettings()
└── Feedback
    ├── getFeedbackUploadUrl()
    ├── createFeedbackText()
    ├── createFeedbackAudio()
    └── markFeedbackReviewed()
```

## Playback command flow

```text
AppShell mobile Play controls
├── long press Play -> AppPlaybackController.toggle persistent controls
├── swipe up Play -> current-video action bar
├── previous/next/loop/play-pause buttons -> AppPlaybackController request counters
└── hide/watched/speed buttons -> AppPlaybackController request counters

PlayScreen
├── ref.listen(appPlaybackControllerProvider)
├── play/pause request -> YouTube controller playVideo()/pauseVideo()
├── previous/next request -> PlaybackSession navigation and progress save
├── Up next drawer -> active PlaybackSession source/items
├── loop toggle -> repeat current video on playback end
├── hide current video -> hidden:hideItem, provider invalidation, route back to feed
├── mark watched -> watched:markWatched and watched/videos invalidation
└── speed request -> set playback rate on web/native player controller
```

## Web background-playback guidance

```text
WidgetsBindingObserver.didChangeAppLifecycleState()
├── background state -> remember whether the player was playing
├── web player snapshot while backgrounded -> detect playing-to-paused transition
└── resumed -> request web player sync, then show guidance if playback was interrupted

browser_environment.dart
├── non-web export -> BrowserEnvironment(isWeb: false)
└── web export -> parse browser user agent for Firefox/Vivaldi-specific copy
```

## Feedback flow

```text
FeedbackSubmissionService
├── loadTextDraft()
├── saveTextDraft()
├── clearTextDraft()
├── submitText()
│   └── createFeedbackText()
└── submitAudio()
    ├── readRecordedAudioUpload()
    ├── getFeedbackUploadUrl()
    ├── http.post(uploadUrl)
    ├── createFeedbackAudio()
    └── cleanupFeedbackRecording()
```

## YouTube OAuth serverless flow

```text
GET /api/auth/youtube
├── getRequestOrigin(req)
├── sanitizeReturnTo(return_to)
├── require YOUTUBE_OAUTH_CLIENT_ID and replayglowz_youtube_clerk_session_id cookie
├── create state
├── set youtube_oauth_state and youtube_oauth_return_to cookies
└── redirect to Google OAuth consent

GET /api/auth/youtube/callback
├── validate method, code, state, and cookies
├── require YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET, CLERK_SECRET_KEY, CONVEX_URL
├── exchangeCodeForTokens()
├── reuse Clerk session token configured by the Clerk Convex integration
├── ensureConvexUser() -> users:ensureUser
├── saveYoutubeTokens() -> youtube:saveYoutubeTokens
├── clear OAuth/session cookies
└── redirect to app hash route with youtube_connected or youtube_error
```

## Shared backend contract check

```text
dart run tool/check_shared_backend_contract.dart
├── resolve REPLAYGLOWZ_BACKEND_ROOT
├── fallback to backend/packages/backend/convex
├── verify module file exists for each required function
└── verify `export const <function> =` exists
```
