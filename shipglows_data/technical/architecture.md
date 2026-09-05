---
artifact: architecture_context
metadata_schema_version: "1.0"
artifact_version: "0.1.6"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-05"
status: "draft"
source_skill: "sf-docs"
scope: "architecture"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
docs_impact: "yes"
security_impact: "yes"
evidence:
  - "README.md"
  - "shipglows_data/technical/app/architecture.md"
  - "shipglows_data/technical/site/architecture.md"
  - "shipglows_data/technical/lab/architecture.md"
linked_systems:
  - "Flutter Web"
  - "Vercel"
  - "Astro"
  - "FastAPI"
  - "Clerk"
  - "Convex"
  - "YouTube OAuth"
external_dependencies:
  - "Clerk"
  - "Convex"
  - "Google OAuth / YouTube API"
  - "Vercel"
  - "Astro"
  - "FastAPI"
  - "yt-dlp"
  - "ffmpeg"
invariants:
  - "AGENTS.md remains a compatibility symlink to AGENT.md."
  - "Astro runtime content frontmatter follows site/src/content.config.ts."
  - "Public site claims stay bounded by app/product contracts and the claim register."
depends_on:
  - "shipglows_data/technical/guidelines.md"
supersedes: []
next_review: "2026-06-10"
next_step: "sg-docs technical audit"
---

# Architecture Context

## System Map

- `app`: Flutter web client with Riverpod, go_router, Clerk auth, Convex client state, Vercel static deployment, and Vercel API handlers for YouTube OAuth.
- `backend`: Convex product backend for ReplayGlows product data, YouTube tokens, preferences, playlists, transcripts, and product access snapshots.
- `site`: Astro static marketing site with English/French routes, blog content collection, public pricing/comparison/trust pages, and app CTA routing through `src/config/site.ts`.
- `ext`: standalone Chrome extension retaining the bundled JavaScript YouTube integration, a TypeScript MV3 worker that serializes local bookmark storage, and connected Vue popup/options surfaces. Vite produces the unpacked package.
- `lab`: FastAPI transcript worker for media download, normalization, provider transcription, health checks, and operational deployment.

## Integration Boundaries

- The ReplayGlows product Convex backend lives inside this monorepo under `backend`.
- Flutter app code under `lib/convex/` is client transport/state, not backend schema or functions.
- Private product Convex reads, writes, and actions must use the shared backend access guard before touching product data or spending YouTube quota. The guard validates the Clerk/Convex identity and an active `replayglows` product-access snapshot; client product-access UI state is not authorization.
- Recognized accounts that receive ReplayGlows free access are represented by a server-owned `productAccessSnapshots` row with `reasonCode=default_free_entitlement`. Revoked snapshots block access and must not be overwritten by the default-free bootstrap.
- Public site content must use app/product contracts as claim boundaries.
- Extension code and packaging are isolated under `ext/`; generated extension output remains disposable and is not a governance source of truth.
- Worker secrets, provider keys, cookies, and raw logs must not be copied into docs.

## Invariants

- `AGENTS.md`, when present, is a compatibility symlink to `AGENT.md`.
- Astro runtime content frontmatter follows `site/src/content.config.ts`.
- YouTube OAuth callback behavior must stay aligned across Flutter app routes and Vercel handlers.

## Dependency Compatibility Review (2026-09-04)

The backend uses Convex 1.45, Firebase Admin 14.3, OpenAI 7.10 and TypeScript 7.0.2. The compiler migration passed through TypeScript 6.0.3; explicit `types: ["node"]` keeps the intended Convex type environment. Node 24 remains the declared host runtime, including extension tooling; Node 26 type declarations do not change that runtime requirement. The OpenAI Responses structured-output path passed a mocked-fetch test and browser-platform bundling, without a live API call.

Astro 7 preserves the site HTML compression policy explicitly. See `../workflow/audits/2026-09-04-dependabot-review.md` for merged PRs, evidence and deferred native/worker migrations. No new mandatory CI gate or protection change was applied.

## Minor Dependency Refresh (2026-09-05)

The approved refresh covers backend, site, extension and Flutter dependencies within their current major versions. Astro is locked at 7.2.9 because the site retains its seven-day minimum release age. See `../workflow/audits/2026-09-05-dependency-refresh.md` for exact scope, verification and remaining risks. The extension packaging and Docker runtime issues found during this refresh were repaired in the subsequent extension/backend maintenance described below.

## Extension Packaging and Backend Security (2026-09-05)

Vite owns all extension manifest assets, and builds verify that every declared resource exists. Docker uses Node 24 and the pinned pnpm lock; Dependabot covers extension npm and Docker dependencies. Isolated Chromium checks cover package loading and mocked content-script injection.

Backend overrides are restricted to `gaxios@6.7.1 -> uuid@11.1.1` and `teeny-request@9.0.0 -> uuid@11.1.1`. These Storage clients use CommonJS `uuid.v4()` for multipart boundaries. `npm run test:dependency-compat` checks actual consumer resolution, buffer-bound rejection, local multipart uploads and Firebase messaging initialization. Remove the overrides once upstream dependencies adopt patched uuid versions; do not broaden them globally. Audit reports zero vulnerabilities for the backend at this check. See `../workflow/audits/2026-09-05-extension-backend-repair.md` for proof and limits.

## Extension Bookmark Runtime (2026-09-05)

`ext/src/content/content.ts` bundles `ext/contentscript.js` as a classic content script. `ext/src/background/background.ts` serializes validated storage operations across tabs and extension pages, with no worker-lifetime data cache. `ext/src/main.ts` mounts the functional Vue popup; options own configurable shortcuts and confirmed JSON replacement/import plus JSON/Markdown export.

The canonical local schema remains a flat `bookmarks` array (`url`, `time`, `formattedTime`, `note`, optional `title`) and derived `groupedBookmarks`. `ext/src/bookmarks.ts` also reads historical options `videoId`/`timestamp` records. Imports validate before mutation; duplicate adds preserve the existing record and show an error. No backend connection, dependency migration or expanded permission grant is introduced. The content match covers the existing YouTube host permission to handle homepage-to-watch SPA navigation.

Canary proof is local to a dedicated profile and selected public YouTube scenarios; it does not establish exhaustive YouTube behavior or operator visual acceptance. See `../workflow/bugs/BUG-2026-09-05-001.md` for the implementation and verification boundary. Docker/package success remains distinct from these browser proofs.
