---
artifact: technical_guidelines
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-04"
updated: "2026-09-04"
status: active
source_skill: sg-docs
scope: operating-conventions
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
next_review: "2026-12-04"
next_step: "Review when the mapped repository conventions change."
---

# Operating Conventions

## Scope and Reader

Read before starting runtime work, choosing proof, or updating governance. These rules cover the whole monorepo; surface AGENT files retain their domain invariants.

## Host and Runtime Boundaries

- Windows local development and Linux CI/worker execution are separate, valid environments. Preserve Linux runner labels, Bash scripts, Flox paths, Docker paths, and PM2 commands where those environments own execution.
- Resolve ShipGlows tools from the active `SHIPGLOWS_ROOT`, including its Windows user-level linked development channel. A historical `/home/claude/shipglows` path is not a universal installation requirement.
- Before local tools or server work, read the host `.shipglows/environment.md`. When CLI capabilities are needed, inspect the bounded `cli-capabilities.v1.json` snapshot without executing the CLI merely to discover it.
- Read the selected surface's `ENVIRONMENT.md` and matching DevServer registry record. Do not invent a root URL or substitute a framework default. Pending assignment means no URL has been assigned.
- Flutter development uses the managed live session for its selected target. Report registry-backed device, session mode, logical command, and state; installed targets are only available until selected. Local Android/Windows release artifacts follow the ShipGlows registration contract.
- A local check does not replace hosted OAuth/cookie/Convex verification. Preserve the recorded `vercel-preview-push` mode until an explicit policy change.

## Validation

Run from the affected surface; choose checks proportional to changed behavior.

| Surface | Focused proof |
| --- | --- |
| app | `flutter analyze`; relevant Flutter tests; `dart run tool/check_shared_backend_contract.dart`; OAuth handler tests when affected |
| backend/packages/backend | `npm run typecheck` |
| site | `pnpm build` using checked-in package-manager and Node policy |
| ext | `pnpm type-check`, then `pnpm build:ext` for packaging |
| lab | `python -m py_compile main.py server.py`; focused worker contract checks when affected |
| governance | topology audit, metadata lint, reference and preservation review |

Governance tools run from the monorepo root. On Linux, after resolving/exporting the active root:

```bash
python3 "$SHIPGLOWS_ROOT/tools/audit_project_governance_topology.py" .
python3 "$SHIPGLOWS_ROOT/tools/shipglows_metadata_lint.py" AGENT.md shipglows_data
```

On Windows, after resolving the process/user/channel root:

```powershell
python (Join-Path $env:SHIPGLOWS_ROOT 'tools/audit_project_governance_topology.py') .
python (Join-Path $env:SHIPGLOWS_ROOT 'tools/shipglows_metadata_lint.py') AGENT.md shipglows_data
```

Git mode `120000` records compatibility symlinks. If `core.symlinks=false` materializes their target as text, inspect Git mode and target before declaring a repository migration necessary. Restore the local link only after verifying the target and preserving unrelated work.

## Documentation and Delivery

Use the code-docs map for technical changes and the content map for public surfaces. Preserve runtime Astro frontmatter. Record documentation, editorial, and changelog impact independently; internal governance changes do not imply public release notes.

Stage only owned paths. An ordinary push is remote persistence, not proof of a deployment. Product delivery posture is currently undeclared; preserve existing branch/provider policy and resolve maturity before altering it. Do not weaken checks or infer production authority.

## Maintenance Rule

Review when commands, host execution, managed-session rules, delivery policy, or canonical ownership change. Dependency manifests and locks own exact versions; refreshing this document does not upgrade dependencies.
