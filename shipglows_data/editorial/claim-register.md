---
artifact: editorial_content_context
metadata_schema_version: "1.0"
artifact_version: "0.2.0"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-05"
status: "draft"
source_skill: sf-docs
scope: "claim-register"
owner: "Diane"
confidence: "medium"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
content_surfaces:
  - "public_site"
  - "repo_docs"
claim_register: "shipglows_data/editorial/claim-register.md"
page_intent: "shipglows_data/editorial/page-intent-map.md"
linked_systems:
  - "site/src/pages"
  - "app"
  - "lab"
  - "ext"
depends_on:
  - "shipglows_data/product/product.md"
  - "shipglows_data/gtm/gtm.md"
supersedes: []
evidence:
  - "shipglows_data/product/ext/product.md"
  - "shipglows_data/product/app/product.md"
  - "shipglows_data/product/site/product.md"
  - "shipglows_data/product/lab/product.md"
next_review: "2026-10-05"
next_step: "sg-docs editorial audit"
---

# Claim Register

| Claim area | Safe status | Evidence | Rule |
| --- | --- | --- | --- |
| Timestamped notes | supported | `app/README.md`, app screens/models | May be described as current product behavior. |
| Playlists and viewing workflows | supported | `app/README.md`, app providers/screens | May be described as current product behavior. |
| YouTube OAuth connect | supported with constraints | `app/api/auth/**`, app OAuth spec | Mention web redirect behavior only when aligned with implementation. |
| Transcript worker | internal/backend capability | `lab/server.py`, worker README | Do not market as a user-facing guarantee without app integration evidence. |
| Multisite extension playback | implemented and locally verified | `shipglows_data/product/ext/product.md`, playback spec | Say supported HTTP/HTTPS HTML5 video/audio; do not promise every site/player or extend YouTube notes to all sites. |
| Shared speed and pinning | implemented and locally verified | `ext/src/playback/background.ts`, playback spec | One global base context; pins are session-scoped tab exceptions, separate from native Chrome pinning. |
| Bookmark passage repetition | implemented and locally verified | `shipglows_data/product/ext/product.md` | Temporary A–B loops from current positions or YouTube bookmark pairs; no persisted segment or note-specific speed claim. |
| Extension availability | unpacked development delivery | Commit `e9b4ad3`, playback spec | Do not imply Web Store publication or personal-profile installation. |
| Advanced media tools and app sync | research candidates / not delivered in this increment | Competitor matrix and extension product contract | No current claim for URL rules, frame stepping, effects, manual media selection or app-extension synchronization. |
| AI automation | needs proof | No root-level reviewed proof in this update | Avoid present-tense public claims unless implemented and documented. |
| Time savings or productivity gains | needs proof | No quantified evidence in reviewed contracts | Use qualitative wording; avoid numeric gains. |
| Security/compliance/privacy | sensitive | Privacy/terms pages and implementation | Do not strengthen without legal and implementation evidence. |
| Pricing/LTD/subscription | sensitive | Business and GTM contracts | Keep pricing copy synchronized with actual offer and entitlement implementation. |
| Availability/reliability | sensitive | Deployment docs only | Avoid uptime or reliability guarantees unless evidence exists. |

## Claim Impact Plan

- Changed claim: `[claim]`
- Surface: `[route/file]`
- Evidence checked: `[contract/code/spec]`
- Status: `[supported|needs proof|claim mismatch|blocked]`
- Required action: `[none|weaken|remove|add proof|human review]`
