---
artifact: technical_module_context
metadata_schema_version: "1.0"
artifact_version: "0.2.0"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-05"
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
  - "ext"
  - "lab"
depends_on:
  - "shipglows_data/technical/architecture.md"
  - "shipglows_data/technical/guidelines.md"
supersedes: []
evidence:
  - "rg --files"
next_review: "2026-06-10"
next_step: "sg-docs technical audit"
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
| `backend/packages/backend/convex/**` | ReplayGlows product Convex backend | `shipglows_data/technical/architecture.md` | `(cd backend/packages/backend && npm run typecheck)` | Schema, auth provider, product access, YouTube tokens, settings, videos, playlists, notes, transcripts, or function names change. |
| `site/src/pages/**`, `site/src/components/**`, `site/src/i18n/**` | Astro public site | `shipglows_data/technical/site/architecture.md` | `(cd site && npm run build)` | Public route, CTA, pricing, claim, i18n, layout, or component changes. |
| `site/src/content.config.ts`, `site/src/content/**` | Astro runtime content | `shipglows_data/editorial/astro-content-schema-policy.md` | `(cd site && npm run build)` | Content schema or blog frontmatter changes. |
| `ext/src/**`, `ext/*.js`, `ext/public/manifest.json`, `ext/vite.config.ts`, `ext/package.json` | Chrome extension | `ext/AGENT.md`, `shipglows_data/technical/architecture.md` | `(cd ext && pnpm type-check)` and `(cd ext && pnpm build:ext)` | Extension behavior, YouTube content integration, manifest permissions, extension packaging, or build entrypoints change. |
| `ext/src/playback/**`, `ext/src/popup/**`, `ext/scripts/playback*` | Universal playback and popup | `shipglows_data/product/ext/product.md`, `ext/AGENT.md`, `shipglows_data/workflow/specs/monorepo/2026-09-05-extension-universal-playback.md` | Typecheck/build; `node --test scripts/playback-state.test.mjs scripts/playback-media.test.mjs` from `ext`; packaged `scripts/playback-browser.mjs` for runtime changes (requires `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM`) | Global/pin context, media targeting, temporary loops, shortcut safety, persistence or popup behavior changes. |
| `lab/server.py`, `lab/main.py` | Transcript worker | `shipglows_data/technical/lab/architecture.md` | `(cd lab && python -m py_compile main.py server.py)` | API contract, auth, limits, providers, queueing, media handling, or health behavior changes. |
| `lab/.env.example`, `lab/Dockerfile`, `lab/ecosystem.config.cjs` | Worker deployment | `lab/README.md` | `(cd lab && python -m py_compile main.py server.py)` | Runtime variables, container, PM2, or worker deployment model changes. |
| `README.md`, `AGENT.md`, `shipglows_data/**` | Monorepo governance | `shipglows_data/technical/README.md` | `python3 "$SHIPGLOWS_ROOT/tools/shipglows_metadata_lint.py" AGENT.md shipglows_data` | Repository layout, governance, source-of-truth, or cross-project routing changes. |

## Governance Routing

- `AGENT.md`, root/surface `CLAUDE.md`, and compatibility entrypoints route through `shipglows_data/technical/operating-conventions.md`.
- `shipglows_data/README.md` owns corpus navigation; `shipglows_data/technical/README.md` owns technical navigation.
- Execution and editorial tracker changes require semantic preservation review, not application builds.
- Linux commands in the table assume Bash and a resolved `SHIPGLOWS_ROOT`; see operating conventions for PowerShell equivalents.

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
