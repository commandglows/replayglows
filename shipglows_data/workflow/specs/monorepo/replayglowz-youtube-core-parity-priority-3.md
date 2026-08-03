---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-05-25"
created_at: "2026-05-25 17:55:50 UTC"
updated: "2026-05-25"
updated_at: "2026-05-26 05:19:08 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "youtube-core-feature-parity-priority-3"
owner: "Diane"
user_story: "En tant qu'utilisateur ReplayGlowz qui revient souvent dans l'app, je veux que l'interface retienne mes habitudes et m'aide discretement au bon moment, afin de retrouver la fluidite de TubeFlow sans ajouter de friction au premier usage."
confidence: "medium"
risk_level: "medium"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "app"
  - "backend"
  - "Flutter Web"
  - "Riverpod"
  - "Convex"
  - "YouTube OAuth"
depends_on:
  - artifact: "AGENTS.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "app/AGENT.md"
    artifact_version: "1.2.0"
    required_status: "reviewed"
  - artifact: "shipglows_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipglows_data/workflow/specs/replayglowz-youtube-core-parity-priority-1.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "shipglows_data/workflow/specs/replayglowz-youtube-core-parity-priority-2.md"
    artifact_version: "1.0.0"
    required_status: "ready"
supersedes: []
evidence:
  - "Feature-gap audit records P3 gaps: onboarding, hints, study/focus mode, scroll restoration, persistent view preferences, and i18n parity."
  - "Priority 2 spec leaves Task 9 open: onboarding and persistent UX helpers."
  - "Current Flutter app has `youtube_connect_ui_states.dart`, local YouTube connect banner dismissal, limited view-mode state in `videos_screen.dart`, and a `ScrollController` in `playlists_screen.dart`."
  - "Current backend settings schema persists theme, language, notifications, playback, notes, channelSync and transcripts, but not app UX helper state or persisted feed/playlist view preferences."
  - "Current `app/lib/i18n/en.dart` and `fr.dart` still contain TODO headers to copy remaining sections."
  - "Documentation freshness gate applied: P3 is primarily local Flutter/Convex state and UX; no new external API behavior is introduced."
next_step: "/sf-auth-debug retest ReplayGlowz YouTube sync with empty-channel test account"
---

# Spec: ReplayGlowz YouTube Core Parity Priority 3

## Title

ReplayGlowz YouTube core parity priority 3

## Status

ready

## User Story

En tant qu'utilisateur ReplayGlowz qui revient souvent dans l'app, je veux que l'interface retienne mes habitudes et m'aide discretement au bon moment, afin de retrouver la fluidite de TubeFlow sans ajouter de friction au premier usage.

## Minimal Behavior Contract

ReplayGlowz doit ajouter une couche UX persistante et discrete autour des workflows YouTube deja retablis: onboarding progressif pour connecter YouTube et comprendre les etats vides, hints dismissibles pour les gestes/actions avancees, preferences d'affichage persistantes, restauration de scroll raisonnable, raccourcis clavier utiles dans le player, et un mode focus/study leger qui masque les panneaux secondaires sans changer le modele de donnees. Les aides doivent etre dismissibles et ne jamais bloquer l'action principale. L'edge case facile a rater est le nouveau compte YouTube vide: l'app doit guider sans faire croire a une erreur et sans lancer de sync couteuse ou automatique.

## Success Behavior

- Preconditions: l'utilisateur est authentifie, ReplayGlowz est initialise, les providers P1/P2 peuvent charger ou echouer proprement, et les settings utilisateur sont disponibles ou substitues par des defaults locaux.
- Trigger: l'utilisateur ouvre Videos, Playlists, Playlist detail, Play, Preferences ou Notes; change un mode d'affichage; ferme une aide; revient sur une page; ou active un mode focus/study.
- User/operator result: les nouveaux utilisateurs voient des messages courts et contextuels pour connecter YouTube, importer/synchroniser, creer une playlist, comprendre un compte YouTube vide, configurer un transcript provider, et utiliser les notes.
- User/operator result: les hints de swipe/action/menu/shortcuts sont affiches une fois par contexte, dismissibles, puis restent caches pour ce compte ou ce navigateur selon la sensibilite du hint.
- User/operator result: les preferences d'affichage utiles sont persistantes: feed tab/vue, show watched, filtre playlist recent quand il est encore valide, tri notes, tri/provider transcripts, playlist layout, et eventuellement densite compacte.
- User/operator result: revenir d'un detail ou du player restaure la position de scroll feed/playlist quand la liste source est encore coherente.
- User/operator result: le player expose un mode focus/study leger: panneaux notes/transcript/queue repliables, raccourcis clavier visibles dans un overlay discret, et persistance du dernier layout choisi.
- System effect: les nouveaux champs persistants sont valides server-side, namespaced dans `settings.ux` ou un objet equivalent, et ne contiennent aucune donnee sensible, token, secret, URL privee ou contenu de note.
- Success proof: Flutter analyze, parser/model tests pour les nouveaux settings, backend typecheck si schema/settings changent, metadata lint, et QA manuelle non-auth/auth sur premier usage, compte YouTube vide et compte avec donnees.

## Error Behavior

- Expected failures: settings Convex indisponibles, ancien document settings sans champs UX, filtre playlist pointe vers une playlist supprimee, scroll anchor disparu, local dismissal corrompu, clavier non disponible sur mobile, player iframe non pret, langue non supportee, ou compte YouTube vide.
- User/operator response: l'app retombe sur des defaults silencieux, ignore les preferences invalides, affiche un etat vide utile, et permet toujours l'action principale.
- System effect: une preference invalide ne casse pas le chargement de settings; elle est ignoree ou remplacee par un default borne. Les dismissals ne masquent jamais les erreurs critiques.
- Must never happen: stocker des secrets/tokens dans UX settings, lancer une sync YouTube automatique pour remplir un onboarding, bloquer la lecture derriere un tutorial, ou afficher une explication WinFlowz/Suite intrusive pendant le signup ReplayGlowz.

## Problem

Les workflows de base et avances YouTube reviennent progressivement dans ReplayGlowz, mais l'app reste moins fluide que l'ancien TubeFlow sur les comportements quotidiens: elle oublie des choix d'affichage, elle ne guide pas assez les etats vides, elle expose encore des actions avancees sans hints contextuels, et certains textes ne sont pas encore i18n. Cela donne une impression d'application inachevee meme quand le backend fonctionne.

## Solution

Ajouter une couche P3 centree app UX: un modele persistant de preferences UX, des widgets d'aide dismissibles reutilisables, une restauration de navigation/scroll bornee, un focus mode leger dans le player, et une passe i18n sur les surfaces P1/P2/P3. Les changements backend doivent rester limites aux settings et ne doivent pas modifier les contrats YouTube/OAuth.

## Scope In

- Modele Flutter pour settings UX persistants et parsing backward-compatible.
- Extension Convex `settings` pour preferences UX non sensibles si la persistance cross-device est utile.
- Hints dismissibles pour connect YouTube, empty account, feed actions, playlist actions, channel linking, transcript provider, notes export et shortcuts.
- Preferences d'affichage persistantes pour Videos, Playlists, Notes, Transcript providers et Player layout.
- Scroll restoration entre feed/detail/play et playlists/detail quand la liste source existe toujours.
- Player focus/study mode leger: replier les panneaux, garder la video et les notes/transcript selon le mode, afficher un overlay de shortcuts, memoriser le layout.
- i18n anglais/francais pour les nouvelles surfaces et remplacement des strings P1/P2 les plus visibles encore hard-codees.
- Tests de parsing/settings et sanity checks UI statiques.
- Mise a jour de l'audit Expo pour marquer P3 partiel/complete selon implementation.

## Scope Out

- Browse/discovery view complete.
- Mini-player global overlay.
- Study mode avance avec workflows pedagogiques, flashcards, spaced repetition ou AI.
- Migration legacy TubeFlow.
- Nouveaux scopes OAuth YouTube.
- Nouveaux appels YouTube, nouvelle recherche YouTube ou `search.list`.
- Promesses publiques de quotas/pricing definitives.
- Analytics comportementales externes.
- Stockage du contenu des notes, requetes de recherche ou historique detaille dans les preferences UX.

## Constraints

- Garder le premier usage simple: l'utilisateur cree ou connecte son compte ReplayGlowz, puis les explications avancees apparaissent seulement en contexte.
- Toute persistance server-side doit etre backward-compatible avec les documents settings existants.
- Toute persistance locale doit etre non critique: si elle disparait, l'app reste correcte.
- Les dismissals d'aide ne doivent pas cacher les erreurs d'auth, quota, sync ou secrets.
- Les modes clavier doivent respecter les champs texte: aucun raccourci global ne doit voler la saisie dans notes, recherche ou formulaires.
- Les preferences de filtre doivent se valider contre les donnees chargees; un filtre invalide est clear automatiquement.
- Les nouvelles strings doivent passer par le systeme i18n existant ou une abstraction compatible.
- Les UI cards ne doivent pas devenir des landing pages dans l'app; les aides restent compactes et actionnables.

## Dependencies

- Local contracts:
  - `app/lib/models/settings.dart`
  - `backend/packages/backend/convex/schema.ts`
  - `backend/packages/backend/convex/settings.ts`
  - `app/lib/providers/providers.dart`
  - `app/lib/providers/mutations.dart`
  - `app/lib/widgets/youtube_connect.dart`
  - `app/lib/widgets/youtube_connect_ui_states.dart`
  - `app/lib/screens/videos/videos_screen.dart`
  - `app/lib/screens/playlists/playlists_screen.dart`
  - `app/lib/screens/playlists/playlist_detail_screen.dart`
  - `app/lib/screens/play/play_screen.dart`
  - `app/lib/screens/notes/notes_screen.dart`
  - `app/lib/screens/notes/note_detail_screen.dart`
  - `app/lib/screens/preferences/preferences_screen.dart`
  - `app/lib/i18n/en.dart`
  - `app/lib/i18n/fr.dart`
  - `app/lib/i18n/translations.dart`
- Freshness verdict: `fresh-docs not needed` for implementation approach because P3 does not add new external API/OAuth behavior. Re-check official Flutter docs only if the implementation introduces a new routing/state restoration package.

## Invariants

- Backend settings remains optional and tolerant of partial documents.
- UI helper state is advisory; it cannot become authorization, entitlement, quota or sync state.
- YouTube quota-safe behavior from P1/P2 remains unchanged.
- A dismissed hint can be reset by clearing browser/app state or via a small Preferences control if implemented.
- Keyboard shortcuts are inactive while focus is in editable controls.
- Focus/study mode is a presentation mode only; it does not fork note/transcript data.

## Links & Consequences

- Upstream: Clerk auth, product access defaults, settings query/mutation, YouTube connection state, playlist/feed/transcript providers.
- Downstream: first-run dashboard impression, support diagnostics, user learning curve, QA checklist, i18n completeness.
- Data contracts touched: settings schema, settings model, possible local SharedPreferences keys, route state, page scroll anchors.
- Regression areas: settings parsing, Preferences save flows, video feed filters, player notes input, playlist navigation, mobile layout, i18n fallback.

## Documentation Coherence

- Update the Expo feature-gap audit after implementation.
- Update `app/AGENT.md` only if a new settings UX contract becomes a maintained runtime boundary.
- Do not update public site copy for P3 unless a separate copy spec decides onboarding claims.
- The final master checklist requested by the user is a separate artifact after P3 implementation, not part of this spec's deliverable.

## Edge Cases

- Fresh ReplayGlowz account with no YouTube connection.
- Google account connected to YouTube OAuth but no YouTube channel/playlists/subscriptions.
- User has dismissed hints locally but logs in on another browser.
- User changes language after hints were dismissed.
- Playlist filter references a deleted playlist.
- Video feed list changes while restoring scroll.
- Keyboard shortcut pressed while typing a note or editing playlist title.
- Mobile screen where shortcut overlay or focus mode controls would crowd the player.
- Convex settings returns null or an older document without `ux`.
- P2 transcript provider card has no available provider and no secret configured.

## Implementation Tasks

- [x] Task 1: Define UX settings contract.
  - File: `app/lib/models/settings.dart`, `backend/packages/backend/convex/schema.ts`, `backend/packages/backend/convex/settings.ts`.
  - Action: Add backward-compatible `ux` settings for dismissed hints, view preferences, player layout/focus mode and optional last-used filters; keep values bounded and non-sensitive.
  - User story link: Makes daily ReplayGlowz behavior persistent across sessions.
  - Depends on: P2 provider/settings patterns.
  - Validate with: backend typecheck and Flutter model tests.
  - Notes: Prefer server-side settings for cross-device preferences; use local-only storage only for purely browser-local scroll state.

- [x] Task 2: Add reusable dismissible helper UI.
  - File: `app/lib/widgets/`, `app/lib/providers/providers.dart`, `app/lib/providers/mutations.dart`.
  - Action: Build compact hint/banner components with stable IDs, dismiss actions, reset support and i18n keys.
  - User story link: Helps users discover restored workflows without permanent clutter.
  - Depends on: Task 1.
  - Validate with: Flutter analyze and model/parser tests.
  - Notes: Do not use large explanatory onboarding modals as the default.

- [x] Task 3: Wire first-run and empty-state onboarding.
  - File: `app/lib/widgets/youtube_connect_ui_states.dart`, `app/lib/screens/videos/videos_screen.dart`, `app/lib/screens/playlists/playlists_screen.dart`, `app/lib/screens/preferences/preferences_screen.dart`.
  - Action: Add contextual states for YouTube disconnected, connected-but-empty, no playlists, no subscriptions, no linked channels and no transcript provider.
  - User story link: New users understand what to do next without seeing technical failures.
  - Depends on: Task 2.
  - Validate with: manual QA on empty Gmail/YouTube account and normal account.
  - Notes: Keep WinFlowz/Suite explanation hidden unless the user explicitly reaches account/help context.

- [x] Task 4: Persist feed, playlist and notes view preferences.
  - File: `app/lib/screens/videos/videos_screen.dart`, `app/lib/screens/playlists/playlists_screen.dart`, `app/lib/screens/notes/notes_screen.dart`, settings model/providers.
  - Action: Persist selected feed tab/view, show-watched state, valid playlist filter, playlist view/layout if present, notes sort/filter and compactness where implemented.
  - User story link: Returning users find the app in the state they expect.
  - Depends on: Task 1.
  - Validate with: Flutter analyze and manual reload/navigation QA.
  - Notes: Clear invalid filters when referenced playlist/video data no longer exists.

- [x] Task 5: Add bounded scroll restoration.
  - File: `app/lib/screens/videos/videos_screen.dart`, `app/lib/screens/playlists/playlists_screen.dart`, `app/lib/screens/playlists/playlist_detail_screen.dart`, possibly new local state helper.
  - Action: Store route-local scroll offsets or item anchors, restore when returning from detail/play, and ignore stale offsets after major filter changes.
  - User story link: Navigation feels continuous during review sessions.
  - Depends on: Task 4.
  - Validate with: manual desktop/mobile navigation QA.
  - Notes: Local browser persistence is enough; do not sync precise scroll offsets to Convex.

- [x] Task 6: Implement lightweight player focus/study mode and shortcuts overlay.
  - File: `app/lib/screens/play/play_screen.dart`, `app/lib/widgets/play/`, settings model/providers.
  - Action: Add presentation-only mode controls, keyboard shortcuts for play/pause, seek, next/previous where supported, notes/transcript panel toggles, a dismissible shortcuts help overlay, mobile bottom-bar playback mode, swipe-up current-video actions, and browser background-playback guidance.
  - User story link: Restores the efficient learning/review feel without building a separate study product.
  - Depends on: Task 1.
  - Validate with: Flutter analyze and manual player QA; verify text inputs do not trigger shortcuts.
  - Notes: Advanced study workflows remain out of scope. Background audio remains browser-dependent for embedded YouTube playback, so the app informs users instead of promising control.

- [x] Task 7: Complete P3 i18n coverage.
  - File: `app/lib/i18n/en.dart`, `app/lib/i18n/fr.dart`, `app/lib/i18n/translations.dart`, touched screens/widgets.
  - Action: Add keys for P1/P2/P3 visible strings touched by this tranche and replace hard-coded copy in modified surfaces.
  - User story link: Restored features feel coherent in both English and French.
  - Depends on: Tasks 2-6.
  - Validate with: `rg -n "TODO: Copy remaining|hard-coded target strings" app/lib/i18n app/lib/screens app/lib/widgets` plus Flutter analyze.
  - Notes: Do not attempt a full app-wide translation rewrite unless the touched surfaces require it.

- [x] Task 8: Add tests, audit update and master-checklist seed.
  - File: `app/test/`, `shipglows_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md`, new checklist artifact only after implementation if requested in the same run.
  - Action: Cover settings parsing/defaults, dismissal persistence, invalid filter clearing where feasible, then update the audit with P3 status and remaining parity gaps.
  - User story link: Prevents regressions and prepares the final end-to-end parity checklist.
  - Depends on: Tasks 1-7.
  - Validate with: Flutter analyze, targeted Flutter tests, backend typecheck if backend touched, ShipGlows metadata lint.
  - Notes: The master checklist should be created after P3 implementation so it reflects the real state, not guesses.

## Acceptance Criteria

- [ ] Fresh account sees ReplayGlowz-first onboarding and no intrusive suite/parent-company explanation.
- [ ] Connected empty YouTube account sees a clear valid empty state on Videos, Playlists and Preferences without server-error language.
- [ ] Dismissible hints appear for relevant first-use contexts and remain dismissed after reload for the chosen persistence scope.
- [ ] Feed, playlist and notes view preferences survive reload and ignore invalid stale filters.
- [ ] Returning from detail/play restores useful list position when the source list is still coherent.
- [ ] Player focus/study mode changes presentation only and remains usable on desktop and mobile.
- [ ] Long-pressing Play on mobile switches the bottom bar into playback controls, and a second long press can leave that mode.
- [ ] Swiping up from Play on mobile reveals current-video actions for hide, mark watched, slower, and faster.
- [ ] If web playback is interrupted after backgrounding, the app explains the browser/YouTube limitation and repeats the popup until the user chooses not to show it again.
- [ ] Keyboard shortcuts work in the player but do not fire while typing.
- [x] English and French strings exist for all newly added visible P3 copy.
- [x] No new YouTube endpoint, OAuth scope, `search.list`, token handling or secret handling is introduced.
- [x] Static checks pass: Flutter analyze, backend typecheck if backend touched, targeted tests and ShipGlows metadata lint.

## Test Strategy

- Static checks:
  - `(cd app && flutter analyze)`
  - `(cd app && flutter test <targeted tests>)`
  - `(cd backend/packages/backend && npm run typecheck)` if schema/settings touched
  - `/home/claude/shipglows/tools/shipglows_metadata_lint.py AGENTS.md shipglows_data`
- Source checks:
  - `rg -n "search\\.list|youtubeAccessToken|refreshToken|clientSecret" app/lib backend/packages/backend/convex`
  - `rg -n "TODO: Copy remaining|TODO: share|TODO: show" app/lib`
- Manual QA:
  - Fresh account before YouTube connection.
  - Connected YouTube account with no channel/playlists/subscriptions.
  - Normal YouTube account with feed/playlists/transcripts/notes.
  - Reload after changing feed tab/filter/show-watched and notes sort.
  - Navigate feed -> play -> back, playlist -> detail -> back.
  - Player shortcuts while focused on body and while typing in notes/search.
  - Mobile viewport smoke for helper UI and focus mode.

## Risks

- P3 can expand into a full learning product; keep focus/study mode lightweight unless a later spec promotes it.
- Persisted filters can confuse users if stale; validate against loaded data and clear automatically.
- Keyboard shortcuts can break note-taking if focus handling is weak.
- i18n can become noisy if the whole app is rewritten; prioritize touched P1/P2/P3 surfaces.
- Cross-device persisted dismissals may hide helpful onboarding for a user switching devices; only persist stable hints server-side.

## Execution Notes

- Use bounded subagents for implementation discovery:
  - one frontend subagent for screens/widgets/i18n hard-coded copy;
  - one backend/settings subagent for schema/settings compatibility and test targets.
- Prefer existing Riverpod settings/mutations patterns over a new state-management layer.
- Use `SharedPreferences` only for browser-local hints or scroll offsets that should not become account data.
- Keep UX copy short and ReplayGlowz-first.
- Do not ship browser-auth claims until changes are deployed to preview/prod and verified with the authenticated QA path.

## Open Questions

None. P3 includes only a lightweight presentation-focused focus/study mode; advanced study workflows are deferred to a later P4 spec if still wanted after parity QA.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-05-25 17:55:50 UTC | sf-spec | GPT-5 Codex | Created Priority 3 YouTube parity spec for onboarding, hints, persisted UX preferences, scroll restoration, focus mode and i18n parity. | draft spec created | `/sf-ready replayglowz-youtube-core-parity-priority-3` |
| 2026-05-25 18:36:35 UTC | sf-ready | GPT-5 Codex | Resolved focus/study scope to lightweight presentation mode and completed readiness review. | ready | `/sf-start replayglowz-youtube-core-parity-priority-3` |
| 2026-05-25 18:45:54 UTC | sf-start | GPT-5 Codex + gpt-5.3-codex subagents | Implemented P3 UX settings, dismissible hints, persisted view helpers, scroll restoration, lightweight player focus/shortcuts, i18n keys, tests and audit updates. | implemented | `/sf-verify replayglowz-youtube-core-parity-priority-3` |
| 2026-05-25 19:09:34 UTC | sf-verify | GPT-5 Codex | Ran local static, model, backend, metadata and source-risk checks; fixed one localized tooltip gap in the reusable hint widget. Hosted Vercel/Convex auth/browser proof remains pending under vercel-preview-push mode. | partial | `/sf-ship replayglowz-youtube-core-parity-priority-3`, then `/sf-prod` and auth/browser QA |
| 2026-05-25 19:18:21 UTC | sf-ship | GPT-5 Codex | Quick ship requested after partial verification; committing P3 iteration with explicit bug/auth preview risk note and no full closure. | shipped | `/sf-prod replayglowz` |
| 2026-05-25 19:53:31 UTC | sf-prod | GPT-5 Codex | Verified Vercel production deployment for commit `b2d995b`, health-checked `https://app.replayglowz.com/`, deployed Convex prod to expose P3 `settings.ux` functions, and rechecked Convex health. Auth/browser QA remains pending. | partial | `/sf-auth-debug https://app.replayglowz.com ReplayGlowz P3 auth and YouTube QA` |
| 2026-05-25 20:08:52 UTC | sf-auth-debug | GPT-5 Codex | Tested production sign-in without secrets, confirmed Clerk Google auth reaches Google with `redirect_uri=https://clerk.replayglowz.com/v1/oauth_callback`, confirmed YouTube start fails closed without a session, and inspected Convex prod logs for YouTube sync failures. | failed auth/backend QA: Convex `youtube:refreshYoutubeToken` still reads `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` while Vercel OAuth uses `YOUTUBE_OAUTH_CLIENT_ID`/`YOUTUBE_OAUTH_CLIENT_SECRET`; logs show `Google OAuth credentials not configured` cascading into `fetchYoutubeSubscriptions`. | `/sf-fix ReplayGlowz Convex YouTube OAuth env var mismatch` |
| 2026-05-26 05:12:10 UTC | sf-auth-debug | GPT-5 Codex | Inspected production Convex logs for Request ID `d943c70bec06e005`, traced `youtube:startQuotaSafeSync` to `youtube:fetchYoutubePlaylists`, and deployed backend handling for Google accounts connected through OAuth but missing a YouTube channel. | fixed and deployed: `Channel not found` is now treated like YouTube signup-required empty-account state, caches are cleared, and sync can complete with empty results instead of surfacing Server Error. | Retest sync in production with the connected test account. |
| 2026-05-26 05:19:08 UTC | sf-auth-debug | GPT-5 Codex | Corrected the sync contract after operator clarification: users may have subscriptions without relying on a personal YouTube channel/playlist library. `youtube:startQuotaSafeSync` now refreshes the virtual Subscriptions feed independently from user playlists and includes it in quota/job progress. | fixed and deployed: playlist sync no longer gates subscription-feed sync; Convex prod redeployed and healthy. | Retest `Refresh videos` on the test account and inspect Convex logs if subscription API still returns a provider-specific error. |

## Current Chantier Flow

| Stage | Status | Notes |
|-------|--------|-------|
| sf-spec | complete | P3 spec created from Expo gap audit and P2 remaining onboarding/persistence task. |
| sf-ready | complete | Advanced study workflows stay out of P3; P3 owns only lightweight presentation-focused mode. |
| sf-start | complete | P3 implementation landed with backend/settings and UI/i18n subagents; hosted browser QA remains a verification/ship concern. |
| sf-verify | partial | Local checks passed; hosted Vercel/Convex auth/browser QA is still required before final readiness. |
| sf-end | pending | Update audit and create final master checklist after P3 implementation. |
| sf-ship | shipped | Quick ship for iteration; not a full closure because hosted proof and linked bug retests remain pending. |
| sf-auth-debug | partial | Production logs identified the test-account sync failure as YouTube `Channel not found`; Convex prod now handles missing personal playlists and also syncs the Subscriptions feed independently. Browser retest on the connected test account remains required. |
