/**
 * YouTubeBookmarker - Main content script for the YouTube Bookmarker extension.
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
const YouTubeBookmarker = {

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
    BOOKMARK_INPUT_CONTAINER_CLASS: 'bookmark-input-container'
  },
  
  /**
   * Initializes the extension when a YouTube video page is loaded.
   * Sets up all required UI elements, event listeners, and keyboard shortcuts.
   * Called on initial page load and on YouTube's SPA navigation events.
   */
  async init() {
    const generation = this.generation = (this.generation || 0) + 1;
    this.events?.abort();
    this.hotkeyEvents?.abort();
    this.events = new AbortController();
    this.state.bookmarkInputContainer?.remove();
    document.querySelectorAll('.bookmarks-list, .custom-bookmark-icon-container').forEach(el => el.remove());
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

    this.state.bookmarkButton?.addEventListener('click', (e) => { e.stopPropagation(); this.addBookmark(); }, { signal: this.events.signal });
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
      button.setAttribute('aria-label', 'Ajouter un marque-page');

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
      buttonText.textContent = 'Ajouter un marque-page';

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
    // Remember if video was playing to resume playback after adding bookmark
    if (!this.state.currentVideo || !this.state.progressBar) return;
    this.state.wasPlayingBeforeBookmark = !this.state.currentVideo.paused;
    this.state.bookmarkTime = Math.round(this.currentVideoTime);
    this.state.currentVideo.pause();

    // Track clicks for multi-click detection
    const currentTime = Date.now();
    if (currentTime - this.state.lastClickTime < 400) {
        this.state.clickCount++;
      } else {
          this.state.clickCount = 1;
      }
    this.state.lastClickTime = currentTime;

    // Wait for potential additional clicks before processing
    clearTimeout(this.state.clickTimeout);
    this.state.clickTimeout = setTimeout(async () => {
      switch (this.state.clickCount) {
        case 1:
          if (target === this.state.bookmarkButton) {
            // Single click: show input if hidden, save if visible
            this.state.bookmarkContainerVisible ? this.saveBookmark('') : this.addBookmark();
          }
          break;
        case 2:
          if (target === this.state.bookmarkButton) {
            await this.saveBookmark('');
          }
          if (target === this.state.progressBar) {
            await this.addBookmark();
          }
          break;
        case 3:
          await this.saveBookmark('');
          break;
        }
        this.state.clickCount = 0;
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
      noteInput.placeholder = 'Ajouter une note pour ce marque-page';
      noteInput.setAttribute('aria-label', 'Note du marque-page');
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
      this.afficherMessage('Marque-page enregistré !');
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
      this.afficherMessage("Impossible ! La barre de progression ou la vidéo actuelle sont manquantes.", 'error');
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
    icon.setAttribute('aria-label', `Lire le marque-page à ${this.formatTime(bookmark.time)}`);
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
    deleteIcon.setAttribute('aria-label', 'Supprimer ce marque-page');
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
      const left = Math.max(player.left, Math.min(marker.left - width / 2, player.right - width));
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
      dragStartLeft = iconContainer.offsetLeft;
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
      const maxLeft = progressBarRect.width - iconContainer.offsetWidth;
      const clampedLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
      iconContainer.style.left = `${clampedLeft}px`;
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
      const progressBarRect = this.state.progressBar.getBoundingClientRect();
      const newLeft = parseFloat(iconContainer.style.left);
      const newTime = (newLeft / progressBarRect.width) * this.state.currentVideo.duration;

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
          iconContainer.style.left = `${(dragStartTime / this.state.currentVideo.duration) * progressBarRect.width}px`;
        }
      } else {
        // Snap back to original position if moved less than 5 seconds
        iconContainer.style.left = `${(dragStartTime / this.state.currentVideo.duration) * progressBarRect.width}px`;
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
    list.setAttribute('aria-label', 'Marque-pages de cette vidéo');
    const title = document.createElement('h3');
    title.textContent = this.state.bookmarksForThisUrl.length ? 'Marque-pages pour cette vidéo' : 'Aucun marque-page pour cette vidéo';
    list.append(title);
    const { hideNotesByDefault = false } = await chrome.storage.local.get('hideNotesByDefault');
    if (generation !== this.listGeneration) return;
    for (const bookmark of [...this.state.bookmarksForThisUrl].sort((a, b) => a.time - b.time)) {
      const row = document.createElement('div'); row.className = 'bookmark-item flex items-center justify-between';
      const seek = document.createElement('button'); seek.className = 'timestamp'; seek.type = 'button';
      seek.textContent = this.formatTime(bookmark.time); seek.dataset.time = bookmark.time;
      seek.setAttribute('aria-label', `Lire à ${this.formatTime(bookmark.time)}`);
      seek.onclick = () => { this.state.currentVideo.currentTime = bookmark.time; };
      const note = document.createElement('span'); note.textContent = bookmark.note; note.hidden = hideNotesByDefault;
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'edit-bookmark'; edit.textContent = 'Modifier';
      edit.onclick = () => {
        const input = document.createElement('input'); input.value = bookmark.note; input.setAttribute('aria-label', 'Modifier la note');
        const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Enregistrer';
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Annuler'; cancel.onclick = () => this.updateBookmarksList();
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
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-bookmark'; remove.textContent = 'Supprimer'; remove.onclick = () => this.deleteBookmark(bookmark);
      row.append(seek, note, edit, remove); list.append(row);
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
    this.state.bookmarksForThisUrl = [];
    const url = event.currentTarget.dataset.url;

    try {
      // Send delete request to background script for atomic storage update
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ 
          action: "deleteVideo", 
          url: url 
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
      
      if (response.success) {
        this.afficherMessage("Vidéo supprimée avec succès", "info");
      } else {
        throw new Error(response.error || "Erreur inconnue");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression de la vidéo :", error);
      this.afficherMessage("Erreur lors de la suppression de la vidéo", "error");
    }
    await this.updateUIElements();
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
});
YouTubeBookmarker.init();
