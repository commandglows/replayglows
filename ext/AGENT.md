# AGENTS.md - ReplayGlows Chrome Extension

This document provides essential information for AI agents working with the ReplayGlows Chrome extension codebase.

## Project Overview

**Project Type**: Chrome Extension (Manifest V3)  
**Purpose**: YouTube video bookmarking with notes and timestamps  
**Tech Stack**: Vue 3, TypeScript, Vite, TailwindCSS  
**Language**: Primarily French codebase with English configuration files

---

## Essential Commands

### Development Commands

```bash
# Full development mode with CSS watchers + Vite build
pnpm dev

# Type checking (TypeScript + Vue)
pnpm type-check

# Linting with auto-fix
pnpm lint

# Build CSS for main styles
pnpm build:css

# Build CSS for YouTube-specific styles  
pnpm build:css-ytb

# Watch mode for main CSS
pnpm watch:css

# Watch mode for YouTube CSS
pnpm watch:css-ytb
```

### Build Commands

```bash
# Full extension build (recommended for distribution)
pnpm build:ext

# Standard Vite build only
pnpm build
```

**Important Build Notes**:
- Output directory: `./dist`
- The build creates multiple entry points for Chrome extension contexts
- CSS files are output at dist root: `output.css` and `output-ytb.css`
- Background and content scripts are output at dist root with specific names required by manifest.json

---

## Project Structure

```
ext/
├── src/
│   ├── App.vue              # Root Vue component
│   ├── main.ts              # Vue application entry point
│   ├── env.d.ts             # TypeScript environment declarations
│   ├── shims-vue.d.ts       # Vue type shims
│   ├── background/
│   │   └── background.ts    # Service worker entry point (TypeScript)
│   ├── content/
│   │   └── content.ts       # Content script entry point (TypeScript)
│   ├── popup/
│   │   ├── index.html       # Extension popup UI (800x600)
│   │   └── Popup.vue        # Popup Vue component
│   ├── options/
│   │   ├── options.html     # Options page
│   │   ├── options.ts       # Options page TypeScript
│   │   └── Options.vue      # Options page Vue component
│   ├── components/
│   │   └── Example.vue      # Example component
│   ├── styles/
│   │   ├── styles.css       # Main Tailwind CSS source
│   │   └── styles-youtube.css  # YouTube-specific styles
│   └── types/
│       └── settings.ts      # TypeScript type definitions
├── public/
│   └── manifest.json        # Chrome extension manifest (v3)
├── manifest.json            # Empty (legacy)
├── background.js            # Legacy background script (JavaScript, heavily commented)
├── contentscript.js         # Legacy content script (JavaScript, main YouTube integration)
├── contentscriptiframe.js   # Legacy iframe content script
├── vite.config.ts           # Vite build configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.cjs       # PostCSS configuration
├── .eslintrc.cjs            # ESLint configuration
└── .prettierrc.json         # Prettier configuration
```

---

## Architecture Overview

### Chrome Extension Components (Manifest V3)

1. **Service Worker** (`src/background/background.ts`)
   - Handles extension lifecycle events
   - Manages bookmark data storage/retrieval
   - Routes messages between components
   - Exports/imports bookmark data

2. **Content Script** (`src/content/content.ts`)
   - Injected into YouTube video pages
   - Manages bookmark UI on video player
   - Handles keyboard shortcuts
   - Communicates with service worker

3. **Popup** (`src/popup/Popup.vue`)
   - 800x600px extension popup UI
   - Lists saved bookmarks across videos with timestamp links, editing and deletion
   - Provides bookmark management interface

4. **Options Page** (`src/options/Options.vue`)
   - User preferences and settings
   - Keyboard shortcut customization
   - Export/import functionality

### Data Flow

- **Storage**: Chrome Storage API (local)
- **Messages**: chrome.runtime.onMessage for component communication
- **State**: Vue 3 reactive state; background reads persisted records for every queued operation

---

## Code Patterns & Conventions

### TypeScript Usage

- **Strict mode**: Enabled
- **Types**: Chrome Extension API types included (`@types/chrome`)
- **Path aliases**: Use `@/` for imports from `src/`
- **Vue + TypeScript**: Composition API with `<script setup lang="ts">`

### Vue 3 Patterns

```vue
<!-- Standard component structure -->
<script setup lang="ts">
import { ref } from 'vue'

const bookmarks = ref([])
</script>

<template>
  <div class="p-4">
    <!-- Tailwind CSS classes -->
  </div>
</template>
```

### Message Passing Pattern

```typescript
// Sending messages
chrome.runtime.sendMessage({ action: 'getBookmarks', data: ... })

// Receiving messages (background)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(request.action) {
    case 'getBookmarks':
      // Handle request
      sendResponse({ data: ... })
  }
  return true // Indicates async response
})
```

### CSS / Styling

- **Framework**: TailwindCSS
- **Two CSS outputs**: Main styles and YouTube-specific styles
- **Custom color**: `yellow: #ffc82c` (defined in tailwind.config.js)
- **Content configuration**: Tailwind scans `src/**/*.{html,js,ts,vue}`

---

## Configuration Files

### Vite Configuration (vite.config.ts)

**Key Points**:
- Multi-entry build for Chrome extension contexts
- Custom rollup output naming for manifest compatibility
- Background/content scripts output at dist root
- CSS file names preserved for manifest references
- Path alias: `@` → `./src`

### TypeScript Configuration (tsconfig.json)

**Key Points**:
- Target: ESNext
- Strict mode enabled
- Vue JSX preservation
- Chrome types included
- No emit (type checking only)

### ESLint Configuration (.eslintrc.cjs)

**Key Points**:
- Vue 3 + TypeScript recommended rules
- Web extension environment enabled
- Multi-word component names allowed
- No-explicit-any set to warn

### Manifest.json

**Permissions**: storage, tabs, commands, notifications  
**Host Permissions**: https://www.youtube.com/*  
**Action**: 800x600px popup at `src/popup/index.html`  
**Content Script**: Injected on YouTube watch pages with `output-ytb.css`  
**Options**: Available at `src/options/options.html`

---

## Important Gotchas & Patterns

### 1. Chrome Extension Manifest V3 Requirements

- Service worker must be at root level (not in subdirectory)
- Content scripts must have specific names referenced in manifest
- CSS files must be output with exact names for manifest references

### 2. Build Process

**Correct build order**:
```bash
pnpm build:ext
# Equivalent full build and manifest-resource verification:
pnpm build
# Recheck an existing package:
pnpm verify:package
```

**Why**: Vite emits `output.css`, `output-ytb.css`, and the Tinykeys ESM compatibility asset into its bundle, after cleaning the destination. The same asset plugin runs in watch mode. Do not generate CSS before a separate Vite clean build. The final verifier rejects missing resources declared by the manifest.

### 3. Legacy JavaScript Files

- `contentscript.js` remains the maintained YouTube integration and is bundled by `src/content/content.ts`.
- `background.js` is historical and is not executed by the package.
- `src/background/background.ts` owns serialized, validated storage operations; `src/bookmarks.ts` owns shared normalization.
- `src/main.ts` mounts `src/popup/Popup.vue`; options and popup are active Vue surfaces.
- The remaining migration concerns the legacy content implementation and its styles, not disconnected runtime entry points.

### 4. Language Split

- **Configuration files**: English
- **Source code comments**: French (legacy JS), minimal English (new TS/Vue)
- **Variable/function names**: Mix of French and English
- **UI text**: French

### 5. YouTube SPA Handling

The content script must handle YouTube's single-page application navigation:
- Reset state on page navigation
- Re-query DOM elements after dynamic changes
- Wait for video player availability

### 6. Bookmark Data Structure

```typescript
interface Bookmark {
  url: string;           // Video URL (canonical, no query params except v)
  time: number;          // Timestamp in seconds
  formattedTime: string; // Human-readable timestamp
  note?: string;         // Optional user note
  title?: string;        // Video title
}
```

**Storage format**:
- `bookmarks`: Flat array of all bookmarks
- `groupedBookmarks`: Bookmarks organized by video URL with metadata

### 7. Keyboard Shortcuts (from prez.md)

- `ALT+B`: Add bookmark
- `ALT+D`: Delete bookmark  
- `ALT+Q`: Quick bookmark
- `ALT+1`: Previous bookmark
- `ALT+2`: Next bookmark

**Customizable**: Users can modify shortcuts in options

---

## Testing & Quality Assurance

### Type Checking
```bash
pnpm type-check
```
Runs both TypeScript compiler and Vue type checker (vue-tsc).

### Linting
```bash
pnpm lint
```
ESLint with auto-fix for Vue/JS/TS files. Checks:
- Vue 3 best practices
- TypeScript recommendations
- General code quality

### Manual Testing

To test the extension:
1. Run `pnpm build:ext`
2. Load `dist/` folder as unpacked extension in Chrome
3. Navigate to YouTube video page
4. Test bookmark functionality

**Test scenarios**:
- Add/delete bookmarks on video
- Navigate with keyboard shortcuts
- Verify popup displays bookmarks correctly
- Check options page functionality
- Test export/import features

---

## Development Workflow

### Recommended Workflow

1. **Before making changes**:
   ```bash
   pnpm type-check
   pnpm lint
   ```

2. **During development**:
   ```bash
   pnpm dev  # Runs CSS watchers + Vite build watcher
   ```

3. **Before committing**:
   ```bash
   pnpm type-check
   pnpm lint
   pnpm build:ext  # Verify full build works
   ```

### File Modification Priorities

When working on this codebase:
1. Check if functionality exists in legacy JS files first
2. Prefer modifying TypeScript/Vue files when possible
3. Maintain compatibility with existing storage format
4. Preserve French UI text unless specifically changing it
5. Add TypeScript interfaces for new data structures

---

## Codebase Migration Status

This is a **partially migrated** codebase:

✅ **Migrated**:
- Build system (Vite, TypeScript)
- Vue 3 component structure (minimal implementation)
- TypeScript configuration
- Modern development tooling (ESLint, Prettier, TailwindCSS)

⚠️ **In Progress**:
- Content script remains JavaScript, actively bundled through its TypeScript entry point.
- Legacy YouTube-injected styles remain outside the Vue token migration.
- Background storage and Vue popup/options functionality are connected; broader feature redesign is not part of this repair.

📝 **Legacy Implementation**:
- Main bookmark logic is in `background.js` and `contentscript.js`
- Extensive French comments and variable names
- Traditional JavaScript patterns (no modules, global state)

---

## Additional Resources

- **Prez.md**: Feature overview and benefits (French)
- **Roadmap.md**: Migration plan from JS to TypeScript/Vue
- **Chrome Extension Documentation**: https://developer.chrome.com/docs/extensions/
- **Vue 3 Documentation**: https://vuejs.org/guide/
- **TailwindCSS**: https://tailwindcss.com/docs

---

## Notes for Future Contributors

1. **Respect the migration**: Continue moving toward TypeScript/Vue while maintaining backward compatibility
2. **Preserve functionality**: Retain existing behavior and storage compatibility; legacy code is not assumed defect-free or exhaustively validated
3. **Add types gradually**: When modifying JS files, consider creating TypeScript interfaces
4. **Test thoroughly**: Bookmark functionality is complex; verify all scenarios work after changes
5. **Document in English**: Configuration and new code should use English for broader accessibility
6. **Chrome APIs are async**: Always handle promises and use proper async/await patterns

---

## Quick Reference - Common Tasks

### Add a new bookmark field

1. Update TypeScript interface (if migrated) in `src/types/settings.ts`
2. Modify storage logic in `background.js` (BMBackground object)
3. Update UI components (`Popup.vue`, `Options.vue`)
4. Update export/import functions if needed

### Modify build output

1. Edit `vite.config.ts` rollupOptions
2. Ensure manifest.json references are updated
3. Test with `pnpm build:ext`

### Debug extension

1. Background script: Chrome Extensions page → Service Worker link
2. Content script: DevTools on YouTube page
3. Popup: Right-click popup → Inspect

### Add new keyboard shortcut

1. Update `contentscript.js` setupHotkeys() function
2. Document in prez.md
3. Add customization option in `Options.vue`

---

**Last Updated**: Based on codebase state as of latest git commit analysis

## Monorepo Conventions

Read the root `AGENT.md` and `shipglows_data/technical/operating-conventions.md`. This document owns extension-specific behavior; the root corpus owns shared governance. Use the generated unpacked extension directory and browser extension manager for runtime validation. A Vite page alone does not prove extension contexts or permissions.

## Packaging and Dependency Maintenance (2026-09-05)

Node 24 and pnpm 11.24.0 own extension tooling. The Dockerfile installs the frozen pnpm lock and runs the build watcher; it does not serve a website. Its image build still requires a running Linux Docker daemon. Dependabot covers both npm and Docker in `/ext`.

The package was loaded into an isolated Chromium profile: service worker, popup and options rendered, the content script injected on a mocked YouTube page, and the packaged Tinykeys export loaded. This is packaging proof, not validation of the unfinished legacy bookmark migration or real YouTube interactions.

Docker follow-up (2026-09-05): Linux/amd64 image construction, container typecheck/build:ext, all six manifest resources and a CSS-triggered watch rebuild passed on Docker 29.7.2 with Node 24.20.0 and pnpm 11.24.0. See shipglows_data/workflow/audits/2026-09-05-extension-docker-validation.md. This does not establish real YouTube behavior or host bind-mount notifications.

## Bookmark Runtime and Canary Validation (2026-09-05)

The content bundle activates the existing JavaScript YouTube integration. A TypeScript MV3 worker serializes bookmark read/modify/write requests, validates URL/time/note boundaries and persists both flat records and derived groups; no worker-lifetime cache owns data. The Vue popup lists all saved bookmarks and supports timestamp navigation, note editing and deletion. Options control shortcuts, display preferences and JSON/Markdown export. JSON replacement validates the complete file before mutation and asks for confirmation.

Canonical records retain `url`, `time` (including zero), `formattedTime`, `note` and optional `title`. Historical options records using `videoId`/`timestamp` normalize on reads/import without a destructive migration. Content, popup and worker share this compatibility boundary through worker reads or the domain helper. Duplicate timestamps report an error rather than silently discarding a new note. A delayed save never closes a newer editor after navigation.

Content matching now includes the already-permitted `https://www.youtube.com/*` host so navigation from the homepage activates on watch pages. There is no new dependency or permission grant. Every package must retain classic self-contained content.js, with no top-level ESM import.

Focused tests: `node --test scripts/bookmarks.test.mjs` (five behavior tests), `pnpm type-check`, `pnpm exec eslint src`, and `pnpm build:ext`. Local Chrome Canary 155 checks on a public YouTube video demonstrated zero-second note creation, shortcuts, literal-text note editing, timestamp seeking and reload persistence. Further scenario evidence belongs to `shipglows_data/workflow/bugs/BUG-2026-09-05-001.md` and the dated Canary audit. These are scoped local runtime proofs, not exhaustive YouTube coverage or operator acceptance of the rendered UI.
