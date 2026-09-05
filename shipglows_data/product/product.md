---
artifact: product_context
metadata_schema_version: "1.0"
artifact_version: "0.2.0"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-05"
status: "draft"
source_skill: "sf-docs"
scope: "product"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
target_user: "Learning-focused YouTube users who need notes, playlists, retrieval, review, and optional transcript support across ReplayGlows surfaces."
user_problem: "Video learning becomes fragmented when playback, notes, playlists, feedback, transcripts, and later retrieval live in disconnected tools."
desired_outcomes: "Control supported browser media with shared speed and pinned exceptions, repeat temporary passages, capture timestamped notes, organize videos and playlists, reconnect YouTube reliably, submit feedback, and support transcript workflows through a dedicated worker."
non_goals: "Entertainment discovery, creator publishing infrastructure, a generic video platform, collaboration suite, or unproven AI automation claims."
docs_impact: "yes"
security_impact: "unknown"
evidence:
  - "shipglows_data/product/ext/product.md"
  - "shipglows_data/product/app/product.md"
  - "shipglows_data/product/site/product.md"
  - "shipglows_data/product/lab/product.md"
depends_on: []
supersedes: []
next_review: "2026-10-05"
next_step: "Review affected surface contracts when product behavior changes."
---

# Product Context

## Product Truth

ReplayGlows combines an authenticated YouTube learning application with a standalone browser extension. The app provides timestamped notes, playlists, history, feedback and backend-supported transcript operations. The extension provides local YouTube bookmarks and notes plus shared HTML5 playback controls across supported HTTP/HTTPS sites, without requiring app sign-in. The extension contract is `shipglows_data/product/ext/product.md`; app authentication and backend capabilities must not be attributed to the extension.

## Core Workflows

- Control HTML5 video/audio speed across supported sites from the extension, with a shared base speed and pinned-tab exceptions.
- Repeat a temporary passage using current positions or existing YouTube bookmark pairs in the extension.
- Watch YouTube videos in the app.
- Capture and revisit timestamped notes.
- Organize videos and playlists.
- Connect YouTube through the web OAuth redirect flow.
- Submit feedback from the app.
- Run transcript work through the separate FastAPI worker when enabled by backend integration.

## Non-Goals

Do not describe ReplayGlows as a creator publishing platform, generic video platform, entertainment discovery engine, collaboration suite, or AI automation product unless the implementation and reviewed contracts prove that capability.
