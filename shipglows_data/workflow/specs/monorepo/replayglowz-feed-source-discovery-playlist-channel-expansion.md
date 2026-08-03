---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.1"
project: "replayglowz"
created: "2026-05-30"
created_at: "2026-05-30 20:22:49 UTC"
updated: "2026-05-31"
updated_at: "2026-05-31 21:01:44 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "feed-source-discovery-playlist-channel-expansion"
owner: "Diane"
user_story: "En tant qu'utilisateur ReplayGlowz qui crée un Feed thématique, je veux ajouter des chaînes depuis mes abonnements ou extraire les chaînes présentes dans une playlist, afin de transformer une liste statique en Feed live qui se met à jour avec les prochaines vidéos des chaînes."
confidence: "high"
risk_level: "medium"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "app"
  - "backend"
  - "Flutter Web"
  - "Riverpod"
  - "Convex"
  - "YouTube cache"
depends_on:
  - artifact: "AGENTS.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipglows_data/workflow/specs/replayglowz-virtual-feeds-channel-aggregators.md"
    artifact_version: "1.0.0"
    required_status: "ready"
supersedes: []
evidence:
  - "User testing 2026-05-30: adding a playlist source to a Feed works and Play all launches videos from that source."
  - "User request 2026-05-30: make it possible to add channels to a Feed from subscriptions, or add the channels whose videos are integrated in a playlist."
  - "Current Flutter source picker in `virtual_feed_detail_screen.dart` already lists subscriptions, cached channels, and playlists as flat candidates."
  - "Current Convex `virtualFeeds:addFeedSource` already supports source types `channel`, `playlist`, and `subscriptions`."
  - "Current cached videos include optional `youtubeChannelId`, enabling playlist-to-channel extraction when playlist videos have owner channel metadata."
next_step: "/sf-start replayglowz-feed-source-discovery-playlist-channel-expansion"
---

# Spec: ReplayGlowz Feed Source Discovery and Playlist Channel Expansion

## Title

ReplayGlowz Feed source discovery and playlist channel expansion

## Status

ready

## User Story

En tant qu'utilisateur ReplayGlowz qui crée un Feed thématique, je veux ajouter des chaînes depuis mes abonnements ou extraire les chaînes présentes dans une playlist, afin de transformer une liste statique en Feed live qui se met à jour avec les prochaines vidéos des chaînes.

## Minimal Behavior Contract

Dans le détail d'un Feed, l'action `Ajouter une source` doit aider l'utilisateur à choisir entre quatre intentions distinctes: ajouter des chaînes depuis ses abonnements, ajouter une playlist comme contenu statique courant, utiliser une playlist comme point de départ pour ajouter les chaînes qui y apparaissent, ou ajouter l'agrégat `Tous les abonnements`. Ajouter une playlist garde le comportement actuel: ses vidéos connues alimentent le Feed. Ajouter les chaînes d'une playlist crée des sources `channel` pour les chaînes détectées dans les vidéos cachées de cette playlist, sans modifier YouTube et sans appeler d'endpoint d'écriture YouTube. Si aucune chaîne exploitable n'est détectable, si les vidéos manquent de `youtubeChannelId`, ou si certaines chaînes sont déjà dans le Feed, l'UI doit expliquer le résultat partiel et laisser l'utilisateur récupérer par refresh cache ou choix manuel. Les résultats d'ajout en lot doivent être lus depuis la réponse structurée du backend, même si Convex renvoie la charge utile sous forme de chaîne JSON, afin d'éviter les notifications faux zéro.

## Success Behavior

- Preconditions: l'utilisateur est authentifié, a un Feed ReplayGlowz existant, et dispose de playlists/vidéos cachées ou de chaînes d'abonnements cachées.
- Trigger: l'utilisateur ouvre un Feed, appuie sur `Ajouter une source`, puis choisit soit une chaîne d'abonnement, soit une playlist, soit l'action d'extraction des chaînes d'une playlist.
- User result: le picker explique clairement la différence entre `Playlist YouTube` et `Chaînes d'une playlist`.
- User result: l'utilisateur peut chercher/filtrer les chaînes d'abonnements et les ajouter comme sources `channel`.
- User result: après sélection d'une playlist pour extraction, ReplayGlowz affiche les chaînes détectées, indique celles déjà ajoutées, puis permet d'ajouter les chaînes sélectionnées en une action.
- User result: le Feed affiche ensuite ces chaînes dans `Sources`, et `Play all` lit les vidéos connues provenant de ces chaînes.
- System effect: les sources `channel` sont créées dans `virtualFeedSources`; aucune playlist YouTube n'est créée ou modifiée.
- System effect: l'ajout en lot est idempotent: les chaînes déjà présentes ne provoquent pas d'erreur bloquante.
- Success proof: backend typecheck, Flutter analyze, source scan quota-safe, et QA manuelle Feed -> Add source -> extract playlist channels -> Play all.

## Error Behavior

- If no subscriptions cache exists: show an empty state explaining that channels must be synced/imported first, with the existing quota-aware refresh action.
- If a playlist has no cached videos: show that no channel can be detected from the current cache and propose refreshing the playlist cache.
- If playlist videos lack `youtubeChannelId`: show a partial/unavailable metadata message rather than adding broken sources.
- If some channels are already sources: skip them or mark them as already added, and still allow adding the remaining channels.
- If all detected channels are already present: treat the operation as a successful no-op and explain that the Feed already follows these channels.
- If the backend returns a serialized JSON mutation result: decode it before computing added/already-added/rejected counts.
- If backend validation rejects a source because the channel is neither in `youtubeChannelsCache` nor in the user's cached playlist videos: do not create an invalid source; show a recoverable error and offer adding the playlist itself instead.
- Must never happen: YouTube write endpoint calls, cross-user channel/playlist leakage, hidden token/log leakage, duplicate source rows, a generic server error when the final state is a no-op success, or a zero-added notification caused only by client-side result parsing latency.

## Problem

The current Feed source picker technically supports channels, subscriptions, and playlists, but it presents them as a flat list. In testing, adding a playlist source worked, but the UX did not make the deeper product distinction obvious: a playlist source replays the current videos, while channel sources make the Feed live for future videos from those channels. The user now wants a way to build live thematic Feeds from either existing subscriptions or the channels already represented inside a YouTube playlist.

## Solution

Split `Ajouter une source` into intention-first choices and add a playlist-channel expansion flow. The UI should let the user add individual cached subscription channels directly, add a playlist as a playlist source, or select a playlist and derive candidate channel sources from the cached videos in that playlist. The backend should expose a safe cache-only query/mutation surface for detecting channel candidates and adding the selected channels idempotently to the Feed.

## Scope In

- UI restructuring of the Feed source picker into clear source modes:
  - `Chaînes depuis mes abonnements`
  - `Playlist YouTube`
  - `Chaînes d'une playlist`
  - optional `Tous mes abonnements` when available
- Search/filter for cached subscription channels in the picker.
- A playlist-to-channel candidate flow based on cached `youtubeVideosCache` rows for the selected playlist.
- Candidate preview showing channel title, estimated videos currently visible from that channel, already-added status, and missing-metadata exclusions when useful.
- Batch add selected detected channels as `channel` sources in a Feed.
- Idempotent backend behavior for duplicates and stale UI states.
- Copy/i18n in French and English explaining static playlist source vs live channel source.
- Manual QA checklist or notes for the new source-discovery flow during implementation.

## Scope Out

- No public YouTube search for channels.
- No new OAuth scopes.
- No new YouTube write endpoints.
- No automatic background sync of every channel extracted from a playlist.
- No export of a ReplayGlowz Feed into a real YouTube playlist.
- No AI recommendation or semantic clustering of channels.
- No forced migration of existing playlist sources into channel sources.
- No public marketing site changes in this chantier unless a later content spec asks for it.

## Constraints

- The flow must remain cache-first by default. Reading cached playlist videos and cached channels must not spend YouTube quota.
- The user must understand the difference between adding a playlist and adding channels from a playlist.
- The backend must validate every source against the authenticated `userId`.
- The backend must not trust Flutter-provided channel titles or candidate lists as ownership proof.
- Channel-source validation must accept a channel when either `youtubeChannelsCache` contains that channel for the user or `youtubeVideosCache` contains at least one user-owned cached video with that `youtubeChannelId`; this supports extracting channels from playlists that are not subscriptions.
- Playlist-to-channel extraction can only use videos that have a reliable `youtubeChannelId`; rows without channel IDs must be skipped and counted as missing metadata.
- The UX must stay usable on mobile; avoid one huge flat list when the account has many subscriptions/playlists.
- Existing source types `channel`, `playlist`, and `subscriptions` should be reused unless implementation reveals a strong reason to add a new source type.

## Test Contract

- surface: Flutter Feed detail source picker, Convex virtual feed functions, cached YouTube playlist/video/channel data, and Play queue.
- proof_profile: mixed automated and manual proof.
- proof_order:
  1. Backend typecheck for Convex functions.
  2. Backend source/test proof for candidate grouping, ownership, channel-source validation, and duplicate/no-op handling.
  3. Flutter analyze for UI/provider/i18n changes.
  4. Source scan confirming no YouTube write endpoint is called by Feed local source actions.
  5. Authenticated browser/manual QA after explicit ship.
- checklist_path: `shipglows_data/workflow/test-checklists/replayglowz-feed-source-discovery-playlist-channel-expansion.md`
- required_scenario_ids: `CA 1` through `CA 12`.
- required_results: source modes are clear, subscription channels can be added, playlist source behavior remains unchanged, playlist-channel extraction adds live `channel` sources, duplicate/no-op handling is user-safe, local actions remain quota-free, and Play all uses the resulting Feed queue.
- manual_proof:
  - Authenticated account with at least one playlist containing videos from multiple channels.
  - Create/open Feed -> Add source -> Chaînes d'une playlist -> select playlist -> add detected channels -> Play all.
  - Confirm duplicate/already-added channels do not show generic server errors.
- exception_with_proof:
  - If the test account lacks subscriptions cache, playlist-to-channel extraction can still be verified from cached playlist videos, but the subscriptions-channel picker must be validated later with an account that has cached subscriptions.
- exception_without_proof: not allowed for backend ownership checks or quota-safe source scan.

## Dependencies

- Existing spec: `shipglows_data/workflow/specs/replayglowz-virtual-feeds-channel-aggregators.md`
- Existing backend:
  - `backend/packages/backend/convex/schema.ts`
  - `backend/packages/backend/convex/virtualFeeds.ts`
  - `backend/packages/backend/convex/youtube.ts`
- Existing Flutter:
  - `app/lib/screens/playlists/virtual_feed_detail_screen.dart`
  - `app/lib/providers/providers.dart`
  - `app/lib/providers/mutations.dart`
  - `app/lib/models/virtual_feed.dart`
  - `app/lib/models/video.dart`
  - `app/lib/models/youtube_channel.dart`
  - `app/lib/i18n/en.dart`
  - `app/lib/i18n/fr.dart`
- Fresh external docs verdict: `fresh-docs not needed` for this spec because the intended implementation uses existing cached Convex data and existing source types; re-check official YouTube Data API docs only if implementation adds a new YouTube endpoint or changes quota behavior.

## Invariants

- A Feed local action must not spend YouTube quota.
- A Feed source must be justified by authenticated user-owned cached data: subscription channel cache, playlist cache, or cached videos from the user's playlists.
- Duplicate source adds must be idempotent or user-recoverable, never a generic server error.
- The same `youtubeVideoId` should still appear once in Feed playback even if multiple extracted channel sources and playlist sources match it.
- Adding channels from a playlist must not remove the playlist source if the playlist was already added; the user controls whether both remain.
- The source picker must not expose channels/playlists from another user.
- The user must be able to cancel before batch adding detected channels.

## Links & Consequences

- Backend:
  - May need a new query such as `virtualFeeds:listPlaylistChannelCandidates`.
  - Must add a batch mutation such as `virtualFeeds:addFeedSources` for selected channel sources so partial/no-op/error reporting is deterministic.
  - Must preserve ownership and no-YouTube-write guarantees.
- Flutter:
  - Source picker likely needs a small internal mode/step state instead of one flat candidate list.
  - New i18n strings are required for mode names, explanatory copy, partial metadata, duplicate/no-op outcomes, and batch results.
  - Feed detail source list and Play queue should keep existing behavior after sources are added.
- Product:
  - This strengthens the core Feed value proposition: transforming static playlists into live thematic channel feeds.
  - Onboarding/copy should emphasize "playlist = current videos" vs "channels = live future videos".
- Operations:
  - No deploy-time migration expected if source type stays `channel`.

## Documentation Coherence

- Update the existing Virtual Feeds spec or implementation notes only if this new flow changes the core Feed contract.
- Update app-level onboarding/copy in i18n as part of implementation.
- Consider updating `app/AGENT.md` after implementation if `Chaînes d'une playlist` becomes a formal app contract.
- No marketing/pricing/site copy change in this chantier.
- Add changelog notes only during ship.

## Edge Cases

- Playlist contains one channel only.
- Playlist contains many channels; user should be able to search/select all/select none.
- Playlist contains duplicate videos from the same channel.
- Playlist contains videos without `youtubeChannelId`.
- Some detected channels are already sources in the Feed.
- Detected channel is not present in `youtubeChannelsCache` because the user is not subscribed or the cache has not been refreshed; backend can still accept it when the channel is present in the user's cached playlist videos.
- User adds both the playlist source and extracted channel sources, causing overlapping videos; dedupe must still hold.
- User removes one of the extracted channel sources while playlist source remains; playlist videos should still appear via the playlist source.
- User opens picker while channels/playlists providers are loading or erroring.
- User uses multiple tabs and another tab adds the same channel sources first.

## Implementation Tasks

- [x] Task 1: Add backend candidate query for playlist-to-channel extraction.
  - File: `backend/packages/backend/convex/virtualFeeds.ts`
  - Action: Add a query that accepts `virtualFeedId` and `youtubePlaylistId`, validates ownership, reads cached videos for that playlist, groups by `youtubeChannelId`, joins/marks known channel cache entries when available, and returns candidates with counts, title from cached video/channel data, thumbnail when known, `alreadyAdded`, and `missingMetadataCount`.
  - User story link: Enables turning a static playlist into live channel sources.
  - Depends on: Existing virtual Feed schema.
  - Validate with: `(cd backend/packages/backend && npm run typecheck)`
  - Notes: Do not call YouTube; use cache only.

- [x] Task 2: Add backend batch add path.
  - File: `backend/packages/backend/convex/virtualFeeds.ts`
  - Action: Add `addFeedSources` for multiple channel sources with per-source outcome reporting (`added`, `alreadyAdded`, `rejected`) and the same ownership/cache validation as single-source add.
  - User story link: Lets user add several detected channels without repetitive manual taps.
  - Depends on: Task 1.
  - Validate with: backend typecheck and duplicate-source sanity proof.
  - Notes: Use one batch mutation to avoid ambiguous partial UI state and to produce a clear summary snackbar/result.

- [x] Task 3: Refactor source picker into source-mode flow.
  - File: `app/lib/screens/playlists/virtual_feed_detail_screen.dart`
  - Action: Replace the flat candidate list with mode choices for subscription channels, playlist source, playlist channel extraction, and all subscriptions when available.
  - User story link: Makes the user understand what source type they are adding.
  - Depends on: Task 1.
  - Validate with: `(cd app && flutter analyze)`
  - Notes: Keep layout mobile-friendly; avoid nested card-heavy UI.

- [x] Task 4: Add searchable channel subscription picker.
  - File: `app/lib/screens/playlists/virtual_feed_detail_screen.dart`
  - Action: Add search/filter and already-added indicators for cached subscription channels; let the user add one or multiple channel sources.
  - User story link: User can build a theme directly from subscriptions.
  - Depends on: Task 3.
  - Validate with: Flutter analyze and manual QA with cached subscriptions.
  - Notes: If batch selection is added here, reuse the same result handling as playlist extraction.

- [x] Task 5: Add playlist-to-channel extraction UI.
  - File: `app/lib/screens/playlists/virtual_feed_detail_screen.dart`
  - Action: Let user choose a playlist, load candidate channels, show counts/already-added/missing metadata, select candidates, and add them as channel sources.
  - User story link: User can transform an existing playlist into a live Feed.
  - Depends on: Tasks 1-3.
  - Validate with: Flutter analyze and manual QA on playlist with multiple channels.
  - Notes: Make the copy explicit: this follows the channels for future videos; it does not copy videos into YouTube.

- [x] Task 6: Add i18n and result copy.
  - File: `app/lib/i18n/en.dart`, `app/lib/i18n/fr.dart`
  - Action: Add labels and messages for source modes, static-vs-live explanation, already added channels, partial metadata, no candidates, successful batch add, and no-op success.
  - User story link: Reduces confusion during Feed creation.
  - Depends on: Tasks 3-5.
  - Validate with: Flutter analyze and visual/browser copy review after ship.

- [x] Task 7: Add verification/source scans.
  - File: `shipglows_data/workflow/test-checklists/replayglowz-feed-source-discovery-playlist-channel-expansion.md` or implementation QA notes if checklist style is not used.
  - Action: Record manual scenarios and run source scan for forbidden YouTube write endpoints in Feed local source code paths.
  - User story link: Proves the new source discovery flow stays quota-safe.
  - Depends on: Tasks 1-6.
  - Validate with: metadata lint and manual QA evidence.

## Acceptance Criteria

- [ ] CA 1: Given a Feed detail screen, when the user clicks `Ajouter une source`, then the picker shows distinct source intentions instead of one ambiguous flat list.
- [ ] CA 2: Given cached subscription channels, when the user opens `Chaînes depuis mes abonnements`, then they can search and add a channel source to the Feed.
- [ ] CA 3: Given a playlist source option, when the user selects `Playlist YouTube`, then the existing behavior remains: the playlist's known videos feed the Feed as a playlist source.
- [ ] CA 4: Given a playlist with cached videos from multiple channels, when the user selects `Chaînes d'une playlist`, then ReplayGlowz shows detected channel candidates with video counts.
- [ ] CA 5: Given detected channel candidates, when the user selects several and confirms, then ReplayGlowz adds them as `channel` sources in one recoverable flow.
- [ ] CA 6: Given some detected channels are already Feed sources, when the user confirms, then those channels are skipped or marked already added without a generic server error.
- [ ] CA 7: Given videos in the playlist lack `youtubeChannelId`, when candidates are shown, then the UI explains that some videos could not identify a channel.
- [ ] CA 8: Given no usable channels are detected, when the candidate query returns empty, then the UI explains why and offers adding the playlist itself or refreshing cache where relevant.
- [ ] CA 9: Given extracted channel sources are added, when the user clicks `Play all`, then videos from those channels appear in the existing Feed playback order and remain deduped.
- [ ] CA 10: Given local Feed source discovery/add actions, when they run, then no YouTube write endpoint is called and no quota warning is shown unless the user explicitly refreshes cache.
- [ ] CA 11: Given another user guesses a Feed or playlist ID, when they call the candidate query or batch add mutation, then Convex rejects access.
- [ ] CA 12: Given the app is in French or English, when the user uses the flow, then copy distinguishes static playlist content from live channel following.
- [ ] CA 12b: Given the backend returns a structured or serialized batch-add result, when the user adds playlist channels, then the notification reports the real added/already-added/rejected counts.

## Extension: Subscription Import and Playlist Channel Metadata Backfill

User feedback on 2026-05-30 clarified that both branches are important:
subscription-based Feed creation and playlist-derived channel Feed creation. The
subscription branch must expose its YouTube API import explicitly from the Feed
source picker when `youtubeChannelsCache` is empty. The playlist-derived branch
must not depend on subscription cache and must be able to recover older cached
playlist videos that predate `youtubeChannelId` storage.

### Extension Scope

- In the Feed source picker, if no subscription channels are cached, `Chaînes
  depuis mes abonnements` should invite the user to import YouTube subscriptions
  and call the existing `youtube:fetchYoutubeSubscriptions` action after quota
  confirmation.
- In the `Tous les abonnements` source path, if no subscription cache exists,
  import subscriptions first and then add the aggregate subscription source when
  the import returns channels.
- Add a user-triggered backend action to backfill missing `youtubeChannelId` and
  `channelTitle` onto existing cached playlist videos using `videos.list`, with
  ownership validation and quota metrics.
- In the `Chaînes d'une playlist` flow, when candidate extraction reports
  missing metadata, offer a button to detect missing channels and refresh the
  candidate query.
- Keep the normal playlist-channel candidate query cache-only. Only the explicit
  missing-channel detection button may spend YouTube quota.

### Extension Acceptance Criteria

- [x] CA 13: If subscription channel cache is empty, the Feed source picker lets
  the user import YouTube subscriptions instead of silently disabling the branch.
- [x] CA 14: Importing subscriptions from the Feed picker uses the existing
  YouTube `subscriptions.list` path and refreshes the cached channel providers.
- [x] CA 15: If the user chooses the aggregate `Tous les abonnements` source with
  an empty subscription cache, ReplayGlowz imports subscriptions and then adds
  the aggregate source when channels are available.
- [x] CA 16: If cached playlist videos lack `youtubeChannelId`, the playlist
  channel extraction sheet offers an explicit metadata backfill action.
- [x] CA 17: The metadata backfill validates playlist ownership, calls
  `videos.list` only for cached videos missing channel metadata, logs quota, and
  patches cached videos for the user.
- [x] CA 18: The normal playlist-channel extraction query remains cache-only and
  does not call YouTube.

## Test Strategy

- Backend:
  - Run `(cd backend/packages/backend && npm run typecheck)`.
  - Add or run targeted tests if the backend test harness exists for candidate grouping, ownership denial, channel-source validation from cached playlist videos, duplicate/no-op adds, and missing metadata.
  - Source scan for forbidden YouTube write endpoints in `virtualFeeds.ts` and any new Feed source files.
- Flutter:
  - Run `(cd app && flutter analyze)`.
  - Run targeted widget/model tests if practical for source mode states and candidate result handling.
  - Manual visual QA for mobile-sized picker and desktop.
- Browser/manual after ship:
  - Use authenticated test account.
  - Create/open Feed `tech`.
  - Add one channel from subscriptions.
  - Extract channels from an existing playlist.
  - Confirm sources appear and `Play all` works.
  - Confirm duplicate/no-op path does not show `Could not add source`.

## Risks

- User confusion between playlist source and channel extraction: mitigate with intention-first UI and copy.
- Missing `youtubeChannelId` on cached videos: mitigate with partial metadata count and fallback to adding playlist itself.
- Backend fan-out or large playlists: mitigate with bounded query result, grouping server-side, and pagination/limits if needed.
- Partial batch adds: mitigate with idempotent adds and aggregated success/no-op/error reporting.
- Ownership leak: mitigate by validating Feed, playlist, videos, and channel cache against `userId`.
- Scope creep into YouTube public search or background sync: explicitly out of scope.

## Execution Notes

- Read first:
  - `app/lib/screens/playlists/virtual_feed_detail_screen.dart`
  - `backend/packages/backend/convex/virtualFeeds.ts`
  - `backend/packages/backend/convex/schema.ts`
  - `app/lib/providers/providers.dart`
  - `app/lib/providers/mutations.dart`
  - `app/lib/i18n/en.dart`
  - `app/lib/i18n/fr.dart`
- Implementation shape:
  1. Backend candidate query and batch/idempotent add contract.
  2. Flutter source-mode state and copy.
  3. Subscription channel search.
  4. Playlist-channel extraction preview and confirm.
  5. Validation and browser/manual proof after explicit ship.
- Stop and ask if implementation would need public YouTube search, new OAuth scopes, background sync, or exporting to YouTube playlists.
- Current repo state at spec creation: local branch is ahead of origin with unpushed commits for Feed onboarding copy and idempotent source add; do not push without explicit operator instruction.

## Open Questions

None.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-05-30 20:22:49 UTC | sf-spec | GPT-5 Codex | Created dedicated spec for Feed source discovery, subscription-channel selection, and playlist-to-channel expansion based on the user's testing feedback and sf-explore discussion. | draft spec created | `/sf-ready replayglowz-feed-source-discovery-playlist-channel-expansion` |
| 2026-05-30 20:36:41 UTC | sf-ready | GPT-5 Codex | Reviewed readiness, tightened Test Contract, resolved batch-add ambiguity, clarified channel validation from cached playlist videos, and marked the spec ready. | ready | `/sf-start replayglowz-feed-source-discovery-playlist-channel-expansion` |
| 2026-05-30 21:02:00 UTC | sf-build | GPT-5 Codex | Implemented backend playlist-channel candidate extraction, idempotent batch channel-source add, intention-first Flutter source picker, subscription search, playlist-channel extraction UI, i18n copy, and checklist evidence. | implemented | `/sf-verify replayglowz-feed-source-discovery-playlist-channel-expansion` |
| 2026-05-30 21:10:04 UTC | sf-build | GPT-5 Codex | Verified local checks, deployed Convex and Vercel production, ran authenticated browser QA on the test account, and cleaned the temporary QA Feed. | shipped | done |
| 2026-05-30 22:22:51 UTC | sf-build | GPT-5 Codex | Added explicit subscription import from the Feed source picker and a quota-explicit playlist video channel metadata backfill for older cached videos missing `youtubeChannelId`. | implemented | `/sf-verify replayglowz-feed-source-discovery-playlist-channel-expansion` |
| 2026-05-30 22:33:06 UTC | sf-build | GPT-5 Codex | Verified extension locally, deployed Convex and Vercel production, confirmed production build SHA, tested subscription import UI on the authenticated test account, and cleaned the temporary QA Feed. | shipped | done |

## Current Chantier Flow

| Phase | Status | Notes |
|-------|--------|-------|
| sf-spec | complete | Draft created from user testing feedback and exploration; no implementation performed. |
| sf-ready | complete | Ready after tightening proof contract, backend source validation semantics, batch mutation decision, and language clarity for user-facing source modes. |
| sf-start | complete | Implemented source discovery expansion plus subscription import and playlist channel-metadata backfill extension. |
| sf-verify | complete | Backend typecheck, Flutter analyze/test, metadata lint, diff quota scan, Convex deploy proof, Vercel production proof, and authenticated browser proof completed for the extension. |
| sf-end | complete | Checklist updated with extension evidence and fixture limits; temporary QA Feed cleaned from the test account. |
| sf-ship | complete | Convex deployed to production and `main` pushed to GitHub; Vercel production deployment is Ready on `app.replayglowz.com`. |
