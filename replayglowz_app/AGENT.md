---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.3.0"
project: "replayglowz-app"
created: "2026-04-26"
updated: "2026-06-02"
status: "reviewed"
source_skill: sf-docs
scope: "file"
owner: "Diane"
confidence: "high"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "Flutter"
  - "Clerk"
  - "WinFlowz suite entitlement verifier"
  - "ReplayGlowz product Convex backend"
  - "Vercel"
  - "GitHub Actions"
  - "Blacksmith"
  - "YouTube OAuth"
depends_on:
  - "README.md"
  - "CLAUDE.md"
  - "shipflow_data/technical/apps/replayglowz_app/architecture.md"
supersedes:
  - artifact_version: "1.0.0"
evidence:
  - "README.md"
  - ".env.example"
  - "build.sh"
  - "vercel.json"
  - "lib/auth/auth_service.dart"
  - "lib/auth/clerk_js_bridge.dart"
  - "api/auth/youtube.js"
  - "api/auth/youtube/callback.js"
  - "lib/providers/mutations.dart"
  - "tool/check_shared_backend_contract.dart"
next_step: "Run hosted auth verification after ship (`sf-ship -> sf-prod`) because this project uses vercel-preview-push mode."
---

# AGENT

Operational guide for agents working in `replayglowz-app`.

## Repository role

`replayglowz-app` is a Flutter client. The web build uses suite Clerk identity and deploys on Vercel with OAuth handlers under `api/auth/`. Native builds use Firebase Auth as the app session adapter and must resolve suite identity/product access through the WinFlowz suite bridge. Android build verification runs from the monorepo GitHub Actions workflow on Blacksmith runners.

## Non-negotiable boundaries

- Do not move product data into WinFlowz suite Convex.
- Do not treat client-only identity as product access.
- Do not allow product access without server verification; recognized ReplayGlowz accounts may receive product-scoped `replayglowz/free` access by default.
- Do not log secrets, bearer tokens, OAuth codes, or refresh tokens.
- Do not create new grants for `tubeflow`; use `replayglowz` as canonical product id.

## Runtime flow

1. `main()` initializes logging/diagnostics and Convex transport.
2. `AuthService` loads ClerkJS via `web/clerk_bridge.js`.
3. Clerk session token carries the Convex audience from the Clerk Convex integration for product backend calls.
4. Protected routes require authentication and server product-access status; ReplayGlowz defaults recognized accounts to product-scoped free access unless explicitly revoked.
5. YouTube OAuth start/callback verifies entitlement server-side before token persistence.
6. YouTube library refresh is backend-orchestrated through `youtube:startQuotaSafeSync`; the Flutter app must not loop over every playlist with direct `fetchPlaylistItems` calls.
7. Android CI currently verifies buildability and uploads a debug APK on manual runs; Play Store release requires a signed AAB workflow and keystore secrets.
8. Native Firebase sign-in is not product access. The app must not send a Convex token unless the suite bridge returns active `replayglowz` access and a server-issued product token.

## Source-of-truth files

- `lib/auth/auth_service.dart`
- `lib/auth/clerk_js_bridge.dart`
- `web/clerk_bridge.js`
- `lib/providers/providers.dart` (`productAccessStatusProvider`)
- `lib/providers/mutations.dart` (`syncAllPlaylists`)
- `api/auth/youtube.js`
- `api/auth/youtube/callback.js`
- `tool/check_shared_backend_contract.dart`
- `.github/workflows/replayglowz-app-android.yml` (monorepo root)

## Environment contract

Flutter build-time values:

- `CONVEX_URL`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SIGN_IN_URL`
- `CLERK_SIGN_UP_URL`
- `REPLAYGLOWZ_PRODUCT_ID` (`replayglowz`)
- `REPLAYGLOWZ_LEGACY_PRODUCT_IDS` (`tubeflow`)
- `REPLAYGLOWZ_ACCOUNT_CENTER_URL`
- `REPLAYGLOWZ_APP_URL`

Vercel server/runtime values:

- `YOUTUBE_OAUTH_CLIENT_ID`
- `YOUTUBE_OAUTH_CLIENT_SECRET`
- `CLERK_SECRET_KEY`
- `SUITE_ENTITLEMENT_VERIFY_URL` (`https://www.winflowz.com/api/bridge/entitlement`)
- `SUITE_ENTITLEMENT_VERIFY_SECRET` (sent as `x-suite-entitlement-secret`)
- `REPLAYGLOWZ_YOUTUBE_OAUTH_TICKET_SECRET` (encrypts the short-lived YouTube OAuth callback handoff ticket)

## Backend checkout contract

The ReplayGlowz product Convex backend lives in this monorepo at
`../replayglowz_backend/packages/backend/convex`. The checker resolves that path
by default; set `REPLAYGLOWZ_BACKEND_ROOT` only for an alternate checkout:

```bash
dart run tool/check_shared_backend_contract.dart
```
