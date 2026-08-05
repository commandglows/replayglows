---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.1"
project: "replayglows"
created: "2026-05-28"
created_at: "2026-05-28 17:52:05 UTC"
updated: "2026-05-31"
updated_at: "2026-05-31 21:01:44 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "virtual-feeds-channel-aggregators"
owner: "Diane"
user_story: "En tant qu'utilisateur ReplayGlows connecte a YouTube, je veux creer des feeds virtuels qui regroupent les chaines et sources qui m'interessent, afin de lancer une lecture thematique sans depenser du quota en ajoutant chaque video dans une playlist YouTube."
confidence: "high"
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
depends_on:
  - artifact: "AGENTS.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipglows_data/technical/architecture.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipglows_data/technical/guidelines.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipglows_data/workflow/specs/replayglows-youtube-quota-safe-sync.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "shipglows_data/workflow/specs/replayglows-youtube-core-parity-priority-2.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "YouTube Data API quota cost documentation"
    artifact_version: "2025-08-21"
    required_status: "official"
supersedes: []
evidence:
  - "User wants to group subscribed channels by theme such as cuisine and launch the group as a feed."
  - "User observed that writing YouTube playlists is expensive and asked for an architecture that avoids that cost."
  - "Official YouTube Data API quota cost docs checked 2026-05-28: every request costs at least 1 unit, default project quota is 10,000 units/day, `playlistItems.insert`, `playlistItems.update`, and `playlistItems.delete` cost 50 units, while `subscriptions.list`, `playlistItems.list`, `playlists.list`, and `videos.list` cost 1 unit per request/page."
  - "Current backend has `youtubePlaylistsCache`, `youtubeVideosCache`, `youtubeChannelsCache`, `channelPlaylistLinks`, `hiddenItems`, `watchedVideos`, and `youtubeSyncJobs`, but no first-class user-defined virtual feed table."
  - "Current Flutter app already has a Feed surface, playlist detail, subscription cache providers, channel-link mutations, quota guard, and feed playback queue state."
  - "User decision 2026-05-28: virtual Feeds belong inside the current Playlists surface, which should be renamed to Lists, rather than creating a separate Feeds navigation entry."
next_step: "/sf-start replayglows-virtual-feeds-channel-aggregators"
---

# Spec: ReplayGlows Virtual Feeds Channel Aggregators

## Title

ReplayGlows virtual feeds channel aggregators

## Status

ready

## User Story

En tant qu'utilisateur ReplayGlows connecte a YouTube, je veux creer des feeds virtuels qui regroupent les chaines et sources qui m'interessent, afin de lancer une lecture thematique sans depenser du quota en ajoutant chaque video dans une playlist YouTube.

## Minimal Behavior Contract

ReplayGlows doit permettre a l'utilisateur de creer un Feed interne depuis la surface `Lists`, par exemple `Cuisine`, d'y ajouter des chaines YouTube ou des playlists deja connues, puis d'afficher et lire les videos agregees depuis le cache ReplayGlows. Ajouter, retirer ou reorganiser une source dans un Feed ne doit pas appeler d'endpoint d'ecriture YouTube et ne doit pas modifier les playlists YouTube de l'utilisateur; seules les actions explicites de synchronisation lisent YouTube via les garde-fous quota existants. Si une chaine, playlist ou video source devient indisponible, le Feed reste recuperable, montre les sources en erreur ou vides, et continue d'afficher les donnees cachees valides. Quand l'utilisateur retire une source, la source et les videos uniquement attribuees a cette source doivent disparaitre de l'UI sans attendre un rechargement complet. L'edge case facile a rater est de confondre `Feed ReplayGlows` et `playlist YouTube`: le Feed est une collection virtuelle locale dans `Lists`, pas une playlist distante writable.

## Success Behavior

- Preconditions: l'utilisateur est authentifie via Clerk, dispose d'un acces ReplayGlows actif, Convex auth est pret, et ses abonnements/playlists/videos YouTube sont deja caches ou synchronisables via les flux quota-safe existants.
- Trigger: l'utilisateur cree un Feed, ajoute une ou plusieurs sources, ouvre ce Feed, filtre les videos, puis appuie sur Play.
- User/operator result: l'app renomme la surface Playlists en `Lists`, puis y affiche les playlists YouTube et les Feeds ReplayGlows comme deux types de listes clairement distingues.
- User/operator result: l'app affiche un Feed nomme avec ses sources, ses videos agregees, son tri, son compteur de videos, ses etats vide/erreur, et un bouton Play qui lance la file dans l'ordre affiche.
- User/operator result: ajouter ou retirer une chaine d'un Feed est immediat, reversible, et ne montre pas d'avertissement de cout YouTube tant que l'utilisateur ne lance pas de synchronisation externe.
- User/operator result: le filtre de la page Feed principale propose `All videos` puis une selection multiple de Feeds ReplayGlows; il ne recree pas une selection interne de sources ni un filtre direct par playlists YouTube.
- User/operator result: la pseudo-playlist technique `Subscriptions` n'apparait pas dans la page `Lists`, mais la source `All subscriptions` reste disponible dans l'ajout de source d'un Feed.
- User/operator result: l'utilisateur distingue clairement `Feeds ReplayGlows` des `Playlists YouTube`, et les actions qui coutent du quota restent annoncees par les garde-fous existants.
- System effect: Convex persiste les feeds, sources, ordre et preferences par userId; les requetes d'agregation lisent les caches `youtubeVideosCache`, `youtubeChannelsCache`, `youtubePlaylistsCache`, `hiddenItems` et `watchedVideos` sans side effect externe.
- System effect: la lecture Play utilise la meme queue que le Feed courant, avec precedent/suivant, retour Feed sur la video active, et scroll synchronise entre modes d'affichage.
- Success proof: backend typecheck, Flutter analyze/tests, tests backend d'ownership/agregation, tests Flutter des providers/modeles, et QA manuelle create Feed -> add sources -> play all -> revenir au Feed.
- Silent success: autorise uniquement pour les sauvegardes locales instantanees qui se refletent immediatement dans l'UI; les sync externes doivent rester visibles.

## Error Behavior

- Expected failures: YouTube non connecte, aucun abonnement cache, source dupliquee, source supprimee, playlist URL importee inaccessible, token revoque pendant sync, quota insuffisant, Feed vide, Feed supprime dans un autre onglet, ancienne video cache sans `youtubeChannelId`, double clic ou multi-tab.
- User/operator response: l'app affiche un etat vide ou une erreur actionnable, conserve les autres sources du Feed, propose de rafraichir les abonnements ou playlists seulement quand utile, et ne presente pas de bouton mort.
- System effect: les mutations locales de Feed ne depensent pas de quota, ne suppriment pas de videos cachees, ne creent pas de playlist YouTube, ne logguent pas de token, et verifient toujours ownership par `userId`.
- Must never happen: cross-user read/write de Feed, creation/modification/suppression de playlist YouTube par une action Feed locale, usage de `search.list`, boucle de sync automatique de toutes les chaines, fuite de playlist non repertoriee ou token dans logs/diagnostics.
- Partial failure: si une source echoue ou n'a plus de videos visibles, le Feed indique la source concernee mais continue de rendre les autres videos.

## Problem

Le modele actuel pousse l'utilisateur vers les playlists YouTube ou vers une source virtuelle globale `__subscriptions__`. Or le besoin produit principal est de regrouper des chaines par intention: cuisine, tech, musique, apprentissage, etc. Utiliser les playlists YouTube pour cela coute cher en quota des qu'on ajoute ou retire des videos (`playlistItems.insert/delete` a 50 unites), cree des side effects sur le compte YouTube de l'utilisateur, et ne correspond pas a une lecture dynamique de nouvelles videos de chaines suivies.

## Solution

Renommer la surface Playlists en `Lists`, puis y ajouter une couche produit ReplayGlows appelee `Feeds`: des agrégateurs virtuels persistants de sources YouTube deja connues. Un Feed contient des references vers des chaines, playlists, la source subscriptions, ou plus tard des tags/favoris; il agrege les videos depuis le cache local, applique tri/filtres/watched/hidden, puis alimente la lecture continue sans ecriture YouTube par defaut.

## Scope In

- Backend Convex: tables et fonctions pour `virtualFeeds`, `virtualFeedSources`, ordre, ownership, CRUD, aggregation, stats, et validation des sources.
- Flutter web: nouveaux modeles, providers Riverpod, mutations, surface `Lists` pour creation/edition des Feeds et affichage des playlists YouTube, ajout/retrait de sources, detail Feed, et lecture Play.
- Renommage user-facing de la surface Playlists en `Lists`, y compris bottom/nav labels, titres, routes/copy i18n et etats vides; les routes legacy peuvent rediriger pour compatibilite.
- Sources v1: chaines YouTube depuis `youtubeChannelsCache`, playlists cachees depuis `youtubePlaylistsCache`, et source speciale subscriptions si deja disponible.
- Aggregation v1: videos issues de `youtubeVideosCache`, filtre hidden/watched selon preferences, tri newest/oldest, deduplication par `youtubeVideoId`, et queue Play dans l'ordre affiche.
- UX quota-safe: les actions locales Feed ne montrent pas de cout quota; les actions de refresh/sync continuent d'utiliser `youtube_quota_guard.dart` et le backend quota-safe.
- Migration douce: le Feed principal actuel reste disponible; les nouveaux Feeds n'effacent pas les playlists ni les liens existants.
- i18n anglais/francais pour noms de surfaces, etats vides, erreurs, actions locales, et distinction Feed ReplayGlows vs playlist YouTube.

## Scope Out

- Pas de creation, modification ou suppression automatique de playlists YouTube depuis un Feed ReplayGlows.
- Pas de nouvelle entree de navigation separee `Feeds` dans v1; les Feeds vivent dans `Lists`.
- Pas de migration forcee des `channelPlaylistLinks` existants vers Feeds dans ce chantier.
- Pas de `search.list`, recherche YouTube globale, ou ajout de chaine inconnue par recherche publique.
- Pas de sync automatique agressive de toutes les chaines d'un Feed en arriere-plan.
- Pas de changement OAuth scope sans decision produit separee.
- Pas de promesse marketing/pricing publique sur quotas ou limites de nombre de Feeds.
- Pas de moteur de recommandation ou tags IA dans v1.

## Constraints

- Toutes les mutations Feed sont server-side Convex et verifient `userId` depuis l'identite authentifiee.
- Les Feeds sont des ressources ReplayGlows, pas des ressources YouTube; leur CRUD doit rester sans appel YouTube externe.
- Les sources d'un Feed doivent etre referencees par IDs stables caches: `youtubeChannelId`, `youtubePlaylistId`, ou source interne type `subscriptions`.
- L'agregation doit dedupliquer par `youtubeVideoId`, garder une origine principale pour l'affichage, et ne pas dupliquer une meme video si elle vient de plusieurs sources.
- Les videos cachees sans `youtubeChannelId` ne doivent pas casser le Feed; elles peuvent apparaitre via playlist source mais pas via source chaine tant que la metadata manque.
- Les limites de pagination doivent etre explicites pour eviter des listes trop lourdes dans Flutter/Convex.
- Les endpoints YouTube d'ecriture restent exclus par defaut car `playlistItems.insert/delete/update` coutent 50 unites chacun selon la doc officielle.

## Dependencies

- Runtime: Flutter web, Riverpod, go_router, Convex queries/mutations/actions, Clerk-authenticated Convex context.
- Backend contracts: `youtubePlaylistsCache`, `youtubeVideosCache`, `youtubeChannelsCache`, `hiddenItems`, `watchedVideos`, `youtubeSyncJobs`, `channelPlaylistLinks`.
- Existing app contracts: Feed screen, Play screen, `playbackSessionProvider`, quota guard, current Playlists/playlist detail surface to be renamed `Lists`, Preferences subscription cache.
- Official external docs checked 2026-05-28:
  - YouTube Data API quota calculator: `https://developers.google.com/youtube/v3/determine_quota_cost`
  - YouTube Data API getting started/quota: `https://developers.google.com/youtube/v3/getting-started#quota`
  - YouTube Data API playlistItems reference: `https://developers.google.com/youtube/v3/docs/playlistItems`
- Freshness verdict: `fresh-docs checked` for YouTube quota cost behavior. Re-check official docs before implementation if the implementation adds any new YouTube endpoint beyond existing cache reads and quota-safe sync.

## Invariants

- ReplayGlows cache-first behavior remains: showing cached videos must not trigger YouTube API calls.
- User-owned Feed data must never be visible or mutable by another user.
- A Feed local action must not spend YouTube quota.
- YouTube quota usage remains observable and guarded only for actions that actually call YouTube.
- Hidden videos/playlists and watched state continue to apply consistently across global Feed, virtual Feeds, Play, and Lists views.
- `Lists` contains both actual cached YouTube playlists/imported playlists/subscriptions source and ReplayGlows virtual Feeds, but the UI must identify which actions are local ReplayGlows actions and which actions touch YouTube.
- The main Feed filter remains feed-level only: `All videos` or one or more selected ReplayGlows Feeds.
- The internal subscriptions aggregate is a Feed source option, not a YouTube playlist card in `Lists`.

## Links & Consequences

- Upstream: YouTube OAuth tokens, subscription cache refresh, playlist URL import, quota-safe sync, Clerk identity.
- Downstream: Feed navigation, Lists navigation, Play queue, AppShell labels, Preferences source management, Stats/quota UI, diagnostics/support copy.
- Data contracts touched: new feed tables, source type enum, aggregation query result shape, Flutter models/providers.
- Regression areas: global Feed list, playlist detail, Play queue previous/next, watched/hidden filters, quota guard, i18n, mobile tab/view-mode sync.
- Product consequence: `Lists` becomes the umbrella surface for YouTube playlists and ReplayGlows Feeds; public copy must not imply virtual Feeds edit YouTube playlists.
- Security consequence: source validation and ownership are backend responsibilities; Flutter source IDs are untrusted input.

## Documentation Coherence

- Update `app/AGENT.md` if `Lists` vs YouTube Playlist vs ReplayGlows Feed becomes an app-level contract.
- Update `backend/AGENT.md` or backend docs if new Convex tables/functions become formal integration boundaries.
- Update `shipglows_data/technical/app/architecture.md` and backend architecture docs if present.
- Keep public marketing/pricing unchanged unless a later content spec decides to advertise virtual Feeds.
- Add changelog entries only during implementation/ship, not in this spec-only run.

## Edge Cases

- User creates a Feed with no sources: show empty source state and add-source CTA.
- User adds the same channel twice: backend rejects duplicate active source.
- Same video appears through multiple sources: show it once, with deterministic source attribution.
- User hides a playlist or video that is part of a Feed: hidden item is excluded unless user chooses to show hidden later.
- User excludes watched videos: Feed queue updates and active Play scroll only targets visible videos.
- User changes source order: aggregation remains deterministic and does not rewrite YouTube order.
- User deletes a source while Play is reading from that Feed: current queue remains stable for the session; next Feed open reflects deletion.
- User deletes a source while viewing Feed detail: the source card and videos from that source are removed optimistically, then providers refresh the authoritative state.
- User lacks subscription cache because YouTube is connected but no channel/subscriptions exist: show local Feed shell plus actionable refresh/connect state.
- Old cached videos missing channel IDs: playlist-based Feeds still work; channel-based aggregation ignores missing channel metadata safely.
- Multiple tabs edit the same Feed: backend ownership and updatedAt prevent corrupt state; UI refreshes from provider invalidation.

## Implementation Tasks

- [ ] Task 1: Design backend schema for virtual Feeds.
  - File: `backend/packages/backend/convex/schema.ts`
  - Action: Add `virtualFeeds` and `virtualFeedSources` tables with userId, title, description, color/icon optional, sortOrder, includeWatched, source type, source ID, position, isActive, createdAt, updatedAt.
  - User story link: Gives ReplayGlows a local organization layer independent from YouTube playlists.
  - Depends on: None
  - Validate with: `cd backend/packages/backend && npm run typecheck`
  - Notes: Prefer normalized source rows over storing a large mutable source array in one feed document.

- [ ] Task 2: Implement Feed CRUD and source validation.
  - File: `backend/packages/backend/convex/virtualFeeds.ts`
  - Action: Add queries/mutations for list feeds, get feed detail, create/update/delete feed, add/remove/reorder/toggle sources; validate source ownership against channel/playlist/subscriptions cache.
  - User story link: User can create and maintain thematic Feeds safely.
  - Depends on: Task 1
  - Validate with: backend typecheck and targeted tests if backend test harness exists.
  - Notes: Reject duplicate source per feed; never call YouTube from these local mutations.

- [ ] Task 3: Implement cached aggregation query.
  - File: `backend/packages/backend/convex/virtualFeeds.ts`, possibly helper in `youtube.ts`
  - Action: Return aggregated videos for a Feed from `youtubeVideosCache`, applying source filters, hidden/watched preferences, dedupe, pagination, stats and deterministic sort.
  - User story link: Feed detail shows the videos the user can read/play without remote side effects.
  - Depends on: Task 2
  - Validate with: backend typecheck and source-level tests for dedupe, hidden, watched and empty source cases.
  - Notes: Keep page size bounded; expose enough metadata for thumbnail/list/text-only views.

- [ ] Task 4: Add Flutter models, providers and mutations.
  - File: `app/lib/models/`, `app/lib/providers/providers.dart`, `app/lib/providers/mutations.dart`
  - Action: Add typed `VirtualFeed`, `VirtualFeedSource`, aggregate result models, Riverpod providers and mutation helpers with invalidation.
  - User story link: UI can consume Feed state consistently without ad hoc maps.
  - Depends on: Task 3
  - Validate with: `cd app && flutter analyze`
  - Notes: Keep Convex response normalization consistent with existing provider patterns.

- [ ] Task 5: Rename Playlists surface to Lists and add Feed cards.
  - File: `app/lib/screens/playlists/`, `app/lib/app/router.dart`, `app/lib/widgets/app_shell.dart`, `app/lib/i18n/en.dart`, `app/lib/i18n/fr.dart`
  - Action: Rename user-facing Playlists to `Lists`, keep legacy route redirects, and show both YouTube playlist cards and ReplayGlows Feed cards with distinct icons/labels/actions.
  - User story link: User can create `Cuisine` and see its videos as a first-class product surface.
  - Depends on: Task 4
  - Validate with: Flutter analyze and widget tests where practical.
  - Notes: Avoid a separate Feeds tab in v1; `Lists` is the umbrella surface.

- [ ] Task 6: Add source picker from subscriptions and playlists.
  - File: `app/lib/screens/playlists/`, `app/lib/screens/preferences/preferences_screen.dart`
  - Action: Let the user add cached channels/subscriptions/playlists to a Feed, show empty/cache-stale states, and route costly refresh actions through existing quota guard.
  - User story link: User can group cooking channels or other themes without touching YouTube playlists.
  - Depends on: Task 5
  - Validate with: Flutter analyze and manual QA on account with and without cached subscriptions.
  - Notes: Adding a cached source is local; refreshing subscriptions remains quota-aware.

- [ ] Task 7: Wire Feed playback queue and return-to-active scroll.
  - File: `app/lib/screens/playlists/`, `app/lib/screens/play/play_screen.dart`, `app/lib/providers/providers.dart`
  - Action: Start `playbackSessionProvider` from virtual Feed detail order, preserve previous/next swipe, and scroll the Feed detail to active video when returning from Play.
  - User story link: User can launch all videos from a thematic Feed and stay oriented.
  - Depends on: Task 5
  - Validate with: `cd app && flutter analyze && flutter test`
  - Notes: Reuse the existing queue semantics from the global Feed work.

- [ ] Task 8: Add i18n, copy and quota-safe affordances.
  - File: `app/lib/i18n/en.dart`, `app/lib/i18n/fr.dart`, `app/lib/widgets/youtube_quota_guard.dart`
  - Action: Add labels/errors that distinguish local Feed edits from YouTube sync costs; ensure refresh buttons still display quota cost.
  - User story link: User understands why Feeds are cheap and when YouTube quota is spent.
  - Depends on: Tasks 5-6
  - Validate with: Flutter analyze and visual/manual copy review.
  - Notes: Do not overpromise unlimited quota or background automation.

## Acceptance Criteria

- [ ] CA 1: Given a connected user with cached subscriptions, when they open `Lists`, then they see YouTube playlists and ReplayGlows Feeds as distinct list types.
- [ ] CA 2: Given a connected user with cached subscriptions, when they create Feed `Cuisine`, then it appears in `Lists` with zero sources and an add-source CTA.
- [ ] CA 3: Given a cached channel, when the user adds it to `Cuisine`, then the source is saved locally without calling a YouTube write endpoint.
- [ ] CA 4: Given a Feed with two channel sources, when the user opens it, then videos from both channels appear once each, sorted by the selected order.
- [ ] CA 5: Given the same video appears via a channel and a playlist source, when the Feed aggregates videos, then it shows one row/card for that `youtubeVideoId`.
- [ ] CA 6: Given watched videos are hidden, when the user opens a Feed, then watched videos are excluded from the visible queue.
- [ ] CA 7: Given hidden videos or playlists exist, when the Feed aggregates, then hidden items are not shown by default.
- [ ] CA 8: Given the user presses Play in a virtual Feed, when Play opens, then the queue starts with the first visible video and continues in order.
- [ ] CA 9: Given the user watched several videos from a virtual Feed, when they return to that Feed, then the detail view scrolls to the active video.
- [ ] CA 10: Given the user removes a channel source, when the mutation succeeds, then no YouTube playlist item is inserted, updated, or deleted.
- [ ] CA 11: Given YouTube quota is high, when the user edits local Feed sources, then the action still works because it does not call YouTube.
- [ ] CA 12: Given the user chooses to refresh subscriptions or source videos, when the action would call YouTube, then quota guard and progress UI apply.
- [ ] CA 13: Given another user guesses a Feed ID, when they query or mutate it, then the backend rejects access.
- [ ] CA 14: Given a source is deleted or stale, when the Feed opens, then the app shows a recoverable source state and still renders valid cached videos.
- [ ] CA 15: Given the app is in French, when the user manages Feeds, then labels and errors explain `Feed ReplayGlows` vs `playlist YouTube` clearly.
- [ ] CA 16: Given the user removes a Feed source, when the mutation succeeds, then the source card and videos from that source disappear without a page reload.
- [ ] CA 17: Given the user opens the main Feed filter, when the picker appears, then it offers `All videos` and ReplayGlows Feeds only, with multi-select Feed support.
- [ ] CA 18: Given the user opens `Lists`, when YouTube playlists are shown, then the technical `Subscriptions` aggregate is hidden.
- [ ] CA 19: Given the user adds a source to a Feed, when source choices are shown, then `All subscriptions` remains available as a source option.

## Test Contract

- surface: ReplayGlows Flutter app `Lists`, Feed detail, Play queue, Convex virtual feed functions, and quota guard.
- proof_profile: mixed automated and manual proof because the feature spans backend ownership, Flutter navigation, cached aggregation and authenticated YouTube cache state.
- proof_order:
  1. Backend schema/function typecheck.
  2. Backend source/test proof for local-only Feed mutations, ownership and aggregation.
  3. Flutter static analysis and widget/model tests.
  4. Manual QA with a connected account that has cached subscriptions/playlists.
- checklist_path: `shipglows_data/workflow/audits/replayglows-virtual-feeds-channel-aggregators-qa.md` if manual QA is recorded as a durable checklist during implementation.
- required_scenario_ids: `CA 1` through `CA 15`.
- required_results: local Feed CRUD works in `Lists`; local Feed source edits do not spend YouTube quota or call YouTube write endpoints; Play queue starts in visible order; backend denies cross-user access.
- exception_with_proof: manual QA may be partial if authenticated YouTube cache fixtures are unavailable, but backend ownership/quota-safety and Flutter static checks must still pass.
- exception_without_proof: not allowed for backend ownership checks, quota write-endpoint source scan, or Flutter analysis.

## Test Strategy

- Backend:
  - Typecheck Convex backend.
  - Unit/helper tests for source validation, duplicate rejection, aggregation, dedupe, hidden/watched filtering and ownership denial where existing test harness allows.
  - Source scan confirming local Feed mutations do not call `playlistItems.insert`, `playlistItems.delete`, `playlistItems.update`, `playlists.insert`, `playlists.update`, `playlists.delete`, or `search.list`.
- Flutter:
  - `flutter analyze`.
  - `flutter test`.
  - Widget tests for empty Feeds, source picker, Feed detail empty/error states and Play queue start where practical.
- Manual QA:
  - Open `Lists` and confirm YouTube playlists and ReplayGlows Feeds are distinguishable.
  - Create Feed with subscriptions cache.
  - Add two channels and one playlist source.
  - Play all, swipe previous/next, return to Feed active video.
  - Toggle watched/hidden filters.
  - Confirm quota indicator does not change for local source edits.

## Risks

- Product naming confusion: mitigate with explicit `ReplayGlows Feed` copy and by keeping YouTube Playlists separate.
- Data fan-out/performance: mitigate with bounded pagination, dedupe server-side, indexes by user/source, and cache-first aggregation.
- Ownership leakage: mitigate with all source validation and feed queries scoped by authenticated `userId`.
- Quota regression: mitigate by forbidding YouTube write calls in local Feed mutations and preserving quota guard for sync.
- Metadata gaps: old cached videos may lack channel IDs; mitigate by supporting playlist sources and requiring safe empty states.
- Scope creep: defer AI recommendations, public search, background automation and YouTube playlist export to separate specs.

## Execution Notes

- Read first:
  - `backend/packages/backend/convex/schema.ts`
  - `backend/packages/backend/convex/youtube.ts`
  - `backend/packages/backend/convex/channelLinks.ts`
  - `app/lib/screens/videos/videos_screen.dart`
  - `app/lib/screens/play/play_screen.dart`
  - `app/lib/screens/playlists/playlists_screen.dart`
  - `app/lib/screens/playlists/playlist_detail_screen.dart`
  - `app/lib/providers/providers.dart`
- Implementation order: backend schema -> backend CRUD -> aggregation -> Flutter models/providers -> UI -> playback wiring -> i18n/tests.
- Prefer structured Convex tables and typed Dart models; avoid ad hoc JSON maps in UI code where a model is reasonable.
- Do not add new OAuth scopes or YouTube write endpoints in this chantier.
- Validation commands:
  - `(cd backend/packages/backend && npm run typecheck)`
  - `(cd app && flutter analyze)`
  - `(cd app && flutter test)`
  - `/home/claude/shipglows/tools/shipglows_metadata_lint.py AGENT.md shipglows_data`
- Stop and ask if implementation requires public YouTube search, automatic background sync of every source, new OAuth scopes, or exporting virtual Feeds into real YouTube playlists.

## Open Questions

None.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-05-28 17:52:05 UTC | sf-spec | GPT-5 Codex | Created draft spec for ReplayGlows virtual Feeds after product decision to avoid costly YouTube playlist writes for channel grouping. | draft spec created | `/sf-ready replayglows-virtual-feeds-channel-aggregators` |
| 2026-05-28 18:08:00 UTC | sf-ready | GPT-5 Codex | Integrated operator decision that Feeds live inside Playlists renamed to Lists, added Test Contract, reviewed structure, scope, security, quota and acceptance criteria. | ready | `/sf-start replayglows-virtual-feeds-channel-aggregators` |
| 2026-05-28 22:29:00 UTC | sf-start | GPT-5.3 Codex Spark delegated sequential | Implemented backend virtual feed schema/functions, Dart model/provider/mutation baseline, Lists cards, create flow, and feed detail route; source management, complete playback return behavior, i18n split, and source-scan tests remain. | partial | `/sf-start replayglows-virtual-feeds-channel-aggregators continue source-picker-playback-i18n` |
| 2026-05-28 22:29:00 UTC | sf-verify | GPT-5 Codex | Verified local checks, quota-safety source scan for virtual feed surfaces, and acceptance coverage; implementation is not complete enough for clean verification. | partial | `/sf-start replayglows-virtual-feeds-channel-aggregators continue source-picker-playback-i18n` |
| 2026-05-29 03:21:50 UTC | sf-start | GPT-5.3 Codex (degraded fallback; requested GPT-5.3 Codex Spark at capacity) | Completed source picker/add-remove-toggle-reorder UX with cache-empty/error + quota-aware refresh path, finalized virtual Feed play flow/queue handoff + return-to-active scroll behavior, and finished EN/FR Lists vs ReplayGlows Feed copy updates with local validation and quota-safety scans. | implemented | `/sf-verify replayglows-virtual-feeds-channel-aggregators` |
| 2026-05-29 03:41:48 UTC | sf-verify | GPT-5 Codex | Re-ran backend typecheck, Flutter analyze/tests, ShipGlows metadata lint, and targeted quota-safety scan; implementation satisfies local contract, with hosted preview/browser/manual proof still pending because development mode is vercel-preview-push. | partial | `sf-ship -> sf-prod -> sf-test --preview` |
| 2026-05-29 03:41:48 UTC | sf-build | GPT-5 Codex orchestrator + delegated sequential fallback | Orchestrated continuation through delegated sf-start, handled GPT-5.3 Codex Spark capacity degradation with GPT-5.3 Codex fallback, and completed local sf-verify. | partial | `sf-ship -> sf-prod -> sf-test --preview` |
| 2026-05-29 13:01:18 UTC | sf-browser | GPT-5 Codex | Confirmed no authenticated browser verification was performed with the test account; development mode still requires shipping to Vercel preview before browser/manual proof can be authoritative. | needs-deploy | `sf-ship -> sf-prod -> sf-test --preview with test account` |
| 2026-05-29 14:37:58 UTC | sf-prod | GPT-5 Codex | Updated git origin to the moved repository, confirmed push was up to date, waited for Vercel deployment `dpl_GeaGpGQBNJYEkUTUFKDgohEhaeTZ` for commit `e064a0f`, verified status READY, build logs completed, and public alias `https://app.replayglows.com/` returned 200; raw deployment URL is protected with Vercel SSO 401. | partial | `sf-test --preview https://app.replayglows.com with test account` |
| 2026-05-29 14:54:55 UTC | sf-browser | GPT-5 Codex | Used existing authenticated Playwright state for the test account on `https://app.replayglows.com/`; found `Lists` stuck on skeleton until Convex prod functions were deployed, then verified `Lists` renders the existing YouTube playlist, the create dialog exposes `YouTube Playlist` and `ReplayGlows Feed`, playlist detail opens, Play All routes to `/play?videoId=vSCF6pTxqJ8`, and Feed -> Play preserves the active video. | partial | `sf-test with explicit approval for creating a test ReplayGlows Feed and adding a source` |
| 2026-05-29 23:53:49 UTC | sf-browser | GPT-5 Codex | With explicit production-test approval, created `QA Feed 2026-05-29`, added existing playlist `Fun` as a source, verified counters/video aggregation and Play all enablement, removed the source, then deleted the test Feed; found visible raw i18n keys in the create/source-picker flow and applied a narrow Flutter fix. | partial | `sf-ship -> sf-prod -> sf-browser recheck i18n on https://app.replayglows.com` |

## Current Chantier Flow

| Phase | Status | Notes |
|-------|--------|-------|
| sf-spec | complete | Draft created from operator product decision and YouTube quota evidence. |
| sf-ready | complete | Navigation decision resolved: virtual Feeds live in `Lists`; spec has no blocking open questions. |
| sf-start | complete | Virtual Feed source picker (channels/subscriptions/playlists), add/remove/toggle/reorder, cache-empty/stale affordances, quota-aware refresh actions, play queue launch from Feed detail, return-to-active scroll, and EN/FR Lists/Feed copy are implemented with passing local typecheck/analyze/tests and targeted quota-safety scans. |
| sf-verify | partial | Local verification passes; authenticated browser smoke passes for `Lists`, create-dialog visibility, playlist detail, Play All, Feed -> Play active-video preservation, and production test-account Feed create/add-source/remove-source/delete cleanup. A narrow i18n fix is pending ship/redeploy/recheck because browser QA exposed raw translation keys. |
| sf-end | pending | Close trackers/docs after verification. |
| sf-ship | pending | Operator shipped commit `e064a0f`, then trace commit `a2edeea`; i18n repair from production browser QA now needs a new commit, push, deploy, and browser recheck. |
