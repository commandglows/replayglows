---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-04"
updated: "2026-09-04"
status: reviewed
source_skill: sg-docs
scope: documentation-convention-refresh
owner: Diane
confidence: high
risk_level: low
security_impact: no
docs_impact: yes
linked_systems: []
depends_on: []
supersedes: []
evidence:
  - "Governance topology: compliant."
  - "Metadata lint passed on root/surface governed entrypoints and the canonical corpus."
  - "Task text/status preservation and exact tracker snapshot checks passed."
  - "git diff --check passed; only Markdown tracked files changed."
next_step: "Refresh dependency inventory and advisories before selecting upgrades."
---

# Documentation Convention Refresh — 2026-09-04

## Outcome and Boundary

Aligned repository navigation, current operational guidance, documentation check commands, and backlog ownership with the active ShipGlows checkout. The user approved the documentation plan and explicitly clarified that Linux runner paths are legitimate. No dependency, CI workflow, runtime source, secret, or deployment configuration was modified. Existing untracked surface ENVIRONMENT files were excluded.

## Preservation Ledger

| Source | Canonical destination / decision | Preserved content and final state |
| --- | --- | --- |
| app/TASKS.md | workflow/TASKS.md; exact source in workflow/archives/2026-09-04-app-TASKS.md | Two completed performance tasks already exist centrally; pagination remains centrally in_progress. The stale local todo does not override it. Source becomes a compatibility entrypoint. |
| app/AUDIT_LOG.md | workflow/AUDIT_LOG.md; exact source in workflow/archives/2026-09-04-app-AUDIT_LOG.md | The 2026-06-12 Android performance audit already exists centrally with matching grade/counts. Source becomes a compatibility entrypoint. |
| workflow/TASKS.md editorial rows | editorial/ROADMAP.md | Public-claim alignment and GTM proof tasks retain their wording/status; only next-action routing is modernized. Mixed implementation decisions stay in TASKS. |
| Shared and surface contracts | Existing technical, business, product, branding, GTM and editorial themes | Retained as scoped contracts; no bulk merge or product-decision rewrite. Historical source_skill and run evidence remain provenance. |
| AGENTS.md and ext/AGENTS.md | Existing Git symlink targets AGENT.md | Already mode 120000 in Git. Restored Windows materialization only; no repository link migration. |

Paths in the table are relative to shipglows_data unless prefixed app/ or ext/.

## Corrections and Evidence

- Product backend ownership: backend/packages/backend/convex and the existing app checker agree; alternate-checkout override remains optional.
- Worker youtube_captions: server.py explicitly rejects it for direct handling by Convex; worker guidance now distinguishes request-model acceptance from execution support.
- Node/site commands: site/package.json and .nvmrc own the current requirement/pin; root setup uses the site's pnpm lock workflow.
- Linux remains valid: CI runner labels, Docker, PM2 and Flox commands were preserved. Only generic documentation commands resolve ShipGlows through the active root and repo-relative targets.
- Metadata repair: BUG-2026-06-02-001 received a schema-compatible active version; BUG-2026-06-20-002 reproducibility became intermittent from its existing report. Neither bug was retested or closed.

## Proof and Limits

Topology, metadata, canonical reference, task preservation, exact archive content, symlink mode, and whitespace checks passed. Application tests/builds were not necessary for documentation-only changes. Historical feature, security, dependency, and production proof is not refreshed by these checks.

The DevServer registry inspection showed all four surfaces stopped with port 0; durable environment files report pending assignment. No target/session/URL was invented or started. Delivery posture remains undeclared; existing hosted validation mode and current Git policy are preserved. Branch/protection policy changes require a separate resolved decision.

## Reflection

Documentation: updated — entrypoints, technical map, conventions, metadata, tracker ownership and preservation.
Editorial: updated — repository onboarding/setup guidance and editorial routing only; product marketing claims remain unchanged and their existing backlog is retained.
Changelog: internal-only — documentation/governance maintenance, not a public feature release.

## Next Action

Refresh dependency inventory/advisories across app, backend, site, ext, and lab before proposing upgrades. Old advisory counts must not be reused as current findings.
