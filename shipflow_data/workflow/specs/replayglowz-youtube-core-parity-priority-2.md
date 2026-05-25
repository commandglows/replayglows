---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-05-25"
created_at: "2026-05-25 16:25:34 UTC"
updated: "2026-05-25"
updated_at: "2026-05-25 17:35:07 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "youtube-core-feature-parity-priority-2"
owner: "Diane"
user_story: "En tant qu'utilisateur ReplayGlowz connecte a YouTube, je veux retrouver les workflows avances de TubeFlow qui restent utiles, afin de suivre mes chaines, gerer mes transcripts et exploiter mes notes sans perdre la simplicite du produit."
confidence: "medium"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "replayglowz_app"
  - "replayglowz_backend"
  - "replayglowz_lab"
  - "Flutter Web"
  - "Riverpod"
  - "Convex"
  - "Clerk session auth"
  - "YouTube Data API"
  - "Transcript worker"
depends_on:
  - artifact: "AGENTS.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "replayglowz_app/AGENT.md"
    artifact_version: "1.2.0"
    required_status: "reviewed"
  - artifact: "shipflow_data/technical/guidelines.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/workflow/specs/replayglowz-youtube-quota-safe-sync.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-1.md"
    artifact_version: "1.0.0"
    required_status: "ready"
supersedes: []
evidence:
  - "User asked to continue implementation after Priority 1 and asked whether a second spec existed."
  - "No dedicated Priority 2 YouTube feature parity spec existed in `shipflow_data/workflow/specs` before this run."
  - "Feature-gap audit records P2 gaps: channel sync/subscription feed UX, transcript provider management, notes advanced workflows, plus lower-priority onboarding/modes/i18n."
  - "Priority 1 spec explicitly scopes out YouTube-wide search, browse/discovery, mini-player, study/focus mode, notes export/share/focus, and transcript provider settings."
  - "Current backend contains `channelLinks.ts`, `transcripts.ts`, `transcriptGeneration.ts`, `transcriptSecrets.ts`, `notes.ts`, and channel sync settings primitives."
  - "Current Flutter app has Preferences transcript language/settings, Notes screens, Play transcript panel, but provider catalog/secrets/version management and channel-link workflow are not fully exposed."
  - "Official YouTube docs checked 2026-05-25: `subscriptions.list` costs 1 quota unit per call and requires authorized `mine=true` for the authenticated user's subscriptions."
next_step: "/sf-start replayglowz-youtube-core-parity-priority-2"
---

# Spec: ReplayGlowz YouTube Core Parity Priority 2

## Title

ReplayGlowz YouTube core parity priority 2

## Status

ready

## User Story

En tant qu'utilisateur ReplayGlowz connecte a YouTube, je veux retrouver les workflows avances de TubeFlow qui restent utiles, afin de suivre mes chaines, gerer mes transcripts et exploiter mes notes sans perdre la simplicite du produit.

## Minimal Behavior Contract

Apres la priorite 1, ReplayGlowz doit permettre a un utilisateur connecte de gerer les workflows avances qui enrichissent sa bibliotheque deja importee: voir ses abonnements YouTube, lier une chaine a une playlist ReplayGlowz, synchroniser les nouvelles videos de chaines liees avec estimation quota, choisir et configurer ses providers de transcript, suivre les jobs de transcript, selectionner une version de transcript, puis exporter ou partager ses notes selon son acces produit. Si l'utilisateur n'a aucun abonnement, aucune chaine YouTube active, aucun provider configure, ou aucun transcript disponible, l'app doit afficher un etat utile sans erreur serveur et sans page vide. L'edge case facile a rater est de reconstruire une recherche YouTube generale: elle reste hors scope; P2 travaille depuis les donnees de l'utilisateur, ses abonnements, ses playlists, ses videos cachees et ses transcripts.

## Success Behavior

- Preconditions: l'utilisateur est authentifie via Clerk, dispose d'un acces ReplayGlowz actif, Convex auth est pret, et les actions YouTube/transcript verifient server-side les tokens, secrets, ownership et quota avant execution.
- Trigger: l'utilisateur ouvre Preferences, Playlists, Play ou Notes, puis lance explicitement une action avancee: voir ses abonnements, lier une chaine, synchroniser une chaine, configurer un provider, generer un transcript ou exporter des notes.
- User/operator result: Preferences ou une surface dediee permet de voir les abonnements YouTube importables, avec etats vide, token revoque, quota limite et dernier refresh.
- User/operator result: l'utilisateur peut lier une chaine YouTube a une playlist ReplayGlowz existante, activer/desactiver le lien, le supprimer, et lancer une sync des videos passees ou recentes avec avertissement quota.
- User/operator result: les pages Playlists/Preferences exposent les chaines liees a une playlist et les actions correspondantes sans devoir manipuler Convex directement.
- User/operator result: le player et Preferences exposent le catalogue de providers transcript, les providers disponibles/indisponibles, les secrets requis, les tests de cle, la langue par defaut et les options d'automatisation existantes.
- User/operator result: le player permet de generer/regenerer un transcript, voir l'etat du job, afficher les versions disponibles, selectionner la version active et conserver le seek timestamp fiable.
- User/operator result: Notes permet l'export des notes d'une video et le partage/copy propre selon le plan de l'utilisateur et les limites `SubscriptionFeatures.exportNotes`.
- System effect: chaque action couteuse est journalisee sans secret, borne son fan-out, invalide uniquement les providers utiles et conserve le cache existant sur echec partiel.
- Success proof: `flutter analyze`, backend typecheck si backend touche, lint metadata, source checks anti-token/search, et QA authentifiee sur compte YouTube vide puis compte normal.

## Error Behavior

- Expected failures: YouTube connecte mais sans chaine, aucun abonnement, token revoque, quota insuffisant, chaine deja liee ailleurs, playlist supprimee/cache stale, provider secret absent/invalide, worker indisponible, transcript vide, export non autorise par plan, double clic ou multi-tab.
- User/operator response: l'app affiche un etat vide ou une erreur actionnable, conserve les donnees cachees, propose reconnecter/reessayer/attendre le reset quota quand pertinent, et n'expose pas de bouton mort.
- System effect: les actions echouees ne suppriment pas les caches, ne relancent pas de boucle recursive, liberent les locks/jobs quand necessaire et logguent une erreur exploitable sans token, cookie, JWT ou secret provider.
- Must never happen: token YouTube ou cle transcript en clair dans Flutter, logs, diagnostics ou crash reports; sync automatique de toutes les chaines; export contourne par un plan non autorise; lien chaine-playlist cross-user; usage de `search.list`.
- Partial failure: si une action liee a une chaine reussit partiellement, le lien et la playlist restent coherents; la sync job indique `partial` avec les erreurs par chaine/video.

## Problem

La P1 retablit le coeur du feed, des playlists, de la lecture et des actions quota-safe. Les pieces avancees existent en grande partie cote backend, mais l'app Flutter ne les rend pas encore utilisables: channel links, subscription feed, transcript providers, transcript versions/jobs, secrets providers, export/share notes et etats d'onboarding ne sont pas exposes comme des workflows complets. Cela force l'utilisateur a voir des erreurs generiques ou des surfaces incompletes alors que l'ancien TubeFlow avait deja une experience plus riche.

## Solution

Construire P2 en quatre lots bornes: channel sync/subscriptions, transcript provider management, notes export/share, puis onboarding/persistence/i18n pour ces surfaces. Tous les appels couteux restent derriere le quota-safe backend; toutes les integrations sensibles restent server-side; l'app n'ajoute pas de search YouTube globale et n'elargit pas les scopes OAuth sans decision separee.

## Scope In

- UI Flutter pour abonnements YouTube, liens chaine-playlist, chaines liees, sync de chaine et etats vides.
- Providers Riverpod et modeles Flutter manquants pour `channelLinks`, subscription feed, transcript catalog, transcript secrets, transcript versions/jobs et notes export.
- Backend Convex hardening si les contrats existants ne sont pas suffisants pour l'UI P2: validation auth, status partial, cache, erreurs typables, quota plan pour channel sync.
- Preferences/player/notes UX pour providers transcript, secrets utilisateur OpenAI/Deepgram, generation, versions, selection active et progress.
- Notes export/share/copy pour notes par video et notes globales, borne par le plan produit.
- Onboarding leger et etats vides pour nouveau compte YouTube, zero abonnement, zero playlist, provider indisponible et quota bloque.
- i18n/copy coherent en anglais et francais selon la convention actuelle du repo.

## Scope Out

- YouTube-wide search, `search.list`, import d'une video arbitraire par recherche, ou "Add video by YouTube search".
- Browse/discovery Netflix-style.
- Mini-player global overlay.
- Study mode/focus mode complet.
- Nouveaux scopes OAuth YouTube sans decision produit explicite.
- Nouveaux providers transcript non deja modelises dans le backend.
- Migration des donnees legacy TubeFlow.
- Pricing public, site marketing, promesses publiques de quotas ou limites definitives.
- Automatisation agressive de sync en background hors visite/app ouverte.

## Constraints

- Flutter ne lit, stocke, loggue ni transmet jamais les access/refresh tokens YouTube ou les cles transcript en clair hors mutation/action prevue.
- Les secrets transcript utilisateur restent chiffres cote backend avec `TRANSCRIPT_SECRET_ENCRYPTION_KEY`; l'UI ne recupere que masked/status.
- Les appels YouTube couteux, y compris `subscriptions.list`, `playlistItems.list`, channel sync et videos details, doivent utiliser le quota-safe policy existant.
- Le flux doit accepter les comptes YouTube neufs: pas de chaine, pas d'abonnement, pas de playlist, ou `youtubeSignupRequired` ne doivent pas casser la page.
- Les actions de sync de chaines doivent etre explicites et visibles; pas de boucle automatique sur tous les abonnements.
- Les surfaces avancees doivent rester discretes pour ne pas augmenter la friction du premier usage ReplayGlowz.
- Pas de dependance a un test OAuth local impossible; prevoir une QA manuelle auth prod/preview en plus des checks statiques.
- Une chaine YouTube ne peut avoir qu'un seul lien actif vers une playlist ReplayGlowz par utilisateur; l'UI peut proposer de deplacer le lien, mais le backend doit refuser les doublons actifs.
- Les providers transcript de production suivent un mode "available only": YouTube captions est tente en premier quand disponible; les providers worker-dependent sont visibles mais indisponibles tant que worker/secret requis manque; OpenAI/Deepgram ne sont actifs qu'apres secret utilisateur valide.
- Notes export reste borne par `SubscriptionFeatures.exportNotes` et les plans existants; P2 n'accorde pas un nouveau droit gratuit tant que pricing/quota produit n'est pas decide.

## Dependencies

- Local contracts:
  - `replayglowz_app/AGENT.md` runtime flow and YouTube boundary.
  - `replayglowz_backend/packages/backend/convex/channelLinks.ts`.
  - `replayglowz_backend/packages/backend/convex/transcripts.ts`.
  - `replayglowz_backend/packages/backend/convex/transcriptGeneration.ts`.
  - `replayglowz_backend/packages/backend/convex/transcriptSecrets.ts`.
  - `replayglowz_backend/packages/backend/convex/notes.ts`.
  - `replayglowz_app/lib/screens/preferences/preferences_screen.dart`.
  - `replayglowz_app/lib/screens/play/play_screen.dart`.
  - `replayglowz_app/lib/screens/notes/notes_screen.dart`.
- Fresh external docs checked on 2026-05-25:
  - Google official docs, `subscriptions.list`: `https://developers.google.com/youtube/v3/docs/subscriptions/list`.
  - Google official docs, YouTube quota/compliance: `https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits`.
  - Google official docs, YouTube Data API overview: `https://developers.google.com/youtube/v3/getting-started`.
- Freshness verdict: `fresh-docs checked` for YouTube subscriptions/quota behavior. Re-check official docs before implementation if channel sync adds endpoints beyond existing backend paths.

## Invariants

- Une session Clerk valide ne suffit pas: chaque action privee depend aussi de l'acces ReplayGlowz et des tokens YouTube/transcript disponibles.
- Les donnees cachees ne sont jamais supprimees uniquement parce qu'une API externe echoue.
- Le backend reste l'autorite pour permissions, quota, ownership, token validity, secrets et plan limits.
- Les providers premium ne peuvent pas etre presentes comme disponibles si leur secret ou le worker requis manque.
- Une action user-triggered doit toujours produire feedback visible, invalidation controlee ou etat job observable.
- Les messages utilisateur doivent distinguer "rien a importer" de "erreur technique".

## Links & Consequences

- Upstream: Clerk session, Convex auth, ReplayGlowz entitlement, YouTube OAuth token storage, YouTube Data API quota, transcript worker, user transcript secrets.
- Downstream: Preferences, Playlists, Playlist detail, Play, Notes, Notifications, Stats, AppShell quota UI, diagnostics/support copy.
- Data contracts touched: channel links, sync jobs, YouTube subscriptions, playlist/channel association, transcript provider catalog, transcript secrets status, transcript jobs, transcript versions, transcript selections, notes export.
- Regression areas: YouTube connect state, quota-safe sync, playlist actions from P1, transcript display in player, notes timestamps, product plan/free trial messaging.

## Documentation Coherence

- Update the feature-gap audit after implementation to mark P2 items closed/partial/deferred.
- Update `replayglowz_app/AGENT.md` only if the runtime contract changes beyond exposing existing backend primitives.
- Update backend docs/AGENT if channel sync or transcript provider contracts become formal integration boundaries.
- Keep public pricing/site copy untouched unless a separate product decision fixes real quotas/plan names.
- Add changelog/task entries during ship, not during this spec-only run.

## Edge Cases

- Google account has YouTube connected but no channel: show empty/onboarding, do not throw server error.
- YouTube account has no subscriptions: subscription list is a valid empty state and should still allow manual playlist workflows.
- User has hundreds of subscriptions: show paged/cached list and selected channel sync, not all-at-once sync.
- User links the same channel to multiple playlists: backend rejects a second active link for the same user/channel unless the user explicitly moves the existing link to another playlist.
- Linked channel playlist is deleted or hidden: link state must not crash Preferences/Playlist detail.
- Transcript provider requires secret but the user deletes it during a job: job fails recoverably and provider status updates.
- Transcript worker unavailable: local/premium providers are disabled but YouTube captions path remains usable when available.
- Transcript generation returns empty transcript: keep version absent/failed with clear message instead of a blank panel.
- Export notes for a video with no notes: produce a useful empty state, not an empty downloaded artifact.
- Multi-tab sync/generate clicks: backend returns current job/progress or refuses duplicate work.

## Implementation Tasks

- [x] Task 1: Freeze P2 backend action/query contracts.
  - File: `replayglowz_backend/packages/backend/convex/channelLinks.ts`, `replayglowz_backend/packages/backend/convex/transcripts.ts`, `replayglowz_backend/packages/backend/convex/transcriptGeneration.ts`, `replayglowz_backend/packages/backend/convex/transcriptSecrets.ts`, `replayglowz_backend/packages/backend/convex/notes.ts`, `replayglowz_app/lib/providers/providers.dart`, `replayglowz_app/lib/providers/mutations.dart`.
  - Action: Map every P2 UI action to an existing backend contract; mark missing fields/errors/statuses before adding UI.
  - User story link: Avoids building dead controls or duplicate backend paths.
  - Depends on: P1 static checks passing.
  - Validate with: `rg -n "channelLinks|transcriptSecrets|transcriptGeneration|selectTranscriptVersion|exportNotesForVideo|subscription" replayglowz_app/lib replayglowz_backend/packages/backend/convex`.
  - Notes: Do not add new OAuth scopes during this mapping.

- [x] Task 2: Add Flutter models/providers for channel links and subscription feed.
  - File: `replayglowz_app/lib/models/`, `replayglowz_app/lib/providers/providers.dart`, `replayglowz_app/lib/providers/mutations.dart`.
  - Action: Add typed parsing and Riverpod providers/mutations for channel links, linked channels by playlist, subscribed channels, sync past videos count, link/unlink/toggle/sync actions.
  - User story link: Makes channel workflows available to UI without ad hoc dynamic maps.
  - Depends on: Task 1.
  - Validate with: `(cd replayglowz_app && flutter analyze)`.
  - Notes: Treat empty subscription results as valid data.

- [x] Task 3: Build linked-channel management UI.
  - File: `replayglowz_app/lib/screens/preferences/preferences_screen.dart`, `replayglowz_app/lib/screens/playlists/playlist_detail_screen.dart`, new focused widget under `replayglowz_app/lib/widgets/` if needed.
  - Action: Show subscribed channels, linked channels per playlist, link/unlink/toggle controls, sync-past-videos action, quota warning, empty states and loading/errors.
  - User story link: User can maintain playlist/channel automation from the app.
  - Depends on: Task 2.
  - Validate with: Flutter analyze and authenticated manual QA with empty-subscription and normal accounts.
  - Notes: Keep the flow compact; advanced channel controls can live below Preferences/playlist settings, not in first-run dashboard.

- [x] Task 4: Harden channel sync backend error/status behavior if needed.
  - File: `replayglowz_backend/packages/backend/convex/channelLinks.ts`, `replayglowz_backend/packages/backend/convex/youtube.ts`, `replayglowz_backend/packages/backend/convex/metrics.ts`.
  - Action: Ensure channel sync returns typed success/partial/empty/quota/auth errors and uses quota-safe counters before fetching past videos.
  - User story link: User sees recoverable outcomes instead of generic server errors.
  - Depends on: Tasks 1 and 3.
  - Validate with: `(cd replayglowz_backend/packages/backend && npm run typecheck)`.
  - Notes: If this changes durable schema, update generated Convex artifacts per repo pattern.

- [x] Task 5: Add Flutter transcript provider catalog and secret status providers.
  - File: `replayglowz_app/lib/models/settings.dart`, `replayglowz_app/lib/models/`, `replayglowz_app/lib/providers/providers.dart`, `replayglowz_app/lib/providers/mutations.dart`.
  - Action: Parse provider catalog rows, availability, masked secret status, language/default settings, secret upsert/delete/test actions, transcript versions and jobs.
  - User story link: User understands which transcript options are available and why.
  - Depends on: Task 1.
  - Validate with: Flutter analyze and focused parser tests if test harness exists.
  - Notes: Never expose raw secrets in model `toString`, logs or diagnostics.

- [x] Task 6: Build transcript provider management UI.
  - File: `replayglowz_app/lib/screens/preferences/preferences_screen.dart`, `replayglowz_app/lib/widgets/settings/settings_rows.dart`, new transcript settings widgets if needed.
  - Action: Add provider list with availability, cost/speed/quality metadata, default provider/language controls, auto YouTube captions/local fallback toggles, secret add/delete/test flows.
  - User story link: User can configure transcript generation without backend knowledge.
  - Depends on: Task 5.
  - Validate with: Flutter analyze; manual QA for missing worker, missing secret, invalid secret and valid masked secret.
  - Notes: Secret input must be obscured and cleared after submit/test.

- [x] Task 7: Complete transcript versions and job UX in player.
  - File: `replayglowz_app/lib/screens/play/play_screen.dart`, `replayglowz_app/lib/widgets/transcripts/transcript_entry_tile.dart`, providers from Task 5.
  - Action: Show active transcript metadata, generate/regenerate button, provider/language choice, job progress, version list, select active version, errors and empty states.
  - User story link: User can recover when captions are absent or a provider gives better results.
  - Depends on: Tasks 5 and 6.
  - Validate with: Flutter analyze; manual QA using a cached video with and without transcript.
  - Notes: Timestamp click-to-seek remains dependent on P1 player bridge.

- [x] Task 8: Implement notes export/share/copy workflows.
  - File: `replayglowz_app/lib/screens/notes/notes_screen.dart`, `replayglowz_app/lib/screens/notes/note_detail_screen.dart`, `replayglowz_app/lib/screens/play/play_screen.dart`, `replayglowz_backend/packages/backend/convex/notes.ts`, `replayglowz_app/lib/models/subscription.dart`.
  - Action: Wire existing `notes:exportNotesForVideo` and share/copy actions with plan gating, video-scoped export, global notes copy where safe, and user feedback.
  - User story link: User can reuse the notes they created in ReplayGlowz.
  - Depends on: Task 1.
  - Validate with: Flutter analyze; manual QA for free/trial/pro plan states if available.
  - Notes: Do not promise PDF unless implementation actually creates a PDF.

- [ ] Task 9: Add P2 onboarding and persistent UX helpers.
  - File: `replayglowz_app/lib/widgets/youtube_connect_ui_states.dart`, `replayglowz_app/lib/screens/videos/videos_screen.dart`, `replayglowz_app/lib/screens/playlists/playlists_screen.dart`, `replayglowz_app/lib/screens/preferences/preferences_screen.dart`, existing settings/preferences model if persistence belongs backend.
  - Action: Add dismissible guidance for empty YouTube account, zero subscriptions, zero playlists, no transcript provider, and persist lightweight view preferences/scroll where patterns already exist.
  - User story link: Advanced features remain discoverable without overwhelming the first-use flow.
  - Depends on: Tasks 3, 6, 7 and 8.
  - Validate with: Flutter analyze and manual first-run QA.
  - Notes: Keep explanations hidden/progressive where they add friction to the core ReplayGlowz signup flow.

- [x] Task 10: Add focused tests, diagnostics and documentation updates.
  - File: `replayglowz_app/test/` where feasible, backend tests/helpers where present, `shipflow_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md`, possibly `replayglowz_app/AGENT.md`.
  - Action: Cover parser/provider contract tests, quota/channel empty states, transcript secret masking expectations, export gating, and update the audit after implementation.
  - User story link: Prevents regressions across sensitive auth/quota/secret surfaces.
  - Depends on: Tasks 2-9.
  - Validate with: `(cd replayglowz_app && flutter analyze)`, `(cd replayglowz_backend/packages/backend && npm run typecheck)`, `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENTS.md shipflow_data`.
  - Notes: Authenticated YouTube manual QA remains required before ship.

## Acceptance Criteria

- [ ] A user with no YouTube subscriptions sees a valid empty state and no server error.
- [ ] A user with subscriptions can view channels, link one to a playlist, disable/unlink it, and sync selected channel videos with quota warning.
- [ ] Channel sync actions preserve cached data on partial/auth/quota failures and show a typed outcome.
- [ ] Preferences exposes transcript provider catalog, availability reasons, default provider/language, auto settings, and secret status without leaking secrets.
- [ ] User can add/delete/test provider secrets and the UI clears secret inputs after submit.
- [ ] Player can generate/regenerate transcript, show job progress, list transcript versions, select active version, and handle no transcript gracefully.
- [ ] Notes export/share/copy works where allowed by plan and explains plan limits where blocked.
- [ ] New user/empty account onboarding distinguishes "nothing imported yet" from "connection failed".
- [ ] No P2 feature calls `search.list` or introduces YouTube-wide search.
- [ ] Static checks pass: Flutter analyze, backend typecheck if backend touched, and ShipFlow metadata lint.
- [ ] Authenticated manual QA covers empty Gmail/YouTube test account and a normal account with subscriptions/playlists.

## Test Strategy

- Static checks:
  - `(cd replayglowz_app && flutter analyze)`
  - `(cd replayglowz_backend/packages/backend && npm run typecheck)`
  - `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENTS.md shipflow_data`
- Source checks:
  - `rg -n "search\\.list|searchYoutube|youtubeAccessToken|refreshToken|clientSecret" replayglowz_app/lib replayglowz_backend/packages/backend/convex`
  - `rg -n "channelLinks|transcriptSecrets|exportNotesForVideo|selectTranscriptVersion" replayglowz_app/lib replayglowz_backend/packages/backend/convex`
- Manual authenticated QA:
  - Empty YouTube account: connect, open Preferences/Videos/Playlists/Notes, confirm no server error.
  - Normal account: list subscriptions, link channel, sync selected channel, confirm quota/progress.
  - Transcript: provider catalog without secrets, add invalid key, delete key, generate transcript with available provider.
  - Notes: export/copy/share from video notes and note detail, verify plan-gated copy.

## Risks

- Channel sync can burn quota quickly if the UI nudges all-subscription sync; keep selected/bounded actions.
- Transcript secret handling is security-sensitive; raw secrets must not appear in diagnostics, logs, models or crash reports.
- Transcript worker availability can vary by environment; UI must separate "provider unavailable" from "video has no transcript".
- P2 scope can grow into browse/search/study mode; those remain deferred to protect delivery.
- Product quotas/trial limits are placeholders in current product thinking; avoid hard public claims while still explaining current access.

## Execution Notes

- Read first:
  - `shipflow_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md`
  - `shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-1.md`
  - `replayglowz_app/lib/providers/providers.dart`
  - `replayglowz_app/lib/providers/mutations.dart`
  - `replayglowz_app/lib/screens/preferences/preferences_screen.dart`
  - `replayglowz_app/lib/screens/play/play_screen.dart`
  - `replayglowz_app/lib/screens/notes/notes_screen.dart`
  - `replayglowz_backend/packages/backend/convex/channelLinks.ts`
  - `replayglowz_backend/packages/backend/convex/transcripts.ts`
  - `replayglowz_backend/packages/backend/convex/transcriptGeneration.ts`
  - `replayglowz_backend/packages/backend/convex/transcriptSecrets.ts`
  - `replayglowz_backend/packages/backend/convex/notes.ts`
- Use existing patterns:
  - Riverpod providers/mutations and `showErrorSnackBar`.
  - Existing settings rows and compact Preferences sections.
  - Existing quota guard patterns from P1 and quota-safe sync.
  - Backend Convex validation for user ownership and product access.
- Avoid:
  - YouTube search.
  - Client-side token or secret handling.
  - Automatic all-channel sync.
  - Large marketing/onboarding cards in the app.
  - PDF export unless a real PDF implementation is added.

## Open Questions

None.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-05-25 16:25:34 UTC | sf-spec | GPT-5 Codex | Created Priority 2 YouTube parity spec from Expo gap audit and P1 exclusions. | draft spec created | `/sf-ready replayglowz-youtube-core-parity-priority-2` |
| 2026-05-25 16:34:12 UTC | sf-ready | GPT-5 Codex | Resolved blocking open questions with conservative defaults and completed readiness review. | ready | `/sf-start replayglowz-youtube-core-parity-priority-2` |
| 2026-05-25 17:35:07 UTC | sf-start | GPT-5 Codex + bounded subagents | Implemented P2 channel automation, transcript provider/version/job UI, notes Markdown copy, and backend guardrails. | partial | Continue remaining onboarding/tests/QA polish or run `/sf-verify replayglowz-youtube-core-parity-priority-2` on current scope. |

## Current Chantier Flow

| Stage | Status | Notes |
|-------|--------|-------|
| sf-spec | complete | Priority 2 spec created; scope excludes YouTube search and public pricing claims. |
| sf-ready | complete | Open questions resolved: one active playlist per channel, available-only transcript providers, notes export gated by existing subscription feature. |
| sf-start | partial | Core P2 implementation landed for channel links, transcript providers/jobs/versions, and notes export; onboarding/test expansion remains. |
| sf-verify | pending | Validate implementation and authenticated YouTube QA. |
| sf-end | pending | Update audit/changelog/tracking after verification. |
| sf-ship | pending | Deploy after verification and ship gate. |
