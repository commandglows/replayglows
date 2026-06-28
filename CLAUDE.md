# CLAUDE.md

This file provides root-level guidance for agents working in the ReplayGlowz monorepo.

## Project Overview

- `app/`: Flutter web app and Vercel API handlers.
- `backend/`: Convex backend package and product data contracts.
- `site/`: Astro public marketing site.
- `lab/`: FastAPI transcript worker.
- `shipflow_data/`: project governance, workflow, audit, task, and spec artifacts.

## ShipFlow Development Mode

- development_mode: vercel-preview-push
- validation_surface: vercel-preview
- ship_before_preview_test: yes
- post_ship_verification: sf-prod
- deployment_provider: vercel
- preview_source: Vercel MCP deployment target_url
- production_url: unknown
- notes: Web validation should go through the Vercel build/preview flow for now; local checks are useful preflight but are not authoritative for browser/deployed behavior.
- last_reviewed: 2026-05-15

## Validation

Use focused checks from the changed subproject:

```bash
(cd app && flutter analyze)
(cd backend/packages/backend && npm run typecheck)
(cd site && npm run build)
(cd lab && python3 -m py_compile main.py server.py)
```

Run ShipFlow metadata validation for governance docs:

```bash
/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENT.md shipflow_data
```
