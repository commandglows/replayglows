---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-05-25"
created_at: "2026-05-25 06:34:59 UTC"
updated: "2026-05-25"
updated_at: "2026-05-25 09:24:46 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "youtube-core-feature-parity"
owner: "Diane"
user_story: "En tant qu'utilisateur ReplayGlowz connecte a YouTube, je veux retrouver le coeur des workflows TubeFlow dans l'app Flutter, afin de parcourir, organiser et lire mes videos sans friction ni gaspillage de quota."
confidence: "medium"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "app"
  - "backend"
  - "Flutter Web"
  - "Riverpod"
  - "Convex"
  - "Clerk session auth"
  - "YouTube Data API"
  - "YouTube IFrame API"
depends_on:
  - artifact: "AGENTS.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "app/AGENT.md"
    artifact_version: "1.2.0"
    required_status: "reviewed"
  - artifact: "shipflow_data/business/business.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/business/branding.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/technical/guidelines.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/workflow/specs/replayglowz-youtube-quota-safe-sync.md"
    artifact_version: "1.0.0"
    required_status: "ready"
supersedes: []
evidence:
  - "User requested `/sf-spec pour priorite 1` after the TubeFlow Expo feature-gap audit."
  - "Audit P1 findings: video feed advanced controls, player state and controls, playlist video actions, and YouTube quota safeguards."
  - "Current Flutter feed has unimplemented local filter actions in `app/lib/screens/videos/videos_screen.dart`."
  - "Current Flutter app now routes sync through quota-safe primitives referenced in `app/AGENT.md` and backend `youtube:startQuotaSafeSync`."
  - "Current Flutter web player uses a native iframe wrapper, but player state is not yet bridged back into notes/transcript/progress controls."
  - "Historical TubeFlow source inspected at `https://github.com/dianedef/tubeflow_expo` with relevant components under `apps/web/src/app`, `apps/web/src/components`, and `apps/web/src/hooks`."
next_step: "/sf-start replayglowz-youtube-core-parity-priority-1"
---

# Spec: ReplayGlowz YouTube Core Parity Priority 1

## Title

ReplayGlowz YouTube core parity priority 1

## Status

ready

## User Story

En tant qu'utilisateur ReplayGlowz connecte a YouTube, je veux retrouver le coeur des workflows TubeFlow dans l'app Flutter, afin de parcourir, organiser et lire mes videos sans friction ni gaspillage de quota.

## Problem

ReplayGlowz a maintenant une connexion YouTube fonctionnelle et une base backend proche de l'ancienne application TubeFlow, mais l'interface Flutter n'expose pas encore les workflows essentiels: filtrer et agir sur le feed video, manipuler les videos dans les playlists, garder la lecture synchronisee avec notes/transcripts/progression sur le web, et proteger les actions couteuses avec des garde-fous quota visibles.

## Solution

Porter la priorite 1 de l'ancien TubeFlow sous forme de quatre lots bornes: feed videos avancé, player web avec etat synchronise, actions playlist/video, et UX quota-safe commune. La spec depend de `replayglowz-youtube-quota-safe-sync.md`; elle ne reimplemente pas le moteur quota-safe backend, mais impose que toutes les actions couteuses l'utilisent et que l'UI expose clairement cout, progression et erreurs.

## Minimal Behavior Contract

Quand l'utilisateur ouvre Videos, Playlists ou Play, ReplayGlowz doit afficher les donnees YouTube cachees, signaler clairement l'etat de connexion/sync/quota, puis permettre les actions coeur: masquer/afficher les videos vues, masquer/supprimer/liker/ajouter une video a une playlist, reorganiser ou nettoyer une playlist, et lire une video avec notes/progression/timestamps fiables. Si une action consomme trop du quota YouTube ou modifie YouTube, l'UI doit annoncer ou bloquer selon les seuils quota, le backend doit verifier auth/acces/tokens, et l'echec doit conserver le cache local visible. L'edge case facile a rater est le player web: un iframe qui joue la video ne suffit pas si l'app ne recupere pas le temps courant pour notes, transcripts, seek et progression.

## Scope In

- Flutter web app P1 UI for `VideosScreen`, `PlaylistDetailScreen`, `PlaylistsScreen`, `PlayScreen`, shared media widgets, providers, mutations, and i18n.
- Backend Convex usage where existing actions need minor contract hardening for app parity, especially add/remove/move playlist videos, watched/progress, hidden, likes, quota metrics, and active sync job.
- YouTube iframe state bridge on Flutter web for current time, duration, play/pause, seek, speed where supported, and ended state.
- User-visible quota state for refresh, add, remove, update, delete, and channel-related actions included in P1 surfaces.
- Focused tests and manual QA for authenticated YouTube flows.

## Scope Out

- Browse/Netflix discovery page.
- Mini-player global overlay.
- Study mode and focus mode.
- Transcript provider settings, provider secrets, version management, and transcript job UX beyond preserving timestamp seek compatibility.
- Notes export/share/focus workflows.
- YouTube-wide video search and importing arbitrary external videos by search.
- Marketing site copy, pricing pages, public claims, and entitlement policy changes.
- OAuth client/redirect URI configuration changes unless implementation uncovers a regression.
- New YouTube OAuth scopes without explicit product decision.

## Constraints

- Flutter must not read, store, log, or send YouTube OAuth access/refresh tokens directly; all YouTube Data API calls stay behind Vercel handlers or Convex/server-side actions already authorized by Clerk and ReplayGlowz product access.
- Any action that costs YouTube quota must reuse the quota-safe policy from `replayglowz-youtube-quota-safe-sync.md`
- The Flutter app must use existing Riverpod providers, GoRouter routes, shared error/snackbar helpers, and media widgets before creating new abstractions.
- Web player work must respect Flutter Web platform-view constraints: the YouTube iframe must keep stable dimensions and cannot rely on Flutter overlay behavior that platform views may intercept.
- P1 UI must stay usable on mobile and desktop with stable icon/menu controls; avoid adding large explanatory cards or nested cards inside existing surfaces.
- Implementation must not broaden YouTube OAuth scopes, product entitlements, or public marketing claims.

## Success Behavior

- Videos page supports card/list/summary modes, filters, sort, show/hide watched, visible last-sync/quota state, and contextual actions per video.
- Playlists page and detail page support create/edit/delete/hide/share/reorder, play all, add video, remove video, move to another playlist, and refresh with quota-aware disabled/warning states.
- Play page on web keeps app state synchronized with the iframe so note timestamps, transcript timestamps, saved progress, queue navigation, and seek actions work predictably.
- All expensive YouTube actions go through backend Convex/server actions, never direct client token usage.
- Cached data remains visible on partial failures; UI shows actionable reconnect/retry/quota messages.

## Error Behavior

- If YouTube is disconnected, pages show a connect prompt and do not expose broken action buttons.
- If Convex auth or product access is not ready, actions fail closed with a reload/retry path and no token exposure.
- If quota is above the configured warning/disabled threshold, the action is disabled or requires confirmation according to the quota-safe sync contract.
- If a write action succeeds in YouTube but cache refresh fails, the UI reports partial success and invalidates/refetches cache without deleting unrelated data.
- If a web iframe command fails or the player is not ready, notes/progress actions remain disabled until ready and explain the state.

## Dependencies

- Local versions and packages:
  - Flutter SDK constraint from lockfile: `>=3.38.4`.
  - `flutter_riverpod: ^3.3.1`.
  - `go_router: ^17.2.3`.
  - `youtube_player_flutter: ^9.1.0`, retained for non-web paths.
  - `web: ^1.1.1`, used for Flutter Web DOM interop.
  - `convex` package lock resolves to `1.39.1`.
- Fresh external docs checked on 2026-05-25:
  - Flutter official docs, "Embedding web content into a Flutter web app": `https://docs.flutter.dev/platform-integration/web/web-content-in-flutter`.
  - Flutter API docs, `HtmlElementView`: `https://api.flutter.dev/flutter/widgets/HtmlElementView-class.html`.
  - Google official docs, YouTube IFrame Player API Reference: `https://developers.google.com/youtube/iframe_api_reference`.
  - Google official docs, YouTube Embedded Players and Player Parameters: `https://developers.google.com/youtube/player_parameters`.
  - Convex official docs, Actions: `https://docs.convex.dev/functions/actions`.
  - Clerk official docs, Session object and `getToken()` behavior: `https://clerk.com/docs/js-frontend/reference/objects/session`.
- Freshness verdict: `fresh-docs checked` for readiness. Implementation must still re-check docs if package versions change or if the chosen iframe bridge diverges from these official APIs.
- The existing quota-safe sync spec records official YouTube quota docs checked on 2026-05-24 for quota costs.

## Invariants

- A connected Clerk user is not enough to run YouTube actions; ReplayGlowz product access and YouTube token availability remain separate server-side checks.
- Cached YouTube library data remains the first UI source of truth; failed refreshes must not blank feed, playlist, or player screens.
- UI state cannot be trusted for permissions, quota limits, ownership, playlist membership, or token validity; backend/server actions must enforce those checks.
- Each successful user action must produce a visible UI state change, a toast/snackbar, or refreshed data that proves the action did something.
- Each failed user action must produce a recoverable state with clear retry/reconnect/quota guidance and logs that omit secrets.
- The web player bridge must only enable timestamp-dependent actions after the player reports ready and exposes a trustworthy current time.

## Links & Consequences

- Upstream systems: Clerk JS bridge, Convex auth token, ReplayGlowz entitlement status, YouTube OAuth tokens, Google YouTube Data API, YouTube IFrame API.
- Downstream surfaces: Videos, Playlists overview, Playlist detail, Play, AppShell quota indicator, Stats, i18n, diagnostics, user support messages.
- Data contracts affected: `YouTubeVideo`, `YouTubePlaylist`, watched state, hidden items, playlist/video order, quota metrics, sync jobs, notes timestamps, progress.
- Regression risks: YouTube connect prompts, cached feed loading, playlist sync, iframe playback, notes creation, progress save, and quota stats must be retested.
- Operational consequence: authenticated manual QA is required because YouTube OAuth, private library data, and iframe playback cannot be fully proven by static checks.

## Documentation Coherence

- `app/AGENT.md`: update only if action contracts or runtime flow change beyond the existing quota-safe sync statement.
- `shipflow_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md`: update after implementation to mark P1 gaps closed or partially closed.
- `shipflow_data/workflow/specs/replayglowz-youtube-quota-safe-sync.md`: do not mutate unless implementation changes the quota-safe backend contract.
- `app/lib/i18n/en.dart` and `fr.dart`: keep visible user copy natural in each language; French copy must use accents.
- Public site/pricing docs: no update in this chantier because marketing claims and pricing remain out of scope.
- Changelog/task trackers: update during implementation or ship, not during readiness.

## Edge Cases

- User has cached data but YouTube token is revoked: show cached data, disable write/sync actions, and prompt reconnect without deleting cache.
- User opens multiple tabs and clicks sync/add/remove repeatedly: backend quota/job guards prevent duplicate costly work; UI shows existing progress or busy state.
- User adds/removes/moves a video and YouTube succeeds but cache update fails: show partial success, retry cache refresh, and avoid optimistic data loss.
- User filters to no results: show an empty filtered state distinct from "no library data".
- User starts playback before iframe ready: note/timestamp/progress actions stay disabled until ready.
- User changes route while player is saving progress: progress save is best effort, does not crash navigation, and does not overwrite a newer timestamp with zero.
- Playlist video lacks `playlistItemId`: remove/move actions are hidden or disabled with a clear reason.
- Quota reaches the hard threshold between plan and execution: backend refuses the next costly step and returns a partial/quota state.

## Technical Context

- App: `app` Flutter web, Riverpod, GoRouter, Clerk JS bridge, Convex web bridge.
- Backend: `backend/packages/backend/convex` with YouTube cache/actions, quota metrics, hidden items, watched/progress, playlist order, video order, notes, comments, likes, channel links.
- Existing app contracts:
  - `app/AGENT.md` states Flutter must not loop over every playlist directly and must use `youtube:startQuotaSafeSync`.
  - `VideosArgs` already supports `sortOrder` and `includeWatched`.
  - AppShell already has quota/sync job surface.
  - `WebYoutubeEmbed` provides web iframe playback but not full app-state control.
- Historical references:
  - `apps/web/src/app/videos/page.tsx`
  - `apps/web/src/app/play/page.tsx`
  - `apps/web/src/app/playlists/page.tsx`
  - `apps/web/src/app/playlists/[id]/page.tsx`
  - `apps/web/src/components/SwipeableVideoCard.tsx`
  - `apps/web/src/components/playlists/AddToPlaylistModal.tsx`
  - `apps/web/src/hooks/use-paginated-videos.ts`
  - `apps/web/src/hooks/use-video-progress.ts`
  - `apps/web/src/hooks/use-watched.ts`
  - `apps/web/src/hooks/use-youtube.ts`

## Implementation Tasks

- [ ] Task 1: Freeze the P1 action map and current route contracts.
  - Files: `app/lib/app/router.dart`, `app/lib/providers/providers.dart`, `app/lib/providers/mutations.dart`, `backend/packages/backend/convex/youtube.ts`.
  - Action: List every existing Flutter action for videos/playlists/play and map it to the Convex query/mutation/action used; flag missing backend contracts before UI work.
  - Depends on: None.
  - Validation: `rg -n "syncAllPlaylists|addVideo|removeVideo|toggleLike|markWatched|hideVideo|VideosArgs|youtube:" app/lib backend/packages/backend/convex`.

- [x] Task 2: Implement feed filters, sort, and watched toggle.
  - Files: `app/lib/screens/videos/videos_screen.dart`, `app/lib/providers/providers.dart`, `app/lib/widgets/media/video_card.dart`, `app/lib/widgets/media/video_list_tile.dart`.
  - Action: Replace the current filter stubs with usable controls for the decided feed-level picker: `All videos` plus multi-select ReplayGlowz Feeds. Playlist/channel/date filters are intentionally not exposed in this picker because playlists and channels can be modeled as Feed sources.
  - Depends on: Task 1.
  - Validation: `cd app && flutter analyze`; manual filter QA with cached data.
  - Acceptance: A user can reduce a large feed to one or more ReplayGlowz Feeds without triggering YouTube network calls; selected Feed details are merged and deduped from cached/backend Feed data.

- [ ] Task 3: Add video action menu parity on feed cards and rows.
  - Files: `app/lib/widgets/media/video_card.dart`, `app/lib/widgets/media/video_list_tile.dart`, `app/lib/screens/videos/videos_screen.dart`, `app/lib/providers/mutations.dart`.
  - Action: Add actions for play, share YouTube link, mark watched/unwatched, hide, like/dislike where available, remove from all playlists where available, and add to playlist via modal.
  - Depends on: Tasks 1 and 2.
  - Validation: `cd app && flutter analyze`; manual action QA from card and list modes.
  - Acceptance: Each action gives success/error feedback, invalidates only relevant providers, and keeps cached feed visible on failure.

- [ ] Task 4: Add reusable add-to-playlist modal for existing videos.
  - Files: new or existing widgets under `app/lib/widgets/media/` or `app/lib/screens/playlists/`, `app/lib/providers/providers.dart`, `app/lib/providers/mutations.dart`.
  - Action: Port the useful behavior of old `AddToPlaylistModal`: choose an existing playlist and add the current cached video to it.
  - Depends on: Tasks 1 and 3.
  - Validation: `cd app && flutter analyze`; `cd backend/packages/backend && npm run typecheck` if backend contracts change.
  - Acceptance: Adding a cached video updates YouTube/cache state without full resync and without exposing a YouTube-wide search flow.

- [ ] Task 5: Complete playlist detail actions.
  - Files: `app/lib/screens/playlists/playlist_detail_screen.dart`, `app/lib/providers/mutations.dart`, `backend/packages/backend/convex/youtube.ts`.
  - Action: Add play all, share, add video, move/add to another playlist, remove video with optimistic rollback, mark watched/unwatched, and quota-aware refresh.
  - Depends on: Tasks 1 and 4, plus existing video-order behavior.
  - Validation: `cd app && flutter analyze`; backend typecheck if action signatures change; manual playlist detail QA.
  - Acceptance: Detail screen no longer requires leaving the page for common video organization actions.

- [ ] Task 6: Harden playlist overview actions.
  - Files: `app/lib/screens/playlists/playlists_screen.dart`, `app/lib/widgets/media/playlist_card.dart`.
  - Action: Ensure create/edit/delete/hide/share/reorder/refresh actions have dialogs, loading states, cache invalidation, and quota/permission handling.
  - Depends on: Task 1.
  - Validation: `cd app && flutter analyze`; manual overview QA.
  - Acceptance: Existing subtle `+` behavior remains; destructive actions confirm; edit popup persists YouTube/cache changes coherently.

- [ ] Task 7: Bridge YouTube iframe state into Flutter web.
  - Files: `app/lib/widgets/play/web_youtube_embed.dart`, `app/lib/widgets/play/web_youtube_embed_web.dart`, `app/lib/widgets/play/player_panel.dart`, `app/lib/screens/play/play_screen.dart`.
  - Action: Replace passive iframe-only playback with a web bridge based on the YouTube IFrame API or another supported browser-side control path, exposing ready, currentTime, duration, play/pause, seek, rate, ended, and error callbacks to Flutter.
  - Depends on: Fresh docs checked for Flutter Web `HtmlElementView` and YouTube IFrame API; Task 1 for route/player contracts.
  - Validation: `cd app && flutter analyze`; browser QA on desktop and mobile viewport.
  - Acceptance: Notes created during web playback receive the real timestamp; clicking note/transcript timestamps seeks the iframe; progress saves the real position.

- [ ] Task 8: Restore core play queue controls.
  - Files: `app/lib/screens/play/play_screen.dart`, `app/lib/widgets/play/playback_controls.dart`, `app/lib/widgets/play/player_panel.dart`.
  - Action: Add next/previous queue navigation for playlist/feed contexts and ensure queue drawer selection updates route, metadata, progress, and player state.
  - Depends on: Task 7.
  - Validation: `cd app && flutter analyze`; manual queue QA from feed and playlist detail.
  - Acceptance: Playing from a playlist can continue through adjacent videos without manual back navigation.

- [x] Task 9: Make quota state first-class on P1 actions.
  - Files: `app/lib/widgets/app_shell.dart`, `app/lib/screens/videos/videos_screen.dart`, `app/lib/screens/playlists/playlists_screen.dart`, `app/lib/screens/playlists/playlist_detail_screen.dart`, `app/lib/screens/stats/stats_screen.dart`.
  - Action: Reuse quota/sync-job providers to show warning/disabled states on sync/add/remove/update/delete actions, including estimated cost where available.
  - Depends on: Tasks 1, 4, 5, and 6.
  - Validation: `cd app && flutter analyze`; manual quota blocked/warned QA.
  - Acceptance: A user can see why an action is disabled and how much quota a costly action is expected to use.

- [x] Task 10: Fill i18n strings for P1 surfaces.
  - Files: `app/lib/i18n/en.dart`, `app/lib/i18n/fr.dart`.
  - Action: Add English/French keys for feed filters, watched toggle, add-to-playlist, quota warnings, playlist video actions, player state, and partial failures.
  - Implementation note: audit found no Flutter i18n/ARB/AppLocalizations system in this app yet, so this chantier follows the current hard-coded app convention instead of inventing a new localization layer inside P1.
  - Depends on: Tasks 2-9.
  - Validation: `cd app && flutter analyze`; source review for newly added visible strings.
  - Acceptance: No new P1 visible string is hard-coded unless it follows existing app convention and is explicitly accepted during review.

- [x] Task 11: Add focused tests and manual QA scripts.
  - Files: Flutter tests where present or new focused tests under `app/test`, backend tests where present, plus QA notes in the spec or implementation report.
  - Action: Cover provider parsing/action contract, widget states for connected/disconnected/quota blocked, and backend action contracts touched by P1.
  - Depends on: Tasks 2-10.
  - Validation: `cd app && flutter analyze`; `cd backend/packages/backend && npm run typecheck`; focused tests if feasible.
  - Acceptance: `flutter analyze`, backend `npm run typecheck`, and a manual authenticated YouTube QA checklist pass before ship.

## Acceptance Criteria

- [ ] Videos page filter/sort/watched controls work on cached library data and do not trigger YouTube API calls by themselves.
- [ ] Feed video cards/list rows expose play, share, watched/unwatched, hide, like/dislike if supported, remove, and add-to-playlist actions with visible feedback.
- [ ] Playlist detail supports play all, add video, move/add to another playlist, remove with rollback, reorder, share, watched/unwatched, and quota-aware refresh.
- [ ] Playlist overview create/edit/delete/hide/share/reorder actions are coherent and refresh the visible page state after success.
- [ ] Web player exposes real current time to Flutter; timestamped note creation and timestamp seek work after iframe playback starts.
- [ ] Progress save/restore uses the real web player position and does not save stale zero timestamps after normal playback.
- [ ] Costly YouTube actions show quota warning/disabled states based on existing quota-safe sync policy.
- [ ] No client-side code reads, logs, or transmits YouTube OAuth tokens directly.
- [ ] English and French strings cover all new user-visible P1 states.
- [ ] Focused validation passes: `flutter analyze`, backend `npm run typecheck`, and manual authenticated QA for videos/playlists/play.

## Risks

- YouTube IFrame API integration in Flutter Web can be fragile if platform views and JS interop are not isolated cleanly.
- Write actions can burn quota quickly and must remain user-triggered with clear quota feedback.
- Cached YouTube state can diverge from YouTube after partial write failures; UI must report partial success instead of hiding the mismatch.
- Adding many actions to video cards can clutter mobile UI; prefer icon menus, bottom sheets, and stable dimensions.
- Backend already contains many contracts; duplicating near-identical actions in Flutter providers could increase drift.

## Test Strategy

- Static:
  - `(cd app && flutter analyze)`
  - `(cd backend/packages/backend && npm run typecheck)`
  - `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENT.md shipflow_data`
- Source checks:
  - `rg -n "open search delegate|show filter bottom sheet|direct fetchPlaylistItems|youtubeAccessToken|searchYoutubeVideos|search.list" app/lib backend/packages/backend/convex`
- Manual authenticated QA:
  - Connect YouTube, verify cached Videos list appears without forced sync.
  - Filter/sort videos.
  - Mark watched/unwatched and toggle watched visibility.
  - Add a video to a playlist from feed.
  - Remove/move a video inside playlist detail.
  - Create note during web playback and verify timestamp seek.
  - Trigger a quota-warning action and confirm disabled/warning copy.

## Execution Notes

- Read first:
  - `app/lib/providers/providers.dart`
  - `app/lib/providers/mutations.dart`
  - `app/lib/screens/videos/videos_screen.dart`
  - `app/lib/screens/playlists/playlists_screen.dart`
  - `app/lib/screens/playlists/playlist_detail_screen.dart`
  - `app/lib/screens/play/play_screen.dart`
  - `app/lib/widgets/play/web_youtube_embed_web.dart`
  - `backend/packages/backend/convex/youtube.ts`
  - `backend/packages/backend/convex/metrics.ts`
- Use existing patterns:
  - Riverpod `FutureProvider` and provider argument objects for data loading.
  - `showErrorSnackBar` and existing app state widgets for recoverable failures.
  - Existing media cards and playlist cards before adding new display primitives.
  - Backend Convex actions/mutations for YouTube side effects; no direct client YouTube API calls.
- Avoid:
  - New OAuth scopes.
  - Client-side token handling.
  - Full feed resync after every write action when targeted cache updates exist.
  - Global polling loops without backoff.
  - One-off UI abstractions that duplicate existing media widgets.
- Stop conditions:
  - Fresh docs contradict the planned iframe bridge.
  - Backend lacks a safe action for a planned write and adding it requires new OAuth scopes.
  - Manual QA cannot verify authenticated YouTube behavior.
  - Quota warnings cannot be shown for a costly action.

## Open Questions

None.

## Documentation Update Notes

- Update `app/AGENT.md` only if the action contracts or runtime flow change.
- Update `shipflow_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md` only after implementation if gaps are closed.
- Add changelog/task entries during implementation/ship, not in this spec run.

## Current Chantier Flow

| Stage | Status | Notes |
|-------|--------|-------|
| sf-spec | complete | Priority 1 spec created from TubeFlow Expo feature-gap audit. |
| sf-ready | complete | Readiness review passed, then spec was realigned after user removed YouTube search from scope. |
| sf-start | implemented | Implemented contract fixes, web player bridge, cached feed filters/actions, quota-aware add/copy/remove/move/refresh actions, playlist ID contract fixes, YouTube-backed playlist detail actions, saved-order application, and focused model coverage. |
| sf-verify | pending | Static checks pass; authenticated YouTube preview QA remains before ship. |
| sf-end | pending | Close audit gaps and update tracking after implementation. |
| sf-ship | pending | Push/deploy after verification. |

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-05-25 06:34:59 UTC | sf-spec | GPT-5 Codex | Created Priority 1 YouTube core parity spec from audit intake. | draft spec created | `/sf-ready replayglowz-youtube-core-parity-priority-1` |
| 2026-05-25 09:06:41 UTC | sf-ready | GPT-5 Codex | Reviewed and completed readiness gate for Priority 1 YouTube core parity. | ready | `/sf-start replayglowz-youtube-core-parity-priority-1` |
| 2026-05-25 09:24:46 UTC | sf-ready | GPT-5 Codex | Rechecked user-edited spec and removed stale YouTube search requirements from P1 scope. | ready | `/sf-start replayglowz-youtube-core-parity-priority-1` |
| 2026-05-25 09:39:53 UTC | sf-start | GPT-5 Codex | Implemented initial P1 contract fixes and web player bridge with delegated workers; integrated playlist removal through the YouTube action. | partial | Continue `/sf-start replayglowz-youtube-core-parity-priority-1` for feed, playlist actions, quota UI, i18n, tests, and preview QA. |
| 2026-05-25 10:06:00 UTC | sf-start | GPT-5 Codex | Added cached feed sort/show-watched/playlist filtering, feed video action menus, add-to-playlist from feed, and playlist detail share/watched actions. | partial | Continue quota UI, remaining playlist actions, i18n, tests, and preview QA. |
| 2026-05-25 10:22:21 UTC | sf-start | GPT-5 Codex | Continued playlist detail action parity with copy-to-playlist, YouTube-backed move up/down, targeted provider refreshes, and quota prompts for playlist item writes. | partial | Continue playlist overview parity, i18n cleanup, tests, and authenticated preview QA. |
| 2026-05-25 10:39:00 UTC | sf-start | GPT-5 Codex | Integrated quota guard, fixed YouTube playlist ID routing/action contracts, applied saved playlist video order in backend query, added playlist item model coverage, and ran static checks. | implemented | `/sf-verify replayglowz-youtube-core-parity-priority-1` then authenticated preview QA. |
