---
artifact: implementation_spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
created_at: "2026-09-05"
updated_at: "2026-09-05"
source_model: inherited
status: active
chantier_status: implementing
source_skill: sg-content
scope: extension-public-content
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: [site]
depends_on: ["shipglows_data/product/ext/product.md"]
supersedes: []
evidence: ["Operator approved the proposed extension page, practical guide and article on 2026-09-05."]
next_step: "Create and verify the six EN/FR content routes and scoped delivery."
---

# Extension Public Content

## User Story and Outcome
A site visitor discovers what the extension does, distinguishes it from the web app, learns its controls and follows a bookmark-to-loop review workflow. Before: no extension-specific public content. After: an EN/FR product page, guide and worked article with navigation and mutual links.

## Approved Scope and Routes
- Product: /extension and /fr/extension.
- Guide: /extension/guide and /fr/extension/guide.
- Article: /blog/review-a-video-passage and /fr/blog/reviser-un-passage-video.
- Existing shared navigation/footer and French home link to extension; existing blog index/feed route the new article to its proper locale.
- Add optional locale/alternate metadata compatibly; existing articles keep their current routes. No translation of unrelated historical articles.
- Reuse site global.css design tokens and Layout.astro SEO shell; new locale peers receive reciprocal alternates. No new dependencies, forms, tracking or pricing.

## Behavior and Claims
Canonical source: product/ext/product.md and completed playback spec. Global speed with session pins, 0.25–4x, temporary A–B from YouTube bookmarks, configurable commands and input guards are current. Notes are YouTube-specific; no app sync or saved loops. Do not claim compatibility with every site or a Web Store release. Installation CTA needs an independently verified official URL; if unavailable, state that distribution is being prepared and offer the guide. Illustrations must be labelled as illustrations, not screenshots.

## Editorial and Claim Impact Plan
Product page explains scope; guide owns reference and recovery; article owns one practical learning scenario. Internal links connect all three. Both locales must convey equivalent claims and availability. No quantified learning gains or competitor superiority. Existing unrelated marketing debt remains in the editorial roadmap.

## Tasks and Proof
1. Author source-faithful EN/FR content and reusable site presentation.
2. Integrate locale routes, navigation, metadata and blog discovery.
3. Build; inspect six rendered pages, mobile/desktop, links, unique H1, language, canonical and reciprocal alternates. Check claim/locale parity and design drift.
4. Update editorial map/schema policy/roadmap; scoped commit/push and report deployment separately.
Evidence-first content review plus scenario-first rendered-page verification. Managed DevServer owns runtime. Public site production publication is separate from Git persistence; use existing preview policy.

## Risks, Recovery and Security
No auth/data/payment changes. Invalid or missing store URL must not become a guessed download link. No technical checkout paths or private evidence exposed in public copy. Optional article fields preserve legacy routes/feed. ZOMBIES: no media/restricted pages guide recovery; multiple tabs explain pinning; rate and temporary-loop bounds explicit; mobile navigation and long translated text checked. OWASP: static authored content only, no new user input or remote scripts.

## Execution and Readiness
Main owns mutations; one read-only scout checks install URL/runtime delivery. Scope and authority resolved by user approval; implementation may proceed. Main reviews all six locales as one outcome.

## Skill Run History
| Date | Stage | Result |
| --- | --- | --- |
| 2026-09-05 | sg-content plan/ready | Approved content set; claims, routes, locale parity, design authority and proof bounded. |

## Current Chantier Flow
Approved → implementing → verification → scoped delivery.

## Verification Record

- First Astro build passed (17 pages). Packaged HTML includes all six new routes; original article paths remain.
- Managed start initially timed out; second start succeeded at registry-assigned http://127.0.0.1:3015. Early connection attempts failed before readiness; subsequent browser run passed all six routes at 1440 and 390 widths, alternate links, canonical URLs, navigation, no overflow and no browser errors.
- Visual review of mobile French product page confirms readable hierarchy and no clipping. Preview illustration is labelled and is not a product screenshot.
- Read-only independent source review checked rate, pin lifecycle, loops and shortcut behavior. Corrections applied: JSON import replaces records after confirmation; explain backup and Markdown clipboard export; exact French loop UI labels included in both locales; blog list labels language.
- Fresh docs: public installation URL search found no official ReplayGlows listing; no install CTA added. External competitor claims are not published. Other content is grounded in current local product implementation, not third-party platform promises.
- Documentation classification: updated editorial maps/schema policy/roadmap and site guidance. Existing unrelated public marketing claims remain separately tracked. No release announcement or pricing/legal change.
- GitHub deployment evidence confirms main auto-publishes production; delivery uses codex/extension-public-content for hosted preview before final public decision.
