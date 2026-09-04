---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "0.1.1"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-04"
status: "draft"
source_skill: sf-docs
scope: "technical"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "shipglows_data/technical/code-docs-map.md"
depends_on:
  - "shipglows_data/technical/architecture.md"
  - "shipglows_data/technical/guidelines.md"
supersedes: []
evidence:
  - "README.md"
next_step: "sg-docs technical audit"
---

# Technical Governance

This directory maps code areas to the documentation that must be checked when implementation changes.

## Files

- `architecture.md`: monorepo architecture and integration boundaries.
- `guidelines.md`: engineering and documentation rules across subprojects.
- `operating-conventions.md`: host boundaries, managed sessions, documentation proof, and delivery constraints.
- `code-docs-map.md`: path-to-doc routing for technical updates.

## Maintenance Rule

Update this layer when a subproject is added, removed, renamed, or changes its validation commands, runtime boundaries, auth, public API, or deployment model.
