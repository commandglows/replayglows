---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
status: reviewed
source_skill: sg-development
scope: major-dependency-migrations
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: []
depends_on: []
supersedes: []
evidence:
  - "Flutter analysis, 50 tests, and the shared backend contract passed."
  - "Backend typecheck and uuid compatibility tests passed."
  - "Extension typecheck and package verification passed."
next_step: "Provision Perl for the existing Convex Rust Android binding, then verify native sign-in and recording."
---

# Major Dependency Migrations — 2026-09-05

## Applied updates

- Flutter: Firebase Core 4.14.0, Firebase Auth 6.6.1, Firebase Messaging 16.6.0, Google Sign-In 7.2.0, record 7.1.1, go_router 18.0.1, cached_network_image 4.0.0, and shimmer 4.0.0.
- Google Sign-In now uses its required singleton, one-time initialization, and `authenticate` API. Firebase receives the returned ID token; the removed access-token field is not passed.
- Backend: Svix 2.3.0 verifies webhook signatures before parsing the verified JSON body. The consumer-scoped uuid overrides and their compatibility tests remain unchanged.
- Extension: globals 17.12.0. TypeScript stays on 5.9.3 because the installed ESLint TypeScript parser supports TypeScript below 6.1.

## Verification

- `flutter analyze`, all 50 Flutter tests, and the shared backend-contract check passed.
- Backend `npm run typecheck` and all three `npm run test:dependency-compat` cases passed. The package audit reported zero vulnerabilities during installation.
- Extension `pnpm type-check` and `pnpm build:ext` passed, including verification of all six declared manifest resources.

## Android proof limit

`flutter run -d emulator-5554` reached the Android native build and the `convex_flutter` Rust binding. Its vendored OpenSSL build failed because `perl` is unavailable on this Windows host. No APK was installed, so login, cancellation, sign-out, microphone permission, recording, and playback remain unverified. Gradle also reported future-support warnings for Gradle 8.14, AGP 8.11.1, and Kotlin 2.2.20; no build-system versions were changed in this migration.
