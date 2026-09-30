---
artifact: implementation_spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-28"
updated: "2026-09-28"
status: active
chantier_status: in_progress
source_skill: sg-development
scope: extension-local-archive
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: [ext]
depends_on:
  - "shipglows_data/product/ext/product.md"
  - "shipglows_data/workflow/specs/monorepo/2026-09-23-extension-youtube-frame-capture.md"
supersedes: []
evidence:
  - "Operator requested chosen-folder automatic notes and captures with installation explanation on 2026-09-28."
  - "Operator chose to inform Brave users instead of requiring a Windows companion on 2026-09-28."
next_step: "Verify actual folder selection, note/capture writes, and Brave messaging in packaged browsers."
---

# Chosen Folder Archive for Extension Notes and Captures

## Outcome

People who use a supporting browser may choose a folder once and have local YouTube bookmark notes and local frame captures saved there without a download after every note edit. Installation explains the storage paths and settings retain recovery, export, and import controls. Brave's default browser behavior is disclosed without asking people to install a companion application or enable experimental flags.

## Contract

- `chrome.storage.local` remains the immediate authoritative record for extension bookmarks and playback progress. The chosen folder is a derived archive; a folder failure must never erase or falsely acknowledge a note.
- On first install, open a visible extension setup page. A button invokes the browser's directory picker, since folder access requires a user gesture. Settings can choose, change, or reconnect the folder later.
- Where supported and permitted, each bookmark add, edit, delete, video delete, or import refreshes the affected video's `Notes.md` under `ReplayGlows/<channel>/<video title> [ID]/` in the chosen folder. Write errors are visible as a paused archive state; retry from settings refreshes current data. Do not trigger `chrome.downloads` for note mutations.
- A local frame capture writes its PNG under that video's `captures/` and regenerates `Notes.md` in the same chosen folder. If no usable folder exists, preserve the existing explicit local capture download behavior and explain the browser's destination/prompt. Never imply that a capture was archived if either required write failed.
- In unsupported browsers, including Brave by default, explain that extension notes still save in the browser profile and that explicit JSON backup, Markdown export, and import remain available. Do not promise silent writes to an arbitrary folder.
- Settings export reads the current authoritative records. JSON contains local bookmark notes and watch progress; it does not include captured image bytes. Markdown provides the current text records. Import validates and confirms replacement before writing, then refreshes the chosen folder when possible.
- A ReplayGlows account does not currently upload extension bookmarks. Authenticated cloud frame capture uses the app bridge and remains separate. Do not describe account creation as automatic cloud backup of local extension notes until that integration exists and is verified.

## Permission and Failure Boundaries

- Store the folder handle in extension-origin IndexedDB, not in exported JSON. Query write permission before background writes. If it is unavailable or revoked, keep local notes, surface archive status, and request reconnection only from a user gesture.
- Sanitize every generated path segment and keep all writes beneath the selected folder's `ReplayGlows` child. Do not read or overwrite arbitrary user files outside generated archive paths.
- A browser profile or extension removal can remove local records and stored folder access; exported files remain. The setup page must make this distinction plain.
- No new cloud authorization is inferred from the cached signed-in boolean used for frame capture.

## Proof

- Typecheck and package the extension through Doppler; check that installed manifest resources include the setup page and service worker.
- Exercise add, edit, delete, import, permission loss, reconnect, and capture in an isolated packaged Chrome profile with a disposable chosen folder. Inspect the actual generated Markdown and PNG paths/content.
- Inspect the setup and settings in Brave, verify the unsupported path and explicit exports, and avoid a false silent-save claim. Report browser evidence separately from package checks.

## Execution

1. Add the IndexedDB folder-handle adapter and serialized worker mirror. Keep bookmark persistence authoritative and preserve the existing playback-progress changes in the dirty worktree.
2. Add the installation setup and settings controls with capability detection, visible archive status, and current-data exports.
3. Align product, capture, and task records; verify the package and browser behavior before any completion claim.

Readiness review: the local archive is bounded to extension storage and a user-chosen directory. Chrome supports the needed picker and writable handles in its documented API; Brave requires a disclosed fallback. Cloud bookmark synchronization is excluded because the current extension has no authenticated product token path. Runtime support in a packaged extension remains an explicit proof gate.

Implementation checkpoint, 2026-09-28: the folder-handle adapter, background mirror, capture routing, installation page, settings recovery and exports are in the worktree. Doppler typecheck passes. The packaged browser check covers opening the setup page and saving a note without a download; actual directory selection, file contents and Brave UI still require live inspection.
