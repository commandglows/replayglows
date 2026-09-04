---
artifact: technical_guidelines
metadata_schema_version: "1.0"
artifact_version: "0.1.1"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-04"
status: "draft"
source_skill: "sf-docs"
scope: "guidelines"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
docs_impact: "yes"
security_impact: "yes"
evidence:
  - "shipglows_data/technical/app/guidelines.md"
  - "shipglows_data/technical/site/guidelines.md"
  - "shipglows_data/technical/lab/guidelines.md"
  - "app/pubspec.yaml"
  - "site/package.json"
  - "lab/requirements.in"
linked_systems:
  - "Flutter"
  - "Dart"
  - "Astro"
  - "Node.js"
  - "FastAPI"
  - "Python"
  - "Clerk"
  - "Convex"
  - "Vercel"
depends_on:
  - "AGENT.md"
supersedes: []
next_review: "2026-06-10"
next_step: "sg-docs technical audit"
---

# Technical Guidelines

## General

- Work inside the affected subproject and run focused validation from that directory.
- Keep root documentation as coordination context; keep implementation-specific guidance in subproject docs.
- Preserve existing reviewed contracts unless the code or user decision clearly changes them.

## Flutter App

- Use build-time `--dart-define` values for Flutter web configuration.
- Keep Clerk session handling and Convex JWT minting aligned with `app/README.md` and `shipglows_data/technical/app/architecture.md`.
- The product Convex backend is owned by this monorepo at `backend/packages/backend/convex`. The app checker resolves it by default; `REPLAYGLOWS_BACKEND_ROOT` is an optional alternate checkout. The suite entitlement service remains a separate integration boundary.

## Astro Site

- Route URLs, CTA destinations, and public domains through `site/src/config/site.ts`.
- Preserve Astro content collection schemas before editing blog frontmatter.
- Keep English and French public promises aligned.

## Transcript Worker

- Keep the worker narrow: receive transcript jobs, process audio, return transcript payloads, and expose health/limit signals.
- Never document real secrets, provider tokens, cookies, or raw private logs.
