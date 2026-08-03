# Audit Log

🟡 [replayglowz] audit: firebase-admin 14 migration | date: 2026-06-12 | overall: B- | issues: migration applied; backend typecheck passes; 5 moderate transitive advisories remain under `@google-cloud/storage` / `uuid` | scope: backend
🟠 [replayglowz] audit: backend dependency refresh | date: 2026-06-12 | overall: C+ | issues: 0 critical / 0 high / 8 moderate after non-major updates; remaining lane is `firebase-admin` 14.x | scope: backend
🟠 [replayglowz] audit: dependencies monorepo recheck | date: 2026-06-12 | overall: C | issues: 0 critical / 0 high / 10 moderate backend advisories / 3 configuration proof gaps | scope: backend, site, lab
🟠 [replayglowz] audit: app android performance | date: 2026-06-12 | overall: B | issues: 0 critical / 1 high / 2 medium | scope: app android
🟠 [replayglowz] audit: dependencies monorepo | date: 2026-05-31 | overall: C | issues: 0 critical / 2 high / 1 medium / 4 low | scope: app, site, lab
🟢 [replayglowz] audit: dependencies security fixes | date: 2026-05-31 | overall: A- | issues: 0 known vulnerabilities after npm audit and pip-audit | scope: site, lab
🟢 [replayglowz] migration: youtube_player_flutter 9.1.3 to 10.0.1 | date: 2026-05-31 | overall: A- | issues: Flutter analyze passed after API migration | scope: app

| Date       | Scope | Code | Design | Copy | SEO | GTM | Translate | Deps | Perf | Overall | Issues |
|------------|-------|------|--------|------|-----|-----|-----------|------|------|---------|--------|
| 2026-05-10 | Deps  | —    | —      | —    | —   | —   | —         | C    | —    | C       | 0 critical / 0 high / 3 moderate security findings; 5 medium hygiene/config follow-ups |
| 2026-05-11 | Documentation layout | — | — | — | — | — | — | — | — | Pass | Root and subproject ShipGlows docs migrated under `shipglows_data/`; competitor registry created; metadata lint passed |
| 2026-05-11 | Deps: app | — | — | — | — | — | — | B- | — | B- | 0 OSV/Pub advisories; 0 critical / 0 high / 3 medium follow-ups: Clerk beta auth patch, unused codegen deps, Sentry/lints major lanes |
| 2026-05-11 | Deps fix: app | — | — | — | — | — | — | A- | — | A- | Beta Clerk SDKs removed and sign-in disabled; direct deps current; Flutter analyze/build web passed |
| 2026-05-14 | Perf: monorepo | — | — | — | — | — | — | — | A- | A- | 0 critical / 0 high open / 2 medium follow-ups; fixed unused 6.0 MB site payload, global Lenis JS, app playlist-sync waterfall, and eager notes subscription |
| 2026-05-16 | Design: monorepo | — | C | C | — | C | — | — | — | C | 0 critical / 2 high / 3 medium; public site claims exceed product evidence, app theme selector is not wired, and design tokens diverge across site/app |
| 2026-05-25 | Feature gap: TubeFlow Expo -> ReplayGlowz Flutter | C | C | — | — | — | B | — | — | C | Audit traced in `shipglows_data/workflow/audits/2026-05-25-tubeflow-expo-feature-gap.md`; main gaps are feed actions, player state, playlist video actions, channel sync UI, quota safeguards, transcript settings, and i18n parity |
| 2026-06-12 | Design: authority baseline (app + site) | — | C | — | — | — | — | — | — | C | Baseline check captured with `--warn-only`: 510 findings in `app` and 70 findings in `site`; baseline documented in `shipglows_data/technical/design-system-authority.md` |
