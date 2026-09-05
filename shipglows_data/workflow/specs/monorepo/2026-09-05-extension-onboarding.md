---
artifact: implementation_spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
created_at: "2026-09-05T21:12:03+02:00"
updated_at: "2026-09-05T21:37:29+02:00"
source_model: inherited
status: active
chantier_status: verified
source_skill: sg-experience
scope: extension-onboarding
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: [ext]
depends_on:
  - "shipglows_data/product/ext/product.md"
  - "ext/AGENT.md"
supersedes: []
evidence:
  - "Operator approved the in-extension discovery plan with 'validé' on 2026-09-05."
  - "Existing universal playback and local bookmark contracts inspected on 2026-09-05."
next_step: "Persist the verified increment on the review branch; reload the unpacked extension for operator review."
---

# Title

Progressive Discovery Inside the ReplayGlows Extension

## Status

Implemented and verified in the isolated packaged extension on 2026-09-05. The operator explicitly approved the journey: first speed success, contextual global/pinned guidance, practical A–B and YouTube-note paths, accessible resumable help, and recovery/data-boundary explanations. No Web Store publication or personal-browser installation is implied.

## User Story

As a person discovering ReplayGlows in the Chrome popup, I can learn one useful action at a time, understand what actually happened, and return to help whenever I need it, without leaving the extension or losing access to my notes and playback controls.

## Minimal Behavior Contract

Opening the popup exposes an optional discovery entry point and initially expanded first actionable guidance. Help presents practical steps matching the active media/context and stores local progress only after the corresponding operation is confirmed. A failed operation remains incomplete and explains recovery. Closing the popup, skipping a topic, or hiding help preserves the user's choice and permits later resumption; an instruction viewed or button clicked alone never counts as a successful media action.

## Success Behavior

- A first-time user can change speed on supported media and see a confirmed milestone.
- The user learns that the shared base speed affects all supported unpinned tabs, while excluding this tab keeps its own speed; unpinning rejoins the shared rate.
- The user can discover temporary A–B review and local YouTube notes/bookmarks, then open a saved timestamp link.
- Favorite, boost, shortcuts, suspension and data portability remain consultable help topics rather than fabricated completion steps.
- Progress, skip and visibility choices survive popup recreation. An always-accessible help button restores the panel.

Proof: persistence tests plus packaged extension scenarios in the Test Strategy establish these states. A bookmark-open milestone proves a successful tab-opening API result only; it must not say that seeking or viewing the passage was observed.

## Error Behavior

No media, a restricted page, absent/disconnected content script, rejected rate, unavailable loop target, suspension or storage failure must leave the relevant success marker unset and show useful recovery in the affected context. The user can continue ordinary extension work or retry after the condition changes. An invalid A–B selection does not count as a loop. Failed bookmark persistence or navigation does not count as a saved/opened bookmark.

## Problem

The extension has powerful playback and annotation controls but relies on unexplained labels and external documentation. A person can overlook speed scope, loop lifetime, bookmark creation, shortcut settings and local-data limitations. Public website content alone cannot guide an action in the active player.

## Solution

Add French, icon-supported progressive help in the popup's scroll area above notes, retaining the compact playback card. Keep a header help control available when the panel is hidden. Guide real existing controls instead of adding a blocking modal tour or duplicating playback state. Record independent local boolean progress keys for milestones, so updates from separate extension contexts do not overwrite one another. Skip remains distinct from completion. Read shortcut labels from effective settings.

## Scope In

1. Local discovery state and safe defaults for fresh, partial and invalid stored values.
2. Collapsible popup discovery, first-action guidance, per-topic skip, hide and resume.
3. Confirmed milestones for effective speed application, tab exclusion, valid active A–B loop, persisted note/bookmark and successful saved-bookmark tab opening.
4. Contextual explanations of supported media, global/pinned scope, temporary loops, YouTube notes, favorite, boost, configured shortcuts and suspension.
5. Recovery help and local-data/import/export boundaries.
6. Focused automated checks, actual packaged popup verification, and internal product/task documentation alignment.

## Scope Out

New playback capabilities; new permissions, dependencies, backend, telemetry or cloud synchronization; saved loop records; per-note speeds; forced welcome tabs; automatic destructive import; guided actions on behalf of the user; website publication or unverified guide/install links; changing unrelated dirty files or legacy content logic merely for onboarding.

## Constraints

- French UI, existing icons/tokens and compact popup layout; preserve keyboard and viewport access.
- No mandatory tutorial before using notes/playback. Help visibility cannot conceal the permanent way to reopen it.
- Existing product truth remains authoritative: accessible HTTP/HTTPS HTML5 media, 0.25–4x, session tab pins, YouTube-only notes and temporary loops.
- A refreshed worker snapshot must confirm active media at the popup-requested rate, different from its previous rate, for the speed milestone. A pinned context confirms exclusion and valid active loop state confirms A–B; these latter observations may also follow existing shortcuts. Preferences stored without accepted media are insufficient for speed success.
- A persisted bookmark with a note confirms the note milestone, including existing users' saved notes; a successful `chrome.tabs.create` confirms only the separately named bookmark-open milestone.
- Progress is extension-local and separate from bookmark export/import; no transient tab identifiers or browsing history are added to portable notes.
- No external website help link is required because the new site guide is not yet publicly published.

## Test Contract

Surface/profile: built MV3 package in an isolated Chromium extension profile, including its service worker, content scripts, popup and options. A regular Vite page or an extension page opened in a browser tab alone does not prove native popup behavior.

Proof order: focused local state tests; typecheck/lint/build/package validation; packaged deterministic media and bookmark scenarios; native action-popup visual/keyboard proof; real public media/YouTube integration spot check when accessible. No authentication, paid provider or cloud integration is introduced. If a public player is unavailable, record that limitation and retain deterministic proof separately rather than claiming public-site completion.

Required scenario rows are the checklist in Test Strategy below. Record outcomes and evidence in this spec's execution history. No release or personal-browser installation claim follows from isolated-profile checks.

## Dependencies

Existing playback service snapshot/command contract, bookmark persistence, effective options settings, Chrome local storage and native popup packaging. Canonical product source: `shipglows_data/product/ext/product.md`. Existing source integration points: `ext/src/popup/Popup.vue`, `ext/src/playback/PlaybackCard.vue`, `ext/src/playback/background.ts`, `ext/src/background/background.ts` and `ext/src/options/Options.vue`.

## Invariants

Existing bookmarks remain intact. Global/pinned rate and loop semantics do not change. Data is local, with no automatic app synchronization. Skip is not success. Reading expert help is not a claimed skill completion. Reopening help is always possible. Repeated confirmation is idempotent and concurrent milestone writes preserve other completed milestones.

## Links & Consequences

Existing playback and bookmark workers provide trustworthy confirmation; the popup consumes progress and settings. Integration is UI-only: no new worker/content message surface or worker/content source changes are required. Options changes must update displayed shortcut help after reopening/reloading the popup and during any existing live settings subscription. No runtime schema migration of notes is needed. Revalidate bookmark creation/edit/open, playback controls and options navigation alongside onboarding to detect obstructed existing work. Public content can describe this journey later only after delivered behavior is verified.

## Documentation Coherence

After implementation, update `shipglows_data/product/ext/product.md`, `shipglows_data/workflow/TASKS.md` and the relevant extension guidance with actual behavior/proof. This spec owns readiness and execution evidence. Public site pages and release announcements are not automatically included; no public availability claim changes in this scope.

## Edge Cases

Fresh profile; existing user with stored notes but no progress; partial/corrupt progress; closed/reopened popup; multiple contexts completing different milestones; hidden help; skipped topic resumed; input focus with shortcuts; current tab switched or navigated during a command; pin unpinned later; cleared loop; no media; restricted URL; rejected rate; suspended service; empty note; failed save; failed tab opening; changed shortcuts; long text or constrained popup height. Historical success may remain completed after the user later clears a loop or unpins, but the panel must not misrepresent that past milestone as current playback state.

## Implementation Tasks

| Order | Target and action | Story link / dependency | Exact validation and constraints |
| --- | --- | --- | --- |
| 1 | Add local discovery model with independent milestone/skip/visibility keys and safe reads. | Resume without losing progress; depends on storage API. | Focused persistence, malformed-value, concurrent-key and idempotency tests; no note-schema mutation. |
| 2 | Connect completion writes to confirmed existing playback and bookmark results. | Trust observable success; depends on 1 and existing worker contracts. | Accepted/rejected speed, pin/loop, failed/successful save/open tests; no completion from merely viewing help. |
| 3 | Add accessible French discovery panel and permanent help entry in popup; read effective hotkeys. | Learn and resume in context; depends on 1–2. | Packaged first visit, hide/reopen, skip/resume, keyboard, settings change and constrained-height observations. |
| 4 | Add contextual recovery and expert/data help without expanding capabilities. | Understand limits and recover; depends on 3. | Empty/restricted/suspended/rejected state checks; verify no false sync, saved-loop or import-merge claim. |
| 5 | Run regressions, package/native popup proof and align internal docs. | Deliver reliable onboarding; depends on 1–4. | Existing bookmark/playback suites, `pnpm type-check`, `pnpm exec eslint src`, `pnpm build:ext`, proof checklist and metadata lint. |

## Acceptance Criteria

- AC1: A fresh supported-media popup makes the first useful speed action discoverable without blocking existing controls; only accepted application completes it.
- AC2: Excluding a tab and enabling a valid loop each complete only after confirmed state, with correct scope/lifetime explanations.
- AC3: Persisted notes and successful bookmark opening have distinct honest milestones; failures do not complete them.
- AC4: Closing/reopening, independent concurrent writes, hide, skip and resume preserve correct local state. Corrupt values cannot falsely complete milestones.
- AC5: Configured shortcuts and consultable favorite/boost/suspension help match existing controls and input protection.
- AC6: Recovery for absent media/restricted pages/rejected commands and data boundaries is actionable and truthful.
- AC7: Native popup remains usable by mouse/keyboard within its constrained viewport, with help always recoverable and core controls reachable.
- AC8: Existing note records, import/export and playback behavior pass focused regression/package checks; no permissions or external data flows are added.

ZOMBIES coverage: Zero media/progress/notes; One confirmed useful action; Many concurrent milestone updates and bookmarks; Boundaries rate/loop/viewport; Interfaces worker/storage/options/popup; Exceptions rejected commands/storage/navigation; Simple first-success scenario and resumable repeat use.

## Test Strategy

| Required scenario | Expected evidence |
| --- | --- |
| Fresh profile and real accepted speed change | First guidance visible; confirmation follows accepted media result. |
| Rejected speed, no media and restricted page | Recovery visible; speed completion remains false. |
| Tab exclusion and valid/invalid loop | Correct context help and only confirmed successful milestones. |
| Note persistence and saved timestamp opening | Separate saved/opened markers; failure paths remain incomplete; no asserted seek proof. |
| Close/reopen, skip/resume and hide/reopen | Local state retained; permanent help entry works. |
| Partial/invalid state and simultaneous milestone writes | Safe defaults and no loss of other keys. |
| Changed configured shortcuts and editable-field use | Labels reflect effective settings; no new shortcut interception. |
| Native popup at constrained height, keyboard and long help | Reachable actions, visible focus, no trapped navigation or clipped essential controls. |
| Bookmark/playback regressions and packaged contexts | Existing focused tests, lint, typecheck and complete extension build pass. |

## Risks

False achievement from stale snapshots is the primary risk: tie observation to successful operations and active confirmed state. Help may crowd a compact popup: keep it inline and collapsible and inspect the native surface. Storage failure must not prevent normal controls or show fabricated persistence. Rollback removes discovery integration and its separate keys without touching bookmarks or playback settings. Repeated writes are idempotent; retrying failed user actions retains existing command validation. No sensitive diagnostics, page URLs or note content are required for progress logging.

### OWASP Security Gate

This privileged extension increment adds no hosts, permissions, remote code, network calls or authentication. Applicable A01 access control / ASVS authorization boundary: only existing extension-owned operations may update milestones; page content is not accepted as an achievement command. Applicable A03 injection / ASVS output encoding: help is authored text and any configured shortcut text uses normal Vue text rendering, never HTML evaluation. A04 insecure design: persisted booleans confer no authorization, cannot modify notes and must not trigger tutorial actions automatically. Verify manifest/dependency diff, normal text rendering and isolated local storage writes. Residual risk is pre-existing player compatibility, documented explicitly.

## Execution Notes

First reads: root `AGENT.md`, operating conventions, `ext/AGENT.md`, product contract, popup/playback/worker/options source. Preserve unrelated dirty files, especially maintained legacy `ext/contentscript.js`. Prefer existing UI tokens and APIs. Run tools from `ext` for code checks and the root for governance metadata lint. Runtime proof must use the built package and host-approved browser tooling. Stop and return to the operator only for material scope changes, new external data/permission requirements or unresolved proof authority; routine integration choices remain authorized.

## Open Questions

None blocking implementation. Final component/module names are implementation choices within this contract. Native/public runtime results remain to be measured and must not be inferred from readiness.

## Skill Run History

| Date/time | Stage | Result and trace |
| --- | --- | --- |
| 2026-09-05, operator turn | Experience plan approval | User replied `validé` to first success, contextual progression, always-accessible resumable help, recovery and local-data guidance. |
| 2026-09-05T21:12:03+02:00 | Contract authoring | Bounded scope and behavior derived from approval and current extension/product guidance; no implementation mutation by spec author. |
| 2026-09-05T21:12:03+02:00 | Readiness baseline/review | Ready: actor, authority, trigger, success/error/edge states, exclusions, dependency ownership, task/proof trace, risk and documentation consequences resolved. Runtime evidence remains pending. |
| 2026-09-05 | Contract validation | Scoped ShipGlows metadata lint passed for this spec (1 file). UI-only confirmation boundary incorporated; no worker/content message expansion required. |

## Current Chantier Flow

Operator-approved experience plan → authored/readiness-reviewed contract → implemented → verified in packaged and native contexts → documentation aligned → scoped Git delivery. Publication is outside this task.

## Implementation And Verification Record

- Classification: Vue frontend and local discovery-domain state. Canonical tokens remain `ext/src/styles/styles.css`; native select/details/buttons own their standard interactions. JavaScript is required for existing extension APIs, reactive media results and local progress; no animation gates access to content. Agents: two bounded reviewers, with sequential spec/readiness and independent native proof; root owns integration.
- Implementation: `DiscoveryGuide.vue` in popup/options, strict independent boolean keys, optional hide/postpone/resume, configured shortcuts from validated runtime settings, five historical milestones. Speed confirmation waits for the in-flight poll and a fresh command snapshot and guards URL changes. Storage and message waits are bounded, failed navigation remains incomplete, and hidden/removed actions restore focus.
- UX correction from native proof: a 95px guide pane concealed instructions. The guide-visible pane now uses a 288px token and the popup scrolls to playback with a sticky header. A trial viewport-dependent body size collapsed the native popup; the final package retains the fixed preferred body size and root overflow isolation. Final 432x510 native proof confirms readable first instruction, practice action, skip/resume, hide/reopen, focused slider, actual 1.5x rate, reachable loop/footer and document scrollY=0.
- Automated proof: 25 bookmark/playback/discovery tests passed, then the expanded four-test discovery suite (including timeout) passed: 26 distinct tests total. `pnpm type-check`, extension build and seven-resource package validation passed. ESLint passed with four pre-existing warnings in untouched App/type shim files; changed components have no lint errors. Changed/new discovery token scans found zero findings.
- Packaged browser proof: all five milestones, invalid loop, invalid note save, failed bookmark navigation, failed progress storage, no media/restricted page, refused rate in the content isolated world, configured and malformed settings, suspension, close/reopen and local skip/hide recovery passed. `scripts/playback-browser.mjs` regressions passed after scoping selectors to the loop form; public W3Schools and the supplied YouTube video accepted 1.25x. This is scoped playback proof on public sites, not exhaustive compatibility or real-user onboarding research.
- Evidence: `scripts/discovery-browser.mjs`, `scripts/discovery-native.mjs`; native screenshots/report at `C:/Users/Diane/AppData/Local/Temp/rg-discovery-native-evidence-X8zKwC`; packaged screenshots at `C:/Users/Diane/AppData/Local/Temp/rg-discovery-proof`. Browsers closed normally.
- Documentation: product, architecture, code/docs map, extension guidance and task row aligned. Governance metadata lint passed for four YAML-bearing artifacts. `ext/AGENT.md` is an existing plain Markdown guide and is excluded from that schema check.
- Editorial: in-extension copy updated; site feature promises remain consistent and no installation/publication promise changes. Changelog classification: internal-only until an extension distribution event; no public announcement authored.
- Security/data: no manifest, dependency, worker/message or content-script changes; no telemetry, data migration or remote request added. Existing unrelated `ext/contentscript.js`, competitor research and environment/Kotlin files remain unstaged. Runtime package includes the existing working-tree legacy bundle; the new onboarding uses unchanged bookmark messages and does not depend on its unrelated list styling.
- Implementation Excellence Gate: passed for scoped functional/state/recovery/native UI proof. Residual boundaries: browser/player compatibility remains the existing product limitation; bookmark-open achievement means successful tab creation only; progress is local, not a measurement of durable learning or user comprehension.
