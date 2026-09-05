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
chantier_status: pending-hosted-access
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
next_step: "Authenticate to the protected Vercel preview, verify hosted pages, then resolve public publication."
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

## Delivery and Remaining Proof

Content commit `b8e5c7ec1f0503bbf4b664dadaea5a3af81d645d` pushed to `codex/extension-public-content`. GitHub deployment 6284035169 reports successful Preview deployment at https://replayglowssite-jx9ruli0n-diane-ds-projects.vercel.app. Main production was not changed.

Final local browser pass after content corrections: all six routes at 1440 and 390 widths pass. Desktop product and mobile product screenshot layouts inspected. Build passes after final content edits. Metadata passes on six governed files; changed-file design scan found no findings but did not cover newly staged files, so it is not a complete design audit.

Hosted browser proof is pending authentication: isolated Chromium, Codex browser and Chrome all reach the Vercel login page. No protection was disabled or credential extracted. This is an access blocker, not a locale defect in the site; the verifier now diagnoses cross-origin authentication redirects before content assertions. Retain task branch for review; no production readiness claim until hosted access is resolved.

| Date | Stage | Result |
| --- | --- | --- |
| 2026-09-05 | sg-content draft/apply | Six EN/FR pages, source-faithful copy, locale routing and navigation implemented. |
| 2026-09-05 | sg-content verify | Local build and 12 responsive route checks pass; independent content corrections incorporated. |
| 2026-09-05 | sg-content preview | Preview deployment succeeded; hosted page observation requires Vercel login. |

## Editorial Evaluation

Editorial quality score is a human-style content assessment, not an automated measurement or deployment verdict.

```json
{
  "schema_version": "1.0",
  "run_id": "extension-content-2026-09-05",
  "project_id": "replayglows",
  "surface": "other",
  "evaluator": {
    "skill": "007-sg-content",
    "role": "verifier",
    "initiated_by": "operator"
  },
  "input_refs": {
    "content_ref": "site/src/content/extension.ts and paired extension-passage-review articles",
    "source_refs": [
      "shipglows_data/product/ext/product.md",
      "ext/src/playback/PlaybackCard.vue",
      "ext/src/options/Options.vue"
    ]
  },
  "applied_rules_revision": {
    "business": "business/business.md 0.1.0",
    "editorial": "editorial/content-map.md 0.2.0",
    "claim_register": "editorial/claim-register.md 0.2.0"
  },
  "scores": {
    "overall": 91,
    "clarity": 92,
    "structure": 92,
    "source_faithfulness": 95,
    "compliance": 94,
    "brand_voice": 90,
    "call_to_action": 78
  },
  "weights": {
    "clarity": 0.2,
    "structure": 0.15,
    "source_faithfulness": 0.2,
    "compliance": 0.2,
    "brand_voice": 0.15,
    "call_to_action": 0.1
  },
  "status": "publishable with caveats",
  "blocked_reasons": [],
  "evidence": [
    {
      "criterion": "source_faithfulness",
      "source": "local extension code and independent read-only review",
      "state": "pass"
    },
    {
      "criterion": "call_to_action",
      "source": "no verified public installation URL; guide CTA is explicit",
      "state": "warning"
    }
  ],
  "recommendations": [
    "Verify authenticated hosted rendering before production publication.",
    "Add installation CTA only once an official URL is verified."
  ],
  "confidence": 0.9,
  "expires_at_utc": null,
  "run_signature": "aa9d5c24c2e2f7152cf620321d0c4e6f4242ba5da318d707cd34565d3477e50d"
}
```

## Icon Follow-up

Operator requested homepage-style icons. Added decorative emoji with the same typography and spacing as Benefits.astro to extension feature cards, guide steps and article header in both locales. All icons are aria-hidden; headings retain text labels. Astro build passes (17 pages), and rendered French product cards and guide steps were visually inspected. Existing protected-preview access requirement remains.

## Homepage Discovery Follow-up

Operator requested a short homepage introduction and contextual links. Shared ExtensionTeaser.astro now appears after ProductProof on both home locales and on /features, with links to overview, guide and paired review article. Added narrow contextual references in the existing English speed and note-taking articles; their audience and substantive article scope are unchanged. The teaser uses homepage icons, distinguishes local extension notes from app sync and retains installation availability wording. Astro build passes; generated HTML checks confirm the three destinations on both homes and /features and article links. Rendered French desktop and 390px mobile teaser inspected without clipping. This remains on the review branch; protected hosted verification is still pending.
