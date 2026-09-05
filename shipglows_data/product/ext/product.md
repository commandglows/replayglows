---
artifact: product_context
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
status: active
source_skill: sg-docs
scope: extension-product
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
target_user: "Video learners using browser media and YouTube timestamped notes."
user_problem: "Playback pace and passage review are disconnected from saved learning moments."
desired_outcomes: "Set one listening pace, isolate a tab and repeat a passage connected to existing bookmarks."
non_goals: "Cloud sync, saved segment records, advanced media effects or guaranteed compatibility with every player."
linked_systems: [ext]
depends_on:
  - "shipglows_data/technical/architecture.md"
supersedes: []
evidence:
  - "ext/src/playback/protocol.ts"
  - "ext/src/playback/background.ts"
  - "ext/src/playback/media.ts"
  - "ext/public/manifest.json"
  - "shipglows_data/workflow/specs/monorepo/2026-09-05-extension-universal-playback.md"
next_review: "2026-10-05"
next_step: "Review on playback, permissions, persistence or bookmark contract changes."
---

# Extension Product Contract

## Scope and Decisions

The standalone Chrome extension combines local YouTube bookmarks/notes with playback controls for accessible HTML5 video and audio on HTTP/HTTPS sites. On 2026-09-05 the operator approved multisite coverage and a compact card at the bottom of the popup. YouTube annotation remains site-specific; multisite playback does not imply multisite note capture or synchronization with the authenticated app.

One shared base speed is the default context for every supported unpinned tab. Pinning excludes a tab from that context and captures its effective speed; subsequent changes in that tab affect its own rate. Unpinning immediately rejoins the current shared speed. This is separate from Chrome's native tab pinning and from manual media selection.

## Delivered Behavior

| Capability | Current contract |
| --- | --- |
| Compact popup card | Bottom card with effective rate, Global/Pinned scope, slider, presets 0.5/1/1.5/2, favorite and secondary loop/suspension controls. |
| Speed | 0.25–4x; slider steps 0.05. Default base 1x, favorite 1.5x, configurable shortcut step initially 0.1. Actual media acceptance can differ and failures are surfaced. |
| Persistence | Base speed and settings persist locally. Tab pins survive navigation and worker restart within the session; tab closure removes them, browser/extension restart resets them. |
| Keyboard controls | Configurable speed, reset, favorite, seek, temporary boost, A/B marks, loop clear and suspension. Input fields are protected and bookmark shortcut collisions are rejected. |
| Temporary boost | Holding the shortcut accelerates; release or loss of focus restores the effective context rate. This does not add a separately configurable held slowdown. |
| A–B review | Temporary loop from current positions or two existing bookmarks on the current YouTube video. Navigation/media replacement, seeking outside the segment or explicit clearing ends the loop. No saved-segment schema is introduced. |
| Media discovery | Video/audio, dynamic elements, accessible embedded frames and open shadow roots. Commands choose a media target automatically; there is no manual target picker. |
| Existing learning records | YouTube bookmarks/notes and JSON/Markdown export plus validated JSON import retain their existing contract. Speed preferences and transient tab IDs are not portable note records. |

## Boundaries and Availability

HTTP/HTTPS host access enables the wider playback scope and changes the permission boundary. Browser-protected pages and file URLs are outside this scope. Closed shadow roots, inaccessible frames and players that enforce their own rate can limit behavior. Do not promise compatibility with every site, proprietary player or DRM service. Missing media and disconnected content scripts have explicit popup states.

Playback settings and session contexts are extension-local; this increment adds no remote service, telemetry or app/backend synchronization. Notes remain YouTube-specific. Reload the unpacked extension and refresh existing tabs to activate its new content bundle.

Implementation was delivered in commit `e9b4ad3813d697aa0f4e6c28dd22019581be8dec` on `main`. Verification on 2026-09-05 covered 22 automated tests, typecheck/lint/build, packaged Chromium fixtures, public YouTube/W3Schools playback and the real action-popup target. This is unpacked-extension proof, not Web Store publication or installation in the user's personal browser profile. Detailed evidence and limitations remain in the owning implementation spec.

## Research Candidates

Saved segments, note-specific review speeds, frame stepping, URL rules, manual media selection, pitch/volume processing and visual filters remain candidates. The current matrix is in `shipglows_data/business/project-competitors-and-inspirations.md`. They are not delivered features or an approved next development batch.

## Maintenance

Update this contract when user-visible playback, context lifetime, permissions, supported media or learning-record behavior changes. Route implementation through `shipglows_data/technical/code-docs-map.md`; reconcile public claims through `shipglows_data/editorial/claim-register.md`.
