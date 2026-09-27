<script setup lang="ts">
import EraserIcon from '../components/EraserIcon.vue'
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
import { computed, ref, onMounted, onUnmounted } from 'vue'
import PlaybackOptions from '../playback/PlaybackOptions.vue'
import DiscoveryGuide from '../discovery/DiscoveryGuide.vue'
import { DEFAULT_KEYS } from '../playback/protocol'
import { normalizeBookmarks, type Bookmark } from '../bookmarks'
import { markdownBookmarksAndHistory, normalizeResumeVideos, type ResumeVideo } from '../resume-export'
import { archiveFolderSupported, chooseArchiveFolder, getArchiveFolderStatus, reconnectArchiveFolder, type ArchiveFolderStatus } from '../archive/folder'
import { useI18n, type LanguagePreference } from '../i18n'
const { t, language, locale, setLanguage } = useI18n()
const lt = (fr: string, en: string) => locale.value === 'fr' ? fr : en

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
const actionLabels = computed<Record<string, string>>(() => locale.value === 'fr' ? {
  'add-bookmark': 'Ajouter un marque-page', 'delete-bookmark': 'Supprimer le marque-page actuel', 'quick-bookmark': 'Ajouter sans note', 'prev-bookmark': 'Marque-page précédent', 'next-bookmark': 'Marque-page suivant',
} : {
  'add-bookmark': 'Add a bookmark', 'delete-bookmark': 'Delete the current bookmark', 'quick-bookmark': 'Add without a note', 'prev-bookmark': 'Previous bookmark', 'next-bookmark': 'Next bookmark',
})
const changeLanguage = async (event: Event) => { await setLanguage((event.target as HTMLSelectElement).value as LanguagePreference); showMessage(t('languageSaved')) }

// Reactive state for display preferences
const settings = ref({
  hideNotesByDefault: false,    // Whether to collapse notes in the UI
  showBookmarkButtons: true     // Whether to show add/cancel buttons on input
})

// Current feedback message to display (null = no message)
const message = ref<{ text: string; type: 'info' | 'error' | 'loading' } | null>(null)
const archiveStatus = ref<ArchiveFolderStatus>({ state: archiveFolderSupported() ? 'unconfigured' : 'unsupported' })
const archiveBusy = ref(false)
const welcome = new URLSearchParams(window.location.search).has('welcome')
const appUrl = chrome.runtime.getURL('src/app/index.html')

async function loadArchiveStatus(): Promise<void> {
  archiveStatus.value = await getArchiveFolderStatus()
}

function onArchiveStatusChange(changes: Record<string, chrome.storage.StorageChange>, area: string): void {
  if (area === 'local' && changes.archiveFolderStatus?.newValue) {
    archiveStatus.value = changes.archiveFolderStatus.newValue as ArchiveFolderStatus
  }
}

async function refreshArchive(): Promise<void> {
  archiveBusy.value = true
  try {
    const result = await chrome.runtime.sendMessage({ action: 'archive:refresh' }) as { success?: boolean; status?: ArchiveFolderStatus; error?: string }
    archiveStatus.value = result.status ?? await getArchiveFolderStatus()
    if (!result.success) throw new Error(result.error || archiveStatus.value.error || 'Archive unavailable')
    showMessage(lt('Dossier mis à jour avec les notes actuelles.', 'Folder updated with current notes.'))
  } catch {
    showMessage(lt('La copie dans le dossier est en pause. Reconnectez-le.', 'Folder backup is paused. Reconnect it.'), 'error')
  } finally { archiveBusy.value = false }
}

async function selectArchiveFolder(): Promise<void> {
  archiveBusy.value = true
  try {
    // The picker must be called directly from this click, before any other await.
    archiveStatus.value = await chooseArchiveFolder()
    if (archiveStatus.value.state === 'ready') await refreshArchive()
  } catch {
    archiveStatus.value = await getArchiveFolderStatus()
    showMessage(lt('Ce navigateur n’a pas autorisé le dossier. Vos notes restent enregistrées ici.', 'This browser did not grant folder access. Your notes remain saved here.'), 'error')
  } finally { archiveBusy.value = false }
}

async function reconnectArchive(): Promise<void> {
  archiveBusy.value = true
  try {
    archiveStatus.value = await reconnectArchiveFolder()
    if (archiveStatus.value.state === 'ready') await refreshArchive()
  } catch {
    archiveStatus.value = await getArchiveFolderStatus()
    showMessage(lt('Impossible de reconnecter le dossier.', 'Unable to reconnect the folder.'), 'error')
  } finally { archiveBusy.value = false }
}

/**
 * Loads saved settings from Chrome storage on component mount.
 * Falls back to defaults for any missing settings.
 */
onMounted(async () => {
  chrome.storage.onChanged.addListener(onArchiveStatusChange)
  void loadArchiveStatus()
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
onUnmounted(() => chrome.storage.onChanged.removeListener(onArchiveStatusChange))

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
  showMessage(lt('Raccourci supprimé !', 'Shortcut deleted!'))
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
      showMessage(lt('Ce raccourci est déjà utilisé pour la lecture ou un autre marque-page.', 'This shortcut is already used for playback or another bookmark.'), 'error')
      return
    }
    await chrome.storage.local.set({ hotkeys: hotkeys.value })
    showMessage(lt('Raccourci enregistré !', 'Shortcut saved!'))
  } catch { showMessage(lt('Impossible d’enregistrer le raccourci.', 'Unable to save the shortcut.'), 'error') }
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
  showMessage(lt('Options enregistrées !', 'Settings saved!'))
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
    const result = await chrome.storage.local.get(['bookmarks', 'resumeVideos']) as { bookmarks?: Bookmark[]; resumeVideos?: Record<string, ResumeVideo> }
    const bookmarks: Bookmark[] = result.bookmarks || []
    const resumeVideos = normalizeResumeVideos(Object.values(result.resumeVideos || {}))
    
    const markdown = markdownBookmarksAndHistory(normalizeBookmarks(bookmarks), resumeVideos)
    if (!markdown) {
      showMessage(lt('Aucune note ni progression à exporter', 'No bookmarks or watch progress to export'), 'error')
      return
    }
    
    // Convert each bookmark to a Markdown list item with clickable timestamp link
    await navigator.clipboard.writeText(markdown)
    showMessage(lt('Markdown copié. Aucun fichier créé par cette action.', 'Markdown copied. This action created no file.'), 'info')
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
    const result = await chrome.storage.local.get(['bookmarks', 'resumeVideos']) as { bookmarks?: Bookmark[]; resumeVideos?: Record<string, ResumeVideo> }
    const bookmarks: Bookmark[] = result.bookmarks || []
    const resumeVideos = normalizeResumeVideos(Object.values(result.resumeVideos || {}))
    
    if (bookmarks.length === 0 && resumeVideos.length === 0) {
      showMessage(lt('Aucune note ni progression à exporter', 'No bookmarks or watch progress to export'), 'error')
      return
    }
    
    // Create downloadable blob with pretty-printed JSON
    const backup = { format: 'replayglows-bookmarks-and-history', version: 1, exportedAt: new Date().toISOString(), bookmarks: normalizeBookmarks(bookmarks), resumeVideos }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    // Create and trigger download link
    const a = document.createElement('a')
    a.href = url
    a.download = 'youtube-bookmarks-and-history.json'
    a.click()
    
    // Clean up object URL to prevent memory leak
    URL.revokeObjectURL(url)
    showMessage(lt('Sauvegarde JSON exportée !', 'JSON backup exported!'), 'info')
  } catch {
    showMessage("Erreur lors de l'export JSON", "error")
  }
}

const downloadMarkdown = async () => {
  try {
    const result = await chrome.storage.local.get(['bookmarks', 'resumeVideos']) as { bookmarks?: Bookmark[]; resumeVideos?: Record<string, ResumeVideo> }
    const markdown = markdownBookmarksAndHistory(
      normalizeBookmarks(result.bookmarks || []),
      normalizeResumeVideos(Object.values(result.resumeVideos || {})),
    )
    if (!markdown) {
      showMessage(lt('Aucune note ni progression à exporter.', 'No notes or watch progress to export.'), 'error')
      return
    }
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'replayglows-notes.md'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showMessage(lt('Export Markdown lancé.', 'Markdown export started.'))
  } catch {
    showMessage(lt('Impossible d’exporter le Markdown.', 'Unable to export Markdown.'), 'error')
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
    showMessage(lt('Veuillez sélectionner un fichier à importer.', 'Choose a file to import.'), 'error')
    return
  }

  try {
    showMessage("Importation en cours...", "loading")
    const text = await file.text()
    let bookmarks: Bookmark[]
    let resumeVideos: ResumeVideo[] | undefined
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) {
        bookmarks = normalizeBookmarks(parsed)
      } else if (parsed && typeof parsed === 'object') {
        const backup = parsed as { bookmarks?: unknown; resumeVideos?: unknown }
        bookmarks = normalizeBookmarks(backup.bookmarks ?? [])
        if (Object.hasOwn(backup, 'resumeVideos')) resumeVideos = normalizeResumeVideos(backup.resumeVideos)
      } else {
        throw new Error('Invalid backup')
      }
    } catch {
      showMessage(lt('Fichier JSON invalide : vérifiez les marque-pages importés.', 'Invalid JSON file: check the imported bookmarks.'), 'error')
      return
    }
    const importSummary = resumeVideos === undefined
      ? lt(`Remplacer tous les marque-pages actuels par les ${bookmarks.length} marque-pages du fichier ?`, `Replace all current bookmarks with the ${bookmarks.length} bookmarks in this file?`)
      : lt(`Remplacer les marque-pages actuels par les ${bookmarks.length} du fichier et restaurer ${resumeVideos.length} progressions vidéo ?`, `Replace current bookmarks with the ${bookmarks.length} in this file and restore ${resumeVideos.length} video progress records?`)
    if (!window.confirm(`${importSummary} ${lt('Exportez d’abord une sauvegarde si nécessaire.', 'Export a backup first if needed.')}`)) {
      showMessage(lt('Importation annulée.', 'Import cancelled.'), 'info')
      return
    }
    const response = await chrome.runtime.sendMessage({ action: 'importBookmarks', bookmarks, ...(resumeVideos === undefined ? {} : { resumeVideos }) })
    if (response.error) throw new Error(response.error)
    showMessage(lt('Marque-pages et progression importés !', 'Bookmarks and watch progress imported!'), 'info')
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
    <div
      v-if="message"
      :key="message.text"
      role="status"
      :class="['sg-toast', `sg-toast--${message.type}`]"
    >
      {{ message.text }}
    </div>
    <header class="sg-options-header">
      <h1 class="h1">
        {{ welcome ? lt('Bienvenue dans ReplayGlows', 'Welcome to ReplayGlows') : t('options') }}
      </h1>
      <p class="sg-muted">
        {{ welcome ? lt('Choisissez comment garder vos notes et captures avant de commencer.', 'Choose how to keep your notes and captures before you begin.') : lt('Vos modifications sont enregistrées automatiquement.', 'Your changes are saved automatically.') }}
      </p>
    </header>
    <section class="sct" aria-labelledby="archive-heading">
      <h2 id="archive-heading" class="h2">{{ lt('Sauvegarde de vos notes et captures', 'Save your notes and captures') }}</h2>
      <p class="sg-muted">{{ lt('Chaque note YouTube est enregistrée immédiatement dans ce navigateur. Dans un navigateur compatible, choisissez un dossier : ReplayGlows y mettra à jour Notes.md après chaque changement et y placera les nouvelles captures locales.', 'Each YouTube note is saved immediately in this browser. In a compatible browser, choose a folder: ReplayGlows will update Notes.md after every change and place new local captures there.') }}</p>
      <p v-if="archiveStatus.state === 'unsupported'" class="sg-muted" role="status">{{ lt('Ce navigateur ne permet pas à l’extension d’écrire dans un dossier choisi. Sur Brave, les notes restent dans le navigateur ; utilisez l’export des paramètres. Une capture locale utilise le dossier de téléchargements du navigateur et peut demander un emplacement.', 'This browser does not let the extension write to a chosen folder. In Brave, notes stay in the browser; use the export controls in Settings. A local capture uses the browser download folder and may ask for a location.') }}</p>
      <p v-else-if="archiveStatus.state === 'ready'" class="sg-muted" role="status">{{ lt('Dossier actif :', 'Active folder:') }} {{ archiveStatus.folderName }}/ReplayGlows</p>
      <p v-else-if="archiveStatus.state === 'paused'" class="sg-muted" role="status">{{ lt('Copie dans le dossier en pause. Vos notes restent enregistrées dans ce navigateur ; reconnectez le dossier.', 'Folder backup is paused. Your notes remain saved in this browser; reconnect the folder.') }}</p>
      <p v-else class="sg-muted" role="status">{{ lt('Aucun dossier choisi. Vos notes restent enregistrées dans ce navigateur.', 'No folder selected. Your notes remain saved in this browser.') }}</p>
      <div v-if="archiveStatus.state !== 'unsupported'" class="cont sg-option-actions">
        <button type="button" class="sg-button sg-button--secondary" :disabled="archiveBusy" @click="selectArchiveFolder">{{ lt(archiveStatus.state === 'ready' ? 'Changer de dossier' : 'Choisir un dossier', archiveStatus.state === 'ready' ? 'Change folder' : 'Choose a folder') }}</button>
        <button v-if="archiveStatus.state === 'paused'" type="button" class="sg-button sg-button--secondary" :disabled="archiveBusy" @click="reconnectArchive">{{ lt('Reconnecter', 'Reconnect') }}</button>
        <button v-if="archiveStatus.state === 'ready'" type="button" class="sg-button sg-button--secondary" :disabled="archiveBusy" @click="refreshArchive">{{ lt('Actualiser le dossier', 'Update folder now') }}</button>
      </div>
      <p class="sg-muted">{{ lt('Export JSON : notes et progression, sans les images. Import JSON : remplacement confirmé avant application. Le Markdown peut aussi être copié ou téléchargé depuis les paramètres.', 'JSON export: notes and watch progress, without images. JSON import: replacement requires confirmation. Markdown can also be copied or downloaded from Settings.') }}</p>
      <p class="sg-muted">{{ lt('Les captures déjà téléchargées restent à leur emplacement actuel ; choisir un dossier ne les déplace pas.', 'Previously downloaded captures stay where they are; choosing a folder does not move them.') }}</p>
      <p class="sg-muted">{{ lt('Avec un compte, les captures envoyées via l’app peuvent être enregistrées dans le cloud. Les notes locales de cette extension ne sont pas encore synchronisées avec le compte.', 'With an account, captures sent through the app can be saved to the cloud. This extension’s local notes do not yet sync to the account.') }}</p>
      <a v-if="welcome" class="sg-button sg-button--secondary" :href="appUrl">{{ lt('Ouvrir ReplayGlows', 'Open ReplayGlows') }}</a>
    </section>
    <PlaybackOptions>
      <template #appearance>
        <section class="sct">
          <h3 class="h2">
            {{ lt('Affichage', 'Display') }}
          </h3>
          <!-- Checkboxes stylisées -->
          <div class="cont flex-col">
            <label class="lbl">
              <span class="t">{{ t('hideNotes') }}</span>
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
              <span class="t">{{ t('showButtons') }}</span>
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
        </section>
        <section class="sct">
          <h3 class="h2">
            {{ lt('Langue', 'Language') }}
          </h3>
          <label class="lbl"><span class="t">{{ t('language') }}</span>
            <select
              class="inp"
              :value="language"
              @change="changeLanguage"
            >
              <option value="auto">{{ t('languageAuto') }}</option>
              <option value="fr">{{ t('languageFrench') }}</option>
              <option value="en">{{ t('languageEnglish') }}</option>
            </select>
          </label>
        </section>
      </template>
      <section class="sct sg-bookmark-shortcuts">
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
                class="sg-button sg-button--secondary sg-hotkey-clear"
                :aria-label="t('clearShortcut', { action: actionLabels[action] || action })"
                :title="t('clearShortcut', { action: actionLabels[action] || action })"
                @click="deleteHotkey(action)"
              ><EraserIcon /></button>
            </div>
          </label>
        </div>
        <button
          class="sg-button sg-button--secondary"
          type="button"
          @click="hotkeys = { ...defaultHotkeys }; saveHotkeys()"
        >
          {{ t('defaultShortcuts') }}
        </button>
      </section>
      <!-- Section Export -->
      <section class="sct">
        <h3 class="h2">
          {{ t('exportBookmarks') }}
        </h3>
        <p class="sg-muted">{{ t('markdownClipboardHelp') }}</p>
        <p class="sg-muted">{{ lt('Le dossier choisi reçoit les Notes.md à jour et les nouvelles captures. Sans dossier lié, les captures locales vont dans les téléchargements du navigateur.', 'The chosen folder receives current Notes.md files and new captures. Without a linked folder, local captures go to the browser download folder.') }}</p>
        <div class="cont sg-option-actions">
          <button
            class="sg-button sg-button--secondary"
            @click="exportMarkdown"
          >
            {{ t('copyMarkdown') }}
          </button>
          <button
            class="sg-button sg-button--secondary"
            @click="exportJSON"
          >
            {{ t('exportJson') }}
          </button>
          <button type="button" class="sg-button sg-button--secondary" @click="downloadMarkdown">{{ lt('Télécharger le Markdown', 'Download Markdown') }}</button>
        </div>
      </section>

      <!-- Section Import -->
      <section class="sct">
        <h3 class="h2">
          {{ t('importBookmarks') }}
        </h3>
        <div class="cont sg-option-actions">
          <input
            ref="importInput"
            hidden
            type="file"
            :aria-label="t('jsonFile')"
            accept=".json"
            @change="importJSON"
          >
          <button
            type="button"
            class="sg-button sg-button--secondary"
            @click="importInput?.click()"
          >
            {{ t('chooseJson') }}
          </button>
        </div>
      </section>
    </PlaybackOptions>
    <details class="sg-options-guide sg-help-topic sct">
      <summary>{{ lt('Comprendre les réglages · aide pratique', 'Understand your settings · practical help') }}</summary>
      <div class="sg-options-help-copy">
        <h3 class="h2">
          {{ t('playbackEverywhere') }}
        </h3>
        <p class="sg-muted">
          {{ t('playbackIntro') }}
        </p>
        <p class="sg-muted">
          {{ t('accessIntro') }}
        </p>
        <h3 class="h2">
          {{ t('videoHoverSplits') }}
        </h3>
        <p class="sg-muted">
          {{ t('videoHoverSplitsHelp') }}
        </p>
        <h3 class="h2">
          {{ t('attachPointerToSpeedBar') }}
        </h3>
        <p class="sg-muted">
          {{ t('attachPointerToSpeedBarHelp') }}
        </p>
        <h3 class="h2">
          {{ t('altSeekOnSpeedBar') }}
        </h3>
        <p class="sg-muted">
          {{ t('altSeekOnSpeedBarHelp') }}
        </p>
        <h3 class="h2">
          {{ t('keyboardShortcuts') }}
        </h3>
        <p class="sg-muted">
          {{ t('recordShortcut') }}
        </p>
      </div>
      <DiscoveryGuide standalone />
    </details>
  </main>
</template>
