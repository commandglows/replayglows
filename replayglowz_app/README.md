# ReplayGlowz App

Flutter app for ReplayGlowz. The web build is deployed on Vercel; Android build
verification runs from the monorepo GitHub Actions workflow.

ReplayGlowz uses suite Clerk web identity plus server-verified product access on web. Native Flutter builds use Firebase Auth as the app session adapter, then resolve suite identity and product access through the WinFlowz suite bridge. Product data (videos, notes, playlists, transcripts, preferences, YouTube tokens) stays in the ReplayGlowz product Convex backend.

## Auth and Data Boundaries

- Identity/session owner: Clerk (suite account on `app.replayglowz.com`)
- Entitlement authority: WinFlowz suite verifier (`SUITE_ENTITLEMENT_VERIFY_URL`)
- Product data authority: ReplayGlowz product Convex (`CONVEX_URL`)
- Canonical entitlement product id: `replayglowz`
- Legacy alias (read/migration only): `tubeflow`

## Quick Start

```bash
flutter pub get

flutter run -d chrome \
  --dart-define=CONVEX_URL=https://your-deployment.convex.cloud \
  --dart-define=CLERK_PUBLISHABLE_KEY=pk_live_xxx \
  --dart-define=CLERK_SIGN_IN_URL=/sign-in \
  --dart-define=CLERK_SIGN_UP_URL=/sign-up \
  --dart-define=REPLAYGLOWZ_PRODUCT_ID=replayglowz \
  --dart-define=REPLAYGLOWZ_LEGACY_PRODUCT_IDS=tubeflow \
  --dart-define=REPLAYGLOWZ_ACCOUNT_CENTER_URL=https://winflows.com/account \
  --dart-define=REPLAYGLOWZ_APP_URL=https://app.replayglowz.com

CONVEX_URL=... \
CLERK_PUBLISHABLE_KEY=... \
CLERK_SIGN_IN_URL=/sign-in \
CLERK_SIGN_UP_URL=/sign-up \
REPLAYGLOWZ_PRODUCT_ID=replayglowz \
REPLAYGLOWZ_LEGACY_PRODUCT_IDS=tubeflow \
REPLAYGLOWZ_ACCOUNT_CENTER_URL=https://winflows.com/account \
REPLAYGLOWZ_APP_URL=https://app.replayglowz.com \
bash build.sh
```

## Environment Variables

Flutter build-time (`--dart-define`) values:

- `CONVEX_URL`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SIGN_IN_URL`
- `CLERK_SIGN_UP_URL`
- `REPLAYGLOWZ_PRODUCT_ID` (`replayglowz`)
- `REPLAYGLOWZ_LEGACY_PRODUCT_IDS` (`tubeflow`)
- `REPLAYGLOWZ_ACCOUNT_CENTER_URL`
- `REPLAYGLOWZ_APP_URL`
- `BUILD_COMMIT_SHA`, `BUILD_ENVIRONMENT`, `BUILD_TIMESTAMP` (optional diagnostics)
- `SENTRY_*` (optional observability)

Vercel server/runtime values:

- `YOUTUBE_OAUTH_CLIENT_ID`
- `YOUTUBE_OAUTH_CLIENT_SECRET`
- `CLERK_SECRET_KEY`
- `SUITE_ENTITLEMENT_VERIFY_URL` (`https://www.winflowz.com/api/bridge/entitlement`)
- `SUITE_ENTITLEMENT_VERIFY_SECRET` (sent as `x-suite-entitlement-secret`)
- `REPLAYGLOWZ_YOUTUBE_OAUTH_TICKET_SECRET` (encrypts the short-lived native/web YouTube OAuth handoff ticket)

See `.env.example` for placeholders.

## Android CI

The Android target is built by `.github/workflows/replayglowz-app-android.yml`
from the monorepo root. It uses Blacksmith runners, path filtering, Flutter/pub
caches, Gradle caches, and uploads a debug APK for manual workflow runs.

Required GitHub configuration:

- `CONVEX_URL` secret
- `FIREBASE_PROJECT_ID` secret
- `FIREBASE_DEV_API_KEY` secret
- `FIREBASE_DEV_APP_ID` secret
- `FIREBASE_DEV_MESSAGING_SENDER_ID` secret
- `FIREBASE_DEV_AUTH_DOMAIN` secret (optional)
- `FIREBASE_DEV_STORAGE_BUCKET` secret (optional)
- `FIREBASE_WEB_CLIENT_ID` secret (optional; used by Google Sign-In)
- `SUITE_IDENTITY_BRIDGE_URL` secret (required for real native product access; the app remains fail-closed without a product token)
- `REPLAYGLOWZ_APP_URL` secret or variable
- `REPLAYGLOWZ_ACCOUNT_CENTER_URL` secret or variable (optional; defaults to `https://winflows.com/account`)
- `SENTRY_DSN` and `SENTRY_ENVIRONMENT` secrets or variables (optional)

Required Vercel runtime configuration for YouTube OAuth also includes
`REPLAYGLOWZ_YOUTUBE_OAUTH_TICKET_SECRET`; without it, OAuth start fails closed
instead of storing raw session tokens in callback cookies.

Play Store release builds are not enabled yet. They need Android keystore
secrets and a signed AAB workflow before publication.

## YouTube OAuth Contract

- `/api/auth/youtube` requires a Clerk session bearer token.
- Handler verifies suite entitlement server-side before redirecting to Google.
- The suite verifier receives the bearer token and returns a redacted entitlement snapshot.
- Callback re-verifies entitlement and only then writes YouTube tokens to product Convex.
- Flow is fail-closed (401/403/503) when session or product access cannot be verified. Recognized accounts without a paid entitlement are expected to pass as `replayglowz/free`.

## Product Convex Backend Contract

The product Convex backend now lives in this monorepo at
`../replayglowz_backend/packages/backend/convex`.

The checker uses that path by default. Set `REPLAYGLOWZ_BACKEND_ROOT` only when
validating another checkout:

```bash
dart run tool/check_shared_backend_contract.dart
```

## Validation

```bash
flutter analyze
flutter test
bash -n build.sh
node --test api/auth/_youtube.test.js
```
