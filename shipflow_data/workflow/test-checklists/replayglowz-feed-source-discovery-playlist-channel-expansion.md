---
artifact: test_checklist
metadata_schema_version: "1.0"
artifact_version: "0.1.0"
project: "replayglowz"
created: "2026-05-30"
updated: "2026-05-30"
status: draft
source_skill: sf-build
scope: "feed-source-discovery-playlist-channel-expansion"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "replayglowz_app"
  - "replayglowz_backend"
depends_on:
  - artifact: "shipflow_data/workflow/specs/replayglowz-feed-source-discovery-playlist-channel-expansion.md"
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

- [ ] CA 1: Open a Feed, click `Ajouter une source`, and confirm the picker shows distinct source intentions.
- [ ] CA 2: Open `Chaînes depuis mes abonnements`, search for a channel, select it, add it, and confirm it appears in Feed sources.
- [ ] CA 3: Open `Playlist YouTube`, add a playlist source, and confirm the current playlist videos feed the Feed.
- [ ] CA 4: Open `Chaînes d'une playlist`, select a playlist, and confirm channel candidates with counts appear.
- [ ] CA 5: Select multiple detected channel candidates and confirm they are added as `channel` sources.
- [ ] CA 6: Repeat the add path for already-added channels and confirm no generic server error appears.
- [ ] CA 7: Use a playlist with missing channel metadata when available and confirm the missing metadata message appears.
- [ ] CA 8: Use a playlist with no usable candidates when available and confirm the empty state suggests adding the playlist or refreshing cache.
- [ ] CA 9: Click `Play all` after adding extracted channel sources and confirm the Play queue uses the Feed videos.
- [ ] CA 10: Confirm local source add actions do not display quota warnings and do not call YouTube write endpoints.
- [ ] CA 11: Attempt candidate query or batch add with another user's IDs only in a controlled backend/security test; confirm Convex rejects access.
- [ ] CA 12: Check French and English source-mode copy for static playlist vs live channel distinction.

## Automated Evidence

- [x] `(cd replayglowz_backend/packages/backend && npm run typecheck)`
- [x] `(cd replayglowz_app && flutter analyze)`
- [x] `(cd replayglowz_app && flutter test)`
- [x] Source scan for forbidden YouTube write endpoints in Feed local source paths.
- [x] `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENT.md shipflow_data`

## Notes

- Browser/manual QA should run after an explicit ship/deploy because the project development mode is `vercel-preview-push`.
