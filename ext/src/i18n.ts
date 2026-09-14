import { computed, readonly, ref } from 'vue'

export type LanguagePreference = 'auto' | 'fr' | 'en'
export type SupportedLocale = 'fr' | 'en'

const STORAGE_KEY = 'language'
const preference = ref<LanguagePreference>('auto')
const browserLanguages = ref<readonly string[]>(typeof navigator === 'undefined' ? ['en'] : navigator.languages)
let initialized = false

export function resolveLocale(value: unknown, languages: readonly string[] = browserLanguages.value): SupportedLocale {
  if (value === 'fr' || value === 'en') return value
  return languages.some(item => item.toLowerCase().startsWith('fr')) ? 'fr' : 'en'
}

export const messages = {
  fr: {
    language: 'Langue', languageAuto: 'Automatique (navigateur)', languageFrench: 'Français', languageEnglish: 'English',
    options: 'Options', discoverHelp: 'Découvrir / Aide', playbackBookmarks: 'Lecture & marque-pages', youtubeBookmarks: 'Marque-pages YouTube', yourBookmarks: 'Vos marque-pages', readyTitle: 'Prêt à capturer vos idées', readyBody: 'Ouvrez une vidéo YouTube pour ajouter un marque-page à un moment précis.', youtubeVideo: 'Vidéo YouTube', note: 'Note', editNote: 'Modifier la note', save: 'Enregistrer', cancel: 'Annuler', noNote: 'Sans note', edit: 'Modifier', delete: 'Supprimer', optionsImportExport: 'Options et import/export', localFooter: 'Vos marque-pages restent dans votre navigateur.', loadBookmarksError: 'Impossible de charger les marque-pages.', saveError: 'Échec de sauvegarde.', notesProgressError: 'Vos notes sont chargées, mais la progression du guide n’a pas pu être enregistrée.', openedProgressError: 'Vidéo ouverte, mais progression du guide non enregistrée.', openVideoError: 'Impossible d’ouvrir la vidéo. Réessayez depuis ce marque-page.',
    playbackTitle: 'Vitesse de lecture', pinnedScope: 'Épinglé · cet onglet', globalScope: 'Global · onglets non épinglés', unpin: 'Désépingler', pin: 'Épingler', settings: 'Réglages', playbackSettings: 'Réglages de lecture', checkPlayer: 'Vérification du lecteur', currentSpeed: 'Vitesse actuelle', presets: 'Vitesses prédéfinies', favorite: 'Favori', noMedia: 'Aucun média accessible. Lancez une vidéo ou un audio sur un site web. Après installation, rechargez la page. Certaines pages protégées par Chrome sont exclues.', retry: 'Vérifier à nouveau', suspendedOptions: 'Commandes suspendues · options', loopActiveOptions: 'Boucle A–B active · options', repeatSection: 'Répéter un passage · boucle A–B', audio: 'Audio', video: 'Vidéo', tabMedia: 'Média de cet onglet', markA: 'Début A', markB: 'Fin B', clear: 'Effacer', chooseEnd: 'Choisissez la fin B', repeatActive: 'répétition active', markInstructions: 'Marquez le début, avancez à la fin puis marquez B.', start: 'Début', end: 'Fin', bookmarkA: 'Marque-page A', bookmarkB: 'Marque-page B', repeatBookmarks: 'Répéter entre ces marque-pages', suspendAll: 'Suspendre les commandes sur tous les sites', reactivate: 'Commandes suspendues · réactiver', findingMedia: 'Recherche du média…', tabUnavailable: 'Onglet indisponible.', connectionInterrupted: 'Connexion interrompue. Rechargez la page puis rouvrez ce panneau.', commandFailed: 'La commande a échoué.', speedApplied: 'Vitesse appliquée : {rate}×.', guideProgressError: 'Action réussie, mais progression du guide non enregistrée. Pour la vitesse, essayez une autre valeur ; les autres étapes seront revérifiées automatiquement.',
    playbackEverywhere: 'Lecture sur tous les sites', playbackIntro: 'Une vitesse commune pour vos vidéos et audios. Épinglez un onglet depuis le popup pour lui donner sa propre vitesse. Le pin reste actif jusqu’à la fermeture de l’onglet ou au redémarrage du navigateur.', accessIntro: 'L’accès aux sites permet de contrôler leurs médias HTML5. Vos réglages et marque-pages restent dans ce navigateur. Les pages protégées par Chrome ne sont pas accessibles.', favoriteSpeed: 'Vitesse favorite', shortcutStep: 'Pas des raccourcis', recordShortcut: 'Cliquez dans un champ et appuyez sur votre combinaison. Retour arrière efface le raccourci. Les commandes sont ignorées pendant la saisie de texte.', disabled: 'Désactivé', savePlayback: 'Enregistrer la lecture', defaultShortcuts: 'Raccourcis par défaut', settingsLoadError: 'Impossible de charger les réglages. Rouvrez les options.', duplicateShortcut: 'Deux actions utilisent le même raccourci. Choisissez des touches distinctes.', playbackSaved: 'Réglages de lecture enregistrés.',
    keyboardShortcuts: 'Raccourcis clavier', hideNotes: 'Masquer les notes par défaut :', showButtons: 'Afficher les boutons de sauvegarde et d’annulation :', exportBookmarks: 'Exporter les marque-pages', copyMarkdown: 'Copier en Markdown', exportJson: 'Exporter en JSON', importBookmarks: 'Importer les marque-pages', jsonFile: 'Fichier de marque-pages JSON', chooseJson: 'Choisir un fichier JSON', languageSaved: 'Langue appliquée.', clearShortcut: 'Effacer le raccourci : {action}',
    slower: 'Ralentir', faster: 'Accélérer', reset: 'Revenir à 1×', favoriteRate: 'Vitesse favorite', rewind: 'Reculer de 10 secondes', forward: 'Avancer de 10 secondes', boost: 'Accélérer pendant l’appui', markStart: 'Marquer le début A', markEnd: 'Marquer la fin B', clearLoop: 'Effacer la boucle', suspend: 'Suspendre / réactiver les commandes',
  },
  en: {
    language: 'Language', languageAuto: 'Automatic (browser)', languageFrench: 'Français', languageEnglish: 'English',
    options: 'Settings', discoverHelp: 'Discover / Help', playbackBookmarks: 'Playback & bookmarks', youtubeBookmarks: 'YouTube bookmarks', yourBookmarks: 'Your bookmarks', readyTitle: 'Ready to capture your ideas', readyBody: 'Open a YouTube video to add a bookmark at a precise moment.', youtubeVideo: 'YouTube video', note: 'Note', editNote: 'Edit note', save: 'Save', cancel: 'Cancel', noNote: 'No note', edit: 'Edit', delete: 'Delete', optionsImportExport: 'Settings and import/export', localFooter: 'Your bookmarks stay in your browser.', loadBookmarksError: 'Unable to load bookmarks.', saveError: 'Unable to save.', notesProgressError: 'Your notes loaded, but guide progress could not be saved.', openedProgressError: 'Video opened, but guide progress could not be saved.', openVideoError: 'Unable to open the video. Try again from this bookmark.',
    playbackTitle: 'Playback speed', pinnedScope: 'Pinned · this tab', globalScope: 'Global · unpinned tabs', unpin: 'Unpin', pin: 'Pin', settings: 'Settings', playbackSettings: 'Playback settings', checkPlayer: 'Checking player', currentSpeed: 'Current speed', presets: 'Speed presets', favorite: 'Favorite', noMedia: 'No accessible media. Start a video or audio file on a website. Reload the page after installation. Some Chrome-protected pages are excluded.', retry: 'Check again', suspendedOptions: 'Controls paused · settings', loopActiveOptions: 'A–B loop active · settings', repeatSection: 'Repeat a passage · A–B loop', audio: 'Audio', video: 'Video', tabMedia: 'Media in this tab', markA: 'Start A', markB: 'End B', clear: 'Clear', chooseEnd: 'Choose end B', repeatActive: 'loop active', markInstructions: 'Mark the start, move to the end, then mark B.', start: 'Start', end: 'End', bookmarkA: 'Bookmark A', bookmarkB: 'Bookmark B', repeatBookmarks: 'Repeat between these bookmarks', suspendAll: 'Pause controls on all sites', reactivate: 'Controls paused · reactivate', findingMedia: 'Looking for media…', tabUnavailable: 'Tab unavailable.', connectionInterrupted: 'Connection interrupted. Reload the page, then reopen this panel.', commandFailed: 'The command failed.', speedApplied: 'Speed applied: {rate}×.', guideProgressError: 'Action succeeded, but guide progress was not saved. For speed, try another value; other steps will be checked again automatically.',
    playbackEverywhere: 'Playback on every site', playbackIntro: 'Use one shared speed for videos and audio. Pin a tab from the popup to give it its own speed. The pin remains until the tab or browser is closed.', accessIntro: 'Site access lets ReplayGlows control HTML5 media. Your settings and bookmarks stay in this browser. Chrome-protected pages are not accessible.', favoriteSpeed: 'Favorite speed', shortcutStep: 'Shortcut step', recordShortcut: 'Click a field and press your key combination. Backspace clears it. Commands are ignored while you type text.', disabled: 'Disabled', savePlayback: 'Save playback settings', defaultShortcuts: 'Default shortcuts', settingsLoadError: 'Unable to load settings. Reopen the settings page.', duplicateShortcut: 'Two actions use the same shortcut. Choose distinct keys.', playbackSaved: 'Playback settings saved.',
    keyboardShortcuts: 'Keyboard shortcuts', hideNotes: 'Hide notes by default:', showButtons: 'Show save and cancel buttons:', exportBookmarks: 'Export bookmarks', copyMarkdown: 'Copy as Markdown', exportJson: 'Export as JSON', importBookmarks: 'Import bookmarks', jsonFile: 'JSON bookmarks file', chooseJson: 'Choose a JSON file', languageSaved: 'Language applied.', clearShortcut: 'Clear shortcut: {action}',
    slower: 'Slow down', faster: 'Speed up', reset: 'Return to 1×', favoriteRate: 'Favorite speed', rewind: 'Go back 10 seconds', forward: 'Go forward 10 seconds', boost: 'Speed up while held', markStart: 'Mark start A', markEnd: 'Mark end B', clearLoop: 'Clear loop', suspend: 'Pause / reactivate controls',
  },
} as const

export type MessageKey = keyof typeof messages.fr
type Params = Record<string, string | number>
export const locale = computed(() => resolveLocale(preference.value))
export function translate(key: MessageKey, params: Params = {}): string {
  let value: string = messages[locale.value][key]
  for (const [name, replacement] of Object.entries(params)) value = value.replace(`{${name}}`, String(replacement))
  return value
}
export async function initializeI18n(): Promise<void> {
  if (initialized) return
  initialized = true
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  if (stored[STORAGE_KEY] === 'auto' || stored[STORAGE_KEY] === 'fr' || stored[STORAGE_KEY] === 'en') preference.value = stored[STORAGE_KEY]
  chrome.storage.onChanged.addListener((changes, area) => {
    const value = changes[STORAGE_KEY]?.newValue
    if (area === 'local' && (value === 'auto' || value === 'fr' || value === 'en')) preference.value = value
  })
}
export async function setLanguage(value: LanguagePreference): Promise<void> {
  preference.value = value
  await chrome.storage.local.set({ [STORAGE_KEY]: value })
}
export function useI18n() { void initializeI18n(); return { language: readonly(preference), locale, t: translate, setLanguage } }
