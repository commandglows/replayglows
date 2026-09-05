---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
status: reviewed
source_skill: sg-bug
scope: extension-canary-functionality
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: []
depends_on: []
supersedes: []
evidence:
  - "Chrome Canary 155.0.8043.0, dedicated profiles, real public YouTube playback."
  - "BUG-2026-09-05-001 and ext/scripts/bookmarks.test.mjs."
next_step: "Operator visual acceptance of the tested Canary version before final bug closure."
---

# Extension Functionality in Chrome Canary — 2026-09-05

## Authority and scope

The operator approved restoring existing bookmark creation, notes, revisit, edit/delete, shortcuts, persistence and import/export, with tests in a dedicated Chrome Canary profile. This replaces the earlier Docker-only scope for this new work item. No dependency migration, backend change, global browser setting, personal browser profile, hosted deployment, CI gate or branch-protection change was made.

The source baseline had logging-only content/background entrypoints and a popup entry mounting placeholder App.vue. The legacy integration was disconnected. Source evidence and the existing unpacked package reproduced a missing note editor after Alt+B on a real public YouTube video. Package generation alone had not established bookmark functionality.

## Repairs

- Bundle the existing YouTube content integration as a classic script; mount the Vue popup and use a typed worker that serializes storage writes without relying on persistent worker memory.
- Preserve canonical url/time bookmark storage, accept historical timestamp/videoId records, and derive grouped data consistently. Invalid imports are atomic; replacing a collection requires explicit confirmation in the options UI.
- Repair zero-second bookmarks, cross-video identity, shortcut case matching and text-input handling, SPA event cleanup, duplicate render races and delayed-save editor identity. A duplicate timestamp produces a clear error and retains the unsaved note.
- Render notes as text. Marker clicks seek without changing stored time; a real drag retains the existing greater-than-five-second threshold. Delete controls do not start a drag.
- Reconnect options import/export and French keyboard controls. Remove conflicting legacy gradient classes from the options form so labels and actions remain legible.
- Keep timeline notes above the progress bar and hidden outside marker hover/focus; constrain them to the player and make sidebar text readable at YouTube's smaller document font scale.

## Browser evidence

Tests used installed Chrome Canary 155.0.8043.0, not Playwright Chromium. The driver loaded only this unpacked extension through Chrome's Extensions debugging API into dedicated temporary profiles. Live YouTube checks used the public 19-second `jNQXAC9IVRw` video without account authentication. A separate final profile used Chromium sandboxing enabled. No personal extension data was read or changed.

| Scenario | Observed result |
| --- | --- |
| Add at 0:00 via player button and Enter | Note persisted and appeared in sidebar, marker and popup. |
| Alt+B / Escape and Alt+Q | Editor opened/cancelled; quick bookmark saved at 9 seconds. |
| Inline and popup note edit | Saved text synchronized; HTML-looking text remained literal, with no injected image. |
| Timestamp and previous/next | Click sought to 0 seconds; Alt+2 sought to 9, Alt+1 back to 0. |
| Popup revisit | Opened a new real YouTube tab with t=9s; observed playback position 9.89 seconds. |
| Popup and timeline delete | Removed the selected test record while retaining the other record. |
| Custom shortcut and clear | Alt+Shift+B worked without page reload; clearing disabled it; Tab left the options input. |
| Preferences | Hide-notes hid sidebar note text; hide-buttons removed save/cancel controls while Escape remained usable. |
| JSON and Markdown export | Downloaded two canonical records including time zero; clipboard contained the test note and timestamp URL, no undefined fields. |
| JSON restoration | Deleted a test record, accepted replacement, restored both exported records. |
| Invalid and cancelled import | Existing records stayed intact. Final invalid-input feedback did not add a runtime error to the active extension journal. |
| Duplicate timestamp | Explicit error kept the newly typed note in the editor rather than silently discarding it. |
| Marker click and drag | Click preserved stored times; a four-second drag snapped back; a larger drag changed 9 to 17 seconds. |
| Old stored schema | Preseeded historical timestamp/videoId fixture appeared on initial video load without requiring a migration write. |
| SPA navigation | Search results removed the sidebar; clicking the video result restored one panel and one working editor. |
| Page and browser restart | Both records survived page reload and full Canary process closure/relaunch with the same test profile. |
| Native toolbar popup | Actual Chrome extension popup opened and its two records/actions were observed through Windows accessibility and screenshot. |
| Options layout | Final labels/actions readable at 800px and 480px widths without horizontal page overflow; Tab still leaves the shortcut field. |
| Final timeline layout | Tooltip stays inside the player above controls; sidebar lists 0, 5 and 9 seconds chronologically. Actual marker drag from 9 to 17 and back to 9 preserves working geometry. |

Normal clicks, keyboard input, file selection and downloads were used for user-flow checks. Storage seeding was limited to the explicit historical-schema migration fixture. The deferred-save race is covered by a focused automated regression using an outstanding response and replacement editor, not by a claimed live slow-network reproduction.

## Verification and limits

Five automated behavioral tests pass, covering validation, legacy schemas, concurrent writes, identity-scoped deletion, worker restart, queue recovery, shortcut editing and the late-save race. Typecheck and build pass with six manifest resources. The independent review's marker, legacy-store, duplicate-note and delayed-save findings were addressed.

The design-drift scan reports 434 inherited candidates across the two touched style authorities (255 in styles.css, 179 in styles-youtube.css), matching isolated HEAD baseline scans. No new candidate was introduced; this is not a claim that the legacy style corpus is globally clean.

The first test profile's journal retained one deliberately triggered invalid-import diagnostic from the intermediate version. It was not presented as a clean journal. The final implementation treats malformed import as user feedback; a fresh profile's actively collecting journal reported zero runtime or manifest errors after that case. The personal-profile journal was not read. No exhaustive teardown-at-every-pending-message, signed-in YouTube, Shorts, live-stream, other browser or sync claim is made.

Screenshots and the exploratory check ledger are local test evidence under the task's visualization output directory; no public browsing history or personal data is committed. The final Canary profile is retained for the operator's visual acceptance. The bug remains fixed-pending-verify until that acceptance; no release or store publication is claimed.

Documentation: extension runtime guidance, architecture note, task and bug evidence updated. Existing public copy is not expanded; changelog classification is internal-only until operator acceptance and delivery. Docker image validation remains the separate earlier audit and was not rerun for this functional change.
