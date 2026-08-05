---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglows"
created: "2026-06-09"
created_at: "2026-06-09 21:02:45 UTC"
updated: "2026-06-10"
updated_at: "2026-06-10 07:36:06 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "workflow"
owner: "Diane"
user_story: "En tant qu'opératrice ShipGlows qui lance directement une skill, je veux recevoir un retour court, clair et actionnable, avec des questions rares et compréhensibles, afin que ShipGlows reste autonome et professionnel sans me demander de suivre toute sa mécanique interne."
confidence: high
risk_level: high
security_impact: yes
docs_impact: yes
linked_systems:
  - "ShipGlows"
  - "skills/*/SKILL.md"
  - "skills/references/reporting-contract.md"
  - "skills/references/question-contract.md"
  - "skills/references/spec-driven-development-discipline.md"
  - "skills/sf-ready/SKILL.md"
  - "templates/artifacts/readiness_report.md"
depends_on:
  - artifact: "skills/references/reporting-contract.md"
    artifact_version: "1.2.0"
    required_status: "active"
  - artifact: "skills/references/question-contract.md"
    artifact_version: "1.1.0"
    required_status: "active"
  - artifact: "skills/references/decision-quality-contract.md"
    artifact_version: "1.0.0"
    required_status: "active"
  - artifact: "skills/references/spec-driven-development-discipline.md"
    artifact_version: "1.2.0"
    required_status: "active"
  - artifact: "skills/references/chantier-tracking.md"
    artifact_version: "0.5.0"
    required_status: "draft"
  - artifact: "shipglows_data/workflow/conversation-audits/2026-06-09-replayglows-skill-application-audit.md"
    artifact_version: "1.0.0"
    required_status: "draft"
supersedes: []
evidence:
  - "Conversation audit 2026-06-09 found literalism_over_intent, over_reporting, proof_gap, stale_skill_contract, and weak_follow_through in the ReplayGlows session."
  - "User decision 2026-06-09: technical detail is acceptable for individual skills, but human-launched skills should not return verbose or incomprehensible reports."
  - "User decision 2026-06-09: sf-ready is too verbose, asks unclear questions, and should become more autonomous and professionally effective."
  - "Existing reporting-contract.md already distinguishes report=user and report=agent but needs stronger enforcement scenarios."
  - "Existing question-contract.md already limits questions but does not yet force autonomy strongly enough in lifecycle skills."
next_step: "/sf-ship shipglows-skill-reporting-and-proof-hardening"
---

# Spec: ShipGlows Skill Reporting And Proof Hardening

## Title

ShipGlows skill reporting and proof hardening

## Status

ready

## User Story

En tant qu'opératrice ShipGlows qui lance directement une skill, je veux recevoir un retour court, clair et actionnable, avec des questions rares et compréhensibles, afin que ShipGlows reste autonome et professionnel sans me demander de suivre toute sa mécanique interne.

## Minimal Behavior Contract

When a human directly launches a ShipGlows skill, the skill must do the professional work autonomously whenever a safe, high-quality default exists, then report the outcome in plain user language with only the useful verdict, evidence limits, and next step. If a human-owned decision is truly required, the skill asks one clear numbered question, recommends the best option, and explains the consequence without internal jargon. If the run is for another agent or explicitly asks for handoff detail, the same skill may return technical evidence, matrices, and lifecycle internals. Failure must produce an actionable reason and owner route, not a verbose dump. The easy edge case to miss is `sf-ready`: it must be rigorous internally while showing the user only the readiness verdict, the few blockers that need action, or the one next command.

## Success Behavior

- Preconditions: A user launches a ShipGlows skill directly, without `report=agent`, `handoff`, `verbose`, or `full-report`.
- Trigger: The skill finishes successfully, partially, blocked, or asks for missing input.
- User/operator result: The user sees a short report in their active language that explains the outcome and what, if anything, they must do next.
- System effect: Shared ShipGlows contracts and affected skill instructions make `report=user` compact by default, `report=agent` detailed by explicit mode, and proof gaps visible before completion claims.
- Success proof: Skill contract scans show the new rules in the shared references and `sf-ready`; budget/sync checks pass; pressure scenarios demonstrate concise human output and detailed agent output.
- Silent success: Not allowed. A human-launched skill must produce a visible verdict or next-step state.

## Error Behavior

- Expected failures: A skill lacks enough information, detects a safety/security gate, cannot identify a unique chantier, cannot prove a completion claim, or cannot repair a spec without user-owned decisions.
- User/operator response: The report states the blocker in plain language, gives the safest next action, and asks only the smallest necessary numbered question if a decision is genuinely user-owned.
- System effect: No misleading ready/complete/ship state is written. If a spec status changes to `ready`, metadata changes including `artifact_version`, `updated_at`, run history, and `Current Chantier Flow` are applied coherently before validation.
- Must never happen: A human user receives a long checklist as the default success report; internal terms such as lifecycle labels or readiness gates replace plain explanations; a UI or product fix is claimed complete without proof or an explicit proof gap; a skill asks broad clarification when it can choose a safe default.
- Silent failure: Not allowed. Blocked, partial, or unverified states must be observable and routed.

## Problem

ShipGlows already has contracts for user-mode reporting, question shape, proof discipline, and readiness. In practice, this conversation showed that those contracts are not strict enough for human-launched skills. The user was exposed to internal labels and verbose lifecycle detail, `sf-ready` required too much interpretation, and UI-fix claims needed stronger proof visibility. This increases user workload and weakens trust in skill autonomy.

## Solution

Harden the shared ShipGlows contracts and the high-risk lifecycle skills so user-mode output becomes compact, plain, and decision-oriented by default, while agent-mode keeps detailed evidence. Add pressure scenarios and validation checks that prevent regressions: human-launched `sf-ready` must be readable and mostly autonomous, and implementation/fix skills must name proof paths before completion claims.

## Scope In

- Update shared reporting rules for human-launched skills versus agent handoff runs.
- Update shared question rules to prefer autonomous safe defaults and ask only material numbered questions.
- Update `sf-ready` to produce a compact human verdict by default and reserve full checklist detail for `report=agent`, blocked/high-risk handoff, or explicit verbose requests.
- Update readiness status-transition rules so `status: ready`, `artifact_version`, timestamps, run history, and flow status are changed coherently before lint.
- Update proof discipline for implementation and bug-fix reports so UI/product behavior is not claimed fixed without named proof or a stated gap.
- Update templates used by readiness and spec reports if they encourage verbose user-mode output.
- Add pressure scenarios for concise human reports, detailed agent reports, `sf-ready` not-ready questions, proof-gap reporting, and metadata-ready transitions.
- Validate ShipGlows skill budget and sync checks after edits.

## Scope Out

- Rewriting every ShipGlows skill from scratch.
- Removing technical detail from `report=agent`, handoff, blocked security-sensitive reports, or internal governance artifacts.
- Weakening readiness, proof, security, or metadata standards to make reports shorter.
- Changing ReplayGlows application code.
- Changing the public product copy of ReplayGlows.
- Replacing ShipGlows lifecycle steps or removing chantier tracking.
- Creating a new runtime UI for skill reports.

## Constraints

- Concise reports must not become vague. Blocked, partial, security-sensitive, or unverified runs still need actionable evidence and a safe next step.
- User-facing text should use the user's active language; stable commands, paths, metadata keys, and machine-readable lifecycle labels can remain in English when needed for traceability.
- Internal skill contracts, section headings, YAML keys, validation commands, and durable workflow rules remain in English.
- `report=agent` remains available and must not be degraded.
- `sf-ready` must remain adversarial and strict internally even when its user report is short.
- Autonomy must follow the decision-quality contract: choose safe professional defaults, not the fastest or easiest local path.
- Questions are allowed only when the answer changes a material product, workflow, security, data, architecture, proof, release, or ownership decision.
- Skill changes must be made in `/home/claude/shipglows`, while this chantier spec and audit evidence live in the current project governance registry.

## Dependencies

- Runtime: Local ShipGlows skill files and templates under `/home/claude/shipglows`.
- Document contracts:
  - `skills/references/reporting-contract.md` version `1.2.0`
  - `skills/references/question-contract.md` version `1.1.0`
  - `skills/references/decision-quality-contract.md` version `1.0.0`
  - `skills/references/spec-driven-development-discipline.md` version `1.2.0`
  - `skills/references/chantier-tracking.md` version `0.5.0`
- Metadata gaps: `chantier-tracking.md` is still `draft`; this spec may proceed because it uses existing live doctrine, but `/sf-ready` must flag if draft dependency status blocks final readiness.
- Fresh external docs verdict: `fresh-docs not needed` because the work changes local ShipGlows skill contracts, templates, and validation scripts only. No external framework, SDK, API, auth provider, migration behavior, or service contract is being introduced.

## Invariants

- Human-launched skills default to `report=user`.
- Agent handoffs and explicit verbose modes keep detailed evidence.
- Every report mode preserves safety: no secrets, private logs, tokens, cookies, or unnecessary bulk output.
- A concise report cannot hide a blocking proof gap, safety gate, or user-owned decision.
- `sf-ready` does not mark a spec ready unless required metadata, flow history, open questions, and validation state are coherent.
- Skill autonomy must not invent product decisions that the operator must own.
- Detailed lifecycle data remains stored in durable artifacts when required, even if user-facing text is compact.

## Links & Consequences

- Upstream systems: user skill invocations, master skills that call owner skills, spec-first chantier lifecycle, conversation audits.
- Downstream systems: `sf-ready`, `sf-build`, `sf-bug`, `sf-fix`, `sf-verify`, `sf-ship`, reporting templates, audit classifications, and future skill-quality checks.
- Cross-cutting checks: metadata lint, skill budget audit, skill sync check, targeted `rg` checks for new required phrases, and scenario review.
- This change should reduce user interruptions by making skills choose responsible defaults and ask fewer, clearer questions.
- This change should improve trust by making proof gaps visible without forcing the user to parse raw checklists.

## Documentation Coherence

- Update shared ShipGlows references that define reporting, questions, and proof discipline.
- Update `sf-ready/SKILL.md` because readiness reports were the clearest failure mode.
- Update `templates/artifacts/readiness_report.md` if its default shape encourages verbose user-mode output.
- Update or add validation notes in the relevant skill references so future skill edits keep the distinction between human and agent output.
- No ReplayGlows product docs need updates because this is a ShipGlows workflow improvement, not an app feature.

## Edge Cases

- A human asks for `verbose`, `full report`, `handoff`, or `report=agent`: return detailed evidence and do not over-compress.
- A master skill needs an owner-skill handoff: it must request `report=agent`; do not infer this from hidden runtime state.
- A run is successful but has partial proof: the user report stays short but includes the proof limit.
- A run is blocked by safety or security: the user report gives the blocking gate, concrete evidence summary, safest next action, and whether work can ship.
- A skill can choose a safe default: proceed and state the assumption briefly, instead of asking.
- A skill cannot choose safely: ask one numbered question, recommend the responsible default, and avoid internal jargon.
- `sf-ready` sees a spec that is almost ready but metadata is stale: repair status metadata only when the content is ready and the repair is mechanical; otherwise keep `not ready`.
- `sf-ready` marks a spec ready: bump `artifact_version` from pre-ready versions when required by metadata policy before running lint.
- The user is non-technical or not immersed in the code: report in plain product/workflow terms first.

## Implementation Tasks

- [ ] Task 1: Harden user-mode reporting contract.
  - File: `/home/claude/shipglows/skills/references/reporting-contract.md`
  - Action: Add explicit rules that human-launched `report=user` returns outcome, proof summary, limits, and next step only; detailed matrices/checklists are reserved for `report=agent`, blocked handoff, or explicit verbose requests.
  - User story link: Keeps human reports short and understandable.
  - Depends on: None
  - Validate with: `rg -n "human|report=user|report=agent|checklist|proof" /home/claude/shipglows/skills/references/reporting-contract.md`
  - Notes: Do not remove failure-rule detail; concise must remain actionable.

- [ ] Task 2: Strengthen autonomy and question threshold.
  - File: `/home/claude/shipglows/skills/references/question-contract.md`
  - Action: Add a rule that skills must proceed with safe professional defaults when available, ask at most the smallest necessary numbered question when user ownership is required, and avoid broad or internal-jargon questions.
  - User story link: Reduces unnecessary user presence and unclear interactions.
  - Depends on: Task 1
  - Validate with: `rg -n "safe default|autonom|numbered|material" /home/claude/shipglows/skills/references/question-contract.md`
  - Notes: Keep decision-quality constraints stronger than speed/convenience.

- [ ] Task 3: Make `sf-ready` compact for humans and strict internally.
  - File: `/home/claude/shipglows/skills/sf-ready/SKILL.md`
  - Action: Update report mode and verdict rules so user-mode readiness reports show only verdict, blocking issues that need action, one next command, and compact chantier flow; full checklist appears only in `report=agent`, blocked/high-risk handoff, or explicit verbose mode.
  - User story link: Fixes the specific `sf-ready` friction in this conversation.
  - Depends on: Tasks 1 and 2
  - Validate with: `rg -n "report=user|report=agent|checklist|question|artifact_version|ready" /home/claude/shipglows/skills/sf-ready/SKILL.md`
  - Notes: Do not relax the readiness checklist; only change default user presentation and mechanical metadata transition rules.

- [ ] Task 4: Harden ready metadata transitions.
  - File: `/home/claude/shipglows/skills/sf-ready/SKILL.md`
  - Action: Add an atomic-ready-transition rule: before writing `ready`, update frontmatter status, `artifact_version` when moving out of pre-ready draft versions, `updated`, `updated_at`, `next_step`, `Skill Run History`, and `Current Chantier Flow`, then run metadata lint.
  - User story link: Prevents a ready verdict that immediately needs repair.
  - Depends on: Task 3
  - Validate with: `rg -n "artifact_version|updated_at|metadata lint|Current Chantier Flow|ready" /home/claude/shipglows/skills/sf-ready/SKILL.md`
  - Notes: If metadata policy conflicts with a specific artifact type, report not-ready instead of guessing.

- [ ] Task 5: Add proof-claim discipline for implementation/fix reports.
  - File: `/home/claude/shipglows/skills/references/spec-driven-development-discipline.md`
  - Action: Clarify that implementation, fix, and verification reports must name the proof path or proof gap before claiming user-visible behavior is fixed, especially for Flutter/UI/browser flows.
  - User story link: Prevents repeated UI regressions from being treated as done without observable proof.
  - Depends on: Task 1
  - Validate with: `rg -n "proof path|proof gap|claim|Flutter|UI" /home/claude/shipglows/skills/references/spec-driven-development-discipline.md`
  - Notes: Keep proof proportional; do not force heavy checks for docs-only edits.

- [ ] Task 6: Align readiness template with compact/handoff modes.
  - File: `/home/claude/shipglows/templates/artifacts/readiness_report.md`
  - Action: Mark the full checklist template as agent/handoff detail and add a compact user-mode shape for verdict, blockers, proof limits, and next command.
  - User story link: Prevents future agents from using the verbose template as the default human response.
  - Depends on: Task 3
  - Validate with: `rg -n "report=user|report=agent|compact|Checklist|Verdict" /home/claude/shipglows/templates/artifacts/readiness_report.md`
  - Notes: Preserve machine-readable fields for durable reports.

- [ ] Task 7: Create the manual pressure-scenario checklist.
  - File: `shipglows_data/workflow/test-checklists/shipglows-skill-reporting-and-proof-hardening.md`
  - Action: Create the checklist artifact for `SSRP-001` through `SSRP-008`, with expected evidence, pass/fail/block status fields, and notes for human-readable versus agent-readable output.
  - User story link: Makes the required manual proof concrete and repeatable.
  - Depends on: Tasks 1-6
  - Validate with: `/home/claude/shipglows/tools/shipglows_metadata_lint.py shipglows_data/workflow/test-checklists/shipglows-skill-reporting-and-proof-hardening.md`
  - Notes: Use the existing manual checklist template if it fits; keep scenarios concise and deterministic.

- [ ] Task 8: Add pressure-scenario validation.
  - File: `/home/claude/shipglows/skills/references/reporting-contract.md`
  - Action: Add or reference pressure scenarios covering human success report, human not-ready report, human blocked safety report, agent handoff report, safe-default autonomy, and required numbered question.
  - User story link: Makes the behavior testable beyond wording changes.
  - Depends on: Tasks 1-7
  - Validate with: `rg -n "pressure|scenario|safe default|not ready|blocked" /home/claude/shipglows/skills/references/reporting-contract.md /home/claude/shipglows/skills/references/question-contract.md`
  - Notes: If a separate scenario reference is cleaner, create it under `/home/claude/shipglows/skills/references/` and list it in `depends_on` during implementation.

- [ ] Task 9: Run ShipGlows skill validation.
  - File: `/home/claude/shipglows`
  - Action: Run metadata/skill checks and targeted scans after edits.
  - User story link: Ensures the contract changes are installable and synchronized.
  - Depends on: Tasks 1-8
  - Validate with: `python3 tools/skill_budget_audit.py --skills-root skills --format markdown` and `tools/shipglows_sync_skills.sh --check --all`
  - Notes: If sync fails because installed skill copies differ, report the exact sync action needed instead of claiming complete.

## Acceptance Criteria

- [ ] AC 1: Given a human launches a skill without `report=agent`, when the run succeeds, then the final report is concise, in the active user language, and includes outcome, proof summary, limits only if relevant, and one next step only if real.
- [ ] AC 2: Given a master skill or another agent needs handoff detail, when it requests `report=agent`, then the report may include technical evidence, checklists, matrices, files, validation commands, and lifecycle internals.
- [ ] AC 3: Given a skill can safely choose a professional default, when context is incomplete but low-risk and reversible, then it proceeds and states the assumption instead of asking the user.
- [ ] AC 4: Given a material user-owned decision is missing, when a skill must ask, then it asks one numbered plain-language question with a recommended option and consequences.
- [ ] AC 5: Given `sf-ready` reviews a readyable spec, when it marks it ready, then status, `artifact_version`, timestamps, `next_step`, run history, chantier flow, and metadata lint are coherent in the same run.
- [ ] AC 6: Given `sf-ready` finds blockers, when reporting in user mode, then it lists only the blockers that need action and avoids dumping the full checklist unless the user asked for detail.
- [ ] AC 7: Given implementation or bug-fix work changes user-visible UI behavior, when the final report claims the behavior is fixed, then it names the proof path run or states the remaining proof gap.
- [ ] AC 8: Given a blocked, partial, safety-sensitive, or unverified run, when the final report is short, then it still includes concrete evidence summary, owner route, and safest next action.
- [ ] AC 9: Given skill references and templates are changed, when validation runs, then skill budget audit and sync check pass or produce explicit follow-up actions.

## Test Strategy

- Unit: None, because this change is skill-contract and template text rather than executable application logic.
- Integration: ShipGlows skill validation commands and targeted `rg` checks verify that required contract language exists in the correct files.
- Manual: Pressure-scenario review against this spec's acceptance criteria confirms that human and agent report modes diverge correctly.

## Test Contract

### Surface

- Stack/surface: ShipGlows skills, shared references, templates, and validation scripts.
- Primary proof mode: contract_only
- Proof order: targeted source scans -> skill budget audit -> skill sync check -> pressure-scenario review.

### Manual checklist

- Needed: yes
- Checklist path: `shipglows_data/workflow/test-checklists/shipglows-skill-reporting-and-proof-hardening.md`
- Required scenario coverage:
  - `SSRP-001`: Human successful skill report is concise and plain.
  - `SSRP-002`: Human `sf-ready` not-ready report gives clear blockers and one next command.
  - `SSRP-003`: Human blocked safety/security report remains actionable without bulk output.
  - `SSRP-004`: Agent handoff report keeps detailed evidence.
  - `SSRP-005`: Safe default path proceeds without asking.
  - `SSRP-006`: Required decision path asks one numbered question.
  - `SSRP-007`: UI-fix completion report names proof path or proof gap.
  - `SSRP-008`: Ready metadata transition cannot leave `artifact_version` stale.
- Exception with proof: No automated runtime simulator exists for all skill conversations; pressure-scenario review is acceptable evidence when paired with source scans and skill validation commands.

### Required evidence stack

- Automated / unit / integration checks:
  - `(cd /home/claude/shipglows && python3 tools/skill_budget_audit.py --skills-root skills --format markdown)`
  - `(cd /home/claude/shipglows && tools/shipglows_sync_skills.sh --check --all)`
  - `/home/claude/shipglows/tools/shipglows_metadata_lint.py shipglows_data/workflow/specs/shipglows-skill-reporting-and-proof-hardening.md`
- Agent-run browser proof: None, because this is not a browser feature.
- Auth/session proof (`sf-auth-debug`): None, because no auth/session behavior changes.
- Contract/integration proof: Targeted `rg` checks listed in implementation tasks.
- Provider evidence: None, because no external provider behavior changes.
- Device-native proof: None, because no native app behavior changes.

## Risks

- Security impact: yes, because skill reports may summarize sensitive evidence. Mitigation: keep the existing no-secret/no-private-log rule and explicitly preserve it in both report modes.
- Product/data/performance risk: Medium workflow risk. Over-compression could hide blockers; mitigation is a failure rule requiring concrete evidence and safest next action for partial, blocked, risky, or unverified runs.
- Adoption risk: Some skills may keep old verbose patterns unless implementation updates shared references and the high-risk lifecycle skills first.
- Readiness risk: `chantier-tracking.md` is a draft dependency; `/sf-ready` must decide whether its draft status is acceptable for this internal workflow hardening.

## Execution Notes

- Read first:
  - `/home/claude/shipglows/skills/references/reporting-contract.md`
  - `/home/claude/shipglows/skills/references/question-contract.md`
  - `/home/claude/shipglows/skills/references/spec-driven-development-discipline.md`
  - `/home/claude/shipglows/skills/sf-ready/SKILL.md`
  - `/home/claude/shipglows/templates/artifacts/readiness_report.md`
- Implementation approach:
  - First change shared references so all skills inherit the behavior.
  - Then update `sf-ready` because it is the concrete failure mode.
  - Then align templates and validation scenarios.
  - Keep edits targeted and do not rewrite unrelated skill bodies.
- Validate with:
  - `/home/claude/shipglows/tools/shipglows_metadata_lint.py shipglows_data/workflow/specs/shipglows-skill-reporting-and-proof-hardening.md`
  - `(cd /home/claude/shipglows && python3 tools/skill_budget_audit.py --skills-root skills --format markdown)`
  - `(cd /home/claude/shipglows && tools/shipglows_sync_skills.sh --check --all)`
- Stop conditions:
  - A proposed change makes `report=user` hide safety, security, proof, or ship blockers.
  - A proposed change removes detailed evidence from `report=agent`.
  - A proposed change lets skills choose product/security decisions the user must own.
  - Validation or sync fails and the failure cannot be explained as unrelated pre-existing drift.

## Open Questions

None

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-06-09 21:02:45 UTC | sf-spec | GPT-5 Codex | Created spec from conversation audit and user confirmation | draft | /sf-ready shipglows-skill-reporting-and-proof-hardening |
| 2026-06-09 21:52:38 UTC | sf-ready | GPT-5 Codex | Reviewed readiness, corrected mechanical checklist/language gaps, and applied ready transition | ready | /sf-start shipglows-skill-reporting-and-proof-hardening |
| 2026-06-09 22:01:52 UTC | sf-start | GPT-5 Codex | Implemented shared reporting, question, proof, readiness, template, and checklist changes | implemented | /sf-verify shipglows-skill-reporting-and-proof-hardening |
| 2026-06-09 22:01:52 UTC | sf-verify | GPT-5 Codex | Verified targeted scans, metadata lint, skill budget audit, sync check, and checklist scenarios | verified | /sf-end shipglows-skill-reporting-and-proof-hardening |
| 2026-06-09 22:01:52 UTC | sf-build | GPT-5 Codex | Orchestrated ready spec implementation and verification; stopped before ship scope decision | partial | /sf-end shipglows-skill-reporting-and-proof-hardening |
| 2026-06-10 07:36:06 UTC | sf-end | GPT-5 Codex | Closed workflow bookkeeping with tracker, changelog, and chantier flow updates | closed | /sf-ship shipglows-skill-reporting-and-proof-hardening |

## Current Chantier Flow

- `sf-spec`: done, draft spec created.
- `sf-ready`: ready.
- `sf-start`: implemented.
- `sf-verify`: verified.
- `sf-end`: closed.
- `sf-ship`: not launched.

Next step: `/sf-ship shipglows-skill-reporting-and-proof-hardening`
