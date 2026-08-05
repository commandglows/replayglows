---
artifact: business_context
metadata_schema_version: "1.0"
artifact_version: "0.1.0"
project: "replayglows"
created: "2026-05-10"
updated: "2026-05-10"
status: "draft"
source_skill: "sf-docs"
scope: "business"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
business_model: "LTD offer plus recurring subscription, with app-level pricing and entitlement truth owned by app."
market: "Bilingual English/French web audience for learning-centric YouTube workflows."
target_audience: "Solo creators, students, educators, and learning-driven professionals who use YouTube for structured learning and ongoing veille."
value_proposition: "Turn YouTube watch time into organized, timestamped, revisitable learning workflows."
docs_impact: "yes"
security_impact: "unknown"
evidence:
  - "README.md"
  - "shipglows_data/business/app/business.md"
  - "shipglows_data/business/site/business.md"
  - "shipglows_data/business/lab/business.md"
depends_on:
  - "shipglows_data/product/product.md"
supersedes: []
next_review: "2026-06-10"
next_step: "/sf-docs audit"
---

# Business Context

## Mission

ReplayGlows helps learning-focused YouTube users turn watch sessions into structured notes, playlists, retrieval, and review workflows.

## Monorepo Role

This repository consolidates four active surfaces:

- `app`: the authenticated Flutter application and primary product contract.
- `site`: the public acquisition and education site.
- `ext`: the browser extension integrated into the ReplayGlows product surface.
- `lab`: the transcript worker and backend experimentation surface.

## Audience

The documented audience is solo creators, students, educators, and learning-driven professionals who use video for learning, curation, or ongoing veille.

## Business Model

The subproject contracts describe an LTD offer plus recurring subscription. Pricing, entitlement, and packaging decisions must remain aligned with the app contract before they are promoted on public pages.

## Decision Boundary

This root contract coordinates the monorepo. Product-level truth remains in `app`; public claims are routed through `site`; extension behavior and packaging are routed through `ext`; transcript-worker operational claims are routed through `lab`.
