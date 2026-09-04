---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-04"
updated: "2026-09-04"
status: active
source_skill: sg-docs
scope: governance-navigation
owner: Diane
confidence: high
risk_level: low
security_impact: no
docs_impact: yes
linked_systems: []
depends_on: []
supersedes: []
evidence:
  - "Repository inspection and approved documentation refresh on 2026-09-04."
next_step: "Review when the mapped repository conventions change."
---

# ReplayGlows Governance

## Start Here

All paths below resolve from the monorepo root. One shared corpus governs app, backend, site, ext, and lab. Read only the documents relevant to the current outcome.

| Need | Canonical owner |
| --- | --- |
| Repository entrypoint | `AGENT.md` |
| Architecture and boundaries | `shipglows_data/technical/architecture.md` |
| Path-to-document routing | `shipglows_data/technical/code-docs-map.md` |
| Runtime and proof conventions | `shipglows_data/technical/operating-conventions.md` |
| Business / product / brand / GTM | Matching existing `business/`, `product/`, `branding/`, `gtm/` theme in this corpus |
| Public claims and page ownership | `shipglows_data/editorial/content-map.md`, `shipglows_data/editorial/claim-register.md` |
| Implementation backlog / audit history | `shipglows_data/workflow/TASKS.md`, `shipglows_data/workflow/AUDIT_LOG.md` |
| Public-content backlog | `shipglows_data/editorial/ROADMAP.md` |
| Bugs / specs / historical records | `shipglows_data/workflow/bugs/`, `specs/`, `archives/` |

## Evidence and Preservation

A recorded pass describes its original run. Do not infer that old tasks, dependency audits, deployed behavior, or product promises were verified again by a documentation refresh. Historical `source_skill` values identify provenance, not commands to execute now.

Shared contracts remain in their existing theme; retain surface deltas when their implementation or audience differs. Do not flatten product, technical, or editorial differences merely to remove files.

## Maintenance Rule

Update this index when ownership or canonical destinations change. Keep metadata on governed contracts and omit it from fast-moving operational trackers.
