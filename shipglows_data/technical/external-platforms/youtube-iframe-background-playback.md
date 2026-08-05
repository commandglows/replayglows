---
artifact: technical_guidelines
metadata_schema_version: "1.0"
artifact_version: "0.1.1"
project: "replayglows"
created: "2026-05-31"
updated: "2026-06-01"
status: draft
source_skill: sf-docs
scope: "external-platform-youtube-iframe-background-playback"
owner: "Diane"
confidence: medium
risk_level: medium
security_impact: none
docs_impact: yes
linked_systems:
  - "app"
  - "YouTube IFrame Player API"
  - "Firefox for Android"
  - "Vivaldi for Android"
depends_on:
  - "shipglows_data/technical/app/architecture.md"
supersedes: []
evidence:
  - "https://developers.google.com/youtube/iframe_api_reference"
  - "https://support.mozilla.org/en-US/kb/some-videos-wont-play-background"
  - "https://vivaldi.com/blog/tips/tip-221/"
next_review: "2026-08-31"
next_step: "Recheck official browser and YouTube iframe docs before promising background audio behavior."
---

# YouTube Iframe Background Playback

## Purpose

Record the external behavior that constrains ReplayGlows background audio guidance for embedded YouTube playback in the current web app.

## Source Map

- YouTube IFrame Player API: embedded players are controlled through the iframe JavaScript API, which exposes player commands and state-change events.
- Mozilla Firefox for Android support: Firefox can continue background video, but sites may detect hidden/inactive page states and pause playback themselves.
- Vivaldi Android tip #221: Vivaldi exposes an "Allow background audio playback" setting that can keep tab audio playing after switching tabs or apps.

Freshness verdict on 2026-05-31: `fresh-docs checked`.

## ReplayGlows Decision Rules

- Do not claim ReplayGlows can guarantee background playback for YouTube iframe videos.
- Do not generalize this web iframe limitation to future native ReplayGlows apps.
- Treat a pause after app/background transition as browser- or YouTube-embed-controlled unless local code explicitly paused the player.
- User-facing copy may recommend browsers/settings known to allow background audio, but must keep wording conditional.
- Public copy may preserve `watch anywhere, anytime` as a native-app ambition if it clearly distinguishes the current web beta limitation.
- In-app guidance should explain the limitation when detected and must provide an explicit opt-out for repeated popups.
- Verification for this behavior requires real mobile browser testing; Flutter analyzer and unit checks are not enough.

## Maintenance Rule

Update this note when ReplayGlows changes embedded player implementation, adds a native playback surface, or when official YouTube/browser docs change the background audio contract.
