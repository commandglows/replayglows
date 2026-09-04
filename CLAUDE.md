# CLAUDE.md

This file provides root-level guidance for agents working in the ReplayGlows monorepo.

## Project Overview

- `app/`: Flutter web app and Vercel API handlers.
- `backend/`: Convex backend package and product data contracts.
- `site/`: Astro public marketing site.
- `ext/`: browser extension source and packaging.
- `lab/`: FastAPI transcript worker.
- `shipglows_data/`: project governance, workflow, audit, task, and spec artifacts.

## ShipGlows Development Mode

- development_mode: vercel-preview-push
- validation_surface: vercel-preview
- ship_before_preview_test: yes
- post_ship_verification: sg-release verify
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

Run ShipGlows metadata validation for governance docs:

```bash
python3 "$SHIPGLOWS_ROOT/tools/shipglows_metadata_lint.py" AGENT.md shipglows_data
```

## Canonical Guidance

Read `AGENT.md` and `shipglows_data/technical/operating-conventions.md` first. The hosted validation mode above remains the recorded project policy; a managed local session supplies development feedback, not hosted OAuth or production proof. Delivery posture is not yet declared; do not infer product maturity or alter branch/deployment policy from the presence of a URL.
