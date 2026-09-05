---
artifact: implementation_spec
metadata_schema_version: "1.0"
artifact_version: "1.1.1"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
created_at: "2026-09-05"
updated_at: "2026-09-05"
source_model: inherited
status: active
chantier_status: completed
source_skill: sg-development
scope: extension-universal-playback
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: [ext]
depends_on: []
supersedes: []
evidence:
  - "Operator approved implementation and explicitly selected all sites in the current conversation."
  - "ext/public/manifest.json, ext/src/background/background.ts and ext/src/popup/Popup.vue inspected."
next_step: "Reload the unpacked extension and open existing tabs again; later feature candidates remain in the research matrix."
---

# Title
Universal playback controls with shared speed and pinned tab exceptions

## Status
Implementation and verification complete for the scoped unpacked extension. Git delivery: `e9b4ad3813d697aa0f4e6c28dd22019581be8dec` on `main`, pushed to origin. This is not extension-store publication.

## User Story
As a video learner, I adjust my default pace from the ReplayGlows popup on any supported HTML5 website, isolate a tab when needed, and repeat a passage connected to my existing YouTube notes.

## Minimal Behavior Contract
Opening the popup shows the current tab's media and effective speed. Slider/presets change the shared speed for all unpinned tabs, or only the current pinned tab. Pin captures the effective rate; unpin immediately rejoins the shared rate. Missing media or restricted pages show an actionable unavailable state. A new media element inherits its tab context. Two timestamps can define a temporary repeat segment.

## Success Behavior
Actual media rates, popup state and storage agree after changes, reopening and navigation. Pinned tabs resist unrelated global changes. Bounds and active loop are visible. Existing bookmarks remain intact.

## Error Behavior
No-media, browser-restricted pages, disconnected frames and rejected rates do not claim success. Invalid inputs are rejected. Reopening or reloading reconnects supported pages. Other frames/tabs continue when one receiver is unavailable.

## Problem
Before this increment, the extension only annotated YouTube and lacked playback controls; app capabilities do not establish extension support.

## Solution
Separate universal content bundle, validated MV3 playback controller, compact popup card and options for shortcuts/favorite speed. Existing YouTube content bundle stays scoped to YouTube.

## Scope In
- HTTP/HTTPS HTML5 video/audio, including permitted embedded frames and dynamically inserted media/open shadow roots. Browser-protected pages and inaccessible media remain explicitly unsupported.
- Global remembered base speed, range 0.25–4x in 0.05 steps; presets 0.5/1/1.5/2, reset, favorite rate. Actual browser acceptance checked; no guarantee for arbitrary proprietary players.
- Pin overrides in session storage keyed by tab ID: survive navigation and worker restart, removed on tab close, reset on browser/extension restart.
- Temporary acceleration while holding a configurable shortcut; release/blur restores effective rate. Configurable rate/seek/favorite/loop/suspend commands, protected text input handling.
- Temporary A–B loop via current positions or existing YouTube bookmark pair; clear on navigation/media replacement or explicit stop. No saved bookmark schema mutation.
- Popup visible bottom card, actual target and status, keyboard labels, loop controls and settings access.

## Scope Out
Audio capture/effects, filters, saved segments, note-specific persisted speeds, frame-exact stepping, custom URL rules, app/backend changes and Web Store publication. These remain research candidates.

## Constraints
Preserve pre-existing ext/contentscript.js changes. No remote scripts, telemetry, page-world API bridge, dependency additions or external messages. Style tokens owned by ext/src/styles/styles.css. Universal functionality requires HTTP/HTTPS host access approved by the user; file URLs are not included.

## Test Contract
Run pnpm type-check, pnpm exec eslint src, pnpm build:ext and existing bookmark tests. Run new state/concurrency tests and packaged Chromium tests with at least two origins, video/audio, iframe, dynamic media, global/pin/unpin, reload, loop, shortcut text guard, popup errors and screenshots. Test a public HTML5 page and YouTube when reachable; record network/provider limits separately. Isolated profile only.

## Dependencies
Existing Vue/Vite/Chrome APIs. Official content-script and chrome.storage documentation consulted 2026-09-05. No server required: extension dist is proof target.

## Invariants
Shared setting has one owner; pinned exception never overwrites it. Mutations serialized. MV3 globals are not persistent state. Sender tab/frame are authoritative for content messages. Page JavaScript cannot invoke extension mutations. Bookmark data contract unchanged. Partial broadcast failure cannot fail persisted settings silently.

## Links & Consequences
Research: shipglows_data/business/project-competitors-and-inspirations.md. Manifest access expansion affects install warning; docs explain it. Existing YouTube worker remains bookmark owner. No app/site behavior or marketing promise changes.

## Documentation Coherence
Update ext/AGENT.md, technical/architecture.md, research status and workflow/TASKS.md. Internal change; no public marketing comparison or release claim.

## Edge Cases
ZOMBIES: zero media; one/many media and frames; boundary rates/nonfinite values; missing receiver; hostile inputs; worker suspension; rapid concurrent writes; DOM/SPA replacement; focus loss; invalid/reversed loop bounds; live/infinite duration media; tab closure. Scope errors surface in popup rather than fake success.

## Implementation Tasks
1. Create shared protocol and background serialized settings/pin service; test persistence and sender validation.
2. Add isolated universal media bundle and manifest build mapping; test discovery, commands, lifecycle and rate restoration.
3. Add tokenized popup card/options and bookmark pair integration; typecheck and render.
4. Run package/runtime regressions, update mapped docs and scoped delivery evidence.

## Acceptance Criteria
All Test Contract scenarios pass or have explicit provider-specific evidence limits. No modified bookmark baseline is staged. Content bundles are classic self-contained JS. Popup remains usable with long bookmark lists. Failed rate application visible. No undefined protected-page behavior.

## Test Strategy
Domain tests then type/lint/build then isolated packaged-browser scenarios; screenshot visual review and public-page validation last. No ordinary localhost Vue preview substitutes for extension proof.

## Risks
Sites may force speed, media may be in closed shadow roots or blocked frames. Apply on user/state/media changes without infinite fights. Restricted Chrome pages cannot host content scripts. Avoid claiming universal compatibility.

## OWASP Security Gate
Extension boundary review: authoritative sender checks and strict settings/command validation address access control and input injection risks. No new network/data export and no evaluation of page strings. Invalid sender/settings and restricted receivers tested. Formal ASVS certification not claimed.

## Execution Notes
First read: manifest, worker, content entry, popup, options, token CSS. Add a separate bundle to avoid injecting YouTube bookmark styles into other sites. All UI uses French. Defaults are local mechanical choices within approved scope.

## Execution Batches
- Protocol frozen in ext/src/playback/protocol.ts by root before delegation.
- Worker agent: ext/src/playback/background.ts only plus ext/scripts/playback-state.test.mjs. Root integrates worker import/listener boundary.
- Media agent: ext/src/playback/media.ts only. No runtime shared imports; type-only protocol imports keep classic bundle.
- Root: popup/options components, CSS, manifest/build integration, documentation and browser proof. Root owns integration. No concurrent edits to overlapping paths.

## Open Questions
None blocking this increment. Deferred research rows are explicitly Scope Out.

## Skill Run History
| Date | Stage | Result |
| --- | --- | --- |
| 2026-09-05 | 100-sg-spec | Contract written from approved matrix and all-sites decision. |
| 2026-09-05 | 101-sg-ready | Ready: bounded scope, pin lifecycle, permission boundary, UI authority and proof resolved. |
| 2026-09-05 | 102-sg-start | Implemented media/worker/protocol, tokenized popup/options, manifest/package entry and focused tests. |
| 2026-09-05 | 103-sg-verify | 22 automated tests, typecheck, lint, package, multi-origin fixtures, public YouTube/W3Schools, bookmark-to-loop and native popup scenarios pass. |
| 2026-09-05 | 104-sg-end | Scoped implementation verified; mapped docs updated; no public site/editorial change or store publication. |
| 2026-09-05 | sg-docs update | Added canonical extension product contract, reconciled shared product/claims/navigation and dated research versus delivered capabilities. Existing runtime evidence retained; no new runtime verification claimed. |

## Current Chantier Flow
Implemented → verified → closed → delivered in `e9b4ad3` on `main`. No Web Store release or personal Chrome profile installation is claimed.

## Verification Evidence

- Automated: 5 bookmark, 10 worker and 7 media tests passed. Covers concurrent rate writes, worker restarts, pins, invalid senders/settings, inherited-frame origins, bookmark shortcut collisions, AZERTY/logical keys, temporary boost restoration, dynamic discovery, mixed-media selection and loop lifecycle.
- `pnpm type-check`, `pnpm exec eslint src --quiet`, `pnpm build:ext` passed. Manifest-resource verifier found seven resources. Content/media outputs inspected as classic scripts without runtime module imports.
- `scripts/playback-browser.mjs`: ten packaged Chromium fixture scenarios passed across example.com/example.org, audio/video, an embedded frame, open shadow root, global/pin/unpin/reload, actual media rates, A–B repetition, input protection, popup controls, options, suspension, unavailable page, existing bookmark pair and SPA invalidation.
- Public W3Schools HTML video and the operator's Global Speed demo YouTube video both accepted 1.25x with matching snapshots and no playback error. The first attempted MDN example URL exposed no video within the bounded timeout; W3Schools provided successful independent public-site proof.
- Genuine action popup opened using `chrome.action.openPopup` and separate CDP target in isolated sandboxed Chromium. Actual native input changed media to 1.5x and pinned its tab. Final native viewport proof: independent bookmark pane scrollTop 72, outer scrollY 0, Options visible at y126–170 after scrolling, fixed playback card and footer bottom494 within a 510px viewport. Empty content no longer overlaps. A stable preferred body size avoids Chrome/viewport autosizing feedback. This is the actual action popup surface under headless Chromium, not Windows browser-chrome proof or personal-profile installation.
- Design-system drift scan: zero findings after clarifying a non-visual media-area calculation which the regex initially misclassified as CSS. Canonical CSS owns every new visual value. Metadata passes on governed spec/architecture/research; legacy ext/AGENT.md has no YAML frontmatter and is reviewed as project instructions, not converted merely for lint.
- Existing uncommitted `ext/contentscript.js` gesture work was preserved and excluded from owned delivery. Local package includes that working-tree baseline; new playback is a separate bundle and the saved bookmark schema is unchanged. The separately tracked legacy bookmark bug remains fixed-pending-verify; this task does not close that independent record.
- Validation surface: unpacked extension, per ext/AGENT.md and root operating conventions. Root Vercel preview policy concerns hosted web surfaces; no app/backend/site change or extension-store publication is included.
- Documentation updated: ext/AGENT.md, architecture and competitive research. Editorial alignment unaffected: no public website copy changed. Changelog classification: internal-only development delivery, not a published extension release.
