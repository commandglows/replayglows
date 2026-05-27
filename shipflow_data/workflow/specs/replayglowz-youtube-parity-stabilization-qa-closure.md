---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-05-26"
created_at: "2026-05-26 16:45:18 UTC"
updated: "2026-05-26"
updated_at: "2026-05-27 10:47:12 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "youtube-parity-stabilization-qa-closure"
owner: "Diane"
user_story: "En tant qu'utilisatrice ReplayGlowz qui vient d'activer les workflows YouTube avances, je veux que les routes, playlists, quotas, transcripts, notes et etats vides soient fiables en production, afin de pouvoir terminer la parite TubeFlow sans regressions cachees."
confidence: "high"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "replayglowz_app"
  - "replayglowz_backend"
  - "replayglowz_lab"
  - "Flutter Web"
  - "go_router"
  - "Riverpod"
  - "Convex"
  - "Clerk session auth"
  - "YouTube OAuth"
  - "YouTube Data API"
  - "Transcript worker"
depends_on:
  - artifact: "AGENTS.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "CLAUDE.md"
    artifact_version: "unknown"
    required_status: "unknown"
  - artifact: "shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-2.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-3.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "shipflow_data/workflow/specs/replayglowz-youtube-channel-onboarding-playlist-url-import.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "shipflow_data/workflow/specs/replayglowz-youtube-quota-safe-sync.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "shipflow_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "bugs/BUG-2026-05-26-001.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "bugs/BUG-2026-05-26-002.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "bugs/BUG-2026-05-26-003.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "go_router package documentation"
    artifact_version: "17.2.3 latest observed 2026-05-26"
    required_status: "official"
  - artifact: "YouTube Data API playlists.list"
    artifact_version: "reviewed 2026-05-26"
    required_status: "official"
  - artifact: "YouTube Data API playlistItems.list"
    artifact_version: "reviewed 2026-05-26"
    required_status: "official"
  - artifact: "YouTube Data API subscriptions.list"
    artifact_version: "reviewed 2026-05-26"
    required_status: "official"
  - artifact: "YouTube Data API quota calculator"
    artifact_version: "reviewed 2026-05-26"
    required_status: "official"
supersedes: []
evidence:
  - "Production QA on 2026-05-26 confirmed playlist URL import succeeds and imported video appears in Videos, Playlists and Player."
  - "Production QA found `BUG-2026-05-26-001`: direct protected routes `/preferences`, `/playlists`, and `/notes` render Videos or keep stale URL state."
  - "Production QA found `BUG-2026-05-26-002`: Playlists onboarding and `+` create affordance do not match the requested low-friction UX."
  - "Production QA found `BUG-2026-05-26-003`: visible YouTube quota moved from 9 to 10 without an intentional sync/import action during QA; reproduction still needs log binding."
  - "QA matrix still has untested P2 surfaces: transcript provider details/secrets, transcript generation/jobs/versions, notes export/share/copy, selected-channel sync."
  - "QA matrix still has untested P3 surfaces: hint dismissal persistence, focus/study panel behavior, shortcuts while typing, mobile viewport."
  - "Current app router uses `go_router` with `initialLocation: Routes.videos`, auth redirects and a `ShellRoute` around protected pages."
  - "Current backend has quota-safe YouTube sync/import code and explicit playlist cache sources: owned, url_import and subscriptions."
  - "Official YouTube docs checked 2026-05-26: playlistItems.list and subscriptions.list calls cost 1 unit, max playlistItems page size is 50, and default project quota is documented as 10,000 units/day."
  - "Official go_router docs checked 2026-05-26: go_router is a URL-based declarative router and ShellRoute wraps sub-routes in an inner Navigator."
next_step: "/sf-verify replayglowz-youtube-parity-stabilization-qa-closure"
---

# Spec: ReplayGlowz YouTube Parity Stabilization And QA Closure

## Title

ReplayGlowz YouTube parity stabilization and QA closure

## Status

ready

## User Story

En tant qu'utilisatrice ReplayGlowz qui vient d'activer les workflows YouTube avances, je veux que les routes, playlists, quotas, transcripts, notes et etats vides soient fiables en production, afin de pouvoir terminer la parite TubeFlow sans regressions cachees.

## Minimal Behavior Contract

ReplayGlowz doit fermer le chantier YouTube parity en corrigeant les defauts detectes en production, puis en retestant chaque surface P2/P3/import qui a ete codee mais pas encore prouvee. Les routes protegees doivent rendre la page demandee apres auth et rester rechargeables. Les actions Playlists doivent etre contextuelles, discretes et non trompeuses. La navigation cache-first ne doit jamais consommer de quota YouTube sans action explicite, ou alors l'action doit etre visible, documentee et logguee. Les imports URL, transcripts, notes, channel sync, hints, focus mode et mobile doivent avoir une preuve QA avec compte test. L'edge case facile a rater est de declarer la parite terminee parce que le happy path d'import marche: ce chantier ne se ferme que quand les regressions ouvertes et les surfaces non testees ont un statut pass/fixed/deferred explicite.

## Success Behavior

- Preconditions: l'app de production ou preview est deployee, le compte test ReplayGlowz est authentifie, YouTube OAuth est connecte, Convex auth est pret, et les variables Convex/Vercel de production pointent vers `https://joyous-chipmunk-990.convex.cloud` pour la cible production.
- Trigger: l'utilisateur ouvre directement une route protegee, navigue via sidebar/bottom nav, importe/synchronise une playlist, teste une surface transcript/notes/channel, ferme un hint, utilise le player, ou recharge l'app.
- User/operator result: `/videos`, `/playlists`, `/playlists/create`, `/notes`, `/preferences`, `/play`, `/hidden`, `/stats` et les details autorises rendent la bonne page apres auth, et une reload conserve la page visible.
- User/operator result: la page Playlists affiche un onboarding coherent avec l'etat reel: aucun YouTube connecte, YouTube connecte mais vide, imported playlist presente, owned playlists presentes, subscriptions virtuelles ou erreur actionnable.
- User/operator result: le bouton de creation de playlist est un `+` discret, fade au repos, revele au scroll ou dans le contexte prevu, et ouvre un flux create/edit confirme par produit.
- User/operator result: les actions YouTube couteuses affichent clairement l'etat en cours, le cout/risque quota quand pertinent, le resultat et l'erreur utilisateur sans stack brute.
- User/operator result: transcripts, notes export/share/copy, channel link/sync, hint dismissal, focus mode, shortcuts et mobile ont tous une preuve QA ou une decision de report documentee.
- System effect: les lectures cachees et la navigation ne declenchent pas `playlists.list`, `playlistItems.list`, `videos.list` ou `subscriptions.list` sans action utilisateur explicite ou job planifie connu.
- System effect: les logs Convex permettent de relier chaque depense quota au `userId`, endpoint, action ReplayGlowz, request ID et resultat, sans exposer tokens, cookies, JWT, OAuth code, email ou URL de playlist non repertoriee.
- Success proof: bug records fermes ou reclasses, `TEST_LOG.md` mis a jour, audit QA mis a jour, evidence screenshots/traces ajoutees, `flutter analyze`, backend typecheck, metadata lint, et QA browser auth sur prod ou preview.

## Error Behavior

- Route inconnue ou route protegee non authentifiee: rediriger vers `/sign-in?tf_redirect=...`, puis retourner vers la route demandee apres auth sans normaliser silencieusement vers `/videos`.
- Convex auth non pret: afficher un etat transitoire actionnable, ne pas masquer la route cible ni lancer une sync YouTube.
- Playlist URL privee/invalide/Watch Later/duplicate/trop grande: afficher le message dedie, conserver le cache existant et ne pas logguer l'URL brute.
- Quota proche ou atteint: bloquer ou demander confirmation selon le guard existant, conserver les donnees cachees, et indiquer quand retenter.
- Transcript provider secret absent, invalide ou worker indisponible: afficher unavailable/test failed sans casser le player ni perdre la version active.
- Notes vides ou plan sans export: afficher un etat utile et ne pas produire un artefact vide trompeur.
- Mobile/keyboard: les raccourcis ne doivent pas voler la saisie dans notes/formulaires; les overlays doivent rester fermables et lisibles.
- Must never happen: fuite de token, cookie, JWT, OAuth code, transcript secret, URL de playlist non repertoriee, cross-user data, quota spend cache par simple navigation, bouton mort, page blanche, ou skeleton infini.

## Problem

Trois specs YouTube ont ete implementees, mais la preuve de production montre encore des regressions et des trous de QA. Le happy path d'import par URL fonctionne, mais les deep links proteges ne sont pas fiables, la page Playlists contient une UX contradictoire, une depense quota cachee est suspectee, et plusieurs surfaces P2/P3 codees n'ont pas encore ete testees en conditions reelles. Sans chantier de stabilisation unique, on risque d'accumuler des correctifs locaux sans prouver la parite TubeFlow ni proteger le quota YouTube.

## Solution

Executer une passe stabilisation en ordre strict: corriger d'abord le routing pour rendre la QA fiable, corriger l'UX Playlists, reproduire ou innocenter la depense quota avec logs Convex bornes, durcir les edge cases d'import URL, puis terminer la matrice QA P2/P3 avec correctifs cibles. Chaque correction doit mettre a jour le bug ou l'audit correspondant, et le chantier se ferme seulement apres retest browser authentifie et checks statiques.

## Scope In

- Fix routing/deep-link/reload pour routes protegees Flutter Web avec Clerk auth et GoRouter.
- Fix Playlists onboarding, `+` create affordance, create/edit modal/page decision, refresh/invalidation apres actions playlist.
- Investigation et fix eventuel du quota spend cache pendant navigation.
- Retest et hardening des imports URL: duplicate, mobile URL, video URL avec `list=`, invalid URL, private/inaccessible, Watch Later, empty playlist, large playlist partial.
- Retest P2: transcript provider catalog details, secret add/delete/test avec donnees safe, transcript generation/job/version selection, notes export/copy/share, no subscriptions, channel link/sync selected channel.
- Retest P3: dismissible hints persistence, view preference persistence, scroll restoration, player focus/study, shortcuts while typing, mobile responsive views.
- Update bug records, QA audit, `TEST_LOG.md`, and evidence screenshots/traces.
- Add targeted unit/widget/backend tests where the codebase patterns make them practical, plus static checks required by changed subprojects.
- Production or preview browser QA with the existing authenticated test-account storage state, without exposing credentials.

## Scope Out

- Nouvelle recherche YouTube globale ou `search.list`.
- Creation automatique d'une chaine YouTube.
- Scraping YouTube UI.
- Nouveaux scopes OAuth sans decision produit separee.
- Pricing public, quotas commerciaux definitifs ou site marketing.
- Migration legacy TubeFlow hors donnees deja importees/cachees.
- Refonte visuelle globale de l'app.
- Ajout de nouveaux providers transcript non deja modelises.
- Resolution complete des comptes YouTube externes non accessibles au compte test, sauf documentation d'un report explicite.

## Constraints

- Respecter les patterns existants: Flutter Web, GoRouter, Riverpod, Convex queries/actions/mutations, AppLogger, diagnostics redacted.
- Garder les corrections ciblees et coherentes avec les specs P2/P3/import deja implementees.
- Ne jamais stocker ou imprimer les credentials du compte test, cookies, JWT, OAuth tokens, refresh tokens ou secrets provider.
- YouTube quota est une ressource chere: aucun test prod ne doit multiplier les appels sans raison; preferer cache, fixtures, invalid URLs et preuves log-bound.
- Les routes et redirects auth doivent conserver `tf_redirect` et ne pas casser sign-in/sign-up/OAuth YouTube.
- Les imports URL doivent rester user-scoped et ne pas etre supprimes par une sync automatique `mine=true`.
- Les erreurs utilisateur doivent etre actionnables et i18n quand elles sont visibles en UI.
- La QA prod doit distinguer "non teste", "deferred", "blocked", "fixed" et "pass"; pas de statut implicite.
- La copie visible par l'utilisateur doit etre naturelle dans la langue active de l'interface; les nouvelles strings francaises doivent etre accentuees dans `fr.dart`, tandis que les headings/cles internes ShipFlow restent en anglais.

## Dependencies

- Local files likely touched:
  - `replayglowz_app/lib/app/router.dart`
  - `replayglowz_app/lib/widgets/app_shell.dart`
  - `replayglowz_app/lib/auth/auth_gate.dart`
  - `replayglowz_app/lib/widgets/youtube_connect.dart`
  - `replayglowz_app/lib/screens/playlists/playlists_screen.dart`
  - `replayglowz_app/lib/screens/playlists/create_playlist_screen.dart`
  - `replayglowz_app/lib/screens/playlists/playlist_detail_screen.dart`
  - `replayglowz_app/lib/screens/videos/videos_screen.dart`
  - `replayglowz_app/lib/screens/play/play_screen.dart`
  - `replayglowz_app/lib/screens/notes/notes_screen.dart`
  - `replayglowz_app/lib/screens/preferences/preferences_screen.dart`
  - `replayglowz_app/lib/widgets/ui_hint_card.dart`
  - `replayglowz_app/lib/widgets/youtube_channel_onboarding.dart`
  - `replayglowz_app/lib/providers/providers.dart`
  - `replayglowz_app/lib/providers/mutations.dart`
  - `replayglowz_app/lib/i18n/en.dart`
  - `replayglowz_app/lib/i18n/fr.dart`
  - `replayglowz_backend/packages/backend/convex/youtube.ts`
  - `replayglowz_backend/packages/backend/convex/metrics.ts`
  - `replayglowz_backend/packages/backend/convex/transcripts.ts`
  - `replayglowz_backend/packages/backend/convex/transcriptGeneration.ts`
  - `replayglowz_backend/packages/backend/convex/transcriptSecrets.ts`
  - `replayglowz_backend/packages/backend/convex/notes.ts`
  - `replayglowz_backend/packages/backend/convex/channelLinks.ts`
- Official docs consulted, verdict `fresh-docs checked`:
  - go_router package and ShellRoute docs: `https://pub.dev/packages/go_router`, `https://pub.dev/documentation/go_router/latest/go_router/ShellRoute-class.html`
  - YouTube Data API `playlists.list`: `https://developers.google.com/youtube/v3/docs/playlists/list`
  - YouTube Data API `playlistItems.list`: `https://developers.google.com/youtube/v3/docs/playlistItems/list`
  - YouTube Data API `subscriptions.list`: `https://developers.google.com/youtube/v3/docs/subscriptions/list`
  - YouTube Data API quota calculator: `https://developers.google.com/youtube/v3/determine_quota_cost`
- Docs facts that constrain the chantier:
  - go_router is URL-based routing; route fixes must preserve browser URL/deep-link semantics.
  - ShellRoute wraps sub-routes; child rendering must follow matched route state.
  - `playlistItems.list` and `subscriptions.list` cost 1 quota unit per API call/page.
  - `playlistItems.list` returns up to 50 items per page and requires either `id` or `playlistId`.
  - YouTube projects have a documented default daily quota allocation of 10,000 units, so app-level quota guards must remain conservative.

## Invariants

- Authenticated ReplayGlowz session, ReplayGlowz product access, Convex auth and YouTube OAuth are separate states.
- Direct route intent survives auth bootstrap, sign-in, OAuth reconnect and reload.
- Cache reads do not spend YouTube quota.
- Every YouTube API spend has an explicit user action, scheduled job, or documented startup behavior with logs.
- Imported URL playlists remain first-class cached playlists and are not deleted by owned-playlist refresh.
- Empty YouTube account, no YouTube channel, no subscriptions and no playlists are valid states.
- UI hints are advisory and dismissible; they cannot hide critical errors.
- Player shortcuts are disabled while focus is inside editable controls.
- Backend remains authoritative for ownership, quota, tokens, transcript secrets and entitlement.

## Links & Consequences

- Upstream: Clerk auth/session, Convex auth token, ReplayGlowz entitlement defaults, YouTube OAuth tokens, YouTube Data API quota, transcript worker env.
- Downstream: support diagnostics, user onboarding, Playlists, Videos, Player, Notes, Preferences, Stats quota display, QA evidence, bug closure.
- Regression risk: route fixes can break sign-in redirect, YouTube OAuth return_to, SSO callback, feedback public route, or nested playlist/note detail routes.
- Regression risk: playlist UX fixes can accidentally hide the create action entirely or break imported playlists.
- Regression risk: quota instrumentation can add noisy logs or spend more quota if implemented by live probing.
- Operational consequence: final proof should run on preview before production when code changes touch app/backend, then prod verify after deploy.

## Documentation Coherence

- Update `bugs/BUG-2026-05-26-001.md`, `bugs/BUG-2026-05-26-002.md`, and `bugs/BUG-2026-05-26-003.md` with fix attempts, retests and closure status.
- Update `shipflow_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md` so every row is pass/fail/fixed/deferred with evidence.
- Update `TEST_LOG.md` with the final stabilization QA result.
- Update `shipflow_data/workflow/audits/2026-05-26-youtube-edge-case-regression-checklist.md` if import URL or empty-channel behavior changes.
- Update `replayglowz_app/AGENT.md` only if routing/auth or YouTube runtime contracts materially change.
- Do not update marketing/pricing pages during this chantier.

## Edge Cases

- Cold load `/preferences` while auth is loading, then session restores.
- Cold load `/playlists/create` while unauthenticated, sign in, then return to create screen.
- YouTube OAuth redirects back to a nested route with `return_to` and `tf_redirect`.
- Sidebar and bottom nav route changes on wide and mobile viewports.
- Imported playlist exists but no owned YouTube playlists exist.
- Empty YouTube account with no channel and no subscriptions.
- Playlist URL import duplicate after prior import.
- Playlist URL from `m.youtube.com`, video URL with `list=`, invalid host, missing `list`, Watch Later `WL`, Liked Videos `LL`, private playlist, empty playlist, large playlist.
- Quota counter stale locally after sync/import versus actual hidden API spend.
- Transcript generation on a video with captions, and on a video with no transcript available.
- Provider secret save/test/delete with fake invalid key and no plaintext echo.
- Notes export/copy/share with one test note and with no notes.
- Keyboard shortcuts while editing a note or playlist title.
- Mobile player overlay, shortcuts dialog, playlist create/edit and onboarding cards.

## Implementation Tasks

- [ ] Task 1: Confirm baseline and attach active bugs to this chantier.
  - File: `bugs/BUG-2026-05-26-001.md`, `bugs/BUG-2026-05-26-002.md`, `bugs/BUG-2026-05-26-003.md`, `shipflow_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md`.
  - Action: Add this spec as related artifact, verify current prod/preview build commit, and mark which evidence is stale versus current.
  - User story link: Prevents losing known regressions while implementing fixes.
  - Depends on: none.
  - Validate with: metadata lint and a short browser smoke of current routes.
  - Notes: Do not overwrite existing bug evidence.

- [ ] Task 2: Fix protected route and deep-link semantics.
  - File: `replayglowz_app/lib/app/router.dart`, `replayglowz_app/lib/widgets/app_shell.dart`, `replayglowz_app/lib/auth/auth_gate.dart`, `replayglowz_app/lib/widgets/youtube_connect.dart`.
  - Action: Preserve the requested route through auth loading/sign-in/OAuth, stop unwanted normalization to `/videos`, and ensure ShellRoute child/selected nav follows the actual browser route.
  - User story link: Makes every page reloadable and QAable.
  - Depends on: Task 1.
  - Validate with: direct browser loads for `/videos`, `/playlists`, `/playlists/create`, `/notes`, `/preferences`, `/play`, sign-out/sign-in redirect, and YouTube return route.
  - Notes: Public `/feedback` and `/sso-callback` must keep their current behavior.

- [ ] Task 3: Fix Playlists onboarding and create/edit UX.
  - File: `replayglowz_app/lib/screens/playlists/playlists_screen.dart`, `replayglowz_app/lib/screens/playlists/create_playlist_screen.dart`, `replayglowz_app/lib/screens/playlists/playlist_detail_screen.dart`, `replayglowz_app/lib/widgets/youtube_channel_onboarding.dart`, `replayglowz_app/lib/i18n/en.dart`, `replayglowz_app/lib/i18n/fr.dart`.
  - Action: Branch copy by actual playlist/import state, make the `+` low-opacity/fade/scroll behavior match the product decision, and implement create/edit as a lightweight modal/dialog flow from Playlists unless routing or accessibility constraints prove a full page is safer.
  - User story link: Removes misleading onboarding and keeps advanced actions low-friction.
  - Depends on: Task 2.
  - Validate with: prod/preview screenshots for empty account, imported playlist account and create/edit flow.
  - Notes: If implementation keeps the full-page route, it must preserve the modal-like low-friction entry from Playlists and document the accessibility/routing reason in the bug before closing it.

- [ ] Task 4: Reproduce and close the hidden quota-spend question.
  - File: `replayglowz_backend/packages/backend/convex/youtube.ts`, `replayglowz_backend/packages/backend/convex/metrics.ts`, `replayglowz_app/lib/providers/providers.dart`, `replayglowz_app/lib/widgets/app_shell.dart`, `bugs/BUG-2026-05-26-003.md`.
  - Action: Run a log-bound retest where no sync/import is clicked; if quota changes, identify the endpoint/action and fix cache-first navigation or make the action explicit.
  - User story link: Protects YouTube quota and user trust.
  - Depends on: Task 2.
  - Validate with: quota before/after screenshots plus Convex logs or metrics query for the exact time window.
  - Notes: Do not add diagnostic probes that themselves call YouTube.

- [ ] Task 5: Harden and retest playlist URL import edge cases.
  - File: `replayglowz_backend/packages/backend/convex/youtube.ts`, `replayglowz_app/lib/providers/mutations.dart`, `replayglowz_app/lib/widgets/youtube_channel_onboarding.dart`, `replayglowz_app/lib/screens/playlists/playlists_screen.dart`, `replayglowz_app/lib/i18n/en.dart`, `replayglowz_app/lib/i18n/fr.dart`.
  - Action: Verify duplicate/mobile/video-list/invalid/private/Watch Later/empty/large behavior and adjust parsing, messages, cache mutation and quota accounting where needed.
  - User story link: Ensures users without automatic library discovery can recover their videos safely.
  - Depends on: Task 4 if quota accounting changes; otherwise Task 3.
  - Validate with: backend typecheck, targeted parser/backend tests if present, and browser QA with safe URLs.
  - Notes: Avoid importing large real playlists unless quota budget is explicitly accepted.

- [ ] Task 6: Complete P2 transcript provider and transcript job QA.
  - File: `replayglowz_app/lib/screens/preferences/preferences_screen.dart`, `replayglowz_app/lib/screens/play/play_screen.dart`, `replayglowz_app/lib/providers/providers.dart`, `replayglowz_app/lib/providers/mutations.dart`, `replayglowz_backend/packages/backend/convex/transcripts.ts`, `replayglowz_backend/packages/backend/convex/transcriptGeneration.ts`, `replayglowz_backend/packages/backend/convex/transcriptSecrets.ts`.
  - Action: Test provider cards/details, unavailable reasons, dummy secret failure, delete/reset, generation on captions-capable video, job status, version selection and no-transcript error.
  - User story link: Proves the advanced transcript workflow restored from TubeFlow is usable.
  - Depends on: Task 2.
  - Validate with: Flutter analyze, backend typecheck if touched, screenshots and bug records for failures.
  - Notes: Never use or log real provider API keys in QA.

- [ ] Task 7: Complete P2 notes export/share/copy QA.
  - File: `replayglowz_app/lib/screens/notes/notes_screen.dart`, `replayglowz_app/lib/screens/notes/note_detail_screen.dart`, `replayglowz_app/lib/screens/play/play_screen.dart`, `replayglowz_backend/packages/backend/convex/notes.ts`, `replayglowz_app/lib/providers/mutations.dart`.
  - Action: Create a small test note on an imported video, verify notes list/detail, export/copy/share behavior, empty notes behavior and plan-limit messaging.
  - User story link: Proves notes can be exploited after watching videos.
  - Depends on: Task 6 only if transcript-derived notes are involved; otherwise Task 2.
  - Validate with: browser QA evidence and backend/app checks if code changes.
  - Notes: Keep production test data minimal and remove it if the UI exposes delete.

- [ ] Task 8: Complete P2 channel link/sync QA with a suitable account or mark deferred.
  - File: `replayglowz_app/lib/screens/preferences/preferences_screen.dart`, `replayglowz_app/lib/screens/playlists/playlist_detail_screen.dart`, `replayglowz_backend/packages/backend/convex/channelLinks.ts`, `replayglowz_backend/packages/backend/convex/youtube.ts`.
  - Action: Test no-subscriptions state on current account; test link/unlink/toggle/sync selected channel on an account with subscriptions if available; otherwise document a deferred test gate.
  - User story link: Closes the channel automation piece without pretending the empty test account proves it.
  - Depends on: Task 4 for quota safety.
  - Validate with: QA matrix row updated to pass or deferred with reason.
  - Notes: Do not auto-sync all subscriptions.

- [ ] Task 9: Complete P3 UX persistence, focus, shortcuts and mobile QA.
  - File: `replayglowz_app/lib/widgets/ui_hint_card.dart`, `replayglowz_app/lib/screens/videos/videos_screen.dart`, `replayglowz_app/lib/screens/playlists/playlists_screen.dart`, `replayglowz_app/lib/screens/play/play_screen.dart`, `replayglowz_app/lib/screens/notes/notes_screen.dart`, `replayglowz_app/lib/models/settings.dart`.
  - Action: Verify hint close/reload persistence, reset behavior if present, view preference persistence, scroll restoration, focus/study toggles, shortcuts dialog and shortcuts while typing, desktop and mobile.
  - User story link: Restores day-to-day TubeFlow fluidity without onboarding friction.
  - Depends on: Task 2 and Task 3.
  - Validate with: desktop/mobile Playwright screenshots and explicit QA notes.
  - Notes: If a P3 behavior is not implemented, record it as deferred instead of silent pass.

- [ ] Task 10: Add focused automated coverage for fixed regressions.
  - File: `replayglowz_app/test/`, `replayglowz_backend/packages/backend/convex/`, existing test locations if present.
  - Action: Add or update tests for route redirect target parsing, playlist URL parsing, cache-source preservation, settings/hint parsing and quota-safe non-network paths where project tooling supports it.
  - User story link: Prevents reintroducing the same parity regressions.
  - Depends on: Tasks 2-9.
  - Validate with: available Flutter/backend test commands, plus required static checks.
  - Notes: If a test layer is absent, document why browser QA is the proof for that item.

- [ ] Task 11: Run focused checks and deployment verification.
  - File: changed subprojects plus `shipflow_data/workflow/*`.
  - Action: Run `(cd replayglowz_app && flutter analyze)`, `(cd replayglowz_backend/packages/backend && npm run typecheck)` if backend changed, `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENT.md shipflow_data`, then preview/prod browser QA according to deployment mode.
  - User story link: Converts local fixes into deployable confidence.
  - Depends on: Tasks 2-10.
  - Validate with: command output, deployed build commit and screenshots/logs.
  - Notes: Site/lab checks are only required if those subprojects are touched.

- [ ] Task 12: Close the stabilization records.
  - File: `TEST_LOG.md`, `bugs/BUG-2026-05-26-001.md`, `bugs/BUG-2026-05-26-002.md`, `bugs/BUG-2026-05-26-003.md`, `shipflow_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md`, this spec.
  - Action: Mark fixed/deferred/open statuses truthfully, attach evidence, update Skill Run History through lifecycle skills, and set final next step.
  - User story link: Gives a durable master checklist for future parity regressions.
  - Depends on: Task 11.
  - Validate with: metadata lint and final `/sf-verify`.
  - Notes: Do not close `BUG-2026-05-26-003` unless quota behavior is actually proven.

## Acceptance Criteria

- [ ] `BUG-2026-05-26-001` is closed or has a concrete remaining blocker; direct `/preferences`, `/playlists`, `/notes` and nested protected routes render correctly after auth and reload.
- [ ] `BUG-2026-05-26-002` is closed or product-deferred; Playlists onboarding is state-aware, the `+` is subtle as requested, and create/edit flow has proof.
- [ ] `BUG-2026-05-26-003` is either reproduced and fixed, or disproven by a log-bound retest; cache-first navigation does not spend hidden YouTube quota.
- [ ] Playlist URL import edge cases have pass/fail/deferred rows with evidence: duplicate, mobile URL, video URL with `list=`, invalid, private/inaccessible, Watch Later, empty and large playlist.
- [ ] P2 transcript provider details, secret status/test, transcript generation, job status and version selection have QA evidence or explicit deferred status.
- [ ] P2 notes export/copy/share has QA evidence with at least one note fixture and one empty state.
- [ ] P2 channel link/sync is tested with an appropriate account or explicitly deferred because the current test account has no subscriptions.
- [ ] P3 hint dismissal, view persistence, scroll restoration, focus/study, shortcuts while typing and mobile smoke have QA evidence or explicit deferred status.
- [ ] No diagnostics, logs, screenshots or docs expose credentials, tokens, cookies, OAuth codes, transcript secrets, JWTs or raw unlisted playlist URLs.
- [ ] Required checks pass for touched subprojects and ShipFlow metadata lint passes.
- [ ] `TEST_LOG.md` and the QA audit reflect the final result instead of the current partial/fail state.

## Test Strategy

- Static checks:
  - `(cd replayglowz_app && flutter analyze)`
  - `(cd replayglowz_backend/packages/backend && npm run typecheck)` when backend changed.
  - `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENT.md shipflow_data`
- Browser QA:
  - Use authenticated Playwright storage state for the test account when valid; never print credentials.
  - Test direct route loads, sidebar/bottom nav, reload and auth redirect.
  - Capture screenshots for each fixed bug and major P2/P3 surface.
  - Run mobile viewport smoke for Videos, Playlists, Notes, Preferences and Player.
- Quota QA:
  - Record quota before/after navigation without clicks on sync/import.
  - Correlate Convex metrics/logs for the same time window.
  - Avoid large real imports unless explicitly needed.
- YouTube API QA:
  - Use safe playlist URLs and invalid URLs for parser/error paths.
  - Keep Watch Later/private tests non-mutating.
- Data cleanup:
  - Keep test notes/playlists minimal.
  - Remove test artifacts only through app-supported delete actions if cleanup is required.

## Risks

- Routing fixes can break auth redirects or OAuth return flows if route intent is handled in the wrong layer.
- Quota bugs can be intermittent if the counter is stale or if scheduled/background jobs run during QA.
- YouTube API behavior can differ between accounts with no channel, no subscriptions, owned playlists, imported playlists and unlisted playlists.
- Transcript provider QA may be limited without safe API keys or worker environment.
- Production QA can mutate test account data; keep changes small and documented.
- Marking untested P2/P3 features as pass would create false parity confidence.

## Execution Notes

- Documentation freshness gate: `fresh-docs checked` because the spec depends on GoRouter routing semantics and YouTube API quota/list behavior.
- Official sources used on 2026-05-26:
  - `https://pub.dev/packages/go_router`
  - `https://pub.dev/documentation/go_router/latest/go_router/ShellRoute-class.html`
  - `https://developers.google.com/youtube/v3/docs/playlists/list`
  - `https://developers.google.com/youtube/v3/docs/playlistItems/list`
  - `https://developers.google.com/youtube/v3/docs/subscriptions/list`
  - `https://developers.google.com/youtube/v3/determine_quota_cost`
- Current production QA baseline before this spec:
  - URL import happy path passes.
  - Imported `Fun` playlist with one video appears in app.
  - Player embed and shortcut dialog render.
  - Notes empty state and Preferences provider catalog render.
  - Direct route/deep-link behavior fails.
  - Playlist UX fails requested low-friction behavior.
  - Hidden quota spend remains unproven and must be retested.
- Suggested implementation order: routing, Playlists UX, quota retest/fix, import edge cases, P2 QA/fixes, P3 QA/fixes, checks, deploy, prod verify.

## Open Questions

None. Non-blocking execution notes:

- Playlist create/edit should default to a lightweight modal/dialog flow from Playlists; a full-page fallback is acceptable only if it is justified by routing or accessibility constraints and documented in `BUG-2026-05-26-002`.
- Channel-link sync may be marked deferred if no suitable account with real subscriptions is available during QA; the current empty-subscriptions account is sufficient only for the no-subscriptions state.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-05-26 16:45:18 UTC | sf-spec | GPT-5 Codex | Created stabilization and QA closure spec from production QA bugs, P2/P3/import specs, and official routing/API docs. | Spec drafted with linked bugs, tasks, acceptance criteria and freshness gate. | `/sf-ready replayglowz-youtube-parity-stabilization-qa-closure` |
| 2026-05-26 19:13:32 UTC | sf-ready | GPT-5 Codex | Reviewed readiness, resolved non-blocking open questions, and made language/copy expectations explicit. | ready | `/sf-start replayglowz-youtube-parity-stabilization-qa-closure` |
| 2026-05-26 19:24:03 UTC | sf-start | GPT-5 Codex | Implemented routing/auth stabilization, Playlists modal-first low-friction UX updates, and quota-spend mitigation by moving subscriptions refresh from passive load to explicit action; updated bug/audit/test records and ran required local checks. | partial | `/sf-ship replayglowz-youtube-parity-stabilization-qa-closure` |
| 2026-05-26 19:38:55 UTC | sf-ship | GPT-5 Codex | Ran quick ship checks and prepared the stabilization implementation for push. | shipped | `/sf-prod replayglowz` |
| 2026-05-26 19:55:00 UTC | sf-prod | GPT-5 Codex | Confirmed Vercel production deployment `dpl_9DM2pzMHBonJfrWg7uZpuodDgtF7` for commit `39c6062`, aliases including `https://app.replayglowz.com`, and HTTP 200 for root and `/playlists`. | pass | `/sf-verify replayglowz-youtube-parity-stabilization-qa-closure` |
| 2026-05-26 19:56:00 UTC | sf-verify | GPT-5 Codex | Ran authenticated production browser smoke on commit `39c6062`: Preferences, Playlists, Notes and Videos rendered correctly; Playlists hint and hidden top-rest `+` matched the new UX; visible quota stayed stable at `13 / 1000` across passive navigation. | partial | Continue remaining P2/P3/import QA matrix before `/sf-end`. |
| 2026-05-27 03:14:26 UTC | sf-verify | GPT-5 Codex | Reran production verification on deployment `dpl_8SWzTGdT61HbmqfePKkNANJrY2Yr`: signed-out redirect and authenticated direct routes passed, visible quota stayed `13 / 1000`, but Playlists `+` is unreachable on short/non-scrollable pages while the hint tells users to use it. | partial | Fix Playlists `+` discoverability on short pages, then rerun targeted `/sf-verify`. |
| 2026-05-27 09:04:31 UTC | sf-build | GPT-5 Codex + subagent | Implemented the short-page Playlists `+` affordance fix through a bounded worker: non-scrollable pages now keep a low-opacity clickable `+`, while scrollable pages retain hidden top-rest and scroll-reveal behavior. | partial | Ship/deploy, then rerun targeted `/sf-verify`. |
| 2026-05-27 09:04:31 UTC | sf-ship | GPT-5 Codex | Prepared quick ship for the bounded Playlists short-page `+` fix and associated bug/audit/test/spec trace updates. | shipped | `/sf-prod replayglowz_app` then targeted `/sf-verify`. |
| 2026-05-27 10:47:12 UTC | sf-browser | GPT-5 Codex | Checked `https://app.replayglowz.com/playlists` in Chromium after deploy: no-locale headless reproduces the known locale bootstrap crash/fallback; with `--lang=en-US`, build `7f97ab2` loads and the protected route reaches the Sign in screen. | needs-auth | Use `sf-auth-debug` or an authenticated Playwright storage state to verify the protected Playlists `+` modal. |

## Current Chantier Flow

| Phase | Status | Notes |
|-------|--------|-------|
| sf-spec | done | This spec defines the stabilization contract. |
| sf-ready | done | Spec passes readiness after modal/default and language doctrine clarifications. |
| sf-start | partial | Local implementation/checks are complete for BUG-001/002 and mitigation for BUG-003, including the short-page Playlists `+` fix; hosted QA and remaining P2/P3 matrix proofs are still pending. |
| sf-prod | done | Production deployment `dpl_9DM2pzMHBonJfrWg7uZpuodDgtF7` is ready and aliased to `https://app.replayglowz.com`; root and `/playlists` returned HTTP 200. |
| sf-verify | partial | Production smoke passes for route rendering and visible quota stability. BUG-2026-05-26-002 has a shipped fix for the short/non-scrollable `+` edge case, but authenticated production retest and remaining P2/P3/import matrix proofs are still pending. |
| sf-end | pending | Update final trackers and closure notes. |
| sf-ship | done | Quick ship performed for the nav route matching fix in commit `39c6062`; current quick ship covers the bounded Playlists short-page `+` fix. |
