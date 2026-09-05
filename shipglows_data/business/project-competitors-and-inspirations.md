---
artifact: competitive_intelligence
metadata_schema_version: "1.0"
artifact_version: "1.6.0"
project: "replayglows"
created: "2026-05-11"
updated: "2026-09-05"
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
  - "ReplayGlows product context targets video learning workflows, notes, playlists, transcripts, and summaries."
  - "TubeFlow public site reviewed on 2026-07-05: https://tubeflow.ai/."
  - "Fresh public-source review on 2026-07-08 for https://saaszilla.co/deals/tubeonai/."
  - "Video Speed Controller Chrome Web Store and official GitHub README inspected on 2026-09-05; compared with current local app, extension and backend source."
  - "Video Speed Control and Global Speed official listings and developer documentation inspected on 2026-09-05; operator supplied a popup visual reference and requested extension playback controls."
depends_on:
  - artifact: "shipglows_data/product/product.md"
    artifact_version: "1.0.0"
    required_status: reviewed
  - artifact: "shipglows_data/gtm/gtm.md"
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

# Concurrents et inspirations — ReplayGlows

TODO

https://appsumo.com/products/bookster/

## Lecture projet

ReplayGlows cible les workflows d'apprentissage vidéo: notes horodatées, playlists, transcriptions et synthèses. Les liens utiles concernent audio/voix, résumé, automatisation créateur et intelligence de contenu.

## Liens prioritaires

| Lien | Type | Score | Usage concret |
|---|---:|:---:|---|
| [FlowSpeech](https://betalist.com/startups/flowspeech) | Inspiration audio | 8/10 | Transformer des notes ou résumés en voix naturelle; utile pour mode révision audio. |
| [TubeFlow](https://tubeflow.ai/) | Concurrent direct recherche vidéo | 8/10 | À surveiller de près: workspace YouTube orienté recherche avec notes, playlists et résumés IA, très proche du coeur d'usage ReplayGlows. |
| [Igloo](https://betalist.com/startups/igloo-2) | Concurrent indirect créateur | 7/10 | Inspiration pour convertir un contenu long en reels courts. |
| [AutoKap](https://betalist.com/startups/autokap) | Inspiration assets | 7/10 | Générer automatiquement captures, snippets ou visuels de release à partir de vidéos/notes. |
| [Kurate](https://betalist.com/startups/kurate) | Inspiration curation | 6/10 | Pattern de ranking de contenus techniques/scientifiques; utile pour recommander vidéos ou sources. |
| [TonimusAI](https://betalist.com/startups/tonimusai) | Concurrent indirect creator analytics | 6/10 | À surveiller pour analytics créateur et suivi de revenus/performances. |
| [Spec27](https://betalist.com/startups/spec27) | Qualité agent | 6/10 | Pertinent pour valider les agents de résumé/transcription contre des specs. |

## À surveiller

| Lien | Type | Score | Pourquoi |
|---|---:|:---:|---|
| [MemoryPlugin](https://betalist.com/startups/memoryplugin) | Mémoire IA | 5/10 | Mémoire cross-outils intéressante si ReplayGlows veut personnaliser apprentissage et rappels. |
| [Web-Analytics.ai](https://web-analytics.ai/) | Reporting | 5/10 | Résumés simples de l'usage produit pour comprendre les flux d'apprentissage. |
| [TubeOnAI](https://saaszilla.co/deals/tubeonai/) | Concurrent indirect / inspiration | 6/10 | Résumé et repurposing de vidéos, podcasts et articles, plus proche d'un assistant de synthèse que d'un outil de prise de notes learning. À surveiller pour les workflows d'extraction et de génération de contenu à partir de sources vidéo. |

## Video Speed Controller — competitive review, 2026-09-05

| Reference | Category | Status | Scope |
| --- | --- | --- | --- |
| [Video Speed Controller](https://chromewebstore.google.com/detail/video-speed-controller/nffaoalbilbmmfgbnbgppjihopabppdk) | Competitor: playback controls | candidate | User-supplied reference; overlaps with ReplayGlows playback and video review. |

### Evidence and limits

Owner: Diane. Outcome: record the competitor and compare its capabilities with ReplayGlows, without changing product direction or public claims. The duplicated input URL was normalized to one reference.

Sources checked on 2026-09-05:

- [Chrome Web Store listing](https://chromewebstore.google.com/detail/video-speed-controller/nffaoalbilbmmfgbnbgppjihopabppdk): version 0.11.1, updated August 15, 2026; 3 million users, 4.5/5 from approximately 4.5K ratings. These are a dated store snapshot, not active-user or retention measurements.
- [Official repository README](https://github.com/igrigorik/videospeed): additional controls and MIT license. The current repository branch may differ from the published package; README-only capabilities below are not asserted as verified in version 0.11.1.
- Local ReplayGlows code and product contracts cited below. No extension installation, browser comparison, native runtime check or production test was performed. Implementation evidence is not a delivery guarantee. Existing local changes in `ext/contentscript.js` were read and preserved; findings describe the working tree.

### Capability comparison

| Capability | Video Speed Controller | ReplayGlows evidence | Assessment |
| --- | --- | --- | --- |
| Media coverage | Store advertises HTML5 video/audio across websites and local files. | App centers on YouTube; extension centers on YouTube bookmarks. | Competitor has broader advertised playback coverage; site compatibility remains untested. |
| Speed range | Store: 0.07–16x with configurable increments. | App `play_screen.dart`: 0.25–2x bounds, seven preset rates, plus delta adjustment. No dedicated speed controller found in the extension paths inspected. | Clear configuration gap; supported player rates must be checked before expanding app bounds. |
| Skip backward/forward | Store: keyboard skips of 10 seconds. | App binds left/right arrows to minus/plus 10 seconds. | Basic functional overlap, not measured UX parity. |
| Custom keyboard actions | Store: remappable keys, modifiers and speed toggles. | App playback bindings are fixed in `_shortcutBindings`; extension options customize five bookmark actions. | ReplayGlows customization exists for bookmarks, not equivalent speed controls. |
| Remember speed / domain defaults | Store documents both. | App playback rate is held in controller state; cross-session speed persistence and domain rules were not established by the inspected code. | Evidence gap in ReplayGlows; do not equate in-memory state with durable preferences. |
| Movable controller | Store documents repositioning. README additionally documents custom CSS and per-site disabling. | App controls and extension bookmark UI; no equivalent universal speed overlay identified. | Competitor advantage for adapting controls to existing players. |
| Resist player speed resets | Official README documents reapplying the selected speed. | No equivalent policy established in this review. | Candidate robustness pattern; README claim, not tested release behavior. |
| Return to a marked moment | README documents a marker and jump-back commands. | App timestamped notes; extension multiple saved bookmarks with notes, navigation and deletion. | Both support revisiting a moment; ReplayGlows supports a richer persistent collection. |
| Repeat video | Not established by reviewed sources. | App end handling checks `loopEnabled` and restarts playback. | ReplayGlows whole-video repeat is evidenced; A–B segment looping is not established here. |
| Notes and portable records | Rich notes and exports not documented in reviewed sources. | Extension options implement Markdown/JSON export and validated JSON import; app has timestamped notes. | ReplayGlows strength for retaining learning material. No app-extension synchronization claim. |
| Playlists, feeds and viewing continuity | Not documented in reviewed sources. | App product contract and routes cover playlists, feeds and history. | ReplayGlows extends beyond playback into organization. |
| Transcripts / AI | Not documented in reviewed sources. | Transcript handling appears in app/backend; `notes.ts` schedules `internal.openai.summary`, implemented in `openai.ts`. | Code exists, but end-to-end availability was not checked. Older product contracts still restrict AI promises; do not advertise mature AI on this evidence. |

### Interpretation and recommendations

Video Speed Controller is a strong specialist substitute when the user's need is simply to adjust playback on an existing website. Its distribution makes playback customization a relevant benchmark, but does not establish demand for paid learning workflows.

ReplayGlows has a broader learning workflow: annotate moments, retain several references, export notes, and organize videos. The useful distinction is persistent learning context. A claim that ReplayGlows already provides better speed controls would not be supported.

Suggested order for a later product decision, not an approved implementation plan:

1. Evaluate configurable playback shortcuts, a preferred-speed toggle, and durable speed preferences. These address concrete friction within the existing YouTube scope.
2. Verify which rates each supported player accepts before considering a wider speed range; a 16x control alone does not prove usable playback.
3. Test both extensions together on YouTube for keyboard, focus and overlay conflicts. Complementary use is plausible, but compatibility is unverified.
4. Treat arbitrary-site HTML5 coverage and domain rules as a separate scope decision rather than a small parity fix.

Follow-up on 2026-09-05: the operator requested playback controls in the Chrome extension, including a compact card at the bottom of the popup. At this stage, coverage and feature boundaries were still open; the later all-sites decision and delivered scope below supersede that open question. The research itself does not authorize public publication.

### Local source anchors

- `app/lib/screens/play/play_screen.dart`: `_playbackRates`, `_shortcutBindings`, `_normalizedPlaybackRate`, `_adjustPlaybackRate`, transcript rendering and `loopEnabled` end handling.
- `app/lib/providers/providers.dart`: playback state and `setPlaybackRate`.
- `ext/src/options/Options.vue`: configurable bookmark shortcuts, Markdown/JSON export and JSON import.
- `ext/contentscript.js`: YouTube bookmark capture and timestamp navigation; pre-existing uncommitted changes preserved.
- `backend/packages/backend/convex/notes.ts` and `openai.ts`: summary scheduling and implementation, not production availability proof.
- `shipglows_data/product/app/product.md` and `shipglows_data/product/product.md`: workflow positioning and public-claim boundaries; older than this source review.

## Additional playback competitors — 2026-09-05

| Reference | Category | Status | Scope |
| --- | --- | --- | --- |
| [Video Speed Control](https://chromewebstore.google.com/detail/video-speed-control/aejbmaihhlajphnlcdbojkjbdckkfdki) | Competitor: playback controls | candidate | Popup-based HTML5 video speed adjustment. |
| [Global Speed](https://chromewebstore.google.com/detail/global-speed-video-speed/jpbjcnkcffbooppibceonlgknpkniiff) | Competitor: playback controls | candidate | Automatic video/audio speed management and advanced media commands. |

### Verified public-source observations

Video Speed Control's [store listing](https://chromewebstore.google.com/detail/video-speed-control/aejbmaihhlajphnlcdbojkjbdckkfdki) shows version 0.1.6, updated June 22, 2026, 30,000 users and 4.9/5 from 66 ratings. It advertises 0.07–16x, a toolbar popup and dark mode. Applying speed requires a user action, repeated after page reload. The [developer FAQ](https://mybrowseraddon.com/video-speed-control.html) confirms video-only coverage, reset to 1x and a slider. The FAQ describes a green checkmark whereas the store says Play: the application step is corroborated, its current icon is not verified.

Global Speed's [store listing](https://chromewebstore.google.com/detail/global-speed-video-speed/jpbjcnkcffbooppibceonlgknpkniiff) shows version 3.4.117, updated August 23, 2026, 700,000 users and 4.7/5 from 842 ratings. It advertises automatic video/audio speed, URL rules, customizable presets and shortcuts, temporary acceleration while holding a key, frame stepping, global media commands, visual filters, pitch shifting and volume amplification up to 600%. Its [official repository](https://github.com/polywock/globalSpeed) corroborates the main categories and labels audio effects Chromium-only. The inspected overview does not specify a numerical speed range; do not copy another extension's range onto this product.

These are dated publisher claims and store counts, not hands-on compatibility, privacy audits, retention data or proof that every advertised streaming service works. Both listings declare no data collection; that declaration was not independently audited.

### Expanded comparison and design implications

| Dimension | Video Speed Controller | Video Speed Control | Global Speed | Current ReplayGlows extension |
| --- | --- | --- | --- | --- |
| Primary model | Fine playback controls and overlay | Explicit adjustment from popup | Automatic media policy and advanced controls | Persistent YouTube bookmarks and notes |
| Video/audio | Both advertised | Video only | Both advertised | YouTube video context |
| Apply after reload | Optional remembered speed advertised | Manual action required again | Automatic application advertised | No dedicated speed feature identified |
| Site-specific policy | Domain defaults and disabling documented | Not established | URL rules documented | Not implemented in inspected extension paths |
| Configurable commands | Extensive speed/media bindings | Not established | Extensive media bindings and trigger modes | Five bookmark commands |
| Compact controls | User image provides a speed-card reference; exact installed build not identified | Popup is the documented primary control surface | Configurable presets documented | Existing popup lists notes; speed card requested |
| Advanced effects | Not established in reviewed material | Not established | Frame stepping, video filters and audio processing | Not identified |
| Learning records | Simple return marker documented | Not documented | Notes/export not documented in reviewed material | Multiple notes, timestamp navigation, JSON/Markdown export and JSON import |

The three references support distinct lessons: a small discoverable control surface, durable personalized playback, and advanced media tooling. Global Speed is the strongest functional benchmark of these sources for advanced media control; Video Speed Control demonstrates a simpler popup flow but adds an explicit apply step. This is an analytical judgment, not a measured usability ranking.

### Operator visual reference and proposed first increment

The supplied screenshot shows a centered current rate (`1.00x`), horizontal slider, four presets (`0.5`, `1`, `1.5`, `2`) with an active state, and a settings icon. It is visual evidence only: it does not establish persistence, media coverage, slider bounds or hidden settings. The operator specifically requests this kind of compact card at the bottom of ReplayGlows' popup.

A proposed first increment is a ReplayGlows-styled speed card, a remembered shared base speed, optional pinned-tab speed overrides, favorite rate and configurable speed shortcuts. A global change applies to supported unpinned tabs; a pinned tab uses its own context. The displayed rate and its scope should be explicit, unavailable-video states should be clear, and shortcuts should avoid text inputs and existing bookmark commands. Durable preference storage and live propagation across tabs are separate implementation requirements.

Historical scope proposal (superseded by the approved multisite implementation below): the pre-implementation manifest granted only `https://www.youtube.com/*`. General HTML5 support would change host access and supported media behavior; it is not implied by copying the card. Recommended initial boundary is YouTube, followed by an explicit cross-site decision. Filters, audio amplification and pitch shifting are separate product work, not required to deliver the requested card.

Required implementation evidence: real packaged-extension popup rendering; actual rate changes; refresh and YouTube SPA navigation; reopening the popup; no-video and disconnected content-script states; keyboard/input safety; and bookmark regression checks. Existing uncommitted bookmark changes must be preserved. No implementation or runtime validation is claimed by this research update.

### Global Speed demo transcript follow-up

On 2026-09-05, the English caption track of [Global Speed - Demo](https://www.youtube.com/watch?v=5x8Kg8ahxjM) was retrieved and read. This is caption evidence, not visual inspection or testing of the current release. Publication date and demonstrated version were not established; exact default keys and browser restrictions may have changed.

Additional capabilities described by the demo:

| Time | Demonstrated behavior described in captions | ReplayGlows opportunity |
| --- | --- | --- |
| [00:10](https://www.youtube.com/watch?v=5x8Kg8ahxjM&t=10s) | One shared context applies a base speed across tabs. Pinning excludes a tab from that shared context so it can use a specific speed. | Shared speed by default, explicit pinned exceptions. Operator clarified this model on 2026-09-05; it is not independent settings per tab by default or Chrome's native pinned-tab feature. |
| [00:43](https://www.youtube.com/watch?v=5x8Kg8ahxjM&t=43s) | Frame stepping. | Precise review of demonstrations and gestures. |
| [00:57](https://www.youtube.com/watch?v=5x8Kg8ahxjM&t=57s) | Set and revisit a position marker. | Connect playback controls with existing saved timestamps. |
| [01:12](https://www.youtube.com/watch?v=5x8Kg8ahxjM&t=72s) | A–B segment repeat; a shortcut or seeking outside the segment clears it. | High-value learning candidate: repeat a passage around a note, with visible bounds and an exit control. |
| [01:39](https://www.youtube.com/watch?v=5x8Kg8ahxjM&t=99s) | Media target selection, including another tab; default selection uses media duration. | Make the controlled video explicit, especially if broader media support is approved. |
| [02:08](https://www.youtube.com/watch?v=5x8Kg8ahxjM&t=128s) | A modifier enables finer filter adjustments. | Consider a fine-adjustment interaction for speed; adapting this to speed is our proposal, not a claim about the demo. |
| [02:41](https://www.youtube.com/watch?v=5x8Kg8ahxjM&t=161s) | Scaling, rotation and video/page filters. | Secondary accessibility or inspection candidates; keep separate from the compact speed card. |
| [03:39](https://www.youtube.com/watch?v=5x8Kg8ahxjM&t=219s) | Audio effects and tab capture workflows. | Separate technical and permission assessment; do not promise the demo's fullscreen workaround on current Chrome without fresh verification. |
| [05:04](https://www.youtube.com/watch?v=5x8Kg8ahxjM&t=304s) | Suspend controls; rules can disable selected shortcuts or assign speeds by URL. | Provide an easy suspension control and protect text entry; URL policies depend on the chosen site scope. |

Updated recommendation: keep the compact popup card as the primary interface, with a shared base speed and pinned-tab exceptions, then prioritize A–B repeat integrated with timestamps and temporary speed changes. Place advanced controls in settings or a secondary panel. Audio processing and broad visual filters offer less direct value for the current note-taking workflow. These are research candidates, not an approved expanded implementation scope. The then-pending scope decision was subsequently resolved in favor of multisite HTML5 playback; see the delivery status below.

### Feature opportunity matrix connected to existing workflows

Operator input on 2026-09-05 establishes the intended shared-context interpretation and supports developing this feature matrix. Rows below are proposals, not delivered features or a frozen implementation plan. Existing extension features and app-only capabilities remain distinct.

| Candidate | Existing anchor | Connected user workflow | Design or implementation boundary |
| --- | --- | --- | --- |
| Shared base speed with pinned exceptions | Extension popup and local settings | Set the usual listening pace once; pin a particular tab to review slowly while other supported tabs keep the base speed. | Show Global/Pinned scope beside the rate. Proposal: unpin immediately rejoins the current base speed. Pin lifetime across navigation, closure and browser restart remains to specify. |
| Compact speed card | Popup bookmark list and options entry | Adjust speed while consulting saved moments, with slider, presets, reset and settings access. | Keep the card at the bottom and accessible when the bookmark list is long; display actual playback state. |
| A–B repeat from timestamps | Saved timestamp bookmarks and previous/next navigation | Use two bookmarks as bounds, or set an end after an existing bookmark, then repeat the passage. | Temporary looping can reuse timestamps; saving a segment requires a separate data-format decision. App whole-video repeat is not existing extension A–B support. |
| Note-linked review speed | Timestamped notes | Revisit a difficult passage more slowly. | A new proposal: optional speed associated with a note, distinct from the competitor's demonstrated marker. Define restoration of the global or pinned rate after review. |
| Temporary acceleration or slowdown | Configurable bookmark shortcuts | Hold a key to scan or listen carefully, then return to the effective speed on release. | Avoid input and shortcut conflicts; restore on lost focus or navigation as well as key release. |
| Frame stepping with note capture | Add bookmark at current position | Inspect a gesture and annotate the relevant moment. | Verify achievable seeking precision on the supported player; do not promise frame-exact behavior from a nominal time increment. |
| Unified shortcut settings and suspension | Five configurable bookmark actions in extension options | Configure playback and note capture together; suspend commands when they interfere. | Clear action groups, conflict feedback and text-input protection. Site rules are separate from tab pinning. |
| Explicit media target | Current YouTube player integration | Ensure commands and new notes refer to the intended media. | Most valuable with multiple media or cross-tab control; do not confuse media selection with speed-context pinning. |
| Portable review records | JSON/Markdown export and validated JSON import | Retain learning context when moving saved notes. | If saved loops or note-specific rates are adopted, version and validate their representation while accepting old bookmark records. Tab IDs are transient, not portable learning data. |

Suggested grouping: playback foundation (card, shared speed, pinning, shortcuts); learning integration (A–B, note-linked pace, precise inspection); optional broader media tools (cross-site rules, target selection, filters and audio effects). These groups originally organized discussion without committing implementation order or expanding permissions.

### Current Delivery Matrix — 2026-09-05

The preceding comparison and proposal tables preserve the pre-implementation research snapshot. This matrix is the current status; the canonical behavior and limits are in `shipglows_data/product/ext/product.md`.

| Research opportunity | Current delivery | Connection or remaining boundary |
| --- | --- | --- |
| Shared base speed and pinned exceptions | Implemented, verified | One default context; unpin rejoins current base. Pins last for the tab/session, including navigation and worker restart. |
| Compact speed card, presets and favorite | Implemented, verified | Bottom popup card next to the existing YouTube bookmark workflow. |
| Multisite HTML5 video/audio | Implemented, verified on bounded fixtures and public pages | HTTP/HTTPS access; not a guarantee for every player. Notes remain YouTube-specific. |
| A–B repeat linked to timestamps | Temporary loops implemented, verified | Current positions or existing YouTube bookmark pairs; saved segments remain research. |
| Temporary acceleration/slowdown | Held acceleration implemented, verified | Release restores context; a separate configurable held slowdown is not implemented. |
| Unified shortcut settings and suspension | Implemented, verified | Input safety and collisions with bookmark commands checked. |
| Note-linked review speed and frame stepping | Research only | Requires a later behavior and persistence decision. |
| Explicit media target | Automatic targeting implemented | Manual selection remains research; pinning controls speed context, not media choice. |
| Portable review records | Existing bookmark portability preserved | New loop/rate fields are not included in exported records. |
| URL rules, audio and visual effects | Research only | No approved implementation batch. |

### Implementation decision following research

The operator subsequently approved development and explicitly chose all sites. The owning spec is `shipglows_data/workflow/specs/monorepo/2026-09-05-extension-universal-playback.md`. Its first increment covers HTTP/HTTPS HTML5 playback, shared speed with session-scoped pinned tabs, popup card, favorite/configurable commands, temporary boost, suspension and temporary A–B repetition using current positions or existing YouTube bookmark pairs. Research rows above remain dated pre-implementation comparisons. Persisted segments, note-specific speed, frame stepping, URL rules, manual media selection and audio/visual effects are not part of this first implementation; do not present the full opportunity matrix as delivered functionality. Current proof belongs to the spec.
