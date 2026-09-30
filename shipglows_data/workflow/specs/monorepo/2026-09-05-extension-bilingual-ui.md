---
artifact: implementation_spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
status: active
chantier_status: verified
source_skill: shipglows
scope: extension-bilingual-ui
owner: Diane
confidence: high
risk_level: medium
security_impact: no
docs_impact: yes
linked_systems: [ext]
depends_on: ["shipglows_data/product/ext/product.md", "ext/AGENT.md"]
supersedes: []
evidence: ["Operator approved option 1 for complete French-English extension localization on 2026-09-05.", "Thirty focused bookmark, discovery, playback and localization tests, typecheck, scoped lint, build and package verification passed.", "An isolated packaged Chromium run verified the live English switch in popup/options and the native action popup in French."]
next_step: "Reload the unpacked extension in the operator browser and verify English and French injected controls on a real YouTube video."
---
# Bilingual ReplayGlows Extension UI

## Outcome
The popup, settings, discovery guide, playback controls, YouTube-injected bookmark controls and package metadata support French and English. Users choose Automatic, Français or English; the local preference applies live. Automatic selects French for a French browser language and English otherwise.

## Scope and invariants
The implementation centralizes typed Vue messages and keeps a compatible self-contained dictionary in the classic YouTube content script. The language preference is extension-local and does not alter bookmarks, playback settings, discovery progress, permissions, network behavior or app synchronization. Existing click-gesture and collapsible bookmark-list repairs in `contentscript.js` remain intact.

## Acceptance and proof
- French and English dictionaries retain key parity.
- Explicit language overrides browser language and persists in `chrome.storage.local`.
- Storage changes update open Vue extension pages and rebuild YouTube-injected controls.
- Chrome manifest metadata uses `_locales/en` and `_locales/fr`.
- Focused i18n and existing regression tests, typecheck, scoped lint and `build:ext` pass.
- The generated extension was loaded in an isolated Chromium profile: options and popup switched live to English, and the native action popup retained its constrained layout in French.

## Limits
Isolated packaged-browser proof does not establish that an already-open personal Chrome or Edge profile reloaded the extension. English and French injected controls on a real YouTube page remain an operator-visible follow-up.
