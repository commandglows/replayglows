---
artifact: exploration_report
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-06-10"
updated: "2026-06-10"
status: draft
source_skill: sf-explore
scope: "shipglows-suite-entitlements-and-data-sync-skill-placement"
owner: "Diane"
confidence: high
risk_level: high
security_impact: yes
docs_impact: yes
linked_systems:
  - "ShipGlows skills"
  - "WinFlowz suite entitlements"
  - "ReplayGlowz product Convex backend"
  - "ReplayGlowz Flutter app"
  - "sf-local-cloud-sync"
evidence:
  - "/home/claude/shipglows/skills/references/product-entitlements-playbook.md"
  - "/home/claude/shipglows/skills/sf-local-cloud-sync/SKILL.md"
  - "/home/claude/shipglows/skills/sf-local-cloud-sync/references/local-cloud-sync-doctrine.md"
  - "/home/claude/shipglows/skills/sf-local-cloud-sync/references/ux-security-checklist.md"
  - "/home/claude/shipglows/skills/sf-auth-debug/SKILL.md"
  - "/home/claude/shipglows/skills/sf-skill-build/SKILL.md"
  - "shipglows_data/workflow/specs/replayglowz-suite-auth-migration.md"
  - "app/AGENT.md"
  - "backend/packages/backend/convex/access.ts"
depends_on:
  - artifact: "skills/references/product-entitlements-playbook.md"
    artifact_version: "1.0.1"
    required_status: active
  - artifact: "skills/sf-local-cloud-sync/SKILL.md"
    required_status: active
supersedes: []
next_step: "/sf-spec ShipGlows product entitlements skill and local-cloud-sync entitlement handoff"
---

# Exploration Report: Suite Entitlements And Data Sync Skill Placement

## Starting Question

Should ShipGlows create one skill or two for suite product entitlements and data synchronization, and is `sf-local-cloud-sync` already enough for the synchronization side?

## Context Read

- `/home/claude/shipglows/skills/references/product-entitlements-playbook.md` - Defines the doctrine: identity, provider events, and product entitlements must stay separate; product authorization must come from a server-owned ledger.
- `/home/claude/shipglows/skills/sf-local-cloud-sync/SKILL.md` - Already owns local-to-cloud promotion, hydration, merge, tombstones, offline queues, account boundaries, privacy, and sync proof routing.
- `/home/claude/shipglows/skills/sf-local-cloud-sync/references/local-cloud-sync-doctrine.md` - Confirms replay, account association, merge, and offline queue rules already include entitlement re-check before remote writes.
- `/home/claude/shipglows/skills/sf-local-cloud-sync/references/ux-security-checklist.md` - Confirms sync UX/security states already include "blocked by entitlement" and sensitive-data exclusions.
- `/home/claude/shipglows/skills/sf-auth-debug/SKILL.md` - Covers auth/OAuth/session diagnosis, not entitlement lifecycle ownership.
- `/home/claude/shipglows/skills/sf-skill-build/SKILL.md` - Requires overlap scan and spec-first placement before creating a new skill.
- `shipglows_data/workflow/specs/replayglowz-suite-auth-migration.md` - ReplayGlowz already documents the two-Convex boundary: WinFlowz owns identity/entitlements; ReplayGlowz owns product data.
- `app/AGENT.md` - Confirms product data must not move into suite Convex and client identity is not product access.
- `backend/packages/backend/convex/access.ts` - Current backend guard demonstrates entitlement checks as an authorization concern, not a sync concern.

## Internet Research

- None. This was local doctrine and repository exploration.

## Problem Framing

The operator intent is not just "sync data." The recurring pain is the suite boundary:

```text
Identity
  proves who the user is
        |
        v
Entitlements
  decide whether product access is active
        |
        v
Product data
  videos, notes, playlists, transcripts, preferences, tokens
        |
        v
Data sync
  promotion, hydration, merge, conflict, tombstones, retries
```

Entitlements are a security and business-source-of-truth domain. Sync is a data-integrity and account-boundary domain. They touch each other because sync must re-check entitlement before remote writes, but they should not share the same operator entrypoint by default.

## Option Space

### Option A: One Combined Skill

- Summary: Create a single skill for suite entitlements plus data synchronization.
- Pros: One obvious place for suite boundary work.
- Cons: Too broad. It would mix billing/provider events, grants/revokes, access guards, support diagnostics, merge policy, local durability, tombstones, and offline queue doctrine. It would also duplicate `sf-local-cloud-sync`.

### Option B: Two New Skills

- Summary: Create `sf-entitlements` and `sf-data-sync`.
- Pros: Separates authorization from synchronization.
- Cons: `sf-data-sync` overlaps materially with `sf-local-cloud-sync`. A second sync entrypoint would make routing ambiguous unless it owns a clearly different non-local-cloud domain.

### Option C: New Entitlements Skill Plus Local-Cloud Sync Extension

- Summary: Create a new domain skill, likely `sf-entitlements` or `sf-product-entitlements`, and extend `sf-local-cloud-sync` with explicit handoff language for entitlement-gated sync.
- Pros: Keeps the new security domain discoverable while preserving the existing sync owner. Avoids duplicate entrypoints. Matches `sf-skill-build` placement rules.
- Cons: Requires coordination between two skills: entitlement work must hand off to sync work when product data migration, hydration, or merge policy is in scope.

### Option D: Only Extend Existing Skills

- Summary: Add more entitlement behavior to `sf-auth-debug`, `sf-local-cloud-sync`, or `sf-build` without creating a new skill.
- Pros: No new skill surface.
- Cons: Entitlement lifecycle is not just debugging, not just sync, and not just build orchestration. It needs its own triggers, stop conditions, artifacts, and smoke proof.

## Comparison

| Criterion | One combined skill | Two new skills | New entitlements + sync extension | Only extend existing |
| --- | --- | --- | --- | --- |
| Distinct operator trigger | weak | medium | strong | weak |
| Avoids duplicate sync doctrine | no | no | yes | yes |
| Security clarity | medium | high | high | medium |
| Discoverability | medium | medium | high | low |
| Fits `sf-skill-build` placement gate | weak | partial | strong | partial |
| Best current fit | no | no | yes | no |

## Emerging Recommendation

Create one new domain skill for product entitlements and do not create a standalone data-sync skill now.

Recommended shape:

- `sf-entitlements` or `sf-product-entitlements`
  - Owns product access doctrine, suite ledger preflight, provider/manual/LTD/code grants, revokes/refunds/expiry, backend guards, product-access snapshots, support diagnostics, redaction, smoke proof, and docs impact.
  - Routes auth/session bugs to `sf-auth-debug`.
  - Routes local/cloud data promotion, merge, hydration, tombstones, offline queue, and conflict policy to `sf-local-cloud-sync`.
  - Routes implementation through `sf-spec -> sf-ready -> sf-start/sf-build -> sf-verify`.

- `sf-local-cloud-sync`
  - Stays the owner for data synchronization.
  - Should gain a short explicit integration note: sync contracts must name entitlement preconditions, fail closed when access is inactive, and hand off entitlement-ledger work to `sf-entitlements`.

Do not create `sf-data-sync` unless a later exploration proves a distinct domain that is not local-cloud sync, not provider/import sync, and not product-specific business sync.

## Non-Decisions

- Exact skill name: `sf-entitlements` is shorter; `sf-product-entitlements` is clearer. The spec should decide.
- Public skill page copy.
- Whether the new skill owns a skill-local reference or primarily points to `product-entitlements-playbook.md`.
- Whether ReplayGlowz-specific default-free access remains a temporary compatibility path or becomes a suite policy.

## Rejected Paths

- Combined "entitlements and sync" mega-skill - Rejected because it would blur authorization and data integrity responsibilities.
- New `sf-data-sync` now - Rejected because `sf-local-cloud-sync` already owns the relevant generic sync doctrine.
- Putting entitlement lifecycle into `sf-auth-debug` - Rejected because auth diagnosis is narrower than product access source-of-truth design.

## Risks And Unknowns

- Duplicate ledger risk: a product-local backend may create durable entitlement truth instead of adapting to a suite ledger.
- Stale snapshot risk: product access snapshots can be useful caches, but the skill must define cache TTL, refresh, and revocation behavior carefully.
- Naming risk: `sf-entitlements` is concise but could sound generic; `sf-product-entitlements` is less elegant but more precise.
- Sync handoff risk: if `sf-local-cloud-sync` does not explicitly mention entitlement-gated sync, future agents may treat sync as a storage problem and miss product authorization.
- Public promise risk: a new skill changes ShipGlows discoverability and should be spec-first.

## Redaction Review

- Reviewed: yes
- Sensitive inputs seen: env variable names only; no secret values persisted.
- Redactions applied: none needed.
- Notes: No tokens, cookies, private keys, raw provider payloads, or customer data were included.

## Decision Inputs For Spec

- User story seed: As a ShipGlows operator building suite products, I want a dedicated entitlements skill so that identity, provider events, product access, product-local mirrors, support actions, and protected backend gates are designed and verified without duplicating sync or auth-debug workflows.
- Scope in seed: new `sf-entitlements` skill contract; overlap and handoff rules for `sf-auth-debug` and `sf-local-cloud-sync`; validation commands; public/help docs impact; smoke proof expectations.
- Scope out seed: implementing product app code, modifying ReplayGlowz access guard, creating provider integrations, replacing `sf-local-cloud-sync`.
- Invariants/constraints seed: identity is not access; provider event is not runtime authorization; suite ledger is canonical when available; fail closed; no raw secrets in logs; product data sync must re-check entitlement before remote writes.
- Validation seed: skill budget audit, skill sync check, focused `rg` checks for routing terms, and pressure scenarios for duplicate ledger, revoked access, stale snapshot, and entitlement-gated sync.

## Handoff

- Recommended next command: `/sf-spec ShipGlows product entitlements skill and local-cloud-sync entitlement handoff`
- Why this next step: the placement is now clear enough for a spec-first skill-maintenance chantier, but no `SKILL.md` should be edited before that spec is ready.

## Exploration Run History

| Date UTC | Prompt/Focus | Action | Result | Next step |
|----------|--------------|--------|--------|-----------|
| 2026-06-10 11:06:11 UTC | Decide whether to create `sf-entitlements` and whether `sf-local-cloud-sync` suffices for sync | Read local doctrine, skill contracts, ReplayGlowz suite-auth spec, app guidance, and current backend guard | Recommend one new entitlements skill plus a small `sf-local-cloud-sync` handoff extension; no standalone `sf-data-sync` now | `/sf-spec ShipGlows product entitlements skill and local-cloud-sync entitlement handoff` |
