---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "0.1.0"
project: "replayglows"
created: "2026-05-10"
updated: "2026-05-10"
status: "draft"
source_skill: sf-docs
scope: "repository_guidance"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "app"
  - "backend"
  - "site"
  - "lab"
  - "ext"
depends_on:
  - "shipglows_data/technical/architecture.md"
  - "shipglows_data/technical/guidelines.md"
supersedes: []
evidence:
  - "README.md"
  - "app/AGENT.md"
  - "site/AGENT.md"
  - "lab/AGENT.md"
  - "ext/AGENT.md"
next_step: "/sf-docs audit"
---

# AGENT

## Purpose

This repository is the canonical ReplayGlows monorepo for the Flutter app, product Convex backend, Astro marketing site, browser extension, and transcript worker.

## Repository Layout

- `app/`: Flutter web app, Vercel API handlers for YouTube OAuth, and app-level product contracts.
- `backend/`: ReplayGlows product Convex backend for product data, YouTube tokens, preferences, playlists, transcripts, and product access snapshots.
- `site/`: Astro public marketing site, blog, pricing, comparison, privacy, and terms pages.
- `ext/`: standalone Chrome extension source, Vue/Vite migration, legacy YouTube integration, and extension packaging.
- `lab/`: FastAPI transcript worker and operational tooling.
- `shipglows_data/`: monorepo-level governance contracts and documentation maps.

## Working Rules

- Treat subproject contracts as source evidence, not as files to rewrite casually from the root.
- Keep product claims aligned with `app` contracts before changing public site copy.
- Preserve Astro runtime content frontmatter in `site/src/content/**`; do not add ShipGlows metadata there unless `src/content.config.ts` is changed first.
- Do not touch unrelated dirty files when updating docs.
- Prefer canonical root surface names: `app/`, `backend/`, `site/`, `ext/`, `lab/`.

## Validation

Use focused checks from the changed subproject:

```bash
(cd app && flutter analyze)
(cd backend/packages/backend && npm run typecheck)
(cd site && npm run build)
(cd ext && pnpm type-check)
(cd lab && python -m py_compile main.py server.py)
```

Run ShipGlows metadata validation for governance docs:

```bash
/home/claude/shipglows/tools/shipglows_metadata_lint.py AGENT.md shipglows_data
```
