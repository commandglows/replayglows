---
artifact: reference
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-07-11"
updated: "2026-07-11"
status: active
source_skill: "309-sg-tasks"
scope: "transcript-intelligence-context"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
security_impact: "none"
docs_impact: "yes"
linked_systems:
  - "app"
  - "backend"
  - "lab"
  - "shipflow_data/workflow/TASKS.md"
  - "shipflow_data/workflow/specs/monorepo/replayglowz-learning-behavior-intelligence.md"
depends_on: []
supersedes: []
evidence:
  - "ReplayGlowz backlog now groups several analytics, activation, and transcript-value tasks around one upstream behavior model."
  - "A draft spec already exists under shipflow_data/workflow/specs/monorepo/replayglowz-learning-behavior-intelligence.md."
  - "The term transcript intelligence is used informally, but the broader canonical lane name is Learning Behavior Intelligence."
next_step: "/101-sg-ready replayglowz-learning-behavior-intelligence"
---

# Reference: ReplayGlowz transcript intelligence context

## Why this file exists

This note makes the first intelligence lane easy to rediscover later.

When the shorthand in conversation is `transcript intelligence`, the canonical durable chantier to reopen is:

- `shipflow_data/workflow/specs/monorepo/replayglowz-learning-behavior-intelligence.md`

The broader name matters because the intended model is not only about transcripts. It covers the full path from watch session to reusable learning, with transcript usage as one important signal inside that system.

## Canonical mapping

- Informal label: `transcript intelligence`
- Canonical lane: `Learning Behavior Intelligence`
- Tracker entry: `shipflow_data/workflow/TASKS.md`
- Current next command: `/101-sg-ready replayglowz-learning-behavior-intelligence`

## What this lane is supposed to unlock

This first lane provides the shared contract for:

- transcript impact analysis
- activation and retention analysis tied to learning behavior
- canonical joins across videos, notes, playlists, transcripts, and revisits
- minimum instrumentation for useful product decisions
- later GTM proof that does not overclaim transcript value

## Relation to the other intelligence lanes

Use this lane as the upstream contract when continuing the other branches that were discussed as points `2` and `3`.

- If the work asks `which transcript behavior matters`, route through this spec first.
- If the work asks `which learning behavior predicts activation or retention`, route through this spec first.
- If the work asks `which joins or events must exist before analysis`, route through this spec first.

## Resume checklist

Before coding or instrumenting anything in this lane:

1. Re-open `shipflow_data/workflow/TASKS.md` and the linked spec.
2. Run `/101-sg-ready replayglowz-learning-behavior-intelligence`.
3. Resolve the open decisions around meaningful watch, meaningful revisit, transcript-use event shape, attribution windows, and deletion/privacy rules.
4. Only then open downstream specs for transcript impact, activation/retention, joins, or instrumentation.
