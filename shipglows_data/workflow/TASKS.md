# Tasks - replayglows

> Operational task records follow `$SHIPGLOWS_ROOT/skills/references/operational-record-format.md`.

---

## Extension App Parity

🟠 [replayglows] task: Bring the Chrome extension to maximal parity with the Flutter app through a full extension page on the shared Convex backend | status: in_progress | area: ext | spec: shipglows_data/workflow/specs/monorepo/2026-09-15-extension-app-parity.md | evidence: plan validated 2026-09-15 (D1-D4); phase 1 + phase 3 done 2026-09-16 — `src/app/` surface, router, shell, i18n FR/EN, 13 screens via 3 subagents, plugged Convex typed API, typecheck/lint/build:ext green; auth provider stub fail-closed + placeholder Convex URL wired | next: Phase 2 wiring — operator confirms customJwt deployment state (D1) and real `CONVEX_URL`; then implement real auth provider, sign-in/out UX and product gate before YouTube-connect (phase 4) and migration (phase 5)

## Extension Playback

🟢 [replayglows] task: Guide discovery inside the Chrome extension with confirmed milestones, local resume/skip, effective shortcuts and recovery help | status: done | area: ext | ref: shipglows_data/workflow/specs/monorepo/2026-09-05-extension-onboarding.md | evidence: Discovery and playback tests, typecheck/build, packaged failure/recovery scenarios and native popup at 432x510 passed on 2026-09-05 | next: Reload unpacked extension to review; no Web Store publication implied

🟢 [replayglows] task: Reconcile extension product contract, competitor delivery matrix, claims and code-to-doc navigation | status: done | area: docs | ref: shipglows_data/product/ext/product.md | evidence: Scoped metadata, topology and reference checks on 2026-09-05 | next: Update on the next approved playback increment; no public release inferred.

🟢 [replayglows] task: Add universal HTML5 speed controls with shared context, pinned tab exceptions, compact popup and temporary A–B loops linked to YouTube bookmarks | status: done | area: ext | ref: shipglows_data/workflow/specs/monorepo/2026-09-05-extension-universal-playback.md | evidence: 22 automated tests, typecheck, lint, build, multi-origin packaged browser scenarios, public YouTube/W3Schools and native action popup passed | next: Reload the unpacked extension and existing tabs; saved segments and advanced effects remain research candidates

## Audit: Deps

🟢 [replayglows] task: Upgrade `backend/packages/backend` to the latest non-major `convex`, `openai`, and `svix` releases, rerun `npm audit`, and verify Convex backend typecheck/runtime behavior | status: done | area: deps | evidence: `npm install`, `npm audit --json`, `npm run typecheck`
🟢 [replayglows] task: Open a migration lane for `firebase-admin` 14.x so the backend can clear the remaining `uuid` / `google-gax` advisory chain without forcing an unreviewed major jump | status: done | area: deps | evidence: command-scoped `npm_config_min_release_age=0 npm install`, `npm run typecheck`, `npm audit --json`
🟢 [replayglows] task: Add `backend/packages/backend` to `.github/dependabot.yml` and pin its Node/package-manager policy so backend dependency drift is monitored like the site and worker | status: done | area: deps | evidence: `.github/dependabot.yml`, `backend/packages/backend/package.json`
🟢 [replayglows] task: Patch `lab` Starlette advisory GHSA-86qp-5c8j-p5mr by updating the FastAPI/Starlette lock lane and validating worker auth/routing behavior | status: done | area: deps
🟢 [replayglows] task: Patch `site` transitive `devalue` advisory GHSA-77vg-94rm-hx3p through the Astro/Vite dependency lane and rebuild the marketing site | status: done | area: deps
🟢 [replayglows] task: Patch `lab` transitive `idna` advisory CVE-2026-45409 while preserving hash-checked `requirements.lock` installs | status: done | area: deps
🟡 [replayglows] task: Review remaining direct major dependency lane for `record`; transcript-worker ML/tooling refresh is verified | status: todo | area: deps | evidence: `audits/2026-09-05-lab-worker-dependencies.md` | next: sg-engineering deps ReplayGlows record major upgrade lane
🟢 [replayglows] task: Migrate `app` from `youtube_player_flutter` 9.x to 10.x and adapt player API usage | status: done | area: deps
🟢 [replayglows] task: Remove beta auth packages `clerk_flutter` / `clerk_auth` and replace the disabled path with stable Firebase Auth | status: done | area: deps
🟢 [replayglows] task: Remove unused Flutter codegen packages: `riverpod_annotation`, `build_runner`, and `riverpod_generator` | status: done | area: deps
🟢 [replayglows] task: Upgrade direct non-beta dependencies to latest resolvable versions, including `go_router`, `sentry_flutter`, and `flutter_lints` | status: done | area: deps
🟢 [replayglows] task: Remove legacy app/domain fallbacks (`TUBEFLOW_APP_URL`, `TUBEFLOW_WEB_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_SENTRY_DSN`) from app config and OAuth runtime | status: done | area: deps
🟠 [replayglows] task: Validate Firebase Auth, Convex token acceptance, and YouTube OAuth on the deployed Vercel/Convex environment | status: pending | area: prod | next: sg-release verify app

## Documentation Governance

🟢 [replayglows] task: Align root and subproject ShipGlows docs under canonical `shipglows_data/` paths | status: done | area: docs
🟢 [ShipGlows] task: Close local governance spec for ShipGlows skill reporting and proof hardening | status: done | area: workflow | spec: shipglows_data/workflow/specs/shipglows-skill-reporting-and-proof-hardening.md | next: sg-release shipglows-skill-reporting-and-proof-hardening

## Audit: Perf

🟢 [replayglows] task: Enable Android release shrinking in `app/android/app/build.gradle.kts` so dead Java/Kotlin code and unused resources are removed from production artifacts | status: done | area: perf | evidence: `flutter analyze`
🟢 [replayglows] task: Constrain `CachedNetworkImage` decode/cache dimensions in `app/lib/widgets/media/media_thumbnail.dart` to the rendered thumbnail size on device-density screens | status: done | area: perf | evidence: `flutter analyze`
🟠 [replayglows] task: Reduce large filtered-feed fetch pressure in `VideosScreen` where each selected virtual feed currently requests up to 500 entries before merge | status: in_progress | area: perf | evidence: bounded progressive pagination now implemented locally in `VideosScreen` and `VirtualFeedDetailScreen`; `flutter analyze` passed | next: sg-release replayglows-android-feed-pagination-and-virtualization -> sg-release verify app
🟢 [replayglows] task: Remove unused `site/public/professional-headshot-*.png` payloads that were copied into every static build despite having no source references | status: done | area: perf
🟢 [replayglows] task: Remove global `lenis` smooth-scroll dependency and layout script so the Astro site build emits no client JavaScript chunks | status: done | area: perf
🟢 [replayglows] task: Batch `youtube:fetchPlaylistItems` calls in `syncAllPlaylists` instead of waiting for each playlist sync sequentially | status: done | area: perf
🟢 [replayglows] task: Defer the all-notes subscription on `VideosScreen` until the Notes view is active | status: done | area: perf
🟢 [replayglows] task: Gate `PlayScreen` transcript subscriptions to the active Transcript tab and avoid the normal full-library videos subscription during play render | status: done | area: perf
🟢 [replayglows] task: Self-host/subset the Google and Cal Sans font stack to remove remaining render-blocking remote font CSS | status: done | area: perf
🟡 [replayglows] task: Evaluate transcript worker preflight/download duplication if `/transcribe` latency becomes an operational bottleneck | status: todo | area: perf

## Audit: Design

🟢 [replayglows] task: Wire persisted app theme settings into `themeModeProvider` or remove the non-functional selector until the preference changes the UI | status: done | area: design | evidence: `app/lib/app/theme.dart` and `app/lib/main.dart`
🟡 [replayglows] task: Consolidate site/app design tokens for typography, radius, color roles, focus states, and motion so both surfaces feel like one product | status: todo | area: design

## Brand and Legal

🟠 [winglows] task: Select two or three distinctive Glows-family finalists and obtain targeted professional clearance before public launch or permanent platform identifiers | status: in_progress | area: brand-legal | location: Loire-Authion 49250, France | brief: Je cherche un CPI spécialisé en marques internationales pour effectuer une recherche d'antériorités avec avis juridique écrit, puis déposer une marque française ou européenne et organiser son extension internationale via le système de Madrid. | requirements: similarity search, classes 35/41 and conditional 9/42, EUIPO representation, Madrid strategy, itemized professional and official fees | local_options: Cabinet Chaillot Angers; Le Guen et Associés Angers; Legi LC Angers; Me Inès Ferras Angers; free first-level MCTE Angers IP consultation | why_now: domains, public branding, Android package names, and Microsoft Store identity make a later rename costly | next: Complete free screening, then request a bounded clearance quote for the finalists
🟡 [winglows] task: Reserve the cleared brand's core domains, social handles, Android application ID, and Microsoft Store name before first public release | status: todo | area: brand-platform-identity | depends: professional clearance of the selected name | guardrail: do not create permanent store/package identifiers from an uncleared working name | evidence: Google Play package names are unique and permanent; Microsoft Store renames require a new reserved name and submission updates | next: Create a brand identity reservation checklist after clearance
🟡 [winglows] task: Validate the productivity-advice offer with first paid sales before expanding trademark protection internationally | status: todo | area: business-validation | depends: cleared launch name and minimum initial filing strategy | outcome: first paying customers and evidence that the offer merits broader territorial investment | cost_control: defer broad Madrid designations and non-core territories until commercial validation, not the foundational name decision | next: Define and sell the smallest paid productivity-advice offer under the cleared launch brand

## Current Fixes

🟠 [replayglows] task: Fix Feed video snap so slow vertical scroll release visibly aligns to the nearest video in cards, list, and notes views | status: fixed-pending-verify | area: app | bug: BUG-2026-06-01-002 | evidence: `flutter analyze`, `flutter test`, metadata lint | next: sg-bug retest BUG-2026-06-01-002
🟠 [replayglows] task: Stop the watched visibility toggle from refreshing the whole Feed; filter watched videos locally instead | status: fixed-pending-verify | area: app | bug: BUG-2026-06-01-003 | evidence: `flutter analyze`, `flutter test`, metadata lint, `git diff --check`
🟠 [replayglows] task: Keep Feed cards, list, and notes scroll positions synchronized continuously, including near the last videos | status: fixed-pending-verify | area: app | bug: BUG-2026-06-01-004 | evidence: `flutter analyze`, `flutter test`, `git diff --check`; active-video scroll is now limited to explicit Play-to-Feed entry and Feed items highlight the current video | next: sg-bug retest BUG-2026-06-01-004
🟢 [replayglows] task: Close the invisible YouTube control icons report as upstream to ReplayGlows | status: done | area: ext | evidence: operator A/B on 2026-09-16 — icons still invisible after disabling ReplayGlows; current `dist/output-ytb.css` and `dist/content.js` contain no opacity/visibility rule for `.ytp-right-controls` and agent headless Chromium shows those icons computed visible | next: user-side diagnosis of the YouTube 2025-2026 Delhi player variant (opacity source rule, Chrome version, incognito) if upstream tracking is desired
🟠 [replayglows] task: Stop the YouTube stylesheet from injecting global Tailwind preflight and generic utilities that deform the player's left control icons (play/mute offset, shrunken icons, oval volume bubble) | status: fixed-pending-verify | area: ext | evidence: `pnpm build:ext` green, verify-package 7 manifest resources, `dist/output-ytb.css` now contains only scoped extension rules (no `border-width: 0`, no `button`/`svg` element resets, no `.flex`/`.hidden`/`.opacity-0` utilities); `src/styles/styles-youtube.css` cleaned and guarded | next: reload unpacked extension, operator visual check of play/mute icons on a YouTube video

---

## Migration Parity

🟠 [replayglows] task: Reconcile public feature claims with proven ReplayGlows behavior, especially Vimeo/other video URLs, instant search, PDF/plain-text export, and real-time sync | status: pending | area: public-claims | source: `site/src/pages/features.astro`, `site/src/pages/compare.astro`, `shipglows_data/product/app/product.md` | scope: the app currently exposes YouTube workflows and Markdown note export; PDF/plain-text export and broad video URL support are public claims without matching end-to-end proof | outcome: either implement and prove each claim or narrow/remove the unsupported copy before the next public release | next: sg-planning ReplayGlows public feature claim alignment
🟡 [replayglows] task: Decide whether ReplayGlows should expose notes/library search as a complete app workflow or remove the instant-search claim from public surfaces | status: todo | area: app-product | depends: public feature claim alignment | evidence: backend `notes:searchNotes` exists, but no complete Flutter search route/workflow is currently exposed | next: sg-planning ReplayGlows notes and library search
🟡 [replayglows] task: Complete and verify YouTube Core Parity P2, the advanced feature-parity chantier with the former TubeFlow app: channel subscriptions/sync, transcript provider and job/version management, note export/share/copy, and empty-account onboarding | status: todo | area: parity-qa | spec: `shipglows_data/workflow/specs/monorepo/replayglows-youtube-core-parity-priority-2.md` | scope: Markdown export is implemented; PDF export remains explicitly out of scope until a real PDF implementation exists; the remaining question is end-to-end UI and authenticated QA proof, not only backend code presence | evidence: implementation tasks are marked complete but acceptance criteria and `sf-verify` remain pending | next: sg-engineering verify replayglows-youtube-core-parity-priority-2

---

## Backlog

🟡 [replayglows] task: Explore focus-time controls for video feeds so work sessions can stay bounded with reminders, playback caps, or auto-stop after a user-defined watch duration | status: todo | area: product | next: sg-planning ReplayGlows focus-time controls for feed playback
🟡 [replayglows] task: Show per-video watch progress directly in the feed so cards or rows expose the current playback position with a visible progress bar before reopening the video | status: todo | area: app | next: sg-planning ReplayGlows feed watch progress indicators
🟡 [replayglows] task: Define a Learning Behavior Intelligence spec that models how users turn YouTube sessions into reusable learning across watch sessions, timestamped notes, playlists, transcript usage, revisits, and feedback signals | status: in_progress | area: product-data | alias: transcript intelligence | entities: user, video, watch_session, note, timestamp_anchor, playlist, transcript_job, transcript_version, revisit_event, feedback_event | why: the core product promise is structured learning, not generic video consumption | questions: what marks real learning value, what gets revisited, what compounds over time | ref: shipglows_data/workflow/references/replayglows-transcript-intelligence-context.md | spec: shipglows_data/workflow/specs/monorepo/replayglows-learning-behavior-intelligence.md | next: /101-sg-ready replayglows-learning-behavior-intelligence
🟡 [replayglows] task: Define an exploratory analytics workspace for ReplayGlows so product and transcript questions can be filtered, transformed, joined, aggregated, and visualized quickly without committing first to a heavy Python/SQL/BI stack | status: todo | area: exploratory-data | goals: rapid prototypes, internal analysis, low-friction iteration | why: the team needs a fast way to explore learning and transcript patterns before hardening infrastructure | deliverables: analysis surface, source connectors, saved views, lightweight charting flow | next: sg-planning ReplayGlows exploratory analytics workspace
🟡 [replayglows] task: Design activation and retention insights on top of the learning-behavior model so ReplayGlows measures first value through first note, organization, revisit, and sustained learning loops instead of generic app opens | status: todo | area: analytics | depends: learning behavior intelligence spec | outcomes: activation stages, retention cuts, learning-value milestones, leading indicators | why: activation should reflect learning progress, not vanity usage | questions: which early actions predict durable return, where does the learning loop fail | next: sg-planning ReplayGlows learning activation and retention intelligence
🟡 [replayglows] task: Define a product decision-support layer for ReplayGlows so teams can answer which behaviors, workflows, and transcript features deserve investment instead of relying on intuition or generic engagement metrics | status: todo | area: product-analytics | depends: learning behavior intelligence spec | decisions: feature priority, transcript scope, learning-loop ROI, friction hotspots | why: product bets should be guided by observed learning behavior and not only by session volume | next: sg-planning ReplayGlows product decision support
🟡 [replayglows] task: Evaluate transcript impact inside the learning workflow by relating provider choice, cost, latency, transcript consumption, note creation, and revisit behavior before expanding transcript-heavy product claims or investment | status: todo | area: transcript-analytics | depends: learning behavior intelligence spec | hypotheses: transcript helps only when it improves note-taking, retrieval, or revisit behavior | measures: provider cost, provider latency, transcript viewed rate, notes after transcript, revisits after transcript | next: sg-planning ReplayGlows transcript learning impact model
🟡 [replayglows] task: Define the canonical ReplayGlows learning graph joins so watch sessions, notes, playlist membership, transcript versions, and revisit signals can be analyzed without ad hoc query logic per dashboard | status: todo | area: data-model | depends: learning behavior intelligence spec | joins: video->note->revisit, video->playlist->revisit, video->transcript->note/revisit | why: these joins are the backbone for every serious product or GTM insight in this lane | next: sg-planning ReplayGlows learning graph joins
🟡 [replayglows] task: Specify the minimum instrumentation needed to capture learning-value events such as first note, first organization action, transcript viewed, note revisited, and video revisited without polluting the product with low-signal telemetry | status: todo | area: instrumentation | depends: learning behavior intelligence spec | outcomes: event registry, source-of-truth triggers, noise guardrails | why: instrument only the events that answer learning-value and retention questions | next: sg-planning ReplayGlows learning event instrumentation
🟡 [replayglows] task: Define activation stages A0-A5 for ReplayGlows so product decisions can distinguish account creation, first video, first timestamped note, first organization step, first revisit, and first durable learning loop | status: todo | area: activation | depends: learning activation and retention intelligence | outcomes: stage definitions, success thresholds, disqualifying shortcuts | stages: A0 account, A1 first video, A2 first note, A3 first organization, A4 first revisit, A5 durable learning loop | next: sg-planning ReplayGlows activation stages
🟡 [replayglows] task: Build a retention hypothesis pack that tests whether note-taking, organization, revisit behavior, or transcript usage predicts J7/J14/J30 return better than generic session counts | status: todo | area: retention-research | depends: learning activation and retention intelligence | hypotheses: note > video open, revisit > capture, transcript useful only for some segments | why: the goal is to identify retention drivers tied to learning behavior rather than generic activity | next: sg-planning ReplayGlows retention hypothesis pack
🟡 [replayglows] task: Identify the user or content segments where transcript workflows create real learning value versus segments where transcripts add cost or complexity without improving retention, notes, or revisits | status: todo | area: segmentation | depends: transcript learning impact model | segments: language, video length, learning intent, note-taking behavior | why: transcript value is unlikely to be uniform across all users and content types | next: sg-planning ReplayGlows transcript value segmentation
🟡 [replayglows] task: Design internal decision-support dashboards for ReplayGlows so product work can compare transcript providers, learning behaviors, activation drop-offs, and revisit patterns without a heavy separate BI stack | status: todo | area: internal-analytics | depends: learning behavior intelligence spec | dashboards: transcript performance, learning activation funnel, revisit behavior, video learning value | why: internal decisions need fast readable views, not ad hoc manual analysis every time | next: sg-planning ReplayGlows internal learning dashboards

---

## Audit Findings

<!-- Populated by /sf-audit with traffic-first task records when findings become tasks. -->

## Documentation Refresh Follow-up

- Editorial alignment and GTM proof tasks are owned by `shipglows_data/editorial/ROADMAP.md`; mixed product/implementation decisions remain here.
- Review and explicitly declare delivery posture before changing integration branches, protection, or deployment policy. Existing hosted validation mode remains in force.
- Next requested work: refresh dependency inventory and advisories across app, backend, site, ext, and lab before selecting upgrade lanes. Prior dependency audit counts are historical.

## Dependabot Review — 2026-09-04

🟢 [replayglows] task: Integrate reviewed Dependabot updates and compatible SDK/compiler migrations | status: done | area: deps | evidence: PRs #2, #3, #4, #5, #6, #7, #8, #15, #16, #17; shipglows_data/workflow/audits/2026-09-04-dependabot-review.md
🟡 [replayglows] task: Migrate Google Sign-In 7 and verify native Firebase login, cancellation and sign-out | status: todo | area: deps | ref: PR #10 | next: implement singleton initialization and authenticate flow, then validate on Android
🟡 [replayglows] task: Validate record 7 migration on a native target | status: todo | area: deps | ref: PR #11 | next: refresh against Flutter 3.47.1 and test permission, recording and playback
🟢 [replayglows] task: Refresh the Python 3.12 worker hash lock and verify CPU native dependencies, auth and simulated transcription while retaining the OpenAI SDK | status: done | area: deps | evidence: `audits/2026-09-05-lab-worker-dependencies.md`, `lab/test_worker.py`
🟡 [replayglows] task: Migrate the worker to Python 3.14 when its native dependency graph supports it | status: pending | area: deps | ref: PR #13 | evidence: `audits/2026-09-05-lab-worker-dependencies.md` | next: resolve FunASR's NumPy<2 constraint and cp314 native wheels before rebuilding; keep Python 3.12 for now

## Minor Dependency Refresh — 2026-09-05

🟢 [replayglows] task: Refresh non-major backend, site, extension and Flutter dependencies with focused verification | status: done | area: deps | evidence: shipglows_data/workflow/audits/2026-09-05-dependency-refresh.md
🟢 [replayglows] task: Repair existing extension packaging and align its Docker runtime | status: done | area: extension | evidence: output-ytb.css and node_modules/tinykeys/dist/tinykeys.modern.js absent from generated package; Docker uses Node 18 versus declared >=24 | proof: Vite emits manifest assets; isolated Chromium checks pass; Dockerfile aligned to Node 24, image build pending unavailable daemon
🟢 [replayglows] task: Resolve remaining Firebase/Google Storage uuid advisory chain without an unsafe major override or downgrade | status: done | area: deps | evidence: two consumer-scoped uuid 11.1.1 overrides, three compatibility tests pass, npm audit reports zero vulnerabilities | next: remove overrides when patched upstream ranges become available

🟡 [replayglows] task: Validate Android on the Linux VM after commit and push | status: todo | area: android | owner: Diane | depends: intended changes committed and pushed, then matching commit checked out on the VM | evidence: 2026-09-05 local Flutter tests passed 50/50; Strawberry Perl installed and Locale::Maketext::Simple verified, but Android Convex/OpenSSL build rejected Windows-style Perl paths; no APK validated | scope: validate Android on Linux; making the Windows build runner work is not required | next: verify VM Android toolchain and checked-out commit, run Flutter tests and debug APK build, then validate startup and native Convex initialization on an Android device or emulator | proof: record commit SHA, test/build results and APK location; report device runtime proof separately from build success

🟢 [replayglows] task: Verify the extension Node 24 Docker image on Linux | status: done | area: extension | proof: Linux image build, container typecheck/build:ext, six manifest resources and CSS watch rebuild passed | evidence: shipglows_data/workflow/audits/2026-09-05-extension-docker-validation.md

## Extension Canary Functionality — 2026-09-05

🟠 [replayglows] task: Restore and verify extension bookmark workflows in Chrome Canary | status: fixed-pending-verify | area: extension | bug: BUG-2026-09-05-001 | proof: real YouTube CRUD, shortcuts, import/export, SPA and browser restart; five behavioral tests | evidence: shipglows_data/workflow/audits/2026-09-05-extension-canary-functionality.md | next: operator visual acceptance in dedicated Canary profile before final closure
🟢 [replayglows] task: Localize the complete extension UI in French and English with an Automatic/Français/English persisted selector | status: implemented | area: ext | ref: shipglows_data/workflow/specs/monorepo/2026-09-05-extension-bilingual-ui.md | proof: isolated packaged Chromium verified live English popup/options and the native French action popup | next: Reload the unpacked extension in the operator browser and verify both injected locales on a real YouTube video

## Note Editor CSS Regression — 2026-09-16

- [replayglows] Restore the injected note editor after global Tailwind reset removal | status: implemented; operator visual acceptance pending | area: ext | comparison: HEAD 59e3925 | change: scoped border-box, shrinkable input and inline reset buttons in ext/src/styles/styles-youtube.css; preserved existing white rounded rainbow design and host isolation | proof: build:css-ytb and build:ext passed; Chromium fixture invokes actual addBookmark(), reproduces out-of-container buttons before patch, verifies all children inside 220x30 bounds with/without buttons, save via click/Enter, and unchanged host button/SVG computed styles | limitation: fixture is not real YouTube runtime proof; broad design drift scan fails on existing dirty workspace; reload unpacked extension and YouTube for operator acceptance.
- [replayglows] Align bookmark marker center with timeline timestamp | status: fixed-pending-verify | area: ext | bug: BUG-2026-09-16-001 | proof: Chromium before/after geometry, resize, endpoint drag and failed-save rollback; five bookmark tests; CSS and extension builds | next: operator real-YouTube visual acceptance after reload
- [replayglows] Raise bookmark note tooltip above marker | status: implemented; operator visual acceptance pending | area: ext | change: container-relative gap of half marker size (10px), hover bridge preserves pointer access | proof: extension build and Chromium gap/hover-crossing checks passed; marker positioning/drag checks still pass
- [replayglows] Add toggleable YouTube inline speed bar | date: 2026-09-17 | status: implemented; real YouTube visual acceptance pending | area: ext | scope: menu show/hide, container-relative native-controls gap, slider 0.25-4x, presets and favorite using existing playback service, session visibility across SPA navigation | proof: build:ext; scripts/youtube-speedbar-browser.mjs loads packaged extension with real worker/media on routed YouTube fixture and validates popup sync, pin isolation, coalesced slider input, suspension, responsive bounds, hide/show and SPA cleanup | limitation: compact mode hides presets, very narrow gaps hide toolbar; no personal browser reload or live YouTube proof
- [replayglows] Add rightmost pin toggle to inline YouTube speed bar | date: 2026-09-17 | status: implemented; real YouTube visual acceptance pending | area: ext | scope: shared existing session pin, accessible pressed state and bilingual labels, preserved compact layout; top-level YouTube content may pin sender tab only | proof: 23 state/media/bookmark tests, build:ext, packaged browser test confirms pin/unpin, global isolation, external pin sync and SPA persistence; sender spoofed tab ignored, nested frames and lookalike origins rejected | lifecycle: existing session pin clears on tab close/browser or extension restart
- [replayglows] Fix speedbar toggle remaining invisible | date: 2026-09-17 | status: implemented; operator visual acceptance pending | cause: live YouTube left-controls uses flex:1, so group bounding box consumed the apparent empty gap and available width was zero | change: measure visible child control edges, observe child size/style changes, remount detached toolbar on show with dedicated listener cleanup | proof: current live YouTube DOM inspected; packaged fixture updated to actual flex layout and detached-bar regression passes; build:ext passed | limitation: full public interaction attempt interrupted by YouTube consent overlay in isolated profile
- [replayglows] Fix visible but noninteractive YouTube speed bar | date: 2026-09-17 | status: implemented; operator real-YouTube acceptance pending | cause: native modern controls at z-index 59 cover toolbar at 2 | change: toolbar z-index 60; regression fixture includes native stacking and pointer targeting for every visible control, including compact layout and slider click | proof: regression fails before fix for all seven controls; build:ext and packaged browser scenario pass after fix, including speed, favorite, pin and popup sync | limitation: controlled fixture; personal browser extension and YouTube tab still need reload


## Extension speed bar pointer attachment (2026-09-17)

- Implemented the opt-in “Attach pointer to the speed bar” setting in playback options (French/English), persisted locally and disabled by default.
- Hovering the visible YouTube slider acquires pointer tracking without clicking; a 32px retention margin tolerates small excursions. Leaving the margin freezes the last rate; re-entering the slider synchronizes to the new position. Rates remain 0.25–4x in 0.05 steps. Neighboring buttons, blur, hidden bars and suspended controls release attachment.
- Evidence: TypeScript/Vue checks, ESLint, package build/resource verification, 19 playback state/media tests, and packaged isolated Chromium speed-bar scenarios passed. The browser scenario covers settings persistence, hover entry, tolerance, freeze, re-entry, range limits, blur and disabling, alongside existing speed/pin/SPA behavior.
- Limit: browser proof uses a routed YouTube fixture, not the personal Chrome profile or a live YouTube player. Reload `ext/dist` and existing YouTube tabs to use the rebuilt extension; no Web Store publication.


## Extension Alt scrubbing (2026-09-17)

- Added opt-in “Hold Alt to scrub through the video” playback setting (FR/EN), disabled by default; requires pointer attachment.
- Holding Alt while attached pauses and mutes the current finite-duration video, centers a virtual thumb and hides the system pointer. Relative horizontal displacement selects backward/forward seeking with a 10% neutral zone and quadratic acceleration up to 30 video seconds per second. Seeking stays between zero and duration; existing A–B repetition is cleared.
- Release, pointer escape, blur, suspension, option disable, hidden controls and teardown stop the animation and restore mute and prior playing/paused state. Volume and playback-rate settings are not changed by scrubbing. Navigation/source replacement does not resume a different video. Another key or mouse press exits the mode before other controls act.
- Proof: typecheck, ESLint (only two pre-existing declaration warnings), production extension package verification, 20 playback tests and isolated packaged Chromium fixture tests passed. Browser coverage includes setting persistence, neutral/reverse/forward, release, paused/playing/muted restoration, blur, bounds, pointer escape, suspension and opt-out.
- Delivery: rebuilt ext/dist locally; reload extension and YouTube tab. Live YouTube/personal Chrome acceptance remains separate from routed fixture proof. No remote publication.


## Global speed bar visibility (2026-09-17)

- Show/hide now persists in local extension storage and propagates to all existing YouTube tabs. New tabs, reloads and SPA navigation reuse the saved preference. Initial reads cannot overwrite a newer storage event.
- Proof: extension build and package verification passed; isolated Chromium with routed YouTube fixtures passed cross-tab show/hide, new-tab visibility, reload and SPA persistence, plus existing pointer and Alt-scrubbing scenarios. Personal Chrome/live YouTube proof remains separate.


## Alt scrubbing latency and unexpected detachment repair (2026-09-17)

- User reported spontaneous exit while Alt remained held and near-real-time seeking even at maximum displacement.
- Reproduced with the packaged extension in isolated Chromium: a simulated two-hour video and 250ms decoder seek latency rewound only 1.8 seconds in 1.5 seconds. Setting the host controls to opacity zero/hidden ended the active gesture.
- Repair: accumulate an independent target on every animation frame and commit at 10Hz, flushing the target on release. The speed curve preserves a neutral zone and fine center control while reaching max(30, duration/6) video seconds per second at either extreme. Horizontal overshoot clamps instead of detaching; geometry remains stable during a gesture.
- Keep the active player's controls visible during scrubbing; same-video query updates and delayed loop-clear errors do not silently cancel Alt. Source/video replacement, release, vertical escape, suspension and blur retain cleanup.
- Initial retest passed all packaged browser scenarios, including 1740 seconds travelled in 1.5 seconds, both bounds of a simulated two-hour video, sustained auto-hide, horizontal overshoot and state restoration. Long-video/decoder proof uses a controlled media model inside the extension isolated world; it is not live YouTube decoding evidence. Personal Chrome acceptance remains pending.

- Final retest after compact rate-label and neutral-flush refinements: typecheck, package build, 20 playback tests and complete packaged browser scenario passed; lint has only the two pre-existing declaration warnings. Sustained gesture additionally survives a loop-clear response timeout and a same-video timestamp query update. Final measured maximum rewind: 1728 video seconds in 1.5 seconds; beginning and end reached within the bounded tests. No commit or remote publication.


## Four video hover controls (2026-09-17)

- Added opt-in, persisted French/English playback option for four equal vertical YouTube video zones: volume (5%), video-only brightness (5%, 25–200%), shared/pinned playback speed (configured step, 0.25–4x), and position (5 seconds). Wheel up increases/advances; down decreases/rewinds.
- All bands have a 6% color tint, current-value labels and active-zone outline. Non-interactive overlays preserve native video clicks. Controls/menus and modified wheel gestures retain native behavior. Leaving resets partial wheel accumulation; blur, navigation and disabling clean up. Brightness preserves the original filter and restores it when disabled or disposed.
- Proof: packaged Chromium routed YouTube scenario passed options persistence, all four controls, direction, seek bound, exit cancellation, toolbar exclusion and filter restoration; existing pointer, global visibility and Alt scrub scenarios passed. 21 playback state/media tests passed. Extension build/package verification passed. Personal Chrome/live YouTube remains a separate verification surface.


## Split level charts and cursor state (2026-09-17)

- Replaced text badges with full-width bottom-anchored level fills (20%), upper tint (6%) and immediate 2px color thresholds. Fill height eases over 80ms; visible levels track actual media values each animation frame, without rounding to control steps. Speed maps 0.25–4x to 0–100%; brightness maps 25–200% to 0–100%; position maps currentTime/duration.
- First wheel event hides the cursor and other zones. After 500ms without wheel, the cursor returns. After 1500ms without pointer/wheel activity, all levels fade over 200ms. Exiting, disabling, blur and cleanup immediately restore the cursor and clear timers/animation frames.
- Proof: extension build/package verification and packaged Chromium suite passed, including real-value fractional height, 2px threshold, hidden neighboring zones, first sub-step wheel cursor hiding, idle fade, cursor restoration and exit cleanup. Screenshot inspected on routed YouTube fixture; personal Chrome/live YouTube remains unverified.

## Extension options autosave — 2026-09-17

- Done: playback options save automatically on changes, including shortcut capture/reset; removed the save button, serialized writes, retained validation and disabled editing until settings load.
- Proof: extension type-check, focused ESLint, build/package verification and packaged Chromium playback scenarios passed, including automatic save and persistence after options reload. Personal browser extension reload remains required.


## Attached speed pointer visibility (2026-09-17)

- The player hides the system pointer during ordinary speed-bar attachment, using the red range thumb as the visual pointer. Existing detachment/blur/suspension/teardown cleanup restores the cursor. Attached controls stay visible, including during host auto-hide.
- The generated extension package passes build/resource verification; the browser scenario checks computed cursor visibility on attachment, escape and blur.
