---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-07-16"
created_at: "2026-07-16 17:08:14 UTC"
updated: "2026-07-16"
updated_at: "2026-07-16 17:16:20 UTC"
status: ready
source_skill: 100-sg-spec
source_model: "GPT-5 Codex"
scope: "site-landing-hero-testimonial-rail"
owner: "Diane"
user_story: "As a ReplayGlowz landing-page visitor, I want real user testimonials visible directly beneath the hero trust message, so social proof is immediate and the page no longer needs a redundant testimonial section."
confidence: "high"
risk_level: "medium"
security_impact: "none"
docs_impact: "yes"
linked_systems:
  - "site"
  - "English landing page"
  - "French landing page"
  - "Astro"
  - "site design-system tokens"
depends_on:
  - artifact: "shipflow_data/technical/design-system-authority.md"
    artifact_version: "1.0.0"
    required_status: "draft"
supersedes: []
evidence:
  - "Operator decision on 2026-07-16: testimonials belong immediately below the hero trust message, should scroll horizontally, and should not have a dedicated titled section."
  - "Source audit: both locales currently render avatar placeholders in the hero and a separate three-card testimonial section later in the page."
  - "Source audit: both locale navs link to the standalone #reviews anchor, which would become invalid when that section is removed."
next_step: "/005-sg-ship replayglowz hero testimonial rail, then /405-sg-prod and /108-sg-browser"
---

# Move Landing Testimonials Into The Hero Trust Rail

## Status

Implemented locally. Verification is partial until the matching Vercel preview is shipped, discovered, and checked in a browser.

## User Story

As a ReplayGlowz landing-page visitor, I want real user testimonials visible directly beneath the hero trust message, so social proof is immediate and the page no longer needs a redundant testimonial section.

## Minimal Behavior Contract

On both `/` and `/fr/`, replace the hero avatar placeholders with the existing three testimonial cards in a compact horizontal rail below the existing trust sentence. The rail moves continuously when motion is allowed, pauses on pointer hover or keyboard focus, and becomes manually scrollable without automatic motion under `prefers-reduced-motion`. Remove the later standalone testimonial section and its heading. Remove the Reviews/Avis navigation item so no dead anchor remains. Preserve all testimonial copy, Pricing, and unrelated sections.

## Success Behavior

- The hero trust sentence remains visible and is followed immediately by testimonial cards.
- Cards move horizontally in a seamless repeated rail on motion-capable devices.
- Only the primary set is exposed to assistive technology; the visual loop copy is hidden from the accessibility tree.
- Hover or focus pauses motion; reduced-motion users receive a static, horizontally scrollable list.
- The standalone Reviews/User Testimonials and Avis/Témoignages utilisateurs sections are absent.
- English and French remain structurally aligned, with their current locale copy preserved.

## Error Behavior

- If removing the section leaves a `#reviews` navigation link, verification fails.
- If auto-motion cannot be stopped or reduced-motion still animates, verification fails.
- If implementation requires new raw component-level visual literals, stop and route the value through `site/src/styles/global.css`.
- If Pricing or testimonial wording changes, verification fails.

## Scope In

- Shared testimonial rail component and English hero composition.
- French hero trust area and removal of the French standalone testimonial section.
- English and French Reviews/Avis navigation items.
- Centralized rail behavior styles and reduced-motion handling.

## Scope Out

- Testimonial wording, names, roles, ratings, or trust-count claim.
- Pricing markup, alignment, content, or styling.
- Any other landing section, route, SEO metadata, or conversion link.
- Commit, push, preview, or production deployment without separate operator authorization.

## Constraints

- `site/src/styles/global.css` remains the site design-system authority.
- Reuse the existing marquee duration/easing tokens and marketing-card primitive.
- The rail must remain useful without JavaScript.
- Preserve unrelated untracked screenshots and any user-owned dirty work.

## Test Contract

- `proof_profile`: evidence-first UI change.
- `automated_proof`: `(cd site && npm run build)`, changed-file design-system drift scan, and source scope checks.
- `browser_proof`: matching Vercel preview for `/` and `/fr/` at desktop and mobile widths after authorized ship.
- `accessibility_proof`: one semantic testimonial set, duplicated loop hidden, focus pause, and reduced-motion static overflow.
- `hosted_follow_through`: `005-sg-ship -> 405-sg-prod -> 108-sg-browser` on the matching preview.

## Implementation Tasks

- [x] Build one reusable testimonial rail that accepts locale-specific items.
- [x] Render the rail in the English and French hero trust areas and remove avatar placeholders.
- [x] Remove both standalone testimonial sections and the English import/render path.
- [x] Remove Reviews/Avis navigation items that would target the deleted anchor.
- [x] Add centralized pause and reduced-motion behavior, then run build, drift, and scope checks.

## Acceptance Criteria

- [x] Both hero areas show their trust sentence followed by the three existing testimonials in a horizontal rail.
- [x] There is no standalone testimonial heading or section and no `#reviews` navigation link.
- [x] Rail motion pauses on hover/focus and is disabled under reduced motion while manual horizontal scrolling remains possible.
- [x] Repeated visual cards are `aria-hidden`; rating semantics remain meaningful in the primary set.
- [x] Pricing and testimonial copy are unchanged.
- [x] The site builds and the changed-file drift scan has no unexplained findings.

## Risks

- Medium: a continuously moving rail can harm readability unless it is slow and pausable.
- Medium: duplicated English/French page composition can drift.
- Low: removing the dedicated section can leave dead navigation anchors.
- Security impact: none; the site remains static.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-07-16 17:08:14 UTC | 100-sg-spec | GPT-5 Codex | Framed the operator-approved hero testimonial rail, locale parity, navigation cleanup, motion, and proof contract. | Draft created. | `/101-sg-ready replayglowz-hero-testimonial-rail` |
| 2026-07-16 17:08:14 UTC | 101-sg-ready | GPT-5 Codex | Reviewed user-story fit, scope, accessibility, design-system authority, error behavior, and hosted proof routing. | Ready. | `/102-sg-start replayglowz-hero-testimonial-rail` |
| 2026-07-16 17:16:20 UTC | 102-sg-start | GPT-5 Codex | Replaced hero avatars with one reusable EN/FR testimonial rail, removed standalone sections and dead nav anchors, and added centralized pause/reduced-motion behavior. | Implemented locally. | `/103-sg-verify replayglowz-hero-testimonial-rail` |
| 2026-07-16 17:16:20 UTC | 103-sg-verify | GPT-5 Codex | Passed Astro build, metadata lint, source scope checks, changed-file drift scan, generated-DOM checks, and local desktop/mobile visual preflight; corrected a mobile intrinsic-width overflow found during proof. | Partial: matching Vercel preview proof remains unauthorized and pending. | `/005-sg-ship -> /405-sg-prod -> /108-sg-browser` |
| 2026-07-16 17:16:20 UTC | 006-sg-design | GPT-5 Codex | Routed the approved redesign through spec, readiness, implementation, responsive correction, and local design proof. | Partial: implementation is complete; authoritative hosted visual proof remains. | `/005-sg-ship -> /405-sg-prod -> /108-sg-browser` |

## Current Chantier Flow

| Step | Status | Notes |
|------|--------|-------|
| 100-sg-spec | done | Contract created from the explicit operator decision. |
| 101-sg-ready | ready | No material product decision remains open. |
| 102-sg-start | implemented | EN/FR rail, navigation cleanup, and motion/accessibility behavior are complete. |
| 103-sg-verify | partial | Local checks and visual preflight pass; authoritative preview proof remains required. |
| 005-sg-ship | awaiting authorization | Commit/push is out of current scope. |
