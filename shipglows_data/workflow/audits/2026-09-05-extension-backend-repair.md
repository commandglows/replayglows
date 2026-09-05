---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
status: reviewed
source_skill: shipglows
scope: extension-packaging-backend-security
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: []
depends_on: []
supersedes: []
evidence:
  - "Extension typecheck/build, frozen install and manifest-resource checks passed."
  - "Isolated Chromium: service worker, popup, options, mocked content injection and Tinykeys module passed."
  - "Backend typecheck and three dependency compatibility tests passed; npm audit zero."
next_step: "Validate Docker on a running Linux daemon and continue separately scoped major migrations."
---

# Extension Packaging and Backend Security — 2026-09-05

## Changes

- Extension CSS generation is part of Vite asset emission, so output cleanup no longer deletes the manifest stylesheet. Both clean builds and build-watch use the same plugin.
- Tinykeys' installed ESM entry is emitted at the existing public resource URL, preserving the manifest contract. No permission expansion or bookmark-feature migration was introduced.
- Both build entrypoints verify declared manifest resources. A negative check temporarily withheld the generated CSS and confirmed rejection, then restored it; the intact package passes all six resource checks.
- Extension tooling now pins pnpm 11.24.0. The Dockerfile uses Node 24, frozen pnpm dependencies and build-watch mode; Docker context excludes host node_modules, generated dist and environment files. Dependabot now covers extension npm and Docker with weekly schedules.
- Backend overrides only `uuid` beneath `gaxios@6.7.1` and `teeny-request@9.0.0`, pinning 11.1.1. Firebase Admin stays at 14.3.0; no forced downgrade or global uuid replacement was applied.

## Security reasoning and regression proof

The remaining audit entries were the [uuid buffer-bound advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) propagated through the optional Google Storage tree. Source inspection found only `uuid.v4()` multipart-boundary use in the two affected HTTP clients; the advisory concerns caller-supplied buffers in other UUID variants. Version 11.1.1 supplies the fix while retaining CommonJS exports, unlike uuid 12+. The [upstream changelog](https://github.com/uuidjs/uuid/blob/main/CHANGELOG.md) and published package exports were reviewed.

The committed `npm run test:dependency-compat` verifies actual Storage consumer resolution to patched uuid, UUID v4 format, buffer-bound rejection, multipart transmission by both HTTP clients to a short-lived loopback test server, and Firebase messaging initialization without credentials or sending a notification. All three tests and the backend typecheck pass. `npm audit` reports zero vulnerabilities. Keep these checks while overrides remain; remove the overrides when upstream ranges accept patched versions.

## Extension verification and limits

TypeScript/Vue checks, build and frozen installation passed. An initial watch build and a CSS-triggered rebuild both retained all manifest assets. A clean backend npm ci also reproduced all three compatibility test passes. In a fresh headless Chromium profile, the extension service worker started, popup and options rendered without JavaScript errors, the content script injected on a locally mocked YouTube watch page, and Tinykeys loaded from its packaged URL. The test profiles were closed; no personal browser profile, live YouTube account or product server was used.

The legacy bookmark implementation remains outside the current TypeScript entrypoints. These checks establish packaging and loading, not full bookmark functionality. No real YouTube end-to-end claim is made.

Docker Linux was unavailable (`dockerDesktopLinuxEngine` pipe missing), so the corrected image was not built. The Docker verification remains an explicit follow-up. Major app/worker migrations and the three existing Dependabot PRs remain separate. No CI gate or branch-protection setting was added.
