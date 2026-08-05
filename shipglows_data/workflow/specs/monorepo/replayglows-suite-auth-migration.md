---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.8"
project: "replayglows"
created: "2026-05-23"
created_at: "2026-05-23 13:11:10 UTC"
updated: "2026-05-24"
updated_at: "2026-05-24 08:26:24 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "suite-auth-migration"
owner: "Diane"
user_story: "En tant que builder de la suite WinFlowz, je veux que ReplayGlows utilise l'identite suite Clerk et les entitlements serveur, afin qu'un utilisateur retrouve le meme compte entre WinFlows et ReplayGlows sans recevoir un acces produit implicite."
confidence: "medium"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "ReplayGlows Flutter web app"
  - "ReplayGlows Vercel API handlers"
  - "WinFlowz suite identity"
  - "WinFlowz suite Convex entitlement ledger"
  - "ReplayGlows product Convex backend"
  - "WinFlowz Formation / winflows.com"
  - "Clerk"
  - "Convex"
  - "YouTube OAuth"
  - "Vercel"
depends_on:
  - artifact: "/home/claude/shipglows_data/projects/winflowz/docs/technical/suite-authentication.md"
    artifact_version: "1.0.10"
    required_status: "reviewed"
  - artifact: "/home/claude/shipglows_data/projects/winflowz/docs/technical/suite-authentication-support-runbook.md"
    artifact_version: "1.0.1"
    required_status: "reviewed"
  - artifact: "/home/claude/winflowz_app/shipglows_data/workflow/specs/unified-suite-authentication.md"
    artifact_version: "1.0.25"
    required_status: "active"
  - artifact: "/home/claude/shipglows_data/specs/master-auth-playbook.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "app/CLAUDE.md"
    artifact_version: "1.0.0"
    required_status: "reviewed"
supersedes: []
evidence:
  - "ReplayGlows production auth fails after Firebase initialization with `[firebase_auth/internal-error] Error` on `signInWithPopup`."
  - "ReplayGlows live build `ba77161` exposes auth diagnostics and confirms Firebase initializes before the Google popup failure."
  - "ReplayGlows currently uses Firebase Auth as the web session owner in `app/lib/auth/auth_service.dart`."
  - "ReplayGlows currently passes Firebase ID tokens to Convex and to `/api/auth/youtube` for YouTube OAuth handoff."
  - "WinFlowz suite auth decision says Clerk is the long-term central identity provider and Firebase is only the Android app adapter for now."
  - "Convex official docs state Clerk auth requires backend auth provider config and deployment after adding the provider."
  - "Clerk official docs state satellite domains can share auth state with a primary domain, but this is an advanced workflow."
  - "User clarification 2026-05-23: ReplayGlows must keep a product-specific Convex backend for YouTube videos, notes, playlists, transcripts, preferences and OAuth product data; only identity and entitlements are centralized through Clerk and the WinFlowz suite ledger."
  - "User correction 2026-05-23: TubeFlow is no longer the active product name; `replayglows` is the canonical product id for new entitlements, and `tubeflow` may only appear as a legacy alias/migration input."
  - "Local evidence: `/home/claude/winflowz/convex` contains the active suite identity and entitlement ledger; the ReplayGlows product Convex backend has been migrated into `backend/packages/backend/convex`."
  - "Local evidence 2026-05-23: `/home/claude/winflowz/src/pages/api/bridge/entitlement.ts` exposes the suite verifier for Clerk session tokens and `product_id=replayglows` with `tubeflow` as legacy alias only."
  - "Local evidence 2026-05-23: ReplayGlows Vercel OAuth handlers call `SUITE_ENTITLEMENT_VERIFY_URL` with `Authorization: Bearer <Clerk session token>` and `x-suite-entitlement-secret`."
  - "Production evidence 2026-05-24: Vercel Production env names exist for the suite entitlement verifier, but the live WinFlowz endpoint returns 404 and ReplayGlows production still serves the pre-suite-auth Firebase CSP/build."
next_step: "/sf-prod replayglows-suite-auth-migration"
---

# Title

ReplayGlows Suite Auth Migration

# Status

Ready after suite-auth clarification and canonical product-id alignment. ReplayGlows must use Clerk as the suite web identity, WinFlowz suite Convex as the identity and entitlement authority, and a separate ReplayGlows product Convex backend for product data. The Flutter web integration path is ClerkJS bridge, not `clerk_flutter` beta and not Firebase Auth popup repair. WinFlows remains the account, billing and entitlement authority. YouTube OAuth remains a separate product permission stored in the product backend.

# User Story

En tant que builder de la suite WinFlowz, je veux que ReplayGlows utilise l'identite suite Clerk et les entitlements serveur, afin qu'un utilisateur retrouve le meme compte entre WinFlows et ReplayGlows sans recevoir un acces produit implicite.

Acteur principal: builder WinFlowz / ReplayGlows.

Acteurs secondaires:

- utilisateur ReplayGlows qui veut se connecter avec le compte suite;
- utilisateur WinFlows existant qui ouvre ReplayGlows;
- agent du chantier suite qui doit verifier la coherence avec `global_user_id` et les entitlements;
- WinFlowz suite Convex qui garde l'identite globale et les entitlements;
- ReplayGlows product Convex qui garde les donnees metier produit;
- Vercel API handlers qui gerent le depart et le retour YouTube OAuth.

Declencheur: l'utilisateur ouvre une route protegee de `https://app.replayglows.com`, clique pour se connecter, puis utilise ReplayGlows ou connecte YouTube.

Resultat observable attendu: l'utilisateur se connecte dans ReplayGlows avec le compte suite Clerk, ReplayGlows obtient un jeton serveur-verifiable, le backend produit ReplayGlows reconnait l'identite suite, l'acces produit est refuse par defaut sans entitlement `replayglows` actif dans le ledger WinFlowz, et YouTube OAuth ne demarre que pour un utilisateur authentifie et autorise.

# Minimal Behavior Contract

ReplayGlows accepte une session Clerk suite sur `app.replayglows.com` via un bridge ClerkJS, utilise le jeton Clerk Convex pour son backend produit ReplayGlows, et verifie l'entitlement `replayglows` dans le ledger WinFlowz avant toute lecture ou mutation privee. Une session valide prouve l'identite, pas l'acces; les videos, notes, playlists, transcriptions, preferences et tokens YouTube restent dans le backend produit ReplayGlows, tandis que `global_user_id` et les entitlements restent dans WinFlowz. Si Clerk, le backend produit Convex, le bridge suite, l'entitlement, ou YouTube OAuth echoue, ReplayGlows affiche un etat recuperable, ne cree pas de second compte Firebase, ne tente pas de fusion email, ne loggue aucun token et n'elargit jamais les droits. L'edge case facile a rater est le split-brain Convex: le backend ReplayGlows peut stocker les donnees produit, mais il ne doit jamais devenir la source de verite des droits produit; `tubeflow` doit etre traite comme alias legacy seulement si des droits anciens existent.

# Success Behavior

- Given un utilisateur non connecte ouvre `/videos`, when ReplayGlows detecte l'absence de session, then il redirige vers `/sign-in?tf_redirect=/videos` et propose le login Clerk suite sur `app.replayglows.com`.
- Given un utilisateur a deja une session Clerk suite valide, when il ouvre ReplayGlows, then le bridge ClerkJS restaure la session sans Firebase popup et retourne vers la route demandee.
- Given un utilisateur est reconnu par Clerk mais n'a pas d'entitlement `replayglows` actif dans le ledger WinFlowz, when il ouvre une route protegee, then il voit un etat "account recognized, product access inactive" sans donnees privees.
- Given un utilisateur a l'entitlement produit actif, when l'app appelle ReplayGlows product Convex, then ce backend valide le token Clerk, derive l'identite serveur, verifie ou consomme un snapshot d'entitlement issu de WinFlowz, et autorise seulement les fonctions produit attendues.
- Given l'utilisateur connecte YouTube, when `/api/auth/youtube` demarre le flow, then le handler verifie une session Clerk valide, verifie l'entitlement `replayglows` via le bridge suite, garde l'etat OAuth en cookies HTTP-only, et n'utilise plus de Firebase ID token.
- Given Google retourne vers `/api/auth/youtube/callback`, when l'etat OAuth est valide, then le callback echange le code Google et sauvegarde les tokens YouTube dans le backend produit ReplayGlows avec une mutation autorisee par l'identite suite.
- Given l'utilisateur se deconnecte, when la session Clerk est terminee, then ReplayGlows vide l'etat auth local, debranche le token Convex et renvoie les routes protegees vers sign-in.

# Error Behavior

- Clerk non configure en build ou runtime: afficher un etat "Suite auth not configured" avec diagnostics caviardes; ne pas afficher le bouton Firebase Google.
- Session Clerk valide mais ReplayGlows product Convex auth non configuree: afficher un etat d'indisponibilite backend; ne pas basculer vers des donnees privees locales comme si l'utilisateur etait autorise.
- Session Clerk valide mais bridge WinFlowz entitlement indisponible: refuser temporairement l'acces produit, afficher un etat recuperable, et logger seulement un code diagnostic sans token.
- Compte reconnu sans entitlement: refuser les donnees produit et afficher un chemin achat/support/account center vers WinFlows.
- Token Clerk/suite invalide, issuer/audience incorrect, expire ou absent: refuser avec etat recuperable et logs sans token.
- YouTube OAuth demarre sans session suite: retourner `401` caviarde et demander une reconnexion.
- YouTube OAuth callback perd l'etat, le code, ou la session: nettoyer les cookies OAuth et rediriger avec un message recuperable.
- Entitlement migration legacy `tubeflow` vers `replayglows` incoherente: bloquer l'acces produit et router vers le chantier suite; ne pas accorder par email, domaine, ou simple existence de compte.

# Problem

ReplayGlows a remplace un ancien chemin Clerk beta par Firebase Auth web pour stabiliser le login, mais la production echoue encore au moment du popup Google avec `[firebase_auth/internal-error]`. Les verifications recentes montrent que Firebase initialise, que Google provider repond aux appels publics, et que la CSP autorise le domaine Firebase, mais le popup reste casse et ne s'inscrit plus dans la decision suite.

En parallele, la suite WinFlowz a formalise une strategie differente: Clerk est l'identite centrale long terme, Firebase reste un adaptateur Android, et les droits produit sont des entitlements serveur. Continuer a reparer Firebase popup dans ReplayGlows ferait diverger le produit web de la suite, compliquerait le linking et laisserait `/api/auth/youtube` dependant d'un Firebase ID token qui n'est plus le bon contrat d'identite suite. A l'inverse, centraliser les donnees metier ReplayGlows dans WinFlowz serait aussi une erreur: ReplayGlows a besoin de son propre backend Convex pour les videos, notes, playlists, transcripts, preferences et tokens YouTube.

# Solution

Migrer ReplayGlows vers l'auth suite Clerk sur `app.replayglows.com`, avec WinFlows comme account center et source d'entitlements. L'app Flutter web garde son experience locale, ses routes et son backend produit Convex, mais remplace `AuthService` Firebase par un proprietaire de session ClerkJS, remplace les tokens Firebase envoyes a ReplayGlows product Convex et YouTube OAuth par des tokens Clerk/suite, et ajoute un etat produit "account recognized, product access inactive". WinFlowz Convex fournit l'identite globale et l'entitlement canonique `replayglows`; ReplayGlows product Convex reste responsable des donnees metier.

# Scope In

- Integrer l'identite Clerk suite dans ReplayGlows web via un bridge ClerkJS maintenu dans `web/` et un wrapper Dart, sans `clerk_flutter` beta.
- Remplacer `firebase_auth` comme proprietaire de session web.
- Garder un seul proprietaire de session dans l'app Flutter.
- Configurer les routes sign-in/sign-up/callback sur `app.replayglows.com`.
- Adapter ReplayGlows product Convex auth pour accepter le provider Clerk/suite attendu.
- Adapter le bridge HTTP Convex web pour utiliser le nouveau token.
- Adapter `/api/auth/youtube` et `/api/auth/youtube/callback` pour une session suite au lieu du cookie Firebase ID token.
- Ajouter une verification d'entitlement produit avant donnees privees et avant YouTube OAuth.
- Utiliser `product_id=replayglows` comme canon pour tous les nouveaux entitlements ReplayGlows; traiter `tubeflow` seulement comme alias legacy a migrer ou a lire en compatibilite temporaire si des droits anciens existent.
- Conserver ReplayGlows product Convex comme backend des videos, notes, playlists, transcripts, preferences et tokens YouTube.
- Ajouter ou utiliser un endpoint/bridge serveur WinFlowz qui valide une session Clerk et retourne un snapshot redacted `global_user_id` + entitlements pour `product_id=replayglows`, avec alias legacy `tubeflow` uniquement pendant migration.
- Mettre a jour `.env.example`, `README.md`, `AGENT.md`, `CLAUDE.md` et diagnostics.
- Verifier sur Vercel apres push, pas seulement localement.

# Scope Out

- Ne pas migrer tout WinFlowz suite dans ce chantier ReplayGlows.
- Ne pas creer un second provider d'identite separe pour ReplayGlows.
- Ne pas deplacer les donnees metier ReplayGlows dans WinFlowz Convex.
- Ne pas faire de ReplayGlows product Convex la source de verite des entitlements.
- Ne pas fusionner des comptes par email.
- Ne pas modifier les prix, plans ou grants sans decision du chantier suite.
- Ne pas changer les scopes YouTube OAuth sauf decision produit separee.
- Ne pas supprimer le ledger d'entitlements WinFlowz ou contourner Convex.
- Ne pas garder Firebase comme fallback silencieux pour les routes protegees web apres migration.
- Ne pas reintroduire `clerk_flutter` ou un autre SDK Flutter Clerk beta dans le chemin production web.
- Ne pas traiter YouTube OAuth comme preuve d'identite utilisateur.

# Constraints

- Clerk est l'identite centrale suite pour les produits web.
- Le bridge ClerkJS est le chemin d'integration Flutter web choisi pour ce chantier.
- Firebase Auth ne doit plus etre le chemin principal ReplayGlows web.
- Les entitlements sont serveur-owned et deny-by-default.
- `product_id=replayglows` est le canon pour ce chantier; `tubeflow` est un alias legacy a migrer ou a accepter temporairement en lecture conservatrice.
- WinFlowz Convex possede `global_user_id`, `identityAccounts`, `productEntitlements` et les evenements d'acces.
- ReplayGlows product Convex possede les donnees metier produit et doit appliquer l'autorisation serveur avant private reads/mutations.
- Le backend produit ReplayGlows doit vivre dans ce monorepo sous `backend/packages/backend/convex`; `REPLAYGLOWS_BACKEND_ROOT` sert seulement a valider un checkout alternatif.
- Les tokens Clerk/suite, cookies, OAuth codes, refresh tokens, secrets et payloads prives ne doivent jamais etre loggues.
- Local, preview et production restent des environnements auth separes.
- Les callbacks Clerk et YouTube doivent correspondre exactement aux domaines deployes.
- Convex auth config doit etre deployee apres ajout ou changement de provider.
- Le domaine Vercel brut peut etre protege; la verification utilisateur doit viser `https://app.replayglows.com`.

# Dependencies

## Local Dependencies

- `/home/claude/shipglows_data/projects/winflowz/docs/technical/suite-authentication.md`: decision canonique Clerk central + Firebase Android bridge + entitlements serveur.
- `/home/claude/shipglows_data/projects/winflowz/docs/technical/suite-authentication-support-runbook.md`: support et triage des entitlements, duplicate email, bridge failure et wrong environment.
- `/home/claude/winflowz_app/shipglows_data/workflow/specs/unified-suite-authentication.md`: chantier actif de l'identite suite.
- `/home/claude/shipglows_data/specs/master-auth-playbook.md`: invariants auth transverses.
- `/home/claude/winflowz/convex/schema.ts`, `/home/claude/winflowz/convex/users.ts`, `/home/claude/winflowz/convex/bridge.ts`: ledger suite, mapping identities, snapshots d'entitlements.
- `/home/claude/winflowz/src/pages/api/bridge/*`: bridge serveur WinFlowz existant, a etendre pour un snapshot Clerk si necessaire.
- `backend/packages/backend/convex`: backend Convex produit ReplayGlows integre au monorepo.
- `REPLAYGLOWS_BACKEND_ROOT`: override optionnel vers un checkout backend alternatif pour les checks de contrat.
- `app/lib/auth/auth_service.dart`: Firebase session owner actuel.
- `app/lib/auth/auth_state.dart`: etat auth SDK-neutral a conserver.
- `app/lib/auth/auth_gate.dart`: UI sign-in et diagnostics.
- `app/lib/main.dart`: bootstrap Firebase + Convex token wiring actuel.
- `app/lib/convex/convex_client.dart`: injection token Convex et bridge HTTP web.
- `app/api/auth/youtube.js`: demarrage OAuth YouTube avec Firebase ID token.
- `app/api/auth/youtube/callback.js`: callback YouTube qui reutilise le Firebase ID token comme JWT Convex.
- `app/web/index.html`: chargement des scripts web bridge.
- `app/web/clerk_bridge.js`: nouveau bridge ClerkJS cible a creer.
- `app/lib/auth/clerk_js_bridge.dart`: nouveau wrapper Dart cible a creer.
- `app/tool/check_shared_backend_contract.dart`: preflight du backend produit via `REPLAYGLOWS_BACKEND_ROOT`.
- `app/build.sh`, `.env.example`, `vercel.json`: env et CSP deployes.

## Fresh External Docs Checked

- Clerk Astro middleware docs, checked 2026-05-23: `clerkMiddleware()` injects auth state into Astro middleware and supports protected route redirects. This confirms the WinFlows account-center side remains Clerk-owned.
- Clerk JavaScript session token docs, checked 2026-05-23: the web bridge can use the active Clerk session to mint a Convex JWT template token for the product Convex client and a default session token for Vercel handlers.
- Clerk satellite domains docs, checked 2026-05-23: cross-domain auth sharing is possible but advanced; for ReplayGlows, the spec prefers embedding Clerk on `app.replayglows.com` instead of making the app depend on an implicit cross-domain redirect-only session.
- Convex Clerk auth docs, checked 2026-05-23: Convex + Clerk requires provider configuration in `auth.config.ts`; after adding auth provider config, the backend must be synced/deployed, and clients should use the Convex auth-ready signal rather than only provider UI state.

Fresh-docs verdict: fresh-docs checked.

# Invariants

- Authenticated identity is not product access.
- Product access is checked through entitlements before private reads/mutations.
- ReplayGlows has one session owner at runtime.
- ReplayGlows has two Convex responsibilities: WinFlowz Convex for identity/entitlements, ReplayGlows product Convex for product data.
- ReplayGlows product Convex may cache a suite entitlement snapshot for availability, but the cache is not the source of truth and must expire or refresh conservatively.
- YouTube OAuth is product permission, not suite identity.
- No email-only merge.
- No client-provided `user_id`, `global_user_id`, `product_id`, or entitlement is trusted.
- All callbacks and redirects are public until they finish creating or validating server-side state.
- Diagnostics are redacted and support-safe.

# Links & Consequences

- `AuthService` changes will affect router redirects, protected screens, ReplayGlows product Convex providers, YouTube connect UI and preferences diagnostics.
- ReplayGlows product Convex backend config must accept Clerk/suite JWTs before ReplayGlows can call protected functions.
- WinFlowz suite Convex must expose or support a server-only entitlement snapshot path for Clerk sessions and `product_id=replayglows`.
- The ReplayGlows product backend now lives inside this repo; implementation must not depend on the archived TubeFlow repository for active backend code.
- Existing Firebase users may not map automatically to Clerk users; the spec forbids email-only merge.
- Existing `tubeflow` entitlements, if present, must be treated as legacy compatibility inputs and migrated or aliased explicitly; no new entitlement should be created with `product_id=tubeflow`.
- Vercel env names will change from `FIREBASE_*` to Clerk/suite auth variables; stale Firebase envs should not remain required for web sign-in.
- CSP may need Clerk domains in `script-src`, `connect-src`, `frame-src`, and form/navigation allowances depending on the selected SDK/flow.
- The current auth diagnostics panel is temporary and should be adapted to suite auth diagnostics or removed after stable proof.

# Documentation Coherence

Update:

- `app/README.md`: setup, env vars, auth model and validation commands.
- `app/AGENT.md` and `CLAUDE.md`: replace Firebase-as-stable-provider claims with suite Clerk auth and entitlement rules.
- `app/.env.example`: replace or demote `FIREBASE_*`, add Clerk/suite auth envs and entitlement endpoint/config.
- `app/CHANGELOG.md`: note migration from Firebase web auth to suite Clerk auth.
- `app/tool/check_shared_backend_contract.dart`: document the monorepo backend default path and `REPLAYGLOWS_BACKEND_ROOT` as an override only.
- Root `AGENT.md` or monorepo guidance if auth validation commands change.
- WinFlowz suite docs only by reference or with the suite agent's approval; do not fork the suite decision in ReplayGlows docs.

# Edge Cases

- User is signed into WinFlows but opens ReplayGlows on a fresh browser profile.
- User is signed into Clerk but lacks `replayglows` entitlement.
- User has historical Firebase ReplayGlows data but no Clerk-linked identity.
- User has the same email in Clerk and Firebase but should not be silently merged.
- Clerk session succeeds but Convex auth provider config has not been deployed.
- ReplayGlows product Convex accepts identity but WinFlowz entitlement denies product access.
- ReplayGlows product Convex is reachable but WinFlowz entitlement bridge is down.
- WinFlowz entitlement bridge is reachable but returns no `replayglows` entitlement.
- YouTube OAuth starts before session refresh completes.
- YouTube OAuth callback returns after sign-out or expired state cookie.
- Vercel preview and production use different Clerk callback URLs.
- CSP allows the app shell but blocks Clerk frontend API, accounts iframe or callback script.
- The app URL is `app.replayglows.com` while account/billing CTAs point to WinFlows.

# Implementation Tasks

- [ ] Tache 1 : Establish the ReplayGlows product Convex backend checkout contract
  - Fichier : `backend/packages/backend/convex/**`, `app/tool/check_shared_backend_contract.dart`, `app/README.md`, `app/AGENT.md`
  - Action : Integrer et verifier le backend Convex produit ReplayGlows dans ce monorepo. Garder le backend produit separe de WinFlowz Convex; WinFlowz Convex sert uniquement l'identite et les entitlements.
  - User story link : evite de melanger l'identite suite avec les donnees metier produit.
  - Depends on : none.
  - Validate with : `cd app && REPLAYGLOWS_BACKEND_ROOT=/path/to/convex dart run tool/check_shared_backend_contract.dart`.
  - Notes : Ne pas dependre du repo historique TubeFlow; `REPLAYGLOWS_BACKEND_ROOT` est un override de validation seulement.

- [ ] Tache 2 : Define ReplayGlows suite auth env contract
  - Fichier : `app/.env.example`, `app/build.sh`, `app/lib/app/build_info.dart`, `app/vercel.json`
  - Action : Ajouter les variables publiques `CLERK_PUBLISHABLE_KEY`, `CLERK_SIGN_IN_URL`, `CLERK_SIGN_UP_URL`, `REPLAYGLOWS_PRODUCT_ID=replayglows`, `REPLAYGLOWS_LEGACY_PRODUCT_IDS=tubeflow`, `REPLAYGLOWS_ACCOUNT_CENTER_URL`, et garder `CONVEX_URL` pour le backend produit. Ajouter les variables serveur Vercel `CLERK_SECRET_KEY`, `SUITE_ENTITLEMENT_VERIFY_URL=https://www.winflowz.com/api/bridge/entitlement` et `SUITE_ENTITLEMENT_VERIFY_SECRET` pour les API YouTube; le secret est transmis au verifier via `x-suite-entitlement-secret`. Retirer `FIREBASE_*` du chemin obligatoire web.
  - User story link : rend le deploiement reproductible.
  - Depends on : Tache 1.
  - Validate with : source review plus build Vercel preview.
  - Notes : Ne jamais exposer `CLERK_SECRET_KEY` ni `SUITE_ENTITLEMENT_VERIFY_SECRET` dans `--dart-define` public.

- [ ] Tache 3 : Add the ClerkJS bridge for Flutter web
  - Fichier : `app/web/index.html`, `app/web/clerk_bridge.js`, `app/lib/auth/clerk_js_bridge.dart`
  - Action : Charger ClerkJS, initialiser Clerk avec la publishable key, exposer a Dart `load`, `isSignedIn`, `openSignIn`, `openUserProfile`, `signOut`, `getConvexToken(template: "convex")` et `getSessionToken()`.
  - User story link : login ReplayGlows utilise le compte suite.
  - Depends on : Tache 2.
  - Validate with : `cd app && flutter analyze` et browser check de `/sign-in`.
  - Notes : Ne pas utiliser `clerk_flutter` beta; les erreurs bridge doivent etre redacted.

- [ ] Tache 4 : Replace Firebase web session owner with suite auth service
  - Fichier : `app/lib/auth/auth_service.dart`, `app/lib/auth/auth_state.dart`
  - Action : Remplacer l'initialisation Firebase et `signInWithPopup` par un service ClerkJS/suite capable de restaurer session, sign-in, sign-out, recuperer token Convex produit, recuperer session token pour API Vercel, et produire `AuthUser`.
  - User story link : ReplayGlows reconnait le meme compte suite sans creer de second compte Firebase.
  - Depends on : Tache 3.
  - Validate with : `cd app && flutter analyze`, tests unitaires auth service avec fake bridge.
  - Notes : Garder `auth_state.dart` SDK-neutral; aucune fusion email cote client.

- [ ] Tache 5 : Adapt sign-in UI and auth diagnostics
  - Fichier : `app/lib/auth/auth_gate.dart`
  - Action : Remplacer les libelles Firebase/Google popup par suite sign-in, account-center links, et diagnostics caviardes Clerk/suite. Les chaines user-facing francaises doivent etre naturelles et accentuees dans l'implementation.
  - User story link : l'utilisateur comprend qu'il utilise son compte suite.
  - Depends on : Tache 4.
  - Validate with : `flutter analyze`, browser check de `/sign-in`.
  - Notes : Le retour doit conserver `tf_redirect`.

- [ ] Tache 6 : Rewire bootstrap and ReplayGlows product Convex token provider
  - Fichier : `app/lib/main.dart`, `app/lib/convex/convex_client.dart`
  - Action : Retirer le bootstrap Firebase obligatoire, initialiser le service suite auth, et connecter ReplayGlows product Convex avec le token Clerk `convex` issu du bridge JS.
  - User story link : les donnees protegees utilisent la session suite.
  - Depends on : Taches 3 et 4.
  - Validate with : `flutter analyze`, hosted smoke apres deploy.
  - Notes : Les logs doivent indiquer presence/absence de config sans valeurs secretes.

- [ ] Tache 7 : Expose a WinFlowz suite entitlement verifier for Clerk sessions
  - Fichier : `/home/claude/winflowz/src/pages/api/bridge/entitlement.ts`, `/home/claude/winflowz/convex/bridge.ts`, `/home/claude/winflowz/src/lib/suiteBridge.ts`
  - Action : Ajouter ou verifier un endpoint serveur `POST /api/bridge/entitlement` qui recoit un Clerk session token dans `Authorization: Bearer`, verifie la session cote serveur, resolve le `global_user_id`, lit les entitlements dans WinFlowz Convex, et retourne un snapshot redacted pour `product_id=replayglows`. Proteger l'appel server-to-server avec `SUITE_ENTITLEMENT_VERIFY_SECRET` transmis via `x-suite-entitlement-secret`.
  - User story link : l'identite est centrale, mais l'acces produit reste deny-by-default dans le ledger suite.
  - Depends on : Tache 2.
  - Validate with : tests endpoint invalid token, missing secret, no entitlement, active entitlement; `cd /home/claude/winflowz && npm run check` ou commande locale equivalente.
  - Notes : Ne jamais accepter `product_id`, `global_user_id` ou entitlement venant directement du client.

- [ ] Tache 8 : Update ReplayGlows product Convex auth and entitlement enforcement
  - Fichier : `backend/packages/backend/convex/auth.config.ts`, `backend/packages/backend/convex/users.ts`, `backend/packages/backend/convex/youtube.ts`, `backend/packages/backend/convex/schema.ts`
  - Action : Configurer Clerk comme provider Convex, remplacer les hypotheses Firebase ID token, ajouter un helper serveur qui verifie ou consomme un snapshot WinFlowz pour `product_id=replayglows`, accepte `tubeflow` seulement comme legacy alias temporaire, et refuser les reads/mutations privees sans entitlement actif.
  - User story link : les donnees ReplayGlows restent dans le backend produit, mais l'acces vient de la suite.
  - Depends on : Taches 1, 6 et 7.
  - Validate with : `REPLAYGLOWS_BACKEND_ROOT=/path/to/convex npx convex deploy` ou commande backend equivalente, puis smoke query/mutation avec session Clerk.
  - Notes : Si le backend a d'autres noms de modules que `users.ts` ou `youtube.ts`, appliquer le meme contrat aux modules reels trouves par `tool/check_shared_backend_contract.dart`.

- [ ] Tache 9 : Add product entitlement gate in client-visible flow
  - Fichier : `app/lib/providers/providers.dart` ou provider cible equivalent.
  - Action : Introduire un etat "account recognized, product access inactive" avant les ecrans prives et avant les mutations sensibles, base sur le resultat serveur du backend produit.
  - User story link : un compte ne donne pas acces a tous les produits.
  - Depends on : Taches 6 et 8.
  - Validate with : widget/provider tests avec entitlement actif, absent et loading.
  - Notes : La vraie enforcement reste backend; le client sert l'UX.

- [ ] Tache 10 : Replace Firebase token handoff in YouTube OAuth start
  - Fichier : `app/lib/widgets/youtube_connect.dart`
  - Action : Envoyer un Clerk session token a `/api/auth/youtube` et bloquer le depart OAuth si session ou entitlement produit absent selon le backend.
  - User story link : YouTube OAuth reste permission produit pour utilisateur autorise.
  - Depends on : Taches 4, 8 et 9.
  - Validate with : `flutter analyze`, source review auth header redaction.
  - Notes : Ne pas logguer le bearer token.

- [ ] Tache 11 : Replace Firebase token cookie in YouTube OAuth API
  - Fichier : `app/api/auth/youtube.js`
  - Action : Verifier le Clerk session token cote serveur, verifier l'entitlement `replayglows` via `SUITE_ENTITLEMENT_VERIFY_URL`, stocker seulement un pointeur/session OAuth safe si necessaire, et supprimer `replayglows_youtube_firebase_id_token`.
  - User story link : le callback ne depend plus de Firebase ID token.
  - Depends on : Taches 7 et 10.
  - Validate with : `cd app && node --test api/auth/_youtube.test.js`.
  - Notes : Cookies OAuth restent HTTP-only, SameSite=Lax, Secure en prod.

- [ ] Tache 12 : Replace Firebase token use in YouTube OAuth callback
  - Fichier : `app/api/auth/youtube/callback.js`
  - Action : Utiliser l'identite suite validee pour `ensureUser` et `saveYoutubeTokens` dans ReplayGlows product Convex, verifier l'entitlement `replayglows`, nettoyer les cookies, et renvoyer des erreurs recoverables.
  - User story link : sauvegarde YouTube liee au compte suite autorise.
  - Depends on : Tache 11.
  - Validate with : tests callback success/state mismatch/missing session/missing entitlement.
  - Notes : Ne pas inclure de tokens Google dans les erreurs retournees a l'UI.

- [ ] Tache 13 : Update CSP and Vercel deployment config for Clerk/suite auth
  - Fichier : `app/vercel.json`
  - Action : Ajouter les domaines Clerk/suite strictement necessaires a `connect-src`, `script-src`, `frame-src` ou equivalents; retirer les allowances Firebase inutiles apres migration.
  - User story link : le login suite fonctionne sur domaine production.
  - Depends on : Taches 2 a 4.
  - Validate with : `curl -sI https://app.replayglows.com/` apres deploy, browser auth smoke.
  - Notes : Eviter les wildcards larges sans justification.

- [ ] Tache 14 : Update docs and operator diagnostics
  - Fichier : `app/README.md`, `app/AGENT.md`, `app/CLAUDE.md`, `app/CHANGELOG.md`
  - Action : Documenter le modele Clerk suite auth, les deux backends Convex, envs, entitlement denial, YouTube OAuth separation, validation Vercel, et support copy.
  - User story link : rend le nouveau contrat maintenable.
  - Depends on : Taches 1 a 13.
  - Validate with : source review, metadata lint si gouvernance touchee.
  - Notes : Lier vers la doc WinFlowz suite au lieu de la recopier.

- [ ] Tache 15 : Hosted auth verification
  - Fichier : deployment Vercel `app`
  - Action : Pousser, attendre Vercel Ready, verifier `app.replayglows.com`, tester login Clerk, session restore, entitlement denied, entitlement allowed, logout, YouTube OAuth start/callback, et verifier que les donnees metier viennent du backend produit ReplayGlows.
  - User story link : prouve le comportement utilisateur final.
  - Depends on : Taches 1 a 14.
  - Validate with : `/sf-prod app`, `/sf-auth-debug https://app.replayglows.com ReplayGlows suite auth`, puis `/sf-verify replayglows-suite-auth-migration`.
  - Notes : Le succes local ne prouve pas callbacks/cookies/OAuth en production.

# Acceptance Criteria

- [ ] CA 1 : Given `app.replayglows.com` est deploye, when un utilisateur clique sign-in, then le flow Clerk suite demarre sans Firebase popup.
- [ ] CA 2 : Given l'utilisateur termine Clerk sign-in, when il revient dans ReplayGlows, then la route `tf_redirect` est respectee.
- [ ] CA 3 : Given l'utilisateur a une session suite mais pas d'entitlement `replayglows`, when il ouvre une route protegee, then aucune donnee privee n'est chargee et un etat acces non actif est affiche.
- [ ] CA 4 : Given l'utilisateur a une session suite et un entitlement actif, when l'app appelle ReplayGlows product Convex, then les queries/mutations protegees passent avec un token Clerk/suite valide et une verification entitlement serveur.
- [ ] CA 5 : Given un token invalide ou mauvais environnement, when ReplayGlows appelle Convex ou l'API YouTube, then la requete echoue en 401/403 sans fuite de secret.
- [ ] CA 6 : Given l'utilisateur autorise a demarre YouTube OAuth, when Google rappelle `/api/auth/youtube/callback`, then les tokens YouTube sont sauvegardes sous l'identite suite et les cookies temporaires sont nettoyes.
- [ ] CA 7 : Given l'utilisateur se deconnecte, when il recharge une route protegee, then ReplayGlows ne garde aucune session Convex active et redirige vers sign-in.
- [ ] CA 8 : Given la production est verifiee, when `main.dart.js` est inspecte, then aucune dependance Firebase Auth web obligatoire ne reste dans le chemin de sign-in.
- [ ] CA 9 : Given WinFlowz suite Convex contient `productEntitlements`, when ReplayGlows verifie l'acces produit, then `product_id=replayglows` actif ouvre les donnees produit; `tubeflow` est accepte seulement comme alias legacy documente et ne doit plus etre cree pour les nouveaux droits.
- [ ] CA 10 : Given ReplayGlows stocke des videos, notes, playlists, transcriptions, preferences ou tokens YouTube, when le flux est verifie, then ces donnees restent dans ReplayGlows product Convex et non dans WinFlowz suite Convex.

# Test Strategy

- Static checks: `cd app && flutter analyze`.
- Product backend preflight: `cd app && dart run tool/check_shared_backend_contract.dart`.
- Dart/widget tests: auth state restore, sign-in denied state, entitlement active/absent UI, logout.
- Node tests: YouTube OAuth start/callback state mismatch, missing session, missing entitlement, Google token exchange failure, Convex mutation failure.
- Suite backend checks: WinFlowz bridge Clerk endpoint rejects missing secret, invalid token, wrong product and no entitlement; returns redacted snapshot for active `replayglows` and explicitly documents any temporary `tubeflow` legacy alias behavior.
- Product backend checks: ReplayGlows product Convex auth config deployed for Clerk/suite provider; protected functions reject missing/invalid auth and missing entitlement.
- Browser checks: hosted `app.replayglows.com` sign-in, redirect restore, session reload, logout.
- Auth debug: `/sf-auth-debug https://app.replayglows.com ReplayGlows suite auth`.
- Prod proof: `/sf-prod app` before browser/user-flow conclusions.
- Redaction check: no tokens, cookies, OAuth codes, refresh tokens, or secrets in logs, diagnostics, screenshots or docs.

# Risks

- High: wrong product id can deny legitimate users or grant wrong access.
- High: Convex auth provider mismatch can make login appear successful while backend calls fail.
- High: split-brain between WinFlowz suite Convex and ReplayGlows product Convex can grant access from stale product data if entitlement checks are not server-owned.
- High: YouTube OAuth token handoff currently depends on Firebase ID token and must be redesigned carefully.
- High: cross-domain Clerk account-center behavior can fail if callback URLs or satellite-domain settings are wrong.
- Medium: Flutter web integration with Clerk may require a JS bridge or hosted auth pages because there is no stable first-party Flutter Clerk SDK for this app path.
- Medium: stale Firebase envs may hide incomplete migration in Vercel.
- Medium: existing user data may be keyed by Firebase uid and need mapping or migration planning.
- Medium: CSP can block Clerk runtime even when build and HTTP health are green.

# Execution Notes

- Preferred UX: sign in inside ReplayGlows on `app.replayglows.com`; use WinFlows for account management, billing, subscription and support.
- Product id: `replayglows` for this migration, because ReplayGlows is the current product name. `tubeflow` is legacy only and must not be used for new grants.
- Data boundary: WinFlowz suite Convex owns identity and entitlements; ReplayGlows product Convex owns videos, notes, playlists, transcripts, preferences and YouTube tokens.
- Integration path: ClerkJS bridge in `web/` plus Dart wrapper; do not use `clerk_flutter` beta.
- The current Firebase diagnostic patch is useful only until suite auth replaces Firebase. Do not preserve Firebase-specific user-facing copy after migration.
- Read first: `app/README.md`, `app/AGENT.md`, `app/lib/auth/auth_service.dart`, `app/lib/main.dart`, `app/lib/convex/convex_client.dart`, `app/api/auth/youtube.js`, `app/api/auth/youtube/callback.js`, `/home/claude/winflowz/convex/bridge.ts`, `/home/claude/winflowz/src/pages/api/bridge/*`, and `backend/packages/backend/convex/auth.config.ts`.
- Stop conditions:
  - `backend/packages/backend/convex` is missing or cannot typecheck;
  - ClerkJS cannot mint a Convex JWT template for ReplayGlows product Convex;
  - entitlement can only be checked client-side;
  - WinFlowz bridge cannot verify Clerk sessions server-side;
  - ReplayGlows product backend would need to become entitlement source of truth;
  - a product would ship same-account before deny/allow tests pass.
- Fresh official docs were checked on 2026-05-23 for Clerk Astro middleware, Clerk satellite domains, and Convex Clerk auth.

# Open Questions

None.

Resolved decisions:

- ReplayGlows uses Clerk suite identity on web.
- ReplayGlows Flutter web integrates Clerk through a ClerkJS bridge, not `clerk_flutter` beta.
- WinFlowz suite Convex owns `global_user_id`, identity accounts and product entitlements.
- ReplayGlows product Convex remains the product-data backend for YouTube library, notes, playlists, transcripts, preferences and OAuth product tokens.
- `product_id=replayglows` is the canonical entitlement id for this chantier; `tubeflow` is legacy alias/migration input only.

# Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-05-23 13:11:10 UTC | sf-spec | GPT-5 Codex | Created ReplayGlows suite auth migration spec from production Firebase popup failure and WinFlowz suite-auth decision. | draft | `/sf-ready replayglows-suite-auth-migration` |
| 2026-05-23 15:57:28 UTC | sf-ready | GPT-5 Codex | Evaluated Definition of Ready, local suite-auth evidence, Convex/backend ownership, YouTube OAuth risk, fresh-docs coverage and adversarial auth/security paths. | not ready: backend Convex path/ownership is not executable locally, the Clerk Flutter-web integration path is still a choice instead of a contract, and readiness notes still contain pre-start confirmation language. | `/sf-spec replayglows-suite-auth-migration readiness fixes` |
| 2026-05-23 15:59:42 UTC | sf-ready | GPT-5 Codex | Re-ran readiness gate after explicit operator request and rechecked spec content, suite product-id evidence, local backend availability and current official Clerk/Convex docs. | not ready: no spec correction since previous gate; backend Convex path remains unresolved, Clerk Flutter-web integration path remains undecided, and pre-ready confirmation language remains in Open Questions and Task 1. | `/sf-spec replayglows-suite-auth-migration readiness fixes` |
| 2026-05-23 17:02:33 UTC | sf-spec | GPT-5 Codex | Updated spec from operator clarification that ReplayGlows keeps a product-specific Convex backend while Clerk/WinFlowz own identity and entitlements. | reviewed: two-Convex boundary, initial product id assumption, ClerkJS bridge path, backend checkout contract and suite entitlement verifier made explicit. | `/sf-ready replayglows-suite-auth-migration` |
| 2026-05-23 17:14:09 UTC | sf-spec | GPT-5 Codex | Corrected ReplayGlows product-id contract after owner flagged TubeFlow as obsolete naming. | reviewed: `product_id=replayglows` is now canonical; `tubeflow` is legacy alias/migration input only and must not be used for new entitlements. | `/sf-ready replayglows-suite-auth-migration` |
| 2026-05-23 18:29:02 UTC | sf-ready | GPT-5 Codex | Re-evaluated readiness after two-Convex and product-id corrections. | not ready: ReplayGlows spec is internally coherent, but canonical WinFlowz suite auth docs/spec still list TubeFlow or `tubeflow` as the product-id canon, conflicting with `product_id=replayglows`. | `/sf-spec replayglows-suite-auth-migration suite product-id alignment` |
| 2026-05-23 18:37:56 UTC | sf-docs | GPT-5 Codex | Aligned canonical WinFlowz suite auth spec, strategy doc and support runbook with ReplayGlows as the YouTube product. | docs aligned: `product_id=replayglows` is canonical and `tubeflow` is documented only as legacy alias/migration input. | `/sf-ready replayglows-suite-auth-migration` |
| 2026-05-23 19:30:27 UTC | sf-ready | GPT-5 Codex | Re-ran readiness gate after canonical suite docs were aligned to ReplayGlows. | ready: structure, metadata, user story, two-Convex boundary, ClerkJS bridge contract, entitlement denial, YouTube OAuth separation, docs coherence, fresh-docs evidence and security constraints are sufficient for `/sf-start`. | `/sf-start replayglows-suite-auth-migration` |
| 2026-05-23 19:51:46 UTC | sf-start | gpt-5.3-codex | Implemented ReplayGlows app migration surfaces: ClerkJS bridge + Dart auth wrapper, Firebase web-session replacement, Convex token rewiring, fail-closed YouTube OAuth suite verification, client access-inactive gate, env/docs/changelog updates, and focused Node tests. | partial: app-side implementation and local checks are complete, but suite verifier endpoint contract and ReplayGlows product Convex backend auth/access functions still need coordinated backend work and hosted proof. | `/sf-start replayglows-suite-auth-migration backend-followups` |
| 2026-05-23 19:54:24 UTC | sf-verify | GPT-5 Codex | Re-ran local verification after delegated sf-start: Flutter analysis, YouTube OAuth Node tests, build script syntax, metadata lint, and product-backend preflight. | partial: local app checks pass, but `REPLAYGLOWS_BACKEND_ROOT` is unresolved, suite entitlement verifier and product Convex Clerk/access functions are not proven, and hosted Vercel auth/OAuth proof is pending. | `/sf-start replayglows-suite-auth-migration backend-followups` |
| 2026-05-23 19:54:24 UTC | sf-build | GPT-5 Codex | Orchestrated delegated sequential implementation and verification for ReplayGlows suite auth migration. | partial: delegated app implementation landed with local checks passing, but lifecycle cannot continue to sf-end/sf-ship until backend contracts and hosted proof exist. | `/sf-start replayglows-suite-auth-migration backend-followups` |
| 2026-05-23 21:37:10 UTC | sf-start | GPT-5 Codex | Migrated the historical TubeFlow Convex backend into `backend/packages/backend`, removed the temporary local clone, switched Convex auth config to Clerk, added product access snapshot schema/query, and updated backend contract docs/checks. | partial: ReplayGlows is no longer dependent on the archived TubeFlow repo and local app/backend checks pass; suite entitlement verifier deployment and hosted proof remain. | `/sf-start replayglows-suite-auth-migration suite-verifier` |
| 2026-05-23 21:52:23 UTC | sf-build | GPT-5 Codex | Implemented the WinFlowz suite entitlement verifier endpoint for ReplayGlows. | partial: local WinFlowz route `POST /api/bridge/entitlement`, Convex query `bridge:getReplayGlowsEntitlementSnapshotByClerkId`, canonical `replayglows`/legacy `tubeflow` matching, redacted snapshot contract, ReplayGlows caller header/URL alignment, docs and tests are in place; deployed endpoint proof still remains. | `/sf-verify replayglows-suite-auth-migration suite-verifier` |
| 2026-05-24 08:21:02 UTC | sf-prod | GPT-5 Codex | Checked live WinFlowz and ReplayGlows deployment state, Vercel env presence, Git status, endpoint health and recent runtime logs. | blocked: production env names exist, but `https://www.winflowz.com/api/bridge/entitlement` returns 404, WinFlowz route file is still untracked locally, ReplayGlows production deployment is from 2026-05-19 and still serves Firebase-era headers, and recent Vercel runtime logs are empty. | `/sf-ship replayglows-suite-auth-migration current local changes, then /sf-prod` |
| 2026-05-24 08:26:24 UTC | sf-ship | GPT-5 Codex | Quick-shipped the current suite-auth migration changes for WinFlowz and ReplayGlows so Vercel can build the hosted verifier and app. | shipped: code and docs were committed/pushed for hosted validation; local checks passed, but production proof remains pending behind `sf-prod`. | `/sf-prod replayglows-suite-auth-migration` |
| 2026-05-24 08:46:00 UTC | sf-prod | GPT-5 Codex | Verified the pushed ReplayGlows production deployment for commit `ccc1695`, checked live app health, build logs, Vercel env names, OAuth handlers, and WinFlowz suite verifier health. | blocked: ReplayGlows production build is ready and serves the new Clerk bridge, but `/api/auth/youtube` returns `500` because Google OAuth env names are absent in Production. The WinFlowz verifier was initially checked with `GET` and returned 404, but the server-only `POST` JSON route exists and returns a redacted 401 without the bridge secret. | `/sf-start replayglows-suite-auth-migration prod-blockers` |
| 2026-05-24 08:51:22 UTC | sf-start | GPT-5 Codex | Investigated production blockers after sf-prod: rechecked WinFlowz verifier with the actual server-to-server `POST` JSON method, enumerated ReplayGlows Vercel env names, searched local/project/GitHub/GCloud surfaces for reusable Google OAuth credentials, and checked Google OAuth credential availability constraints. | blocked: WinFlowz entitlement verifier is live for the expected POST contract; the remaining blocker is missing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in ReplayGlows Production. No retrievable client secret was found locally or in deploy metadata, and Google OAuth web client secrets must be created/retrieved from Google Auth Platform by the operator before Vercel envs can be set. | `create/provide Google OAuth web client credentials, then /sf-start replayglows-suite-auth-migration set-google-oauth-envs` |
| 2026-05-24 10:41:19 UTC | continue | GPT-5 Codex | Continued after operator added Google OAuth envs: confirmed `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` exist in ReplayGlows Production, redeployed the latest production build, checked the new deployment and live handlers. | unblocked: deployment `dpl_An5sLfzKdhHeYzrg7exwdCuKmvMV` is Ready and aliased to `https://app.replayglows.com`; `/api/auth/youtube` now fails closed with `401 Missing suite session token` instead of Google OAuth config failure; WinFlowz entitlement verifier POST still returns redacted 401 without secret. | `/sf-auth-debug https://app.replayglows.com ReplayGlows suite auth and YouTube OAuth` |
| 2026-05-24 12:56:16 UTC | sf-auth-debug | GPT-5 Codex | Reproduced the production blank page with Playwright on `https://app.replayglows.com`, `/videos`, and `/sign-in`, then inspected the deployed CSP and local Vercel config. | found: Flutter never booted because Vercel CSP blocked `https://www.gstatic.com/flutter-canvaskit/.../canvaskit.js`; the same CSP also lacked the live Clerk frontend API domain `https://clerk.replayglows.com`. Updated `app/vercel.json` to allow CanvasKit and ReplayGlows Clerk in the relevant directives. | `/sf-ship replayglows production CSP fix, then /sf-prod` |
| 2026-05-24 13:10:19 UTC | sf-prod | GPT-5 Codex | Shipped and verified deployment `dpl_FPWLFzsnbZkLc7TBzMrvgnR7nwso` for commit `902d164`; checked the custom domain CSP, script/network loading, and screenshot/browser DOM after deploy. | partial: the CanvasKit CSP blocker is gone and `main.dart.js`, CanvasKit, Clerk UI/JS, and Clerk client endpoints load successfully, but the app still renders a blank first frame. Added production console logging through `AppLogger` so the next deploy exposes Dart bootstrap/auth errors before the in-app diagnostics UI renders. | `/sf-prod after diagnostic-log deploy, then continue sf-auth-debug on the exposed console error` |
| 2026-05-24 13:18:48 UTC | sf-auth-debug | GPT-5 Codex | Used the deployed console logs from commit `4af201a` to trace the blank first frame through `main`, Convex init, bootstrap start, Clerk bridge init, and Convex auth wiring. | fixing: no Dart exception was emitted; the app boot reached Convex auth wiring but still did not paint a scene. Patched web boot to use path URL strategy and to render `ReplayGlowsApp` immediately while auth/Convex wiring continues in the background, instead of holding first paint behind the bootstrap gate. | `/sf-ship path-url/bootstrap-first-paint fix, then /sf-prod browser proof` |
| 2026-05-24 13:55:13 UTC | sf-prod | GPT-5 Codex | Verified deployment `dpl_G49RFsUtDrwGg6CGUhvJBcxiPkBx` for commit `652e5f1` on `https://app.replayglows.com`; rechecked URL shape, console boot logs, and a control Flutter app in the same Playwright runtime. | partial: the deployed app now uses clean path routing and reaches `AuthSignInPage build` with `bootstrap() complete`, while CSP and Clerk/CanvasKit loading remain unblocked. Playwright screenshots still show blank, but the same runtime also screenshots a freshly generated default Flutter web app as blank, so headless visual proof is not reliable here; a real-browser user retest is required. | `operator retest app.replayglows.com in a normal browser; if still blank, capture the visible in-page/console boot logs now emitted by AppLogger` |
| 2026-06-10 08:53:15 UTC | sf-build | GPT-5 Codex | Implemented a shared ReplayGlows product Convex access guard, converted default free access into an explicit server-owned product-access snapshot, applied entitlement gating across private product modules, fixed obvious owner checks for note/video/playlist ID paths, and updated architecture docs. | partial: backend typecheck and ShipGlows metadata lint pass; hosted deployment proof and full entitlement lifecycle smoke remain pending. | `/sf-verify replayglows-suite-auth-migration backend-entitlement-guard` |

# Current Chantier Flow

| Skill | Status | Notes | Next |
|-------|--------|-------|------|
| sf-spec | done | Spec updated after owner clarification: two Convex layers are explicit, ClerkJS bridge is selected, `product_id=replayglows` is canonical, `tubeflow` is legacy only, and product backend checkout is an operational preflight. | sf-ready |
| sf-ready | ready | Canonical WinFlowz suite auth docs/spec now say ReplayGlows and `product_id=replayglows`; `tubeflow` is legacy only. Structure, tasks, acceptance criteria, adversarial review and security constraints are sufficient for start. | sf-start |
| sf-start | implemented | ReplayGlows app codepath, product backend, suite verifier endpoint, server-to-server entitlement route contract, Production env names, and local product Convex entitlement guard are now in place. Google OAuth config failure is resolved after redeploy; unauthenticated OAuth start now fails closed with missing suite session token. | sf-verify |
| sf-auth-debug | partial | Production browser proof fixed the CSP blocker, added console boot diagnostics, switched Flutter web to path URLs, and removed the bootstrap-first-paint gate. Deployed logs reach `AuthSignInPage build`; remaining visual proof is blocked by the local Playwright runtime also rendering a default Flutter app blank. | manual real-browser retest |
| sf-verify | pending | Backend entitlement guard needs coherence review plus hosted user-flow proof after deployment: app boot, Clerk sign-in/session restore, entitlement denied/allowed behavior, protected Convex calls, revocation denial, and YouTube OAuth start/callback must be exercised with a real signed-in session. | sf-test |
| sf-end | pending | Close after docs, validation and follow-up risks are handled. | sf-ship |
| sf-ship | shipped | Current code/docs changes have been pushed for hosted deployment validation. This is not a formal task close. | sf-prod |
