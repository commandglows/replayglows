---
artifact: technical_module_context
metadata_schema_version: "1.0"
artifact_version: "0.1.0"
project: "replayglowz"
created: "2026-05-10"
updated: "2026-05-10"
status: "draft"
source_skill: sf-docs
scope: "code-docs-map"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "app"
  - "site"
  - "lab"
depends_on:
  - "shipglows_data/technical/architecture.md"
  - "shipglows_data/technical/guidelines.md"
supersedes: []
evidence:
  - "rg --files"
next_review: "2026-06-10"
next_step: "/sf-docs technical audit"
---

# Code Docs Map

## Purpose

Route changed paths to the technical docs and validation commands that must be checked before shipping.

## Map

| Path pattern | Subsystem | Primary doc | Validation | Docs update trigger |
| --- | --- | --- | --- | --- |
| `app/lib/**` | Flutter app | `shipglows_data/technical/app/architecture.md` | `(cd app && flutter analyze)` | Auth, routing, Convex client, screens, models, providers, i18n, or widget behavior changes. |
| `app/api/**` | Vercel YouTube OAuth handlers | `shipglows_data/technical/app/architecture.md` | `(cd app && node --test api/auth/_youtube.test.js)` | OAuth request/return flow, cookie handling, token exchange, Clerk, or Convex mutation behavior changes. |
| `app/build.sh`, `app/vercel.json`, `app/.env.example` | Flutter app deployment | `app/README.md` | `(cd app && bash -n build.sh)` | Build variables, Vercel routing, install/build commands, or deployment headers change. |
| `backend/packages/backend/convex/**` | ReplayGlowz product Convex backend | `shipglows_data/technical/architecture.md` | `(cd backend/packages/backend && npm run typecheck)` | Schema, auth provider, product access, YouTube tokens, settings, videos, playlists, notes, transcripts, or function names change. |
| `site/src/pages/**`, `site/src/components/**`, `site/src/i18n/**` | Astro public site | `shipglows_data/technical/site/architecture.md` | `(cd site && npm run build)` | Public route, CTA, pricing, claim, i18n, layout, or component changes. |
| `site/src/content.config.ts`, `site/src/content/**` | Astro runtime content | `shipglows_data/editorial/astro-content-schema-policy.md` | `(cd site && npm run build)` | Content schema or blog frontmatter changes. |
| `lab/server.py`, `lab/main.py` | Transcript worker | `shipglows_data/technical/lab/architecture.md` | `(cd lab && python -m py_compile main.py server.py)` | API contract, auth, limits, providers, queueing, media handling, or health behavior changes. |
| `lab/.env.example`, `lab/Dockerfile`, `lab/ecosystem.config.cjs` | Worker deployment | `lab/README.md` | `(cd lab && python -m py_compile main.py server.py)` | Runtime variables, container, PM2, or worker deployment model changes. |
| `README.md`, `AGENT.md`, `shipglows_data/**` | Monorepo governance | `shipglows_data/technical/README.md` | `/home/claude/shipglows/tools/shipglows_metadata_lint.py AGENT.md shipglows_data` | Repository layout, governance, source-of-truth, or cross-project routing changes. |

## Documentation Update Plan

- Code changed: `[path/or/pattern]`
- Subsystem: `[name]`
- Primary technical doc: `[path]`
- Secondary docs: `[path or none]`
- Required action: `[none|review|update|create]`
- Priority: `[low|medium|high]`
- Reason: `[why this doc is impacted]`
- Owner role: `[executor|integrator]`
- Parallel-safe: `[yes|no]`
- Notes: `[constraints or blockers]`

## Maintenance Rule

Update this map when major paths, validation commands, source-of-truth docs, public APIs, auth flows, deployment boundaries, or runtime content schemas change.
