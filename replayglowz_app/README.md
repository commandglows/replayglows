# ReplayGlowz App

Flutter web app for ReplayGlowz, deployed on Vercel.

ReplayGlowz now uses suite Clerk web identity and deny-by-default product entitlement checks. Product data (videos, notes, playlists, transcripts, preferences, YouTube tokens) stays in the ReplayGlowz product Convex backend.

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

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CLERK_SECRET_KEY`
- `SUITE_ENTITLEMENT_VERIFY_URL` (`https://www.winflowz.com/api/bridge/entitlement`)
- `SUITE_ENTITLEMENT_VERIFY_SECRET` (sent as `x-suite-entitlement-secret`)

See `.env.example` for placeholders.

## YouTube OAuth Contract

- `/api/auth/youtube` requires a Clerk session bearer token.
- Handler verifies suite entitlement server-side before redirecting to Google.
- The suite verifier receives the bearer token and returns a redacted entitlement snapshot.
- Callback re-verifies entitlement and only then writes YouTube tokens to product Convex.
- Flow is fail-closed (401/403/503) when session or entitlement cannot be verified.

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
bash -n build.sh
node --test api/auth/_youtube.test.js
```
