---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-05-26"
created_at: "2026-05-26 06:20:51 UTC"
updated: "2026-05-26"
updated_at: "2026-05-26 07:10:00 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "youtube-channel-onboarding-playlist-url-import"
owner: "Diane"
user_story: "En tant qu'utilisateur ReplayGlowz qui a connecte YouTube mais dont la bibliotheque n'est pas decouvrable automatiquement, je veux comprendre pourquoi et importer mes playlists par URL si besoin, afin de recuperer mes videos sans erreur technique ni obligation confuse."
confidence: "high"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "replayglowz_app"
  - "replayglowz_backend"
  - "Flutter Web"
  - "Riverpod"
  - "Convex"
  - "YouTube OAuth"
  - "YouTube Data API"
depends_on:
  - artifact: "AGENTS.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/workflow/audits/2026-05-26-youtube-edge-case-regression-checklist.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-1.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-2.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-3.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "YouTube Help: Create a YouTube channel"
    artifact_version: "last reviewed 2026-05-26"
    required_status: "official"
  - artifact: "YouTube Data API playlists.list"
    artifact_version: "last updated 2026-04-28 UTC"
    required_status: "official"
  - artifact: "YouTube Data API playlistItems.list"
    artifact_version: "last reviewed 2026-05-26"
    required_status: "official"
  - artifact: "YouTube Data API subscriptions.list"
    artifact_version: "last reviewed 2026-05-26"
    required_status: "official"
supersedes: []
evidence:
  - "Operator decision: explain that creating a YouTube channel enables automatic playlist sync and does not require publishing videos."
  - "Operator decision: offer playlist URL import as fallback, with public/unlisted playlist guidance."
  - "Production QA found Google/YouTube accounts can show YouTube UI playlists while `playlists.list?mine=true` returns missing-channel errors."
  - "YouTube Help says some actions such as creating playlists require creating a channel."
  - "YouTube Data API playlists.list can retrieve playlists owned by the authenticated user or playlists by explicit IDs."
  - "YouTube Data API playlistItems.list can retrieve items from a playlist by playlist ID, but special lists such as Watch Later can be unsupported."
  - "Current backend already has `youtube:fetchPlaylistItems`, `youtube:updatePlaylistsCache`, and `youtube:updateVideosCache`."
  - "Current Flutter app already has Playlists, Videos, Preferences, connect states, i18n maps, and sync mutations."
next_step: "/sf-verify replayglowz-youtube-channel-onboarding-playlist-url-import"
---

# Spec: ReplayGlowz YouTube Channel Onboarding And Playlist URL Import

## Title

ReplayGlowz YouTube channel onboarding and playlist URL import

## Status

ready

## User Story

En tant qu'utilisateur ReplayGlowz qui a connecte YouTube mais dont la bibliotheque n'est pas decouvrable automatiquement, je veux comprendre pourquoi et importer mes playlists par URL si besoin, afin de recuperer mes videos sans erreur technique ni obligation confuse.

## Minimal Behavior Contract

Quand ReplayGlowz detecte qu'un compte YouTube connecte ne permet pas de decouvrir automatiquement les playlists via l'API, l'app explique que la creation d'une chaine YouTube active la synchronisation automatique des playlists sans obliger a publier des videos, puis propose soit d'ouvrir l'aide/creation de chaine YouTube, soit d'importer une playlist publique ou non repertoriee par URL. L'import par URL valide l'URL cote client et cote backend, lit la playlist par ID explicite avec YouTube Data API, met en cache la playlist et ses videos dans ReplayGlowz, respecte les quotas, et retourne un etat clair si la playlist est privee, introuvable, Watch Later, trop grande ou non supportee. L'edge case facile a rater est un compte qui voit une playlist dans l'interface YouTube mais dont `playlists.list?mine=true` echoue parce que la playlist n'est pas decouvrable comme playlist possedee par une chaine.

## Success Behavior

- Preconditions: l'utilisateur est authentifie dans ReplayGlowz, YouTube OAuth est connecte, Convex auth est pret, et le backend possede un access token YouTube valide ou rafraichissable.
- Trigger: l'utilisateur ouvre Videos, Playlists ou Preferences apres une sync vide/missing-channel, ou colle une URL de playlist YouTube dans un formulaire d'import.
- User/operator result: l'utilisateur comprend que creer une chaine YouTube permet la synchronisation automatique des playlists, que cela ne change pas son compte ReplayGlowz et ne l'oblige pas a publier des videos.
- User/operator result: l'utilisateur peut choisir de creer/ouvrir la configuration de chaine YouTube ou d'importer une playlist par URL.
- User/operator result: une URL valide de playlist publique ou non repertoriee importe une playlist cachee dans ReplayGlowz, puis les videos apparaissent dans Playlists et dans le feed Videos.
- User/operator result: si la playlist est trop grande, l'import se termine avec un message partiel lisible et conserve les videos deja importees dans la limite fixee.
- System effect: le cache distingue les playlists decouvertes automatiquement, les playlists importees par URL et la playlist virtuelle Subscriptions afin qu'une sync automatique ne supprime pas les imports URL.
- System effect: les appels YouTube sont journalises dans les metrics quota sans exposer de tokens, cookies, OAuth codes, URLs completes non repertoriees ou secrets.
- Success proof: backend typecheck, Flutter analyze, tests de parsing URL, tests backend d'import/erreurs provider, metadata lint, et QA manuelle sur compte sans chaine avec playlist URL `FUN`.

## Error Behavior

- URL invalide: l'app refuse sans appel backend et indique de coller une URL YouTube contenant `list=...`.
- Playlist privee, introuvable ou interdite: le backend ne modifie pas le cache existant et retourne un message utilisateur precis.
- Watch Later ou playlist speciale non supportee: l'app explique que YouTube ne permet pas l'import automatique de Watch Later via API.
- YouTube OAuth absent ou refresh token invalide: l'app renvoie vers reconnecter YouTube sans perdre les imports deja caches.
- Quota proche du seuil: l'import est bloque ou confirme via le guard quota existant avant les appels couteux.
- Quota atteint pendant l'import: l'import devient partiel, conserve les videos importees, indique le nombre importe et invite a reprendre plus tard.
- Playlist enorme: l'import s'arrete a une limite bornee de 500 videos par execution, conserve les videos deja importees, marque le resultat comme partiel et indique que le reste n'a pas encore ete importe.
- Must never happen: logguer des tokens ou l'URL complete d'une playlist non repertoriee, supprimer une playlist importee par URL pendant une sync `mine=true`, promettre l'import de Watch Later, forcer la creation d'une chaine, ou melanger les donnees YouTube entre deux `user_...` ReplayGlowz.

## Problem

Le flux actuel suppose encore trop souvent que la bibliotheque YouTube utile est decouvrable automatiquement via `playlists.list?mine=true` ou via les abonnements. Or l'interface YouTube peut montrer des playlists ou Watch Later a un compte qui a toujours un bouton "creer une chaine". Dans cette situation, ReplayGlowz peut afficher une app vide ou des messages trop techniques alors que l'utilisateur a bien des playlists exploitables par URL, ou a simplement besoin de creer une chaine pour rendre la decouverte automatique coherente.

## Solution

Ajouter un onboarding contextualise pour les comptes connectes avec bibliotheque non decouvrable, puis ajouter un import par URL de playlist YouTube. Le backend lit les playlists par ID explicite, les marque comme imports URL dans le cache, preserve ces imports pendant les refresh automatiques, et expose des messages d'erreur specifiques pour Watch Later, playlist privee/introuvable, quota et missing channel.

## Scope In

- Detection et exposition UI d'un etat "YouTube connecte, playlists automatiques indisponibles ou vides".
- Copy onboarding ReplayGlowz-first expliquant la creation de chaine YouTube sans panique ni jargon API.
- CTA pour ouvrir l'aide ou la configuration YouTube de creation de chaine.
- Formulaire d'import de playlist par URL dans Playlists et/ou Preferences, reutilisable dans les empty states.
- Parsing URL/ID de playlist cote Flutter et validation authoritative cote backend.
- Nouvelle action Convex d'import par URL/ID explicite avec YouTube Data API `playlists.list?id=...`, `playlistItems.list`, et `videos.list` pour enrichir les details manquants.
- Marquage des playlists cachees par source: `owned`, `url_import`, `subscriptions` ou equivalent backward-compatible.
- Protection pour que `updatePlaylistsCache` ne supprime que les playlists automatiques possedees, pas les imports URL ni la playlist virtuelle Subscriptions.
- Messages dedies pour Watch Later, playlist privee/introuvable, URL invalide, quota et import partiel.
- i18n anglais/francais pour toutes les nouvelles surfaces visibles.
- Tests backend et Flutter cibles.
- Mise a jour de la checklist edge cases si l'implementation decouvre une nuance API supplementaire.

## Scope Out

- Import automatique de Watch Later.
- Scraping de l'interface YouTube ou automatisation navigateur YouTube.
- Creation automatique d'une chaine YouTube au nom de l'utilisateur.
- Modification du consent screen OAuth ou ajout de scopes non necessaires.
- Import de playlists privees non accessibles par l'API avec le token courant.
- Synchronisation bidirectionnelle des playlists importees par URL si l'utilisateur n'en est pas proprietaire.
- Ecriture dans une playlist YouTube importee dont l'utilisateur n'est pas proprietaire.
- Recherche YouTube via `search.list`.
- Systeme complet de jobs longue duree multi-page avec reprise avancee; une limite bornee par execution suffit pour cette tranche.

## Constraints

- L'onboarding doit rester simple et non culpabilisant: creer une chaine est presente comme une option pratique, pas comme une obligation pour utiliser ReplayGlowz.
- L'utilisateur doit pouvoir continuer avec import par URL sans creer de chaine.
- Les URL de playlists non repertoriees sont des donnees sensibles: ne pas les logguer brutes et ne pas les afficher dans diagnostics partageables sauf sous forme tronquee ou ID masque.
- Les imports URL doivent rester scopes au `user_...` ReplayGlowz courant.
- Les imports URL ne doivent pas etre supprimes par une sync automatique `mine=true`.
- Le backend doit respecter les limites quota existantes et logguer chaque appel YouTube avec `metrics.logApiCallInternal`.
- Les erreurs YouTube doivent etre mappees vers des messages utilisateur sans exposer la reponse brute dans l'UI.
- Le design doit rester dense et outil, pas une landing page dans l'app.

## Dependencies

- Local contracts:
  - `replayglowz_backend/packages/backend/convex/youtube.ts`
  - `replayglowz_backend/packages/backend/convex/schema.ts`
  - `replayglowz_backend/packages/backend/convex/metrics.ts`
  - `replayglowz_app/lib/providers/mutations.dart`
  - `replayglowz_app/lib/providers/providers.dart`
  - `replayglowz_app/lib/screens/playlists/playlists_screen.dart`
  - `replayglowz_app/lib/screens/videos/videos_screen.dart`
  - `replayglowz_app/lib/screens/preferences/preferences_screen.dart`
  - `replayglowz_app/lib/widgets/youtube_connect_ui_states.dart`
  - `replayglowz_app/lib/widgets/youtube_connect.dart`
  - `replayglowz_app/lib/i18n/en.dart`
  - `replayglowz_app/lib/i18n/fr.dart`
  - `replayglowz_app/lib/models/playlist.dart`
  - `replayglowz_app/lib/models/youtube_channel.dart`
- Official docs consulted, verdict `fresh-docs checked`:
  - YouTube Help, create a YouTube channel: `https://support.google.com/youtube/answer/1646861`
  - YouTube Data API `playlists.list`: `https://developers.google.com/youtube/v3/docs/playlists/list`
  - YouTube Data API `playlistItems.list`: `https://developers.google.com/youtube/v3/docs/playlistItems/list`
  - YouTube Data API `subscriptions.list`: `https://developers.google.com/youtube/v3/docs/subscriptions/list`
- Current API facts from docs:
  - `playlists.list` can retrieve playlists owned by the authenticated user or by explicit playlist IDs.
  - `playlistItems.list` reads items by `playlistId`.
  - `playlists.list` documents `playlistOperationUnsupported`, including Watch Later.
  - YouTube Help indicates creating playlists is tied to creating a YouTube channel.

## Invariants

- YouTube OAuth connection success is separate from playlist discovery success.
- Missing channel/profile is not an auth failure and not a product entitlement failure.
- Subscription sync remains independent from playlist discovery.
- Imported URL playlists are first-class cached playlists for ReplayGlowz reading, notes, watched state and feed display.
- Imported URL playlists are read-only unless a later feature proves the user owns the playlist and can write to it.
- Existing owned playlist CRUD must keep working for accounts with a channel.
- `__subscriptions__` remains virtual and must not be treated as a normal writable YouTube playlist.
- All cached reads remain filtered by current ReplayGlowz user.
- A single URL import execution must import at most 500 playlist items, even if the YouTube playlist contains more videos.

## Links & Consequences

- Upstream: Clerk session, Convex auth, YouTube OAuth tokens, YouTube Data API quota.
- Downstream: Videos feed aggregation, Playlists screen, playlist detail, notes attached to imported videos, watched state, quota stats, support diagnostics.
- Data contract change: optional playlist cache source fields or an equivalent backward-compatible marker are needed.
- Regression risk: current `updatePlaylistsCache` deletes every playlist not returned by automatic discovery; it must be changed before imports URL ship.
- Product copy impact: empty states need to explain YouTube channel creation and public/non-repertorie playlist URL import.
- Support impact: diagnostics should distinguish "connected, no channel for automatic playlist discovery" from "not connected" and "quota/token failure".

## Documentation Coherence

- Update `shipflow_data/workflow/audits/2026-05-26-youtube-edge-case-regression-checklist.md` with final behavior and any provider nuance found during implementation.
- Update app support/onboarding copy only inside app i18n for this tranche.
- Do not update public pricing or marketing claims unless a later content spec decides to advertise playlist URL import.
- If a new backend import contract becomes central, update `replayglowz_app/AGENT.md` or `shipflow_data/technical/architecture.md` only after implementation verifies the final shape.

## Edge Cases

- YouTube UI shows "Create channel" but also shows `FUN` playlist.
- URL points to Watch Later (`WL`) or another special playlist unsupported by API.
- URL is a video URL with `list=...` rather than `/playlist?list=...`.
- URL is a Shorts, channel, user, or plain YouTube URL without `list`.
- URL contains multiple query params, tracking params, encoded characters, or mobile domain.
- Playlist is public but empty.
- Playlist is unlisted and readable by ID.
- Playlist is private or no longer accessible.
- Playlist has deleted/private videos mixed with public videos.
- Playlist has more videos than the import cap.
- User imports the same playlist twice.
- User imports a playlist that later appears in owned `mine=true` discovery.
- User disconnects YouTube after importing URL playlists.
- User signs in with another ReplayGlowz account in the same browser.
- Quota reaches hard stop mid-import.

## Implementation Tasks

- [x] Task 1: Add playlist source and discovery diagnostics contract.
  - File: `replayglowz_backend/packages/backend/convex/schema.ts`, `replayglowz_backend/packages/backend/convex/youtube.ts`, `replayglowz_app/lib/models/playlist.dart`.
  - Action: Add backward-compatible optional fields such as `source`, `importedByUrlAt`, `importedPlaylistId`, or an equivalent model that distinguishes owned playlists, URL imports, and virtual subscriptions.
  - User story link: Prevents imported playlists from being deleted by automatic sync and gives UI enough context.
  - Depends on: Existing cache schema.
  - Validate with: backend typecheck and model parsing test.
  - Notes: Preserve existing documents with missing fields.

- [x] Task 2: Preserve non-owned cache entries during automatic playlist sync.
  - File: `replayglowz_backend/packages/backend/convex/youtube.ts`.
  - Action: Change `updatePlaylistsCache` so automatic `mine=true` refresh updates/deletes only owned-discovery entries, while preserving URL imports and `__subscriptions__`.
  - User story link: Keeps manually imported playlists stable after refresh.
  - Depends on: Task 1.
  - Validate with: backend tests covering owned deletion, imported preservation and subscriptions preservation.
  - Notes: If source is missing on old rows, treat rows produced by automatic discovery as owned unless ID is `__subscriptions__`.

- [x] Task 3: Implement authoritative playlist URL/ID parser and error mapper.
  - File: `replayglowz_backend/packages/backend/convex/youtube.ts`, optional new helper module if local pattern allows.
  - Action: Accept YouTube playlist URLs and video URLs with `list=...`, normalize to playlist ID, reject missing/invalid IDs, map Watch Later/special playlist IDs and API reasons to user-safe codes.
  - User story link: Lets users paste what YouTube gives them without exposing provider errors.
  - Depends on: Task 1.
  - Validate with: unit-style tests or isolated helper tests if the backend test setup supports them; otherwise targeted action tests/mocks.
  - Notes: Never log full raw URLs.

- [x] Task 4: Add backend action `youtube:importPlaylistByUrl`.
  - File: `replayglowz_backend/packages/backend/convex/youtube.ts`, `replayglowz_backend/packages/backend/convex/metrics.ts` if needed.
  - Action: Fetch playlist metadata with `playlists.list?id=...`, fetch playlist items with pagination up to 500 videos per execution, enrich missing video details with `videos.list`, update playlist/videos cache as URL import, and return `{playlistId, title, importedVideoCount, partial, reason}`.
  - User story link: Makes URL import functional for accounts where automatic discovery fails.
  - Depends on: Tasks 1-3.
  - Validate with: backend typecheck and tests for success, duplicate import, unsupported Watch Later, private/not found, empty playlist and quota cap.
  - Notes: Use existing quota metric names; do not call `search.list`.

- [x] Task 5: Wire Flutter mutation helper and provider invalidation.
  - File: `replayglowz_app/lib/providers/mutations.dart`, `replayglowz_app/lib/providers/providers.dart` if a status provider is needed.
  - Action: Add `importPlaylistByUrl(ref, url)` that calls the backend action and invalidates playlists, videos, quota and sync/job status as appropriate.
  - User story link: Connects UI import to backend cache.
  - Depends on: Task 4.
  - Validate with: Flutter analyze and targeted widget/helper tests if present.
  - Notes: Keep URL validation duplicated client-side for UX only; backend remains authoritative.

- [x] Task 6: Add reusable YouTube channel/import onboarding widget.
  - File: `replayglowz_app/lib/widgets/`, likely new `youtube_channel_onboarding.dart` or integrated `youtube_connect_ui_states.dart`.
  - Action: Build a compact component with copy, CTA to YouTube channel creation/help, CTA/import input for playlist URL, success/error states, and quota-aware disabled state.
  - User story link: Turns the confusing missing-channel state into clear next actions.
  - Depends on: Task 5.
  - Validate with: Flutter analyze and manual desktop/mobile QA.
  - Notes: Do not make a large tutorial modal; keep it contextual and dismissible only after a clear action path remains.

- [x] Task 7: Wire onboarding into Playlists, Videos and Preferences.
  - File: `replayglowz_app/lib/screens/playlists/playlists_screen.dart`, `replayglowz_app/lib/screens/videos/videos_screen.dart`, `replayglowz_app/lib/screens/preferences/preferences_screen.dart`, `replayglowz_app/lib/widgets/youtube_connect_ui_states.dart`.
  - Action: Show the onboarding when YouTube is connected but playlists are empty, missing-channel was detected, or user is in Preferences YouTube connection area; allow import from Playlists empty state.
  - User story link: Gives users the explanation exactly where they hit the issue.
  - Depends on: Task 6.
  - Validate with: manual QA for connected empty account, missing-channel account, normal account and imported playlist account.
  - Notes: Normal accounts with playlists should not see the warning.

- [x] Task 8: Add EN/FR i18n copy.
  - File: `replayglowz_app/lib/i18n/en.dart`, `replayglowz_app/lib/i18n/fr.dart`, `replayglowz_app/lib/i18n/translations.dart`.
  - Action: Add keys for channel explanation, create-channel CTA, import-by-URL CTA/form, public/unlisted guidance, Watch Later unsupported, private/not found, duplicate import, partial import and success.
  - User story link: Keeps onboarding clear in both product languages.
  - Depends on: Tasks 6-7.
  - Validate with: Flutter analyze and source check for hard-coded new copy.
  - Notes: Copy must say creating a channel does not require publishing videos and does not change the ReplayGlowz account.

- [x] Task 9: Add regression tests and source checks.
  - File: `replayglowz_app/test/`, backend test location if available, `shipflow_data/workflow/audits/2026-05-26-youtube-edge-case-regression-checklist.md`.
  - Action: Cover URL parsing, source preservation, duplicate import, provider error mapping, i18n keys and edge checklist update.
  - User story link: Prevents recurring YouTube library edge-case regressions.
  - Depends on: Tasks 1-8.
  - Validate with: backend typecheck, Flutter analyze/tests, metadata lint.
  - Notes: Include `YT-EDGE-018` manual QA in final verification.

## Acceptance Criteria

- [ ] CA 1: Given YouTube is connected and automatic playlist discovery returns missing-channel/empty, when the user opens Playlists, then ReplayGlowz explains the channel requirement for automatic playlist sync and shows import-by-URL as an alternative.
- [ ] CA 2: Given the user clicks the create-channel CTA, when the target opens, then it leads to an official YouTube channel creation/help path without altering ReplayGlowz state.
- [ ] CA 3: Given the user pastes a valid public or non-repertorie playlist URL, when they import it, then the playlist and videos appear in Playlists and Videos.
- [ ] CA 4: Given a video URL contains a `list=...` parameter, when the user imports it, then ReplayGlowz extracts the playlist ID and imports the playlist.
- [ ] CA 5: Given the user imports the same playlist twice, when the second import completes, then cache entries are updated without duplicate playlist cards or duplicate videos.
- [ ] CA 6: Given an imported URL playlist exists, when automatic sync runs and `playlists.list mine=true` returns an empty list, then the imported playlist remains visible.
- [ ] CA 7: Given the user imports Watch Later or an unsupported special playlist, when the backend receives it, then the app shows a specific unsupported message and does not mutate cache.
- [ ] CA 8: Given a private or inaccessible playlist URL, when the user imports it, then the app explains public/non-repertorie requirement and does not mutate cache.
- [ ] CA 9: Given an import hits quota safety, when the backend stops, then the UI shows a partial/blocked state and preserves already imported data.
- [ ] CA 10: Given a normal account with a YouTube channel and owned playlists, when the user refreshes, then existing automatic playlist sync behavior still works.
- [ ] CA 11: Given a connected account with only subscriptions, when the user refreshes, then subscription feed sync remains independent from playlist URL import.
- [ ] CA 12: Given diagnostics are copied, when an unlisted playlist was imported, then diagnostics do not expose raw playlist URL or secrets.

## Test Strategy

- Static checks:
  - `(cd replayglowz_backend/packages/backend && npm run typecheck)`
  - `(cd replayglowz_app && flutter analyze)`
  - `(cd replayglowz_app && flutter test <targeted tests>)`
  - `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENTS.md shipflow_data`
- Backend tests:
  - URL parsing for `/playlist?list=...`, `/watch?v=...&list=...`, mobile URLs, invalid URLs, special IDs.
  - `updatePlaylistsCache` preserves imported and subscriptions entries.
  - Import action maps `playlistOperationUnsupported`, `playlistNotFound`, `playlistForbidden`, quota stop and duplicate import.
- Flutter tests:
  - Import form validation.
  - Empty-state/onboarding copy visibility.
  - i18n key presence for EN/FR.
- Manual QA:
  - Test account with YouTube UI playlist `FUN` and visible "Create channel" CTA.
  - Normal account with owned playlists.
  - Account with subscriptions but no owned playlists.
  - Invalid playlist URL.
  - Watch Later URL.
  - Duplicate playlist import.
  - Mobile viewport for onboarding component.

## Risks

- YouTube UI library behavior may not map cleanly to Data API resources; mitigate with URL import and provider-specific messages.
- Unlisted playlist URLs are sensitive; mitigate by masking logs/diagnostics and storing only necessary IDs.
- Imported playlists may be owned by another user; mitigate by treating URL imports as read-only unless ownership is proven later.
- Large playlist imports can burn quota; mitigate with bounded caps, metric logging and quota guards.
- Automatic owned sync currently has destructive cache behavior; fixing preservation is required before URL imports can ship.
- Copy could scare users into thinking they must become creators; mitigate with wording that channel creation does not require publishing videos.

## Execution Notes

- Read first:
  - `replayglowz_backend/packages/backend/convex/youtube.ts`
  - `replayglowz_backend/packages/backend/convex/schema.ts`
  - `replayglowz_app/lib/providers/mutations.dart`
  - `replayglowz_app/lib/screens/playlists/playlists_screen.dart`
  - `shipflow_data/workflow/audits/2026-05-26-youtube-edge-case-regression-checklist.md`
- Implement backend cache-source preservation before UI import, because otherwise imports can disappear after refresh.
- Prefer existing `youtubePlaylistsCache` and `youtubeVideosCache` over adding a parallel playlist store unless implementation proves the source marker is insufficient.
- Do not add new OAuth scopes unless official docs prove the current `youtube` scope cannot read public/unlisted playlist items by explicit ID.
- Do not use `search.list` for playlist import.
- Treat provider errors as product states, not crashes.
- Stop and reroute if implementation requires scraping YouTube UI, storing raw unlisted URLs in logs, or creating YouTube channels programmatically.

## Open Questions

None blocking for spec readiness. During implementation, verify whether the direct create-channel URL is stable enough for a CTA; if not, use the official YouTube Help page as the default CTA target.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-05-26 06:20:51 UTC | sf-spec | GPT-5 Codex | Created spec for YouTube channel onboarding and playlist URL import after API edge-case research and operator decision. | draft spec created | `/sf-ready replayglowz-youtube-channel-onboarding-playlist-url-import` |
| 2026-05-26 07:09:12 UTC | sf-ready | GPT-5 Codex | Reviewed structure, metadata, user-story fit, API freshness, task order, security, adversarial risks and quota bounds; fixed the import cap from ambiguous example to explicit 500 videos per execution. | ready | `/sf-start replayglowz-youtube-channel-onboarding-playlist-url-import` |
| 2026-05-26 07:10:00 UTC | sf-start | GPT-5 Codex + backend sub-agent | Implemented backend URL import, cache source preservation, Flutter onboarding/import UI, EN/FR copy and focused tests. | implemented locally; static checks passed | `/sf-verify replayglowz-youtube-channel-onboarding-playlist-url-import` |

## Current Chantier Flow

| Stage | Status | Notes |
|-------|--------|-------|
| sf-spec | complete | Spec created from YouTube API edge-case diagnosis and product decision to offer channel onboarding plus playlist URL import. |
| sf-ready | complete | Scope, copy promise, cache preservation, API constraints, security and quota bounds validated. |
| sf-start | complete | Backend URL import, cache preservation, Flutter onboarding, provider invalidation and tests implemented. |
| sf-verify | pending | Must retest edge cases including account with "Create channel" CTA and playlist `FUN` after deployment. |
| sf-end | pending | Update checklist and final QA matrix after implementation. |
| sf-ship | pending | Ship only after backend/app checks and hosted auth/browser QA. |
