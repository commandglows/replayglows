---
artifact: implementation_spec
metadata_schema_version: "1.0"
artifact_version: "1.0.2"
project: replayglows
created: "2026-09-23"
updated: "2026-09-23"
created_at: "2026-09-23T21:03:00+02:00"
updated_at: "2026-09-23T22:11:00+02:00"
source_model: gpt-6
status: ready
chantier_status: in_progress
source_skill: sg-design
scope: chrome-extension-popup-layout
owner: Diane
confidence: high
risk_level: low
security_impact: no
docs_impact: yes
linked_systems: [ext]
depends_on:
  - "shipglows_data/product/ext/product.md"
  - "shipglows_data/technical/design-system-authority.md"
  - "ext/AGENT.md"
supersedes: []
evidence:
  - "Operator approved the proposed popup re-layout on 2026-09-23, with the playback speed card remaining sticky at the bottom."
next_step: "Resolve the isolated Playwright/Chromium runtime and complete packaged/native popup proof."
---

# Title

Rebalance ReplayGlows Chrome popup layout

# Status

Ready for implementation. The operator approved a layout direction: retain every capability, keep playback speed controls anchored at the bottom, reduce crowding by improving hierarchy and scale, and make the help panel collapsed by default while preserving its visible entry point.

# User Story

As a ReplayGlows extension user, I can find playback speed controls and saved bookmarks quickly in the Chrome popup, while still reaching help, options, and the app without the popup feeling cramped.

# Minimal Behavior Contract

When the user opens the extension popup, the playback speed card is the final anchored region at the bottom, the bookmark list occupies and scrolls through the flexible center area, and help is collapsed if no visibility preference has been saved. The `discovery.v1.hidden` preference is tri-state: absent means collapsed; `false` means the user explicitly asked to show help and it opens; `true` means hidden. The permanent help entry opens it and saves `false`; hiding it saves `true`. Opening help replaces the bookmark-list view in the center area; it does not push the speed card out of view. At 600 CSS px and 360 CSS px viewport heights, the bottom card remains anchored, with list/help contents taking the remaining space. Loop detail content may scroll independently while its summary stays reachable. This layout contract covers those two popup heights; shorter viewports are outside this change's proof scope.

# Success Behavior

The header and actions are compact, the playback card is the last fixed block at the bottom, and the bookmark list can scroll without moving the playback controls. The local-data indicator sits by the brand in the header. Help, options, app navigation, bookmark editing, and loop controls remain reachable. French and English labels continue to fit without clipping. Native Chrome popup proof at 600 CSS px and 360 CSS px viewport heights demonstrates the behavior.

# Error Behavior

At the specified 600 CSS px and 360 CSS px popup heights, long bookmarks/help content scrolls in the center region and expanded loop details scroll within their panel. No primary playback control is clipped or made unreachable. Existing loading, empty, error, and bookmark states continue to render in the center region.

# Problem

The popup puts help, bookmarks, and secondary navigation into one scrolling column, while the speed card and footer compete for the remaining height. Its current overflow rules can make the whole popup scroll and compress or displace useful content when help or loop details expand.

# Solution

Use a compact header with a persistent help entry, the local-data indicator and secondary app access; leave options reachable from the existing playback settings control. Keep the speed card as the final anchored block. Give the flexible center region responsibility for bookmark-list scrolling; when help is requested, show the help panel there instead of squeezing it together with the list. Tune spacing and control grouping only through the canonical extension token/style layer. Preserve saved help preference and progress semantics.

# Scope In

1. `ext/src/popup/Popup.vue`: reorganize header, secondary app action, help and bookmark center content; preserve note editing and all existing navigation.
2. `ext/src/discovery/DiscoveryGuide.vue`: collapsed-by-default behavior for new users while preserving explicit visibility preference, progress and accessible focus restoration.
3. `ext/src/styles/styles.css`: popup viewport containment, centered region scrolling, bottom playback-card anchoring, proportionate density, and safe expanded-help/loop behavior through canonical tokens.
4. Align `shipglows_data/product/ext/product.md` and the current contract/proof expectations in the completed onboarding spec with the new default; preserve historical run evidence.
5. Native popup review at 600 CSS px and 360 CSS px, empty/populated bookmarks, absent/false/true help preference, completed/skipped progression, help open/closed, and loop details open/closed.

# Scope Out

YouTube-injected controls and CSS, playback behavior or persistence, bookmark schemas, settings semantics, manifest permissions, app/backend/site surfaces, brand direction, publishing, deployment, and changes to unrelated dirty files.

# Constraints

- Keep all current features and French/English support.
- Playback speed card remains anchored at the bottom and its speed controls stay visible when help opens.
- The help entry remains visible; absent `discovery.v1.hidden` collapses the guide, explicit `false` opens it, and `true` hides it. Clicking the header entry opens and persists `false`; learning progress, skip state, and recovery explanations remain intact.
- Preserve the existing uncommitted note editor change in `Popup.vue`.
- Use `ext/src/styles/styles.css` and existing semantic ReplayGlows tokens as the visual authority; do not introduce raw layout values in Vue templates.
- Do not modify unrelated working-tree changes.

# Test Contract

Surface/profile: packaged MV3 Chrome extension action popup in an isolated local browser profile. A regular web rendering of `Popup.vue` is not sufficient to claim native popup layout proof.

Proof order: focused static inspection and existing typecheck; Doppler-backed typecheck and package build; native Chrome popup screenshot and keyboard walkthrough at 600 CSS px and 360 CSS px. If Doppler cannot resolve project/config, record typecheck/build as blocked and unproven without direct pnpm fallback. This task adds no new data or behavior service. Visual proof is required for the sticky card/scrolling claim; accessibility is checked from the actual accessibility tree and keyboard focus order.

# Dependencies

Existing Vue popup, `DiscoveryGuide` local visibility/progress keys, `PlaybackCard` details behavior, extension semantic CSS tokens, and Chrome's native popup viewport constraints.

# Invariants

Bookmarks and playback remain available; the speed card stays anchored to the bottom; help remains reachable; completed/skip progress is not reset; saved bookmarks and note edits are preserved; no new permissions, telemetry, or network calls are introduced.

# Links & Consequences

The popup consumes `DiscoveryGuide` visibility/progress and `PlaybackCard` settings/loop state. No background, content-script, storage-schema, or public-site behavior changes are needed. Existing bookmark, note, playback and onboarding journeys must remain reachable in the popup. Align the product contract and onboarding spec with the collapsed-by-default help behavior while preserving the historical September 5 proof; do not claim native proof from a page build.

# Documentation Coherence

Update `shipglows_data/product/ext/product.md` and the current behavior/test contract in `shipglows_data/workflow/specs/monorepo/2026-09-05-extension-onboarding.md` to state that the guide starts collapsed when no explicit preference exists; retain `false` as explicit visible and `true` as hidden. Keep the historical 2026-09-05 run as historical evidence, then record new proof separately. No public site copy or release note changes are in scope.

# Edge Cases

Fresh profile with absent visibility preference; explicit `false` and `true`; completed and skipped lessons; empty and long bookmark lists; long titles/notes; note editor open; help panel open; loop details expanded; no supported media; 600 CSS px and 360 CSS px native popup viewports; keyboard navigation and focus return after help closes.

# Implementation Tasks

1. Re-read current `Popup.vue`, `DiscoveryGuide.vue`, `PlaybackCard.vue`, CSS tokens, onboarding spec, and working diff. Preserve unrelated note editing. User-story link: popup hierarchy. Validation: review exact diff before edits.
2. Recompose popup regions so header and secondary actions use less space, help is optional in the center region, bookmark list is its normal scroller, local-data indicator moves into the header, and the speed card is the final anchored block. User-story link: reach core tasks. Validation: inspect DOM hierarchy and token use; keep all current actions.
3. Adjust canonical CSS overflow/height rules and density for constrained native popup. User-story link: reachable controls at available heights. Validation: no whole-popup scroll during normal list use; expanded help/loop content has a bounded, usable scroll area.
4. Preserve explicit help preference/progression and contextual focus; update product and onboarding contracts to match the new default. User-story link: revisit help without losing place or progress. Validation: inspect absent/false/true preference, completed and skipped states.
5. Run the focused proof in Test Strategy and inspect actual popup visuals/accessibility at both specified viewport heights. Record unavailable Doppler/browser proof explicitly; do not infer it from static checks.

# Acceptance Criteria

- Fresh popup presents a compact header, visible help entry, bookmark region, and bottom-anchored playback card without competing primary navigation buttons.
- Bookmark list scroll does not move the speed card; card remains visible at the bottom at constrained heights.
- Opening help uses the center area and preserves its progress and close/focus-return behavior.
- Expanding loop controls does not hide speed value, slider, presets, or the card's settings action.
- App and options destinations remain reachable; bookmarks and notes remain operable.
- French and English labels, empty/loading/error states, and keyboard focus remain usable without clipping.
- No unrelated changes, YouTube injected styles, permissions, network behavior, or data contracts change.

# Test Strategy

Use `pnpm type-check` and `pnpm build:ext` from `ext` through Doppler. If the Doppler project/config is unavailable, do not invoke pnpm directly; record the build/typecheck as blocked and unproven. Then load the resulting package in an isolated Chrome profile and inspect the native action popup at 600 CSS px and 360 CSS px viewport heights. Walk through empty/populated list scrolling, absent/false/true guide visibility preference, completed/skipped progress, help open/close, note editing, options/app navigation, speed card interaction, loop expansion and keyboard focus. Capture screenshots/accessibility evidence. Do not treat typecheck/build as visual proof. No new automated tests are required unless implementation introduces new state behavior beyond existing visibility preference semantics.

# Risks

- A flex or overflow rule can move the speed card when Chrome constrains the popup height; mitigate at the supported 360 and 600 CSS px heights through native-popup proof.
- A collapsed help default could override prior user intent; preserve any explicit stored visibility selection and all progress values.
- A single scroller can become too crowded when loop details expand; cap and scroll only expanded detail content while leaving the primary controls visible.
- Existing working-tree edits in `Popup.vue` and injected YouTube files must remain untouched outside their owned lines.

# Execution Notes

First-read files: `ext/src/popup/Popup.vue`, `ext/src/playback/PlaybackCard.vue`, `ext/src/discovery/DiscoveryGuide.vue`, `ext/src/styles/styles.css`, `shipglows_data/product/ext/product.md`, `shipglows_data/workflow/specs/monorepo/2026-09-05-extension-onboarding.md`.

Implementation is limited to the popup and help visibility contract. Keep the current checkout and unrelated worktree state. Do not commit, push, publish, deploy, or modify YouTube-injected UI as part of this task.

# Open Questions

None. The operator selected the layout direction and explicitly retained the bottom-anchored speed card.

# Skill Run History

| Date | Skill | Result | Evidence |
|---|---|---|---|
| 2026-09-23 | 100-sg-spec | draft | Operator-approved popup layout direction; local source and product contract inspected. |
| 2026-09-23 | 101-sg-ready | ready | Adversarial review resolved help preference tri-state, bottom card position, supported popup heights, Doppler requirement, and documentation updates. |
| 2026-09-23 | 006-sg-design | partial | Popup/discovery/CSS implementation, product/onboarding alignment and proof-script updates are in place. Doppler typecheck and package build pass; packaged/native proof scripts are blocked because PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM are absent from the replayglows/dev environment. |

# Current Chantier Flow

`100-sg-spec` -> `101-sg-ready` ready -> `006-sg-design` implementation partial -> resolve isolated Playwright/Chromium runtime -> packaged/native popup visual/accessibility proof -> report completion/limits.
