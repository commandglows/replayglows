---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglows"
created: "2026-06-10"
created_at: "2026-06-10 07:47:08 UTC"
updated: "2026-06-10"
updated_at: "2026-06-10 07:50:26 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "advanced-feed-source-filtering"
owner: "Diane"
user_story: "En tant qu'utilisatrice ReplayGlows qui prepare une session de lecture depuis le Feed principal, je veux affiner les sources incluses dans mes feeds selectionnes, afin de masquer ponctuellement une chaine ou une source trop bruyante sans modifier le feed lui-meme."
confidence: "high"
risk_level: "medium"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "app"
  - "Flutter Web"
  - "Riverpod"
  - "Convex"
  - "ReplayGlows virtual feeds"
depends_on:
  - artifact: "AGENT.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "app/AGENT.md"
    artifact_version: "1.3.0"
    required_status: "reviewed"
  - artifact: "shipglows_data/workflow/specs/replayglows-virtual-feeds-channel-aggregators.md"
    artifact_version: "1.0.1"
    required_status: "ready"
  - artifact: "shipglows_data/workflow/specs/replayglows-feed-source-discovery-playlist-channel-expansion.md"
    artifact_version: "1.0.1"
    required_status: "ready"
supersedes: []
evidence:
  - "User request 2026-06-10: recover the earlier idea of selecting sources inside selected feeds, but only as an advanced progressive-disclosure mode."
  - "Current `videos_screen.dart` feed picker only supports `All videos` plus multi-select ReplayGlows feeds."
  - "Current `VirtualFeedSource` model still exposes feed sources with source type, id, title, active state, and video count."
  - "Current `YouTubeVideo` model can carry `feedSourceType`, `feedSourceId`, and `feedSourceTitle` on virtual feed detail responses."
  - "Current main Feed merge path uses `virtualFeedDetailsProvider` and `_mergeFeedVideos`, so selected feed detail data is already available when feed filters are active."
next_step: "/sf-start replayglows-advanced-feed-source-filtering"
---

# Spec: ReplayGlows Advanced Feed Source Filtering

## Title

ReplayGlows advanced feed source filtering

## Status

ready

## User Story

En tant qu'utilisatrice ReplayGlows qui prepare une session de lecture depuis le Feed principal, je veux affiner les sources incluses dans mes feeds selectionnes, afin de masquer ponctuellement une chaine ou une source trop bruyante sans modifier le feed lui-meme.

## Minimal Behavior Contract

Quand l'utilisateur ouvre le filtre du Feed principal, le mode simple doit rester centre sur `Toutes les videos` et la selection de feeds ReplayGlows. Si au moins un feed est selectionne, l'utilisateur peut ouvrir un mode avance `Affiner les sources` qui liste les sources actives de ces feeds et permet d'en decocher certaines pour la session de lecture. Appliquer le filtre doit retirer de la vue Feed et de la queue Play les videos provenant des sources exclues, sans desactiver, supprimer, reordonner, ni modifier les sources dans le feed d'origine. Si les donnees de source ne sont pas disponibles ou deviennent obsoletes, l'UI doit rester recuperable, ignorer les exclusions invalides, et expliquer que l'affinage depend des details de feed charges. L'edge case facile a rater est qu'une meme video peut venir de plusieurs feeds ou sources: elle ne doit etre masquee que si toutes ses appartenances actuellement selectionnees sont exclues.

## Success Behavior

- Preconditions: l'utilisateur est authentifie, YouTube est connecte, et au moins un Feed ReplayGlows actif existe avec des sources actives.
- Trigger: l'utilisateur ouvre la page Feed, selectionne un ou plusieurs feeds dans le picker, puis ouvre `Affiner les sources`.
- User result: le picker simple reste lisible; le mode source n'apparait pas avant qu'un feed soit selectionne ou avant une action explicite.
- User result: les sources sont groupees par feed, avec leur titre, type lisible, compteur quand disponible, et etat coche/decoché.
- User result: l'utilisateur peut decocher une source bruyante, appliquer le filtre, et voir immediatement les videos de cette source disparaitre du Feed principal.
- User result: la queue Play utilise exactement les videos visibles apres affinage; precedent/suivant et retour Feed restent coherents.
- User result: l'utilisateur peut revenir a `Toutes les videos` ou `Effacer les filtres`, ce qui vide aussi les exclusions de sources.
- System effect: l'etat d'exclusion de sources est stocke comme preference locale ou etat filtre utilisateur, pas comme mutation Convex de `virtualFeedSources.isActive`.
- System effect: aucune action d'affinage ne depense de quota YouTube et aucun endpoint YouTube n'est appele.
- Success proof: Flutter analyze, tests unit/widget sur l'etat de filtre, et QA mobile/web du picker simple puis avance.

## Error Behavior

- If no feed is selected: do not show the advanced source selector as a primary control; show it disabled or hidden with no dead action.
- If selected feed details are loading: show a loading state inside the advanced mode and keep the current applied filter unchanged.
- If selected feed details fail to load: show an actionable error and let the user apply/clear the feed-level filter without source exclusions.
- If a previously excluded source no longer exists in the selected feeds: prune the stale exclusion and do not hide unrelated videos.
- If a video appears through multiple selected feeds or sources: keep it visible when at least one non-excluded selected source still includes it.
- If all visible videos are excluded: show the existing no-match empty state with an action to clear filters.
- Must never happen: mutating `virtualFeedSources.isActive`, deleting a source, writing to YouTube, expanding visibility across users, logging tokens, or leaving the Play queue with videos hidden from the Feed view.

## Problem

The current Feed picker was intentionally simplified to `Toutes les videos` plus multi-select ReplayGlows feeds. That keeps the default UI understandable, but it removed the fine-grained source-level control that could help before a focused watch session. If a selected feed contains one channel that posted many irrelevant videos, the user currently has to either accept noise in the queue or edit the feed itself in `Lists`, which is too permanent for a temporary viewing decision.

## Solution

Add a progressive-disclosure advanced mode inside the Feed filter picker. The first level stays simple. After selecting one or more feeds, the user can open `Affiner les sources` to exclude individual feed sources from the current Feed view and Play queue. The implementation should reuse `virtualFeedDetailsProvider` data already loaded for selected feeds, apply exclusions during `_mergeFeedVideos`, and persist the preference locally only as part of the main Feed filter state.

## Scope In

- Main Feed filter UI in `app/lib/screens/videos/videos_screen.dart`.
- Advanced source selector shown only after one or more ReplayGlows feeds are selected.
- Source grouping by selected feed, using `VirtualFeedDetails.sources`.
- Local filter state for excluded source keys, scoped to selected feed filters.
- Filtering logic in the main Feed merge path so videos from excluded sources are removed from card/list/summary views and Play queue.
- Dedupe behavior for videos that appear via multiple selected feeds/sources.
- i18n strings in English and French for `Affiner les sources`, empty/loading/error states, clear source exclusions, and applied source count.
- Tests or focused validation for filter-state transitions and source/video filtering.
- User guidance only if needed in existing hint patterns; no marketing-site copy in v1.

## Scope Out

- No backend schema change.
- No Convex mutation for source activation/deactivation.
- No change to source management in the individual Feed detail page.
- No YouTube API call, no OAuth scope change, no quota warning.
- No direct playlist filter entries in the main Feed picker.
- No global hidden-channel/blocklist feature.
- No cross-device sync of temporary source exclusions in v1.
- No AI recommendation, automatic source suppression, or ranking change.

## Constraints

- Follow the current Feed filter decision: `Toutes les videos` means no feed filter; selected feeds mean the visible list is the union of those feed details.
- Source exclusions are only meaningful when `_feedFilterIds` is non-empty.
- Do not overload `Toutes les videos` to mean `select all feeds`.
- Do not mutate `VirtualFeedSource.isActive`; that field remains feed-management state, not temporary playback-filter state.
- Source keys must be stable enough to survive reloads: prefer `feedId + source.id` for UI state, and use `feedSourceType + feedSourceId` for video attribution when filtering videos.
- The UI must remain usable on mobile; avoid permanently expanding the simple picker with all sources.
- The advanced mode must not make the common path slower or visually heavier when no feed is selected.

## Test Contract

- surface: Flutter web/mobile shared app code in `app`, Riverpod providers, local preference state, and read-only Convex virtual feed detail data.
- proof_profile: mixed automated and UI proof. Automated checks must cover static analysis and pure filtering behavior; browser/manual proof must cover mobile bottom-sheet interaction and Play queue coherence.
- proof_order: `flutter analyze` -> unit/helper tests for filter semantics -> widget tests where practical -> Flutter Web preview smoke -> manual mobile QA for gestures/layout.
- checklist_path: `shipglows_data/workflow/test-checklists/replayglows-advanced-feed-source-filtering.md` must be created during implementation if widget tests cannot fully prove mobile interaction and Play queue behavior.
- required_scenario_ids: CA 1 through CA 11.
- required_results: simple picker remains uncluttered, advanced source filtering appears only after feed selection, source exclusions hide only attributable videos, duplicate videos remain visible through non-excluded sources, Play queue matches visible videos, stale exclusions are pruned, clearing filters clears source exclusions, Feed detail source activation is unchanged, and Flutter analysis passes.
- exception_with_proof: backend typecheck is not required if implementation remains app-only and read-only against existing providers; run backend typecheck if Convex contracts, backend queries, or source attribution payloads change.
- exception_without_proof: none allowed for source filtering correctness or Play queue coherence.

## Dependencies

- `app/lib/screens/videos/videos_screen.dart` for the Feed view, filter picker, selected feed detail reads, merge logic, and Play queue source.
- `app/lib/models/virtual_feed.dart` for `VirtualFeed`, `VirtualFeedSource`, and `VirtualFeedDetails`.
- `app/lib/models/video.dart` for `feedSourceType`, `feedSourceId`, and `feedSourceTitle`.
- `app/lib/providers/providers.dart` for `virtualFeedDetailsProvider`.
- `app/lib/i18n/en.dart` and `app/lib/i18n/fr.dart` for user-facing copy.
- Existing specs:
  - `shipglows_data/workflow/specs/replayglows-virtual-feeds-channel-aggregators.md`
  - `shipglows_data/workflow/specs/replayglows-feed-source-discovery-playlist-channel-expansion.md`
- Fresh external docs: not needed. This spec uses existing Flutter/Riverpod patterns and existing ReplayGlows data contracts; no framework, SDK, auth, API, migration, cache, routing, or external integration behavior is being redefined.

## Invariants

- Feed-level filtering remains understandable without opening advanced controls.
- Source-level filtering is a temporary reading filter, not feed administration.
- Visible videos and Play queue must be derived from the same filtered list.
- Clearing all filters clears feed selections and source exclusions.
- Removing a selected feed from the picker removes exclusions tied only to that feed.
- Hidden/watched filters continue to apply after source filtering, preserving current order semantics.
- User ownership remains enforced by existing authenticated provider/backend paths; the client must not infer or request other users' feed details.

## Links & Consequences

- This feature directly affects the main Feed card/list/summary tabs and the active Play queue.
- It may increase the amount of detail data watched when multiple feeds are selected; implementation must preserve existing page size limits and avoid loading details for unselected feeds.
- It should reduce pressure to edit feeds permanently when the user only wants a temporary cleaner queue.
- It makes the Feed picker more powerful, so progressive disclosure and clear labels are part of the product contract, not polish.
- It does not change public product claims, YouTube OAuth behavior, quota handling, or native/web platform promises.

## Documentation Coherence

- Update `app/CHANGELOG.md` when implemented.
- Update `shipglows_data/technical/app/context.md` and/or `architecture.md` only if the implementation introduces a durable new local preference contract or helper abstraction.
- No public marketing-site update required in v1 because this is an advanced in-app control.
- If a manual checklist is created, link it from implementation or verification notes.

## Edge Cases

- A selected feed has no sources.
- A selected feed has sources but no visible videos after hidden/watched filtering.
- A source is inactive in the feed detail and should not be offered as an active include candidate unless current feed detail behavior already exposes it intentionally.
- A video appears in two selected feeds, one excluded and one included.
- A video lacks `feedSourceType` or `feedSourceId`; keep it visible unless the implementation can confidently attribute it only to an excluded source.
- The user deselects the feed that owned all current source exclusions.
- The user selects `Toutes les videos` after setting source exclusions.
- The source picker is opened on a narrow mobile viewport with many feeds and many sources.
- Feed details refresh while the bottom sheet is open.

## Implementation Tasks

- [ ] Task 1: Add explicit source-filter state.
  - File: `app/lib/screens/videos/videos_screen.dart`
  - Action: Add state for excluded source keys, persistence/migration behavior, clear behavior, and pruning when selected feeds change.
  - User story link: enables temporary source exclusions without mutating the feed.
  - Depends on: none.
  - Validate with: focused Dart/unit logic test if extracted, plus `flutter analyze`.
  - Notes: Keep the shape local to the Feed screen unless repeated logic justifies a small helper.

- [ ] Task 2: Extract source/video filtering helpers.
  - File: `app/lib/screens/videos/videos_screen.dart` or a small app-local helper under `app/lib/screens/videos/`.
  - Action: Update `_mergeFeedVideos` or its inputs to account for excluded sources while preserving dedupe semantics across multiple selected feeds.
  - User story link: ensures hidden sources disappear from the visible queue.
  - Depends on: Task 1.
  - Validate with: tests for multi-source duplicate behavior, missing source metadata, all-excluded result, and ordinary feed merge.
  - Notes: Prefer structured keys over ad hoc string parsing where practical.

- [ ] Task 3: Add progressive advanced UI to the feed filter sheet.
  - File: `app/lib/screens/videos/videos_screen.dart`
  - Action: Keep the simple feed picker first; when draft feed selection is non-empty, show an `Affiner les sources` row/control that expands or navigates inside the sheet to grouped source checklists.
  - User story link: makes fine control available on demand without overwhelming default users.
  - Depends on: Task 1 and current selected feed details.
  - Validate with: widget/browser smoke for mobile width and many sources.
  - Notes: Reuse the draggable sheet behavior; avoid nested cards and dense text overflow.

- [ ] Task 4: Add i18n copy.
  - Files: `app/lib/i18n/en.dart`, `app/lib/i18n/fr.dart`
  - Action: Add labels and messages for advanced source filtering, loading/error/empty states, source exclusions applied, and clear source exclusions.
  - User story link: keeps the advanced mode understandable.
  - Depends on: Task 3.
  - Validate with: `flutter analyze` and manual language smoke.

- [ ] Task 5: Keep Play queue and active-video navigation coherent.
  - File: `app/lib/screens/videos/videos_screen.dart`
  - Action: Confirm `_visibleFeedQueue`, active feed video scroll, card/list/summary tabs, and Play navigation all consume the same source-filtered `visibleVideos`.
  - User story link: the playlist the user is about to watch should match the filtered Feed.
  - Depends on: Task 2.
  - Validate with: manual Feed -> apply source exclusion -> Play -> next/previous -> return Feed scenario.

- [ ] Task 6: Add docs/checklist updates if implementation needs them.
  - Files: `app/CHANGELOG.md`, optionally `shipglows_data/workflow/test-checklists/replayglows-advanced-feed-source-filtering.md`, optionally app technical docs.
  - Action: Record the feature and add QA checklist if browser/manual proof remains necessary.
  - User story link: preserves future maintainability and verification memory.
  - Depends on: Tasks 1-5.
  - Validate with: metadata lint if ShipGlows docs are changed.

## Acceptance Criteria

- [ ] CA 1: Given no feed is selected, when the user opens the Feed filter picker, then the UI shows `Toutes les videos` and feed choices without exposing source-level noise as the primary path.
- [ ] CA 2: Given one or more feeds are selected, when the user opens the picker, then an explicit advanced control lets them refine sources for those selected feeds.
- [ ] CA 3: Given a source is unchecked in advanced mode, when the user applies the filter, then videos attributable only to that source disappear from Feed card/list/summary views.
- [ ] CA 4: Given a source is unchecked, when the user starts Play from the Feed, then the Play queue excludes videos hidden by that source filter.
- [ ] CA 5: Given the same video appears through an excluded source and an included source, when filters are applied, then the video remains visible.
- [ ] CA 6: Given the user selects `Toutes les videos`, when filters are applied, then feed selections and source exclusions are cleared.
- [ ] CA 7: Given a selected feed is removed, when filters are applied or re-opened, then stale source exclusions for that feed are pruned.
- [ ] CA 8: Given feed details fail to load, when the user opens advanced source filtering, then the UI shows a recoverable error and does not corrupt the existing applied filter.
- [ ] CA 9: Given all selected videos are excluded, when the Feed renders, then the no-match state appears with a clear-filters action.
- [ ] CA 10: Given source filtering is used, when the user later opens the Feed detail in `Lists`, then that feed's source active/inactive state is unchanged.
- [ ] CA 11: Given the app is analyzed, when `flutter analyze` runs, then it reports no issues from this feature.

## Test Strategy

- Unit or widget-test the filtering helper with:
  - one feed, one excluded source;
  - multiple feeds with duplicate video IDs;
  - missing `feedSourceId`;
  - stale excluded source keys;
  - all sources excluded.
- Widget-test the filter sheet if existing test harness can render the Feed filter state without authenticated backend dependencies; otherwise extract enough pure state logic to test independently.
- Run `(cd app && flutter analyze)`.
- Run Flutter Web/mobile preview smoke after ship:
  - open Feed;
  - select two feeds;
  - open `Affiner les sources`;
  - uncheck one source;
  - apply;
  - verify visible videos and Play queue match;
  - clear filters.
- Run metadata lint if ShipGlows docs/checklists are added:
  - `/home/claude/shipglows/tools/shipglows_metadata_lint.py AGENT.md shipglows_data`

## Risks

- Medium UX risk: too much hierarchy in the bottom sheet could make the simple picker feel complex again.
- Medium correctness risk: duplicate videos across sources can be filtered incorrectly if the merge loses attribution.
- Low performance risk: loading detail for many selected feeds can be heavier; keep the current selected-feed-only loading pattern and avoid details for unselected feeds.
- Low data/security risk: feature should be read-only, but implementation must not introduce source mutation or cross-user data access.
- Security impact: yes, mitigated by using existing authenticated feed-detail providers, keeping the feature read-only, avoiding client-side authority expansion, and never treating UI filtering as a server authorization boundary.
- Medium testability risk: authenticated provider state may make widget tests awkward; pure helper tests should cover the core filtering contract.

## Execution Notes

- Read first:
  - `app/lib/screens/videos/videos_screen.dart`
  - `app/lib/models/virtual_feed.dart`
  - `app/lib/models/video.dart`
  - `app/lib/providers/providers.dart`
  - `app/lib/i18n/en.dart` and `fr.dart`
- Implementation approach:
  - first separate filter state and pure filtering semantics;
  - then wire the UI draft/apply behavior;
  - then verify Play queue coherence;
  - finally add copy and docs/checklist.
- Follow existing Riverpod and SharedPreferences patterns already used in `videos_screen.dart`.
- Avoid adding a global store unless source filtering is reused outside the Feed screen.
- Stop and reroute to spec update if implementation requires backend schema changes, cross-device sync, or permanent source activation semantics.
- Fresh-docs verdict: fresh-docs not needed for this spec because the feature uses existing local app patterns and read-only provider data.

## Open Questions

None.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-06-10 07:47:08 UTC | sf-spec | GPT-5 Codex | Created draft spec for progressive advanced source filtering in the main Feed picker. | draft saved | /sf-ready replayglows-advanced-feed-source-filtering |
| 2026-06-10 07:50:26 UTC | sf-ready | GPT-5 Codex | Reviewed readiness, tightened proof contract and security notes, and promoted spec to ready. | ready | /sf-start replayglows-advanced-feed-source-filtering |

## Current Chantier Flow

- sf-spec: done
- sf-ready: ready
- sf-start: not launched
- sf-verify: not launched
- sf-end: not launched
- sf-ship: not launched

Next command: `/sf-start replayglows-advanced-feed-source-filtering`
