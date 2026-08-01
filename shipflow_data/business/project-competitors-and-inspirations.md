---
artifact: competitive_intelligence
metadata_schema_version: "1.0"
artifact_version: "1.1.0"
project: "replayglowz"
created: "2026-05-11"
updated: "2026-07-08"
status: reviewed
source_skill: sf-veille
scope: "project-competitors-and-inspirations"
owner: "Diane"
confidence: medium
risk_level: medium
security_impact: none
docs_impact: yes
evidence:
  - "Initial competitor and inspiration triage captured in legacy root concurrent.md."
  - "ReplayGlowz product context targets video learning workflows, notes, playlists, transcripts, and summaries."
  - "TubeFlow public site reviewed on 2026-07-05: https://tubeflow.ai/."
  - "Fresh public-source review on 2026-07-08 for https://saaszilla.co/deals/tubeonai/."
depends_on:
  - artifact: "shipflow_data/product/product.md"
    artifact_version: "1.0.0"
    required_status: reviewed
  - artifact: "shipflow_data/gtm/gtm.md"
    artifact_version: "1.0.0"
    required_status: reviewed
supersedes:
  - "concurrent.md"
next_review: "2026-06-11"
next_step: "/sf-market-study tubeflow"
target_projects:
  - tubeflow
  - tubeflow_ai
reference_categories:
  - direct_competitor
  - indirect_competitor
  - product_inspiration
  - workflow_inspiration
source_policy: "Track public sources only; do not copy private positioning, paid assets, credentials, or non-public customer data."
---

# Concurrents et inspirations — ReplayGlowz

TODO

https://appsumo.com/products/bookster/

## Lecture projet

ReplayGlowz cible les workflows d'apprentissage vidéo: notes horodatées, playlists, transcriptions et synthèses. Les liens utiles concernent audio/voix, résumé, automatisation créateur et intelligence de contenu.

## Liens prioritaires

| Lien | Type | Score | Usage concret |
|---|---:|:---:|---|
| [FlowSpeech](https://betalist.com/startups/flowspeech) | Inspiration audio | 8/10 | Transformer des notes ou résumés en voix naturelle; utile pour mode révision audio. |
| [TubeFlow](https://tubeflow.ai/) | Concurrent direct recherche vidéo | 8/10 | À surveiller de près: workspace YouTube orienté recherche avec notes, playlists et résumés IA, très proche du coeur d'usage ReplayGlowz. |
| [Igloo](https://betalist.com/startups/igloo-2) | Concurrent indirect créateur | 7/10 | Inspiration pour convertir un contenu long en reels courts. |
| [AutoKap](https://betalist.com/startups/autokap) | Inspiration assets | 7/10 | Générer automatiquement captures, snippets ou visuels de release à partir de vidéos/notes. |
| [Kurate](https://betalist.com/startups/kurate) | Inspiration curation | 6/10 | Pattern de ranking de contenus techniques/scientifiques; utile pour recommander vidéos ou sources. |
| [TonimusAI](https://betalist.com/startups/tonimusai) | Concurrent indirect creator analytics | 6/10 | À surveiller pour analytics créateur et suivi de revenus/performances. |
| [Spec27](https://betalist.com/startups/spec27) | Qualité agent | 6/10 | Pertinent pour valider les agents de résumé/transcription contre des specs. |

## À surveiller

| Lien | Type | Score | Pourquoi |
|---|---:|:---:|---|
| [MemoryPlugin](https://betalist.com/startups/memoryplugin) | Mémoire IA | 5/10 | Mémoire cross-outils intéressante si ReplayGlowz veut personnaliser apprentissage et rappels. |
| [Web-Analytics.ai](https://web-analytics.ai/) | Reporting | 5/10 | Résumés simples de l'usage produit pour comprendre les flux d'apprentissage. |
| [TubeOnAI](https://saaszilla.co/deals/tubeonai/) | Concurrent indirect / inspiration | 6/10 | Résumé et repurposing de vidéos, podcasts et articles, plus proche d'un assistant de synthèse que d'un outil de prise de notes learning. À surveiller pour les workflows d'extraction et de génération de contenu à partir de sources vidéo. |
