---
artifact: manual_test_checklist
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-06-09"
created_at: "2026-06-09 22:20:00 UTC"
updated: "2026-06-10"
updated_at: "2026-06-10 07:36:06 UTC"
status: reviewed
source_skill: "sf-start"
scope: "shipglows-skill-reporting-and-proof-hardening"
owner: "Diane"
target_scope: "shipglows_data/workflow/test-checklists/shipglows-skill-reporting-and-proof-hardening.md"
stack_profile: "shipglows"
proof_profile: "contract"
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
evidence:
  - "shipglows_data/workflow/specs/shipglows-skill-reporting-and-proof-hardening.md"
depends_on:
  - artifact: "shipglows_data/workflow/specs/shipglows-skill-reporting-and-proof-hardening.md"
    artifact_version: "1.0.0"
    required_status: "ready"
supersedes: []
next_step: "/sf-ship shipglows-skill-reporting-and-proof-hardening"
---

# Manual Test Checklist: ShipGlows Skill Reporting And Proof Hardening

## Contract

- Target scope: `shipglows_data/workflow/test-checklists/shipglows-skill-reporting-and-proof-hardening.md`
- Stack profile: `ShipGlows skills and governance contracts`
- Proof profile: `contract -> manual scenario review`
- Required proof rows: `PASS`/`FAIL`/`BLOCKED`/`N/A`/`NOT_RUN` are all machine-read.

## Status Vocabulary

- `NOT_RUN`: not executed yet
- `PASS`: required checks and result observed
- `FAIL`: failure reproduced with a concrete observation
- `BLOCKED`: could not execute due to environment, access, or dependency blockers
- `N/A`: not applicable with an explicit reason in Notes

## Operator Editing Rules

- Update only `Observed`, `Status`, `Evidence pointer`, `Notes`, and `Bug Link`.
- Preserve scenario IDs and required flags.
- `Observed` is mandatory for `FAIL` and `BLOCKED`.
- Keep evidence redacted; never paste secrets, cookies, tokens, private logs, or raw PII.

## Scenarios

| Scenario ID | Surface | Scenario | Required | Expected | Status | Observed | Evidence pointer | Notes | Bug Link |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SSRP-001 | reporting | Human-launched successful skill report | yes | Report is concise, in active user language, and includes outcome plus proof summary without checklist dump. | PASS | Reporting contract now defines human user mode as a decision surface and forbids checklist dumps in successful user-mode reports. | N/A | Validated by targeted `rg` scan. |  |
| SSRP-002 | sf-ready | Human `sf-ready` not-ready report | yes | Report lists only actionable blockers and one next command, with no full checklist unless requested. | PASS | `sf-ready` now has a compact user-mode format and reserves detailed checklists for agent/handoff/explicit detail. | N/A | Validated by targeted `rg` scan. |  |
| SSRP-003 | safety | Human blocked safety/security report | yes | Report names the gate, redacted evidence summary, safest next action, and no secrets or bulk logs. | PASS | Reporting contract keeps the failure rule and adds a safety blocked pressure scenario with redacted evidence. | N/A | Validated by targeted `rg` scan. |  |
| SSRP-004 | handoff | Agent handoff report | yes | `report=agent` may include detailed evidence, files, checks, matrices, and lifecycle internals. | PASS | Reporting contract explicitly keeps detailed evidence in `report=agent` and requires master skills to request it. | N/A | Validated by targeted `rg` scan. |  |
| SSRP-005 | questions | Safe professional default available | yes | Skill proceeds without asking and states the assumption only if it affects trust or future review. | PASS | Question contract now states autonomy is the default and forbids asking about routine internal mechanics. | N/A | Validated by targeted `rg` scan. |  |
| SSRP-006 | questions | Material operator decision required | yes | Skill asks one numbered plain-language question with a recommended option and consequences. | PASS | Question contract now limits questions to material decisions and adds a required-decision pressure scenario. | N/A | Validated by targeted `rg` scan. |  |
| SSRP-007 | proof | UI or workflow fix completion claim | yes | Report names proof path run or states the remaining proof gap before claiming behavior is fixed. | PASS | Proof discipline now blocks completion claims without proof path or explicit proof gap. | N/A | Validated by targeted `rg` scan. |  |
| SSRP-008 | readiness | Ready metadata transition | yes | Ready transition updates status, artifact version when required, timestamps, next step, run history, flow, and metadata lint coherently. | PASS | `sf-ready` now requires atomic ready transition and metadata lint before ready verdict. | N/A | Validated by targeted `rg` scan and metadata lint. |  |

## Maintenance

- Required rows block clean verification when unresolved.
- Use `sf-test` only when these rows need a durable manual QA campaign or bug-file conversion.
