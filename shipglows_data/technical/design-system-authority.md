---
artifact: design_system_authority
metadata_schema_version: "1.0"
artifact_version: "1.1.0"
project: "replayglows"
created: "2026-06-12"
updated: "2026-08-05"
status: "draft"
source_skill: 300-sf-docs
scope: design-system-authority
owner: "Diane"
confidence: "high"
risk_level: "high"
security_impact: "no"
docs_impact: "yes"
supersedes: []
content_surfaces:
  - "app"
  - "site"
  - "ext"
linked_systems:
  - "app/lib/app/theme.dart"
  - "app/lib/utils/color_utils.dart"
  - "site/src/styles/global.css"
  - "site/src/layouts/Layout.astro"
  - "ext/src/styles/styles.css"
  - "shipglows_data/branding/branding.md"
  - "shipglows_data/branding/branding.md"
depends_on:
  - artifact: "shipglows_data/branding/branding.md"
    artifact_version: "1.0.0"
    required_status: "reviewed"
  - artifact: "shipglows_data/branding/branding.md"
    artifact_version: "1.0.0"
    required_status: "reviewed"
evidence:
  - "Code scan: `app/lib/app/theme.dart` is the explicit Flutter theme token surface."
  - "Code scan: `site/src/styles/global.css` is the centralized token source for the site."
  - "Site typography and global layout container entrypoints route through `site/src/styles/global.css` + `src/layouts/Layout.astro`."
  - "Baseline drift check: `python3 /home/claude/shipglows/tools/design_system_drift_check.py --root /home/claude/replayglows/app --format markdown --warn-only --max-findings 5000` found 510 findings."
  - "Baseline drift check: `python3 /home/claude/shipglows/tools/design_system_drift_check.py --root /home/claude/replayglows/site --format markdown --warn-only --max-findings 5000` found 70 findings."
  - "2026-08-05: App token authority expanded in `app/lib/app/theme.dart` with spacing, radii, typography, elevation, motion, breakpoints, and accessible size roles; current app drift scan remains 515 candidates pending widget migration."
- "2026-08-05: App screens and shared widgets migrated to consume the canonical token groups or Material theme roles; the full app drift scan now reports 0 findings, with Flutter analysis and 49 tests passing."
next_review: "2026-07-12"
next_step: "run 503-sf-audit-design-tokens replayglows"
---

# ReplayGlows Design-System Authority

## 1) Canonical token sources

### App (Flutter)
- Primary source: `app/lib/app/theme.dart`
- Theme-mode mapping and component defaults in the same file (`AppColors`, `ThemeData light`, `ThemeData dark`).
- Color and palette exceptions are allowed only via `app/lib/utils/color_utils.dart` when color is user-configurable runtime data.

### Site (Astro + CSS/Tailwind utility layer)
- Primary source: `site/src/styles/global.css` (`:root` variables, `@theme inline`, and utility classes).
- App shell and brand context in `site/src/layouts/Layout.astro`.

### Extension (Vue + Tailwind CSS)
- Primary source: `ext/src/styles/styles.css` (`:root` ReplayGlows extension tokens and shared component classes).
- Popup and options surfaces consume the extension token layer; YouTube-injected legacy styles remain a separate migration scope.

## 2) Governance rule

Any change introducing or modifying **colors, fonts, spacing, radii, shadows, transitions, durations, or viewport/layout constants** must be expressed through the canonical files above first.

The project must not introduce new visual literals directly in feature-level screens/components or local page styles without first adding/using a token value that resolves back to the canonical sources.

## 3) Token map

### App
- Colors: `AppColors.*`
- Typography: `AppTypography.*` and `TextTheme` generated in `_buildTextTheme(...)`
- Spacing: `AppSpacing.*`
- Shapes: `AppRadii.*`
- Elevation/opacity: `AppElevation.*`
- Motion: `AppMotion.*`
- Responsive thresholds: `AppBreakpoints.*`
- Accessible control/icon sizes: `AppSizes.*`
- New app visual constants must be added to these token groups before screen/widget consumption.

### Site
- Palette: `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--destructive`, `--border`, `--input`, `--ring`, `--radius*`
- Typography: `--font-sans`, `--font-cal-sans`, `--font-instrument-sans`
- Surface/spacing/motion constants: define once under `:root` in `global.css` and consume via variable indirection or token aliases.

## 4) Mandatory guardrails

1. No new hard-coded:
   - hex/`Color(...)`/`oklch(...)` literals in production UI.
   - hard-coded px/rem/em/dvh/vw/vh numeric values in layout/spacing/font/shadow tokens.
   - arbitrary Tailwind bracket utilities for visuals (`w-[...]`, `max-w-[...]`, custom widths/heights, arbitrary color values) outside `global.css`.
   - inline styles for animation parameters unless values map to token variables.
2. No non-authorized forked typography definitions in feature components.
3. No ad-hoc visual branches at component level (`if` blocks choosing raw `Color(...)`, `SizedBox`, sizes) where token branches already exist in shared theme.

## 5) Exception register (must be approved before merge)

- `app/lib/utils/color_utils.dart`: user-provided playlist/feed colors are persisted as user data and are intentionally outside the shared design palette.
- Media thumbnails, skeleton placeholders, charts, waveforms, and bounded player panels may retain named intrinsic dimensions when those values encode media ratios, data visualization geometry, or platform layout contracts rather than reusable visual styling.
- YouTube iframe polling, pagination, debounce values, gesture thresholds, and player overlay black/white contrast values are behavioral or media-platform contracts, not design animation or palette tokens.
- `site/dist/**` and generated build outputs: excluded from canonical design source.
- Legacy inlined logo SVG icon fills (`#18181b`) are legacy assets pending centralization.
- `site/src/styles/global.css` contains animation presets (durations, bezier curves, delays); these are foundational primitives and part of the canonical source.

## 6) Change process

1. Add token(s) to canonical source first.
2. Use tokens in the component/template.
3. Run baseline checks:
   - `python3 /home/claude/shipglows/tools/design_system_drift_check.py --root /home/claude/replayglows/app --max-findings 5000`
   - `python3 /home/claude/shipglows/tools/design_system_drift_check.py --root /home/claude/replayglows/site --max-findings 5000`
4. If checks show new findings outside explicit exceptions, block merge.

## 7) Success criteria

- Any style-related PR can be traced to one of the canonical files above.
- New production UI does not add raw visual literals.
- Any new exception is documented in this artifact before merge.
