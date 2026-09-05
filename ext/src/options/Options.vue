<script setup lang="ts">
/**
 * Options.vue - Vue component for the extension's options/settings page.
 * 
 * Provides a UI for users to:
 * - Configure keyboard shortcuts for bookmark actions
 * - Toggle display preferences (hide notes, show buttons)
 * - Export bookmarks as Markdown or JSON
 * - Import bookmarks from JSON files
 * 
 * Uses Chrome storage API for persistence and Chrome messaging
 * for communication with the background script.
 */
import { ref, onMounted } from 'vue'
import PlaybackOptions from '../playback/PlaybackOptions.vue'
import DiscoveryGuide from '../discovery/DiscoveryGuide.vue'
import { DEFAULT_KEYS } from '../playback/protocol'
import { markdownBookmarks, normalizeBookmarks, type Bookmark } from '../bookmarks'

// ==================== Type Definitions ====================

/**
 * Represents a saved bookmark entry.
 */
interface StoredSettings {
  hotkeys?: Record<string, string>
  hideNotesByDefault?: boolean
  showBookmarkButtons?: boolean
}

// ==================== State Initialization ====================

/**
 * Default keyboard shortcuts for all bookmark actions.
 * Used as fallback when no custom shortcuts are configured.
 */
const defaultHotkeys = {
  'add-bookmark': 'ALT+B',
  'delete-bookmark': 'ALT+D',
  'quick-bookmark': 'ALT+Q',
  'prev-bookmark': 'ALT+1',
  'next-bookmark': 'ALT+2'
} as const

// Reactive state for current hotkey configuration
const hotkeys = ref<Record<string, string>>({ ...defaultHotkeys })
const importInput = ref<HTMLInputElement | null>(null)
const actionLabels: Record<string, string> = {
  'add-bookmark': 'Ajouter un marque-page',
  'delete-bookmark': 'Supprimer le marque-page actuel',
  'quick-bookmark': 'Ajouter sans note',
  'prev-bookmark': 'Marque-page précédent',
  'next-bookmark': 'Marque-page suivant',
}

// Reactive state for display preferences
const settings = ref({
  hideNotesByDefault: false,    // Whether to collapse notes in the UI
  showBookmarkButtons: true     // Whether to show add/cancel buttons on input
})

// Current feedback message to display (null = no message)
const message = ref<{ text: string; type: 'info' | 'error' | 'loading' } | null>(null)

/**
 * Loads saved settings from Chrome storage on component mount.
 * Falls back to defaults for any missing settings.
 */
onMounted(async () => {
  const result = await chrome.storage.local.get([
    'hotkeys',
    'hideNotesByDefault',
    'showBookmarkButtons'
  ]) as StoredSettings
  
  // Initialize storage with defaults if not present
  if (!result.hotkeys) {
    await chrome.storage.local.set({ hotkeys: defaultHotkeys })
  }
  
  hotkeys.value = result.hotkeys || defaultHotkeys
  settings.value = {
    hideNotesByDefault: result.hideNotesByDefault ?? false,
    showBookmarkButtons: result.showBookmarkButtons ?? true
  }
})

// ==================== Message Handling ====================

/**
 * Displays a feedback message to the user.
 * Messages auto-hide after 2 seconds (except 'loading' type).
 * Only one message is shown at a time.
 * 
 * @param text - Message text to display
 * @param type - Message type for styling: 'info' (green), 'error' (red), 'loading' (yellow)
 */
const showMessage = (text: string, type: 'info' | 'error' | 'loading' = 'info') => {
  // Clear any existing message first
  message.value = null
  
  // Set the new message
  message.value = { text, type }
  
  // Auto-hide after delay (except loading messages which persist)
  if (type !== 'loading') {
    setTimeout(() => {
      if (message.value?.text === text) {
        message.value = null
      }
    }, 2000)
  }
}

// ==================== Hotkey Management ====================

/**
 * Captures keyboard input and converts it to a hotkey string.
 * Handles modifier keys (Ctrl, Alt, Shift) combined with a regular key.
 * Prevents default to avoid triggering browser shortcuts.
 * 
 * @param event - The keyboard event from the input field
 * @param action - The action ID this hotkey is being set for
 */
const handleHotkeyInput = (event: KeyboardEvent, action: string) => {
  if (event.key === 'Tab') return
  if (event.key === 'Escape') { (event.target as HTMLInputElement).blur(); return }
  event.preventDefault()
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return
  const keys = []
  
  // Collect active modifier keys
  if (event.ctrlKey) keys.push('Ctrl')
  if (event.altKey) keys.push('Alt')
  if (event.shiftKey) keys.push('Shift')
  
  // Add the main key (excluding modifier-only presses)
  if (!['Control', 'Alt', 'Shift'].includes(event.key)) {
    keys.push(event.code.startsWith('Digit') ? event.code.slice(5) : event.key.toUpperCase())
  }
  
  const hotkeyString = keys.join('+')
  hotkeys.value[action] = hotkeyString
  
  // Show/hide delete button based on whether a hotkey is set
  updateDeleteButtonVisibility(action, !!hotkeyString)
  
  saveHotkeys()
}

/**
 * Updates the visibility of the delete button for a hotkey input.
 * Hides the button when no hotkey is configured.
 * 
 * @param action - The action ID
 * @param hasHotkey - Whether a hotkey is currently set
 */
const updateDeleteButtonVisibility = (action: string, hasHotkey: boolean) => {
  const deleteButton = document.querySelector(`.delete-${action}`) as HTMLElement
  if (deleteButton) {
    deleteButton.style.visibility = hasHotkey ? 'visible' : 'hidden'
    deleteButton.style.pointerEvents = hasHotkey ? 'auto' : 'none'
  }
}

/**
 * Removes a hotkey assignment for a specific action.
 * 
 * @param action - The action ID to clear
 */
const deleteHotkey = async (action: string) => {
  hotkeys.value[action] = ''
  updateDeleteButtonVisibility(action, false)
  await saveHotkeys()
  showMessage('Raccourci supprimé !')
}

/**
 * Persists the current hotkey configuration to Chrome storage.
 */
const saveHotkeys = async () => {
  try {
    const canonical = (value: string) => {
      const parts = value.toUpperCase().split('+')
      return [...parts.slice(0, -1).sort(), parts.at(-1)].join('+')
    }
    const saved = await chrome.storage.local.get('playbackSettings') as { playbackSettings?: { keys?: Record<string, string> } }
    const playback = Object.values(saved.playbackSettings?.keys ?? DEFAULT_KEYS).filter((key): key is string => typeof key === 'string' && !!key).map(canonical)
    const bookmarks = Object.values(hotkeys.value).filter(Boolean).map(canonical)
    if (new Set(bookmarks).size !== bookmarks.length || bookmarks.some(key => playback.includes(key))) {
      showMessage('Ce raccourci est déjà utilisé pour la lecture ou un autre marque-page.', 'error')
      return
    }
    await chrome.storage.local.set({ hotkeys: hotkeys.value })
    showMessage('Raccourci enregistré !')
  } catch { showMessage('Impossible d’enregistrer le raccourci.', 'error') }
}

// ==================== Settings Management ====================

/**
 * Saves display preferences to Chrome storage.
 */
const saveSettings = async () => {
  await chrome.storage.local.set({
    hideNotesByDefault: settings.value.hideNotesByDefault,
    showBookmarkButtons: settings.value.showBookmarkButtons
  })
  showMessage('Options enregistrées !')
}

// ==================== Export/Import Functionality ====================

/**
 * Exports all bookmarks as Markdown formatted text.
 * Copies the result to clipboard for pasting into notes, documents, etc.
 * Format: "- [Video Title](URL with timestamp) - Note"
 */
const exportMarkdown = async () => {
  try {
    showMessage("Copie du Markdown en cours...", "loading")
    const result = await chrome.storage.local.get('bookmarks') as { bookmarks?: Bookmark[] }
    const bookmarks: Bookmark[] = result.bookmarks || []
    
    if (bookmarks.length === 0) {
      showMessage("Aucun marque-page à exporter", "error")
      return
    }
    
    // Convert each bookmark to a Markdown list item with clickable timestamp link
    const markdown = markdownBookmarks(normalizeBookmarks(bookmarks))

    await navigator.clipboard.writeText(markdown)
    showMessage("Markdown copié !", "info")
  } catch {
    showMessage("Impossible de copier dans le presse-papiers.", "error")
  }
}

/**
 * Exports all bookmarks as a downloadable JSON file.
 * Creates a Blob and triggers download via temporary anchor element.
 */
const exportJSON = async () => {
  try {
    const result = await chrome.storage.local.get('bookmarks') as { bookmarks?: Bookmark[] }
    const bookmarks: Bookmark[] = result.bookmarks || []
    
    if (bookmarks.length === 0) {
      showMessage("Aucun marque-page à exporter", "error")
      return
    }
    
    // Create downloadable blob with pretty-printed JSON
    const blob = new Blob([JSON.stringify(bookmarks, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    // Create and trigger download link
    const a = document.createElement('a')
    a.href = url
    a.download = 'youtube-bookmarks.json'
    a.click()
    
    // Clean up object URL to prevent memory leak
    URL.revokeObjectURL(url)
    showMessage("Fichier JSON exporté !", "info")
  } catch {
    showMessage("Erreur lors de l'export JSON", "error")
  }
}

/**
 * Imports bookmarks from a JSON file.
 * Validates the file structure before saving to storage.
 * Replaces existing bookmarks with imported data.
 * 
 * @param event - File input change event
 */
const importJSON = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    showMessage('Veuillez sélectionner un fichier à importer.', 'error')
    return
  }

  try {
    showMessage("Importation en cours...", "loading")
    const text = await file.text()
    let bookmarks: Bookmark[]
    try {
      bookmarks = normalizeBookmarks(JSON.parse(text))
    } catch {
      showMessage('Fichier JSON invalide : vérifiez les marque-pages importés.', 'error')
      return
    }
    if (!window.confirm(`Remplacer tous les marque-pages actuels par les ${bookmarks.length} marque-pages du fichier ? Exportez d’abord une sauvegarde si nécessaire.`)) {
      showMessage('Importation annulée.', 'info')
      return
    }
    const response = await chrome.runtime.sendMessage({ action: 'importBookmarks', bookmarks })
    if (response.error) throw new Error(response.error)
    showMessage('Importation terminée !', 'info')
  } catch (error) {
    console.error('Échec de lecture ou de sauvegarde de l’import', error)
    showMessage('Erreur lors de l\'importation du fichier', 'error')
  } finally {
    (event.target as HTMLInputElement).value = ''
  }
}

// ==================== Chrome Message Handling ====================

/**
 * Listens for messages from other extension components.
 * Handles export triggers from popup or background script.
 */
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "showMessage") {
    showMessage(request.message, request.type || 'info')
  }
  if (request.action === "exportBookmarksAsMarkdown") {
    exportMarkdown()
  }
  if (request.action === "exportBookmarksAsJSON") {
    exportJSON()
  }
})
</script>

<template>
  <main class="spc-lg sg-options-shell">
    <!-- Message de feedback -->
    <div
      v-if="message"
      :key="message.text"
      role="status"
      :class="['sg-toast', `sg-toast--${message.type}`]"
    >
      {{ message.text }}
    </div>

    <h1 class="h1">
      Options
    </h1>
    <PlaybackOptions />
    <details class="sg-options-guide sg-help-topic">
      <summary>Découvrir ReplayGlows · aide pratique</summary>
      <DiscoveryGuide standalone />
    </details>
    <div class="grid grid-cols-2 gap-4">
      <!-- Colonne gauche -->
      <div class="flex flex-col">
        <section class="sct">
          <h2 class="h2">
            Raccourcis clavier
          </h2>
          <form @submit.prevent="saveSettings">
            <div class="cont flex-col">
              <label
                v-for="(key, action) in hotkeys"
                :key="action"
                class="lbl hotkey-input"
              >
                <span class="t">{{ actionLabels[action] || action }} :</span>
                <div class="sg-hotkey-controls">
                  <input
                    v-model="hotkeys[action]"
                    type="text"
                    :placeholder="key"
                    class="inp"
                    @keydown="(e) => handleHotkeyInput(e, action)"
                  >
                  <button
                    type="button"
                    class="sg-button sg-button--secondary"
                    :aria-label="`Effacer le raccourci : ${actionLabels[action] || action}`"
                    @click="deleteHotkey(action)"
                  >Effacer</button>
                </div>
              </label>
            </div>

            <!-- Checkboxes stylisées -->
            <div class="cont flex-col">
              <label class="lbl">
                <span class="t">Masquer les notes par défaut :</span>
                <div class="relative">
                  <input
                    v-model="settings.hideNotesByDefault"
                    type="checkbox"
                    class="sg-option-checkbox"
                    @change="saveSettings"
                  >
                </div>
              </label>
              <label class="lbl">
                <span class="t">Afficher les boutons de sauvegarde et d'annulation:</span>
                <div class="relative">
                  <input
                    v-model="settings.showBookmarkButtons"
                    type="checkbox"
                    class="sg-option-checkbox"
                    @change="saveSettings"
                  >
                </div>
              </label>
            </div>
          </form>
        </section>
      </div>

      <!-- Colonne droite -->
      <div class="flex flex-col gap-4">
        <!-- Section Export -->
        <section class="sct">
          <h2 class="h2">
            Exporter les marque-pages
          </h2>
          <div class="cont sg-option-actions">
            <button
              class="sg-button sg-button--secondary"
              @click="exportMarkdown"
            >
              Copier en Markdown
            </button>
            <button
              class="sg-button sg-button--secondary"
              @click="exportJSON"
            >
              Exporter en JSON
            </button>
          </div>
        </section>

        <!-- Section Import -->
        <section class="sct">
          <h2 class="h2">
            Importer les marque-pages
          </h2>
          <div class="cont sg-option-actions">
            <input
              ref="importInput"
              hidden
              type="file"
              aria-label="Fichier de marque-pages JSON"
              accept=".json"
              @change="importJSON"
            >
            <button
              type="button"
              class="sg-button sg-button--secondary"
              @click="importInput?.click()"
            >
              Choisir un fichier JSON
            </button>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>
