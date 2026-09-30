---
title: "Review a difficult video passage with bookmarks and an A–B loop"
description: "Use ReplayGlows to isolate a YouTube tab, mark a passage and repeat it at a slower pace without changing your other tabs."
date: "2026-09-05"
author: "ReplayGlows Team"
tags: ["extension", "guide", "video review"]
locale: en
articleKey: extension-passage-review
alternateSlug: reviser-un-passage-video
---

You are watching a tutorial at your usual pace. A short explanation goes by too quickly, and dragging the timeline back keeps dropping you in the wrong place. Give that passage a beginning, an end and a pace of its own.

The ReplayGlows extension combines shared playback speed with local YouTube bookmarks and temporary A–B loops. This example uses YouTube because bookmark capture is YouTube-specific. Playback controls also work with accessible HTML5 video and audio on other supported websites.

Public installation is being prepared. If you already have a test version, you can follow these steps now; otherwise, use this walkthrough to explore the workflow.

## 1. Keep your usual speed as the default

Open the popup and choose your base speed in the bottom playback card. For example, choose 1.5× for material you already know. Supported unpinned tabs follow this shared context.

There is no need to make each tab independent. Keep the shared pace until one passage calls for an exception.

## 2. Pin the tab you want to review

Pin the YouTube tab inside ReplayGlows, then set it to 0.75× or another comfortable rate. Other unpinned tabs continue to follow the shared speed.

This pin belongs to the extension’s speed controls, not Chrome’s native tab pin. When you unpin it, the tab rejoins the current global rate, even if you changed that rate elsewhere in the meantime.

## 3. Mark a useful beginning and end

Imagine the explanation runs from 02:10 to 02:35. Save a bookmark near each position on the current YouTube video, then expand “Répéter un passage · boucle A–B” in the playback card. Select the “Début” and “Fin” bookmarks and click “Répéter entre ces marque-pages” (these are the current French interface labels). These times are an example: choose bounds that preserve the explanation’s context.

If you do not need bookmarks, place A and B during playback instead. B must come after A, and the media needs a finite duration. Start a little before the difficult phrase so each repetition makes sense on its own.

## 4. Repeat with a question in mind

Listen for one thing: what changes between two steps, which term is being defined, or which gesture you need to reproduce. Add a note in your own words at the relevant timestamp. On the next pass, check whether your note actually matches what the speaker shows.

If the bounds cut a sentence short, clear the loop and choose a better pair. Keep a useful passage available while you work through it, then move on.

## 5. Finish the review deliberately

Clear the loop and unpin the tab to continue at the shared pace. Moving outside the segment, replacing the media or navigating away also clears the loop.

Saved bookmarks remain available, but the A–B loop is temporary. Exporting notes as JSON or Markdown does not save the loop or the tab’s speed. Pins last for the tab session; the shared base speed and preferences are saved locally. The extension does not automatically synchronize these records with the ReplayGlows web app.

## Adapt the controls to your workflow

Options lets you change playback shortcuts and your favorite speed. Hold the boost shortcut to scan temporarily; release it to return to the effective rate. If a shortcut conflicts with a bookmark action, choose another combination.

See the [extension guide](/extension/guide) for default shortcuts, supported pages and recovery steps, or [explore the extension](/extension) for the full overview.
