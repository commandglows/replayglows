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
  fr: { add: 'Ajouter un marque-page', notePlaceholder: 'Ajouter une note pour ce marque-page', noteLabel: 'Note du marque-page', saved: 'Marque-page enregistré !', missingPlayer: 'Impossible ! La barre de progression ou la vidéo actuelle sont manquantes.', playAt: 'Lire le marque-page à {time}', deleteOne: 'Supprimer ce marque-page', listLabel: 'Marque-pages de cette vidéo', listTitle: 'Marque-pages pour cette vidéo', listEmpty: 'Aucun marque-page pour cette vidéo', deleteVideo: 'Supprimer les marque-pages de cette vidéo', seekAt: 'Lire à {time}', edit: 'Modifier', editNote: 'Modifier la note', save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', videoDeleted: 'Marque-pages de cette vidéo supprimés', openLocal: 'Ouvrir dans l’app locale', openCloud: 'Ouvrir dans le cloud', showController: 'Afficher le contrôleur', showSpeed: 'Montrer la barre de vitesse', hideSpeed: 'Masquer la barre de vitesse', speed: 'Vitesse de lecture', favoriteSpeed: 'Vitesse favorite', speedError: 'Impossible de modifier la vitesse. Réessayez.', speedSuspended: 'Contrôle de vitesse suspendu' },
  en: { add: 'Add a bookmark', notePlaceholder: 'Add a note for this bookmark', noteLabel: 'Bookmark note', saved: 'Bookmark saved!', missingPlayer: 'The progress bar or current video is unavailable.', playAt: 'Play bookmark at {time}', deleteOne: 'Delete this bookmark', listLabel: 'Bookmarks for this video', listTitle: 'Bookmarks for this video', listEmpty: 'No bookmarks for this video', deleteVideo: 'Delete bookmarks for this video', seekAt: 'Play at {time}', edit: 'Edit', editNote: 'Edit note', save: 'Save', cancel: 'Cancel', delete: 'Delete', videoDeleted: 'Bookmarks for this video deleted', openLocal: 'Open in the local app', openCloud: 'Open in the cloud', showController: 'Show controller', showSpeed: 'Show speed bar', hideSpeed: 'Hide speed bar', speed: 'Playback speed', favoriteSpeed: 'Favorite speed', speedError: 'Unable to change speed. Try again.', speedSuspended: 'Speed control suspended' }
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
    clearTimeout(this.clickGesture?.timer);
    this.clickGesture = null;
    this.speedBarCleanup?.();
    this.events?.abort();
    this.hotkeyEvents?.abort();
    this.events = new AbortController();
    const visibilityRevision = this.speedBarVisibilityRevision || 0;
    const { language = 'auto', speedBarVisible = false } = await chrome.storage.local.get(['language', 'speedBarVisible']);
    if (generation !== this.generation) return;
    if (visibilityRevision === (this.speedBarVisibilityRevision || 0)) this.speedBarVisible = speedBarVisible === true;
    this.locale = language === 'fr' || (language === 'auto' && navigator.languages.some(item => item.toLowerCase().startsWith('fr'))) ? 'fr' : 'en';
    this.state.bookmarkInputContainer?.remove();
    document.querySelectorAll('.bookmarks-list, .custom-bookmark-icon-container, .rg-yt-menu').forEach(el => el.remove());
    if (window.location.pathname !== '/watch') return;
    // A navigation can supersede player readiness; never initialize a stale page.
    for (let attempt = 0; attempt < 100; attempt++) {
      if (generation !== this.generation) return;
      if (document.querySelector('video') && document.querySelector('.ytp-time-display') && document.querySelector('.ytp-progress-bar')) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (generation !== this.generation || !document.querySelector('video')) return;
    try {
      await this.resetState();
      await this.addBookmarkButton();
      this.setupSpeedBar();
      this.setupOverflowMenu();
      await this.setupHotkeys();
      await this.updateUIElements();
      this.setupEventListeners();
    } catch (error) { this.afficherMessage(error.message, 'error'); }
  },

  /**
   * Resets and refreshes the internal state from Chrome storage.
   * Filters bookmarks to show only those relevant to the current video URL.
   * Also re-queries DOM elements in case of dynamic page changes.
   */
  async resetState() {
    const result = await chrome.runtime.sendMessage({ action: 'getBookmarks' });
    if (result.error) throw new Error(result.error);
    const storedBookmarks = result.bookmarks || [];
    const bookmarksForThisUrl = storedBookmarks.filter(bookmark => bookmark.url === this.currentUrl).sort((a, b) => a.time - b.time);
    this.state = {
      currentUrl: this.currentUrl,
      wasPlayingBeforeBookmark: this.state.player && !this.state.player.paused,
      bookmarks: storedBookmarks,
      bookmarksForThisUrl: bookmarksForThisUrl || [],
      currentVideo: document.querySelector('video'),
      player: document.querySelector('.html5-video-player'),
      bookmarkButton: document.getElementById(this.CONSTANTS.BOOKMARK_BUTTON_ID),
      timeDisplay: document.querySelector('.ytp-time-display'),
      progressBar: document.querySelector('.ytp-progress-bar'),
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
  waitForYouTubePlayer() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const player = document.querySelector('.html5-video-player');
        if (player) {
          clearInterval(interval);
          resolve(player);
          this.state.player = player;
        }
      }, 100);
    });
  },

  /**
   * Sets up event listeners for YouTube navigation and user interactions.
   * The 'yt-navigate-finish' event handles YouTube's SPA navigation between videos.
   */
  setupEventListeners() { 

    this.state.bookmarkButton?.addEventListener('click', (e) => { e.stopPropagation(); this.handleAddBookmark(e, this.state.bookmarkButton); }, { signal: this.events.signal });
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
    const { hotkeys } = await chrome.storage.local.get('hotkeys');
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
    return this.waitForYouTubePlayer().then(() => {
      if (!this.state.player) {
        console.error("Le lecteur YouTube est introuvable.");
        return;
      }
      // Prevent duplicate buttons on re-initialization
      if (this.state.bookmarkButton?.isConnected) {

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

      } else {
        console.info("timeDisplay est introuvable, le bouton ne peut pas être ajouté.");
        }
    });
  },

  /**
   * Adds a dropdown to the bookmark button. Opening downward, it closes when
   * the hover stops (button and dropdown) and offers cross-app actions.
   */
  setupOverflowMenu() {
    const button = this.state.bookmarkButton;
    if (!button) return;
    const menu = document.createElement('div');
    menu.className = this.CONSTANTS.RG_MENU_CLASS;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'ReplayGlows');
    const items = [
      { key: 'openLocal', run: () => this.openInApp('watch') },
      { key: 'openCloud', run: () => this.openInApp('play') },
      { key: 'showController', run: () => {} },
      { key: 'showSpeed', run: () => this.toggleSpeedBar() },
    ];
    for (const item of items) {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'rg-yt-menu__item';
      entry.setAttribute('role', 'menuitem');
      entry.textContent = this.t(item.key);
      if (item.key === 'showSpeed') {
        this.speedMenuEntry = entry;
        entry.setAttribute('role', 'menuitemcheckbox');
        entry.setAttribute('aria-controls', 'rg-yt-speedbar');
        entry.setAttribute('aria-checked', String(!!this.speedBarVisible));
        entry.textContent = this.t(this.speedBarVisible ? 'hideSpeed' : 'showSpeed');
      }
      entry.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
        item.run();
      }, { signal: this.events.signal });
      menu.appendChild(entry);
    }
    document.body.appendChild(menu);
    let open = false;
    let leaveTimer = null;
    const openMenu = () => {
      if (open) return;
      open = true;
      const rect = button.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 240))}px`;
      menu.style.top = `${rect.bottom + 8}px`;
      menu.classList.add('rg-yt-menu--open');
    };
    const close = () => {
      clearTimeout(leaveTimer);
      open = false;
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
    menu.addEventListener('mouseenter', enter, { signal: this.events.signal });
    menu.addEventListener('mouseleave', leave, { signal: this.events.signal });
    this.state.overlayMenu = menu;
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
    const commitScrub = gesture => {
      if (!sameVideo(gesture) || gesture.target === gesture.committed) return;
      try {
        video.currentTime = gesture.target;
        gesture.committed = gesture.target;
      } catch { showError(this.t('speedError')); }
    };
    const stopScrub = () => {
      if (!scrub) return;
      const previous = scrub;
      scrub = null;
      cancelAnimationFrame(previous.frame);
      commitScrub(previous);
      player?.classList.remove('rg-speedbar-scrubbing');
      bar.removeAttribute('data-scrubbing');
      slider.min = '0.25'; slider.max = '4'; slider.step = '0.05';
      slider.setAttribute('aria-label', this.t('speed'));
      video.muted = previous.muted;
      // Do not start a new video after a SPA/source replacement.
      if (!previous.paused && sameVideo(previous)) {
        void video.play().catch(() => showError(this.t('speedError')));
      }
      renderRate();
      this.updateSpeedBarLayout?.();
    };
    let pointerAttached = false;
    const detachPointer = () => {
      stopScrub();
      pointerAttached = false;
      bar.removeAttribute('data-pointer-attached');
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
    for (const rate of [0.5, 1, 1.5, 2]) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = format(rate);
      button.dataset.rate = String(rate);
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
        offset: 0, paused: video.paused, muted: video.muted,
        source: video.currentSrc, identity: videoIdentity(), last: performance.now(), frame: 0,
        target: video.currentTime, committed: video.currentTime, lastSeek: 0 };
      scrub = gesture;
      video.pause();
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
        // Accumulate every frame independently of decoder latency; bound seek requests to 10 Hz.
        if (now - scrub.lastSeek >= 100) {
          commitScrub(scrub);
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
    document.addEventListener('pointerdown', () => { if (scrub) detachPointer(); }, { signal, capture: true });
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
    if (!id) return;
    const time = Math.max(0, Math.round(this.currentVideoTime));
    const url = chrome.runtime.getURL(`src/app/index.html#/${routeName}?v=${encodeURIComponent(id)}&t=${time}`);
    chrome.tabs.create({ url });
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
    this.state.wasPlayingBeforeBookmark = !this.state.currentVideo.paused;
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
      title: document.querySelector('ytd-watch-metadata h1')?.textContent?.trim() || document.title.replace(/ - YouTube$/, '')
    };
    try {
      const response = await chrome.runtime.sendMessage({ action: 'addBookmark', bookmark });
      if (response.error) throw new Error(response.error);
      // A delayed save belongs to its original editor, never a replacement after navigation.
      if (generation === this.generation && editor === this.state.bookmarkInputContainer && video === this.state.currentVideo) {
        await this.closeBookmarkInput();
      }
      await this.refreshBookmarks();
      this.afficherMessage(this.t('saved'));
    } catch (error) { this.afficherMessage(error.message, 'error'); }
  },

  async refreshBookmarks() {
    const response = await chrome.runtime.sendMessage({ action: 'getBookmarks' });
    if (response.error) { this.afficherMessage(response.error, 'error'); return; }
    const bookmarks = response.bookmarks || [];
    this.state.bookmarks = bookmarks;
    this.state.bookmarksForThisUrl = bookmarks.filter(b => b.url === this.currentUrl).sort((a, b) => a.time - b.time);
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
    if (this.state.bookmarkInputContainer) {
      this.state.bookmarkInputContainer.remove();
      this.state.bookmarkInputContainer = null;
      this.state.bookmarkInputElement = null;
      this.state.bookmarkContainerVisible = false;
    } else {
    }
    if (this.state.bookmarkInputElement) {
      this.state.bookmarkInputElement = null;
      this.state.bookmarkContainerVisible = false;
    }
    // Resume playback if video was playing before bookmark action
    this.state.bookmarkTime = null;
    if (this.state.wasPlayingBeforeBookmark) this.state.currentVideo?.play().catch(() => {});
    this.state.wasPlayingBeforeBookmark = false;
    this.state.bookmarkButton?.focus();
    return;
  },

  /**
   * Loads bookmark icons onto the video progress bar.
   * Clears existing icons first to prevent duplicates, then adds an icon
   * for each bookmark at its corresponding position on the timeline.
   */
  async loadBookmarks() {
    // Remove all existing bookmark icons before reloading
    document.querySelectorAll(`.${this.CONSTANTS.BOOKMARK_ICON_CONTAINER_CLASS}`).forEach(el => el.remove());
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
      e.stopPropagation();
      isDragging = true;
      moved = false;
      dragStartX = e.clientX;
      const markerRect = iconContainer.getBoundingClientRect();
      dragStartLeft = markerRect.left + markerRect.width / 2 - this.state.progressBar.getBoundingClientRect().left;
      dragStartTime = bookmark.time;
      iconContainer.classList.add('dragging');
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
    const stopDragging = async (e) => {
      isDragging = false;
      iconContainer.classList.remove('dragging');
      document.removeEventListener('mousemove', dragBookmark);
      document.removeEventListener('mouseup', stopDragging);

      if (!moved) return;
      const newRatio = parseFloat(iconContainer.style.left) / 100;
      const newTime = newRatio * this.state.currentVideo.duration;

      // Only update if moved more than 5 seconds to prevent accidental changes
      if (Math.abs(newTime - dragStartTime) > 5) {
        const updated = { ...bookmark, time: Math.round(newTime), formattedTime: this.formatTime(newTime) };
        try {
          const response = await chrome.runtime.sendMessage({ action: 'updateBookmark', bookmark: updated, originalTime: dragStartTime });
          if (response.error) throw new Error(response.error);
          await this.refreshBookmarks();
        } catch (error) {
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
