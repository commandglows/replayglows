---
artifact: content_map
metadata_schema_version: "1.0"
artifact_version: "0.1.1"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-04"
status: "draft"
source_skill: sf-docs
scope: content-map
owner: "Diane"
confidence: "medium"
risk_level: "medium"
content_surfaces:
  - repository_docs
  - landing_pages
  - pricing_pages
  - comparison_pages
  - trust_pages
  - blog
  - editorial_governance
  - app_docs
  - worker_docs
security_impact: "unknown"
docs_impact: "yes"
evidence:
  - "README.md"
  - "site/src/pages"
  - "site/src/content/blog"
  - "app/README.md"
  - "lab/README.md"
linked_artifacts:
  - "shipglows_data/editorial/README.md"
  - "shipglows_data/editorial/public-surface-map.md"
  - "shipglows_data/editorial/page-intent-map.md"
  - "shipglows_data/editorial/claim-register.md"
depends_on:
  - "shipglows_data/business/business.md"
  - "shipglows_data/product/product.md"
  - "shipglows_data/branding/branding.md"
  - "shipglows_data/gtm/gtm.md"
supersedes: []
next_review: "2026-06-10"
next_step: "sg-docs editorial audit"
---

# Content Map

## Purpose

This file maps ReplayGlows content surfaces at monorepo level and routes public-content changes through the editorial governance layer.

## Content Surfaces

| Surface | Canonical path | Purpose | Source of truth | Update when |
| --- | --- | --- | --- | --- |
| Root README | `README.md` | Monorepo orientation and deployment model | Repository layout and deployment state | Subproject layout or deployment ownership changes. |
| App docs | `app/README.md` and app contracts | Product and implementation truth for the Flutter app | `shipglows_data/product/app/product.md`, `shipglows_data/technical/app/architecture.md` | App behavior, auth, OAuth, Convex, deployment, or env changes. |
| Public site pages | `site/src/pages/**` | Acquisition, product education, pricing, comparison, legal/trust | Business, product, brand, GTM contracts | Public claims, CTA, route intent, pricing, or legal/trust changes. |
| Blog | `site/src/content/blog/**` | Editorial education and SEO content | Astro schema, page intent, claim register | Blog content, collection schema, topic strategy, or claims change. |
| Worker docs | `lab/README.md` and worker contracts | Transcript worker setup, deployment, API, operations | `shipglows_data/product/lab/product.md`, `shipglows_data/technical/lab/architecture.md` | Worker API, env, provider, queue, health, or deployment changes. |
| Editorial governance | `shipglows_data/editorial/**` | Public surface map, claim register, page intent, update gate, runtime schema policy | This content map and contracts | Public surfaces, claims, routes, or content schemas change. |

## Backlog Ownership

`shipglows_data/editorial/ROADMAP.md` owns public-content work. Mixed product/implementation decisions remain in `shipglows_data/workflow/TASKS.md` and link to the editorial outcome. A historical claim audit is not a current verification of published pages.

## Semantic Architecture

| Cluster | Pillar page | Supporting pages | Target intent | Status |
| --- | --- | --- | --- | --- |
| Video learning workflow | `site/src/pages/index.astro` | `features.astro`, blog posts | Product education and conversion | live |
| Pricing and offer | `site/src/pages/pricing.astro` | `compare.astro` | Commercial evaluation | live |
| Trust and policy | `privacy.astro`, `terms.astro` | Root and app README references | Trust and compliance basics | live |
| Learning content | `blog/index.astro` | `src/content/blog/*.md` | SEO and education | live |

## Cross-Surface Update Rules

| Trigger | Check these surfaces |
| --- | --- |
| App feature changes | App README, app contracts, site claims, pricing/feature copy, changelog. |
| OAuth/auth changes | App README, app architecture, site trust copy if affected. |
| Transcript worker changes | Worker README, worker contracts, app docs if backend integration behavior changes. |
| Public claim changes | Claim register, page intent map, target page, business/product/brand/GTM contracts. |
| Blog/article changes | Astro content schema policy, blog route, claim register if claims are sensitive. |
