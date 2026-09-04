---
artifact: architecture_context
metadata_schema_version: "1.0"
artifact_version: "0.1.2"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-04"
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
- `ext`: standalone Chrome extension surface migrated from `chrome-tubeflowz`, currently retaining the legacy JavaScript YouTube integration alongside a partial Vue/TypeScript/Vite migration.
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
