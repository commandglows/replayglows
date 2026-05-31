# Audit Log

🟠 [replayglowz] audit: dependencies monorepo | date: 2026-05-31 | overall: C | issues: 0 critical / 2 high / 1 medium / 4 low | scope: replayglowz_app, replayglowz_site, replayglowz_lab
🟢 [replayglowz] audit: dependencies security fixes | date: 2026-05-31 | overall: A- | issues: 0 known vulnerabilities after npm audit and pip-audit | scope: replayglowz_site, replayglowz_lab

| Date       | Scope | Code | Design | Copy | SEO | GTM | Translate | Deps | Perf | Overall | Issues |
|------------|-------|------|--------|------|-----|-----|-----------|------|------|---------|--------|
| 2026-05-10 | Deps  | —    | —      | —    | —   | —   | —         | C    | —    | C       | 0 critical / 0 high / 3 moderate security findings; 5 medium hygiene/config follow-ups |
| 2026-05-11 | Documentation layout | — | — | — | — | — | — | — | — | Pass | Root and subproject ShipFlow docs migrated under `shipflow_data/`; competitor registry created; metadata lint passed |
| 2026-05-11 | Deps: replayglowz_app | — | — | — | — | — | — | B- | — | B- | 0 OSV/Pub advisories; 0 critical / 0 high / 3 medium follow-ups: Clerk beta auth patch, unused codegen deps, Sentry/lints major lanes |
| 2026-05-11 | Deps fix: replayglowz_app | — | — | — | — | — | — | A- | — | A- | Beta Clerk SDKs removed and sign-in disabled; direct deps current; Flutter analyze/build web passed |
| 2026-05-14 | Perf: monorepo | — | — | — | — | — | — | — | A- | A- | 0 critical / 0 high open / 2 medium follow-ups; fixed unused 6.0 MB site payload, global Lenis JS, app playlist-sync waterfall, and eager notes subscription |
| 2026-05-16 | Design: monorepo | — | C | C | — | C | — | — | — | C | 0 critical / 2 high / 3 medium; public site claims exceed product evidence, app theme selector is not wired, and design tokens diverge across site/app |
| 2026-05-25 | Feature gap: TubeFlow Expo -> ReplayGlowz Flutter | C | C | — | — | — | B | — | — | C | Audit traced in `shipflow_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md`; main gaps are feed actions, player state, playlist video actions, channel sync UI, quota safeguards, transcript settings, and i18n parity |
