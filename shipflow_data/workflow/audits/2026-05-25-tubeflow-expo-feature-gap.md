---
artifact: audit_report
metadata_schema_version: "1.0"
artifact_version: "0.1.0"
project: "replayglowz"
created: "2026-05-25"
updated: "2026-05-25"
status: "draft"
source_skill: "sf-audit-code"
scope: "feature-gap"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
security_impact: "yes"
docs_impact: "yes"
domains:
  - "code"
  - "design"
  - "translate"
issue_counts:
  critical: 0
  high: 7
  medium: 3
  low: 0
linked_systems:
  - "replayglowz_app"
  - "replayglowz_backend"
  - "tubeflow_expo"
depends_on:
  - "shipflow_data/workflow/specs/replayglowz-youtube-quota-safe-sync.md"
supersedes: []
evidence:
  - "https://github.com/dianedef/tubeflow_expo"
  - "/tmp/tubeflow_expo_audit/apps/web/src/app"
  - "/tmp/tubeflow_expo_audit/apps/web/src/components"
  - "/tmp/tubeflow_expo_audit/apps/web/src/hooks"
  - "/tmp/tubeflow_expo_audit/packages/backend/convex"
  - "replayglowz_app/lib"
  - "replayglowz_backend/packages/backend/convex"
next_step: "/sf-spec Porter les features TubeFlow Expo manquantes vers ReplayGlowz Flutter"
---

# TubeFlow Expo Feature Gap Audit

## Purpose

Trace the functional gaps found while comparing the historical TubeFlow Expo/Next app with the current ReplayGlowz Flutter web app.

This is an inventory, not an implementation spec. The next step should be a staged spec because the gaps span app UI, Convex flows, YouTube quota safeguards, player behavior, and user-facing workflows.

## Source Context

Historical source inspected:

- `https://github.com/dianedef/tubeflow_expo`
- Temporary local clone during audit: `/tmp/tubeflow_expo_audit`

Current ReplayGlowz source inspected:

- `replayglowz_app/lib`
- `replayglowz_backend/packages/backend/convex`

## Summary

The current ReplayGlowz backend already contains many of the old domain primitives: YouTube cache, playlists, watched state, progress, channel links, transcripts, quota metrics, notes, comments, likes, hidden items, and subscription feed sync.

The main gap is product exposure in the Flutter app. Several historical features exist partially in Convex or models/providers, but are not yet wired into user-facing Flutter screens.

Implementation update 2026-05-25:

- P2 channel sync is now partially exposed in Preferences: subscribed channels can be listed, linked to playlists, paused/resumed, unlinked, and synced from the selected channel.
- P2 transcript provider management is now partially exposed in Preferences and Play: provider catalog, secret save/test/delete, generation status, version chips, and active-version selection.
- P2 notes export is now partially exposed as Markdown copy from grouped video notes, with server-side plan gating.
- P3 onboarding and persistent UX helpers are now partially exposed: dismissible hints, reset hints action, persisted local view preferences, bounded scroll restoration, lightweight player focus mode, keyboard shortcut overlay, and P3 EN/FR strings.
- Remaining gaps: authenticated hosted QA, richer provider sorting, more complete notes share/focus workflows, playlist-detail linked-channel placement, mini-player, browse/discovery decision, advanced study workflows, and full app-wide i18n parity.

## Priority Findings

### P1 - Video Feed Advanced Controls

Current evidence:

- `replayglowz_app/lib/screens/videos/videos_screen.dart` has unimplemented search and filter actions.
- `replayglowz_app/lib/providers/providers.dart` already has `VideosArgs(sortOrder, includeWatched)`.
- Historical app had `usePaginatedVideos`, view persistence, show/hide watched, quota throttling, swipe hints, and video actions.

Missing or incomplete:

- Video search.
- Playlist/date/channel filters.
- Show/hide watched toggle.
- Infinite scroll or pagination.
- Swipe/action menu parity: hide, delete, like, share, add to playlist, link channel.
- Quota-aware disabling of refresh when daily quota is high.

### P1 - Player State And Controls

Current evidence:

- `replayglowz_app/lib/screens/play/play_screen.dart` supports playback, notes, transcript, queue drawer, progress save, and basic actions.
- Flutter web now uses a native YouTube iframe wrapper for playback.
- Historical `apps/web/src/app/play/page.tsx` used the YouTube IFrame API directly and maintained state for time, speed, fullscreen, queue, minimization, panels, and shortcuts.

Missing or incomplete:

- Web iframe state bridge for current time, play/pause, seek, duration, speed, and ended state.
- Mini-player global context.
- Next/previous queue controls.
- Keyboard shortcuts and help overlay.
- Focus mode and study mode integration.
- Fullscreen/CSS fullscreen workflow.
- Proper sync between player current time and timestamped notes/transcripts on web.

### P1 - Playlist Video Actions

Current evidence:

- Current Flutter app has playlist list/detail, edit popup, reorder, hide/delete/sync.
- Historical app had `AddVideoModal`, `AddToPlaylistModal`, `PlaylistPickerModal`, `ChannelPickerModal`, `LinkedChannelsList`, and reorderable video cards.

Missing or incomplete:

- Add video to playlist by YouTube search.
- Add current/feed video to playlist.
- Move video between playlists.
- Remove video with optimistic UI.
- Share playlist/video.
- Play all playlist videos.
- Link channel to playlist.
- Show and manage linked channels.

### P1 - YouTube Quota Safeguards In UX

Current evidence:

- Current Flutter app has quota provider and stats screen.
- Historical app used quota state throughout YouTube actions, including throttling and warnings.
- User explicitly confirmed quota cost sensitivity as a product requirement.

Missing or incomplete:

- Quota warning before costly channel sync actions.
- Disable or degrade refresh/sync actions above threshold.
- Surface expected quota cost for add/sync/link actions.
- Make quota state visible near YouTube actions, not only `/stats`.

### P2 - Channel Sync And Subscription Feed UX

Current evidence:

- Backend has `channelLinks.ts`, `fetchYoutubeSubscriptions`, `fetchSubscriptionFeed`, `syncAllLinkedChannels`, and sync settings schema.
- Current Flutter preferences expose some settings but not the full channel-link workflow.

Missing or incomplete:

- UI to browse subscribed channels.
- UI to link a channel to a ReplayGlowz playlist.
- UI to toggle/unlink linked channels.
- Sync past videos from a linked channel with quota warning.
- Auto-sync-on-visit settings with clear user feedback.

### P2 - Transcript Provider Management

Current evidence:

- Backend has transcript provider catalog, secrets, generation jobs, versions, selections, and worker integration.
- Current Flutter player can request/display transcripts, but provider settings are not feature-complete.
- Historical app had `TranscriptProvidersSettings`.

Missing or incomplete:

- Provider catalog UI with availability, cost/speed/quality sorting.
- User API key management for providers that require secrets.
- Transcript version list and active version selection.
- Job progress/status UI.
- Regenerate with provider/language choice.

### P2 - Notes Advanced Workflows

Current evidence:

- Current Flutter app has notes list/detail/search and timestamped notes in player.
- Historical app had richer note panels, note focus, share/export copy, and stronger player integration.

Missing or incomplete:

- Export notes as Markdown/PDF/plain text.
- Share note.
- Focus note view.
- Better timestamp click-to-seek behavior on web after iframe state bridge.
- More complete global search and filters.

### P2 - Browse / Discovery View

Current evidence:

- Historical app had `/browse` with Netflix-style rows, hero video, playlist sections, recent videos, video detail modal, and add-to-playlist.
- Current Flutter app has no equivalent screen.

Decision needed:

- Either port a ReplayGlowz-native browse/discovery view or intentionally drop it from the product surface.

### P3 - Onboarding, Hints, And Modes

Current evidence:

- Historical app had onboarding modal, swipe hints, study mode, focus mode, scroll restoration, and persistent view preferences.
- Current Flutter app now has P3 local persisted UX helpers in feed/playlists/notes/player, reusable dismissible hints, a reset hints action in Preferences, and lightweight player focus/shortcut UI.

Missing or incomplete:

- Advanced study mode beyond presentation-only focus mode.
- Global mini-player.
- Cross-device persistence for all UX helpers; current implementation uses local browser persistence for hints/scroll and server settings model support for future account-level UX settings.
- More complete playlist-detail linked-channel placement and notes focus/share workflows.

### P3 - i18n Parity

Current evidence:

- `replayglowz_app/lib/i18n/en.dart` and `fr.dart` contain TODOs to copy remaining sections.
- Historical i18n included many keys for quota, channel links, shortcuts, onboarding, mini-player, transcripts, browse, and notes.
- P3 added EN/FR keys for new hints, focus mode, shortcuts, empty states and hint reset controls.

Missing or incomplete:

- Full English/French key parity for restored features.
- App-wide cleanup of pre-existing hard-coded strings and legacy TODO headers.

## Suggested Implementation Order

1. Restore the core YouTube workflow:
   - feed search/filter/watched controls
   - playlist video actions
   - quota-aware refresh/sync actions

2. Stabilize the player:
   - iframe API state bridge on web
   - timestamp seek from notes/transcript
   - queue next/previous
   - progress save reliability

3. Restore channel sync:
   - link channel to playlist
   - linked channel management
   - subscription feed sync UI

4. Restore advanced learning features:
   - transcript provider settings and versions
   - note export/share/focus
   - keyboard shortcuts

5. Decide on UX expansion:
   - mini-player
   - browse/discovery view
   - study/focus mode
   - onboarding

## Spec Intake

Chantier potential: yes.

Recommended spec:

```text
/sf-spec Porter les features TubeFlow Expo manquantes vers ReplayGlowz Flutter
```

Spec should split implementation into quota-safe batches and require browser/manual QA for authenticated YouTube flows.
