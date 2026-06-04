---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-06-02"
created_at: "2026-06-02 21:52:34 UTC"
updated: "2026-06-02"
updated_at: "2026-06-02 21:52:34 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5.5 HIGH (requested via runtime)"
scope: "mobile-firebase-suite-auth-bridge"
owner: "Diane"
user_story: "En tant qu'utilisateur ReplayGlowz sur app Flutter native, je veux me connecter avec Firebase Auth, etre mappe vers mon identite suite et mon entitlement replayglowz via le bridge suite, afin d'acceder aux donnees ReplayGlowz et a YouTube OAuth seulement quand mon acces produit est verifie."
confidence: "medium"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "ReplayGlowz Flutter native app"
  - "ReplayGlowz Flutter web app"
  - "ReplayGlowz product Convex backend"
  - "ReplayGlowz Vercel YouTube OAuth handlers"
  - "WinFlowz suite identity bridge"
  - "WinFlowz suite entitlement ledger"
  - "Firebase Auth"
  - "Clerk"
  - "Convex"
  - "YouTube OAuth"
  - "GitHub Actions / Blacksmith Android CI"
depends_on:
  - artifact: "shipflow_data/workflow/specs/replayglowz-suite-auth-migration.md"
    artifact_version: "1.0.8"
    required_status: "ready"
  - artifact: "/home/claude/winflowz_app/shipflow_data/workflow/specs/unified-suite-authentication.md"
    artifact_version: "1.0.25"
    required_status: "active"
  - artifact: "/home/claude/winflowz_app/shipflow_data/workflow/specs/firebase-backend-agnostic-migration.md"
    artifact_version: "1.0.0"
    required_status: "ready"
  - artifact: "/home/claude/winflowz_app/docs/technical/suite-authentication.md"
    artifact_version: "1.0.9"
    required_status: "reviewed"
  - artifact: "replayglowz_app/AGENT.md"
    artifact_version: "1.3.0"
    required_status: "reviewed"
  - artifact: "replayglowz_app/CLAUDE.md"
    artifact_version: "1.1.0"
    required_status: "reviewed"
supersedes: []
evidence:
  - "ReplayGlowz web auth is currently ClerkJS through `replayglowz_app/lib/auth/auth_service.dart`, `lib/auth/clerk_js_bridge*.dart`, and `web/clerk_bridge.js`."
  - "ReplayGlowz native builds currently hit the non-web ClerkJS stub, which returns unauthenticated and cannot provide a Convex token."
  - "ReplayGlowz product Convex backend currently stores product data under `replayglowz_backend/packages/backend/convex` and is configured for Clerk Convex JWTs in `auth.config.ts`."
  - "ReplayGlowz app docs say product data stays in ReplayGlowz product Convex while identity and entitlements are suite-owned."
  - "WinFlowz app implements the requested native pattern through `FirebaseAuthSessionStore`, `SuiteIdentityBridgeClient`, `suiteIdentityProvider`, and fail-closed entitlement-gated store selection."
  - "WinFlowz suite auth pointer says Firebase Auth remains the active app adapter, Clerk is long-term suite identity, Firebase uid maps to `global_user_id`, and product access comes from server-owned entitlements."
  - "Official Firebase docs checked 2026-06-02: Flutter Auth exposes auth/id-token state and Firebase ID tokens can be sent to a backend for verification."
  - "Official Firebase Admin docs checked 2026-06-02: backend verification must validate Firebase ID token integrity and retrieve uid server-side; revocation checking is separate and must be enabled for disabled/revoked session rejection."
  - "Official Convex docs checked 2026-06-02: custom OIDC/JWT providers require exact issuer/audience matching; omitting audience verification is insecure."
next_step: "/sf-ready replayglowz-mobile-firebase-suite-auth-bridge"
---

# Title

ReplayGlowz Mobile Firebase Suite Auth Bridge

# Status

Ready for `/sf-ready`. The implementation path is fixed: ReplayGlowz web keeps ClerkJS as the web session owner, while native Flutter builds use Firebase Auth as the app adapter. Native Firebase sessions are mapped by a server-owned suite bridge to `global_user_id` and the `replayglowz` entitlement. Product data access and YouTube OAuth remain fail-closed until the server bridge and ReplayGlowz product Convex backend have both verified product access.

# User Story

En tant qu'utilisateur ReplayGlowz sur app Flutter native, je veux me connecter avec Firebase Auth, etre mappe vers mon identite suite et mon entitlement `replayglowz` via le bridge suite, afin d'acceder aux donnees ReplayGlowz et a YouTube OAuth seulement quand mon acces produit est verifie.

Acteur principal: utilisateur ReplayGlowz sur app Flutter native.

Acteurs secondaires:

- builder ReplayGlowz qui doit shipper une app native sans casser le web ClerkJS;
- WinFlowz suite bridge qui verifie Firebase ID tokens et resolve `global_user_id`;
- WinFlowz suite entitlement ledger qui decide `product_id=replayglowz`;
- ReplayGlowz product Convex qui garde videos, notes, playlists, transcripts, preferences, settings, snapshots et tokens YouTube;
- ReplayGlowz Vercel OAuth handlers qui lancent et finalisent YouTube OAuth;
- support operator qui doit diagnostiquer sans voir de token.

Declencheur: un utilisateur lance ReplayGlowz sur Android ou autre cible Flutter native, se connecte avec Firebase Auth, puis tente de charger des donnees produit ou de connecter YouTube.

Resultat observable attendu: la session Firebase native est reconnue localement, le bridge suite mappe cette session vers une identite globale et un entitlement `replayglowz`, ReplayGlowz product Convex accepte uniquement une session produit serveur-verifiee, et l'app refuse les donnees produit/YouTube OAuth quand le bridge, l'entitlement ou le backend produit ne sont pas disponibles.

# Minimal Behavior Contract

ReplayGlowz accepte deux chemins d'auth selon la plateforme. Sur web, le chemin existant ClerkJS reste inchangé et continue de fournir les tokens Clerk/Convex aux handlers web. Sur native, Firebase Auth est le seul proprietaire de session app; l'app recupere un Firebase ID token, l'envoie au bridge suite via HTTPS, et recoit seulement un snapshot redige plus un jeton produit court-terme quand le bridge a verifie le token, mappe le Firebase `uid` vers `global_user_id`, et confirme un entitlement `replayglowz` actif. ReplayGlowz product Convex verifie ce jeton produit ou un provider equivalent configure avec issuer/audience stricts, puis applique encore un check serveur d'access snapshot avant toute lecture ou mutation privee. Si une etape echoue, l'app garde la session Firebase comme "account recognized" mais n'accede pas aux donnees produit, ne lance pas YouTube OAuth, ne fait pas de merge email, ne loggue aucun token et ne fait jamais confiance a un entitlement client.

L'edge case facile a rater est le split-brain utilisateur: un Firebase `uid`, un Clerk user id et un `global_user_id` peuvent representer la meme personne, mais l'app native ne doit ni creer un second espace produit par email, ni accorder l'acces par simple presence du compte Firebase.

# Success Behavior

- Given un utilisateur ouvre l'app native sans session, when il choisit sign-in, then ReplayGlowz utilise Firebase Auth natif et non ClerkJS.
- Given Firebase sign-in reussit, when l'app recoit une session Firebase, then elle envoie un Firebase ID token au bridge suite et attend le resultat avant de selectionner les stores Convex distants.
- Given le bridge suite reconnait le Firebase `uid`, resolve `global_user_id`, et trouve un entitlement `replayglowz` actif, when l'app configure Convex, then elle utilise le jeton produit serveur-verifie et peut lire/muter les donnees produit autorisees.
- Given la session Firebase est valide mais l'entitlement `replayglowz` est absent, revoked, expired ou inconnu, when l'utilisateur ouvre une route protegee, then l'app affiche un etat "account recognized, product access inactive" et ne charge aucune donnee privee.
- Given le bridge suite est indisponible, mal configure ou retourne un schema inattendu, when l'utilisateur est connecte a Firebase, then l'app reste fail-closed et expose seulement des diagnostics rediges.
- Given l'utilisateur autorise tente YouTube OAuth sur native, when l'app demande le start URL, then ReplayGlowz product backend ou Vercel verifie la session produit et l'entitlement avant de rediriger vers Google.
- Given l'utilisateur se deconnecte de Firebase native, when l'etat auth change, then l'app efface le jeton produit Convex, invalide l'access snapshot local et renvoie les routes protegees vers l'etat signed-out.

# Error Behavior

- Firebase config native absente: l'app native affiche "native sign-in not configured" et ne tente pas ClerkJS.
- Firebase provider mal configure: l'app affiche une erreur recuperable avec code provider redige; aucune donnee produit n'est lue.
- Firebase ID token absent, expire, mauvais `aud`, mauvais `iss`, revoked ou disabled: le bridge suite refuse et l'app reste sans acces produit.
- Bridge suite absent, secret manquant, JSON invalide ou HTTP non-200: la session Firebase reste locale; `global_user_id`, entitlement et token produit restent absents.
- Entitlement absent ou inactif: aucune lecture/mutation privee, aucune creation de token YouTube, aucun fallback free cote client.
- ReplayGlowz product Convex auth provider non deploye ou issuer/audience mismatch: Convex calls echouent en 401/403; l'app ne bascule pas vers une API non protegee.
- YouTube OAuth start/callback sans session produit verifiee: 401/403/503 redige, cookies/tickets temporaires nettoyes.
- Duplicate email entre Firebase et Clerk: ouvrir un etat linking/support explicite; aucun merge email-only.

# Problem

ReplayGlowz web a ete migre vers ClerkJS pour respecter la suite WinFlowz: Clerk reste l'identite web centrale, WinFlowz garde les entitlements, et ReplayGlowz product Convex garde les donnees produit. Ce chemin ne marche pas comme cible native parce que `clerk_js_bridge_stub.dart` est explicitement non-web et ne peut pas fournir de session ou de token Convex aux builds Android.

WinFlowz app a deja formalise le modele cible pour les apps Flutter natives: Firebase Auth est l'adaptateur app, un bridge serveur mappe Firebase `uid` vers `global_user_id`, et les stores produit restent fail-closed tant que le snapshot suite ne grant pas le product id. ReplayGlowz doit adopter le meme modele sans revenir a Firebase web, sans deplacer ses donnees produit dans WinFlowz, et sans faire confiance a des entitlements client.

# Solution

Ajouter un adaptateur auth natif ReplayGlowz base sur Firebase Auth et reutiliser le pattern WinFlowz `FirebaseAuthSessionStore` + `SuiteIdentityBridgeClient` + `suiteIdentityProvider`, adapte au product id `replayglowz`. Le bridge suite verifie les Firebase ID tokens cote serveur, resout ou cree le mapping suite auditable, verifie l'entitlement, puis emet un snapshot redige et un jeton produit court-terme accepte par ReplayGlowz product Convex.

Le backend produit ReplayGlowz ajoute un chemin d'auth mobile distinct du chemin web ClerkJS, avec issuer/audience stricts et checks d'access snapshot cote serveur. Le client natif ne choisit les providers Convex distants et ne lance YouTube OAuth qu'apres validation serveur. Le web ClerkJS path, les handlers web actuels et le product Convex data boundary sont explicitement preserves.

# Scope In

- Ajouter un chemin auth natif Flutter pour Android actuel, avec interfaces Dart partageables pour futures cibles natives.
- Ajouter `firebase_core`, `firebase_auth`, `google_sign_in` et configuration Firebase native uniquement pour les builds non-web.
- Garder `AuthState` SDK-neutral et separer l'auth owner par plateforme: ClerkJS web, Firebase native.
- Ajouter une configuration `SUITE_IDENTITY_BRIDGE_URL` native et un client bridge inspire de WinFlowz app.
- Etendre le bridge suite pour accepter Firebase ID tokens ReplayGlowz, verifier revocation/disabled state, mapper vers `global_user_id`, verifier `product_id=replayglowz`, et retourner un snapshot redige.
- Ajouter un jeton produit court-terme ou provider equivalent accepte par ReplayGlowz product Convex avec issuer/audience stricts.
- Adapter `ConvexService.setAuth` non-web pour utiliser le token produit serveur-verifie, pas un token Firebase brut non mappe.
- Ajouter ou ajuster `productAccessSnapshots`/helpers Convex pour lier Firebase account, Clerk account et `global_user_id` sans deplacer les donnees produit hors ReplayGlowz product Convex.
- Gate native private reads/mutations and YouTube OAuth on server-verified product access.
- Mettre a jour Android CI/build variables, docs app et diagnostics rediges.

# Scope Out

- Ne pas remplacer le chemin web ClerkJS.
- Ne pas reintroduire Firebase Auth comme proprietaire de session web.
- Ne pas utiliser `clerk_flutter` ou Clerk natif comme cible production mobile.
- Ne pas deplacer videos, notes, playlists, transcripts, preferences, settings, snapshots ou tokens YouTube vers WinFlowz suite Convex.
- Ne pas faire de ReplayGlowz product Convex la source de verite des entitlements.
- Ne pas accorder un acces produit par simple compte Firebase, email, domaine email, local cache ou claim client.
- Ne pas faire de merge email-only entre comptes Firebase et Clerk.
- Ne pas creer de nouveaux grants `tubeflow`; `replayglowz` reste le product id canonique.
- Ne pas ajouter iOS release/App Store, keystore release, pricing ou achat in-app dans ce chantier.
- Ne pas changer les scopes YouTube OAuth sauf bug bloquant prouve.

# Constraints

- Un seul proprietaire de session par runtime: ClerkJS sur web, Firebase Auth sur native.
- Firebase native est un adaptateur, pas l'autorite d'entitlement.
- Le bridge suite et le backend produit doivent verifier les tokens cote serveur.
- Product access is denied by default.
- Entitlements sont serveur-owned; le client ne peut fournir ni `global_user_id`, ni `product_id`, ni status d'entitlement de confiance.
- ReplayGlowz product Convex reste l'autorite des donnees produit.
- WinFlowz suite bridge/ledger reste l'autorite de `global_user_id` et des entitlements.
- Audience and issuer checks are mandatory for Convex auth providers.
- Session/access tokens, Firebase ID tokens, OAuth codes, YouTube access/refresh tokens and bridge secrets must never be logged, screenshotted, stored in diagnostics, or committed.
- Environment separation is mandatory: local, preview, CI, production and native OAuth callbacks cannot share secrets accidentally.

# Test Contract

Surface/stack profile: Flutter native Android, Flutter web preservation, Firebase Auth, HTTP suite bridge, Convex product backend, Vercel YouTube OAuth, GitHub Actions/Blacksmith.

Automated proof required:

- `cd replayglowz_app && flutter analyze`
- `cd replayglowz_app && flutter test`
- `cd replayglowz_app && dart run tool/check_shared_backend_contract.dart`
- `cd replayglowz_app && node --test api/auth/_youtube.test.js`
- `cd replayglowz_backend/packages/backend && npm run typecheck`
- Native auth/bridge unit tests for Firebase token missing, bridge unavailable, no entitlement, active entitlement, revoked entitlement, sign-out token clearing.
- Product Convex tests or focused script proving missing/invalid/mobile token rejects and active suite product token accepts only the right user.

Manual/provider proof required:

- GitHub Actions Android debug APK build with Firebase native config and suite bridge URL.
- Android real-device smoke: sign-in, session restore, bridge fail-closed, entitlement active, entitlement inactive, logout.
- YouTube OAuth native smoke after product access verification, including denied start before access and callback persistence after access.
- Web regression smoke on `https://app.replayglowz.com`: ClerkJS sign-in still works and Firebase native code is not required for web first paint.

Proof order: static/typecheck -> unit/contract tests -> backend auth deploy proof -> Android CI build -> Android device smoke -> web ClerkJS regression -> YouTube OAuth smoke -> production verification.

# Dependencies

## Local Dependencies

- `shipflow_data/workflow/specs/replayglowz-suite-auth-migration.md`: web ClerkJS path and two-Convex boundary to preserve.
- `/home/claude/winflowz_app/docs/technical/suite-authentication.md`: Firebase native adapter + suite bridge + fail-closed entitlement pattern.
- `/home/claude/winflowz_app/lib/core/bootstrap/firebase_bootstrap.dart`: Firebase runtime config pattern.
- `/home/claude/winflowz_app/lib/features/auth/data/firebase_auth_session_store.dart`: Firebase native session store pattern.
- `/home/claude/winflowz_app/lib/features/auth/data/suite_identity_bridge_client.dart`: bridge client parsing and conservative fail-closed pattern.
- `/home/claude/winflowz_app/lib/features/auth/application/suite_identity_provider.dart`: provider composition pattern.
- `replayglowz_app/lib/auth/auth_service.dart`: current ClerkJS web owner to split by platform.
- `replayglowz_app/lib/auth/clerk_js_bridge_stub.dart`: current non-web unsupported path.
- `replayglowz_app/lib/convex/convex_client.dart`: non-web Convex token refresh hook.
- `replayglowz_app/lib/providers/providers.dart`: `productAccessStatusProvider` and private provider gating surface.
- `replayglowz_app/lib/widgets/youtube_connect.dart`: YouTube OAuth start gate.
- `replayglowz_app/api/auth/youtube.js` and `api/auth/youtube/callback.js`: OAuth server path that must accept only verified product sessions.
- `replayglowz_backend/packages/backend/convex/auth.config.ts`: add mobile product token provider while preserving Clerk provider.
- `replayglowz_backend/packages/backend/convex/users.ts`: product access status and snapshot mapping.
- `replayglowz_backend/packages/backend/convex/schema.ts`: product access/account mapping schema.
- `.github/workflows/replayglowz-app-android.yml`: native build config and artifact proof.

## Fresh External Docs Checked

- Firebase Flutter Auth docs, checked 2026-06-02: Flutter Firebase Auth provides auth state and ID token change streams, and tokens can be force refreshed before sending to a backend. Source: https://firebase.google.com/docs/auth/flutter/start
- Firebase Admin verify ID tokens docs, checked 2026-06-02: backend verification retrieves Firebase `uid` from a valid ID token; ID token revocation checking is not automatic and must be handled when disabled/revoked sessions matter. Source: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Convex custom OIDC provider docs, checked 2026-06-02: Convex auth config must match issuer/domain and applicationID/audience exactly, and multiple providers can be configured. Source: https://docs.convex.dev/auth/advanced/custom-auth
- Convex custom JWT provider docs, checked 2026-06-02: custom JWT provider supports issuer/JWKS/algorithm and warns that omitting audience verification is often insecure. Source: https://docs.convex.dev/auth/advanced/custom-jwt

Fresh-docs verdict: `fresh-docs checked`.

# Invariants

- Authenticated Firebase user is not ReplayGlowz product access.
- Authenticated Clerk user on web is not product access unless server access status allows it.
- Product access is checked server-side before private data and YouTube OAuth.
- Native Firebase ID token is bridge evidence only; it is not a client-trusted entitlement.
- Product data remains in ReplayGlowz product Convex.
- Suite identity and entitlements remain in WinFlowz suite.
- Web ClerkJS route and native Firebase route are platform-specific, not fallback chains.
- No email-only merge.
- No client-trusted entitlement.
- No token logging.

# Links & Consequences

- Adding Firebase dependencies affects native builds, Android Gradle config, CI secrets and potentially Flutter web dependency resolution; web must remain unaffected at runtime.
- `AuthService` likely needs an interface split such as `AuthSessionAdapter` with `WebClerkAuthAdapter` and `NativeFirebaseAuthAdapter`.
- Product Convex user identity may need a canonical product user mapping that supports Clerk account id, Firebase account id and `global_user_id`; this must be implemented before native writes can share data with existing web users.
- If product data remains keyed by provider-specific subject only, native users will create duplicate product spaces. That is not acceptable for this spec.
- The suite bridge checkout is not present under `/home/claude/winflowz` in this workspace; implementation must either operate in the actual suite repo when available or document/deploy the bridge change through the owning chantier.
- Android CI currently passes Clerk publishable key into native builds; this must be replaced or demoted for native auth so Android does not depend on ClerkJS config.
- YouTube OAuth has server/callback constraints. Native start must use a short-lived server ticket or product session token, not a raw Firebase token in query strings or logs.

# Documentation Coherence

Update after implementation:

- `replayglowz_app/README.md`: native Firebase auth setup, bridge URL, Android CI secrets, and web ClerkJS preservation.
- `replayglowz_app/AGENT.md`: add platform-specific auth owner and native fail-closed bridge rules.
- `replayglowz_app/CLAUDE.md`: add Firebase native risk areas and validation commands.
- `replayglowz_app/.env.example`: add native Firebase dart-defines and `SUITE_IDENTITY_BRIDGE_URL`; keep Clerk vars clearly web-owned.
- `replayglowz_app/CHANGELOG.md`: note native auth bridge when shipped.
- `shipflow_data/technical/apps/replayglowz_app/architecture.md` if it exists and maps app auth/data contracts.
- WinFlowz suite docs only through the suite owner path; do not fork canonical suite auth decisions in ReplayGlowz docs.

# Edge Cases

- Firebase native sign-in succeeds, but bridge URL is absent in Android CI.
- Firebase token is valid but belongs to the wrong Firebase project.
- Firebase user is disabled/revoked after session restore.
- Firebase user and Clerk user share an email but are not linked in suite identity.
- Suite bridge returns `global_user_id` but no `replayglowz` entitlement.
- Suite bridge returns active entitlement but product Convex token provider is not deployed.
- Product Convex accepts the token but no product user mapping exists yet.
- Existing web user has product data keyed by Clerk id; native user resolves to same `global_user_id`.
- Product access snapshot expires while the app is open.
- YouTube OAuth callback completes after Firebase sign-out.
- Android build config contains stale Clerk-only vars but missing Firebase config.
- Web build accidentally imports `firebase_auth` native path or waits for Firebase config.

# Implementation Tasks

- [ ] Tache 1 : Introduce platform-specific auth adapter contract
  - Fichiers : `replayglowz_app/lib/auth/auth_service.dart`, `replayglowz_app/lib/auth/auth_state.dart`, new `replayglowz_app/lib/auth/auth_session_adapter.dart`
  - Action : Split auth ownership behind a Dart interface. Web keeps ClerkJS. Native selects Firebase adapter based on `kIsWeb`/platform without making ClerkJS a native fallback.
  - Depends on : none.
  - Validate with : unit tests for platform adapter selection and `flutter analyze`.
  - Notes : Keep `AuthUser` provider-neutral; do not store entitlement on `AuthUser`.

- [ ] Tache 2 : Add Firebase native bootstrap and dependencies
  - Fichiers : `replayglowz_app/pubspec.yaml`, `replayglowz_app/lib/core/bootstrap/firebase_bootstrap.dart`, `replayglowz_app/android/**`, `replayglowz_app/.env.example`
  - Action : Add Firebase native runtime config following WinFlowz pattern, initialize only on non-web, and keep missing config fail-closed.
  - Depends on : Tache 1.
  - Validate with : `flutter pub get`, `flutter analyze`, Android debug build.
  - Notes : No service account/admin secret in Flutter code or Android resources.

- [ ] Tache 3 : Implement native Firebase auth adapter
  - Fichiers : `replayglowz_app/lib/auth/firebase_auth_adapter.dart`, `replayglowz_app/lib/auth/auth_service.dart`, tests under `replayglowz_app/test/`
  - Action : Implement current session, auth state stream, Google/email sign-in if configured, sign-out, Firebase ID token resolver, and redacted failures.
  - Depends on : Tache 2.
  - Validate with : adapter tests using fakes and `flutter test`.
  - Notes : Do not send raw Firebase errors to user-facing diagnostics without sanitizing.

- [ ] Tache 4 : Add ReplayGlowz suite identity bridge client
  - Fichiers : `replayglowz_app/lib/auth/suite_identity_bridge_client.dart`, `replayglowz_app/lib/auth/suite_identity.dart`, `replayglowz_app/lib/auth/product_entitlement.dart`, `replayglowz_app/lib/app/build_info.dart`
  - Action : Port the WinFlowz bridge client pattern, parse `globalUserId`, provider accounts, entitlements and optional product token, and return conservative snapshots on every failure.
  - Depends on : Tache 3.
  - Validate with : tests for missing config, network failure, invalid JSON, active entitlement, revoked entitlement and malformed token fields.
  - Notes : `ProductId` must include canonical `replayglowz`; `tubeflow` is legacy only.

- [ ] Tache 5 : Extend suite bridge server contract for ReplayGlowz native
  - Fichiers : suite repo bridge endpoint such as `/api/bridge/firebase` or `/api/bridge/replayglowz/native`, suite Convex bridge functions, suite auth docs
  - Action : Verify Firebase ID tokens with Firebase Admin and revocation checks, require expected Firebase project/audience, map Firebase uid to `global_user_id`, verify `product_id=replayglowz`, and return a redacted snapshot plus short-lived product Convex JWT or equivalent product token.
  - Depends on : Tache 4.
  - Validate with : server tests for missing token, wrong project, revoked user, duplicate email/linking required, no entitlement, active entitlement, and redaction.
  - Notes : Server owns mapping and token issuance; client cannot choose `global_user_id` or entitlement.

- [ ] Tache 6 : Add mobile product token provider to ReplayGlowz product Convex
  - Fichiers : `replayglowz_backend/packages/backend/convex/auth.config.ts`, `convex/users.ts`, `convex/schema.ts`, `convex/utils.ts`
  - Action : Preserve Clerk provider and add a suite-issued custom JWT/OIDC provider for native product sessions with strict issuer/audience. Add user/account mapping for Clerk id, Firebase uid and `global_user_id`.
  - Depends on : Tache 5.
  - Validate with : backend typecheck and auth contract tests/scripts.
  - Notes : Do not accept Firebase tokens directly unless the issuer/audience and global identity mapping still preserve suite ownership; preferred path is suite-issued product token.

- [ ] Tache 7 : Gate product access server-side in product Convex
  - Fichiers : `replayglowz_backend/packages/backend/convex/users.ts`, shared auth/access helper modules, private function modules as needed
  - Action : Require active server access snapshot for private reads/mutations and return explicit denied/unavailable states for native and web.
  - Depends on : Tache 6.
  - Validate with : missing auth, inactive entitlement, expired snapshot and active entitlement tests.
  - Notes : Client UI gates are not sufficient acceptance proof.

- [ ] Tache 8 : Wire native Convex auth and provider selection
  - Fichiers : `replayglowz_app/lib/main.dart`, `replayglowz_app/lib/convex/convex_client.dart`, `replayglowz_app/lib/providers/providers.dart`
  - Action : For native, set Convex auth from the suite product token returned/refreshed by bridge. Keep web using ClerkJS Convex token. Refuse remote providers while access is loading/unavailable/inactive.
  - Depends on : Taches 4, 6, 7.
  - Validate with : provider tests and native smoke.
  - Notes : Clear token provider on sign-out and bridge failure.

- [ ] Tache 9 : Preserve and test web ClerkJS path
  - Fichiers : `replayglowz_app/lib/auth/clerk_js_bridge*.dart`, `web/clerk_bridge.js`, `lib/main.dart`, `vercel.json`
  - Action : Add regression tests/source checks ensuring web still uses ClerkJS and does not require Firebase native config for first paint/sign-in.
  - Depends on : Taches 1, 2.
  - Validate with : `flutter build web`, hosted web smoke after ship.
  - Notes : This task is mandatory because the user explicitly requires preserving web ClerkJS.

- [ ] Tache 10 : Add native YouTube OAuth start gating
  - Fichiers : `replayglowz_app/lib/widgets/youtube_connect.dart`, `replayglowz_app/api/auth/youtube.js`, product backend ticket/session helper
  - Action : Native app must request a short-lived OAuth start ticket or use the suite product token before opening Google OAuth. Vercel handler verifies product access server-side before redirect.
  - Depends on : Taches 7 and 8.
  - Validate with : Node tests for native ticket missing/expired/denied/active and device smoke.
  - Notes : No Firebase ID token in URL, cookie value, local logs or diagnostics.

- [ ] Tache 11 : Complete native YouTube OAuth callback handling
  - Fichiers : `replayglowz_app/api/auth/youtube/callback.js`, `replayglowz_app/android/app/src/main/AndroidManifest.xml`, Flutter route/deep-link handling if selected
  - Action : Persist tokens only after product session/access revalidation, clean temporary state, and return the user to app/web with a recoverable status.
  - Depends on : Tache 10.
  - Validate with : callback tests and Android smoke.
  - Notes : If deep link support is implemented, restrict schemes/hosts and document Google OAuth redirect configuration.

- [ ] Tache 12 : Update Android CI and build contracts
  - Fichiers : `.github/workflows/replayglowz-app-android.yml`, `replayglowz_app/build.sh` if shared vars change, `replayglowz_app/README.md`
  - Action : Replace native Clerk-required config with Firebase native config plus suite bridge URL; keep Clerk vars only where web build needs them.
  - Depends on : Taches 2 and 4.
  - Validate with : GitHub manual workflow debug APK artifact.
  - Notes : CI must fail clearly if native Firebase or bridge config is missing.

- [ ] Tache 13 : Update docs and support diagnostics
  - Fichiers : `replayglowz_app/README.md`, `AGENT.md`, `CLAUDE.md`, `.env.example`, `CHANGELOG.md`, technical architecture docs
  - Action : Document platform-specific auth owners, bridge fail-closed rules, product Convex boundary, no email-only merge, no client-trusted entitlement and no token logging.
  - Depends on : Taches 1 a 12.
  - Validate with : source review and metadata lint if governance docs are touched.

- [ ] Tache 14 : End-to-end verification
  - Fichiers : deployment surfaces and test evidence logs
  - Action : Run local checks, backend checks, Android CI, Android real-device auth/access/OAuth smoke, and web ClerkJS regression.
  - Depends on : all previous tasks.
  - Validate with : `/sf-verify replayglowz-mobile-firebase-suite-auth-bridge`.

# Acceptance Criteria

- [ ] CA 1 : Given ReplayGlowz runs on web, when the app boots and signs in, then it still uses ClerkJS and does not require Firebase native configuration.
- [ ] CA 2 : Given ReplayGlowz runs on Android, when the app boots, then it selects Firebase Auth as the session owner and does not call ClerkJS.
- [ ] CA 3 : Given Firebase native sign-in succeeds, when the app asks for suite identity, then it sends a Firebase ID token only over HTTPS to the bridge and never logs it.
- [ ] CA 4 : Given bridge verification fails or is unavailable, when the user is signed in locally, then product data and YouTube OAuth remain unavailable.
- [ ] CA 5 : Given bridge verification succeeds but no active `replayglowz` entitlement exists, when a protected screen loads, then no private product data is fetched and the inactive-access state is shown.
- [ ] CA 6 : Given bridge verification succeeds with active `replayglowz` entitlement, when the app calls ReplayGlowz product Convex, then Convex verifies a suite-issued product token or equivalent server-authenticated provider and permits only the mapped product user.
- [ ] CA 7 : Given a user has existing web product data linked through Clerk and the same suite `global_user_id`, when they sign in natively through Firebase, then they access the same product user mapping without email-only merge.
- [ ] CA 8 : Given native sign-out occurs, when routes/providers refresh, then product token, access snapshot and Convex auth are cleared.
- [ ] CA 9 : Given YouTube OAuth is started on native, when session or entitlement is missing, then the start handler returns a redacted deny response and does not redirect to Google.
- [ ] CA 10 : Given YouTube OAuth completes for an authorized native user, when callback persists tokens, then tokens are stored only in ReplayGlowz product Convex under the mapped product user.
- [ ] CA 11 : Given logs, diagnostics, tests and screenshots are reviewed, then no Firebase ID token, suite token, Convex token, OAuth code, YouTube token or bridge secret is present.
- [ ] CA 12 : Given implementation is complete, when validation runs, then `flutter analyze`, `flutter test`, YouTube Node tests, backend typecheck, Android debug APK build and web regression smoke pass or have documented blocking evidence.

# Test Strategy

- Unit tests: Firebase adapter state mapping, token resolver, sign-out clearing, bridge client parsing and redaction.
- Provider tests: native product access loading/denied/active/unavailable states; web ClerkJS unchanged.
- Backend contract tests: suite bridge token verification, entitlement lookup and token issuance; product Convex auth/provider mapping and access enforcement.
- OAuth tests: native start ticket/product token denied, expired, accepted; callback state mismatch and authorized persistence.
- Static checks: `flutter analyze`, `flutter test`, `node --test api/auth/_youtube.test.js`, backend `npm run typecheck`.
- CI proof: manual Android debug APK workflow on Blacksmith with artifact.
- Manual QA: Android real device sign-in, session restore, inactive entitlement, active entitlement, logout, YouTube OAuth, and web ClerkJS regression.
- Redaction proof: search logs and test fixtures for JWT-looking strings and OAuth secrets before final ship.

# Risks

- High: provider-specific user ids can fork product data unless `global_user_id` mapping is implemented before native writes.
- High: accepting Firebase ID tokens directly in product Convex without suite mapping would bypass the suite identity contract.
- High: missing audience verification on custom JWT/OIDC provider can allow token replay across services.
- High: bridge outage could accidentally become an access grant if UI treats Firebase sign-in as enough.
- High: YouTube OAuth tokens are sensitive and must not cross client logs or URL query strings.
- Medium: Firebase native dependencies can increase web build complexity if imports are not platform-gated.
- Medium: Android CI may pass buildability while provider config still fails on a real device.
- Medium: current WinFlowz app `ProductId` enum still has legacy `tubeflow`; ReplayGlowz native bridge must use `replayglowz` canon.
- Medium: no `/home/claude/winflowz` checkout is present locally, so suite bridge implementation requires the actual suite repo or owning workflow.

# Execution Notes

- Execution batches are sequential. Do not run backend bridge, product Convex, app native wiring and OAuth implementation as unsafe parallel batches because each later stage depends on the token/access contract from the previous stage.
- Batch 1: App auth foundation, Firebase native bootstrap, bridge client, adapter tests.
- Batch 2: Suite bridge server contract and suite-issued product token.
- Batch 3: Product Convex mobile auth provider, global identity/product user mapping, server access gates.
- Batch 4: Native app Convex wiring, product access UI, Android CI config.
- Batch 5: Native YouTube OAuth ticket/callback flow.
- Batch 6: Docs, Android device QA, web ClerkJS regression, verification.
- Stop if product Convex cannot verify a server-issued mobile product token with strict issuer/audience.
- Stop if the only available implementation would trust client-provided entitlement or merge users by email.
- Stop if web ClerkJS sign-in regresses.

# Open Questions

None. The user request and local WinFlowz architecture provide the material decisions: Firebase Auth native adapter, suite bridge identity/entitlement mapping, fail-closed product access, web ClerkJS preservation, product Convex data boundary, no email-only merge, no client-trusted entitlement and no token logging.

# Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-06-02 21:52:34 UTC | sf-spec | GPT-5.5 HIGH (requested via runtime) | Created ready spec for ReplayGlowz native mobile Firebase auth adapter, suite identity/entitlement bridge, fail-closed product access, web ClerkJS preservation and product Convex boundary. | ready | `/sf-ready replayglowz-mobile-firebase-suite-auth-bridge` |
| 2026-06-02 22:02:00 UTC | sf-ready | GPT-5 Codex | Evaluated readiness after spec creation against ShipFlow lifecycle gates, existing suite-auth constraints, execution batches and security stop conditions. | ready: the spec is implementable in sequential batches without new user decisions; Batch 1 can start while later backend/bridge batches remain gated by their own proof. | `/sf-start replayglowz-mobile-firebase-suite-auth-bridge batch-1` |
| 2026-06-02 22:12:00 UTC | sf-build | GPT-5 Codex + GPT-5.3 Codex Spark worker + GPT-5.5 explorer | Implemented Batch 1 app-side native Firebase auth foundation, Android CI config, fail-closed bridge client, tests and docs; corrected native Convex token fallback to require active ReplayGlowz entitlement plus suite product token. | partial: Batch 1 complete and local app checks pass; local APK build is blocked by this aarch64 server having x86-64 Android AAPT2 binaries; Batch 2 suite bridge/product token is blocked from this run because `/home/claude/winflowz` has unrelated dirty work and the existing suite bridge does not yet emit a ReplayGlowz product token. | Run Blacksmith Android workflow for x64 APK proof, then clean or isolate WinFlowz suite bridge work and implement Batch 2 product token contract. |
| 2026-06-02 23:02:00 UTC | continue | GPT-5 Codex + GPT-5.3 Codex Spark worker | Continued the chantier by implementing the WinFlowz suite ReplayGlowz product token bridge and ReplayGlowz Convex custom JWT provider configuration. | partial: Batch 2 bridge product token is implemented and validated; ReplayGlowz backend typecheck passes. Remaining proof requires deployed env keys/JWKS, Blacksmith APK build, and end-to-end Firebase-to-Convex smoke. | Configure RS256 JWT env/JWKS and run deployed bridge + Android CI proof. |
| 2026-06-03 04:57:00 UTC | sf-build | GPT-5 Codex | Continued implementation after user escalation: replaced YouTube OAuth raw session-token callback cookie with an encrypted short-lived OAuth ticket, documented the ticket secret, and retested app/backend/bridge surfaces. | partial: native/web YouTube OAuth start/callback code is implemented and unit-tested fail-closed; remaining proof requires deployed secrets, Blacksmith APK build, and real provider smoke. | Configure secrets and run deployed smoke + Blacksmith workflow. |

# Current Chantier Flow

| Skill | Status | Evidence | Next |
|-------|--------|----------|------|
| sf-spec | done | This spec defines user story, behavior contract, scope, constraints, dependencies, tasks, acceptance criteria, validation, risks and sequential execution batches. | sf-ready |
| sf-ready | ready | Readiness gate passed: no open product decision, safe sequential batches, and explicit stop conditions for backend/bridge proof. | sf-start |
| sf-start | partial | Batch 1 completed in ReplayGlowz app; Batch 2 completed in WinFlowz suite bridge; ReplayGlowz backend now has an optional RS256 custom JWT provider; YouTube OAuth start/callback now uses an encrypted short-lived handoff ticket instead of a raw session-token cookie. | deployed env/JWKS + provider smoke |
| sf-verify | partial | `flutter analyze`, `flutter test`, `node --test api/auth/_youtube.test.js`, workflow YAML parse, metadata lint, ReplayGlowz backend `npm run typecheck`, WinFlowz `pnpm vitest run tests/bridge/suiteBridge.test.ts tests/middleware/authRouting.test.ts`, and WinFlowz `pnpm build:check` pass locally. Local APK debug build reaches Android resource processing but cannot execute AAPT2 because this server is `aarch64` and installed AAPT2 binaries are `x86-64`. | complete Android build proof on Blacksmith x64 and deployed bridge/JWKS proof |
| sf-end | pending | Closure not started. | after sf-verify |
| sf-ship | pending | Shipping not started. | after sf-end |
