---
artifact: agent_guidance
metadata_schema_version: "1.0"
artifact_version: "1.1.0"
project: "replayglows-app"
created: "2026-04-26"
updated: "2026-05-24"
status: "reviewed"
source_skill: "sf-init"
scope: "agent-guidance"
owner: "Diane"
confidence: "high"
risk_level: "high"
docs_impact: "yes"
security_impact: "high"
linked_systems:
  - "Flutter"
  - "Clerk"
  - "Convex"
  - "WinFlowz suite verifier"
  - "Vercel"
  - "YouTube OAuth"
depends_on: []
supersedes:
  - artifact_version: "1.0.0"
evidence:
  - "AGENT.md"
  - "README.md"
  - "shipglows_data/technical/app/architecture.md"
next_review: "2026-07-25"
next_step: "Keep this file aligned with AGENT.md and shipglows_data/technical/app/architecture.md when auth, entitlement, routing, or deployment contracts change."
---

# CLAUDE.md

Guidance for coding agents working in `replayglows-app`.

## Project overview

ReplayGlows App is a Flutter web client using suite Clerk identity and a ReplayGlows product Convex backend for videos, notes, playlists, transcripts, preferences, and YouTube tokens.

## Architecture invariants

1. Client-only identity is not product access.
2. Product access is server-verified; recognized ReplayGlows accounts default to product-scoped `replayglows/free` access unless explicitly revoked.
3. Canonical product id is `replayglows`; `tubeflow` is legacy alias only.
4. Convex token for product backend comes from the Clerk session token configured by the Clerk Convex integration.
5. OAuth handlers must fail closed when suite verification is unavailable.

## Auth + OAuth model

- `lib/auth/auth_service.dart` manages ClerkJS bootstrap and auth state.
- `web/clerk_bridge.js` exposes browser-side Clerk actions/tokens to Dart.
- `api/auth/youtube.js` verifies Clerk session + entitlement before Google redirect.
- `api/auth/youtube/callback.js` re-verifies entitlement before Convex token save.

## Environment variables

Flutter build-time:

- `CONVEX_URL`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SIGN_IN_URL`
- `CLERK_SIGN_UP_URL`
- `REPLAYGLOWS_PRODUCT_ID`
- `REPLAYGLOWS_LEGACY_PRODUCT_IDS`
- `REPLAYGLOWS_ACCOUNT_CENTER_URL`
- `REPLAYGLOWS_APP_URL`

Server/runtime:

- `YOUTUBE_OAUTH_CLIENT_ID`
- `YOUTUBE_OAUTH_CLIENT_SECRET`
- `CLERK_SECRET_KEY`
- `SUITE_ENTITLEMENT_VERIFY_URL` (`https://www.winflowz.com/api/bridge/entitlement`)
- `SUITE_ENTITLEMENT_VERIFY_SECRET` (sent as `x-suite-entitlement-secret`)

## Commands

```bash
flutter pub get
flutter analyze
bash -n build.sh
node --test api/auth/_youtube.test.js
REPLAYGLOWS_BACKEND_ROOT=/path/to/convex dart run tool/check_shared_backend_contract.dart
```

## Risk areas

- Clerk session restoration and Convex token minting mismatch.
- Missing or stale product access status function in product Convex backend.
- Suite entitlement verifier availability and secret mismatch.
- Hosted callback/cookie behavior differences across Vercel environments.
