---
artifact: test_checklist
metadata_schema_version: "1.0"
artifact_version: "0.1.0"
project: "replayglowz"
created: "2026-06-12"
updated: "2026-06-12"
status: "draft"
source_skill: "101-sf-ready"
scope: "replayglowz-android-feed-pagination-and-virtualization"
owner: "Diane"
confidence: "high"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "replayglowz_app"
  - "replayglowz_backend"
depends_on:
  - artifact: "shipflow_data/workflow/specs/replayglowz-android-feed-pagination-and-virtualization.md"
    artifact_version: "1.0.0"
    required_status: "ready"
supersedes: []
evidence: []
next_step: "/102-sf-start replayglowz-android-feed-pagination-and-virtualization"
---

# Test Checklist: Android Feed Pagination and Virtualization

## Preconditions

- Android device or emulator available with Android 12+ and ReplayGlowz release-compatible environment.
- Authenticated QA account with ReplayGlowz active.
- A test account/library containing at least one very large feed and at least one additional feed for multi-feed merge.
- Prior build artifacts accessible: one baseline artifact for comparison and one candidate with paging/shrink changes.
- Access to app debug logs (for non-blocking page error and pagination diagnostics).

## Scenarios

| Scenario | Steps | Expected Outcome | Verdict |
|----------|-------|------------------|---------|
| RGAF-001 | Open Videos screen with no filter; perform fast 30-second scroll. | First render is quick; list remains lazy (`ListView`/sliver builder); no full feed freeze. | NOT_RUN |
| RGAF-002 | Open one large selected feed; inspect first load payload/network page request size. | Initial request is bounded to a default small page and does not request a 500+ eager union. | NOT_RUN |
| RGAF-003 | Select multiple feeds and trigger combined view. | First visible window is bounded and progressively merged; UI stays interactive while next pages load. | NOT_RUN |
| RGAF-004 | Scroll to near list tail repeatedly. | Next page is loaded once per page boundary, appended cleanly without resetting existing rows. | NOT_RUN |
| RGAF-005 | Force a page load failure (network throttle or mock fault). | Existing content remains visible; error indicator is non-blocking with local retry; no full-screen blocking overlay. | NOT_RUN |
| RGAF-006 | In a large feed, toggle watched filter and active-video highlight during scrolling. | Behaviors remain stable and cursor/window state is not corrupted. | NOT_RUN |
| RGAF-007 | Build Android release artifact and run with user path. | Release keeps shrinking enabled (`minifyEnabled`, `shrinkResources`); app installs and starts without missing-resource/runtime crash. | NOT_RUN |
| RGAF-008 | Scroll thumbnails-rich lists for >2 minutes. | Thumbnail decode/cache does not decode original large images for small rows; no major memory growth tied to full-size decode. | NOT_RUN |

## Evidence Expected

- Automated evidence
  - `(cd replayglowz_app && flutter analyze)` PASS/FAIL.
  - `(cd replayglowz_app && flutter test <targeted feed/pagination tests>)` PASS/FAIL.
  - `(cd replayglowz_backend/packages/backend && npm run typecheck)` PASS/FAIL if query contract changed.
  - `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENT.md shipflow_data`
- Manual Android/device evidence
  - `flutter build apk --release` or `flutter build appbundle --release` succeeds with shrink settings confirmed in output.
  - Before/after shrink metrics recorded in release artifacts.
  - Device-side QA log/screenshots for scenarios RGAF-001 to RGAF-008.
- Exception handling evidence
  - If RGAF-005 is not reproducible in this run, report explicit reproducibility reason and the retry path state (PASS/NOT_RUN/BLOCKED).
  - If release regression is observed under one ABI/variant only, log the failing variant and keep rules tested.

## Verdict Summary

- PASS: scenario validated with expected behavior and evidence.
- FAIL: scenario validated and failed; include blocker owner and reproduction.
- BLOCKED: environment/tooling prevented test execution.
- NOT_RUN: scenario not yet executed in this phase.

| Scenario | Verdict |
|----------|---------|
| RGAF-001 | NOT_RUN |
| RGAF-002 | NOT_RUN |
| RGAF-003 | NOT_RUN |
| RGAF-004 | NOT_RUN |
| RGAF-005 | NOT_RUN |
| RGAF-006 | NOT_RUN |
| RGAF-007 | NOT_RUN |
| RGAF-008 | NOT_RUN |
