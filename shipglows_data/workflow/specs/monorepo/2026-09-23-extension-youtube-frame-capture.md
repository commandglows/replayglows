---
artifact: implementation_spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-23"
updated: "2026-09-23"
created_at: "2026-09-23T00:23:15Z"
updated_at: "2026-09-23T00:25:49Z"
source_model: GPT-6
status: draft
chantier_status: not_ready
source_skill: sg-development
scope: extension-youtube-frame-capture
owner: Diane
confidence: medium
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: [ext]
depends_on:
  - "shipglows_data/product/ext/product.md"
  - "shipglows_data/technical/architecture.md"
  - "shipglows_data/technical/design-system-authority.md"
  - "shipglows_data/workflow/specs/monorepo/2026-09-15-extension-app-parity.md"
  - "shipglows_data/workflow/bugs/BUG-2026-09-18-003.md"
supersedes: []
evidence:
  - "Screenshot YouTube competitor review in shipglows_data/business/project-competitors-and-inspirations.md, originally checked 2026-09-07."
  - "Current extension contract, manifest, content-script entrypoint and bookmark schema inspected on 2026-09-23."
  - "Chrome for Developers content-script, permission and download documentation checked 2026-09-23."
  - "In-progress extension parity contract and YouTube-controls bug record identify current overlapping work."
next_step: "After the active parity contract and BUG-2026-09-18-003 release the YouTube content script, revalidate sequencing and rerun readiness."
---

# Title
Capture a YouTube video frame from the ReplayGlows extension

## Status
Concept drafted and checked for readiness on 2026-09-23. Verdict: not ready for implementation. The active extension-app-parity contract freezes YouTube content-script behavior, and the overlapping YouTube-controls repair is still in progress. This spec does not authorize work ahead of those owners.

## User Story
As a video learner watching a YouTube lesson, I select ReplayGlows' capture control and save the frame currently shown by the player as a PNG whose name identifies the video and timestamp, so I can keep a visual example with my study material.

## Minimal Behavior Contract
On a supported YouTube watch page, selecting the accessible ReplayGlows capture button takes the current decoded frame from the active, non-ad video and starts one local PNG download named with the YouTube video ID and rounded playback time. A missing frame, unavailable pixel data, encoding failure or rejected download reports a recoverable error and creates no success state; capturing never pauses, seeks, mutes or changes playback speed.

## Success Behavior
The user receives one valid, non-empty PNG showing the frame visible at activation, with its video ID and timestamp in the filename. The control announces completion only after PNG creation and the browser accepts the download action. Video time, pause/play state, volume, mute state, speed, notes and bookmark records remain unchanged. Packaged Chrome proof confirms file type, image dimensions/content, filename and playback invariants.

## Error Behavior
The control is unavailable or reports that the frame could not be saved when the page is not a YouTube watch page, the player is absent or showing an ad, the video has no decoded frame, canvas access is blocked, encoding fails, or Chrome refuses the download. The message gives the user a concrete retry after the video is ready. No blank file or success message is emitted; no automatic full-tab screenshot fallback captures unrelated page content.

## Problem
ReplayGlows retains timestamped text bookmarks and notes but has no way to keep a useful diagram, slide or code example from the current video frame. The supplied competitor demonstrates demand as a product hypothesis, not verified ReplayGlows customer demand.

## Solution
Add one localized, keyboard-accessible capture button beside the existing ReplayGlows bookmark control in the YouTube player. Use the already selected player video, an in-memory canvas and a PNG Blob, then start a user-initiated browser download. Keep image bytes transient in memory; the downloaded file is the user's local output.

## Scope In
- YouTube watch pages matched by the existing content script; the main active video only.
- One capture per explicit button activation; the video may be playing or paused.
- PNG at the decoded video dimensions, without browser chrome, YouTube controls, DOM overlays or external captions.
- Filename composed from a fixed ReplayGlows prefix, validated YouTube video ID and rounded timestamp; no page title, full URL or note text in the filename.
- French and English accessible button name, focus state and success/error feedback, using the existing YouTube control styles and localization conventions.
- No new extension API or host permission in this increment. Use the existing user-initiated download flow and verify it in the packaged extension. If it cannot work reliably without `downloads` permission, stop for an operator permission decision; do not add the permission silently.

## Scope Out
- Copying image data to the clipboard, keyboard shortcuts, burst capture, editing/cropping, watermarks or automatic capture.
- Saving the image in bookmark storage, attaching it to a note, changing JSON/Markdown import/export or creating a local gallery.
- Flutter/app, Convex/backend, cloud sync, account association, upload, sharing, telemetry or public claims.
- Shorts, embedded YouTube players outside a watch page, other sites, audio, browser UI and full-tab capture.
- Changes to the active extension-app-parity or YouTube-controls repair contracts.

## Constraints
- Preserve the current bookmark/time schema and serialized worker ownership; capture must not create or update a bookmark as a side effect.
- Integrate with `ext/contentscript.js` through the existing `ext/src/content/content.ts` classic-script bundle and `ext/public/manifest.json` entry. Check the current diff and active bug repair before editing shared files.
- Treat video metadata and page state as untrusted. Use DOM text APIs, never interpolated `innerHTML`; validate the video ID, timestamp, MIME type, dimensions and filename.
- Use the existing localized controls' semantics. Visual tokens for the extension live in `ext/src/styles/styles.css`; YouTube injected-control styling follows `ext/src/styles/styles-youtube.css` and the design authority's documented legacy boundary.
- No backend, authentication, network request, new dependency, manifest permission or remote code.

## Test Contract
- Surface: packaged MV3 extension in an isolated Chromium profile; no personal profile, auth, app server or backend is needed.
- Unit proof: frame readiness/zero dimensions, metadata validation, filename sanitization, PNG Blob type and non-empty output, canvas/encoding rejection, active-ad/no-player states and single-click behavior.
- Packaged browser proof: actual button placement, accessible name and keyboard activation; playing and paused frames; resulting PNG bytes/dimensions/visual content and filename; timestamp rounding; fullscreen; YouTube SPA navigation and video replacement; denied/blocked download and canvas security failure; no duplicate button or altered playback/bookmark state.
- Live-site proof: one ordinary public YouTube watch video confirms decoded-frame capture and browser download. Record the URL only in local test evidence if needed; never store it in app diagnostics. Network unavailability is an explicit proof limit, not a pass.
- Regression: existing bookmark add/edit/delete, shortcut behavior, overflow menu, speed controls and fullscreen lifecycle continue to work.
- Checks: from `ext`, run `doppler run -- pnpm type-check`, focused lint for changed source, and `doppler run -- pnpm build:ext`; then run the focused new tests and existing YouTube-control tests. Run commands only after this spec's dependencies and readiness conflict are cleared. The root agent instruction requires Doppler for builds and runs.
- Manual checklist: no dedicated checklist file required; the scenarios above are bounded and observable. No authenticated/browser-account proof is in scope.

## Dependencies
- Chrome MV3 content scripts, canvas `drawImage`/Blob encoding and browser download behavior.
- Existing `www.youtube.com` content-script match, player discovery and SPA lifecycle.
- Current localized YouTube control copy/styles.
- Sequencing after the active extension-app-parity work and `BUG-2026-09-18-003` before modifying the shared YouTube content script.

## Invariants
- A click captures the active frame once; stale media references after SPA navigation cannot produce a success result for a different video.
- `currentTime`, paused/playing, mute, volume, playback rate, bookmark data and storage are unchanged.
- Frame pixels and metadata stay in memory only until the user-started download finishes or fails; they are not sent to the worker, a page, a server or logs.
- The filename uses only validated video ID/time and fixed characters; the control cannot select an arbitrary URL or filesystem path.
- Failure is explicit and recoverable; no fallback expands capture to the full page or browser tab.

## Links & Consequences
- Upstream: the video-learner workflow and timestamped bookmark foundation in `shipglows_data/product/ext/product.md`; competitor hypothesis in `shipglows_data/business/project-competitors-and-inspirations.md`.
- Downstream: YouTube player control, classic content bundle, localized UI, packaged extension and test suite. No app, backend, auth, account, bookmark schema or export consumer changes.
- Product decision state: hypothesis. A screenshot may help retain visual learning context; customer demand or learning improvement is not established.
- Freshness checked 2026-09-23 against [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads), [Chrome permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [MDN drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage), and [MDN anchor download](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/download). `chrome.downloads` requires the `downloads` permission and carries a “Manage your downloads” warning; this contract avoids it pending proof that the user-activated Blob-download path works.

## Documentation Coherence
- If implemented, update `ext/AGENT.md`, `shipglows_data/product/ext/product.md`, `shipglows_data/technical/architecture.md`, `shipglows_data/technical/code-docs-map.md` only if its route changes, and the competitor matrix's delivery status. Keep marketing and public claims unchanged unless separately approved and proven.
- During spec/readiness, no tracker, product contract or public copy is changed. The implementation must reconcile against the in-progress extension-app-parity spec before touching shared files.

## Edge Cases
- ZOMBIES: zero video or zero intrinsic dimensions; loading/current-data boundary; ad playback; tainted canvas; non-finite or extremely large timestamp; video ID/page mismatch; malformed title is irrelevant to filename; repeated activation; media replacement during encoding; rapid YouTube SPA navigation; fullscreen player; blocked download; object URL cleanup after completion/failure; object URL must not be revoked before Chrome consumes the Blob.
- No auth, tenant, server or cross-user state exists in this local-only flow.

## Implementation Tasks
1. After dependencies clear, inspect the current content-script and bug-fix diff; add an isolated capture helper and focused tests for frame validation, PNG output, filename, cancellation and cleanup. Preserve all concurrent edits. User story: exact frame and safe local output. Validate with the new focused tests; no network or new permissions.
2. Add one capture button alongside the existing bookmark control, localized FR/EN with accessible semantics, tied to the existing YouTube player lifecycle. Validate one control after initialization, reinitialization, fullscreen and SPA navigation; preserve all playback/bookmark invariants.
3. Wire only through the existing classic `content.js` bundle and verify no manifest permission/host change. Run Doppler-wrapped typecheck, focused lint and packaged build; verify the generated manifest resources.
4. Run isolated packaged Chromium scenarios and one public YouTube capture; inspect the actual PNG and browser download state. If the no-new-permission path fails, stop and return for a permission decision rather than widening the manifest.
5. Update only mapped product/technical docs and the competitor delivery row after proof; retain all unrelated local work and report browser/network limits.

## Acceptance Criteria
- A user click on a ready, non-ad YouTube watch video yields exactly one PNG of the currently displayed decoded frame with validated video ID/time in its filename.
- The button works by mouse and keyboard, has FR/EN accessible naming and feedback, remains unique after player/SPA reinitialization, and behaves in fullscreen.
- Missing, stale, cross-origin/tainted, unready or rejected output never yields a blank PNG or success claim; the UI offers a retry after recovery.
- Playback state and all existing bookmark/storage records are byte-equivalent before and after capture.
- No new permissions, hosts, network traffic, storage record, dependencies or backend/app side effects are introduced.
- Packaged fixture and live public-YouTube proof pass, existing YouTube-control regressions pass, and downloaded files open as valid PNGs. If live proof is unreachable or the no-permission download route is not reliable, record `partial` and do not claim the feature delivered.
- ZOMBIES: zero, one and changing media; malformed inputs; full-screen/player boundary; repeated activation; interleaved navigation and completion; fail-safe canvas/download errors; single actor/user gesture. Auth and multi-tenant cases are not applicable.

## Test Strategy
Write helper tests first; run focused source tests, then the Doppler-wrapped type/lint/package sequence, then packaged isolated-browser tests, and finally public YouTube. Never substitute fixture rendering for YouTube's real media decode/CORS behavior. Keep file inspection and network/runtime evidence separate. Do not add tests for future clipboard, persistence or synchronization work.

## Risks
- YouTube's media may taint the canvas or expose no decoded frame in some playback modes; fail safely and do not claim universal success.
- Browser rules may reject a download initiated from a content script without the `downloads` API. That API requires a manifest permission with a user warning; permission choice stays operator-owned if the no-permission path fails.
- YouTube changes player DOM and SPA behavior. Use the repository's current player-reference/reinitialization conventions and test replacements.
- Repeated large captures can use memory; one user click per capture, immediate Blob URL cleanup and no retained image store bound this increment.
- The active extension parity spec explicitly keeps YouTube content-script behavior unchanged during its migration. Editing it early would violate a validated contract.

## OWASP Security Gate
Top 10:2025 considered A01 (Chrome host/user gesture boundary; no new API privilege), A02 (no permissions/hosts changed), A05 (validate identifier/time and never insert page data as HTML or use it as an arbitrary path), A08 (current packaged extension build provenance), A09 (no frame/URL/title/content in logs), A10 (canvas/download/SPA failure and Blob cleanup). Other categories are not implicated by local user-triggered capture. No network endpoint, identity, tenant or server authorization is involved; ASVS v5.0.0 is not applicable to this standalone browser action. Proof: hostile metadata, rejected sender/API-free design, canvas/download errors and package inspection. Residual risk: browser download acceptance and real YouTube pixel access require runtime proof; owner is the implementation integrator after sequencing is resolved.

## Execution Notes
First read `ext/AGENT.md`, `shipglows_data/product/ext/product.md`, `shipglows/technical/architecture.md`, `ext/public/manifest.json`, `ext/src/content/content.ts`, the current `ext/contentscript.js` diff and `BUG-2026-09-18-003.md`. Implement in the classic YouTube bundle, keep data in memory, and make no app/backend changes. Use only isolated packaged Chromium and a public non-private YouTube video. Build/run commands must use Doppler. Stop if active parity/bug work still owns the same files, if a new permission is needed, or if browser pixel/download behavior fails.

## Open Questions
No product question blocks this proposed capture-only slice. Ordering is blocked by the active extension-app-parity and YouTube-controls work. Image-to-note association, clipboard copy and any permission expansion remain separate future decisions.

## Skill Run History
| Date UTC | Skill | Model | Action | Result | Next step |
| --- | --- | --- | --- | --- | --- |
| 2026-09-23 | 100-sg-spec | GPT-6 | Drafted a YouTube frame-capture contract from the competitor review and current extension/product evidence. | Draft; implementation authorization not requested or inferred. | Verify readiness against active extension work. |
| 2026-09-23 | 101-sg-ready | GPT-6 | Checked product fit, scope, permission boundary, failure behavior, proof and current spec/bug conflicts. | Not ready: active parity contract prohibits changing `contentscript.js`, and BUG-2026-09-18-003 still owns overlapping YouTube controls. Metadata and structural checks pass; no feature code or runtime proof exists. | After those owners release the file/surface, revalidate sequencing and readiness before implementation. |

## Current Chantier Flow
- 100-sg-spec: draft complete; scope is capture and local PNG download only.
- 101-sg-ready: not ready; the extension-app-parity behavior freeze and overlapping YouTube-controls repair block implementation.
- 102-sg-start: not started; requires parity/bug sequencing and a fresh readiness verdict.
- 103-sg-verify: not run; no feature code exists.
- 104-sg-end: not run.
- 005-sg-ship: not run.
