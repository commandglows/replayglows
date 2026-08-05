/**
 * Vite Configuration for YouTube Bookmarker Chrome Extension
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
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  
  // Path alias for cleaner imports
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
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
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/options.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/content.ts')
      },
      output: {
        /**
         * Custom entry file naming for Chrome extension manifest compatibility.
         * Background and content scripts need specific names referenced in manifest.json.
         */
        entryFileNames: (chunkInfo) => {
          // Background script must be at root as 'background.js'
          if (chunkInfo.facadeModuleId?.includes('background.ts')) {
            return 'background.js'
          }
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