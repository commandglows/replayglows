/**
 * Vite Configuration for ReplayGlows Chrome Extension
 * 
 * This configuration handles the build process for a Chrome extension
 * with multiple entry points:
 * - Popup: The main extension popup UI
 * - Options: Settings page for user preferences
 * - Background: Service worker for extension lifecycle
 * - Content: Script injected into YouTube pages
 * 
 * Uses rollup options to customize output file names and structure
 * to match Chrome extension requirements.
 */
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const tailwindCli = resolve(dirname(require.resolve('@tailwindcss/cli/package.json')), 'dist/index.mjs')

// Emit manifest resources through Vite so clean builds and watch rebuilds retain them.
const extensionAssets = (): Plugin => ({
  name: 'extension-manifest-assets',
  buildStart() {
    this.addWatchFile(resolve(import.meta.dirname, 'src/styles/styles.css'))
    this.addWatchFile(resolve(import.meta.dirname, 'src/styles/styles-youtube.css'))
  },
  generateBundle() {
    for (const [input, fileName] of [
      ['src/styles/styles.css', 'output.css'],
      ['src/styles/styles-youtube.css', 'output-ytb.css'],
    ]) {
      const source = execFileSync(process.execPath, [tailwindCli, '-i', input], {
        cwd: import.meta.dirname,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'inherit'],
      })
      this.emitFile({ type: 'asset', fileName, source })
    }
    // Preserve the existing public URL while sourcing Tinykeys' current ESM export.
    this.emitFile({
      type: 'asset',
      fileName: 'node_modules/tinykeys/dist/tinykeys.modern.js',
      source: readFileSync(fileURLToPath(import.meta.resolve('tinykeys')), 'utf8'),
    })
  },
})

export default defineConfig({
  plugins: [vue(), extensionAssets()],
  
  // Path alias for cleaner imports
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src')
    }
  },
  
  build: {
    outDir: 'dist',           // Output directory for built files
    emptyOutDir: true,        // Clean output directory before build
    copyPublicDir: true,      // Copy public assets to output
    assetsDir: 'assets',      // Directory for static assets
    
    /**
     * Rollup configuration for multi-entry Chrome extension build.
     * Each entry point creates a separate bundle.
     */
    rollupOptions: {
      // Multiple entry points for different extension contexts
      input: {
        popup: resolve(import.meta.dirname, 'src/popup/index.html'),
        options: resolve(import.meta.dirname, 'src/options/options.html'),
        background: resolve(import.meta.dirname, 'src/background/entry.ts'),
        media: resolve(import.meta.dirname, 'src/playback/media.ts'),
        content: resolve(import.meta.dirname, 'src/content/content.ts')
      },
      output: {
        /**
         * Custom entry file naming for Chrome extension manifest compatibility.
         * Background and content scripts need specific names referenced in manifest.json.
         */
        entryFileNames: (chunkInfo) => {
          // Background script must be at root as 'background.js'
          if (chunkInfo.facadeModuleId?.includes('background/entry.ts')) {
            return 'background.js'
          }
          if (chunkInfo.facadeModuleId?.includes('playback/media.ts')) return 'media.js'
          // Content script must be at root as 'content.js'
          if (chunkInfo.facadeModuleId?.includes('content.ts')) {
            return 'content.js'
          }
          // Other entries follow standard structure
          return 'src/[name]/[name].js'
        },
        chunkFileNames: 'assets/[name].js',
        /**
         * Preserve CSS file names for manifest references.
         */
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return assetInfo.name
          }
          return 'assets/[name][extname]'
        }
      }
    }
  },
  
  // Public directory for static assets (icons, manifest, etc.)
  publicDir: 'public',
  
  // Development server configuration (not used for extension development)
  server: {
    port: 3000,
    open: false
  }
})
