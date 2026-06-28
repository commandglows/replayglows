---
artifact: product_context
metadata_schema_version: "1.0"
artifact_version: "1.2.0"
project: "replayglowz-app"
created: "2026-04-26"
updated: "2026-06-01"
status: reviewed
source_skill: sf-docs
scope: product
owner: "Diane"
confidence: high
risk_level: medium
target_user: "Individuals who watch YouTube for learning, curation, or repeat reference and need notes, playlists, feeds, and viewing continuity across web-first testing today and native-first product surfaces later."
user_problem: "Educational and reference-oriented YouTube workflows are fragmented across playback, note-taking, playlist organization, and later retrieval."
desired_outcomes: "Capture timestamped notes while watching, organize videos into playlists and feeds, retain viewing context, manage YouTube connectivity, and move toward watch-anywhere playback as native apps become the main product surfaces."
non_goals: "Building a public content site, replacing YouTube playback, supporting undocumented native platform workflows, or claiming analytics, collaboration, billing, creator-side publishing, or AI features not evidenced in this repo."
security_impact: unknown
docs_impact: yes
evidence:
  - "README.md"
  - "CLAUDE.md"
  - "pubspec.yaml"
  - "lib/app/router.dart"
  - "lib/screens/videos/videos_screen.dart"
  - "lib/screens/play/play_screen.dart"
  - "lib/screens/playlists/virtual_feed_detail_screen.dart"
  - "shipflow_data/workflow/specs/feedback-v1.md"
  - "shipflow_data/workflow/specs/flutter-web-youtube-auth-redirect-spec.md"
  - "User feedback 2026-06-01: web is the easier-to-test starting surface, but native apps are intended to be the main ReplayGlowz product experience."
linked_artifacts:
  - "README.md"
  - "shipflow_data/business/app/business.md"
  - "shipflow_data/business/app/branding.md"
  - "shipflow_data/business/app/gtm.md"
  - "shipflow_data/editorial/app/content-map.md"
  - "shipflow_data/workflow/specs/feedback-v1.md"
  - "shipflow_data/workflow/specs/flutter-web-youtube-auth-redirect-spec.md"
depends_on: []
supersedes:
  - artifact_version: "0.1.0"
next_review: "2026-07-31"
next_step: "/sf-docs audit"
---

# Product Context

## Product Definition

ReplayGlowz App is currently implemented as a Flutter web application for authenticated YouTube viewing workflows. The web app is the first testable surface, not the long-term product ceiling: ReplayGlowz is intended to become a native-first viewing product where stronger mobile/background playback workflows can be built. The current repository supports a personal productivity use case: watch videos, capture timestamped notes, organize content into playlists and ReplayGlowz feeds, keep history-oriented continuity, manage preferences and notifications, connect YouTube when needed, and submit feedback.

The defensible product claim is workflow consolidation. ReplayGlowz brings several actions that usually happen across YouTube, notes apps, bookmarks, and memory into one app context.

## Target User

The supported target user is an individual, not a team or enterprise workspace.

Primary user characteristics evidenced by the repo:

- Watches YouTube for learning, research, tutorials, interviews, or repeat reference.
- Needs to return to specific moments inside videos.
- Wants personal organization through notes, playlists, feeds, source selection, history, and preferences.
- Is willing to sign in so state can persist across sessions.
- May connect a YouTube account for account-linked workflows.

## Problem

The product addresses a fragmented learning and curation workflow:

- Video playback happens in YouTube.
- Notes are often captured in a separate tool.
- Timestamps must be copied or remembered manually.
- Playlists and later retrieval live apart from note-taking.
- Viewing continuity depends on scattered history and bookmarks.

ReplayGlowz positions itself as the app layer that keeps those actions together.

## Desired Outcomes

- Let users watch YouTube videos inside the app workflow.
- Let users create and revisit timestamped notes tied to video context.
- Let users organize videos through playlists and feed source collections.
- Let users narrow the main feed to all videos or selected ReplayGlowz feeds.
- Move toward the product goal of watching anywhere, anytime, with native app surfaces expected to carry stronger playback capabilities than the current web implementation.
- Preserve user state through Clerk authentication and Convex-backed persistence.
- Support YouTube connection through the Vercel OAuth path described in the repo.
- Give users a feedback route and an admin review surface for product learning.

## Core Workflows

1. Sign in and restore an authenticated session.
2. Enter the main app shell.
3. Browse or open video-oriented routes.
4. Watch a video and capture timestamped notes.
5. Create, manage, or revisit playlists and ReplayGlowz feeds.
6. Use history, stats, preferences, notifications, or related utility routes where present.
7. Connect YouTube when account-linked functionality is required.
8. Submit feedback through `/feedback`; review feedback through `/feedback/admin` when authorized.

## Scope In

- Flutter web client deployed as a static web app on Vercel.
- Web-first implementation used as the easiest current surface for testing and iteration.
- Clerk-authenticated sessions with Convex JWT bridging.
- YouTube video playback inside the app workflow.
- Timestamped note-taking.
- Playlist management.
- ReplayGlowz feed filtering and feed source management.
- Mobile playback controls and current-video actions for faster watching workflows.
- History-oriented viewing continuity.
- Preferences, notifications, stats, hidden/admin-style utility routes, and feedback surfaces present in routing.
- English and French translation assets.

## Scope Out

- Public marketing website, editorial blog, or docs hub managed from this repo.
- Multi-user collaboration or shared team workspaces.
- Billing, pricing, subscriptions, or other monetization flows.
- Creator publishing, audience growth, or channel analytics tooling.
- AI summaries, semantic search, or automated knowledge management unless later implemented.
- Production-readiness claims for native mobile apps beyond what the Flutter codebase technically enables.
- Guaranteed background playback for embedded YouTube videos across browsers.
- Backend contracts not present in the paired Convex implementation or documented specs.

## Success Signals

These are appropriate product signals to validate because they align with evidenced workflows. They are not proven instrumented KPIs in this repository.

- Users complete sign-in and reach the authenticated shell.
- Users connect YouTube successfully when prompted.
- Users create timestamped notes while watching.
- Users create, update, or revisit playlists and ReplayGlowz feeds.
- Users use Play controls to hide, mark watched, loop, navigate, or adjust speed without leaving the viewing workflow.
- Users return to previously watched or organized content.
- Users submit actionable feedback when confused or blocked.

## Claim Boundaries

Safe product claims:

- ReplayGlowz combines YouTube viewing, timestamped notes, playlists, feeds, and continuity workflows.
- The app is account-backed and built around authenticated persistence.
- Feedback collection is part of the product loop.
- `Watch anywhere, anytime` is an appropriate product ambition and native-app direction, but must not be framed as a fully delivered guarantee for the current web app.

Unsafe claims until additional evidence exists:

- Team collaboration.
- Monetization or pricing.
- Creator growth or publishing workflows.
- AI-powered study, summarization, search, or recommendations.
- Enterprise knowledge management.
- Mature public acquisition funnel.

## Risks

- Product scope can drift because frontend behavior depends on a separate Convex backend contract.
- Routes such as stats, hidden, and feedback admin prove product intent but not necessarily maturity of every workflow.
- GTM and business assumptions remain limited until Diane confirms target customer, monetization, and acquisition strategy.
- Public-facing claims should remain narrow and feature-based until stronger upstream business and brand contracts are reviewed.
- Web background audio should be described as browser-dependent because embedded YouTube playback can be interrupted outside the app's control.
- Do not let web limitations redefine the native product ambition; mark them as current web constraints.
