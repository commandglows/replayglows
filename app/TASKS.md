# Tasks - app

> Operational task records follow `/home/claude/shipglows/skills/references/operational-record-format.md`.

---

## Audit: Perf

🟢 [app] task: Enable Android release shrinking in `android/app/build.gradle.kts` so dead Java/Kotlin code and unused resources are removed from production artifacts | status: done | area: perf | evidence: `flutter analyze`
🟢 [app] task: Constrain `CachedNetworkImage` decode/cache dimensions in `lib/widgets/media/media_thumbnail.dart` to the rendered thumbnail size on device-density screens | status: done | area: perf | evidence: `flutter analyze`
🟡 [app] task: Reduce large filtered-feed fetch pressure in `lib/screens/videos/videos_screen.dart` where each selected virtual feed currently requests up to 500 entries before merge | status: todo | area: perf | next: /100-sf-spec ReplayGlowz Android feed pagination and virtualization
