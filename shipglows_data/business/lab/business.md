---
artifact: business_context
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "lab"
created: "2026-04-26"
updated: "2026-04-27"
status: "reviewed"
source_skill: sf-docs
scope: "business"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
docs_impact: "yes"
security_impact: "none"
evidence:
  - "README.md"
  - "server.py"
  - "requirements.txt"
business_model: "Backend and experimental transcript worker supporting ReplayGlows operations; user-facing monetization is owned by replayglows-app."
market: "Internal backend capability for ReplayGlows transcript processing."
target_audience: "ReplayGlows operators, developers, and experimenters maintaining transcript execution."
value_proposition: "Offload heavy transcript jobs from the app layer while keeping provider flexibility and operational controls."
depends_on: []
supersedes: []
next_review: "2026-05-26"
next_step: "Keep user-facing business decisions aligned with replayglows-app product truth."
---

# shipglows_data/business/lab/business.md

## Decision Boundary

`lab` is a backend and experimental repository. User-facing product strategy, packaging, and monetization truth are owned by `replayglows-app`.

## Working Business Summary

This repository exists to execute transcript workloads that are heavy for orchestration code. The direct business value is operational reliability for transcript generation, controlled runtime behavior, and easier maintenance of provider integrations.

## Primary Internal Customer

- ReplayGlows operators who need stable transcript execution in production.
- Developers who integrate transcript jobs into the parent product pipeline.

## Value Delivered By This Repository

- Offloads CPU- and IO-heavy transcript work from the app layer.
- Supports multiple transcription providers behind a narrow worker contract.
- Exposes health, limits, and runtime controls for safer operations.
- Helps isolate failures linked to media extraction and external providers.

## Constraints Visible In Code

- Long jobs and large media can create cost and runtime pressure.
- Concurrency and timeout values are explicit risk controls.
- Some videos require authenticated cookie-backed extraction.
- Provider cost values in this repo are operational estimates, not customer pricing.

## Non-Goals

- Not a standalone end-user product.
- Not the source of truth for pricing, GTM, or public product narrative.
- Not a generic media-processing platform outside ReplayGlows transcript needs.
