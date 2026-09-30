---
artifact: editorial_content_context
metadata_schema_version: "1.0"
artifact_version: "0.2.0"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-05"
status: "draft"
source_skill: sf-docs
scope: "page-intent"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
security_impact: "unknown"
docs_impact: "yes"
content_surfaces:
  - "public_site"
  - "blog"
claim_register: "shipglows_data/editorial/claim-register.md"
page_intent: "shipglows_data/editorial/page-intent-map.md"
linked_systems:
  - "site/src/pages"
depends_on:
  - "shipglows_data/editorial/public-surface-map.md"
supersedes: []
evidence:
  - "site/src/pages"
next_review: "2026-06-10"
next_step: "sg-docs editorial audit"
---

# Page Intent Map

| Route | Job | Primary CTA | Source contract | Shared-file risk |
| --- | --- | --- | --- | --- |
| `/` | Explain ReplayGlows and convert qualified users to the app. | App signup/open app. | Business, product, brand, GTM. | Shared components and config can affect multiple pages. |
| `/fr/` | French-language version of the main offer. | App signup/open app. | Brand language rules and English source intent. | Translation drift with `/`. |
| `/features` | Explain current product capabilities. | App CTA. | App product and implementation truth. | Feature claims can outrun shipped behavior. |
| `/pricing` | Present offer and pricing path. | Purchase/signup CTA. | Business and GTM contracts. | Pricing mismatch is high risk. |
| `/compare` | Position ReplayGlows against alternative workflows. | App/pricing CTA. | Product and GTM contracts. | Competitive claims require proof and careful wording. |
| `/privacy` | Explain privacy/data handling. | Trust/support path. | Legal/data handling truth. | Legal copy must not be changed casually. |
| `/terms` | Explain terms of use. | Trust/support path. | Legal/business terms. | Legal copy must not be changed casually. |
| `/blog` | Route readers to educational articles. | Article links and app CTA. | Content map and blog policy. | Article metadata/schema changes affect RSS and pages. |
| `/blog/[slug]` | Deliver a specific article. | App CTA or related reading. | Article frontmatter, claim register, schema policy. | Runtime content schema is strict. |

| `/extension`, `/fr/extension` | Explain standalone extension scope and availability. | Read the guide. | Extension product contract. | Avoid implying app sync or Store availability. |
| `/extension/guide`, `/fr/extension/guide` | Teach controls, persistence and recovery. | Worked review article. | Extension protocol and product contract. | Both locales must track behavior changes. |
| `/blog/review-a-video-passage`, `/fr/blog/reviser-un-passage-video` | Demonstrate bookmark-to-loop review. | Extension guide. | Extension product contract. | Paired article identity and claims must stay aligned. |
