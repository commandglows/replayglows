---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-05-24"
created_at: "2026-05-24 22:43:59 UTC"
updated: "2026-05-24"
updated_at: "2026-05-24 23:14:29 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "youtube-quota-safe-sync"
owner: "Diane"
user_story: "En tant qu'utilisateur ReplayGlowz connecte a YouTube, je veux synchroniser ma bibliotheque avec un usage de quota controle, visible et economique, afin de retrouver mes playlists et videos sans epuiser le quota YouTube quotidien du produit."
confidence: "high"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "app"
  - "backend"
  - "Convex"
  - "YouTube Data API"
  - "Clerk session auth"
depends_on:
  - artifact: "AGENTS.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipglows_data/workflow/specs/replayglowz-suite-auth-migration.md"
    artifact_version: "unknown"
    required_status: "reviewed"
  - artifact: "shipglows_data/workflow/specs/replayglowz-app-performance-loading-data.md"
    artifact_version: "1.0.0"
    required_status: "reviewed"
  - artifact: "YouTube Data API quota cost documentation"
    artifact_version: "2026-04-28"
    required_status: "official"
supersedes: []
evidence:
  - "User reported that sync shows skeletons and no videos after YouTube connection, then asked to preserve the advanced quota economy from the old TubeFlow app."
  - "Current Flutter helper `app/lib/providers/mutations.dart` calls `youtube:fetchYoutubePlaylists` and then batches `youtube:fetchPlaylistItems` for every playlist."
  - "Current backend `backend/packages/backend/convex/metrics.ts` defines YouTube quota costs and plan limits but the sync UI does not use a central quota gate before triggering full sync."
  - "Current app has `quotaUsageProvider` and `StatsScreen`, but lacks a globally visible quota/progress guard for YouTube sync actions."
  - "Old TubeFlow repo `https://github.com/dianedef/tubeflow_expo` used centralized quota state, a quota indicator, local cache TTL, refresh disablement near 90 percent usage, and explicit refresh behavior."
  - "Official YouTube Data API quota docs checked 2026-05-24: default project quota is 10,000 units/day, every request costs at least 1 unit, additional pages cost additional units, `playlistItems.list`, `playlists.list`, and `videos.list` each cost 1 unit, while `search.list` costs 100 units."
next_step: "/sf-ship ReplayGlowz YouTube quota-safe sync"
---

# Spec: ReplayGlowz YouTube Quota-Safe Sync

## Title

ReplayGlowz YouTube quota-safe sync

## Status

ready

## User Story

En tant qu'utilisateur ReplayGlowz connecte a YouTube, je veux synchroniser ma bibliotheque avec un usage de quota controle, visible et economique, afin de retrouver mes playlists et videos sans epuiser le quota YouTube quotidien du produit.

## Minimal Behavior Contract

ReplayGlowz doit afficher les donnees YouTube deja cachees sans declencher d'appel YouTube externe, puis lancer une synchronisation seulement quand l'utilisateur la demande explicitement ou quand une connexion YouTube vient d'etre etablie et qu'aucune donnee n'existe encore. Avant tout refresh couteux, l'app doit calculer le plan de synchronisation, afficher l'estimation de quota, verifier les limites utilisateur et projet, refuser les actions dangereuses au-dessus du seuil de securite, puis montrer une progression lisible pendant l'execution. Si YouTube, Convex, l'auth ou le quota echoue, l'utilisateur voit un etat recuperable, les donnees cachees restent visibles, aucun token n'est expose, et aucun job concurrent ne duplique les appels. L'edge case facile a rater est de croire que `maxResults=50` consomme 50 unites: c'est au contraire le choix efficace pour reduire le nombre de pages; le risque vient des boucles sur beaucoup de playlists, des pages supplementaires et des refresh automatiques.

## Success Behavior

- Preconditions: l'utilisateur est authentifie via Clerk, dispose de l'acces ReplayGlowz actif, a connecte YouTube, et Convex auth est pret.
- Trigger: ouverture des pages Videos/Playlists/Preferences, clic manuel sur Sync, ou retour OAuth YouTube avec bibliotheque locale vide.
- User/operator result: les donnees cachees apparaissent immediatement; les actions Sync indiquent cout estime, quota restant et progression; les refresh risqués sont desactives ou demandent confirmation selon le seuil.
- System effect: Convex conserve un job de sync par utilisateur, journalise chaque appel YouTube avec ses unites, met a jour les caches playlists/videos progressivement, et invalide les providers Flutter seulement apres mutation utile.
- Success proof: tests backend du plan quota, tests Flutter des etats UI, `npm run typecheck`, `flutter analyze`, et verification manuelle d'une sync connectee avec progression et usage quota coherent.
- Silent success: non autorise; une sync doit toujours laisser une trace visible ou consultable dans l'UI et dans les metriques.

## Error Behavior

- Expected failures: session expiree, entitlement absent, YouTube non connecte, token YouTube revoque, quota restant insuffisant, job deja en cours, timeout YouTube, erreur partielle sur une playlist, schema cache inattendu.
- User/operator response: message contextualise, bouton reconnecter/reessayer quand pertinent, donnees cachees conservees, progression marquee failed/partial, et lien vers Stats si le quota bloque.
- System effect: pas de suppression de cache sur erreur externe, pas de relance automatique non bornee, metriques d'erreur journalisees sans secret, lock de job libere a la fin ou apres timeout controle.
- Must never happen: appel YouTube depuis Flutter directement, boucle full-sync automatique a chaque visite, fuite de token OAuth, contournement de l'entitlement ReplayGlowz, double job concurrent pour le meme utilisateur, depassement volontaire du seuil projet configure.
- Silent failure: non autorise; les echecs de sync doivent etre visibles dans l'UI et les logs applicatifs.

## Problem

La connexion YouTube fonctionne maintenant, mais la synchronisation reste trop brutale et opaque: le client Flutter peut demander les playlists puis chaque playlist en batch sans estimation de quota, sans progression fine, sans garde-fou central, et sans politique claire "cache d'abord". L'ancienne application TubeFlow avait deja des protections produit importantes: indicateur quota, cache local, refresh manuel, desactivation proche du plafond, et synchro plus consciente du cout.

## Solution

Porter le modele quota-safe de TubeFlow dans ReplayGlowz avec un orchestrateur backend Convex: un plan de sync estime les appels, un job unique execute par etapes, les metriques bornent le quota utilisateur/projet, et Flutter affiche cache, quota et progression sans piloter une boucle N-playlists a l'aveugle. Garder `maxResults=50` pour les endpoints list car cela minimise les pages, mais controler explicitement combien de pages et playlists sont synchronisees.

## Scope In

- Backend Convex ReplayGlowz: planification quota, job de sync, verrou utilisateur, progression, erreurs partielles, metriques et cache playlists/videos.
- Flutter web ReplayGlowz: centralisation de l'etat quota, indicateur visible, etats Sync disabled/warning/progress, refresh cache-first, invalidations Riverpod controlees.
- YouTube Data API read paths: `playlists.list`, `playlistItems.list`, `videos.list`, `subscriptions.list` si deja present dans le flux subscriptions.
- Tests backend et Flutter pour quota plan, seuils, jobs concurrents, erreurs partielles, et UI connectee/non connectee.
- Documentation technique courte sur la politique quota et la difference entre quota Google projet et limites produit internes.

## Scope Out

- Pas de changement des credentials OAuth YouTube, des redirect URIs, ou du flow start/callback deja repare.
- Pas de changement des scopes YouTube sans decision produit separee.
- Pas de modification des entitlements WinFlowz/ReplayGlowz hors verification deja requise avant sync.
- Pas d'ajout de fonctions d'ecriture YouTube couteuses (`insert`, `update`, `delete`) dans ce chantier.
- Pas de promesse publique de quota utilisateur superieure au quota reel du projet Google Cloud.
- Pas de migration massive de donnees legacy TubeFlow dans ce chantier.

## Constraints

- Les appels YouTube Data API doivent rester cote backend Convex ou serveur autorise; Flutter ne manipule pas les tokens YouTube.
- YouTube quota reset est a minuit Pacific Time; les metriques et seuils doivent utiliser la meme frontiere temporelle.
- Les endpoints list coutent 1 unite par requete, mais chaque page supplementaire coute aussi une requete.
- `maxResults=50` doit rester la valeur par defaut pour les list endpoints qui l'acceptent, sauf raison documentee, car la valeur par defaut YouTube peut etre plus basse.
- Le seuil dur par defaut pour les refresh non essentiels est 90% du plus petit plafond applicable: limite produit utilisateur restante et limite projet configuree.
- Le seuil d'avertissement par defaut est 70%; a partir de 80%, l'UI doit presenter le cout estime avant execution.
- Le backend doit prevoir une variable serveur `YOUTUBE_PROJECT_DAILY_QUOTA` avec defaut 10000 pour ne pas confondre plan `team: 50000` et quota Google projet reel.

## Dependencies

- Runtime: Flutter web, Riverpod, Convex actions/queries/mutations, Clerk-authenticated Convex context, YouTube Data API OAuth tokens stockes cote backend.
- Document contracts: `AGENTS.md`, `replayglowz-suite-auth-migration.md`, `replayglowz-app-performance-loading-data.md`, official YouTube Data API quota docs.
- External docs: fresh-docs checked 2026-05-24 via official Google docs:
  - `https://developers.google.com/youtube/v3/determine_quota_cost`
  - `https://developers.google.com/youtube/v3/docs/playlistItems/list`
  - `https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits`
- Metadata gaps: `replayglowz-suite-auth-migration.md` artifact version is unknown in frontmatter; this does not block this draft but should be cleaned during docs maintenance.

## Invariants

- Une session Clerk valide prouve l'identite; l'acces ReplayGlowz et les tokens YouTube restent verifies separement avant toute action privee.
- Les donnees cachees sont preferables a une page vide; l'absence de refresh ne doit pas masquer les videos deja importees.
- Le compteur quota est une protection operationnelle, pas une source de facturation publique.
- Un job de sync ne doit jamais supprimer des videos/playlists du cache uniquement parce qu'un appel YouTube a echoue.
- Les erreurs et metriques ne doivent jamais inclure access token, refresh token, cookie Clerk, JWT, ou secret Vercel.

## Links & Consequences

- Upstream systems: Clerk session, ReplayGlowz entitlement, YouTube OAuth token storage, Convex auth, Google Cloud YouTube Data API quota.
- Downstream systems: pages Videos, Playlists, Play, Preferences, Stats, AppShell/header, diagnostics, support copy, i18n strings, and operational monitoring.
- Cross-cutting checks: auth/session, data privacy, quota cost, concurrent jobs, i18n copy, responsive UI, backend type safety, Flutter analyze, deploy env consistency.

## Documentation Coherence

- Update `app/AGENT.md` if the app contract changes from client-driven sync to backend-orchestrated sync.
- Update `backend/AGENT.md` or backend docs if sync job tables/actions become part of the public backend contract.
- Update support/internal docs with quota policy: default Google quota 10000/day, project-level cap, product-level soft limits, 70/80/90% thresholds.
- Add changelog entries only during implementation/ship, not in this spec-only run.

## Edge Cases

- User has hundreds of playlists: plan must cap work, show cost, and support staged/selected sync instead of all-or-nothing.
- Playlist has more than 50 videos: pagination must count one unit per page and stop before quota risk.
- `videos.list` details are already cached for some IDs: backend should fetch only missing/stale details in batches up to 50 IDs.
- User opens Videos with stale cache: show stale data and "Last synced" instead of auto-refreshing.
- User clicks Sync repeatedly or opens multiple tabs: backend returns existing job/progress instead of starting duplicate work.
- Token revoked mid-sync: mark job partial, keep cache, prompt reconnect.
- Quota reaches threshold during sync: finish the current bounded request, stop the next planned step, mark partial with remaining work.
- Convex action timeout: job model must allow resumed batches or a clear failed state without lock leak.
- Google returns invalid/failed response: count the attempted request because invalid requests can still cost quota.

## Implementation Tasks

- [ ] Task 1: Audit and freeze the current YouTube sync call graph.
  - File: `app/lib/providers/mutations.dart`, `app/lib/screens/videos/videos_screen.dart`, `app/lib/screens/playlists/playlists_screen.dart`, `app/lib/widgets/youtube_connect*.dart`, `backend/packages/backend/convex/youtube.ts`
  - Action: Document every UI trigger that calls `syncAllPlaylists`, `fetchYoutubePlaylists`, or `fetchPlaylistItems`; classify auto, manual, post-OAuth, and retry paths.
  - User story link: Prevents hidden refreshes and preserves user-visible control.
  - Depends on: None
  - Validate with: source review and `rg -n "syncAllPlaylists|fetchYoutubePlaylists|fetchPlaylistItems" app backend -S`
  - Notes: Do not change OAuth start/callback behavior in this task.

- [ ] Task 2: Add backend quota planning helpers.
  - File: `backend/packages/backend/convex/metrics.ts`, `backend/packages/backend/convex/youtube.ts`
  - Action: Expose typed helpers/actions that return current usage, smallest applicable daily limit, warning state, and estimated cost for playlist sync modes using `YOUTUBE_QUOTA_COSTS`.
  - User story link: User sees cost before ReplayGlowz spends quota.
  - Depends on: Task 1
  - Validate with: `cd backend/packages/backend && npm run typecheck`
  - Notes: Include `YOUTUBE_PROJECT_DAILY_QUOTA` default 10000 and Pacific-day reset.

- [ ] Task 3: Add sync job state and per-user lock.
  - File: `backend/packages/backend/convex/schema.ts`, `backend/packages/backend/convex/youtube.ts`
  - Action: Add a `youtubeSyncJobs` table or equivalent durable state with userId, status, phase, current, total, estimatedQuotaUnits, usedQuotaUnits, currentPlaylistId, errors, startedAt, updatedAt, completedAt, and lock expiry.
  - User story link: User sees real progress and concurrent tabs do not duplicate quota spend.
  - Depends on: Task 2
  - Validate with: `cd backend/packages/backend && npm run typecheck`
  - Notes: The job must be resumable or fail recoverably if an action times out.

- [ ] Task 4: Replace client-driven full sync with backend-orchestrated bounded sync.
  - File: `backend/packages/backend/convex/youtube.ts`, `app/lib/providers/mutations.dart`
  - Action: Add a backend action such as `youtube:startQuotaSafeSync` plus status query; make Flutter call that action instead of looping over every playlist locally.
  - User story link: ReplayGlowz controls cost centrally and can stop before quota damage.
  - Depends on: Task 3
  - Validate with: backend typecheck plus a targeted Flutter test or source-level smoke of sync button calls.
  - Notes: Use `maxResults=50`; fetch pages only inside the approved plan.

- [ ] Task 5: Optimize video detail fetching.
  - File: `backend/packages/backend/convex/youtube.ts`
  - Action: Before calling `videos.list`, compare requested video IDs against cached details and fetch only missing/stale IDs in batches of up to 50.
  - User story link: Saves quota while preserving complete video metadata.
  - Depends on: Task 4
  - Validate with: backend unit/helper tests or action-level tests where available, plus `npm run typecheck`
  - Notes: Do not skip details needed for new videos; only avoid known duplicate fetches.

- [ ] Task 6: Centralize Flutter quota and sync progress state.
  - File: `app/lib/providers/providers.dart`, new focused provider file if needed, `app/lib/screens/stats/stats_screen.dart`
  - Action: Provide a single Riverpod source for quota usage, sync plan, active job, warning/disabled status, and refresh invalidation; avoid repeated uncoordinated quota queries.
  - User story link: User sees one coherent quota/progress story across the app.
  - Depends on: Task 4
  - Validate with: `cd app && flutter analyze`
  - Notes: Reuse `quotaUsageProvider` if practical; do not introduce global polling without backoff.

- [ ] Task 7: Add visible quota indicator and sync progress UX.
  - File: `app/lib/widgets/app_shell.dart`, `app/lib/screens/videos/videos_screen.dart`, `app/lib/screens/playlists/playlists_screen.dart`, `app/lib/widgets/youtube_connect_ui_states.dart`, `app/lib/i18n/en.dart`, `app/lib/i18n/fr.dart`
  - Action: Surface quota usage, last synced time, disabled/warning states, and live progress such as phase, playlist count, videos imported, and units used.
  - User story link: User understands where quota goes and whether sync is still working.
  - Depends on: Task 6
  - Validate with: Flutter widget tests where feasible and `flutter analyze`
  - Notes: Avoid page-level cards nested inside cards; keep compact operational UI.

- [ ] Task 8: Enforce cache-first screen behavior.
  - File: `app/lib/screens/videos/videos_screen.dart`, `app/lib/screens/playlists/playlists_screen.dart`, `app/lib/providers/providers.dart`
  - Action: Show cached playlists/videos immediately, mark stale state, and never auto-refresh stale data unless cache is empty after first YouTube connection.
  - User story link: Avoids blank/skeleton-only experiences and unexpected quota spend.
  - Depends on: Task 6
  - Validate with: Flutter tests or manual QA paths for connected with cache, connected empty, stale cache, and disconnected states.
  - Notes: A short local TTL cache may complement Convex cache, but Convex remains source of truth.

- [ ] Task 9: Add tests and diagnostics.
  - File: `backend/packages/backend/convex/*`, `app/test/**`, existing diagnostics widgets
  - Action: Cover quota estimates, 70/80/90 thresholds, concurrent job reuse, partial failures, cached-detail skip, UI disabled states, and diagnostics fields for active sync job.
  - User story link: Prevents regressions in the expensive integration path.
  - Depends on: Tasks 2-8
  - Validate with: `cd backend/packages/backend && npm run typecheck`, `cd app && flutter test`, `cd app && flutter analyze`
  - Notes: If backend lacks a unit test harness for Convex actions, isolate pure helpers for testability.

- [ ] Task 10: Document and deploy safely.
  - File: `app/CHANGELOG.md`, backend/app AGENT docs if contracts changed, deployment env docs
  - Action: Document quota policy and required env, deploy backend then app, verify production with a connected test account and low-risk sync.
  - User story link: Makes the quota-safe contract durable for future work.
  - Depends on: Task 9
  - Validate with: metadata lint, backend deploy dry-run, Vercel production proof, and manual YouTube sync proof.
  - Notes: Do not print secrets while verifying env.

## Acceptance Criteria

- [ ] AC 1: Given cached YouTube playlists/videos exist, when the user opens Videos or Playlists, then ReplayGlowz renders cached data without calling YouTube Data API.
- [ ] AC 2: Given the user clicks Sync, when quota usage is below warning thresholds, then ReplayGlowz displays estimated quota cost and starts one backend job with visible progress.
- [ ] AC 3: Given quota usage is at or above 90% of the applicable limit, when the user tries to refresh, then the action is disabled or refused with clear copy and no YouTube call is made.
- [ ] AC 4: Given quota usage is at or above 80%, when a manual sync is available, then the UI shows cost and asks for explicit confirmation before spending quota.
- [ ] AC 5: Given multiple tabs or repeated clicks start sync, when a job already exists for the user, then ReplayGlowz reuses the active job/status instead of starting duplicate YouTube calls.
- [ ] AC 6: Given a playlist has more than 50 videos, when sync runs, then each page is counted as a separate unit and sync stops before exceeding the plan.
- [ ] AC 7: Given video details already exist in cache and are not stale, when playlist items are synced, then `videos.list` is called only for missing/stale IDs.
- [ ] AC 8: Given YouTube token revocation or API failure occurs mid-sync, when the job fails partially, then cached data remains visible and the UI offers reconnect/retry.
- [ ] AC 9: Given production env lacks `YOUTUBE_PROJECT_DAILY_QUOTA`, when quota planning runs, then it defaults to 10000 units/day and does not trust a larger product plan alone.
- [ ] AC 10: Given implementation is complete, when validation runs, then backend typecheck, Flutter analyze, relevant tests, metadata lint, and production smoke proof pass or document a non-shipping blocker.

## Test Strategy

- Unit: pure backend quota-plan helpers, threshold helpers, cached-detail selection, and Flutter model/provider state helpers.
- Integration: Convex action flow for plan -> start job -> progress -> complete/partial failed, with mocked YouTube fetch helpers where possible.
- Widget/UI: sync button disabled/warning/progress states on Videos, Playlists, and YouTube connect surfaces; quota indicator renders compactly on mobile and desktop.
- Manual: connected YouTube account with small library, connected account with many playlists if available, revoked-token path, quota-throttled path by mocked/seeded metrics, multi-tab repeated-click path.
- Commands:
  - `cd backend/packages/backend && npm run typecheck`
  - `cd app && flutter test`
  - `cd app && flutter analyze`
  - `/home/claude/shipglows/tools/shipglows_metadata_lint.py AGENTS.md shipglows_data`

## Risks

- Security impact: yes, because YouTube OAuth tokens and Clerk-authenticated product data are involved; mitigate by keeping all token use backend-side and never logging secrets.
- Product/data/performance risk: high, because careless sync can spend scarce YouTube quota and leave users with blank states; mitigate with cache-first rendering, quota planning, and progress jobs.
- Operational risk: Google quota is project-level while current `PLAN_QUOTA_LIMITS` are product-level; mitigate with the smaller of project and product limits.
- Reliability risk: Convex actions may timeout for very large libraries; mitigate with bounded job batches, resumable state, and partial completion.
- UX risk: too many quota prompts can add friction; mitigate by warning only at meaningful thresholds and showing cache by default.

## Execution Notes

- Read first: `app/lib/providers/mutations.dart`, `app/lib/providers/providers.dart`, `app/lib/screens/videos/videos_screen.dart`, `app/lib/screens/playlists/playlists_screen.dart`, `app/lib/screens/stats/stats_screen.dart`, `backend/packages/backend/convex/youtube.ts`, `backend/packages/backend/convex/metrics.ts`, `backend/packages/backend/convex/schema.ts`.
- Old-app references to consult during implementation: `/tmp/tubeflow_expo/apps/web/src/contexts/QuotaContext.tsx`, `/tmp/tubeflow_expo/apps/web/src/components/common/QuotaIndicator.tsx`, `/tmp/tubeflow_expo/apps/web/src/hooks/use-youtube.ts`, `/tmp/tubeflow_expo/packages/backend/convex/youtube.ts`, `/tmp/tubeflow_expo/packages/backend/convex/feedChecker.ts`.
- Official docs verdict: fresh-docs checked; YouTube quota costs support the chosen plan and confirm that 50-result pages are not 50-unit requests.
- Validate with: backend typecheck, Flutter tests/analyze, metadata lint, and production smoke only after deploy is requested.
- Stop conditions: a proposed change expands OAuth scopes, moves YouTube tokens client-side, changes entitlement semantics, requires a public pricing promise, or cannot meet quota limits without a product decision.

## Open Questions

None for the first implementation pass. If usage later proves the project-level Google quota is not 10000/day, update `YOUTUBE_PROJECT_DAILY_QUOTA` and the internal docs without changing the app contract.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-05-24 22:43:59 UTC | sf-spec | GPT-5 Codex | Created spec for ReplayGlowz YouTube quota-safe sync from user request, current ReplayGlowz sync code, old TubeFlow quota/caching behavior, and official YouTube Data API quota docs. | draft | `/sf-ready ReplayGlowz YouTube quota-safe sync` |
| 2026-05-24 23:05:44 UTC | sf-ready | GPT-5 Codex | Reviewed the quota-safe sync spec against the user story, behavior contract, security posture, external-doc freshness, implementation ordering, acceptance criteria, and adversarial edge cases. | ready | `/sf-start ReplayGlowz YouTube quota-safe sync` |
| 2026-05-24 23:13:51 UTC | sf-start | GPT-5 Codex | Implemented the first quota-safe sync pass: backend `youtube:startQuotaSafeSync`, `youtubeSyncJobs` state, quota-limit enforcement, cached video-detail reuse, Flutter sync routing through the backend action, app quota/progress strip, and app docs/changelog updates. | implemented | `/sf-verify ReplayGlowz YouTube quota-safe sync` |
| 2026-05-24 23:14:29 UTC | sf-verify | GPT-5 Codex | Verified local implementation with backend typecheck, Flutter analyze, focused Flutter model tests, Convex deploy dry-run, diff whitespace check, and metadata lint. Hosted Vercel/browser proof and real connected YouTube sync remain pending because the project is `vercel-preview-push`. | partial | `/sf-ship ReplayGlowz YouTube quota-safe sync` |

## Current Chantier Flow

- `sf-spec`: done, draft spec created.
- `sf-ready`: passed, spec is ready for implementation.
- `sf-start`: implemented locally; hosted proof and live connected YouTube QA remain for verification/ship.
- `sf-verify`: partial; local checks pass, hosted/browser/real YouTube proof pending.
- `sf-end`: not launched.
- `sf-ship`: not launched.

Next step: `/sf-ship ReplayGlowz YouTube quota-safe sync`
