## 2026-05-26 - ReplayGlowz YouTube Stabilization Prod Verify

- Scope: replayglowz-youtube-parity-stabilization-qa-closure
- Environment: production
- Tester: Codex browser automation
- Source: sf-prod/sf-verify
- Status: partial
- Confidence: medium
- Result summary: Production deployment `39c6062` is live on `https://app.replayglowz.com`; direct Preferences, Playlists, Notes and Videos smoke passed; Playlists imported-state hint and hidden top-rest `+` passed; visible quota stayed `13 / 1000` across passive navigation. Full closure is still blocked by remaining P2/P3/import matrix items and metrics-bound quota proof.
- Bug pointer: BUG-2026-05-26-001 -> bugs/BUG-2026-05-26-001.md; BUG-2026-05-26-002 -> bugs/BUG-2026-05-26-002.md; BUG-2026-05-26-003 -> bugs/BUG-2026-05-26-003.md
- Evidence pointer: shipflow_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md
- Checks: `(cd replayglowz_app && flutter analyze)` pass; `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENT.md shipflow_data` pass before ship; production HTTP 200 for `/` and `/playlists`.
- Follow-up: Continue remaining P2/P3/import QA matrix before `/sf-end`.

## 2026-05-26 - ReplayGlowz Prod YouTube Import And P3 QA

- Scope: prod-youtube-import-p3-qa
- Environment: prod
- Tester: Codex browser automation
- Source: sf-test
- Status: fail
- Confidence: medium
- Result summary: Playlist URL import works and core video/player surfaces render, but QA found route/deep-link, playlist UX, and possible quota-spend followups.
- Bug pointer: BUG-2026-05-26-001 -> bugs/BUG-2026-05-26-001.md; BUG-2026-05-26-002 -> bugs/BUG-2026-05-26-002.md; BUG-2026-05-26-003 -> bugs/BUG-2026-05-26-003.md
- Evidence pointer: shipflow_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md
- Follow-up: /sf-fix ReplayGlowz prod QA followups

## 2026-05-26 - ReplayGlowz Three-Spec Prod QA Matrix

- Scope: P2, P3, playlist URL import specs
- Environment: prod
- Tester: Codex browser automation
- Source: sf-test
- Status: fail
- Confidence: medium
- Result summary: Broader matrix added across the three implemented specs; core import/feed/player/provider visibility passes, but routing, playlist UX, and quota followups remain.
- Bug pointer: BUG-2026-05-26-001 -> bugs/BUG-2026-05-26-001.md; BUG-2026-05-26-002 -> bugs/BUG-2026-05-26-002.md; BUG-2026-05-26-003 -> bugs/BUG-2026-05-26-003.md
- Evidence pointer: shipflow_data/workflow/audits/2026-05-26-replayglowz-prod-qa-followups.md
- Follow-up: /sf-fix ReplayGlowz prod QA followups

## 2026-05-26 - ReplayGlowz YouTube Parity Stabilization Implementation

- Scope: replayglowz-youtube-parity-stabilization-qa-closure
- Environment: local (implementation + static checks)
- Tester: Codex implementation agent
- Source: sf-start
- Status: partial
- Confidence: medium
- Result summary: Implemented local fixes for routing/auth deep-link stability, Playlists low-friction UX (`+` modal-first + contextual onboarding), and quota mitigation (subscriptions refresh moved from passive load to explicit action). Hosted browser proof is still pending per `vercel-preview-push` mode.
- Bug pointer: BUG-2026-05-26-001 -> bugs/BUG-2026-05-26-001.md; BUG-2026-05-26-002 -> bugs/BUG-2026-05-26-002.md; BUG-2026-05-26-003 -> bugs/BUG-2026-05-26-003.md
- Evidence pointer: replayglowz_app/lib/app/router.dart; replayglowz_app/lib/widgets/app_shell.dart; replayglowz_app/lib/screens/playlists/playlists_screen.dart; replayglowz_app/lib/providers/providers.dart; replayglowz_app/lib/screens/preferences/preferences_screen.dart
- Checks: `(cd replayglowz_app && flutter analyze)` pass; `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENT.md shipflow_data` pass
- Follow-up: /sf-ship replayglowz-youtube-parity-stabilization-qa-closure then /sf-prod and /sf-verify
