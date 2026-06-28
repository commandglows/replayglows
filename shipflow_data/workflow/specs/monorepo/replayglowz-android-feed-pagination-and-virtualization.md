---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-06-12"
created_at: "2026-06-12 12:55:03 UTC"
updated: "2026-06-12"
updated_at: "2026-06-12 13:49:58 UTC"
status: active
source_skill: 100-sf-spec
source_model: "GPT-5 Codex"
scope: "android-feed-pagination-and-virtualization"
owner: "Diane"
user_story: "En tant qu'utilisatrice ReplayGlowz sur Android avec une bibliotheque YouTube dense, je veux que mes feeds et listes restent fluides et que les builds de production restent legers, afin d'ouvrir l'app vite, scroller sans saccades, et parcourir mes videos sans surcharge memoire ou package inutile."
confidence: "high"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "app"
  - "backend"
  - "Flutter Android runtime"
  - "Riverpod providers"
  - "Convex virtual feed queries"
  - "Android Gradle / R8"
depends_on:
  - artifact: "shipflow_data/business/product.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/business/branding.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/technical/architecture.md"
    artifact_version: "0.1.1"
    required_status: "draft"
  - artifact: "shipflow_data/technical/guidelines.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/technical/app/architecture.md"
    artifact_version: "1.1.1"
    required_status: "reviewed"
  - artifact: "developer.android.com code and resource shrinking guidance"
    artifact_version: "2026-06-12"
    required_status: "official"
  - artifact: "docs.flutter.dev list performance guidance"
    artifact_version: "2026-06-12"
    required_status: "official"
supersedes: []
evidence:
  - "403-sf-perf audit on 2026-06-12 found `app/android/app/build.gradle.kts` shipping release builds without `isMinifyEnabled` or `isShrinkResources`."
  - "403-sf-perf audit on 2026-06-12 found `app/lib/screens/videos/videos_screen.dart` requesting `virtualFeedDetailsProvider(... pageSize: 500)` for every selected feed before merge."
  - "403-sf-perf audit on 2026-06-12 found `app/lib/widgets/media/media_thumbnail.dart` decoding remote thumbnails without render-size cache bounds; a first bounded fix is already in place."
  - "Flutter docs checked 2026-06-12: https://docs.flutter.dev/perf/best-practices and https://docs.flutter.dev/cookbook/lists/long-lists recommend lazy list builders and careful long-list handling."
  - "Android docs checked 2026-06-12: https://developer.android.com/topic/performance/app-optimization/enable-app-optimization and https://developer.android.com/topic/performance/reduce-apk-size describe R8 code shrinking and resource shrinking for release builds."
  - "`flutter analyze` passed after enabling release shrinking and thumbnail cache bounds on 2026-06-12."
next_step: "/005-sf-ship replayglowz-android-feed-pagination-and-virtualization"
---

# Spec: ReplayGlowz Android Feed Pagination And Virtualization

🟢 [replayglowz] spec: ReplayGlowz Android Feed Pagination And Virtualization | status: active | path: shipflow_data/workflow/specs/replayglowz-android-feed-pagination-and-virtualization.md | next: /005-sf-ship replayglowz-android-feed-pagination-and-virtualization

## Title

ReplayGlowz Android feed pagination and virtualization

## Status

active

This chantier turns the Android performance audit into an implementation contract. It covers production artifact shrinkage, long-feed loading pressure, and the list-windowing proof needed to keep ReplayGlowz usable as feed size grows.

## User Story

En tant qu'utilisatrice ReplayGlowz sur Android avec une bibliotheque YouTube dense, je veux que mes feeds et listes restent fluides et que les builds de production restent legers, afin d'ouvrir l'app vite, scroller sans saccades, et parcourir mes videos sans surcharge memoire ou package inutile.

## Minimal Behavior Contract

Quand une utilisatrice Android ouvre ReplayGlowz, l'application doit charger et afficher les feeds de maniere progressive sans aspirer des centaines d'elements par feed avant le premier rendu, et les listes longues doivent rester construites a la demande avec une pression memoire bornee. Les miniatures et les pages de feed doivent utiliser des tailles et des fenetres adaptees a l'ecran et au contexte visible, tandis que le build Android release doit supprimer le code et les ressources inutiles avant distribution. Si un feed est trop grand, si une page supplementaire echoue, ou si la pagination backend n'est pas encore disponible, l'app doit garder les donnees deja visibles, afficher un etat recuperable, et ne jamais figer tout l'ecran sur un chargement global. L'edge case le plus facile a rater est un filtre multi-feeds qui lance plusieurs requetes volumineuses en parallele, fusionne tout en memoire, puis casse la fluidite malgre des `ListView.builder`.

## Success Behavior

- Preconditions: l'utilisatrice est authentifiee, dispose d'un acces ReplayGlowz actif, Convex auth est pret, et sa bibliotheque contient assez de videos ou feeds pour exposer les limites actuelles.
- Trigger: ouverture de `VideosScreen`, activation de filtres multi-feeds, ouverture d'un feed detaille, scroll prolongé dans les listes/videos, et generation d'un build Android release.
- User/operator result: les ecrans Videos et feeds rendent un premier lot rapidement, chargent davantage de contenu a mesure que l'utilisatrice s'approche de la fin utile, et conservent une interaction fluide meme quand plusieurs feeds sont selectionnes. Le build Android release produit des artefacts shrunk sans code/ressources mortes connues.
- System effect: les providers Flutter evitent les grosses unions eager de `pageSize: 500`, utilisent une pagination/fenetre explicite quand les donnees feed depassent le premier lot, limitent la taille des miniatures decodees au contexte rendu, et la configuration Android release applique R8/resource shrinking avec des keep rules explicites seulement si necessaire.
- Success proof: `flutter analyze`, tests Flutter ciblas, `npm run typecheck` cote backend si la requete feed change, build Android release/profile de comparaison, et verification manuelle Android ou emulator pour l'ouverture du feed, le scroll, le filtrage multi-feeds, et les regressions visuelles.

## Error Behavior

- Si une page supplementaire de feed echoue, l'app doit conserver le contenu deja visible, afficher une erreur non bloquante et autoriser un retry localise plutot qu'un ecran vide global.
- Si le backend ne peut pas fournir la pagination requise sans risque contractuel, l'implementation doit s'arreter au plus petit contrat intermediaire sur une fenetre bornee et rerouter vers une decision backend explicite avant de shipper un faux lazy loading.
- Si le shrinking Android supprime a tort une ressource ou un composant reflechi, l'app doit ajouter une keep rule minimale et prouvee; il est interdit de desactiver `minify` globalement comme echappatoire.
- Si les performances restent mediocres apres pagination, la verification doit le declarer partiel plutot que de marquer la spec complete sans mesure ou preuve manuelle.
- Aucune erreur ne doit exposer de token, de secret de build, ni casser les invariants d'auth ou de quota-safe sync deja en place.

## Problem

Le premier audit Android a corrige deux points faciles: le release shrinking et les bornes de cache image. Mais la source principale de pression reste structurelle: `VideosScreen` peut demander jusqu'a 500 videos par feed selectionne avant fusion, puis maintenir une couche de logique de scroll/snap complexe sur un jeu de donnees volumineux. Cette forme de chargement eager peut provoquer jank, surconsommation memoire, fusion lente, et temps de premier rendu plus mauvais a mesure que les bibliotheques grandissent. En parallele, l'app Android doit continuer a produire des artefacts release raisonnables et a garder ses protections d'observabilite, d'auth et de quota.

## Solution

Traiter le probleme sur deux axes coordonnes:

1. Stabiliser le pipeline Android release pour que le shrinking fasse partie du contrat permanent, avec keep rules minimales et preuve de build.
2. Remplacer le chargement massif des feeds par une fenetre/pagination explicite et un flux UI progressif:
   - premier lot borne pour `VideosScreen` et les details de feed
   - chargement suivant a la demande selon le scroll ou l'intention
   - fusion et filtrage limites a la fenetre utile
   - maintien des listes lazy et des miniatures bornees

La spec autorise une petite extension backend dans `backend` si le contrat Convex actuel ne permet pas un chargement progressif fiable. Cette extension reste dans le meme chantier car elle sert directement la promesse utilisateur et remplace une faiblesse structurelle deja observee.

## Scope In

- `app/android/app/build.gradle.kts` release shrink contract
- `app/android/app/proguard-rules.pro` keep rules minimales si une preuve le justifie
- `app/lib/screens/videos/videos_screen.dart`
- `app/lib/screens/playlists/virtual_feed_detail_screen.dart` et toute autre surface feed longue touchee par le meme pattern
- `app/lib/providers/providers.dart` pour le contrat `virtualFeedDetailsProvider` et ses args
- Ajustements backend Convex strictement necessaires si la pagination/feed cursor doit devenir explicite
- Preuve de scroll fluide, pagination, et build Android release
- Preservation du contrat Sentry/build metadata deja present dans `lib/main.dart` et `lib/app/build_info.dart`

## Scope Out

- Refonte visuelle generale des ecrans Videos, Playlists, ou Play
- Changement du produit ou des quotas YouTube
- Refonte de toutes les strategies de caching reseau de l'app
- iOS-specific perf work
- Re-architecture complete du playback session system
- Session replay, tracing, ou nouvelle instrumentation Sentry large sans preuve qu'elle est necessaire pour ce chantier

## Constraints

- Respecter le contrat ReplayGlowz: les ecritures et actions YouTube restent backend-orchestrees et quota-safe.
- Les changements ne doivent pas casser les comportements de scroll synchronise, de snap, de filtre watched, ni la navigation actuelle sans preuve explicite de remplacement.
- Les listes longues doivent rester lazy (`ListView.builder`, slivers builder) et ne pas etre remplacees par des collections eager dans les widgets.
- Les miniatures doivent continuer a respecter la taille rendue et ne pas regresser sur la qualite visuelle normale Android.
- Toute extension backend doit preservers les gardes d'auth ReplayGlowz et les invariants des providers existants.
- Le chantier doit conserver la surface de diagnostic runtime: build identity, Paris/UTC timestamps, release/environment, et Sentry config safe-copy quand ces ecrans ou logs sont utilises pour la preuve.

## Test Contract

- `surface`: Flutter Android app, Riverpod provider graph, Convex query contract, Android Gradle release pipeline
- `proof_profile`: static checks, targeted widget/provider tests, backend typecheck only if query contract changes, Android release build proof, and manual scroll/device QA
- `proof_order`: provider/backend contract -> Flutter analyze/tests -> Android release build -> emulator/device scroll proof -> regression checks on filters/snap
- `automated_commands`:
  - `(cd app && flutter analyze)`
  - `(cd app && flutter test <targeted feed/pagination tests>)`
  - `(cd app && flutter build apk --release)` or `(cd app && flutter build appbundle --release)` for shrink proof
  - `(cd backend/packages/backend && npm run typecheck)` only if Convex feed query shape changes
  - `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENTS.md shipflow_data`
- `required_scenario_ids`:
  - `RGAF-001`: Videos screen with no feed filter still renders and scrolls normally.
  - `RGAF-002`: One selected feed loads an initial bounded page without requesting a 500-item eager union.
  - `RGAF-003`: Multiple selected feeds merge progressively and remain usable while later pages are loading.
  - `RGAF-004`: Reaching the bottom of a long feed triggers the next bounded page only once per cursor/window.
  - `RGAF-005`: Page-load failure preserves the current list and exposes a retry path.
  - `RGAF-006`: Active-video highlighting, watched filtering, and feed scroll synchronization still behave correctly after pagination changes.
  - `RGAF-007`: Android release build succeeds with shrinking enabled and no known runtime regression from removed resources/classes.
  - `RGAF-008`: Thumbnail-heavy scrolling does not decode/cache full-size remote images for small cards/list rows.
- `required_results`: all scenarios above must pass or be explicitly documented as blocked with a real owner decision before `/103-sf-verify` can pass.
- `checklist_path`: `shipflow_data/workflow/test-checklists/replayglowz-android-feed-pagination-and-virtualization.md`
- `exception_with_proof`: smooth-scroll proof and APK/AAB size comparison need an emulator or Android device plus release artifacts; static analysis alone is insufficient.
- `exception_without_proof`: none.

## Dependencies

- `app/lib/screens/videos/videos_screen.dart`
- `app/lib/screens/playlists/virtual_feed_detail_screen.dart`
- `app/lib/providers/providers.dart`
- `app/lib/widgets/media/media_thumbnail.dart`
- `app/android/app/build.gradle.kts`
- `app/android/app/proguard-rules.pro`
- `app/lib/main.dart`
- `app/lib/app/build_info.dart`
- `backend/packages/backend/convex/*` only if feed cursor/page contract changes
- Android docs on R8 and resource shrinking: `fresh-docs checked`
- Flutter docs on long lists and performance best practices: `fresh-docs checked`

## Invariants

- ReplayGlowz auth, entitlement, and Convex token wiring remain server-verified and unchanged.
- YouTube sync orchestration remains backend-owned and quota-safe.
- Runtime diagnostics and copied logs keep the current build identity header with Paris/UTC build timestamps.
- Sentry remains conservative: no broad tracing/replay/logging expansion is allowed as a side effect of this perf chantier.
- Feed-level behavior must remain functionally equivalent from the user perspective even if the loading strategy changes underneath.

## Links & Consequences

- `VideosScreen` currently merges selected feed results directly in the UI; pagination may require moving some merge/cursor responsibility into provider or backend layers.
- `virtual_feed_detail_screen.dart` already uses feed detail args with `pageSize: 100`; aligning these surfaces may reduce duplicate perf patterns and lower future drift.
- Backend query shape changes will ripple into tests, typed models, and invalidation behavior in `mutations.dart` and any feed-related refresh flows.
- Android shrink proof should be checked against plugins that use reflection/JNI (`firebase_*`, `sentry_flutter`, `youtube_player_flutter`, `convex_flutter`) so keep rules stay evidence-based instead of superstitious.

## Documentation Coherence

- Update app architecture/guidance docs only if the feed query contract or Android release build contract changes materially.
- If a new manual test checklist is created, keep it under `shipflow_data/workflow/test-checklists/`.
- No public marketing, pricing, or claim copy should change for this chantier.

## Edge Cases

- User selects multiple feeds where one feed is empty and another is very large.
- A later page contains videos already present in another feed and dedupe still has to stay stable.
- A scroll-triggered page request races with a sort-order or watched-filter change.
- A release build shrinks correctly on one variant but drops a plugin class only in another runtime path.
- Current scroll-sync/snap code assumes the full queue is locally available; pagination may require a new anchor strategy near not-yet-loaded items.

## Implementation Tasks

- [ ] Task 1: Lock the Android release shrinking contract and verify plugin safety.
  - File: `app/android/app/build.gradle.kts`, `app/android/app/proguard-rules.pro`
  - Action: Keep `minify` and `shrinkResources` enabled, build a release artifact, and add only the smallest keep rules justified by real breakage.
  - User story link: keeps the shipped Android app lighter and faster to install/start.
  - Depends on: none
  - Validate with: `flutter build apk --release` or `flutter build appbundle --release`, plus smoke startup proof
  - Notes: do not revert shrinking globally if a plugin breaks; isolate the keep rule.

- [ ] Task 2: Define a bounded feed-window contract for filtered videos.
  - File: `app/lib/providers/providers.dart` and backend feed query files if needed
  - Action: Replace the implicit `pageSize: 500` eager contract with an explicit initial-page and next-page/cursor contract safe for Flutter UI consumption.
  - User story link: reduces first-render and merge cost for large filtered feeds.
  - Depends on: Task 1
  - Validate with: targeted provider tests and `npm run typecheck` if backend query shape changes
  - Notes: prefer extending the existing feed details contract over inventing a parallel feed API.

- [ ] Task 3: Rework `VideosScreen` filtered-feed loading to be progressive.
  - File: `app/lib/screens/videos/videos_screen.dart`
  - Action: Load a bounded first page per selected feed, merge only the visible working set, and fetch later pages intentionally when the list approaches the tail.
  - User story link: keeps the main Videos surface responsive under real library growth.
  - Depends on: Task 2
  - Validate with: widget/provider tests plus manual scenarios `RGAF-002` to `RGAF-006`
  - Notes: preserve watched filtering, active-video highlight, and existing actions.

- [ ] Task 4: Align feed-detail screens with the same bounded loading strategy.
  - File: `app/lib/screens/playlists/virtual_feed_detail_screen.dart`
  - Action: Audit and adapt any long-list feed detail path that still assumes large eager pages or full in-memory unions.
  - User story link: avoids a split experience where main feed improves but detail pages still jank.
  - Depends on: Task 2
  - Validate with: targeted feed-detail tests and manual long-scroll proof
  - Notes: keep reorder/edit flows correct if they share the same data source.

- [ ] Task 5: Prove memory and image behavior under long scrolling.
  - File: `app/lib/widgets/media/media_thumbnail.dart` and any list/card widgets that override image behavior
  - Action: Confirm render-sized image caching remains correct across cards/list rows and add only scoped fixes where another thumbnail path bypasses the bounded helper.
  - User story link: prevents scroll jank and memory churn from oversized image decodes.
  - Depends on: Task 3
  - Validate with: `flutter analyze`, targeted widget tests, and manual scroll inspection
  - Notes: do not duplicate ad hoc cache sizing logic in multiple widgets if the shared helper can own it.

- [ ] Task 6: Add performance proof and closure artifacts.
  - File: spec-linked checklist and any affected docs if behavior contracts changed
  - Action: Capture release build proof, package-size comparison, and manual Android/emulator observations, then update the chantier for verification.
  - User story link: ensures the chantier ships with real proof, not structural guesses.
  - Depends on: Tasks 1-5
  - Validate with: release artifact size comparison, checklist completion, and `/103-sf-verify`
  - Notes: if measured wins are weak, document the remaining hotspot instead of overstating success.

## Acceptance Criteria

- [ ] CA 1: Given Android release builds, when the app is built for release, then code/resource shrinking remains enabled and the build completes without known runtime breakage from removed classes/resources.
- [ ] CA 2: Given one selected virtual feed with a large library, when the Videos screen opens, then it fetches only a bounded initial page rather than eagerly pulling 500 items.
- [ ] CA 3: Given multiple selected feeds, when the filtered feed view loads, then the app merges a progressive working set and stays interactive while later pages load.
- [ ] CA 4: Given the user scrolls near the end of a long filtered feed, when more data is needed, then the next page loads once and appends without resetting the list or losing current content.
- [ ] CA 5: Given a later page request fails, when the screen is already showing earlier results, then those results remain visible and a local retry path is available.
- [ ] CA 6: Given active-video state, watched filtering, and feed scroll sync, when the paginated feed logic is enabled, then those features still behave correctly.
- [ ] CA 7: Given thumbnail-heavy rows/cards on Android, when the user scrolls long lists, then image decoding/caching stays bounded to the rendered size rather than full remote dimensions.

## Test Strategy

- Start with provider/backend contract tests around pagination or cursor semantics.
- Run `flutter analyze` and targeted Flutter tests for feed filtering, append behavior, and error-state preservation.
- Produce at least one Android release artifact with shrinking enabled and compare size against the pre-spec baseline when available.
- Run manual emulator/device QA for feed open, long scroll, multi-feed filter, watched toggle, and active-video return-to-feed behavior.

## Risks

- High: pagination can clash with the current feed snap/anchor logic, which was built assuming a fully resident visible queue.
- High: backend query changes can ripple into invalidation logic and break apparent UI freshness if cursor merging is inconsistent.
- Medium: R8/resource shrinking can expose missing keep rules in plugins that behave differently on Android release than debug.
- Medium: partial fixes may improve one screen while leaving another large-feed path untouched, creating inconsistent product behavior.

## Execution Notes

- Read first: `app/lib/screens/videos/videos_screen.dart`, `app/lib/providers/providers.dart`, `app/lib/screens/playlists/virtual_feed_detail_screen.dart`, `app/android/app/build.gradle.kts`, `app/lib/main.dart`.
- Preserve the existing runtime diagnostics surface and build headers from `lib/main.dart` and `lib/app/build_info.dart`; `fresh-docs checked` confirmed Android shrinking behavior and Flutter long-list guidance, so no additional external-doc gate is needed unless a new plugin/runtime contract enters scope.
- Prefer one shared feed-window abstraction over duplicate per-screen pagination logic.
- Keep list rendering lazy and avoid workaround constants that hide performance problems by reducing visible content arbitrarily.
- Stop and reroute if the correct fix needs a broader redesign of playback-session anchors or a new cross-project feed architecture rather than a bounded provider/query contract.

## Open Questions

- None at spec time. The next decision point only appears if the existing Convex feed query cannot support a bounded cursor/page contract without unsafe ambiguity.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-06-12 12:55:03 UTC | 100-sf-spec | GPT-5 Codex | Created a ready Android performance chantier from the 403-sf-perf audit findings, preserving the proposed title, severity, scope, and evidence. | Ready. | `/102-sf-start replayglowz-android-feed-pagination-and-virtualization` |
| 2026-06-12 12:58:19 UTC | 101-sf-ready | GPT-5 Codex | Ran readiness review against the Android performance spec and challenged the proof contract and pre-gate status. | Not ready. Missing the checklist artifact named in the manual proof path, and the spec should not remain `ready` before that proof contract is fully formed. | `/100-sf-spec replayglowz-android-feed-pagination-and-virtualization` |
| 2026-06-12 13:12:03 UTC | 101-sf-ready | GPT-5 Codex | Reran readiness review after adding the missing manual checklist artifact and aligning checklist field names/flow. | Ready. Structural blockers resolved for this pre-gate rerun; proof execution remains to be performed in implementation/verify steps. | `/102-sf-start replayglowz-android-feed-pagination-and-virtualization` |
| 2026-06-12 13:49:58 UTC | 102-sf-start | GPT-5 Codex | Reworked Flutter virtual-feed loading to use bounded progressive pages in `VideosScreen` and `VirtualFeedDetailScreen`, while broadening invalidation coverage for paged provider args. | Implemented. Local pagination contract now uses bounded pages instead of eager `pageSize: 500`; preview/device/manual proof is still pending. | `/103-sf-verify replayglowz-android-feed-pagination-and-virtualization` |
| 2026-06-12 13:49:58 UTC | 103-sf-verify | GPT-5 Codex | Verified the local Android feed pagination implementation against the spec, local checks, and project validation mode. | Partial. `flutter analyze` passed, but the required manual checklist and preview/device proof remain unrun in this `vercel-preview-push` project, so ship-readiness is not yet proven. | `/005-sf-ship replayglowz-android-feed-pagination-and-virtualization -> /405-sf-prod app` |
| 2026-06-12 13:49:58 UTC | 104-sf-end | GPT-5 Codex | Closed the local implementation pass without shipping, updated workflow tracking, and kept the chantier open for preview/device validation. | Deferred. Code and spec progress are recorded, but the chantier remains active until ship plus preview/manual proof complete. | `/005-sf-ship replayglowz-android-feed-pagination-and-virtualization -> /405-sf-prod app` |
| 2026-06-12 13:49:58 UTC | 001-sf-build | GPT-5 Codex | Orchestrated readiness repair, delegated implementation, local validation, verify triage, and pre-ship closure for the Android feed pagination chantier. | Partial. The implementation pass is complete locally, but preview/device/manual proof remains outstanding before ship. | `/005-sf-ship replayglowz-android-feed-pagination-and-virtualization -> /405-sf-prod app` |

## Current Chantier Flow

| Step | Status | Notes |
|------|--------|-------|
| 100-sf-spec | reviewed | Spec exists and now has a matching manual checklist artifact plus a repaired readiness contract. |
| 101-sf-ready | ready | Checklist artifact exists and the spec is structurally ready for execution. |
| 102-sf-start | implemented | Flutter feed surfaces now request bounded pages and append progressively instead of eagerly merging 500-item feed reads. |
| 103-sf-verify | partial | Local proof passed via `flutter analyze`, but manual checklist execution and preview/device validation remain open. |
| 104-sf-end | deferred | Local bookkeeping is updated, but the chantier stays active until post-ship proof runs. |
| 005-sf-ship | pending | Next lifecycle owner must push the bounded scope, then route to preview/device proof. |

Next command: `/005-sf-ship replayglowz-android-feed-pagination-and-virtualization -> /405-sf-prod app`
