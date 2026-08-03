## 2026-06-10 - ReplayGlowz Feed View Mode Scroll Sync Retest

- Scope: BUG-2026-06-01-004 / Feed cards-list-notes scroll synchronization
- Environment: production build `ef45c77`
- Tester: user
- Source: sf-test
- Status: fail
- Confidence: high
- Result summary: Horizontal swiping between Feed view modes still rebounds the feed to the first video, breaking cross-mode position synchronization.
- Bug pointer: BUG-2026-06-01-004 -> shipglows_data/workflow/shipglows_data/workflow/bugs/app/BUG-2026-06-01-004.md
- Evidence pointer: operator diagnostics supplied in chat; private identifiers and keys were not stored.
- Deploy note: Vercel production is now READY for `735135631e0c3ea10381a0bc26fb180d4551b377`; `https://app.replayglowz.com` returns HTTP 200 and serves Flutter boot files modified after the reported `ef45c77` build.
- Follow-up: hard reload or restart app, confirm diagnostics show `735135631e0c3ea10381a0bc26fb180d4551b377`, then /sf-test --prod --retest BUG-2026-06-01-004

## 2026-06-10 - ReplayGlowz Feed Subscription Channel Picker

- Scope: BUG-2026-06-10-001 / Convex entitlement guard production smoke
- Environment: production
- Tester: user
- Source: sf-test
- Status: fail
- Confidence: medium
- Result summary: In the Feed source picker, clicking one channel under `Channels from my subscriptions` selects every channel; deselecting one deselects every channel, so a single subscription channel cannot be selected.
- Bug pointer: BUG-2026-06-10-001 -> shipglows_data/workflow/bugs/app/BUG-2026-06-10-001.md
- Evidence pointer: operator report in chat; no private evidence stored.
- Follow-up: /sf-fix BUG-2026-06-10-001

## 2026-05-27 - ReplayGlowz Authenticated Playlists FAB Retest

- Scope: BUG-2026-05-26-002 / replayglowz-youtube-parity-stabilization-qa-closure
- Environment: production
- Tester: Codex authenticated persistent Playwright profile
- Source: sf-auth-debug
- Status: pass
- Confidence: high
- Result summary: Authenticated production retest confirmed the short imported-playlist page shows the low-opacity `+`; clicking it opens the in-place `New Playlist` modal. The modal was canceled and no playlist was created.
- Bug pointer: BUG-2026-05-26-002 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-002.md
- Evidence pointer: ephemeral screenshots reviewed then deleted for redaction; session retained in `/tmp/replayglowz-playwright-profile` and `/tmp/replayglowz-auth-state.json`.
- Checks: Browser proof on deployed commit `78b888a`.
- Follow-up: Continue remaining P2/P3/import QA matrix.

## 2026-05-27 - ReplayGlowz Playlists Short-Page FAB Fix

- Scope: BUG-2026-05-26-002 / replayglowz-youtube-parity-stabilization-qa-closure
- Environment: local implementation
- Tester: Codex + subagent Linnaeus
- Source: sf-build
- Status: fix-implemented-pending-prod-retest
- Confidence: medium
- Result summary: Updated Playlists so the `+` create affordance remains low-opacity and clickable on short/non-scrollable pages, while scrollable pages still hide it at top rest and reveal it on scroll.
- Bug pointer: BUG-2026-05-26-002 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-002.md
- Evidence pointer: app/lib/screens/playlists/playlists_screen.dart
- Checks: `(cd app && flutter analyze)` pass.
- Follow-up: Ship/deploy, then browser retest the short imported-playlist page and create modal open/cancel flow.

## 2026-05-27 - ReplayGlowz YouTube Stabilization Verify Rerun

- Scope: replayglowz-youtube-parity-stabilization-qa-closure
- Environment: production
- Tester: Codex browser automation
- Source: sf-verify
- Status: fail-partial
- Confidence: medium
- Result summary: Auth route smoke passed and visible quota stayed `13 / 1000`, but Playlists `+` is unreachable on the short imported-playlist page because there is no scrollable content to trigger the scroll-revealed affordance. Full closure is not verified.
- Bug pointer: BUG-2026-05-26-002 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-002.md
- Evidence pointer: shipglows_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md
- Checks: ShipGlows metadata lint passed for `AGENT.md shipglows_data` and `bugs`; production HTTP 200 for `/playlists`.
- Follow-up: Fix `+` discoverability on non-scrollable Playlists pages, then rerun targeted `/sf-verify`.

## 2026-05-26 - ReplayGlowz YouTube Stabilization Prod Verify

- Scope: replayglowz-youtube-parity-stabilization-qa-closure
- Environment: production
- Tester: Codex browser automation
- Source: sf-prod/sf-verify
- Status: partial
- Confidence: medium
- Result summary: Production deployment `39c6062` is live on `https://app.replayglowz.com`; direct Preferences, Playlists, Notes and Videos smoke passed; Playlists imported-state hint and hidden top-rest `+` passed; visible quota stayed `13 / 1000` across passive navigation. Full closure is still blocked by remaining P2/P3/import matrix items and metrics-bound quota proof.
- Bug pointer: BUG-2026-05-26-001 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-001.md; BUG-2026-05-26-002 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-002.md; BUG-2026-05-26-003 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-003.md
- Evidence pointer: shipglows_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md
- Checks: `(cd app && flutter analyze)` pass; `/home/claude/shipglows/tools/shipglows_metadata_lint.py AGENT.md shipglows_data` pass before ship; production HTTP 200 for `/` and `/playlists`.
- Follow-up: Continue remaining P2/P3/import QA matrix before `/sf-end`.

## 2026-05-26 - ReplayGlowz Prod YouTube Import And P3 QA

- Scope: prod-youtube-import-p3-qa
- Environment: prod
- Tester: Codex browser automation
- Source: sf-test
- Status: fail
- Confidence: medium
- Result summary: Playlist URL import works and core video/player surfaces render, but QA found route/deep-link, playlist UX, and possible quota-spend followups.
- Bug pointer: BUG-2026-05-26-001 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-001.md; BUG-2026-05-26-002 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-002.md; BUG-2026-05-26-003 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-003.md
- Evidence pointer: shipglows_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md
- Follow-up: /sf-fix ReplayGlowz prod QA followups

## 2026-05-26 - ReplayGlowz Three-Spec Prod QA Matrix

- Scope: P2, P3, playlist URL import specs
- Environment: prod
- Tester: Codex browser automation
- Source: sf-test
- Status: fail
- Confidence: medium
- Result summary: Broader matrix added across the three implemented specs; core import/feed/player/provider visibility passes, but routing, playlist UX, and quota followups remain.
- Bug pointer: BUG-2026-05-26-001 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-001.md; BUG-2026-05-26-002 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-002.md; BUG-2026-05-26-003 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-003.md
- Evidence pointer: shipglows_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md
- Follow-up: /sf-fix ReplayGlowz prod QA followups

## 2026-05-26 - ReplayGlowz YouTube Parity Stabilization Implementation

- Scope: replayglowz-youtube-parity-stabilization-qa-closure
- Environment: local (implementation + static checks)
- Tester: Codex implementation agent
- Source: sf-start
- Status: partial
- Confidence: medium
- Result summary: Implemented local fixes for routing/auth deep-link stability, Playlists low-friction UX (`+` modal-first + contextual onboarding), and quota mitigation (subscriptions refresh moved from passive load to explicit action). Hosted browser proof is still pending per `vercel-preview-push` mode.
- Bug pointer: BUG-2026-05-26-001 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-001.md; BUG-2026-05-26-002 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-002.md; BUG-2026-05-26-003 -> shipglows_data/workflow/bugs/app/BUG-2026-05-26-003.md
- Evidence pointer: app/lib/app/router.dart; app/lib/widgets/app_shell.dart; app/lib/screens/playlists/playlists_screen.dart; app/lib/providers/providers.dart; app/lib/screens/preferences/preferences_screen.dart
- Checks: `(cd app && flutter analyze)` pass; `/home/claude/shipglows/tools/shipglows_metadata_lint.py AGENT.md shipglows_data` pass
- Follow-up: /sf-ship replayglowz-youtube-parity-stabilization-qa-closure then /sf-prod and /sf-verify
