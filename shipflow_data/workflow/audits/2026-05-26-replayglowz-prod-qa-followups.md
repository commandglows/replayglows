---
artifact: qa_audit
metadata_schema_version: "1.0"
artifact_version: "0.1.0"
project: "replayglowz"
created: "2026-05-26"
updated: "2026-05-27"
status: "draft"
source_skill: "sf-verify"
scope: "prod-youtube-p3-url-import-qa-followups"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "replayglowz_app"
  - "replayglowz_backend"
  - "Flutter Web"
  - "Convex"
  - "YouTube Data API"
depends_on:
  - "shipflow_data/workflow/specs/replayglowz-youtube-channel-onboarding-playlist-url-import.md"
  - "shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-3.md"
supersedes: []
evidence:
  - "Production browser QA on https://app.replayglowz.com with the test account on 2026-05-26."
  - "Playlist URL import of PL5xqnrd8FwHaxdtMQugvbXOzbX9QGW4iI succeeded and displayed one video."
  - "Screenshots stored under test-evidence/BUG-2026-05-26-*."
next_step: "/sf-verify replayglowz-youtube-parity-stabilization-qa-closure"
---

# ReplayGlowz Prod QA Followups - 2026-05-26

## Scope Covered

This QA pass covers the three recently implemented YouTube parity specs:

- `replayglowz-youtube-core-parity-priority-2.md`: channel automation/subscriptions, transcript provider management, transcript jobs/versions, notes export/share/copy, P2 onboarding.
- `replayglowz-youtube-core-parity-priority-3.md`: UX settings, dismissible hints, persisted view preferences, scroll restoration, player focus/shortcuts, i18n.
- `replayglowz-youtube-channel-onboarding-playlist-url-import.md`: YouTube channel onboarding and playlist URL import.

Production target:

- App: `https://app.replayglowz.com`
- Build commit observed: `f61779674cd68a4bbbbc2aac4ba563083e78b14b`
- Latest production smoke commit observed after fixes: `39c6062b2af42830211d3e4c9d8ea18a729dfa3d`
- Latest production smoke deployment observed on 2026-05-27: `dpl_8SWzTGdT61HbmqfePKkNANJrY2Yr`
- Test account class: ReplayGlowz account authenticated with YouTube connected, no YouTube subscriptions, imported playlist `Fun`.

## Spec QA Matrix

| Spec | Area | Prod status | Notes | Evidence |
|------|------|-------------|-------|----------|
| URL import | Valid mobile playlist URL import | pass | `PL5xqnrd8FwHaxdtMQugvbXOzbX9QGW4iI` imported and displayed one video in feed. | `test-evidence/BUG-2026-05-26-003/quota-9-before.png` |
| URL import | Imported playlist preserved in Playlists | pass | Playlist `Fun`, `1 video`, updated May 26, 2026. | `test-evidence/replayglowz-prod-three-spec-qa/playlists-imported-state.png` |
| URL import | Imported video visible in Cards/List/Notes views | pass | Cards, List and Notes tab all show the imported video. | QA screenshots in `/tmp/replayglowz-browser-check/qa-0*.png` |
| URL import | Duplicate import | not run | Avoided extra YouTube calls after happy path. Needs explicit retest. | none |
| URL import | Video URL with `list=` | not run | Parser was unit-tested earlier, but prod UI path not manually retested. | none |
| URL import | Watch Later/private/invalid URL errors | not run | Needs controlled test URLs and no-cache-mutation verification. | none |
| URL import | Automatic sync preserves imported URL playlists | partial | Playlist stayed visible during navigation; not proven after a deliberate automatic sync with empty `mine=true`. | `test-evidence/replayglowz-prod-three-spec-qa/playlists-imported-state.png` |
| P2 | YouTube connected state in Preferences | pass | Preferences shows connected state and reconnect/sync/disconnect controls. | `test-evidence/replayglowz-prod-three-spec-qa/preferences-transcript-settings.png` |
| P2 | No subscriptions empty state | pass | Preferences shows "No YouTube subscriptions found" and explains this is normal for a new account. | `test-evidence/replayglowz-prod-three-spec-qa/preferences-provider-channel-empty.png` |
| P2 | Transcript provider catalog | pass-visible | Provider list renders: YouTube captions available, other providers unavailable in environment. | `test-evidence/replayglowz-prod-three-spec-qa/preferences-provider-channel-empty.png` |
| P2 | Transcript provider details/secrets/test | not run | Did not open each provider detail or add/delete/test secrets. | none |
| P2 | Transcript generation/job/version selection | not run | Player render was tested, but generation was not triggered. | none |
| P2 | Notes export/share/copy | not run | Test account has no notes; export/share actions still need a note fixture. | none |
| P2 | Channel link/sync selected channel | not run | Test account has no subscriptions, so linking/syncing a subscribed channel cannot be tested on this account. | none |
| P3 | Feed Cards/List/Notes views | pass | All three render imported video. | `/tmp/replayglowz-browser-check/qa-01-videos-cards.png`, `/tmp/replayglowz-browser-check/qa-02-videos-list.png`, `/tmp/replayglowz-browser-check/qa-04-videos-notes-tab.png` |
| P3 | View preference persistence | pass-basic | List tab remained selected after reload. | `/tmp/replayglowz-browser-check/qa-03-videos-list-after-reload.png` |
| P3 | Notes empty state | pass | Notes page shows helpful empty state and search. | `test-evidence/replayglowz-prod-three-spec-qa/notes-empty-state.png` |
| P3 | Player and YouTube embed | pass | Imported video opens in Now Playing with YouTube embed. | `/tmp/replayglowz-browser-check/qa-08-play-screen.png` |
| P3 | Keyboard shortcuts helper | pass | Shortcut dialog opens from hint button and top keyboard icon. | `test-evidence/replayglowz-prod-three-spec-qa/player-shortcuts-dialog.png` |
| P3 | Hint dismissal persistence | not run | Hints were observed, but close/reload persistence was not tested. | none |
| P3 | Focus/study panel behavior | partial | Player UI and shortcuts render; panel toggles/focus persistence not fully verified. | `/tmp/replayglowz-browser-check/qa4-08-player-panels.png` |
| P3 | Route/deep-link persistence | pass | Production smoke on 2026-05-27 verified signed-out redirect to `/sign-in?tf_redirect=/playlists` and authenticated direct `/preferences`, `/playlists`, `/notes`, and `/videos` route retention/rendering when browser locale was explicit. | `bugs/BUG-2026-05-26-001.md` |
| P3 | Playlists low-friction add UI | fix-implemented-pending-prod-retest | Local fix keeps `+` low-opacity and clickable on short/non-scrollable pages while preserving scroll-reveal behavior on scrollable pages. Production browser retest and create modal open/cancel proof still pending. | `bugs/BUG-2026-05-26-002.md` |
| Quota | Cache-first navigation | pass-smoke-pending-metrics | Production smoke on 2026-05-27 kept visible quota at `13 / 1000` across Preferences, Playlists, Notes, and Videos without sync/import/refresh. Convex log/metrics binding remains pending. | `bugs/BUG-2026-05-26-003.md` |

## Confirmed Working

- Authenticated prod session works with Clerk email verification.
- Convex auth reaches ready state for the test account.
- Playlist URL import works for `PL5xqnrd8FwHaxdtMQugvbXOzbX9QGW4iI`.
- Imported playlist `Fun` appears in Playlists with `1 video`.
- Imported video appears in Videos Cards, List, and Notes tab views.
- Video detail/player opens and the YouTube embed renders.
- Keyboard shortcuts help opens from the player hint card and top keyboard icon.
- Notes page empty state renders cleanly.
- Preferences page is reachable from the gear icon and shows authenticated diagnostics.

## Defects To Fix

| ID | Severity | Status | Finding | Evidence |
|----|----------|--------|---------|----------|
| BUG-2026-05-26-001 | medium | fixed-prod-verify | Direct protected routes and signed-out redirect passed production smoke. | `bugs/BUG-2026-05-26-001.md` |
| BUG-2026-05-26-002 | medium | fix-implemented-pending-prod-retest | Local fix makes the `+` reachable on short/non-scrollable Playlists pages; production retest is pending after deployment. | `bugs/BUG-2026-05-26-002.md` |
| BUG-2026-05-26-003 | medium | mitigated-partial-prod-verify | Hidden quota spend path identified in code (`fetchYoutubeSubscriptions` on passive Preferences load), moved behind explicit refresh, and smoke-tested visually with stable quota. Metrics-bound proof remains pending. | `bugs/BUG-2026-05-26-003.md` |

## Remaining Test Queue

Priority order for the next QA/fix pass:

1. Run preview/prod browser retest for protected deep links (`/preferences`, `/playlists`, `/notes`, `/playlists/create`) plus reload and sign-in redirect.
2. Retest quota before/after navigation without pressing refresh, then with explicit "Refresh subscriptions" action, and capture Convex metrics in the same window.
3. Test URL import edge cases: duplicate import, video URL with `list=`, invalid URL, private/inaccessible playlist, Watch Later/special playlist.
4. Test P2 transcript provider details: expand every provider, verify unavailable reasons, add/delete/test secrets only with a safe dummy or dedicated provider key.
5. Create one test note on the imported video, then test notes list, export/copy/share, and plan-limit messaging.
6. Test transcript generation and version selection with a video that has YouTube captions first, then with unavailable providers.
7. Test hint dismissal persistence: close each hint, reload, confirm it stays hidden, then use Preferences reset.
8. Test player focus/study toggles and keyboard shortcuts while typing in a note input.
9. Run mobile viewport smoke for Videos, Playlists, Notes, Preferences, Player, shortcuts dialog, and create playlist.

## Not Fully Tested Yet

- User-created playlist edit popup and save/cancel flow. I avoided creating production data beyond the already-approved playlist import.
- Playlist detail route for the imported playlist. My first coordinate click opened the video player, not a playlist detail page.
- Mobile viewport behavior for the new onboarding, shortcuts, and create playlist surfaces.
- Transcript provider configuration/generation and notes export/share. The test account has no notes/transcripts configured yet.
- Dismissal persistence for each hint after clicking close, then reload.
- Invalid playlist URL, private playlist, Watch Later, duplicate import, and very large playlist edge cases.

## QA Evidence Pointers

- `test-evidence/BUG-2026-05-26-001/direct-preferences-shows-videos.png`
- `test-evidence/BUG-2026-05-26-001/direct-playlists-shows-videos.png`
- `test-evidence/BUG-2026-05-26-002/playlists-nav-onboarding-plus.png`
- `test-evidence/BUG-2026-05-26-002/plus-opens-create-playlist.png`
- `test-evidence/BUG-2026-05-26-003/quota-9-before.png`
- `test-evidence/BUG-2026-05-26-003/quota-10-after-navigation.png`
