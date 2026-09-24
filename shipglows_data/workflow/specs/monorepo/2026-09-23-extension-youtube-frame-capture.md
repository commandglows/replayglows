---
artifact: implementation_spec
metadata_schema_version: "1.0"
artifact_version: "1.1.1"
project: replayglows
created: "2026-09-23"
updated: "2026-09-24"
created_at: "2026-09-23T00:23:15Z"
updated_at: "2026-09-24T16:17:14Z"
source_model: GPT-6
status: active
chantier_status: in_progress
source_skill: sg-development
scope: extension-youtube-frame-capture
owner: Diane
confidence: medium
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: [ext, app, backend]
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
next_step: "Run isolated extension/app/backend integration proof and live authenticated YouTube capture; do not mark shipped until owner-only image retrieval is verified."
---

# Title
Capture a YouTube video frame from the ReplayGlows extension

## Status
Concept drafted on 2026-09-23. On 2026-09-24 the operator explicitly authorized a checkpoint commit of existing work followed by this bounded feature. The parity contract now records that narrow exception. BUG-2026-09-18-003 remains independently open for its required visual acceptance; this spec does not close it.

## User Story
As a video learner watching a YouTube lesson, I capture a frame once and ReplayGlows saves it to my connected account or to an organized local archive.

## Minimal Behavior Contract
On a supported YouTube watch page, one click on the ReplayGlows capture control automatically saves a frame to ReplayGlows cloud when the cached ReplayGlows sign-in state is authenticated; otherwise it saves locally. The app publishes sign-in changes to the extension, which persists only the boolean state and update time; capture reads this state without reopening or rechecking the app. If cloud handoff/upload fails, save the same captured frame locally and explain that cloud saving failed. The first local capture explains the download location and offers sign-in. A shared icon dropdown retains explicit copy and local-download actions. A cloud capture creates a timestamped YouTube note with the JPEG attached in Convex. Capture never changes playback state.

Local saves use Chrome's Downloads API to create `Téléchargements/ReplayGlows/<channel>/<video title [video ID]>/`. Each PNG filename contains the local capture date/time (`YYMMDD_HHmmss`) and playback position (`HH-MM-SS`). The same video folder has one generated `Notes.md` combining timestamped extension bookmark notes and dated capture entries with relative image links, sorted by playback position. ReplayGlows retains capture metadata in extension-local storage and regenerates the Markdown file after a capture or bookmark add/edit/delete/import. The Markdown is a generated index, not an editable source file. Capture names include the local date/time and video position; Chrome uniquifies collisions with existing files.

## Success Behavior
Copy action places the valid PNG on the clipboard. Local save creates a PNG and refreshes that video's generated Markdown index in the ReplayGlows download tree. Automatic cloud save uploads a JPEG (maximum 10 MB), creates a new note at the captured timestamp, and serves its image through an authenticated owner-checked Convex HTTP action. Completion is announced only after the selected destination succeeds. Playback state and existing notes/bookmarks remain unchanged.

## Error Behavior
The control reports a localized, recoverable error if the video/frame is unavailable, clipboard permission or write fails, Chrome download permission is refused, either local file download fails, cached cloud auth has expired, or upload/note creation fails. Cloud failure falls back to local save of the same frame. No blank image, empty note or false success message is emitted; no full-tab screenshot fallback is allowed.

## Problem
ReplayGlows retains timestamped text bookmarks and notes but has no way to keep a useful diagram, slide or code example from the current video frame. The supplied competitor demonstrates demand as a product hypothesis, not verified ReplayGlows customer demand.

## Solution
Add one localized, keyboard-accessible capture control beside the existing ReplayGlows bookmark control in the YouTube player. Reuse one dropdown shell for both ReplayGlows control menus. The main action routes automatically from cached sign-in state; the menu offers explicit clipboard copy and local PNG download.

## Scope In
- YouTube watch pages matched by the existing content script; the main active video only.
- One capture per explicit button activation; the video may be playing or paused.
- Clipboard/download use PNG; cloud uses JPEG quality 0.88 at the decoded video dimensions, without browser chrome, YouTube controls, DOM overlays or external captions.
- Download folder grouped by sanitized channel name then sanitized video title plus validated YouTube video ID. PNGs use capture date/time and playback position; `Notes.md` combines the video's extension bookmark notes and capture links in playback-position order and is regenerated after either changes.
- French and English accessible button name, focus state and success/error feedback, using the existing YouTube control styles and localization conventions.
- Add Chrome `downloads` permission for deterministic subfolder paths and Markdown replacement, alongside the already approved `clipboardWrite` permission. Chrome displays its permission warning on install/update; first local-save guidance explains the destination and sign-in option.
- Cloud target is a new timestamped YouTube note, selected automatically when the cached signed-in state is active. Use the existing app's Clerk/Convex session; fail closed if authentication/product access is missing. Store images in Convex and serve them only after owner authorization; do not expose permanent bearer URLs. The extension-to-app transfer uses a nonce-bearing `window.opener` message between the YouTube page and its ReplayGlows capture tab; image bytes never enter the URL.

## Scope Out
- Keyboard shortcuts, burst capture, editing/cropping, watermarks or capture without an explicit button activation.
- Saving the image in bookmark storage, attaching it to an existing note, changing JSON/Markdown import/export or creating a local gallery.
- Generic image library, sharing, telemetry or public claims.
- Shorts, embedded YouTube players outside a watch page, other sites, audio, browser UI and full-tab capture.
- Changes to the active extension-app-parity behavior outside the authorized frame-capture exception, or closure of the YouTube-controls repair.

## Constraints
- Preserve the current bookmark/time schema and serialized worker ownership; capture must not create or update a bookmark as a side effect.
- Integrate with `ext/contentscript.js` through the existing `ext/src/content/content.ts` classic-script bundle and `ext/public/manifest.json` entry. The operator authorized this exception after checkpoint commit; preserve unrelated YouTube controls and keep BUG-2026-09-18-003 open pending separate visual acceptance.
- Treat video metadata and page state as untrusted. Use DOM text APIs, never interpolated `innerHTML`; validate the video ID, timestamp, MIME type, dimensions and filename.
- Use the existing localized controls' semantics. Visual tokens for the extension live in `ext/src/styles/styles.css`; YouTube injected-control styling follows `ext/src/styles/styles-youtube.css` and the design authority's documented legacy boundary.
- No telemetry, remote code or new host permission. The app auth relay stores only a boolean and update time in extension storage, never a cookie or token. Cloud action sends one user-triggered frame to ReplayGlows and stores only an owner-authorized note attachment.

## Test Contract
- Surface: packaged MV3 extension, ReplayGlows web app and backend in an isolated Chromium profile; authenticated cloud proof needs an authorized test account.
- Focused proof: frame readiness/zero dimensions, metadata/path sanitization, PNG Blob and data URL validity, Markdown escaping/relative links, download completion and overwrite behavior, auth-state relay origin validation, stale-session fallback, concurrent capture serialization, active-ad/no-player states and single-click behavior.
- Local checks completed: extension type-check/package (seven manifest resources), Convex typecheck, Flutter analyze and Flutter Web compilation through Doppler.
- Packaged browser proof still required: shared menu, keyboard activation, clipboard bytes, folder creation, dated PNG names, regenerated per-video Markdown, same-second and repeated-day captures, first-use sign-in guidance, cached auth updates, cloud note/attachment creation and private image rendering; fullscreen, SPA navigation, fallback and unchanged playback/bookmarks.
- Live-site proof: one public YouTube capture through the authenticated app confirms note creation and private attachment rendering. Never include frame bytes or URLs in diagnostics. Network/auth unavailability is a proof limit, not a pass.
- Regression: existing bookmark add/edit/delete, shortcut behavior, overflow menu, speed controls and fullscreen lifecycle continue to work.
- Checks: extension type-check/package, backend typecheck, Flutter analyze and Flutter Web build use Doppler. Run isolated browser and authenticated live scenarios before delivery; local compile success does not prove the cross-app handshake.
- Manual checklist: no dedicated checklist file required; the scenarios above are bounded and observable. Authenticated/browser-account proof remains required for delivery.

## Dependencies
- Chrome MV3 content scripts, canvas `drawImage`/Blob encoding and browser download behavior.
- Existing `www.youtube.com` content-script match, player discovery and SPA lifecycle.
- Current localized YouTube control copy/styles.
- Existing auth and product-access contract, Convex File Storage, the app's note model and authenticated image-serving route.

## Invariants
- A click captures the active frame once; stale media references after SPA navigation cannot produce a success result for a different video.
- `currentTime`, paused/playing, mute, volume, playback rate, bookmark data and storage are unchanged.
- Frame pixels stay in memory until the chosen action completes. The cloud action sends a JPEG and video/timestamp metadata to the authenticated ReplayGlows app; no other page, worker log or third party receives them. Convex storage IDs are never returned to the app client; image reads authenticate the current owner on every request.
- All folder/name components are sanitized page metadata; video IDs are validated and paths are rooted under the fixed `ReplayGlows/` directory. The generated `Notes.md` index is rebuilt from extension-local metadata, never read from or merged with arbitrary disk content.
- Failure is explicit and recoverable; no fallback expands capture to the full page or browser tab.

## Links & Consequences
- Upstream: the video-learner workflow and timestamped bookmark foundation in `shipglows_data/product/ext/product.md`; competitor hypothesis in `shipglows_data/business/project-competitors-and-inspirations.md`.
- Downstream: YouTube player control, classic content bundle, Flutter app, Convex notes/storage API, private image route, packaged extension and test suite. Existing note and bookmark behavior stays compatible.
- Product decision state: hypothesis. A screenshot may help retain visual learning context; customer demand or learning improvement is not established.
- Freshness checked 2026-09-23 against [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads), [Chrome permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [MDN drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage), and [MDN anchor download](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/download). `chrome.downloads` requires the `downloads` permission and carries a “Manage your downloads” warning; the operator approved deterministic subfolder downloads and the package now requests that permission.

## Documentation Coherence
- Update `shipglows_data/product/ext/product.md` and `shipglows_data/technical/architecture.md`; update the parity contract for the authorized exception. Update `ext/AGENT.md` and the competitor matrix's delivery status only after packaged/live proof. Keep marketing and public claims unchanged unless separately approved and proven.
- During spec/readiness, no tracker, product contract or public copy is changed. The implementation must reconcile against the in-progress extension-app-parity spec before touching shared files.

## Edge Cases
- ZOMBIES: zero video or zero intrinsic dimensions; loading/current-data boundary; ad playback; tainted canvas; non-finite timestamp; video ID/page mismatch; hostile or empty channel/title; repeated activation; same-second capture; media replacement during encoding; rapid YouTube SPA navigation; fullscreen player; missing download permission; either file download interrupted; stale/revoked auth; cloud failure and local fallback; data URL cleanup.
- Missing or revoked session/product access denies cloud upload and image retrieval; one user's note ID must never reveal another user's image.

## Implementation Tasks
1. Implemented the shared capture/bookmark menu, automatic cloud/local routing, and sign-in-state relay.
2. Implemented channel/video Downloads paths, dated PNG names, a generated per-video Markdown index, and the downloads permission.
3. Retained authenticated JPEG upload, timestamped cloud note creation, owner-checked image retrieval and Flutter note rendering.
4. Extension typecheck and package build pass through Doppler; `git diff --check` passes.
5. Still required: packaged Chrome download/permission proof and authenticated cloud/live YouTube proof; no deployment, push or delivery claim is made.

## Acceptance Criteria
- A click on a ready, non-ad YouTube watch video creates a cloud note when cached sign-in is active, or downloads a PNG and refreshes the video's single generated Markdown index when not connected.
- Adding, editing, deleting or importing a local extension bookmark note regenerates the same `Notes.md`; its note and capture entries are ordered by video position and image links stay relative to the video folder.
- The button works by mouse and keyboard, has FR/EN accessible naming and feedback, remains unique after player/SPA reinitialization, and behaves in fullscreen.
- Missing, stale, cross-origin/tainted, unready or rejected output never yields a blank PNG or success claim; the UI offers a retry after recovery.
- Playback state and all existing bookmark/storage records are byte-equivalent before and after capture.
- Clipboard and download permissions cover only their explicit capture actions; cloud sends only the selected image and validated video/timestamp to the authenticated ReplayGlows app and Convex. Auth relay accepts the exact app origin and stores no credential.
- Packaged fixture and live public-YouTube proof remain pending; downloaded files and owner-only image rendering must be checked before delivery.
- ZOMBIES: zero, one and changing media; malformed inputs; full-screen/player boundary; repeated activation; interleaved navigation and completion; fail-safe canvas/download/upload errors; signed-out/revoked access and cross-user image reads.

## Test Strategy
Run Doppler-wrapped typechecks/builds, then packaged isolated-browser scenarios, and finally public YouTube through an authenticated app account. Never substitute fixture rendering for YouTube's real media decode/CORS behavior. Keep compile success separate from network/runtime evidence.

## Risks
- YouTube's media may taint the canvas or expose no decoded frame in some playback modes; fail safely and do not claim universal success.
- The `downloads` permission adds Chrome's Manage your downloads warning on extension update/install. The first local-save message explains the destination; packaged install/update acceptance still needs proof.
- YouTube changes player DOM and SPA behavior. Use the repository's current player-reference/reinitialization conventions and test replacements.
- Large captures pass through the runtime message as a data URL; payloads are bounded, image bytes are not retained in extension storage, and downloads are serialized per worker lifetime.
- The active extension parity spec remains in progress; its explicit exception is limited to this feature, with BUG-2026-09-18-003 still open.

## OWASP Security Gate
Top 10:2025 considered A01 (Chrome user gesture and Convex owner authorization), A02 (`clipboardWrite` permission scope), A05 (validate identifiers, timestamp and MIME; never inject page data as HTML), A08 (packaged extension build), A09 (no frame bytes or auth tokens in logs), A10 (upload/download/SPA failure cleanup). App-to-extension messages check exact origin, source window and nonce. The image storage ID stays server-side; HTTP retrieval requires the owner's Clerk-backed Convex token and product access. Residual risk: packaged and live browser handshake, auth redirects, and YouTube canvas behavior still need runtime proof.

## Execution Notes
Read the extension, app and backend contracts before changing their scoped surfaces. Keep captured bytes out of URLs/logs, and preserve the owner-checked Convex image path. Use an isolated packaged Chromium profile and public YouTube video for runtime checks. Build/run commands must use Doppler. Separate build success from authenticated browser proof.

## Open Questions
The operator selected automatic cloud saving for cached signed-in sessions and a local PNG archive otherwise, with first-use sign-in guidance and local fallback on cloud failure. The archive is grouped by channel and video ID, with dated playback-position images and one generated `Notes.md` per video. On 2026-09-24 the operator confirmed that this Markdown combines image links and local extension bookmark notes in playback-position order; bookmark add/edit/delete/import also refresh it. Chrome `downloads` permission and packaged path/overwrite behavior require verification.

## Skill Run History
| Date UTC | Skill | Model | Action | Result | Next step |
| --- | --- | --- | --- | --- | --- |
| 2026-09-23 | 100-sg-spec | GPT-6 | Drafted a YouTube frame-capture contract from the competitor review and current extension/product evidence. | Draft; implementation authorization not requested or inferred. | Verify readiness against active extension work. |
| 2026-09-23 | 101-sg-ready | GPT-6 | Checked product fit, scope, permission boundary, failure behavior, proof and current spec/bug conflicts. | Not ready: active parity contract prohibits changing `contentscript.js`, and BUG-2026-09-18-003 still owns overlapping YouTube controls. Metadata and structural checks pass; no feature code or runtime proof exists. | After those owners release the file/surface, revalidate sequencing and readiness before implementation. |
| 2026-09-24 | Operator scope decision | Diane | Authorized checkpoint commit `c6fc159`, then implementation of this frame-capture slice. | Narrow exception recorded in the parity spec; BUG-2026-09-18-003 remains pending visual acceptance. | Implement isolated feature and retain packaged/live proof as open until available. |
| 2026-09-24 | 101-sg-ready | GPT-6 | Rechecked initial local capture contract after sequencing authorization. | Ready for local implementation at that time; this does not cover the later cloud attachment extension. | Revalidate cross-app cloud slice before completion. |
| 2026-09-24 | 102-sg-start | GPT-6 | Added localized capture control and in-memory PNG download in the existing classic YouTube content script. | Doppler type-check and packaged extension build pass; manifest verifier found all 7 resources. Packaged/live browser proof remains unverified. | Route browser behavior to verification; keep delivery status unverified until download/pixel proof. |
| 2026-09-24 | Operator scope decision | Diane | Requested a reusable dropdown for bookmark/capture controls with copy, download and cloud actions; the selected action becomes the one-click default with a visible outline. | Clipboard/download behavior is bounded; current extension/backend contain no active cloud auth or image-attachment API. Cloud destination awaits operator choice. | Implement the shared menu and local actions; keep cloud unavailable until its destination is approved. |
| 2026-09-24 | Operator scope decision | Diane | Selected a new timestamped YouTube note with the captured image attached in Convex as the cloud destination. | Destination decided. The image must use the existing authenticated app session and owner-checked retrieval. | Implement the cloud handoff, note attachment, private rendering and error recovery. |
| 2026-09-24 | 102-sg-start | GPT-6 | Refactored both controls onto a shared dropdown and added clipboard/download choices with a persisted default; added Chrome `clipboardWrite` permission. | Extension type-check/package pass; browser interaction proof remains open. | Integrate the approved cloud destination. |
| 2026-09-24 | 102-sg-start | GPT-6 | Implemented authenticated upload, timestamped YouTube note attachment, owner-checked image serving and Flutter rendering. | Backend typecheck, Flutter analyze/web build and extension package pass. Live browser/auth proof remains open. | Verify in isolated browser and authenticated YouTube session. |
| 2026-09-24 | Operator scope decision + 102-sg-start | Diane / GPT-6 | Selected automatic cloud save when signed in; otherwise archive by channel/video, with one generated `Notes.md` per video, first-use sign-in guidance and local fallback. Implemented auth-state caching/relay, deterministic capture names, serialized downloads and Markdown regeneration. | Doppler extension typecheck/package pass; live/download browser proof pending. | Verify packaged download permission, folder/file layout, auth-state changes, cloud save and fallback. |
| 2026-09-24 | Operator scope decision + 102-sg-start | Diane / GPT-6 | Confirmed that each video's `Notes.md` combines capture links and timestamped local extension notes, ordered by playback position, and refreshes after note mutations. | Extension bookmarks now regenerate the Markdown index; typecheck/package pass, browser download proof pending. | Verify note add/edit/delete ordering and capture links in packaged Chrome. |

## Current Chantier Flow
- 100-sg-spec: expanded to automatic authenticated cloud capture and channel/video local archive with one generated Markdown index per video.
- 101-sg-ready: initial slice was ready; operator-approved local archive/auth-routing expansion is being implemented under this same bounded feature. The YouTube-controls bug remains separately open.
- 102-sg-start: local archive and cached auth routing implementation in progress; previous cloud attachment plumbing is retained.
- 103-sg-verify: extension typecheck/package and diff hygiene pass; browser/live proof remains pending.
- 104-sg-end: not run.
- 005-sg-ship: not run.
