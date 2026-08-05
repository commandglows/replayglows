# Tasks — ReplayGlows App

### Audit: Code

#### Critical
- [x] Harden YouTube OAuth helper parsing/origin handling to avoid malformed-cookie crashes and ambiguous forwarded headers

#### High
- [x] Replace `PlayScreen` placeholders with real player/transcript plumbing and implement queue/options actions
- [ ] Retest `BUG-2026-05-10-001`: YouTube connection check must not fall back to an uninitialized Convex client
- [ ] Persist playlist reorder and complete playlist-detail navigation actions
- [ ] Add automated coverage for auth/bootstrap/OAuth critical paths and run it in CI

#### Medium
- [x] Wire no-op taps in Videos/Playlists/Notes screens to actual routes
- [x] Mark OAuth redirects as non-cacheable (`Cache-Control: no-store`)
- [x] Add CSP/HSTS hardening headers in `vercel.json`
- [x] Tighten Dart analyzer settings (`strict-casts`, `strict-inference`, `strict-raw-types`)
- [ ] Verify Clerk + Convex bootstrap and WebSocket startup end-to-end in a real Flutter environment

### Backlog

#### Android-native opportunities
- [ ] Add Android share-to-ReplayGlows entry for YouTube URLs
  - Context: Let users open a shared YouTube URL directly in ReplayGlows to take notes, access transcripts, or continue a workflow without first adding the video to a YouTube playlist.
  - Notes: This is an Android-native workflow entry point, not a duplicate playlist-import feature.
- [ ] Add Android home screen widgets for continue-watching and new-feed visibility
  - Context: Expose ReplayGlows resume state, playback progress, and recent feed items directly on the Android home screen.
  - Notes: Revisit only if the Android app becomes a primary re-entry surface rather than a thin companion to YouTube.
- [ ] Add Android launcher shortcuts for high-frequency ReplayGlows actions
  - Context: Support direct entry points such as `Resume last video`, `Open Notes`, `Open My Feeds`, and `Refresh YouTube cache`.
  - Notes: Depends on stable Android deep links and validated high-frequency actions.
- [ ] Add an Android Quick Settings tile for quota-safe sync
  - Context: Let users trigger `youtube:startQuotaSafeSync` and inspect idle/syncing/failed state without opening the app.
  - Notes: Depends on native tile wiring and a trustworthy sync-state contract.
- [ ] Add offline-first transcript and notes search on Android with AppSearch
  - Context: Index cached transcripts, notes, video titles, and feed names locally for fast mobile search even with weak connectivity.
  - Notes: Depends on an Android-local indexing model and reindex triggers after sync and transcript updates.

### Audit: Perf

#### Critical
- [ ] None

#### High
- [x] Defer `convex_bridge.js` and `flutter_bootstrap.js` in `web/index.html` to avoid render-blocking startup work on web.
- [x] Make web Convex subscription polling adaptive (short burst + exponential backoff when data is stable or errors occur) to reduce unnecessary wakeups.

#### Medium
- [x] Cache the lowercased search query in `NotesScreen` so filtering does not recompute `toLowerCase()` per row.
