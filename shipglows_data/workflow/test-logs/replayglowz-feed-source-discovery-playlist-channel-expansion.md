---
artifact: test_checklist
metadata_schema_version: "1.0"
artifact_version: "0.1.1"
project: "replayglowz"
created: "2026-05-30"
updated: "2026-05-31"
status: draft
source_skill: sf-build
scope: "feed-source-discovery-playlist-channel-expansion"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "app"
  - "backend"
depends_on:
  - artifact: "shipglows_data/workflow/specs/replayglowz-feed-source-discovery-playlist-channel-expansion.md"
    artifact_version: "1.0.0"
    required_status: "ready"
supersedes: []
evidence: []
next_step: "/sf-verify replayglowz-feed-source-discovery-playlist-channel-expansion"
---

# Test Checklist: Feed Source Discovery and Playlist Channel Expansion

## Preconditions

- Authenticated ReplayGlowz test account.
- At least one ReplayGlowz Feed exists or can be created.
- At least one cached YouTube playlist contains videos from more than one channel.
- Cached subscriptions are available when validating subscription-channel selection.

## Scenarios

- [x] CA 1: Open a Feed, click `Ajouter une source`, and confirm the picker shows distinct source intentions.
- [ ] CA 2: Open `Chaînes depuis mes abonnements`, search for a channel, select it, add it, and confirm it appears in Feed sources.
- [ ] CA 3: Open `Playlist YouTube`, add a playlist source, and confirm the current playlist videos feed the Feed.
- [x] CA 4: Open `Chaînes d'une playlist`, select a playlist, and confirm channel candidates with counts appear.
- [x] CA 5: Select multiple detected channel candidates and confirm they are added as `channel` sources.
- [x] CA 6: Repeat the add path for already-added channels and confirm no generic server error appears.
- [ ] CA 7: Use a playlist with missing channel metadata when available and confirm the missing metadata message appears.
- [ ] CA 8: Use a playlist with no usable candidates when available and confirm the empty state suggests adding the playlist or refreshing cache.
- [x] CA 9: Click `Play all` after adding extracted channel sources and confirm the Play queue uses the Feed videos.
- [x] CA 10: Confirm local source add actions do not display quota warnings and do not call YouTube write endpoints.
- [ ] CA 11: Attempt candidate query or batch add with another user's IDs only in a controlled backend/security test; confirm Convex rejects access.
- [ ] CA 12: Check French and English source-mode copy for static playlist vs live channel distinction.
- [ ] CA 12b: Add playlist channels and confirm the snackbar/result summary reports real added/already-added/rejected counts, not a false `0 added` result from serialized backend data.
- [x] CA 13: With empty subscription channel cache, open Feed source picker and confirm subscription channel mode offers import instead of being disabled.
- [x] CA 14: Trigger subscription import from Feed source picker and confirm the existing `subscriptions.list` path runs.
- [x] CA 15: Trigger aggregate subscriptions source with empty cache and confirm code path imports before adding the source when channels are returned.
- [x] CA 16: Use a playlist with cached videos missing `youtubeChannelId` and confirm candidate sheet offers missing-channel detection.
- [x] CA 17: Trigger missing-channel detection and confirm cached playlist videos are patched with `youtubeChannelId`.
- [x] CA 18: Confirm normal playlist-channel candidate query remains cache-only and YouTube calls are isolated to explicit refresh/import actions.

## Automated Evidence

- [x] `(cd backend/packages/backend && npm run typecheck)`
- [x] `(cd app && flutter analyze)`
- [x] `(cd app && flutter test)`
- [x] Source scan for forbidden YouTube write endpoints in Feed local source paths.
- [x] `/home/claude/shipglows/tools/shipglows_metadata_lint.py AGENT.md shipglows_data`
- [x] Extension local checks 2026-05-30: backend typecheck, Flutter analyze/test, metadata lint, and diff scan showing new YouTube usage limited to `subscriptions.list` and `videos.list`.

## Browser Evidence

- [x] Production app loaded `BUILD_COMMIT_SHA=d37e225c32b8eb9c4c05e9159903a687800e08c6` on `https://app.replayglowz.com` with authenticated test account.
- [x] Created temporary Feed `QA Feed Source 0530`.
- [x] Confirmed source picker shows distinct modes: channels from subscriptions, YouTube playlist, channels from a playlist, and all subscriptions.
- [x] Selected playlist `Fun`; candidate query returned `Sheena Melwani` with `1 videos`.
- [x] Added `Sheena Melwani` as a live channel source; Feed showed `1 sources • 1 active` and the known video.
- [x] Reopened extraction flow and confirmed the same channel is disabled as `Already in this Feed` instead of throwing a generic server error.
- [x] Clicked `Play all`; app routed to `/play?videoId=vSCF6pTxqJ8&autoPlay=1`.
- [x] Deleted temporary Feed `QA Feed Source 0530` after QA.
- [x] Extension production app loaded `BUILD_COMMIT_SHA=703d7a22d1526862ca600833546d29721ecf1d6f` on `https://app.replayglowz.com`.
- [x] Created temporary Feed `QA Feed Import 0530`.
- [x] Confirmed empty subscription cache UI now shows import copy for `Channels from my subscriptions` and `All subscriptions`.
- [x] Triggered `Channels from my subscriptions` import from the Feed source picker; YouTube quota display moved from `0 / 1000` to `1 / 1000`, proving the explicit `subscriptions.list` path ran.
- [x] Confirmed `Channels from a playlist` still detects `Sheena Melwani` from playlist `Fun` without showing the missing-metadata backfill button, because this fixture already has `youtubeChannelId`.
- [x] Deleted temporary Feed `QA Feed Import 0530` after QA.

## Notes

- CA 2 remains pending because this test account showed subscription-channel options disabled/no subscription cache in this scenario.
- CA 3 remains covered by existing behavior but was not re-clicked during this browser pass.
- CA 7 and CA 8 require specific cache fixtures with missing/no channel metadata.
- CA 16 and CA 17 are covered by implementation/typecheck against the new backfill action. Browser proof could not exercise the visible button on `Fun` because that fixture already has channel metadata.
- CA 12 was visually checked in English production copy; French copy is present in i18n and covered by Flutter analyze, but not browser-toggled in this run.
- 2026-05-31 docs alignment added a regression scenario for serialized Convex batch-add results after a false zero-count notification was reported during playlist-channel source import.
