---
artifact: "architecture_context"
metadata_schema_version: "1.0"
artifact_version: "1.1.1"
project: "replayglowz-app"
created: "2026-04-26"
updated: "2026-06-01"
status: "reviewed"
source_skill: "sf-docs"
scope: "architecture"
owner: "Diane"
confidence: "high"
risk_level: "medium"
docs_impact: "yes"
security_impact: "yes"
evidence:
  - "README.md"
  - ".env.example"
  - "pubspec.yaml"
  - "build.sh"
  - "vercel.json"
  - "api/auth/_youtube.js"
  - "api/auth/youtube.js"
  - "api/auth/youtube/callback.js"
  - "lib/main.dart"
  - "lib/app/build_info.dart"
  - "lib/app/router.dart"
  - "lib/auth/clerk_service.dart"
  - "lib/auth/auth_state.dart"
  - "lib/convex/convex_client.dart"
  - "lib/convex/convex_provider.dart"
  - "lib/providers/providers.dart"
  - "lib/providers/mutations.dart"
  - "lib/utils/browser_environment.dart"
  - "lib/widgets/app_shell.dart"
  - "lib/screens/videos/videos_screen.dart"
  - "lib/screens/play/play_screen.dart"
  - "lib/screens/playlists/virtual_feed_detail_screen.dart"
  - "tool/check_shared_backend_contract.dart"
linked_systems:
  - "lib/main.dart"
  - "lib/app/router.dart"
  - "lib/auth"
  - "lib/convex"
  - "api/auth"
  - "Vercel"
  - "ReplayGlowz product Convex backend"
external_dependencies:
  - "Clerk"
  - "Convex"
  - "Vercel"
  - "Google YouTube OAuth"
invariants:
  - "The product Convex backend lives in the ReplayGlowz monorepo under replayglowz_backend/packages/backend."
  - "Authenticated data access depends on Clerk session tokens carrying the Convex audience."
  - "Writes continue to route through provider and mutation layers rather than ad hoc screen logic."
  - "Backend function names are a deployment contract between replayglowz_app and replayglowz_backend."
depends_on:
  - "CLAUDE.md"
  - "README.md"
supersedes:
  - artifact_version: "0.1.0"
next_review: "2026-07-25"
next_step: "Re-run backend contract review before changes that add or rename Convex paths."
---

# ARCHITECTURE

## System role

`replayglowz-app` is the Flutter web frontend for ReplayGlowz. It is responsible for rendering the authenticated user experience, restoring Clerk sessions in web environments, acquiring Clerk-minted Convex JWTs, reading and mutating app data through a shared Convex backend, and packaging the app as a Vercel deployment.

The repository also owns Vercel Node handlers for the YouTube OAuth browser flow under `api/auth/`. It does not own Convex schema or backend server functions.

## High-level architecture

```text
Browser
  -> Flutter web app served from Vercel build/web
    -> Riverpod state graph
      -> AppPlaybackController provider
      -> ClerkService
        -> Clerk web/session APIs
      -> ConvexService
        -> Convex backend
    -> api/auth/youtube serverless handlers
      -> Google OAuth
      -> Clerk server API
      -> Convex HTTP mutation API
```

## Module boundaries

### App layer

- `lib/main.dart`: process bootstrap, error capture, Convex initialization, env-aware fallback rendering.
- `lib/app/build_info.dart`: compile-time configuration and build metadata helpers.
- `lib/app/router.dart`: route graph, public/protected route policy, and auth redirects.
- `lib/widgets/app_shell.dart`: responsive navigation shell for protected feature areas.

### Auth layer

- `lib/auth/clerk_service.dart`: long-lived Clerk lifecycle owner, web OAuth callback handling, session restoration, Convex token minting.
- `lib/auth/auth_state.dart`: app-local auth state contract for router and UI.
- `lib/auth/auth_gate.dart`: sign-in UI using the shared Clerk auth state.
- `lib/auth/clerk_web_bridge*.dart`: web JS interop for Clerk session/OAuth bridge behavior.
- `lib/auth/clerk_web_persistor.dart`: web session persistence support.

### Data access layer

- `lib/convex/convex_client.dart`: singleton wrapper around `convex_flutter`, with query/mutation/action/subscription methods, auth wiring, connection waiting, decoding, and web HTTP bridge fallback.
- `lib/convex/convex_provider.dart`: generic Riverpod providers for direct Convex query/subscription access.
- `lib/providers/providers.dart`: typed feature-level read providers and fallback normalization.
- `lib/providers/mutations.dart`: centralized write/action helpers for screens.
- `lib/utils/browser_environment.dart`: conditional utility that isolates web browser detection from non-web builds.

### Presentation layer

- `lib/screens/**`: feature UI per route.
- `lib/widgets/**`: shared shell, banners, error feedback, and reusable UI.
- `lib/models/**`: data model decoding and typing.
- `lib/i18n/**`: English/French app copy.

### OAuth/serverless layer

- `api/auth/_youtube.js`: shared origin, cookie, return URL, and redirect helpers.
- `api/auth/youtube.js`: starts the Google YouTube OAuth flow and stores state/return cookies.
- `api/auth/youtube/callback.js`: validates callback state, exchanges Google codes, mints a Clerk `convex` JWT, ensures the Convex user, saves YouTube tokens, and redirects back into the Flutter hash route.

## Bootstrap sequence

1. `main()` initializes Flutter bindings and error hooks.
2. Build/config metadata is logged through `AppLogger`.
3. If `CONVEX_URL` is present, `ConvexService.initialize()` opens the shared client.
4. `runApp()` mounts a `ProviderScope` and `_AppBootstrap`.
5. `_AppBootstrap` waits for `clerkServiceProvider.ready` when Convex and Clerk config exist.
6. `_AppBootstrap` wires `convex.setAuth(() => clerk.getConvexToken())`.
7. If a user is already authenticated, bootstrap waits for a mintable Convex token.
8. The app renders loading UI, configuration fallback UI, or the routed application.

## Authentication architecture

Core decisions:

- Clerk state is service-owned, not widget-owned.
- Router decisions depend on local auth state rather than raw SDK objects.
- Web startup includes bridge/persistence work because Clerk web session recovery is project-managed in this stack.
- Convex auth depends on the Clerk Convex integration adding the required audience to session tokens.

Flow:

1. `ClerkService._init()` configures Clerk.
2. On web, it initializes the Clerk bridge and handles OAuth redirect callback URLs.
3. `ClerkAuthState.create()` builds the long-lived session owner.
4. `ClerkService` restores persisted web sessions where possible.
5. State changes are mirrored into `AuthNotifier`.
6. `routerProvider` redirects unauthenticated protected routes to `/sign-in`, preserving `tf_redirect`.
7. `ClerkService.getConvexToken()` requests the Clerk session token and returns `null` on unavailable/error cases.

Critical coupling:

- Clerk Convex integration session audience: `convex`
- Convex backend auth provider application ID: `convex`
- Convex deployment must trust the Clerk issuer domain.

## Data architecture

Read path:

- UI watches typed Riverpod providers.
- Providers call `ConvexService.query()` or `ConvexService.subscribe()`.
- Web requests may first attempt HTTP bridge helpers, then fall back to the Convex WebSocket client.
- Raw JSON is normalized and mapped into Dart models.

Write path:

- Screens call helper functions in `lib/providers/mutations.dart`.
- Mutation helpers call Convex mutations or actions through the singleton service.
- Stream-backed data updates automatically where Convex subscriptions are used; FutureProvider-backed data may need invalidation by callers.

Fallback behavior:

- Some providers tolerate unavailable auth or missing optional backend functions by returning local defaults or empty lists.
- This improves bootstrap resilience but can hide backend drift, so contract-sensitive changes should use the shared backend checker.

Feed-specific behavior:

- The global Videos screen can render either the all-videos provider or a merged union of selected ReplayGlowz feed details.
- Feed selections are persisted locally as a set of feed ids; legacy single-feed and playlist-filter preferences are cleared during migration.
- ReplayGlowz feed source mutations must invalidate matching detail providers and visible video providers. Source deletion also removes matching source/video rows optimistically so the UI does not wait for a full reload.
- YouTube playlists are not direct main-feed filter entries; playlist/channel/subscription sources are managed from ReplayGlowz feed source flows.

## Navigation architecture

- Public routes: `/sign-in`, `/feedback`, `/feedback/admin`.
- Protected routes are mounted under `ShellRoute`.
- `AppShell` uses a bottom `NavigationBar` below 600dp and a `NavigationRail` at 600dp and above.
- On mobile Play, `AppShell` can replace the normal bottom navigation with playback controls after a long press or temporary Play activation, and can slide timeline/seek controls above the bottom navigation after an upward swipe from Play.
- YouTube connection and OAuth feedback banners are injected at shell level.

## Playback architecture

- `AppPlaybackController` is a Riverpod command bridge between shell controls and `PlayScreen`.
- Shell playback controls emit request counters for play/pause, previous, next, loop, hide current video, mark current video watched, speed up, slow down, and seek requests, plus transient previous/next preview state for long-press thumbnails and shared playback position for the swipe-up timeline.
- `PlaybackSession` is the in-memory source of truth for the active "Up next" context. Feed, playlist, and ReplayGlowz feed entry points create typed sessions with source metadata and ordered queue items before routing to `PlayScreen`; direct links fall back to a one-video direct session.
- `PlayScreen` owns player execution, progress persistence, playback-session previous/next navigation, loop handling, current-video mutations, and the "Up next" drawer.
- Web playback uses YouTube iframe/player state snapshots with YouTube keyboard and visible controls disabled where the IFrame API allows it; ReplayGlowz renders a pre-play thumbnail poster over the player, long-press previous/next thumbnail previews from the playback bar, and swipe-up timeline controls from the bottom Play button. Native/non-web playback uses the package controller path already present in the screen.
- Web background playback is treated as an external browser/YouTube iframe behavior. The app observes lifecycle transitions and player snapshots, then shows guidance only when playback appears to have been interrupted while the app was backgrounded. Native playback behavior is a separate future product surface and should not inherit web iframe constraints by default.

## Deployment architecture

- Hosting: Vercel.
- Install: clone Flutter stable into `./flutter/`, then `flutter/bin/flutter pub get`.
- Build: `bash build.sh`.
- Output: `build/web`.
- Routing: global rewrite to `/index.html`.
- Security headers: frame denial, `nosniff`, strict referrer policy, and a permissions policy that allows same-origin microphone for feedback recording while denying camera and geolocation.

Build metadata injected at compile time:

- `BUILD_COMMIT_SHA`
- `BUILD_ENVIRONMENT`
- `BUILD_TIMESTAMP`

## YouTube OAuth architecture

The OAuth flow is split between Flutter UI and Vercel functions:

1. Flutter initiates connection and makes the current Clerk session available to the OAuth route via project cookies/bridge behavior.
2. `GET /api/auth/youtube` validates config/session cookie, generates a state value, stores short-lived cookies, and redirects to Google with YouTube scope.
3. `GET /api/auth/youtube/callback` validates the state and required env values.
4. The callback exchanges the Google code for tokens.
5. The callback mints a Clerk `convex` JWT for the original session through Clerk's server API.
6. The callback runs Convex mutations to ensure the user and save YouTube tokens.
7. The callback redirects back into the Flutter hash route with `youtube_connected=true` or `youtube_error=...`.

## Security-sensitive areas

- Build-time config exposure in Flutter web bundles.
- Serverless secrets used by YouTube OAuth callback.
- Clerk session restoration and sign-out behavior.
- Convex JWT issuance, refresh, and backend auth provider alignment.
- OAuth state cookies and return URL sanitization.
- Local provider fallbacks that could hide missing backend authorization or function drift.

## Known architectural constraints

- Convex backend source is not co-located here.
- `ConvexService.instance` is treated as a process-wide singleton.
- Missing required Flutter config causes skipped wiring/fallback UI rather than runtime env recovery.
- Background playback cannot be guaranteed for embedded YouTube videos because browsers and the YouTube iframe/site behavior can pause media when the app or tab is hidden.
- Current README states there is no automated test coverage, aside from maintenance scripts and the Vercel OAuth helper test file.

## Recommended maintenance checks

- Run `dart run tool/check_shared_backend_contract.dart` before changing provider/mutation paths.
- Recheck `build.sh`, `.env.example`, `vercel.json`, and `api/auth/**` when auth or deployment variables change.
- Revisit this document when route graph, bootstrap ordering, auth ownership, Convex access patterns, feed/source behavior, Play shell controls, browser playback behavior, or OAuth behavior changes.
