---
artifact: implementation_spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-17"
updated: "2026-09-17"
status: active
chantier_status: verified
source_skill: sg-design
scope: extension-options-layout
owner: Diane
confidence: high
risk_level: low
security_impact: no
docs_impact: yes
linked_systems: [ext]
depends_on:
  - "shipglows_data/technical/design-system-authority.md"
  - "ext/AGENT.md"
supersedes: []
evidence:
  - "Operator approved the three-column options plan with oui in this conversation."
next_step: "Reload the unpacked extension in personal Chrome for operator review."
---

# Extension options organization

## Approved outcome and readiness

Ready: retain the existing second-section cards, fields, colors and spacing while integrating the former full-width playback section. Preserve all settings, autosave, shortcut conflict validation and data import/export behavior. No backend, authentication, permissions or release changes.

## Layout

1. Playback and display: favorite speed, pointer/hover behaviors, bookmark display preferences, language.
2. Playback shortcuts: speed and its increment, seeking, A-B loop, pause/reactivation.
3. Bookmarks and data: bookmark shortcuts, existing export and import cards.

Use three columns on large screens, two at intermediate widths and one on narrow screens. Detailed explanations and the discovery guide remain available in a collapsed help area after the settings. Reuse the extension canonical styles and native controls.

## Proofs

Typecheck, focused lint, package build, packaged Chromium at 1600/1000/390 px, keyboard navigation, autosave and reload persistence, shortcut conflict and reset, existing playback regression suite. Inspect screenshots in French and English. Personal Chrome is a separate reload step.

## Current Chantier Flow

- Approved plan implemented and verified locally. Personal Chrome reload remains an operator step; no publication or push.

## Skill Run History

- 2026-09-17: sg-design — existing visual reference captured; three-column organization implemented using existing cards and control styles; detail help collapsed below settings.
- Verification: type-check, focused ESLint, build/package verifier, existing packaged playback regression suite and options browser suite passed. Inspected FR captures at 1600/1000/390 px and EN at 1600 px. Corrected the intermediate-width gap and verified keyboard order, autosave, reload persistence, shortcut conflicts in both directions, reset, language persistence and help expansion. Final options rerun passed after the responsive correction and transient saved feedback.
- Evidence: `ext/scripts/options-browser.mjs`, `ext/scripts/playback-browser.mjs`; local captures in `%TEMP%/rg-options-design/`.

- 2026-09-17 follow-up approved: compact both shortcut families into wrapping label/field rows and replace clear text with a shared eraser SVG. Accessible action names and native tooltips retained. Build/typecheck, focused ESLint and packaged options tests passed; verified horizontal rows at 1600 px, wrapping at 390 px, icon presence and actual persisted clearing for both shortcut families.

- Playback eraser follow-up: operator reported stale visual fields specifically in playback shortcuts. Isolated reproduction cleared the value but retained the Disabled placeholder; the old-shortcut symptom was not reproduced. Removed that placeholder, separated each button from the input label, and centralized clearing through an immutable keys update. Regression now clicks the SVG of all 11 playback erasers and checks immediate empty DOM values, absent placeholder, persisted empty keys and reload. Final packaged options suite, focused lint and package build passed. Personal-browser reproduction remains unverified.
