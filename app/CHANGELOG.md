# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Added mobile Play guidance for long-press playback controls, swipe-up video actions, and browser background-playback interruptions.
- Added a web background-playback interruption dialog that explains browser-driven pauses and lets users explicitly opt out of future notices.

### Changed
- Feed filtering now switches between all videos and one or more ReplayGlowz feeds, without exposing playlist-level filtering inside the main feed picker.
- The Play mobile bottom bar can switch into playback controls, while a secondary action bar exposes current-video actions such as hide, mark watched, and playback speed changes.
- The Lists page hides the technical YouTube `Subscriptions` aggregate playlist while keeping all subscriptions available as a source option for ReplayGlowz feeds.

### Fixed
- Persisted theme preferences now drive the app runtime theme mode.
- Removing a source from a ReplayGlowz feed now removes that source card and its videos from the visible feed state immediately.
- Adding playlist channels as feed sources now reads the backend mutation result correctly before reporting added/rejected source counts.

## [2026-05-24]

### Changed
- Replaced the Flutter-driven full YouTube playlist refresh loop with the backend-orchestrated `youtube:startQuotaSafeSync` action.
- Added app chrome quota/sync progress visibility backed by Convex quota usage and YouTube sync job state.

### Added
- Added cache-first quota-safe sync support for ReplayGlowz YouTube imports, including backend job progress, quota threshold enforcement, and cached video-detail reuse to avoid unnecessary `videos.list` calls.

## [2026-05-23]

### Changed
- Migrated web auth session ownership from Firebase Auth to suite Clerk via a dedicated ClerkJS bridge (`web/clerk_bridge.js`) and Dart wrapper.
- Added Clerk/suite auth build contract (`CLERK_*`, `REPLAYGLOWZ_PRODUCT_ID`, `REPLAYGLOWZ_LEGACY_PRODUCT_IDS`, `REPLAYGLOWZ_ACCOUNT_CENTER_URL`) and updated Vercel CSP for Clerk runtime domains.
- Rewired Convex token provider to use Clerk session token minting (`template: convex`).
- Added fail-closed client product-access gating (`account recognized, product access inactive`) driven by backend access status.
- Replaced YouTube OAuth Firebase token handoff with Clerk session token + server entitlement verification (`SUITE_ENTITLEMENT_VERIFY_URL` / `SUITE_ENTITLEMENT_VERIFY_SECRET`) in both start and callback handlers.
- Added focused Node tests for suite entitlement denial/success paths and callback persistence flow.
- Updated app docs/contracts (`README.md`, `AGENT.md`, `CLAUDE.md`) to reflect suite Clerk identity and ReplayGlowz product Convex boundaries.

## [2026-05-15]

### Changed
- Removed legacy environment-variable compatibility fallbacks for app URL and OAuth handling (`TUBEFLOW_*`, `NEXT_PUBLIC_*`) in favor of `REPLAYGLOWZ_APP_URL`, `YOUTUBE_OAUTH_CLIENT_ID`, and `CONVEX_URL`.
- Batched full YouTube playlist sync calls to reduce sequential backend waits during manual refresh.
- Deferred the all-notes subscription on the Videos screen until the Notes view is active.

## [2026-05-14]

### Changed
- Renamed the app directory and Dart package namespace from `tubeflow_app` to `app`, including `package:app/...` imports and active app-side type names.
- Migrated visible app branding, PWA metadata, diagnostics, Sentry release defaults, and YouTube OAuth copy from TubeFlow to ReplayGlowz.
- Added `REPLAYGLOWZ_APP_URL` as the preferred app-origin build variable while keeping `TUBEFLOW_APP_URL` and `TUBEFLOW_WEB_URL` compatibility fallbacks.
- Migrated the feedback text draft key to `replayglowz_feedback_text_draft` with a read-and-remove fallback for the legacy key.

## [2026-05-11]

### Changed
- Removed beta Clerk Flutter SDK dependencies and disabled Flutter sign-in until a stable auth provider is integrated.
- Replaced the disabled beta-Clerk auth path with stable Firebase Auth Google sign-in and Firebase ID tokens for Convex auth.
- Updated the YouTube OAuth handoff to use Firebase ID tokens instead of Clerk session/JWT minting.
- Switched build and example environment variables from Clerk to Firebase web app configuration.
- Upgraded app dependencies to the latest resolvable non-beta direct versions, including `go_router`, `sentry_flutter`, and `flutter_lints`.
- Removed unused Riverpod codegen dependencies (`riverpod_annotation`, `build_runner`, `riverpod_generator`) and updated analyzer/lint fixes for the new lint set.

## [2026-05-10]

### Changed
- Pinned the Vercel and Android CI Flutter toolchains to Flutter 3.41.7.
- Removed unused `flutter_slidable` and `google_fonts` dependencies after usage verification.
- Documented the pinned Flutter/Dart toolchain in the app README.

## [2026-04-19]

### Added
- In-app feedback submission flow with text and audio support, anonymous fallback, and dedicated Flutter screens/services for creation and admin review
- Admin-only feedback inbox in Preferences with filters, audio playback, metadata, and mark-as-reviewed actions
- `FEEDBACK_ADMIN_EMAILS` deployment variable documentation for the Convex-backed feedback admin allowlist

### Changed
- Router/auth flow now keeps `/feedback` publicly reachable while exposing the admin screen only to allowlisted users
- Flutter feedback submissions now depend on Convex-backed providers/mutations instead of a local-only draft flow
- Web deployment now allows microphone access via `Permissions-Policy` so browser audio feedback recording works in production

## [2026-04-18]

### Fixed
- Restored compatibility with legacy Vercel env names: `build.sh` now falls back to `NEXT_PUBLIC_CONVEX_URL` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and Clerk bootstrap accepts the legacy publishable-key `dart-define` so sign-in buttons still render on older deployments

## [2026-04-12]

### Changed
- `build.sh`: read env vars directly as `CONVEX_URL` / `CLERK_PUBLISHABLE_KEY` (removed `NEXT_PUBLIC_*` fallbacks) — matches cleaned-up Doppler/Vercel variable names post-Next/Expo migration
- Clerk auth bootstrap now owns a shared `ClerkAuthState`, waits for service readiness before wiring Convex auth, and keeps the session available outside the sign-in route
- Screen-level error handling is consolidated through `widgets/error_feedback.dart` with copyable error messages and consistent retry actions across the app

### Fixed
- `ClerkService.getConvexToken()` now mints the Clerk `convex` JWT template instead of returning `null`, so authenticated Convex calls no longer run as guests
- Convex queries, mutations, actions, and subscriptions now wait for the WebSocket connection before sending requests, avoiding startup failures such as `bad state: web socket not connected` on the videos screen
- Flutter web no longer crashes during Clerk bootstrap (`MissingPluginException(getApplicationDocumentsDirectory)`): Clerk now uses a SharedPreferences-backed persistor on web instead of `path_provider`

## [2026-04-07]

### Added
- `mutations.dart`: 7 new helpers — `updateNote`, `hidePlaylist`, `unhideItem`, `upsertProgress`, `syncAllPlaylists`, `syncPlaylist`, `removeVideoFromPlaylist`
- `mutations.dart`: `updateSettings` now accepts a raw `Map<String, dynamic>` patch for flexible partial updates
- Security headers in `vercel.json` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Shared `color_utils.dart` with `parseHexColor()` extracted from duplicate screen implementations
- `.env.example` documenting required environment variables
- `shipglows_data/workflow/AUDIT_LOG.md` tracking audit findings and resolutions

### Changed
- All screens now route Convex mutations through `mutations.dart` helpers — no screen imports `convex_provider.dart` directly for mutations
- `createPlaylist` helper updated to match actual backend endpoint (`playlists:createPlaylist`) with `title`, `color`, `privacyStatus` args
- `pubspec.lock` removed from `.gitignore` (must be committed for reproducible builds)
- Router wired to actual screen widgets (was using `_Placeholder` for all routes)
- `main.dart` surfaces bootstrap failures to user instead of swallowing them silently

### Fixed
- App no longer silently uses a placeholder Convex URL when `CONVEX_URL` is not set — fails explicitly with a clear error
