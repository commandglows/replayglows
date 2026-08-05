---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglows"
created: "2026-07-11"
created_at: "2026-07-11 00:00:00 UTC"
updated: "2026-07-11"
updated_at: "2026-07-11 00:00:00 UTC"
status: draft
source_skill: 100-sg-spec
source_model: "GPT-5 Codex"
scope: "learning-behavior-intelligence"
owner: "Diane"
user_story: "En tant que mainteneur de ReplayGlows, je veux comprendre quels comportements transforment une session YouTube en apprentissage réutilisable, afin de prioriser le produit et l'intelligence transcript sur des signaux observables."
confidence: "medium"
risk_level: "high"
security_impact: "medium"
docs_impact: "yes"
linked_systems:
  - "app"
  - "backend"
  - "transcript worker"
  - "Convex product data"
  - "analytics/instrumentation"
depends_on:
  - artifact: "shipglows_data/product/app/product.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipglows_data/technical/app/architecture.md"
    artifact_version: "0.1.0"
    required_status: "draft"
supersedes: []
evidence:
  - "Le tracker ReplayGlows identifie l'apprentissage structure comme promesse centrale, mais aucun modèle comportemental canonique n'est encore validé."
  - "Les surfaces existantes exposent déjà vidéos, watch progress, notes horodatées, playlists, transcripts, jobs et notifications."
  - "Les travaux transcript intelligence des points 2 et 3 doivent pouvoir réutiliser les mêmes événements, identifiants et jointures."
  - "La référence shipglows_data/workflow/references/replayglows-transcript-intelligence-context.md rattache explicitement le raccourci transcript intelligence à ce chantier canonique."
next_step: "/101-sg-ready replayglows-learning-behavior-intelligence"
---

# Spec: ReplayGlows Learning Behavior Intelligence

## Title

ReplayGlows learning behavior intelligence

## Aliases

- Transcript intelligence
- Learning behavior intelligence

## Status

Draft. This document prepares the context for the first intelligence lane; it is not an implementation authorization.

## Problem

ReplayGlows currently has product data that can describe consumption and capture, but not yet a shared definition of learning value. Without that definition, transcript analysis, activation/retention analysis, and product decisions risk using different event names, joins, and proxy metrics.

## Intended Outcome

Establish a small, privacy-aware behavioral model that can answer:

- Which actions indicate a user is turning a video into reusable knowledge?
- Which transcript interactions lead to notes, retrieval, or revisits?
- Which behaviors compound across sessions rather than only increasing session volume?
- Which signals are trustworthy enough for product decisions or later public proof?

## Minimal Behavior Contract

The model must distinguish passive consumption from learning-value actions. It should connect a user, video, watch session, timestamped note, playlist or feed organization, transcript job/version/use, revisit, and explicit feedback without requiring dashboard-specific ad hoc joins. Events must be attributable to an authenticated user, idempotent where retries are possible, and safe to aggregate without exposing transcript text or user content unnecessarily.

## Scope In

- Canonical entities and identifiers for `user`, `video`, `watch_session`, `note`, `timestamp_anchor`, `playlist`, `transcript_job`, `transcript_version`, `transcript_use`, `revisit_event`, and `feedback_event`.
- Definitions for learning-value milestones: first meaningful watch, first timestamped note, first organization action, first transcript use, first revisit, and durable learning loop.
- Canonical joins and time windows for activation, retention, transcript impact, and segmentation analysis.
- Minimum event instrumentation and source-of-truth triggers, including deduplication and noise guardrails.
- Privacy, retention, access-control, and aggregation constraints for analytics derived from notes and transcripts.
- Input contract for the future exploratory analytics workspace and decision-support layer.

## Scope Out

- Implementing analytics dashboards or a BI platform.
- Choosing a transcript provider or changing transcript generation behavior.
- Rewriting existing Convex schemas before the event and join contract is ready.
- Public marketing claims, pricing changes, or customer-facing learning scores.
- Automated recommendations or user profiling beyond the minimum product analytics needed for validation.

## Decisions Required Before Ready

1. Define what counts as a meaningful watch and a meaningful revisit; avoid treating every open, seek, or background play as learning.
2. Decide whether transcript viewing, search, copy, and note creation are separate events or one normalized interaction with typed actions.
3. Set attribution windows between transcript use, note creation, revisit, and retention outcomes.
4. Define whether playlist/feed organization is a learning signal, a retrieval signal, or both.
5. Specify deletion/export behavior for derived analytics when a user deletes notes, videos, or their account.
6. Select the minimum event set that can validate the model without instrumenting every UI interaction.

## Success Criteria

- A single glossary defines the entities, events, milestone rules, and canonical joins used by later transcript and product intelligence work.
- The model supports activation and retention cuts without relying on generic app-open or session-count metrics alone.
- Transcript impact can be measured against note creation, retrieval, revisit, latency, and provider cost while separating correlation from product claims.
- Every proposed event has an owner, source-of-truth trigger, deduplication rule, privacy classification, and retention policy.
- The contract can be implemented incrementally against current app/backend data, with explicit gaps recorded rather than silently inferred.

## Risks and Guardrails

- Do not call a user "learning" based only on watch time, transcript generation, or a single note.
- Do not persist raw transcript text or note content in aggregate analytics unless the product contract explicitly requires it.
- Keep provider cost and latency separate from user learning outcomes; a faster transcript is not automatically more valuable.
- Treat correlations as hypotheses until cohort size, attribution windows, and confounders are documented.
- Avoid instrumentation that materially degrades app performance or creates a shadow source of truth beside existing product records.

## Expected Follow-up Specs

- Exploratory analytics workspace.
- Learning activation and retention intelligence.
- Transcript learning impact model.
- Canonical learning graph joins.
- Learning event instrumentation.

## Current Chantier Flow

| Stage | Status | Notes |
|-------|--------|-------|
| 100-sg-spec | in_progress | Draft context prepared from the existing ReplayGlows intelligence backlog. |
| 101-sg-ready | pending | Resolve entity, event, privacy, and attribution decisions before implementation. |
| 102-sg-start | pending | Do not implement instrumentation or schema changes before readiness. |
| 103-sg-verify | pending | Verify contract coherence, data safety, and implementation evidence. |

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-07-11 00:00:00 UTC | 309-sg-tasks | GPT-5 Codex | Added the first intelligence-lane spec and linked the operational task tracker. | draft spec created | `/101-sg-ready replayglows-learning-behavior-intelligence` |
| 2026-07-11 00:00:00 UTC | 309-sg-tasks | GPT-5 Codex | Added an explicit transcript-intelligence reference and updated the tracker entry so this chantier is easier to rediscover from backlog wording. | tracker alias + reference added | `/101-sg-ready replayglows-learning-behavior-intelligence` |
