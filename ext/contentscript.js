/**
 * YouTubeBookmarker - Main content script for the ReplayGlows extension.
 * 
 * This object manages all bookmark-related functionality within YouTube video pages:
 * - Adding/removing bookmark icons on the video progress bar
 * - Handling keyboard shortcuts for bookmark operations
 * - Managing bookmark UI elements and user interactions
 * - Syncing bookmark data with Chrome storage
 * 
 * The script is injected into YouTube pages and interacts with the DOM
 * to provide a seamless bookmarking experience directly on the video player.
 */
const YOUTUBE_MESSAGES = {
  fr: { add: 'Ajouter un marque-page', captureFrame: 'Capture d’écran', captureCopy: 'Copier dans le presse-papiers', captureDownload: 'Télécharger l’image', captureCloud: 'Envoyer dans ReplayGlows', captureCopied: 'Image copiée dans le presse-papiers.', captureLocalSaved: 'Capture enregistrée dans Téléchargements/ReplayGlows.', captureCloudSaved: 'Capture ajoutée à vos notes ReplayGlows.', captureCloudFallback: 'Le cloud est indisponible. La capture a été enregistrée sur cet appareil.', captureFirstLocal: 'Capture enregistrée dans Téléchargements/ReplayGlows. Connectez-vous à ReplayGlows pour la retrouver sur vos autres appareils.', captureConnect: 'Se connecter', captureLocalError: 'Impossible d’enregistrer les fichiers ReplayGlows. Autorisez les téléchargements puis réessayez.', captureError: 'Impossible d’enregistrer cette image. Réessayez quand la vidéo est prête.', captureCopyError: 'Impossible de copier l’image.', notePlaceholder: 'Ajouter une note pour ce marque-page', noteLabel: 'Note du marque-page', saved: 'Marque-page enregistré !', missingPlayer: 'Impossible ! La barre de progression ou la vidéo actuelle sont manquantes.', playAt: 'Lire le marque-page à {time}', deleteOne: 'Supprimer ce marque-page', listLabel: 'Marque-pages de cette vidéo', listTitle: 'Marque-pages pour cette vidéo', listEmpty: 'Aucun marque-page pour cette vidéo', deleteVideo: 'Supprimer les marque-pages de cette vidéo', seekAt: 'Lire à {time}', edit: 'Modifier', editNote: 'Modifier la note', save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', videoDeleted: 'Marque-pages de cette vidéo supprimés', openLocal: 'Ouvrir dans l’app locale', openCloud: 'Ouvrir dans le cloud', openError: 'Impossible d’ouvrir l’app. Réessayez.', showSpeed: 'Montrer la barre de vitesse', hideSpeed: 'Masquer la barre de vitesse', speed: 'Vitesse de lecture', favoriteSpeed: 'Vitesse favorite', speedError: 'Impossible de modifier la vitesse. Réessayez.', speedSuspended: 'Contrôle de vitesse suspendu' },
  en: { add: 'Add a bookmark', captureFrame: 'Screenshot', captureCopy: 'Copy to clipboard', captureDownload: 'Download image', captureCloud: 'Send to ReplayGlows', captureCopied: 'Image copied to clipboard.', captureLocalSaved: 'Capture saved in Downloads/ReplayGlows.', captureCloudSaved: 'Capture added to your ReplayGlows notes.', captureCloudFallback: 'Cloud saving failed. The capture was saved on this device.', captureFirstLocal: 'Capture saved in Downloads/ReplayGlows. Sign in to ReplayGlows to find it on your other devices.', captureConnect: 'Sign in', captureLocalError: 'Unable to save ReplayGlows files. Allow downloads and try again.', captureError: 'Unable to save this frame. Try again when the video is ready.', captureCopyError: 'Unable to copy the image.', notePlaceholder: 'Add a note for this bookmark', noteLabel: 'Bookmark note', saved: 'Bookmark saved!', missingPlayer: 'The progress bar or current video is unavailable.', playAt: 'Play bookmark at {time}', deleteOne: 'Delete this bookmark', listLabel: 'Bookmarks for this video', listTitle: 'Bookmarks for this video', listEmpty: 'No bookmarks for this video', deleteVideo: 'Delete bookmarks for this video', seekAt: 'Play at {time}', edit: 'Edit', editNote: 'Edit note', save: 'Save', cancel: 'Cancel', delete: 'Delete', videoDeleted: 'Bookmarks for this video deleted', openLocal: 'Open in the local app', openCloud: 'Open in the cloud', openError: 'Unable to open the app. Try again.', showSpeed: 'Show speed bar', hideSpeed: 'Hide speed bar', speed: 'Playback speed', favoriteSpeed: 'Favorite speed', speedError: 'Unable to change speed. Try again.', speedSuspended: 'Speed control suspended' }
};

const YouTubeBookmarker = {
  locale: 'en',
  t(key, params = {}) {
    let value = YOUTUBE_MESSAGES[this.locale][key] || key;
    for (const [name, replacement] of Object.entries(params)) value = value.replace(`{${name}}`, String(replacement));
    return value;
  },

  /**
   * Central state object that tracks all UI elements and bookmark data.
   * This reactive state is reset on page navigation to handle YouTube's SPA behavior.
   */
  state: {
    currentVideo: null,           // Reference to the HTML5 video element
    player: null,                 // Reference to the YouTube player container
    bookmarks: [],                // All bookmarks from storage
    groupedBookmarks: {},         // Bookmarks grouped by video URL
    bookmarkButton: null,         // Custom bookmark button added to player controls
    captureButton: null,
    timeDisplay: null,            // YouTube's time display element (used for button placement)
    progressBar: null,            // Video progress bar (where bookmark icons are displayed)
    bookmarkContainerVisible: false, // Whether the note input container is visible
    bookmarkInputContainer: null, // Container for the bookmark note input
    bookmarkInputElement: null,   // The actual input element for notes
    isInitialized: false,         // Prevents duplicate initialization
    wasPlayingBeforeBookmark: null, // Tracks video play state to resume after bookmarking
    clickCount: 0,                // Counter for detecting double/triple clicks
    lastClickTime: 0,             // Timestamp for click detection
    bookmarksList: null,          // DOM element showing bookmarks list in sidebar
    parentContainer: null,        // YouTube sidebar container for bookmark list
    bookmarksForThisUrl: []       // Filtered bookmarks for current video only
  },

  /**
   * Gets the current playback position of the video in seconds.
   * Returns 0 if no video element is available.
   */
  get currentVideoTime() {
    return this.state.currentVideo ? this.state.currentVideo.currentTime : 0;
  },

  restoreBookmarkPlayback() {
    const video = this.bookmarkVideo;
    const url = this.bookmarkUrl;
    const shouldResume = this.bookmarkWasPlaying;
    this.bookmarkVideo = null;
    this.bookmarkUrl = null;
    this.bookmarkWasPlaying = false;
    this.state.bookmarkInputContainer?.remove();
    this.state.bookmarkInputContainer = null;
    this.state.bookmarkInputElement = null;
    this.state.bookmarkContainerVisible = false;
    this.state.bookmarkTime = null;
    this.state.wasPlayingBeforeBookmark = false;
    if (shouldResume && url === this.currentUrl && video?.isConnected && video.paused) video.play().catch(() => {});
  },

  /**
   * Gets the canonical URL for the current video.
   * Strips query parameters (except 'v') to ensure consistent bookmark grouping.
   * This prevents duplicate bookmarks for the same video with different timestamps in URL.
   */
  get currentUrl() {
    const id = new URL(window.location.href).searchParams.get('v');
    return id ? `https://www.youtube.com/watch?v=${id}` : '';
  },

  /**
   * CSS class names and IDs used for DOM manipulation.
   * Centralized here to maintain consistency and ease refactoring.
   */
  CONSTANTS: {
    BOOKMARK_BUTTON_ID: 'bookmark-button',
    BOOKMARK_ICON_CLASS: 'custom-bookmark-icon',
    BOOKMARK_ICON_CONTAINER_CLASS: 'custom-bookmark-icon-container',
    BOOKMARK_DELETE_ICON_CLASS: 'custom-bookmark-delete-icon',
    BOOKMARK_INPUT_CONTAINER_CLASS: 'bookmark-input-container',
    RG_MENU_CLASS: 'rg-yt-menu'
  },
  
  /**
   * Initializes the extension when a YouTube video page is loaded.
   * Sets up all required UI elements, event listeners, and keyboard shortcuts.
   * Called on initial page load and on YouTube's SPA navigation events.
   */
  async init() {
    const generation = this.generation = (this.generation || 0) + 1;
    const videoUrl = this.currentUrl;
    clearTimeout(this.clickGesture?.timer);
    this.clickGesture = null;
    this.videoSplitsCleanup?.();
    this.speedBarCleanup?.();
    this.ambilightCleanup?.();
    this.dragCleanup?.();
    this.restoreBookmarkPlayback?.();
    this.events?.abort();
    this.hotkeyEvents?.abort();
    this.events = new AbortController();
    const visibilityRevision = this.speedBarVisibilityRevision || 0;
    const { language = 'auto', speedBarVisible = false, ambilightEnabled = false, captureAuthState = null, captureLocalIntroShown = false } = await chrome.storage.local.get(['language', 'speedBarVisible', 'ambilightEnabled', 'captureAuthState', 'captureLocalIntroShown']);
    if (generation !== this.generation || videoUrl !== this.currentUrl) return;
    if (visibilityRevision === (this.speedBarVisibilityRevision || 0)) this.speedBarVisible = speedBarVisible === true;
    this.ambilightEnabled = ambilightEnabled === true;
    this.captureAuthState = captureAuthState;
    this.captureLocalIntroShown = captureLocalIntroShown === true;
    this.locale = language === 'fr' || (language === 'auto' && navigator.languages.some(item => item.toLowerCase().startsWith('fr'))) ? 'fr' : 'en';
    this.state.bookmarkInputContainer?.remove();
    document.querySelectorAll('.bookmarks-list, .custom-bookmark-icon-container, .rg-yt-menu').forEach(el => el.remove());
    if (window.location.pathname !== '/watch') return;
    // Player readiness is bounded and cancelled when navigation supersedes this init.
    const player = await this.waitForYouTubePlayer(generation, 10000, videoUrl);
    if (generation !== this.generation || videoUrl !== this.currentUrl || !player) return;
    try {
      await this.resetState(player, videoUrl);
      if (generation !== this.generation || videoUrl !== this.currentUrl || this.state.player !== player || !this.state.currentVideo?.isConnected) return;
      await this.addBookmarkButton();
      if (generation !== this.generation || videoUrl !== this.currentUrl) return;
      this.setupSpeedBar();
      this.setupVideoSplits();
      this.setupAmbilight();
      this.setupOverflowMenu();
      this.setupCaptureMenu();
      await this.setupHotkeys();
      if (generation !== this.generation || videoUrl !== this.currentUrl) return;
      await this.updateUIElements();
      if (generation !== this.generation || videoUrl !== this.currentUrl) return;
      this.setupEventListeners();
    } catch (error) { this.afficherMessage(error.message, 'error'); }
  },

  /**
   * Resets and refreshes the internal state from Chrome storage.
   * Filters bookmarks to show only those relevant to the current video URL.
   * Also re-queries DOM elements in case of dynamic page changes.
   */
  async resetState(player = this.state.player, videoUrl = this.currentUrl) {
    const generation = this.generation;
    const result = await chrome.runtime.sendMessage({ action: 'getBookmarks' });
    if (generation !== this.generation || videoUrl !== this.currentUrl) return;
    if (result.error) throw new Error(result.error);
    const storedBookmarks = result.bookmarks || [];
    const video = player?.querySelector('video');
    if (!player?.isConnected || !video) return;
    const bookmarksForThisUrl = storedBookmarks.filter(bookmark => bookmark.url === videoUrl).sort((a, b) => a.time - b.time);
    this.state = {
      currentUrl: videoUrl,
      wasPlayingBeforeBookmark: false,
      bookmarks: storedBookmarks,
      bookmarksForThisUrl: bookmarksForThisUrl || [],
      currentVideo: video,
      player,
      bookmarkButton: player.querySelector(`#${this.CONSTANTS.BOOKMARK_BUTTON_ID}`),
      captureButton: player.querySelector('#rg-capture-frame-button'),
      timeDisplay: player.querySelector('.ytp-time-display'),
      progressBar: player.querySelector('.ytp-progress-bar'),
      parentContainer: document.querySelector('ytd-watch-next-secondary-results-renderer'),
      bookmarksList: document.querySelector('.bookmarks-list'),
      bookmarkInputVisible: false,
      bookmarkInputContainer: null,
      bookmarkInputElement: null,
      isInitialized: true,
    };

  },

  /**
   * Waits for YouTube's video player to be available in the DOM.
   * YouTube loads content dynamically, so we poll until the player appears.
   * Returns a Promise that resolves with the player element.
   */
  waitForYouTubePlayer(generation = this.generation, timeoutMs = 10000, videoUrl = this.currentUrl) {
    return new Promise(resolve => {
      const signal = this.events?.signal;
      let interval;
      const finish = player => {
        clearInterval(interval);
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        if (player && generation === this.generation) this.state.player = player;
        resolve(player);
      };
      const onAbort = () => finish(null);
      const check = () => {
        if (signal?.aborted || generation !== this.generation || videoUrl !== this.currentUrl || window.location.pathname !== '/watch') return finish(null);
        const player = [...document.querySelectorAll('.html5-video-player')].find(candidate =>
          candidate.querySelector('video') && candidate.querySelector('.ytp-time-display') && candidate.querySelector('.ytp-progress-bar'));
        if (player) finish(player);
      };
      const timeout = setTimeout(() => finish(null), timeoutMs);
      signal?.addEventListener('abort', onAbort, { once: true });
      interval = setInterval(check, 100);
      check();
    });
  },

  /**
   * Sets up event listeners for YouTube navigation and user interactions.
   * The 'yt-navigate-finish' event handles YouTube's SPA navigation between videos.
   */
  setupEventListeners() {
    const authStorageListener = (changes, areaName) => {
      if (areaName === 'local' && changes.captureAuthState) this.captureAuthState = changes.captureAuthState.newValue || null;
    };
    chrome.storage.onChanged.addListener(authStorageListener);
    this.events.signal.addEventListener('abort', () => chrome.storage.onChanged.removeListener(authStorageListener), { once: true });

    this.state.bookmarkButton?.addEventListener('click', (e) => { e.stopPropagation(); this.handleAddBookmark(e, this.state.bookmarkButton); }, { signal: this.events.signal });
    this.state.captureButton?.addEventListener('click', (e) => { e.stopPropagation(); void this.handleCaptureClick(); }, { signal: this.events.signal });
    this.state.progressBar?.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-bookmark-icon-container')) this.handleAddBookmark(e, this.state.progressBar);
    }, { signal: this.events.signal });
    this.state.currentVideo?.addEventListener('durationchange', () => this.loadBookmarks(), { signal: this.events.signal });
  },

  /**
   * Displays a toast notification message to the user.
   * Messages auto-hide after 1.5 seconds with a fade-out animation.
   * @param {string} message - The message text to display
   * @param {string} type - Message type: 'info' | 'error' | 'loading'
   */
  afficherMessage(message, type = 'info') {
    const messageContainer = document.createElement('div');
    messageContainer.className = `msg ${type}`;
    messageContainer.textContent = message;
    document.body.appendChild(messageContainer);

    setTimeout(() => {
        messageContainer.classList.add('hide');
        setTimeout(() => {
            messageContainer.remove();
        }, 3000);
    }, 1500);
  },

  /**
   * Configures keyboard shortcuts for bookmark operations.
   * Loads custom hotkeys from storage or uses defaults.
   * Supports modifier keys (Ctrl, Alt, Shift) combined with any key.
   */
  async setupHotkeys() {
    const generation = this.generation;
    const { hotkeys } = await chrome.storage.local.get('hotkeys');
    if (generation !== this.generation) return;
    const hotkeysToUse = hotkeys || { 'add-bookmark': 'ALT+B', 'delete-bookmark': 'ALT+D', 'quick-bookmark': 'ALT+Q', 'prev-bookmark': 'ALT+1', 'next-bookmark': 'ALT+2' };
    this.hotkeyEvents?.abort();
    this.hotkeyEvents = new AbortController();
    document.addEventListener('keydown', e => {
      if (e.repeat || e.isComposing || e.metaKey || e.target.closest('input, textarea, [contenteditable="true"]') || window.location.pathname !== '/watch') return;
      const pressed = [e.ctrlKey ? 'CTRL' : '', e.altKey ? 'ALT' : '', e.shiftKey ? 'SHIFT' : '', e.code.startsWith('Digit') ? e.code.slice(5) : e.key.toUpperCase()].filter(Boolean).join('+');
      const action = Object.keys(hotkeysToUse).find(key => hotkeysToUse[key].toUpperCase() === pressed);
      if (!action) return;
      e.preventDefault(); e.stopPropagation();
      if (action === 'add-bookmark') this.addBookmark();
      if (action === 'quick-bookmark') this.saveBookmark('');
      if (action === 'prev-bookmark') this.navigateBookmarks('prev');
      if (action === 'next-bookmark') this.navigateBookmarks('next');
      if (action === 'delete-bookmark') {
        const bookmark = this.state.bookmarksForThisUrl.find(b => Math.abs(b.time - this.currentVideoTime) < 1);
        if (bookmark) this.deleteBookmark(bookmark);
      }
    }, { signal: this.hotkeyEvents.signal });
  },


  toggleNotesVisibility() {
  },

  /**
   * Handles YouTube's SPA navigation event.
   * Re-initializes the extension when navigating to a new video page
   * to ensure bookmarks and UI elements are properly updated.
   */
  onNavigate() {

    if (window.location.pathname === '/watch') {
      const currentUrl = this.currentUrl;
      this.init();
    }
  },

  /**
   * Creates and injects the bookmark button into YouTube's player controls.
   * The button is placed next to the time display for easy access.
   * Waits for the player to be ready before adding the button.
   */
  async addBookmarkButton() {
    const generation = this.generation;
    return this.waitForYouTubePlayer(generation).then(player => {
      if (generation !== this.generation) return;
      if (!player || this.state.player !== player) {
        console.error("Le lecteur YouTube est introuvable.");
        return;
      }
      // Prevent duplicate buttons on re-initialization
      if (this.state.bookmarkButton?.isConnected && player.contains(this.state.bookmarkButton)) {

        return;
      }

      // Create the bookmark button with SVG icon
      const button = document.createElement('button');
      button.id = this.CONSTANTS.BOOKMARK_BUTTON_ID;
      button.type = 'button';
      button.setAttribute('aria-label', this.t('add'));

      const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgIcon.setAttribute("viewBox", "0 0 24 24");
      svgIcon.setAttribute("width", "22");
      svgIcon.setAttribute("height", "18");
      svgIcon.innerHTML = '<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" fill="white"/>';
      /* Gradient SVG path - kept for reference but using solid white for better visibility
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="00%" style="stop-color:#ff00c8ff; stop-opacity:1" />
          ...
        </linearGradient>
      </defs>
      <path ... fill="url(#gradient)" />
      */
      const buttonText = document.createElement('span');
      buttonText.textContent = this.t('add');

      button.appendChild(svgIcon);
      button.appendChild(buttonText);

      // Insert button after the time display in the player controls
      if (this.state.timeDisplay) {
        this.state.timeDisplay.parentNode.insertBefore(button, this.state.timeDisplay.nextSibling);
        this.state.bookmarkButton = button;
        const captureButton = document.createElement('button');
        captureButton.id = 'rg-capture-frame-button';
        captureButton.type = 'button';
        captureButton.className = 'rg-capture-frame-button';
        captureButton.setAttribute('aria-label', this.t('captureFrame'));
        captureButton.setAttribute('aria-haspopup', 'menu');
        captureButton.setAttribute('aria-expanded', 'false');
        captureButton.title = this.t('captureFrame');
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('width', '26');
        icon.setAttribute('height', '24');
        icon.setAttribute('aria-hidden', 'true');
        const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        body.setAttribute('d', 'M8.2 5.6 9.6 3.8h4.8l1.4 1.8H19a2 2 0 0 1 2 2v9.6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.6a2 2 0 0 1 2-2h3.2Z');
        body.setAttribute('fill', 'none');
        body.setAttribute('stroke', 'currentColor');
        body.setAttribute('stroke-width', '1.8');
        body.setAttribute('stroke-linecap', 'round');
        body.setAttribute('stroke-linejoin', 'round');
        icon.appendChild(body);
        for (const [radius, strokeWidth] of [[4.5, 1.8], [3.1, 1.25]]) {
          const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          ring.setAttribute('cx', '12');
          ring.setAttribute('cy', '12.4');
          ring.setAttribute('r', String(radius));
          ring.setAttribute('fill', 'none');
          ring.setAttribute('stroke', 'currentColor');
          ring.setAttribute('stroke-width', String(strokeWidth));
          icon.appendChild(ring);
        }
        const shutter = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shutter.setAttribute('d', 'm12 10.7 1.45.85-.13 1.7-1.32.78-1.45-.85.13-1.7L12 10.7Z');
        shutter.setAttribute('fill', 'currentColor');
        icon.appendChild(shutter);
        captureButton.appendChild(icon);
        button.after(captureButton);
        this.state.captureButton = captureButton;

      } else {
        console.info("timeDisplay est introuvable, le bouton ne peut pas être ajouté.");
        }
    });
  },

  /**
   * Creates the shared, viewport-bounded dropdown used by YouTube controls.
   */
  createSharedDropdown(button, label, items, className = '') {
    if (!button) return null;
    const menu = document.createElement('div');
    menu.className = `${this.CONSTANTS.RG_MENU_CLASS} ${className}`.trim();
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', label);
    const entries = new Map();
    for (const item of items) {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'rg-yt-menu__item';
      entry.setAttribute('role', item.role || 'menuitem');
      entry.setAttribute('aria-label', item.label);
      entry.title = item.label;
      if (item.icon) {
        entry.classList.add('rg-yt-menu__icon-item');
        entry.dataset.label = item.label;
        entry.setAttribute('aria-pressed', String(item.selected === true));
        if (item.selected) entry.classList.add('rg-yt-menu__item--selected');
        if (item.icon === 'copy') this.appendMenuIcon(entry, 'M8 7V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3Zm2 0h4a2 2 0 0 1 2 2v7h3V4h-9v3Zm4 2H5v11h9V9Z');
        else if (item.icon === 'download') this.appendMenuIcon(entry, 'M11 3h2v9l3.5-3.5 1.4 1.4L12 16.8l-5.9-5.9 1.4-1.4L11 12V3Zm-6 14v3h14v-3h2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3h2Z');
        else if (item.icon === 'cloud') this.appendMenuIcon(entry, 'M19.4 10.4A7.5 7.5 0 0 0 5 8.5 5.5 5.5 0 0 0 5.5 19H11v-2H5.5a3.5 3.5 0 0 1-.2-7 1 1 0 0 0 1-.8 5.5 5.5 0 0 1 10.8.8 1 1 0 0 0 .9.9 3 3 0 0 1-.3 6H13v2h4.7a5 5 0 0 0 1.7-9.6ZM12 11l-4 4h3v5h2v-5h3l-4-4Z');
      } else {
        entry.textContent = item.label;
      }
      if (item.disabled) {
        entry.disabled = true;
        entry.title = item.disabledLabel || item.label;
      }
      if (item.role === 'menuitemcheckbox') {
        entry.setAttribute('role', 'menuitemcheckbox');
        entry.setAttribute('aria-checked', String(item.checked === true));
      }
      if (!item.disabled) entry.addEventListener('click', event => {
        event.stopPropagation();
        close();
        item.run?.(entry);
      }, { signal: this.events.signal });
      menu.appendChild(entry);
      entries.set(item.key, entry);
    }
    const mountMenu = () => (document.fullscreenElement || document.body).appendChild(menu);
    mountMenu();
    let open = false;
    let leaveTimer = null;
    const positionMenu = () => {
      const rect = button.getBoundingClientRect();
      const isCaptureMenu = className.includes('capture');
      const margin = 8;
      const width = Math.max(0, window.innerWidth - margin * 2);
      const height = Math.max(0, window.innerHeight - margin * 2);
      menu.style.boxSizing = 'border-box';
      menu.style.minWidth = isCaptureMenu ? '0px' : `${Math.min(220, width)}px`;
      menu.style.width = isCaptureMenu ? '56px' : '';
      menu.style.maxWidth = isCaptureMenu ? 'none' : `${width}px`;
      menu.style.maxHeight = isCaptureMenu ? 'none' : `${height}px`;
      menu.style.overflow = isCaptureMenu ? 'visible' : 'auto';
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      const below = rect.bottom + margin;
      const top = isCaptureMenu || below + menuHeight <= window.innerHeight - margin
        ? below : rect.top - menuHeight - margin;
      const left = isCaptureMenu ? rect.left + rect.width / 2 - menuWidth / 2 : rect.left;
      menu.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin))}px`;
      menu.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - menuHeight - margin))}px`;
    };
    const openMenu = () => {
      if (open) return;
      open = true;
      button.setAttribute('aria-expanded', 'true');
      mountMenu();
      positionMenu();
      menu.classList.add('rg-yt-menu--open');
    };
    const close = () => {
      clearTimeout(leaveTimer);
      open = false;
      button.setAttribute('aria-expanded', 'false');
      menu.classList.remove('rg-yt-menu--open');
    };
    const enter = () => {
      clearTimeout(leaveTimer);
      openMenu();
    };
    const leave = () => {
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(close, 140);
    };
    button.addEventListener('mouseenter', enter, { signal: this.events.signal });
    button.addEventListener('mouseleave', leave, { signal: this.events.signal });
    button.addEventListener('focus', enter, { signal: this.events.signal });
    button.addEventListener('blur', leave, { signal: this.events.signal });
    menu.addEventListener('mouseenter', enter, { signal: this.events.signal });
    menu.addEventListener('mouseleave', leave, { signal: this.events.signal });
    document.addEventListener('fullscreenchange', () => {
      close();
      mountMenu();
    }, { signal: this.events.signal });
    window.addEventListener('resize', close, { signal: this.events.signal });
    window.addEventListener('scroll', event => {
      if (!menu.contains(event.target)) close();
    }, { signal: this.events.signal, capture: true });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && open) { close(); button.focus(); }
    }, { signal: this.events.signal });
    this.events.signal.addEventListener('abort', close, { once: true });
    return { menu, entries, close };
  },

  appendMenuIcon(button, pathData) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '22');
    icon.setAttribute('height', '22');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'currentColor');
    icon.appendChild(path);
    button.appendChild(icon);
  },

  setupOverflowMenu() {
    const menu = this.createSharedDropdown(this.state.bookmarkButton, 'ReplayGlows', [
      { key: 'openLocal', label: this.t('openLocal'), run: () => this.openInApp('watch') },
      { key: 'openCloud', label: this.t('openCloud'), run: () => this.openInApp('play') },
      { key: 'showSpeed', label: this.t(this.speedBarVisible ? 'hideSpeed' : 'showSpeed'), role: 'menuitemcheckbox', checked: !!this.speedBarVisible, run: () => this.toggleSpeedBar() },
      { key: 'ambilight', label: 'Ambilight', role: 'menuitemcheckbox', checked: !!this.ambilightEnabled, run: () => this.toggleAmbilight() },
    ]);
    this.speedMenuEntry = menu?.entries.get('showSpeed') || null;
    this.ambilightMenuEntry = menu?.entries.get('ambilight') || null;
    this.state.overlayMenu = menu?.menu || null;
  },

  toggleAmbilight() {
    this.ambilightEnabled = !this.ambilightEnabled;
    const entry = this.ambilightMenuEntry;
    entry?.setAttribute('aria-checked', String(this.ambilightEnabled));
    this.ambilightCleanup?.();
    this.setupAmbilight();
    void chrome.storage.local.set({ ambilightEnabled: this.ambilightEnabled });
  },

  setupAmbilight() {
    const video = this.state.currentVideo;
    const player = this.state.player;
    if (!this.ambilightEnabled || !video || !player) return;
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 108;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const originalShadow = player.style.getPropertyValue('box-shadow');
    const originalPriority = player.style.getPropertyPriority('box-shadow');
    const videoContainer = video.closest('.html5-video-container');
    const masthead = document.querySelector('ytd-masthead #container');
    const mastheadImage = masthead?.style.getPropertyValue('background-image') || '';
    const mastheadPriority = masthead?.style.getPropertyPriority('background-image') || '';
    let appliedMastheadImage = '';
    const edges = Object.fromEntries(['top', 'bottom', 'left', 'right'].map(side => {
      const element = document.createElement('canvas');
      element.className = `rg-ambilight-edge rg-ambilight-edge-${side}`;
      element.setAttribute('aria-hidden', 'true');
      element.style.cssText = 'position:absolute;display:none;pointer-events:none;z-index:61;';
      element.width = side === 'top' || side === 'bottom' ? 384 : 2;
      element.height = side === 'left' || side === 'right' ? 216 : 2;
      player.appendChild(element);
      return [side, element];
    }));
    const backdrops = [...new Set([player, videoContainer, video].filter(Boolean))].map(element => ({
      element,
      originalImage: element.style.getPropertyValue('background-image'),
      originalPriority: element.style.getPropertyPriority('background-image'),
      appliedImage: '',
    }));
    let appliedShadow = '';
    let unavailable = false;
    let videoFit = null;
    const fitProperties = ['width', 'height', 'left', 'top', 'object-fit'];
    const restoreVideoFit = () => {
      if (!videoFit) return;
      for (const property of fitProperties) {
        const saved = videoFit.properties[property];
        if (video.style.getPropertyValue(property) !== saved.applied ||
            video.style.getPropertyPriority(property) !== 'important') continue;
        if (saved.value) video.style.setProperty(property, saved.value, saved.priority);
        else video.style.removeProperty(property);
      }
      videoFit = null;
    };
    const fitSmallVideoGap = () => {
      const playerRect = player.getBoundingClientRect();
      if (videoFit) {
        const samePlayer = Math.abs(playerRect.width - videoFit.width) < 0.5 &&
          Math.abs(playerRect.height - videoFit.height) < 0.5;
        const stillApplied = fitProperties.every(property =>
          video.style.getPropertyValue(property) === videoFit.properties[property].applied &&
          video.style.getPropertyPriority(property) === 'important');
        if (samePlayer && stillApplied) return;
        restoreVideoFit();
      }
      const videoRect = video.getBoundingClientRect();
      const topGap = videoRect.top - playerRect.top;
      const bottomGap = playerRect.bottom - videoRect.bottom;
      const leftGap = videoRect.left - playerRect.left;
      const rightGap = playerRect.right - videoRect.right;
      const verticalGap = topGap + bottomGap;
      // YouTube sometimes leaves only a few pixels of its black player visible.
      // Fill that case without cropping portrait videos or intentional letterboxing.
      if (playerRect.width <= 0 || playerRect.height <= 0 || verticalGap <= 1 ||
          topGap < -1 || bottomGap < -1 || verticalGap > playerRect.height * 0.03 ||
          Math.abs(leftGap) > 2 || Math.abs(rightGap) > 2 ||
          getComputedStyle(video).objectFit === 'contain' ||
          (video.videoWidth && video.videoHeight && video.videoWidth < video.videoHeight)) return;
      const target = {
        width: `${Math.ceil(playerRect.width + 2)}px`,
        height: `${Math.ceil(playerRect.height + 2)}px`,
        left: `${video.offsetLeft - leftGap - 1}px`,
        top: `${video.offsetTop - topGap - 1}px`,
        'object-fit': 'cover',
      };
      videoFit = { width: playerRect.width, height: playerRect.height, properties: {} };
      for (const property of fitProperties) {
        videoFit.properties[property] = {
          value: video.style.getPropertyValue(property),
          priority: video.style.getPropertyPriority(property),
          applied: target[property],
        };
        video.style.setProperty(property, target[property], 'important');
      }
    };
    const hideEdges = () => Object.values(edges).forEach(element => { element.style.display = 'none'; });
    const positionEdges = () => {
      fitSmallVideoGap();
      const playerRect = player.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();
      if (!playerRect.width || !playerRect.height || !videoRect.width || !videoRect.height) {
        hideEdges();
        return null;
      }
      let paintedWidth = videoRect.width;
      let paintedHeight = videoRect.height;
      if (getComputedStyle(video).objectFit === 'contain' && video.videoWidth && video.videoHeight) {
        const scale = Math.min(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
        paintedWidth = video.videoWidth * scale;
        paintedHeight = video.videoHeight * scale;
      }
      const left = videoRect.left - playerRect.left + (videoRect.width - paintedWidth) / 2;
      const top = videoRect.top - playerRect.top + (videoRect.height - paintedHeight) / 2;
      const right = left + paintedWidth;
      const bottom = top + paintedHeight;
      const gaps = {
        top: [0, 0, playerRect.width, Math.max(0, top)],
        bottom: [0, bottom, playerRect.width, Math.max(0, playerRect.height - bottom)],
        left: [0, top, Math.max(0, left), paintedHeight],
        right: [right, top, Math.max(0, playerRect.width - right), paintedHeight],
      };
      for (const [side, element] of Object.entries(edges)) {
        const [x, y, width, height] = gaps[side];
        element.style.display = width > 1 && height > 1 ? 'block' : 'none';
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
      }
      return { left, top, paintedWidth, paintedHeight, playerWidth: playerRect.width, playerHeight: playerRect.height };
    };
    const paintEdges = geometry => {
      if (!geometry) return;
      for (const [side, element] of Object.entries(edges)) {
        if (element.style.display === 'none') continue;
        const edgeContext = element.getContext('2d');
        if (!edgeContext) continue;
        const horizontal = side === 'top' || side === 'bottom';
        const offset = horizontal ? geometry.left : geometry.top;
        const painted = horizontal ? geometry.paintedWidth : geometry.paintedHeight;
        const total = horizontal ? geometry.playerWidth : geometry.playerHeight;
        const length = horizontal ? element.width : element.height;
        const start = Math.max(0, Math.min(length, Math.round(offset / total * length)));
        const end = Math.max(start, Math.min(length, Math.round((offset + painted) / total * length)));
        const sourceLength = horizontal ? canvas.width : canvas.height;
        const sourceOffset = side === 'top' || side === 'left' ? 1 : sourceLength - 3;
        const sourceX = horizontal ? 0 : sourceOffset;
        const sourceY = horizontal ? sourceOffset : 0;
        const sourceWidth = horizontal ? canvas.width : 2;
        const sourceHeight = horizontal ? 2 : canvas.height;
        const targetWidth = horizontal ? end - start : element.width;
        const targetHeight = horizontal ? element.height : end - start;
        edgeContext.clearRect(0, 0, element.width, element.height);
        if (end > start) edgeContext.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight,
          horizontal ? start : 0, horizontal ? 0 : start, targetWidth, targetHeight);
        // Extend the video corner pixels into the small areas outside its bounds.
        if (start > 0) edgeContext.drawImage(canvas, sourceX, sourceY, horizontal ? 1 : 2, horizontal ? 2 : 1,
          0, 0, horizontal ? start : element.width, horizontal ? element.height : start);
        if (end < length) edgeContext.drawImage(canvas,
          horizontal ? canvas.width - 1 : sourceX, horizontal ? sourceY : canvas.height - 1,
          horizontal ? 1 : 2, horizontal ? 2 : 1,
          horizontal ? end : 0, horizontal ? 0 : end,
          horizontal ? length - end : element.width, horizontal ? element.height : length - end);
      }
    };
    const clearGlow = () => {
      restoreVideoFit();
      if (appliedShadow && player.style.getPropertyValue('box-shadow') === appliedShadow) {
        if (originalShadow) player.style.setProperty('box-shadow', originalShadow, originalPriority);
        else player.style.removeProperty('box-shadow');
      }
      appliedShadow = '';
      hideEdges();
      if (masthead && appliedMastheadImage && masthead.style.getPropertyValue('background-image') === appliedMastheadImage) {
        if (mastheadImage) masthead.style.setProperty('background-image', mastheadImage, mastheadPriority);
        else masthead.style.removeProperty('background-image');
      }
      appliedMastheadImage = '';
      for (const backdrop of backdrops) {
        if (!backdrop.appliedImage || backdrop.element.style.getPropertyValue('background-image') !== backdrop.appliedImage) continue;
        if (backdrop.originalImage) backdrop.element.style.setProperty('background-image', backdrop.originalImage, backdrop.originalPriority);
        else backdrop.element.style.removeProperty('background-image');
        backdrop.appliedImage = '';
      }
    };
    const sample = () => {
      if (!player.isConnected || !video.isConnected || this.state.currentVideo !== video ||
          document.hidden || document.fullscreenElement || document.pictureInPictureElement ||
          player.classList.contains('ad-showing') || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || unavailable) {
        clearGlow();
        return;
      }
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        const edgeColor = (side, alpha = 0.7) => {
          let red = 0, green = 0, blue = 0, count = 0;
          for (let i = 1; i <= 6; i++) {
            const x = side === 'left' ? 2 : side === 'right' ? canvas.width - 3 : Math.round(i * (canvas.width - 1) / 7);
            const y = side === 'top' ? 2 : side === 'bottom' ? canvas.height - 3 : Math.round(i * (canvas.height - 1) / 7);
            const index = (y * canvas.width + x) * 4;
            red += data[index]; green += data[index + 1]; blue += data[index + 2]; count++;
          }
          return `rgba(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)}, ${alpha})`;
        };
        appliedShadow = [
          `-24px 0 55px 16px ${edgeColor('left')}`,
          `24px 0 55px 16px ${edgeColor('right')}`,
          `0 -24px 55px 16px ${edgeColor('top')}`,
          `0 24px 55px 16px ${edgeColor('bottom')}`,
        ].join(', ');
        player.style.setProperty('box-shadow', appliedShadow, 'important');
        // The shadow sits outside the player; tint the native letterbox inside it too.
        const backgroundImage = `linear-gradient(to bottom, ${edgeColor('top', 1)}, ${edgeColor('bottom', 1)})`;
        for (const backdrop of backdrops) {
          backdrop.element.style.setProperty('background-image', backgroundImage, 'important');
          backdrop.appliedImage = backgroundImage;
        }
        paintEdges(positionEdges());
        if (masthead) {
          if (!document.documentElement.hasAttribute('dark') && !document.querySelector('ytd-app')?.hasAttribute('dark')) {
            appliedMastheadImage = `linear-gradient(90deg, ${edgeColor('left', 0.28)}, ${edgeColor('top', 0.2)}, ${edgeColor('right', 0.28)})`;
            masthead.style.setProperty('background-image', appliedMastheadImage, 'important');
          } else if (appliedMastheadImage && masthead.style.getPropertyValue('background-image') === appliedMastheadImage) {
            if (mastheadImage) masthead.style.setProperty('background-image', mastheadImage, mastheadPriority);
            else masthead.style.removeProperty('background-image');
            appliedMastheadImage = '';
          }
        }
      } catch {
        // Some streams forbid canvas reads. Leave playback unaffected.
        unavailable = true;
        clearGlow();
      }
    };
    const timer = setInterval(sample, 300);
    video.addEventListener('loadeddata', sample);
    video.addEventListener('seeked', sample);
    document.addEventListener('visibilitychange', sample);
    document.addEventListener('fullscreenchange', sample);
    video.addEventListener('enterpictureinpicture', sample);
    video.addEventListener('leavepictureinpicture', sample);
    this.ambilightCleanup = () => {
      clearInterval(timer);
      video.removeEventListener('loadeddata', sample);
      video.removeEventListener('seeked', sample);
      document.removeEventListener('visibilitychange', sample);
      document.removeEventListener('fullscreenchange', sample);
      video.removeEventListener('enterpictureinpicture', sample);
      video.removeEventListener('leavepictureinpicture', sample);
      clearGlow();
      Object.values(edges).forEach(element => element.remove());
      this.ambilightCleanup = null;
    };
    sample();
  },

  setupCaptureMenu() {
    const items = [
      { key: 'copy', icon: 'copy', label: this.t('captureCopy'), run: () => this.runCapture('copy') },
      { key: 'download', icon: 'download', label: this.t('captureDownload'), run: () => this.runCapture('download') },
    ];
    const dropdown = this.createSharedDropdown(this.state.captureButton, this.t('captureFrame'), items, 'rg-yt-menu--capture');
    this.captureMenuEntries = dropdown?.entries || new Map();
    this.state.captureMenu = dropdown?.menu || null;
  },

  async handleCaptureClick() {
    return this.runCapture('automatic');
  },

  async runCapture(action) {
    if (this.captureBusy) return false;
    this.captureBusy = true;
    if (this.state.captureButton) this.state.captureButton.disabled = true;
    try {
      if (action === 'automatic') {
        if (this.captureAuthState?.authenticated === true) return await this.startCloudCapture();
        return await this.completeLocalCapture();
      }
      return await this.captureCurrentFrame(action, null, true);
    } finally {
      this.captureBusy = false;
      if (this.state.captureButton) this.state.captureButton.disabled = false;
    }
  },

  async completeLocalCapture() {
    const saved = await this.captureCurrentFrame('download', null, true);
    if (saved) await this.showLocalCaptureIntro();
    return saved;
  },

  async showLocalCaptureIntro() {
    if (this.captureLocalIntroShown) return;
    this.captureLocalIntroShown = true;
    await chrome.storage.local.set({ captureLocalIntroShown: true });
    this.afficherMessageWithAction(this.t('captureFirstLocal'), this.t('captureConnect'), () => {
      window.open('https://app.replayglows.com/sign-in', '_blank', 'noopener');
    });
  },

  afficherMessageWithAction(message, actionLabel, run) {
    const container = document.createElement('div');
    container.className = 'msg info rg-capture-message';
    const text = document.createElement('span');
    text.textContent = message;
    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = actionLabel;
    action.addEventListener('click', () => { run(); container.remove(); }, { once: true });
    container.append(text, action);
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 8000);
  },

  async startCloudCapture() {
    const video = this.state.currentVideo;
    if (!video || !video.isConnected || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth <= 0 || video.videoHeight <= 0 || this.state.player?.classList.contains('ad-showing')) {
      return this.captureCurrentFrame('download', null, true);
    }
    const target = window.open('about:blank', 'ReplayGlowsCapture');
    if (!target) {
      const saved = await this.captureCurrentFrame('download', null, true);
      this.afficherMessage(this.t(saved ? 'captureCloudFallback' : 'captureError'), saved ? 'info' : 'error');
      if (saved) await this.showLocalCaptureIntro();
      return saved;
    }
    const nonce = crypto.randomUUID();
    let resolveReady;
    let resolveDone;
    const readyPromise = new Promise(resolve => { resolveReady = resolve; });
    const donePromise = new Promise((resolve, reject) => { resolveDone = { resolve, reject }; });
    donePromise.catch(() => {});
    const onMessage = event => {
      if (event.source !== target || event.origin !== 'https://app.replayglows.com' || event.data?.nonce !== nonce) return;
      if (event.data.type === 'RG_CAPTURE_READY') {
        resolveReady(true);
      }
      if (event.data.type === 'RG_CAPTURE_AUTH_REQUIRED') {
        void chrome.storage.local.set({ captureAuthState: { authenticated: false, updatedAt: Date.now() } });
        resolveReady(false);
        resolveDone.reject(new Error('ReplayGlows sign-in required'));
        window.removeEventListener('message', onMessage);
      }
      if (event.data.type === 'RG_CAPTURE_DONE') {
        resolveDone.resolve(true);
        window.removeEventListener('message', onMessage);
      }
      if (event.data.type === 'RG_CAPTURE_ERROR') {
        resolveReady(false);
        resolveDone.reject(new Error('Cloud capture failed'));
        window.removeEventListener('message', onMessage);
      }
    };
    window.addEventListener('message', onMessage);
    target.location = `https://app.replayglows.com/?rg_capture=${encodeURIComponent(nonce)}`;
    await this.captureCurrentFrame('cloud', { target, nonce, readyPromise, donePromise }, true);
    setTimeout(() => {
      if (target.closed) window.removeEventListener('message', onMessage);
    }, 120000);
  },

  async toggleSpeedBar() {
    try {
      await chrome.storage.local.set({ speedBarVisible: !this.speedBarVisible });
    } catch (error) { this.afficherMessage(error.message, 'error'); }
  },

  applySpeedBarVisibility(visible) {
    this.speedBarVisibilityRevision = (this.speedBarVisibilityRevision || 0) + 1;
    this.speedBarVisible = visible === true;
    if (this.speedBarVisible && this.speedBar && !this.speedBar.isConnected) {
      this.speedBarCleanup?.();
      this.state.player = document.querySelector('.html5-video-player');
      this.state.currentVideo = this.state.player?.querySelector('video');
      this.setupSpeedBar();
    }
    if (this.speedBar) this.speedBar.hidden = !this.speedBarVisible;
    this.speedMenuEntry?.setAttribute('aria-checked', String(this.speedBarVisible));
    if (this.speedMenuEntry) this.speedMenuEntry.textContent = this.t(this.speedBarVisible ? 'hideSpeed' : 'showSpeed');
    this.updateSpeedBarLayout?.();
    if (this.speedBarVisible) this.refreshSpeedContext?.();
  },

  async captureCurrentFrame(action = 'download', cloud = null, managed = false) {
    if (!managed) {
      if (this.captureBusy) return false;
      this.captureBusy = true;
      if (this.state.captureButton) this.state.captureButton.disabled = true;
    }
    const video = this.state.currentVideo;
    const videoUrl = this.currentUrl;
    const generation = this.generation;
    const videoId = new URL(videoUrl).searchParams.get('v') || '';
    let fallbackPng = null;
    try {
      if (!video || !video.isConnected || !this.state.player?.contains(video) ||
          window.location.pathname !== '/watch' || !/^[A-Za-z0-9_-]{11}$/.test(videoId) ||
          this.state.player.classList.contains('ad-showing') ||
          this.state.player.querySelector('.ytp-ad-player-overlay') ||
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
          !Number.isFinite(video.currentTime) || video.videoWidth <= 0 || video.videoHeight <= 0) throw new Error('Frame unavailable');
      const time = Math.round(video.currentTime);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      this.flashCapture(video);
      if (action === 'cloud') fallbackPng = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Frame encoding failed')), 'image/png'));
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Frame encoding failed')), action === 'cloud' ? 'image/jpeg' : 'image/png', 0.88));
      if (generation !== this.generation || video !== this.state.currentVideo || videoUrl !== this.currentUrl || blob.type !== (action === 'cloud' ? 'image/jpeg' : 'image/png') || blob.size === 0) throw new Error('Frame became stale');
      if (action === 'copy') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        this.afficherMessage(this.t('captureCopied'), 'info');
        return true;
      } else if (action === 'download') {
        const saved = await this.saveLocalCapture(blob, videoId, time, videoUrl);
        if (saved) this.afficherMessage(this.t('captureLocalSaved'), 'info');
        return saved;
      } else if (action === 'cloud' && cloud) {
        const isReady = await Promise.race([cloud.readyPromise, new Promise(resolve => setTimeout(() => resolve(false), 120000))]);
        if (!isReady || cloud.target.closed) throw new Error('ReplayGlows did not become ready');
        cloud.target.postMessage({
          type: 'RG_FRAME_CAPTURE',
          nonce: cloud.nonce,
          youtubeVideoId: videoId,
          timestamp: time,
          image: blob,
        }, 'https://app.replayglows.com');
        const done = await Promise.race([cloud.donePromise, new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud capture timed out')), 120000))]);
        if (!done) throw new Error('Cloud capture failed');
        this.afficherMessage(this.t('captureCloudSaved'), 'info');
        return true;
      }
    } catch (error) {
      if (action === 'cloud' && fallbackPng && generation === this.generation && video === this.state.currentVideo) {
        const saved = await this.saveLocalCapture(fallbackPng, videoId, time, videoUrl).catch(() => false);
        await chrome.storage.local.set({ captureAuthState: { authenticated: false, updatedAt: Date.now() } }).catch(() => {});
        this.afficherMessage(this.t(saved ? 'captureCloudFallback' : 'captureError'), saved ? 'info' : 'error');
        if (saved) await this.showLocalCaptureIntro();
        return saved;
      }
      this.afficherMessage(action === 'copy' ? this.t('captureCopyError') : action === 'download' ? this.t('captureLocalError') : this.t('captureError'), 'error');
      return false;
    } finally {
      if (!managed) {
        this.captureBusy = false;
        if (this.state.captureButton) this.state.captureButton.disabled = false;
      }
    }
  },

  async saveLocalCapture(blob, videoId, playbackTime, videoUrl) {
    const title = document.querySelector('meta[name="title"]')?.content?.trim() || document.title.replace(/\s+- YouTube$/, '').trim() || videoId;
    const channel = document.querySelector('meta[itemprop="author"]')?.content?.trim() || document.querySelector('ytd-channel-name yt-formatted-string')?.textContent?.trim() || 'YouTube';
    const imageDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Capture encoding failed'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    const result = await chrome.runtime.sendMessage({
      action: 'rg:captureLocal',
      capture: {
        videoId,
        title,
        channel,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        playbackTime,
        capturedAt: new Date().toISOString(),
        imageDataUrl,
      },
    });
    if (!result?.success) throw new Error(result?.error || 'Local capture download failed');
    return true;
  },

  flashCapture(video) {
    const rect = video.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const flash = document.createElement('div');
    flash.className = 'rg-capture-flash';
    flash.setAttribute('aria-hidden', 'true');
    flash.style.left = `${rect.left}px`;
    flash.style.top = `${rect.top}px`;
    flash.style.width = `${rect.width}px`;
    flash.style.height = `${rect.height}px`;
    const remove = () => flash.remove();
    flash.addEventListener('animationend', remove, { once: true });
    (document.fullscreenElement || document.body).appendChild(flash);
    setTimeout(remove, 900);
  },

  seekVideo(time, video = this.state.currentVideo) {
    if (!video || !Number.isFinite(time)) return;
    this.seekQueues ??= new WeakMap();
    let queue = this.seekQueues.get(video);
    if (!queue) {
      queue = { pending: null };
      this.seekQueues.set(video, queue);
      video.addEventListener('seeked', () => {
        const latest = queue.pending;
        if (latest === null) return;
        queue.pending = null;
        if (!video.isConnected || this.state.currentVideo !== video) return;
        if (video.seeking) { queue.pending = latest; return; }
        video.currentTime = latest;
      });
    }
    if (video.seeking) {
      queue.pending = time;
      return;
    }
    queue.pending = null;
    video.currentTime = time;
  },

  setupVideoSplits() {
    const video = this.state.currentVideo;
    const player = this.state.player;
    if (!video || !player) return;
    const events = new AbortController();
    const signal = events.signal;
    let settings = null;
    let active = -1;
    let accumulated = 0;
    let steppedMode = false;
    let brightness = 1;
    let revision = 0;
    const originalFilter = video.style.getPropertyValue('filter');
    const originalPriority = video.style.getPropertyPriority('filter');
    const baseFilter = getComputedStyle(video).filter;
    let ownFilter = null;
    const overlay = document.createElement('div');
    overlay.className = 'rg-video-splits';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    let interactionTimer;
    let idleTimer;
    let fadeTimer;
    let frame;
    const splitIcons = [
      '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path class="rg-icon-waves" style="--phase:0ms" d="M15 8a6 6 0 0 1 0 8"/><path class="rg-icon-waves" style="--phase:-225ms" d="M18 5a10 10 0 0 1 0 14"/>',
      '<circle cx="12" cy="12" r="4"/><path class="rg-icon-rays" style="--phase:-0ms" d="M12 2v2"/><path class="rg-icon-rays" style="--phase:-100ms" d="M19 5l-1.5 1.5"/><path class="rg-icon-rays" style="--phase:-200ms" d="M22 12h-2"/><path class="rg-icon-rays" style="--phase:-300ms" d="M19 19l-1.5-1.5"/><path class="rg-icon-rays" style="--phase:-400ms" d="M12 22v-2"/><path class="rg-icon-rays" style="--phase:-500ms" d="M5 19l1.5-1.5"/><path class="rg-icon-rays" style="--phase:-600ms" d="M2 12h2"/><path class="rg-icon-rays" style="--phase:-700ms" d="M5 5l1.5 1.5"/>',
      '<path d="M4 19a10 10 0 1 1 16 0M3 12h2m14 0h2M12 2v2"/><path class="rg-icon-needle" d="M12 12V5"/><circle cx="12" cy="12" r="1.5"/>',
      '<path d="M3 17h18M3 14v6m18-6v6M9 3l7 4-7 4V3Z"/><circle class="rg-icon-position" cx="12" cy="17" r="2"/>',
    ];
    const bands = Array.from({ length: 4 }, (_, index) => {
      const band = document.createElement('div');
      for (const name of ['above', 'fill', 'threshold']) {
        const layer = document.createElement('div');
        layer.className = `rg-video-split-${name}`;
        band.append(layer);
      }
      const icon = document.createElement('span');
      icon.className = 'rg-video-split-icon';
      icon.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${splitIcons[index]}</svg>`;
      band.append(icon);
      overlay.append(band);
      return band;
    });
    player.append(overlay);
    const rest = () => {
      clearTimeout(interactionTimer);
      overlay.removeAttribute('data-interacting');
      video.classList.remove('rg-video-splits-interacting');
    };
    const reset = () => {
      rest(); clearTimeout(idleTimer); clearTimeout(fadeTimer); cancelAnimationFrame(frame);
      active = -1; accumulated = 0; overlay.hidden = true;
      overlay.classList.remove('rg-video-splits-fading');
    };
    const wake = () => {
      clearTimeout(idleTimer); clearTimeout(fadeTimer);
      overlay.hidden = false;
      overlay.classList.remove('rg-video-splits-fading');
      idleTimer = setTimeout(() => {
        rest(); accumulated = 0;
        overlay.classList.add('rg-video-splits-fading');
        fadeTimer = setTimeout(() => { overlay.hidden = true; cancelAnimationFrame(frame); }, 200);
      }, 1500);
    };
    const restoreBrightness = () => {
      if (ownFilter !== null && video.style.filter === ownFilter) {
        if (originalFilter) video.style.setProperty('filter', originalFilter, originalPriority);
        else video.style.removeProperty('filter');
      }
      ownFilter = null; brightness = 1;
    };
    const render = () => {
      const values = [
        video.muted ? 0 : video.volume,
        (brightness - 0.25) / 1.75,
        (video.playbackRate - 0.25) / 3.75,
        Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : 0,
      ];
      bands.forEach((band, index) => {
        band.classList.toggle('rg-video-split-active', index === active);
        const level = Math.max(0, Math.min(1, values[index]));
        band.style.setProperty('--level', `${level * 100}%`);
        if (index === 0) band.style.setProperty('--wave-opacity', String(0.15 + level * 0.85));
        if (index === 2) band.style.setProperty('--needle-angle', `${-120 + level * 240}deg`);
        if (index === 3) band.style.setProperty('--position-offset', `${-8 + level * 16}px`);
      });
    };
    const animate = () => {
      render();
      if (!signal.aborted && !overlay.hidden) frame = requestAnimationFrame(animate);
    };
    const zone = event => {
      // The actual video only: controls, menus, ads and clickable overlays keep their behavior.
      if (event.target !== video || !settings?.enabled || !settings.videoHoverSplits || !video.isConnected
        || document.hidden || player.classList.contains('ad-showing')
        || !video.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return -1;
      const rect = video.getBoundingClientRect();
      if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX >= rect.right
        || event.clientY < rect.top || event.clientY >= rect.bottom) return -1;
      const parent = player.getBoundingClientRect();
      const scaleX = parent.width / player.offsetWidth || 1;
      const scaleY = parent.height / player.offsetHeight || 1;
      Object.assign(overlay.style, { left: `${(rect.left - parent.left) / scaleX}px`, top: `${(rect.top - parent.top) / scaleY}px`, width: `${rect.width / scaleX}px`, height: `${rect.height / scaleY}px` });
      return Math.min(3, Math.floor((event.clientX - rect.left) / rect.width * 4));
    };
    const select = event => {
      const next = zone(event);
      if (next < 0) { reset(); return false; }
      if (active !== next) { accumulated = 0; rest(); }
      active = next;
      const wasHidden = overlay.hidden;
      wake(); render();
      if (wasHidden) { cancelAnimationFrame(frame); frame = requestAnimationFrame(animate); }
      return true;
    };
    document.addEventListener('pointermove', event => {
      // This document listener is needed for pointer capture edge cases, but almost all
      // page pointer events are irrelevant. Avoid layout and visibility reads off-video.
      if (event.pointerType !== 'mouse' || event.buttons) { reset(); return; }
      if (event.target !== video) return;
      select(event);
    }, { signal, passive: true });
    player.addEventListener('pointerleave', reset, { signal });
    video.addEventListener('pointerleave', reset, { signal });
    window.addEventListener('blur', reset, { signal });
    document.addEventListener('visibilitychange', reset, { signal });
    window.addEventListener('resize', reset, { signal });
    video.addEventListener('emptied', () => { reset(); restoreBrightness(); }, { signal });
    // Read current-video chapter timestamps afresh so SPA navigation cannot reuse old ones.
    const chapterStarts = () => {
      const starts = [];
      for (const track of video.textTracks) {
        if (track.kind === 'chapters') for (const cue of track.cues || []) starts.push(cue.startTime);
      }
      const parseTime = text => {
        const parts = text.trim().split(':');
        return parts.length >= 2 && parts.every(part => /^\d+$/.test(part))
          ? parts.reduce((total, part) => total * 60 + Number(part), 0) : NaN;
      };
      // Chapter panel timestamps (manual and automatic chapters).
      for (const stamp of document.querySelectorAll('ytd-macro-markers-list-item-renderer #time')) {
        starts.push(parseTime(stamp.textContent));
      }
      // Authored chapter links remain available when the chapter panel is closed.
      const videoId = new URL(location.href).searchParams.get('v');
      for (const link of document.querySelectorAll('ytd-watch-metadata #description a[href]')) {
        const url = new URL(link.href, location.href);
        if (url.pathname !== '/watch' || url.searchParams.get('v') !== videoId) continue;
        const timestamp = parseTime(link.textContent);
        const linkedTime = Number(url.searchParams.get('t')?.replace(/s$/, ''));
        if (Number.isFinite(timestamp) && url.searchParams.has('t') && timestamp === linkedTime) starts.push(timestamp);
      }
      const sorted = [...new Set(starts.filter(time => Number.isFinite(time) && time >= 0 && time < video.duration))].sort((a, b) => a - b);
      return sorted.length >= 2 && sorted[0] === 0 ? sorted : [];
    };
    player.addEventListener('wheel', event => {
      if (event.altKey || event.metaKey || event.shiftKey || !event.deltaY || !select(event)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      clearTimeout(interactionTimer);
      overlay.dataset.interacting = 'true';
      video.classList.add('rg-video-splits-interacting');
      interactionTimer = setTimeout(rest, 500);
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      if (steppedMode !== event.ctrlKey) { accumulated = 0; }
      steppedMode = event.ctrlKey;
      const direction = -Math.sign(delta);
      if (event.ctrlKey) {
        if (Math.sign(accumulated) !== Math.sign(delta)) accumulated = 0;
        accumulated += delta;
        const steps = Math.trunc(accumulated / 40);
        if (!steps) return;
        accumulated -= steps * 40;
      } else accumulated = 0;
      const clampedDelta = Math.max(-100, Math.min(100, delta));
      // A normal full wheel notch moves 1% of the controlled range. Smaller
      // high-resolution wheel/trackpad deltas remain proportional. Ctrl keeps
      // the explicit 5% grid below.
      const rangeMotion = -clampedDelta / 10000;
      const positionMotion = -clampedDelta / 100;
      const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
      const stepTo = (value, step) => Number(((direction > 0
        ? Math.floor(value / step + 1e-7) + 1
        : Math.ceil(value / step - 1e-7) - 1) * step).toFixed(6));
      if (active === 0) {
        const current = video.muted ? 0 : video.volume;
        video.volume = clamp(event.ctrlKey ? stepTo(current, 0.05) : current + rangeMotion, 0, 1);
        video.muted = video.volume === 0;
      } else if (active === 1) {
        brightness = clamp(event.ctrlKey ? stepTo(brightness, 0.05) : brightness + rangeMotion * 1.75, 0.25, 2);
        video.style.setProperty('filter', `${baseFilter === 'none' ? '' : baseFilter} brightness(${brightness})`, 'important');
        ownFilter = video.style.filter;
      } else if (active === 2) {
        const request = event.ctrlKey
          ? { action: 'rg:rate', rate: clamp(stepTo(video.playbackRate, 0.05), 0.25, 4) }
          : { action: 'rg:rate', delta: rangeMotion * 3.75 };
        void chrome.runtime.sendMessage(request).then(result => {
          if (!signal.aborted && result?.error) this.afficherMessage(result.error, 'error');
        }).catch(() => { if (!signal.aborted) this.afficherMessage(this.t('speedError'), 'error'); });
      } else if (Number.isFinite(video.duration) && video.duration > 0) {
        if (event.ctrlKey) {
          const chapters = chapterStarts();
          if (!chapters.length) {
            this.afficherMessage(this.locale === 'fr' ? 'Chapitres indisponibles : ouvrez la liste des chapitres de cette vidéo.' : 'Chapters unavailable: open this video’s chapter list.', 'info');
          } else {
            const target = direction > 0
              ? chapters.find(time => time > video.currentTime + 0.05)
              : chapters.findLast(time => time < video.currentTime - 0.05);
            if (target !== undefined) this.seekVideo(target, video);
          }
        } else this.seekVideo(clamp(video.currentTime + positionMotion * 5, 0, video.duration), video);
      }
      render();
    }, { signal, passive: false, capture: true });
    for (const event of ['volumechange', 'ratechange', 'timeupdate']) video.addEventListener(event, render, { signal });
    const apply = context => {
      settings = context?.settings;
      if (!settings?.enabled || !settings.videoHoverSplits) { reset(); restoreBrightness(); }
    };
    const receive = (message, sender) => {
      if (sender.id === chrome.runtime.id && message?.action === 'rg:apply') { revision++; apply(message.context); }
    };
    chrome.runtime.onMessage.addListener(receive);
    const initialRevision = revision;
    void chrome.runtime.sendMessage({ action: 'rg:context' }).then(context => {
      if (!signal.aborted && revision === initialRevision) apply(context);
    }).catch(() => {});
    this.videoSplitsCleanup = () => {
      events.abort(); reset(); restoreBrightness(); overlay.remove();
      chrome.runtime.onMessage.removeListener(receive);
    };
  },

  setupSpeedBar() {
    const controls = this.state.player?.querySelector('.ytp-chrome-controls');
    const left = controls?.querySelector('.ytp-left-controls');
    const right = controls?.querySelector('.ytp-right-controls');
    const video = this.state.currentVideo;
    if (!controls || !left || !right || !video) return;
    const barEvents = new AbortController();
    const signal = barEvents.signal;
    this.events.signal.addEventListener('abort', () => barEvents.abort(), { once: true, signal });
    const bar = document.createElement('div');
    bar.id = 'rg-yt-speedbar';
    bar.className = 'rg-yt-speedbar';
    bar.hidden = !this.speedBarVisible;
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', this.t('speed'));
    const output = document.createElement('output');
    output.className = 'rg-yt-speedbar__value';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0.25'; slider.max = '4'; slider.step = '0.05';
    slider.className = 'rg-yt-speedbar__slider';
    slider.setAttribute('aria-label', this.t('speed'));
    const presets = document.createElement('div');
    presets.className = 'rg-yt-speedbar__presets';
    const error = document.createElement('span');
    error.className = 'rg-yt-speedbar__error';
    error.setAttribute('role', 'status');
    error.hidden = true;
    let scrub = null;
    let pointerX = 0;
    const player = controls.closest('.html5-video-player');
    const videoIdentity = () => `${location.pathname}:${new URL(location.href).searchParams.get('v') || ''}`;
    const sameVideo = gesture => video.isConnected && video.currentSrc === gesture.source
      && videoIdentity() === gesture.identity;
    const clearPreviewWait = gesture => {
      clearTimeout(gesture.previewTimer);
      if (gesture.previewSeeked) video.removeEventListener('seeked', gesture.previewSeeked);
      if (gesture.previewFrame && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(gesture.previewFrame);
      gesture.previewSeeked = null;
      gesture.previewFrame = 0;
      gesture.previewTimer = 0;
    };
    const commitScrub = (gesture, preview = false) => {
      if (!sameVideo(gesture) || gesture.target === gesture.committed) return;
      if (preview && (!gesture.previewReady || video.seeking)) return;
      try {
        if (preview) {
          gesture.previewReady = false;
          const ready = () => {
            clearPreviewWait(gesture);
            gesture.previewReady = true;
          };
          gesture.previewSeeked = () => {
            video.removeEventListener('seeked', gesture.previewSeeked);
            gesture.previewSeeked = null;
            clearTimeout(gesture.previewTimer);
            if (typeof video.requestVideoFrameCallback === 'function') {
              gesture.previewFrame = video.requestVideoFrameCallback(ready);
              gesture.previewTimer = setTimeout(ready, 150);
            } else ready();
          };
          video.addEventListener('seeked', gesture.previewSeeked, { once: true });
          // A decoder can omit seeked or frame callbacks; never leave scrubbing stalled.
          gesture.previewTimer = setTimeout(ready, 500);
        }
        this.seekVideo(gesture.target, video);
        gesture.committed = gesture.target;
      } catch { clearPreviewWait(gesture); gesture.previewReady = true; showError(this.t('speedError')); }
    };
    const stopScrub = () => {
      if (!scrub) return;
      const previous = scrub;
      scrub = null;
      cancelAnimationFrame(previous.frame);
      clearPreviewWait(previous);
      commitScrub(previous);
      player?.classList.remove('rg-speedbar-scrubbing');
      bar.removeAttribute('data-scrubbing');
      slider.min = '0.25'; slider.max = '4'; slider.step = '0.05';
      slider.setAttribute('aria-label', this.t('speed'));
      // Restore mute only on the same video; scrubbing never pauses playback.
      if (sameVideo(previous)) {
        video.muted = previous.muted;
      }
      renderRate();
      this.updateSpeedBarLayout?.();
    };
    let pointerAttached = false;
    let pointerFrozen = false;
    let suppressPointerClick = false;
    const detachPointer = () => {
      stopScrub();
      pointerAttached = false;
      bar.removeAttribute('data-pointer-attached');
      player?.classList.remove('rg-speedbar-pointer-attached');
    };
    let context = null;
    let pendingRate = null;
    let sending = false;
    let pinning = false;
    let refreshInFlight = false;
    const format = value => `${Number(value.toFixed(2))}×`;
    const renderRate = () => {
      if (signal.aborted || scrub) return;
      const rate = video.playbackRate;
      output.textContent = format(rate);
      output.removeAttribute('title');
      if (pendingRate === null && !sending) slider.value = String(rate);
      slider.setAttribute('aria-valuetext', format(Number(slider.value)));
      for (const button of presets.children) button.setAttribute('aria-pressed', String(Number(button.dataset.rate) === rate));
    };
    const request = async message => {
      let timeout;
      try {
        const response = await Promise.race([
          chrome.runtime.sendMessage(message),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(this.t('speedError'))), 5000); }),
        ]);
        if (!response || response.error) throw new Error(response?.error || this.t('speedError'));
        return response;
      } finally { clearTimeout(timeout); }
    };
    const showError = message => {
      if (signal.aborted) return;
      error.textContent = message;
      error.title = message;
      error.hidden = false;
    };
    const applyContext = value => {
      if (signal.aborted || !value?.settings) return;
      context = value;
      if (!value.settings.altSeekOnSpeedBar) stopScrub();
      const disabled = !value.settings.enabled || pinning;
      slider.disabled = disabled;
      if (disabled || !value.settings.attachPointerToSpeedBar) detachPointer();
      for (const button of presets.children) button.disabled = disabled;
      favorite.disabled = disabled;
      favorite.dataset.rate = String(value.settings.favorite);
      favorite.title = `${this.t('favoriteSpeed')} (${format(value.settings.favorite)})`;
      favorite.setAttribute('aria-label', favorite.title);
      pin.disabled = sending || pinning;
      pin.setAttribute('aria-pressed', String(value.pinned));
      pin.title = this.locale === 'fr'
        ? (value.pinned ? 'Désépingler : reprendre la vitesse globale' : 'Épingler la vitesse à cet onglet')
        : (value.pinned ? 'Unpin: use global speed' : 'Pin speed to this tab');
      pin.setAttribute('aria-label', pin.title);
      if (!value.settings.enabled) showError(this.t('speedSuspended'));
      else { error.hidden = true; error.textContent = ''; }
      renderRate();
    };
    // Coalesce fast slider input: one request in flight and only the latest next value.
    const changeRate = async value => {
      pendingRate = value;
      if (!scrub) slider.value = String(value);
      slider.setAttribute('aria-valuetext', format(value));
      if (sending) return;
      sending = true;
      pin.disabled = true;
      try {
        while (pendingRate !== null && !signal.aborted) {
          const rate = pendingRate;
          pendingRate = null;
          applyContext(await request({ action: 'rg:rate', rate }));
        }
      } catch (failure) {
        pendingRate = null;
        showError(failure.message || this.t('speedError'));
      } finally { sending = false; pin.disabled = pinning; renderRate(); }
    };
    for (const rate of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = format(rate);
      button.dataset.rate = String(rate);
      if (rate > 2) button.className = 'rg-yt-speedbar__extended-preset';
      button.addEventListener('click', () => changeRate(rate), { signal });
      presets.appendChild(button);
    }
    const favorite = document.createElement('button');
    favorite.type = 'button'; favorite.className = 'rg-yt-speedbar__favorite';
    favorite.textContent = '★'; favorite.title = this.t('favoriteSpeed');
    favorite.addEventListener('click', () => { if (context) changeRate(context.settings.favorite); }, { signal });
    const pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'rg-yt-speedbar__pin';
    pin.disabled = true;
    pin.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l-1 7 3 3v2h-5v6l-1 2-1-2v-6H6v-2l3-3-1-7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    pin.addEventListener('click', async () => {
      if (!context || sending || pinning) return;
      pinning = true;
      applyContext(context);
      let failureMessage = '';
      try { applyContext(await request({ action: 'rg:pin', pinned: !context.pinned })); }
      catch (failure) { failureMessage = failure.message || this.t('speedError'); }
      finally {
        pinning = false;
        applyContext(context);
        if (failureMessage) showError(failureMessage);
      }
    }, { signal });
    const startScrub = () => {
      if (scrub || !pointerAttached || !context?.settings.altSeekOnSpeedBar || slider.disabled
        || bar.hidden || !slider.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        || !Number.isFinite(video.duration) || video.duration <= 0) return false;
      const rect = slider.getBoundingClientRect();
      const gesture = { originX: pointerX, rect, half: Math.max(1, (rect.width - 16) / 2),
        offset: 0, muted: video.muted,
        source: video.currentSrc, identity: videoIdentity(), last: performance.now(), frame: 0,
        target: video.currentTime, committed: video.currentTime, lastSeek: 0,
        previewReady: true, previewTimer: 0, previewFrame: 0, previewSeeked: null };
      scrub = gesture;
      video.muted = true;
      slider.min = '-100'; slider.max = '100'; slider.step = '1'; slider.value = '0';
      slider.setAttribute('aria-label', this.locale === 'fr' ? 'Reculer ou avancer dans la vidéo' : 'Seek backward or forward');
      slider.setAttribute('aria-valuetext', this.locale === 'fr' ? 'Position neutre' : 'Neutral position');
      output.textContent = '↔ 0';
      bar.dataset.scrubbing = 'true';
      player?.classList.add('rg-speedbar-scrubbing');
      // Clear repetition before seeking, so A–B does not fight reverse movement.
      void request({ action: 'rg:command', command: 'clearLoop' }).catch(failure => {
        if (scrub === gesture) showError(failure.message || this.t('speedError'));
      });
      const tick = now => {
        if (scrub !== gesture) return;
        if (signal.aborted || !sameVideo(gesture) || !bar.isConnected
          || document.hidden || bar.hidden || !slider.checkVisibility({ checkVisibilityCSS: true })) {
          detachPointer(); return;
        }
        const elapsed = Math.min((now - scrub.last) / 1000, 0.1);
        scrub.last = now;
        // Fine control near the center; traverse even a long video in six seconds at the edge.
        const magnitude = Math.max(0, (Math.abs(scrub.offset) - 0.1) / 0.9);
        const maximum = Math.max(30, video.duration / 6);
        const velocity = Math.sign(scrub.offset) * (2 * magnitude + (maximum - 2) * magnitude ** 3);
        scrub.target = Math.max(0, Math.min(video.duration, scrub.target + velocity * elapsed));
        // Accumulate every frame, but request another preview after the previous
        // seek has produced a frame (or a bounded fallback). Release stays exact.
        if (now - scrub.lastSeek >= 100) {
          commitScrub(scrub, true);
          scrub.lastSeek = now;
        }
        const speed = Math.abs(velocity);
        const compactSpeed = speed >= 1000 ? `${(speed / 1000).toFixed(1)}k`
          : speed >= 100 ? speed.toFixed(0) : speed.toFixed(1);
        const velocityLabel = `${velocity.toFixed(1)} ${this.locale === 'fr' ? 'secondes par seconde' : 'seconds per second'}`;
        output.textContent = velocity === 0 ? '↔ 0' : `${velocity < 0 ? '←' : '→'} ${compactSpeed}`;
        output.title = velocityLabel;
        slider.setAttribute('aria-valuetext', velocityLabel);
        scrub.frame = requestAnimationFrame(tick);
      };
      scrub.frame = requestAnimationFrame(tick);
      return true;
    };
    document.addEventListener('pointerdown', event => {
      if (scrub) { detachPointer(); return; }
      // Confirm the current hovered value, without a native range jump or player click.
      if (event.pointerType === 'mouse' && event.button === 0
        && (pointerAttached || (pointerFrozen && event.target === slider))
        && !event.target?.closest('button, a')) {
        pointerFrozen = true;
        suppressPointerClick = true;
        detachPointer();
        event.preventDefault();
        event.stopPropagation();
      }
    }, { signal, capture: true });
    document.addEventListener('click', event => {
      if (!suppressPointerClick) return;
      suppressPointerClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, { signal, capture: true });
    document.addEventListener('pointercancel', () => { suppressPointerClick = false; }, { signal });
    document.addEventListener('keydown', event => {
      if (scrub && event.key !== 'Alt') { detachPointer(); return; }
      if (event.defaultPrevented || event.key !== 'Alt' || event.repeat || event.ctrlKey || event.shiftKey || event.metaKey
        || event.target?.closest('textarea, select, [contenteditable="true"], input:not([type="range"])')) return;
      if (startScrub()) { event.preventDefault(); event.stopPropagation(); }
    }, { signal, capture: true });
    document.addEventListener('keyup', event => {
      if (event.key === 'Alt' && scrub) {
        event.preventDefault(); event.stopPropagation(); detachPointer();
      }
    }, { signal, capture: true });
    slider.addEventListener('input', () => { if (!scrub) void changeRate(Number(slider.value)); }, { signal });
    // Acquire only over the slider; retain attachment within a forgiving margin.
    // Never lock the OS pointer or intercept neighboring buttons.
    document.addEventListener('pointermove', event => {
      if (pointerFrozen) {
        const bounds = bar.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) pointerFrozen = false;
        return;
      }
      if (event.pointerType !== 'mouse' || event.buttons || !context?.settings.attachPointerToSpeedBar
        || slider.disabled || bar.hidden || !bar.isConnected || document.hidden) {
        detachPointer();
        return;
      }
      pointerX = event.clientX;
      const rect = slider.getBoundingClientRect();
      if (scrub) {
        const offset = (event.clientX - scrub.originX) / scrub.half;
        if (!event.altKey
          || event.clientY < scrub.rect.top - 32 || event.clientY > scrub.rect.bottom + 32) {
          detachPointer(); return;
        }
        scrub.offset = Math.max(-1, Math.min(1, offset));
        if (Math.abs(scrub.offset) <= 0.1) commitScrub(scrub);
        slider.value = String(Math.round(scrub.offset * 100));
        return;
      }
      const visible = slider.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const margin = pointerAttached ? 32 : 0;
      if (!visible || rect.width <= 0 || target?.closest('button, a, [role="menu"]')
        || event.clientX < rect.left - margin || event.clientX > rect.right + margin
        || event.clientY < rect.top - margin || event.clientY > rect.bottom + margin
        || (!pointerAttached && target !== slider)) {
        detachPointer();
        return;
      }
      pointerAttached = true;
      bar.dataset.pointerAttached = 'true';
      player?.classList.add('rg-speedbar-pointer-attached');
      const inset = Math.min(8, rect.width / 2);
      const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left - inset) / Math.max(1, rect.width - 2 * inset)));
      const rate = Number((0.25 + Math.round(fraction * 75) * 0.05).toFixed(2));
      if (Number(slider.value) !== rate) void changeRate(rate);
    }, { signal, passive: true });
    window.addEventListener('blur', detachPointer, { signal });
    document.addEventListener('visibilitychange', detachPointer, { signal });
    document.addEventListener('pointerout', event => { if (!event.relatedTarget) detachPointer(); }, { signal });
    video.addEventListener('ratechange', renderRate, { signal });
    for (const type of ['click', 'dblclick', 'pointerdown', 'keydown', 'keyup']) {
      bar.addEventListener(type, event => event.stopPropagation(), { signal });
    }
    bar.append(output, slider, presets, favorite, pin, error);
    controls.appendChild(bar);
    this.speedBar = bar;
    const layout = () => {
      if (signal.aborted) return;
      // Time-display width changes during seeking must not move or hide the gesture surface.
      if (scrub) return;
      const outer = controls.getBoundingClientRect();
      // YouTube's flex:1 left group includes the empty space. Measure its
      // visible controls instead of treating the whole group as occupied.
      const occupiedRight = Math.max(outer.left, ...Array.from(left.children)
        .map(element => element.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => rect.right));
      const end = right.getBoundingClientRect();
      const scale = outer.width / controls.offsetWidth || 1;
      const available = Math.max(0, (end.left - occupiedRight) / scale - 16);
      bar.style.left = `${(occupiedRight - outer.left) / scale + 8}px`;
      bar.style.width = `${available}px`;
      bar.classList.toggle('rg-yt-speedbar--limited', available < 600);
      bar.classList.toggle('rg-yt-speedbar--compact', available < 380);
      bar.classList.toggle('rg-yt-speedbar--tiny', available < 190);
      bar.hidden = !this.speedBarVisible || available < 125;
      if (bar.hidden) detachPointer();
    };
    const observer = new ResizeObserver(layout);
    const observeControls = () => {
      for (const element of [controls, left, right, ...left.children, ...right.children]) observer.observe(element);
      layout();
    };
    const mutations = new MutationObserver(observeControls);
    mutations.observe(left, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    mutations.observe(right, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    observeControls();
    this.updateSpeedBarLayout = layout;
    const refresh = async () => {
      if (refreshInFlight || signal.aborted) return;
      refreshInFlight = true;
      try { applyContext(await request({ action: 'rg:context' })); }
      catch (failure) { showError(failure.message || this.t('speedError')); }
      finally { refreshInFlight = false; }
    };
    this.refreshSpeedContext = refresh;
    const receive = (message, sender) => {
      if (sender.id === chrome.runtime.id && message?.action === 'rg:apply') applyContext(message.context);
    };
    chrome.runtime.onMessage.addListener(receive);
    this.speedBarCleanup = () => {
      detachPointer();
      barEvents.abort();
      observer.disconnect();
      mutations.disconnect();
      chrome.runtime.onMessage.removeListener(receive);
      bar.remove();
      this.speedBar = null;
      this.updateSpeedBarLayout = null;
      this.refreshSpeedContext = null;
    };
    renderRate(); layout(); refresh();
  },

  /**
   * Opens the current video inside the ReplayGlows app page, either in the
   * local player or in the connected (cloud) play screen.
   */
  openInApp(routeName) {
    const id = new URL(window.location.href).searchParams.get('v');
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || !['watch', 'play'].includes(routeName)) return;
    const currentTime = this.currentVideoTime;
    const time = Number.isFinite(currentTime) ? Math.max(0, Math.round(currentTime)) : 0;
    const generation = this.generation;
    const onError = message => {
      if (generation === this.generation) this.afficherMessage(message, 'error');
    };
    try {
      chrome.runtime.sendMessage({ action: 'rg:openApp', route: routeName, videoId: id, time }, response => {
        const error = chrome.runtime.lastError;
        if (error || !response?.success) onError(this.t('openError'));
      });
    } catch { onError(this.t('openError')); }
  },

  /**
   * Handles click interactions on the bookmark button or progress bar.
   * Implements a multi-click detection system:
   * - Single click on button: Toggle input visibility or save bookmark
   * - Double click on button: Quick save bookmark
   * - Double click on progress bar: Add bookmark at clicked position
   * - Triple click: Quick save bookmark
   * 
   * Uses a 400ms timeout to distinguish between single and multiple clicks.
   */
  async handleAddBookmark(event, target) {
    if (!this.state.currentVideo || !this.state.progressBar) return;
    const previous = this.clickGesture;
    const now = Date.now();
    const count = previous?.target === target && now - previous.at < 400 ? previous.count + 1 : 1;
    clearTimeout(previous?.timer);
    const generation = this.generation;
    const video = this.state.currentVideo;
    const gesture = { target, count, at: now };
    this.clickGesture = gesture;
    // A normal timeline click belongs to YouTube; only repeated clicks add a note.
    const rect = this.state.progressBar.getBoundingClientRect();
    const clickedTime = target === this.state.progressBar && rect.width && Number.isFinite(video.duration)
      ? Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * video.duration)
      : Math.round(this.currentVideoTime);
    gesture.timer = setTimeout(async () => {
      if (this.clickGesture !== gesture || generation !== this.generation || video !== this.state.currentVideo) return;
      this.clickGesture = null;
      if (target === this.state.progressBar && count === 1) return;
      if (target === this.state.progressBar) video.currentTime = clickedTime;
      if (count === 1 || (count === 2 && target === this.state.progressBar)) {
        if (this.state.bookmarkInputContainer) await this.saveBookmark(this.state.bookmarkInputElement?.value || '');
        else await this.addBookmark();
      } else if (count >= 2) {
        await this.saveBookmark(this.state.bookmarkInputElement?.value || '');
      }
    }, 500);
  },

  /**
   * Creates and displays the bookmark input container above the progress bar.
   * The container is positioned at the current video time position and includes:
   * - A text input for optional notes
   * - Optional add/cancel buttons (based on user settings)
   * 
   * Handles edge cases for container positioning to prevent overflow off-screen.
   * Manages video pause/resume state during input.
   */
  async addBookmark() {
    if (this.state.bookmarkInputContainer) { this.state.bookmarkInputElement?.focus(); return; }
    if (!this.state.currentVideo || !this.state.progressBar) return;
    const generation = this.generation;
    this.bookmarkVideo = this.state.currentVideo;
    this.bookmarkUrl = this.currentUrl;
    this.bookmarkWasPlaying = !this.bookmarkVideo.paused;
    this.state.wasPlayingBeforeBookmark = this.bookmarkWasPlaying;
    this.state.bookmarkTime = Math.round(this.currentVideoTime);
    this.state.currentVideo.pause();
    if (!this.state.bookmarkInputContainer) {
      const progressBar = this.state.progressBar;
      const rect = progressBar.getBoundingClientRect();
      const inputContainer = document.createElement('div');
      this.state.bookmarkContainerVisible = true;
      inputContainer.className = this.CONSTANTS.BOOKMARK_INPUT_CONTAINER_CLASS;
      inputContainer.classList.add("iso", "grad-ult-bg-white-lg", "tbflwz");
      
      // Calculate horizontal position based on current video time
      const positionRatio = this.currentVideoTime / this.state.currentVideo.duration;
      let leftPosition = positionRatio * 100;
      const containerWidth = 220;
      const playerWidth = this.state.player.offsetWidth;
      
      // Clamp position to prevent container from going off-screen
      const minPosition = (containerWidth / 2 / playerWidth) * 100;
      const maxPosition = 100 - minPosition;

      leftPosition = Math.max(minPosition, Math.min(leftPosition, maxPosition));
      inputContainer.style.left = `${leftPosition}%`;
      inputContainer.style.top = `${rect.top + window.scrollY}px`;
      inputContainer.style.width = '220px';
      inputContainer.style.height = '30px';
      inputContainer.style.borderRadius = '0.5rem';
      inputContainer.style.border = 'none';
      inputContainer.style.padding = '2px';
      inputContainer.style.position = 'absolute';
      inputContainer.style.transform = 'translateY(-150%)';

      const noteInput = document.createElement('input');
      noteInput.type = 'text';
      noteInput.className = 'bookmark-input';
      noteInput.placeholder = this.t('notePlaceholder');
      noteInput.setAttribute('aria-label', this.t('noteLabel'));
      noteInput.style.border = 'none';
      noteInput.style.outline = 'none';
      inputContainer.appendChild(noteInput);
      this.state.bookmarkInputContainer = inputContainer;

      // Check user preference for showing add/cancel buttons
      const { showBookmarkButtons } = await new Promise(resolve =>
        chrome.storage.local.get({ showBookmarkButtons: true }, resolve)
      );
      if (generation !== this.generation || this.bookmarkVideo !== this.state.currentVideo) {
        inputContainer.remove();
        this.restoreBookmarkPlayback();
        return;
      }

      if (showBookmarkButtons) {
        const addButton = document.createElement('button');
        addButton.textContent = '+';
        addButton.style.marginRight = '5px';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'x';

        inputContainer.append(addButton, cancelButton);

        addButton.onclick = () => {
          this.saveBookmark(noteInput.value);
        };
        cancelButton.onclick = () => this.closeBookmarkInput();
      }

      document.body.appendChild(inputContainer);
      this.state.bookmarkInputContainer = inputContainer;
      this.state.bookmarkInputElement = noteInput;
      noteInput.focus();
      
      // Handle clicks outside the input container to close it
      const handleOutsideClick = (e) => {
        if (this.state.bookmarkInputContainer) {
          // If clicking on the player, toggle play/pause based on previous state
          if (e.target == this.state.player) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.state.wasPlayingBeforeBookmark ? this.state.currentVideo.play() : this.state.currentVideo.pause();
          }
          // Close if clicking outside container and not on bookmark controls
          if (!this.state.bookmarkInputContainer.contains(e.target) && 
              e.target !== this.state.bookmarkButton && 
              e.target !== this.state.progressBar) {
            this.closeBookmarkInput();
          }
        }
        document.removeEventListener('click', handleOutsideClick);
      };

      document.addEventListener('click', handleOutsideClick, { signal: this.events.signal });

      // Prevent clicks inside container from bubbling up
      inputContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });

      // Handle keyboard shortcuts within the input
      noteInput.addEventListener('keydown', e => {
        e.stopPropagation(); // Prevent YouTube's keyboard shortcuts
        if (e.key === 'Escape') {

          this.closeBookmarkInput();
        }
        if (e.key === 'Enter') {

          this.saveBookmark(noteInput.value);
        }
      });
    }
  },

  /**
   * Formats a duration in seconds to a human-readable time string.
   * Handles videos of any length (minutes, hours, or longer).
   * 
   * @param {number} seconds - The time value in seconds
   * @returns {string} Formatted time string (e.g., "1:23" or "1:02:45")
   */
  formatTime(seconds) {
    seconds = Math.round(seconds);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`; // HH:MM:SS
    } else {
      return `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`; // MM:SS
    }
  },

  /**
   * Persists a new bookmark to Chrome storage.
   * Prevents duplicate bookmarks at the same URL and timestamp.
   * Updates both the full bookmark list and the current-video-only list.
   * 
   * @param {string} note - Optional note text to attach to the bookmark
   */
  async saveBookmark(note = '') {
    if (!this.state.currentVideo) return;
    const editor = this.state.bookmarkInputContainer;
    const generation = this.generation;
    const video = this.state.currentVideo;
    const bookmark = {
      time: this.state.bookmarkTime ?? Math.round(this.currentVideoTime),
      url: this.currentUrl, note,
      title: document.querySelector('ytd-watch-metadata h1')?.textContent?.trim() || document.title.replace(/ - YouTube$/, ''),
      channel: document.querySelector('#owner #channel-name a, ytd-channel-name a')?.textContent?.trim() || 'YouTube'
    };
    try {
      const response = await chrome.runtime.sendMessage({ action: 'addBookmark', bookmark });
      if (response.error) throw new Error(response.error);
      // A delayed save belongs to its original editor, never a replacement after navigation.
      if (generation === this.generation && editor === this.state.bookmarkInputContainer && video === this.state.currentVideo) {
        await this.closeBookmarkInput();
      }
      if (generation !== this.generation || video !== this.state.currentVideo) return;
      await this.refreshBookmarks();
      if (generation !== this.generation || video !== this.state.currentVideo) return;
      this.afficherMessage(this.t('saved'));
    } catch (error) { this.afficherMessage(error.message, 'error'); }
  },

  async refreshBookmarks() {
    const generation = this.generation;
    const url = this.currentUrl;
    const response = await chrome.runtime.sendMessage({ action: 'getBookmarks' });
    if (generation !== this.generation || url !== this.currentUrl) return;
    if (response.error) { this.afficherMessage(response.error, 'error'); return; }
    const bookmarks = response.bookmarks || [];
    this.state.bookmarks = bookmarks;
    this.state.bookmarksForThisUrl = bookmarks.filter(b => b.url === url).sort((a, b) => a.time - b.time);
    if (window.location.pathname === '/watch') await this.updateUIElements();
  },

  /**
   * Refreshes all bookmark-related UI elements.
   * Called after adding, deleting, or navigating between bookmarks.
   */
  async updateUIElements() {
    await this.loadBookmarks();
    await this.updateBookmarksList();
  },

  /**
   * Closes and cleans up the bookmark input container.
   * Resumes video playback if it was playing before opening the input.
   */
  async closeBookmarkInput() {
    this.restoreBookmarkPlayback();
    this.state.bookmarkButton?.focus();
    return;
  },

  /**
   * Loads bookmark icons onto the video progress bar.
   * Clears existing icons first to prevent duplicates, then adds an icon
   * for each bookmark at its corresponding position on the timeline.
   */
  async loadBookmarks() {
    this.dragCleanup?.();
    // Remove all existing bookmark icons before reloading
    this.state.player?.querySelectorAll(`.${this.CONSTANTS.BOOKMARK_ICON_CONTAINER_CLASS}`).forEach(el => el.remove());
    try {
      this.state.bookmarksForThisUrl.forEach(bookmark => {
        try {
          this.addBookmarkIcon(bookmark);
        } catch (error) {
          console.error("Erreur lors de l'ajout de l'icône du marque-page:", error);
        }
      });
    } catch (error) {
      console.error("loadBookmarks Erreur du chargement des marque-pages pour cette url:", error);
    }
  },

  /**
   * Creates and positions a draggable bookmark icon on the progress bar.
   * Each icon includes:
   * - Visual marker at the bookmark's timestamp position
   * - Info popup showing time and note on hover
   * - Delete button
   * - Drag-and-drop support for repositioning bookmarks
   * 
   * @param {Object} bookmark - The bookmark data object
   */
  async addBookmarkIcon(bookmark) {
    if (!this.state.progressBar || !this.state.currentVideo) {
      this.afficherMessage(this.t('missingPlayer'), 'error');
      return;
    }

    // Create container for the bookmark icon and its info popup
    const iconContainer = document.createElement('div');
    iconContainer.className = this.CONSTANTS.BOOKMARK_ICON_CONTAINER_CLASS;
    // Position based on bookmark time relative to video duration
    iconContainer.style.left = `${(bookmark.time / this.state.currentVideo.duration) * 100}%`;
    iconContainer.style.zIndex = '9999'; 

    const icon = document.createElement('button');
    icon.type = 'button';
    icon.setAttribute('aria-label', this.t('playAt', { time: this.formatTime(bookmark.time) }));
    icon.className = this.CONSTANTS.BOOKMARK_ICON_CLASS;

    // Info container shows on hover with bookmark details
    const infoContainer = document.createElement('div');
    infoContainer.className = 'custom-bookmark-info-container';/* 
    infoContainer.style.maxWidth = '110px';
    infoContainer.style.overflow = 'hidden';

    // Expandable toggle functionality (commented out but kept for reference)
    const toggleArrow = document.createElement('span');
    toggleArrow.textContent = '▼';
    toggleArrow.style.cursor = 'pointer';
    ...
    */

    iconContainer.appendChild(icon);
    iconContainer.appendChild(infoContainer);
    this.state.progressBar.appendChild(iconContainer);

    // Delete icon for removing this bookmark
    const deleteIcon = document.createElement('button');
    deleteIcon.type = 'button';
    deleteIcon.setAttribute('aria-label', this.t('deleteOne'));
    deleteIcon.className = this.CONSTANTS.BOOKMARK_DELETE_ICON_CLASS;
    deleteIcon.innerHTML = '🗑️';
    infoContainer.appendChild(deleteIcon);
    
    if (bookmark.note && bookmark.note.trim() !== '') {
      const noteText = document.createElement('span');
      noteText.className = 'custom-bookmark-note';
      noteText.textContent = bookmark.note;
    }
    const formattedTime = this.formatTime(bookmark.time);
    
    // Build the info popup content
    const newContent = document.createElement('div');
    newContent.className = 'flex items-center gap-4 flex-row justify-between';

    // Add formatted timestamp link
    const timeSpan = document.createElement('span');
    timeSpan.className = 't cursor-pointer bookmark-tooltip-time';
    timeSpan.textContent = `🕓 ${formattedTime}`;
    newContent.appendChild(timeSpan);

    // Add note text if present
    if (bookmark.note && bookmark.note.trim() !== '') {
      const noteText = document.createElement('span');
      noteText.className = 't bookmark-tooltip-note';
      noteText.textContent = bookmark.note;
      newContent.appendChild(noteText);
    }

    newContent.appendChild(deleteIcon);
    infoContainer.appendChild(newContent);
    const positionTooltip = () => {
      const marker = iconContainer.getBoundingClientRect();
      const player = this.state.player.getBoundingClientRect();
      const width = infoContainer.getBoundingClientRect().width;
      const left = Math.max(player.left, Math.min(marker.left + marker.width / 2 - width / 2, player.right - width));
      infoContainer.style.left = `${left - marker.left}px`;
    };
    iconContainer.addEventListener('mouseenter', positionTooltip);
    iconContainer.addEventListener('focusin', positionTooltip);

    // Drag-and-drop functionality for repositioning bookmarks
    let isDragging = false;
    let moved = false;
    let dragStartX, dragStartLeft, dragStartTime;

    /**
     * Initiates drag operation when user starts dragging the icon.
     */
    const startDragging = (e) => {
      if (e.button !== 0 || infoContainer.contains(e.target)) return;
      this.dragCleanup?.();
      e.stopPropagation();
      isDragging = true;
      moved = false;
      dragStartX = e.clientX;
      const markerRect = iconContainer.getBoundingClientRect();
      dragStartLeft = markerRect.left + markerRect.width / 2 - this.state.progressBar.getBoundingClientRect().left;
      dragStartTime = bookmark.time;
      iconContainer.classList.add('dragging');
      this.dragCleanup = cleanupDrag;
      document.addEventListener('mousemove', dragBookmark);
      document.addEventListener('mouseup', stopDragging);
      e.preventDefault();
    };

    /**
     * Updates icon position during drag, clamped to progress bar bounds.
     */
    const dragBookmark = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX;
      if (Math.abs(deltaX) > 3) moved = true;
      const newLeft = dragStartLeft + deltaX;
      const progressBarRect = this.state.progressBar.getBoundingClientRect();
      const minLeft = 0;
      const maxLeft = progressBarRect.width;
      const clampedLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
      iconContainer.style.left = `${(clampedLeft / progressBarRect.width) * 100}%`;
    };
    
    /**
     * Completes drag operation and updates bookmark time if moved significantly.
     * Requires at least 5 seconds of movement to prevent accidental changes.
     */
    const generation = this.generation;
    const video = this.state.currentVideo;
    const cleanupDrag = () => {
      if (isDragging && Number.isFinite(video?.duration) && video.duration > 0)
        iconContainer.style.left = `${(dragStartTime / video.duration) * 100}%`;
      isDragging = false;
      iconContainer.classList.remove('dragging');
      document.removeEventListener('mousemove', dragBookmark);
      document.removeEventListener('mouseup', stopDragging);
      if (this.dragCleanup === cleanupDrag) this.dragCleanup = null;
    };
    const stopDragging = async (e) => {
      if (generation !== this.generation || video !== this.state.currentVideo) return cleanupDrag();
      isDragging = false;
      iconContainer.classList.remove('dragging');
      document.removeEventListener('mousemove', dragBookmark);
      document.removeEventListener('mouseup', stopDragging);
      if (this.dragCleanup === cleanupDrag) this.dragCleanup = null;

      if (!moved) return;
      const newRatio = parseFloat(iconContainer.style.left) / 100;
      const newTime = newRatio * this.state.currentVideo.duration;

      // Only update if moved more than 5 seconds to prevent accidental changes
      if (Math.abs(newTime - dragStartTime) > 5) {
        const updated = { ...bookmark, time: Math.round(newTime), formattedTime: this.formatTime(newTime) };
        try {
          const response = await chrome.runtime.sendMessage({ action: 'updateBookmark', bookmark: updated, originalTime: dragStartTime });
          if (response.error) throw new Error(response.error);
          if (generation !== this.generation || video !== this.state.currentVideo) return;
          await this.refreshBookmarks();
        } catch (error) {
          if (generation !== this.generation || video !== this.state.currentVideo) return;
          console.error("Erreur lors de la mise à jour du marque-page:", error);
          // Revert to original position on error
          iconContainer.style.left = `${(dragStartTime / this.state.currentVideo.duration) * 100}%`;
        }
      } else {
        // Snap back to original position if moved less than 5 seconds
        iconContainer.style.left = `${(dragStartTime / this.state.currentVideo.duration) * 100}%`;
      }
    };

    iconContainer.addEventListener('mousedown', startDragging);
    iconContainer.addEventListener('click', e => {
      e.stopPropagation();
      if (!moved && !infoContainer.contains(e.target)) this.state.currentVideo.currentTime = bookmark.time;
    });

    deleteIcon.addEventListener('click', (e) => {

      e.stopPropagation();
      this.deleteBookmark(bookmark);
    });
  },
  
  /**
   * Updates the bookmarks list displayed in the YouTube sidebar.
   * Creates an expandable/collapsible panel showing all bookmarks for the current video.
   * Includes timestamp links, notes, and delete functionality for each bookmark.
   */
  async updateBookmarksList() {
    const generation = this.listGeneration = (this.listGeneration || 0) + 1;
    const parent = this.state.parentContainer || document.querySelector('#secondary-inner, #below');
    if (!parent) return;
    document.querySelectorAll('.bookmarks-list').forEach(el => el.remove());
    const list = document.createElement('section');
    list.className = 'bookmarks-list sct spc-md';
    list.setAttribute('aria-label', this.t('listLabel'));
    const title = document.createElement('h3');
    title.textContent = this.state.bookmarksForThisUrl.length ? this.t('listTitle') : this.t('listEmpty');
    list.append(title);
    const rows = document.createElement('div');
    rows.className = 'bookmarks-container';
    this.expandedVideoUrls ||= new Set();
    const url = this.currentUrl;
    if (this.state.bookmarksForThisUrl.length) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = title.textContent;
      const expanded = this.expandedVideoUrls.has(url);
      toggle.setAttribute('aria-expanded', String(expanded));
      rows.hidden = !expanded;
      toggle.onclick = () => {
        rows.hidden = !rows.hidden;
        toggle.setAttribute('aria-expanded', String(!rows.hidden));
        if (rows.hidden) this.expandedVideoUrls.delete(url); else this.expandedVideoUrls.add(url);
      };
      title.replaceChildren(toggle);
      const removeVideo = document.createElement('button');
      removeVideo.type = 'button'; removeVideo.className = 'delete-video';
      removeVideo.textContent = this.t('deleteVideo');
      removeVideo.dataset.url = url;
      removeVideo.onclick = event => this.deleteVideo(event);
      list.append(removeVideo);
    }
    list.append(rows);
    const { hideNotesByDefault = false } = await chrome.storage.local.get('hideNotesByDefault');
    if (generation !== this.listGeneration) return;
    for (const bookmark of [...this.state.bookmarksForThisUrl].sort((a, b) => a.time - b.time)) {
      const row = document.createElement('div'); row.className = 'bookmark-item flex items-center justify-between';
      const seek = document.createElement('button'); seek.className = 'timestamp'; seek.type = 'button';
      seek.textContent = this.formatTime(bookmark.time); seek.dataset.time = bookmark.time;
      seek.setAttribute('aria-label', this.t('seekAt', { time: this.formatTime(bookmark.time) }));
      seek.onclick = () => { this.state.currentVideo.currentTime = bookmark.time; };
      const note = document.createElement('span'); note.textContent = bookmark.note; note.hidden = hideNotesByDefault;
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'edit-bookmark'; edit.textContent = this.t('edit');
      edit.onclick = () => {
        const input = document.createElement('input'); input.value = bookmark.note; input.setAttribute('aria-label', this.t('editNote'));
        const save = document.createElement('button'); save.type = 'button'; save.textContent = this.t('save');
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = this.t('cancel'); cancel.onclick = () => this.updateBookmarksList();
        save.onclick = async () => {
          save.disabled = true;
          try {
            const response = await chrome.runtime.sendMessage({ action: 'updateBookmark', bookmark: { ...bookmark, note: input.value } });
            if (response.error) throw new Error(response.error);
            await this.refreshBookmarks();
          } catch (error) { this.afficherMessage(error.message, 'error'); save.disabled = false; }
        };
        input.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') save.click(); if (e.key === 'Escape') cancel.click(); };
        row.replaceChildren(input, save, cancel); input.focus();
      };
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-bookmark'; remove.textContent = this.t('delete'); remove.onclick = () => this.deleteBookmark(bookmark);
      row.append(seek, note, edit, remove); rows.append(row);
    }
    document.querySelectorAll('.bookmarks-list').forEach(el => el.remove());
    parent.prepend(list); this.state.bookmarksList = list;
  },

  /**
   * Removes a bookmark from storage and updates all related UI elements.
   * Updates both the global bookmarks list and the current-video-only list.
   * 
   * @param {Object} bookmark - The bookmark to delete (must have url and time)
   */
  async deleteBookmark(bookmark) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'deleteBookmark', bookmark });
      if (response.error) throw new Error(response.error);
      await this.refreshBookmarks();
    } catch (error) { this.afficherMessage(error.message, 'error'); }
  },

  /**
   * Navigates to the previous or next bookmark in the video timeline.
   * For 'prev', finds the nearest bookmark before current time (with 3s buffer).
   * For 'next', finds the nearest bookmark after current time.
   * 
   * @param {string} direction - 'prev' or 'next'
   */
  async navigateBookmarks(direction) {
    const bookmarks = [...this.state.bookmarksForThisUrl].sort((a, b) => a.time - b.time);
    const current = this.currentVideoTime;
    const target = direction === 'prev' ? bookmarks.filter(b => b.time < current - 1).pop() : bookmarks.find(b => b.time > current + 1);
    if (target && this.state.currentVideo) this.state.currentVideo.currentTime = target.time;
  },

  /**
   * Deletes all bookmarks for a specific video.
   * Sends a message to the background script to handle storage updates.
   * 
   * @param {Event} event - Click event with data-url attribute on target
   */
  async deleteVideo(event) {
    const url = event.currentTarget.dataset.url;
    try {
      const response = await chrome.runtime.sendMessage({ action: 'deleteVideo', url });
      if (response.error) throw new Error(response.error);
      await this.refreshBookmarks();
      this.afficherMessage(this.t('videoDeleted'), 'info');
    } catch (error) { this.afficherMessage(error.message, 'error'); }
  },

  /**
   * Applies user preferences for UI appearance and behavior.
   * Reads settings from Chrome storage and updates DOM accordingly.
   * Handles: bookmark button visibility, notes visibility, floating notes position.
   */
  async modifOptions() {
    chrome.storage.local.get('showBookmarkButtons', ({ showBookmarkButtons }) => {

    });
    chrome.storage.local.get('hideNotesByDefault', ({ hideNotesByDefault }) => {
      infoContainer.style.display = show || !hideNotesByDefault ? 'block' : 'none';
    });
    chrome.storage.local.get('floatingNotesPosition', ({ floatingNotesPosition }) => {

      // Adjust info container position based on user preference
      switch (floatingNotesPosition) {
        case 'bas':
          document.querySelector('.custom-bookmark-info-container').style.transform = `translateY(${-165}%) !important`;
          break;
        case 'haut':
          document.querySelector('.custom-bookmark-info-container').style.transform = `translateX(${-50}%) !important`;
          break;
      }
    });
  }

}

// Register document-lifetime listeners once, including navigation from the homepage.
document.addEventListener('yt-navigate-finish', () => YouTubeBookmarker.init());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.bookmarks || changes.hideNotesByDefault) YouTubeBookmarker.refreshBookmarks();
  if (changes.hotkeys) YouTubeBookmarker.setupHotkeys();
  if (changes.speedBarVisible) YouTubeBookmarker.applySpeedBarVisibility(changes.speedBarVisible.newValue);
  if (changes.language) YouTubeBookmarker.init();
});
YouTubeBookmarker.init();
