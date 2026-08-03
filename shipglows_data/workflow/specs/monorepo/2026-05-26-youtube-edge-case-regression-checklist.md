---
artifact: audit_report
metadata_schema_version: "1.0"
artifact_version: "0.1.0"
project: "replayglowz"
created: "2026-05-26"
updated: "2026-05-26"
status: "draft"
source_skill: "sf-auth-debug"
scope: "youtube-edge-case-regression-checklist"
owner: "Diane"
confidence: "medium"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
domains:
  - "code"
  - "qa"
  - "auth"
issue_counts:
  critical: 0
  high: 4
  medium: 9
  low: 3
linked_systems:
  - "app"
  - "backend"
  - "Convex"
  - "YouTube OAuth"
  - "YouTube Data API"
depends_on:
  - "shipglows_data/workflow/specs/replayglowz-youtube-core-parity-priority-1.md"
  - "shipglows_data/workflow/specs/replayglowz-youtube-core-parity-priority-2.md"
  - "shipglows_data/workflow/specs/replayglowz-youtube-core-parity-priority-3.md"
supersedes: []
evidence:
  - "Production diagnostics from 2026-05-24 through 2026-05-26."
  - "Convex prod logs for youtube:startQuotaSafeSync and youtube:fetchYoutubePlaylists."
  - "Operator QA with personal account and dedicated ReplayGlowz test Google account."
  - "YouTube Help: https://support.google.com/youtube/answer/1646861"
  - "YouTube Data API playlists.list: https://developers.google.com/youtube/v3/docs/playlists/list"
  - "YouTube Data API subscriptions.list: https://developers.google.com/youtube/v3/docs/subscriptions/list"
  - "YouTube Data API channels.list: https://developers.google.com/youtube/v3/docs/channels/list"
  - "backend/packages/backend/convex/youtube.ts"
  - "app/lib/screens/videos/videos_screen.dart"
  - "app/lib/screens/playlists/playlists_screen.dart"
  - "app/lib/widgets/youtube_connect_ui_states.dart"
next_step: "/sf-test ReplayGlowz YouTube edge-case regression checklist"
---

# ReplayGlowz YouTube Edge-Case Regression Checklist

## Purpose

Keep a durable list of YouTube account states that must be retested whenever ReplayGlowz changes YouTube OAuth, sync, feed, playlists, quota handling, onboarding, or empty states.

These cases are easy to forget because YouTube separates Google accounts, YouTube channels, subscriptions, playlists, uploaded videos, and OAuth scopes. ReplayGlowz must support users who only consume YouTube content, not only users who own or publish on a YouTube channel.

ReplayGlowz identity and YouTube identity are also separate. A user can sign in to ReplayGlowz through Clerk email/password while authorising YouTube through a Google OAuth account. That is valid, but it must be tested because it creates account-linking edge cases that look like YouTube sync bugs.

## Core Principle

A ReplayGlowz user does not need a personal YouTube channel to use the app.

Valid content sources:

- Subscriptions: channels the Google/YouTube account follows.
- Playlists: playlists owned by a YouTube channel, or specific public/unlisted playlist URLs/IDs imported explicitly into ReplayGlowz.
- Explicit playlist imports: public or unlisted YouTube playlist URLs/IDs imported into ReplayGlowz cache when automatic `mine=true` discovery is unavailable.
- Saved/imported videos cached in ReplayGlowz.

Invalid assumption:

- Do not treat `playlists.list mine=true` or the presence of a personal channel as a prerequisite for subscription feed sync, playlist display, or general YouTube connection success.

## API Research Findings

Official docs clarify a split that matters for ReplayGlowz QA:

- A Google Account can watch, like, and subscribe to channels without creating a YouTube channel. Creating playlists requires a YouTube channel according to YouTube Help.
- `subscriptions.list?mine=true` is the API path for the authenticated user's subscriptions. It is the correct source for users who consume YouTube via subscriptions.
- `playlists.list?mine=true` returns playlists owned by the authenticated user. YouTube Data API playlist resources include the channel that published the playlist, and Google examples describe current-user playlist operations as operations on the authenticated user's channel.
- `channels.list?mine=true` can return zero channel resources because it returns channels owned by the authenticated user.
- Therefore, a missing personal channel should not block subscription sync, but it can legitimately prevent channel-owned playlist discovery through `playlists.list?mine=true`.

Product consequence:

- ReplayGlowz should keep playlist sync and subscription sync independent.
- If a user reports playlists visible on youtube.com but has no channel, verify whether those are saved/library playlists, Watch Later, legacy/consumer-library lists, or channel-owned created playlists. The current API path may not expose saved/library playlists through `playlists.list?mine=true`.
- Explicit playlist-URL import is now the fallback for users who expect ReplayGlowz to import playlists that are visible/saved in the YouTube UI but not discoverable through `playlists.list mine=true`.
- Do not use the presence of a "Create channel" button in YouTube UI as proof that the account has no YouTube library data. It only proves YouTube is still offering to create or complete a public channel/profile surface.

## Regression Matrix

| ID | YouTube account state | Expected behavior | Must not happen | Primary surfaces |
|----|-----------------------|-------------------|-----------------|------------------|
| YT-EDGE-001 | Fresh Google account, OAuth connected, no YouTube channel, no subscriptions, no playlists | Connection succeeds; app shows a calm empty state and does not imply auth failure. | Server Error, product-access error, forced channel creation, infinite skeletons. | Connect card, Videos, Playlists, Preferences diagnostics |
| YT-EDGE-002 | Google account has no personal YouTube channel but has channel subscriptions | Connection succeeds; `Refresh videos` fetches subscriptions and recent uploads into the virtual Subscriptions feed. | Blocking on `Channel not found` from personal playlists; empty feed if subscriptions exist. | Videos feed, Preferences channel sync, quota job |
| YT-EDGE-003 | Google account has no personal YouTube channel but appears to have playlists in the YouTube UI | Connection succeeds; if Google returns `Channel not found` for `mine=true`, the app still tries independent subscription/feed paths and shows a useful playlist-empty state. QA must distinguish created playlists from saved/library playlists. | Treating missing channel as global YouTube failure; assuming web-visible library playlists are necessarily exposed by `playlists.list mine=true`; crashing before other sync sources run. | Playlists, Videos feed, sync job |
| YT-EDGE-004 | Google account has a personal channel but zero playlists | Connection succeeds; playlists page shows empty playlist state; subscriptions still sync if present. | Server Error or skeleton-only UI. | Playlists, Videos feed |
| YT-EDGE-005 | Google account has playlists but no subscriptions | Playlist sync succeeds; Videos feed shows playlist videos; Subscriptions tab/virtual playlist can be empty. | Assuming subscriptions are required; failing full refresh because `subscriptions.list` returns empty. | Playlists, Videos feed |
| YT-EDGE-006 | Google account has subscriptions but zero accessible recent videos | Subscriptions sync completes with 0 videos; user sees a valid empty state. | Repeated background retries that burn quota; generic failure snackbar. | Videos feed, quota job |
| YT-EDGE-007 | Google account has many subscriptions | Sync respects quota caps, max channel limits, batching, and progress reporting. | Unbounded `playlistItems.list` fan-out; no quota progress; hard failure after partial results. | Videos feed, Stats, quota job |
| YT-EDGE-008 | Access token expired, refresh token valid | Backend refreshes token with Convex prod YouTube OAuth vars and continues sync. | `credentials not configured`, requiring reconnect unnecessarily. | Any YouTube action |
| YT-EDGE-009 | Refresh token revoked or invalid | App shows reconnect guidance; backend clears or reports connection state safely. | Infinite retry loop; exposing raw token/provider errors. | Connect card, Preferences |
| YT-EDGE-010 | Vivaldi/browser tracking protection blocks Clerk or Convex scripts | App shows unblock/adblock guidance fallback. | Permanent white page without explanation. | Bootstrap, sign-in, protected app |
| YT-EDGE-011 | YouTube quota near warning threshold | UI shows quota/progress and disables or warns before expensive sync. | Launching full sync blindly; hiding quota usage. | Videos refresh, Playlists refresh, Stats |
| YT-EDGE-012 | YouTube quota hard stop reached | Sync stops before next expensive request and marks job partial with a readable reason. | Burning quota past safety threshold; generic Server Error. | Sync job, snackbar, Stats |
| YT-EDGE-013 | ReplayGlowz account created with Clerk email/password; YouTube authorised with a Google account using the same email | YouTube tokens attach to the current ReplayGlowz `user_...`; UI reads the same user session and shows the correct connection/sync state. | Assuming ReplayGlowz login provider must be Google; losing tokens because the Clerk login method differs. | Sign-in, YouTube connect, Convex token storage, Preferences diagnostics |
| YT-EDGE-014 | ReplayGlowz account created with Clerk email/password; YouTube authorised with a different Google account | App still links YouTube tokens to the current ReplayGlowz user, but diagnostics/support copy must make the linked YouTube identity clear enough to avoid confusion. | Saving tokens to another ReplayGlowz user; showing playlists/subscriptions from an unexpected Google account without explainability. | YouTube callback, Preferences diagnostics, account/help copy |
| YT-EDGE-015 | User signs into ReplayGlowz with one Clerk session but browser has another Google account selected during YouTube OAuth | OAuth succeeds only for the Google account selected in the Google consent screen; ReplayGlowz stores that YouTube authorization against the active Clerk user. | UI reading a stale Clerk session; callback associating tokens with the wrong `user_...`; silent cross-account mix-up. | YouTube OAuth start/callback, Clerk session handoff, Convex `saveYoutubeTokens` |
| YT-EDGE-016 | Convex stores YouTube tokens on one `user_...`, but UI later runs under another Clerk session/account | UI should show disconnected or the correct account state for the current user, never another user's YouTube data. | Cross-user token/data leakage; phantom connected state; playlists from a previous session. | Auth restore, providers, connection status, cached YouTube tables |
| YT-EDGE-017 | Google OAuth account has visible YouTube web playlists/subscriptions but no initialized YouTube channel profile | App should treat missing channel/profile as a provider capability limitation, continue independent sync paths, and show a specific empty/unsupported message where discovery is impossible. | Generic Server Error; assuming web-visible playlists are necessarily exposed by `playlists.list mine=true`; forcing channel creation without explanation. | Playlists sync, subscriptions sync, empty states, diagnostics |
| YT-EDGE-018 | YouTube UI shows `Create channel`, but the account still has `Watch Later` and a named playlist like `FUN` | QA should copy the playlist URLs/IDs and import readable public/unlisted playlist IDs through ReplayGlowz explicit playlist import; Watch Later should show the unsupported-special-playlist message. | Assuming the UI library and Data API `mine=true` discovery are equivalent; treating `Watch Later` as a normal API-readable playlist. | Playlist import, diagnostics, explicit URL import |

## Implementation Coverage 2026-05-26

ReplayGlowz now has a first implementation for the explicit playlist import path referenced in this checklist.

- Backend cache rows can distinguish `owned`, `url_import`, and `subscriptions` playlist sources.
- Automatic `playlists.list mine=true` refresh preserves URL imports and the virtual Subscriptions playlist instead of deleting every row not returned by owned discovery.
- `youtube:importPlaylistByUrl` accepts YouTube playlist/video URLs with `list=...` or raw playlist IDs, rejects Watch Later/liked special IDs, reads public or unlisted playlists by explicit ID, and imports at most 500 videos per execution.
- Flutter empty states in Playlists and Videos, plus Preferences, expose channel creation guidance and playlist URL import.
- Current local verification covers backend typecheck, Flutter analyze, playlist model parsing tests, and URL validation tests.

Retest gap:

- Production QA still needs the dedicated Google test account with visible `Create channel` and playlist `FUN` after deployment.

## Manual QA Steps

Use these after any change that touches YouTube sync or feed behavior.

1. Sign in to ReplayGlowz with the target test account.
2. Confirm YouTube connection state in Preferences.
3. Click `Refresh videos` from the Videos page.
4. Open Playlists and click refresh there too.
5. Check that skeletons resolve to either content, a valid empty state, or a specific reconnect/quota message.
6. Copy diagnostics if any failure appears.
7. Inspect Convex prod logs using the displayed Request ID.
8. Confirm the latest sync job has a terminal status: `completed`, `partial`, or a specific expected failure.

## Identity-Linking QA Steps

Use these after any change that touches Clerk sign-in, YouTube OAuth, token persistence, session restore, or diagnostics.

1. Create or sign in to ReplayGlowz with Clerk email/password.
2. Connect YouTube with a Google account using the same email.
3. Confirm Preferences diagnostics show the expected ReplayGlowz `user_...` and YouTube connected state.
4. Disconnect YouTube, then reconnect with a different Google account in the Google consent screen.
5. Confirm the resulting playlists/subscriptions match the Google account selected during OAuth, not the Clerk login method.
6. Sign out of ReplayGlowz, sign in with another ReplayGlowz account, and confirm YouTube data from the previous `user_...` is not visible.
7. Retest after browser reload and in a clean browser profile to catch stale-session bugs.

## Backend Assertions

The backend should preserve these contracts:

- `youtube:startQuotaSafeSync` must not abort the whole sync only because `youtube:fetchYoutubePlaylists` returns a missing-channel error.
- `youtube:startQuotaSafeSync` must refresh the virtual Subscriptions feed independently from user-owned playlists.
- `youtube:fetchYoutubeSubscriptions` must handle zero subscriptions as a successful empty result.
- `youtube:fetchSubscriptionFeed` must cap channels/videos per channel and batch video detail calls.
- YouTube provider errors stored in jobs/snackbars must be user-safe and must not expose tokens, cookies, OAuth codes, or secrets.
- Convex prod token refresh must use `YOUTUBE_OAUTH_CLIENT_ID` and `YOUTUBE_OAUTH_CLIENT_SECRET`, with legacy names only as compatibility fallback.
- YouTube tokens must be stored against the authenticated Convex identity derived from the active ReplayGlowz/Clerk session, not inferred from the Google email alone.
- Connection status and cached YouTube reads must always be scoped by the current ReplayGlowz `user_...`.

## UI Assertions

The app should preserve these contracts:

- A connected account with no content is not an auth failure.
- A connected account with no personal channel is not an auth failure.
- The feed can mix playlist videos and subscription videos.
- The user can understand whether they need to connect YouTube, subscribe to channels, create/sync playlists, wait for sync, or reconnect.
- The app must not display permanent skeletons after a terminal sync result.
- Empty states should be ReplayGlowz-first and should not introduce WinFlowz/Suite explanation unless the user is in account/help context.
- Diagnostics should make it possible to distinguish ReplayGlowz account identity from the Google account authorised for YouTube, without exposing private tokens or secrets.

## Retest Triggers

Run this checklist when changing:

- YouTube OAuth start/callback routes.
- Convex auth/JWT token handoff.
- Clerk sign-in methods, session restore, account linking, or diagnostics.
- YouTube token refresh.
- `startQuotaSafeSync`, `fetchYoutubePlaylists`, `fetchPlaylistItems`, `fetchYoutubeSubscriptions`, or `fetchSubscriptionFeed`.
- Feed aggregation, playlist display, or virtual playlist handling.
- Quota/progress UI.
- Empty states, onboarding, or diagnostics.

## Open Questions

- Verify with the dedicated test account whether the playlists visible in YouTube are created/owned playlists or saved/library playlists. Official docs indicate created playlists require a channel; if these are saved/library playlists, consider an alternate explicit playlist-URL import path later.
- Decide whether the virtual Subscriptions feed should appear as a normal playlist card, a pinned feed section, or only inside the Videos tab.
- Decide the final free/trial quota values before turning placeholder quota copy into product copy.
