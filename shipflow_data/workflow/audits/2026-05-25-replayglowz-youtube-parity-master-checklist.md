---
artifact: audit_report
metadata_schema_version: "1.0"
artifact_version: "0.1.0"
project: "replayglowz"
created: "2026-05-25"
updated: "2026-05-25"
status: "draft"
source_skill: "sf-start"
scope: "youtube-parity-master-checklist"
owner: "Diane"
confidence: "medium"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
domains:
  - "code"
  - "product"
  - "qa"
issue_counts:
  critical: 0
  high: 0
  medium: 0
  low: 0
linked_systems:
  - "replayglowz_app"
  - "replayglowz_backend"
  - "YouTube OAuth"
  - "Convex"
  - "Vercel"
depends_on:
  - "shipflow_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md"
  - "shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-1.md"
  - "shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-2.md"
  - "shipflow_data/workflow/specs/replayglowz-youtube-core-parity-priority-3.md"
supersedes: []
evidence:
  - "P1/P2/P3 implementation work completed locally before hosted verification."
next_step: "/sf-verify replayglowz-youtube-parity-master-checklist"
---

# ReplayGlowz YouTube Parity Master Checklist

## Purpose

Track the end-to-end parity checks still needed after P1, P2 and P3 implementation. This checklist is for verification and QA sequencing; it is not a new product scope.

## Pre-Ship Static Checks

- [ ] Flutter analyze passes.
- [ ] Targeted Flutter model/UI tests pass.
- [ ] Backend Convex typecheck passes.
- [ ] ShipFlow metadata lint passes.
- [ ] Source check confirms no new `search.list` usage in P1/P2/P3 UI.
- [ ] Source check confirms no client-side YouTube token, refresh token or transcript secret exposure.

## Hosted Deployment Checks

- [ ] Convex prod deployment includes P1/P2/P3 backend changes.
- [ ] Vercel app deployment includes P1/P2/P3 Flutter changes.
- [ ] Build commit in diagnostics matches the shipped commit.
- [ ] Browser validation uses the deployed URL, not stale production or local files.

## Account Matrix

- [ ] Fresh ReplayGlowz account before YouTube connection.
- [ ] Google account connected to OAuth but with no YouTube channel/playlists/subscriptions.
- [ ] Normal YouTube account with playlists, subscriptions and videos.
- [ ] Existing ReplayGlowz account with cached legacy TubeFlow/tubeflow product data where applicable.
- [ ] Browser with strict tracker blocking shows the fallback guidance instead of a blank page.

## YouTube Connection

- [ ] Dashboard proposes YouTube connection when disconnected.
- [ ] Preferences reports connected/disconnected/token state accurately.
- [ ] OAuth start succeeds from dashboard and Preferences.
- [ ] OAuth callback returns to the intended route.
- [ ] Disconnect/reconnect leaves no stale UI state.
- [ ] Error copy distinguishes auth failure, quota failure, empty account and server failure.

## Quota-Safe Sync

- [ ] Refresh starts `youtube:startQuotaSafeSync`.
- [ ] Progress/job state is visible while sync runs.
- [ ] Empty YouTube account returns a friendly empty state.
- [ ] Existing playlists sync without skeletons stuck forever.
- [ ] Quota usage appears in Stats and near costly actions where implemented.
- [ ] High quota usage disables or warns before expensive actions.
- [ ] Partial sync keeps cached data visible.

## Feed

- [ ] Videos page loads cached videos with thumbnails.
- [ ] Cards/list/notes view switch works.
- [ ] View mode persists after reload.
- [ ] Show/hide watched persists after reload.
- [ ] Feed filter offers `All videos` plus multi-select ReplayGlowz Feeds, and clears stale feed selections when needed.
- [ ] Feed filter does not expose direct playlist/source selection inside the main Feed picker.
- [ ] Removing a ReplayGlowz Feed source removes the source card and that source's videos without requiring page reload.
- [ ] Scroll position restores after opening a video and returning.
- [ ] Video actions work: play, share/copy, mark watched/unwatched, hide/delete where available, add to playlist.
- [ ] No video state explains whether YouTube is disconnected, connected-empty, or filtered-empty.

## Playlists

- [ ] Playlists page loads synced playlists.
- [ ] Lists page hides the technical YouTube `Subscriptions` aggregate playlist.
- [ ] ReplayGlowz Feed source picker still offers `All subscriptions` as a source option.
- [ ] Add playlist button is visually low-emphasis and appears/fades as intended.
- [ ] Create playlist works and refreshes the list.
- [ ] Edit playlist modal works and refreshes the page/list.
- [ ] Delete/hide playlist updates UI and cache.
- [ ] Playlist detail opens reliably.
- [ ] Playlist detail video actions work.
- [ ] Reorder mode persists order when saved.
- [ ] Playlist scroll restores after returning from detail.

## Channel Automation

- [ ] Preferences lists YouTube subscriptions for a normal account.
- [ ] Empty subscriptions state is friendly and not a server error.
- [ ] Link channel to playlist works.
- [ ] Duplicate active channel link is rejected clearly.
- [ ] Pause/resume channel link works.
- [ ] Unlink channel works.
- [ ] Sync linked channel shows quota warning/outcome.
- [ ] Playlist detail or equivalent surface makes linked channel state discoverable enough.

## Player

- [ ] YouTube iframe renders and plays on hosted app.
- [ ] Play/pause, seek, progress save and resume work.
- [ ] Queue drawer works.
- [ ] Next/previous queue behavior works where implemented.
- [ ] Notes tab loads and creates timestamped notes.
- [ ] Transcript tab loads active transcript or useful empty state.
- [ ] Timestamp click-to-seek works from notes/transcripts.
- [ ] Focus mode hides secondary chrome without breaking notes.
- [ ] Keyboard shortcuts work when not typing.
- [ ] Keyboard shortcuts do not fire while typing in note/search/form fields.
- [ ] Shortcuts help overlay is readable on desktop and mobile.
- [ ] Mobile Play long press switches the bottom bar into playback controls.
- [ ] Mobile Play swipe up opens current-video actions: hide, mark watched, slower, faster.
- [ ] Browser-driven background playback interruption shows guidance and an explicit `do not show again` option.

## Transcripts

- [ ] Provider catalog loads.
- [ ] Unavailable providers explain why.
- [ ] Secret add/test/delete works without exposing raw secrets.
- [ ] Default provider/language settings persist.
- [ ] Generate transcript starts a job.
- [ ] Job status/progress is visible.
- [ ] Transcript versions list appears.
- [ ] Selecting active version changes displayed transcript.
- [ ] Missing captions/provider/worker failure shows recoverable copy.

## Notes

- [ ] Notes overview loads grouped notes.
- [ ] Search notes works.
- [ ] Sort order works and persists.
- [ ] Note detail opens.
- [ ] Edit note works.
- [ ] Delete note works.
- [ ] Copy Markdown export works where plan allows it.
- [ ] Plan-gated export failure is explained.
- [ ] Share/focus note remaining gaps are explicitly tracked if not shipped.

## Onboarding And Hints

- [ ] Dismissible hints appear in Videos, Playlists, Playlist detail, Play and Notes.
- [ ] Dismissed hints stay dismissed after reload.
- [ ] Reset hints in Preferences makes hints visible again.
- [ ] First-run copy stays ReplayGlowz-first and does not explain WinFlowz/Suite unless needed.
- [ ] Empty-state copy is short and action-oriented.
- [ ] French copy is natural and accented for new P3 strings.

## Diagnostics And Support

- [ ] Diagnostics show auth state, YouTube connection state, build commit and relevant recent logs.
- [ ] Diagnostics never expose tokens, cookies, raw transcript secrets or OAuth codes.
- [ ] Server errors include enough request/log context for operator debugging.
- [ ] User-facing errors are not raw Convex stack traces.

## Remaining Product Decisions

- [ ] Decide whether Browse/Discovery is restored or intentionally dropped.
- [ ] Decide whether mini-player is restored.
- [ ] Decide whether advanced study mode gets a P4 spec.
- [ ] Decide final free/trial quotas and public wording.
- [ ] Decide whether notes share/focus/PDF export are required before parity ship.
