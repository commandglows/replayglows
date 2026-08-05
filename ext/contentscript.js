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
    console.log("currentUrl : ", window.location.href);
    console.log("currentUrl : ", window.location.href.split('&')[0]);
    return window.location.href.split('&')[0];
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
      try {
        console.log("Initialisation du script");
         await this.addBookmarkButton();
        await this.resetState();
        await this.setupHotkeys();
        await this.updateUIElements();
        this.setupEventListeners();
      } catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
      }
  },
  
  /**
   * Resets and refreshes the internal state from Chrome storage.
   * Filters bookmarks to show only those relevant to the current video URL.
   * Also re-queries DOM elements in case of dynamic page changes.
   */
  async resetState() {
    const result = await chrome.storage.local.get('bookmarks');
    const storedBookmarks = result.bookmarks || [];
    const bookmarksForThisUrl = await storedBookmarks.filter(bookmark => bookmark.url === this.currentUrl);
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
    console.log("Mise à jour de l'état");
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
    document.addEventListener('yt-navigate-finish', () => this.onNavigate());
    this.state.bookmarkButton?.addEventListener('click', (e) => this.handleAddBookmark(e, this.state.bookmarkButton));
    this.state.progressBar?.addEventListener('click', (e) => this.handleAddBookmark(e, this.state.progressBar));
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
    // Vérifiez si des raccourcis sont déjà enregistrés
    const { hotkeys } = await chrome.storage.local.get('hotkeys');
    const hotkeysToUse = hotkeys || {
      'add-bookmark': 'ALT+B',
      'delete-bookmark': 'ALT+D',
      'quick-bookmark': 'ALT+Q',
      'prev-bookmark': 'ALT+1',
      'next-bookmark': 'ALT+2',
    };

    // Listen for keydown events and match against configured hotkeys
    document.addEventListener('keydown', (e) => {
      // Build the pressed hotkey string (e.g., "Ctrl+Alt+B")
      const pressedHotkey = [
          e.ctrlKey ? 'Ctrl' : '',
          e.altKey ? 'Alt' : '',
          e.shiftKey ? 'Shift' : '',
          e.key.toUpperCase()
      ].filter(Boolean).join('+');

      // Check each configured hotkey for a match
      Object.entries(hotkeysToUse).forEach(([action, hotkey]) => {
        if (pressedHotkey === hotkey) {
          console.log(`Raccourci pressé : ${pressedHotkey}`);
          switch (action) {
            case 'add-bookmark':
              this.addBookmark(e);
              console.log("Ajout d'un marque-page");
              break;
            case 'prev-bookmark':
              console.log("Navigation vers le marque-page précédent");
              this.navigateBookmarks('prev');
              break;
            case 'next-bookmark':
              this.navigateBookmarks('next');
              console.log("Navigation vers le marque-page suivant");
              break;
            case 'delete-bookmark':
              console.log("Suppression du marque-page actuel");
              this.deleteCurrentBookmark();
              break;
            case 'toggle-notes':
              console.log("Changement de la visibilité des notes");
              this.toggleNotesVisibility();
              break;
            case 'quick-bookmark':
              // Quick bookmark saves immediately without showing note input
              console.log("Ajout rapide d'un marque-page");
              this.saveBookmark();
              break;
            default:
              console.log("Aucune action correspondante trouvée");
            }
          }
        });
    });
  },

  toggleNotesVisibility() {
  },

  /**
   * Handles YouTube's SPA navigation event.
   * Re-initializes the extension when navigating to a new video page
   * to ensure bookmarks and UI elements are properly updated.
   */
  onNavigate() {
    console.log("Événement yt-navigate-finish déclenché dans onNavigate");
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
    this.waitForYouTubePlayer().then(() => {
      if (!this.state.player) {
        console.error("Le lecteur YouTube est introuvable.");
        return;
      }
      // Prevent duplicate buttons on re-initialization
      if (this.state.bookmarkButton) {
        console.log("Le bouton de marque-page existe déjà.");
        return;
      }

      // Create the bookmark button with SVG icon
      const button = document.createElement('button');
      button.id = this.CONSTANTS.BOOKMARK_BUTTON_ID;

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

        console.log("Bouton de marque-page ajouté avec succès.");
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
    this.state.wasPlayingBeforeBookmark = this.state.player && !this.state.player.paused;

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
    this.state.wasPlayingBeforeBookmark = this.state.player && !this.state.player.paused;
    if (!this.state.bookmarkInputContainer) {
      const progressBar = this.state.progressBar;
      const rect = progressBar.getBoundingClientRect();
      const inputContainer = document.createElement('div');
      this.state.bookmarkContainerVisible = true;
      inputContainer.className = this.CONSTANTS.BOOKMARK_INPUT_CONTAINER_CLASS;
      inputContainer.className = "iso grad-ult-bg-white-lg tbflwz";
      
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
      noteInput.style.border = 'none';
      noteInput.style.outline = 'none';
      inputContainer.appendChild(noteInput);
      this.state.bookmarkInputContainer = inputContainer;

      // Check user preference for showing add/cancel buttons
      const { showBookmarkButtons } = await new Promise(resolve =>
        chrome.storage.local.get({ showBookmarkButtons: false }, resolve)
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
          this.closeBookmarkInput();
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

      document.addEventListener('click', handleOutsideClick);

      // Prevent clicks inside container from bubbling up
      inputContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });

      // Handle keyboard shortcuts within the input
      noteInput.addEventListener('keydown', e => {
        e.stopPropagation(); // Prevent YouTube's keyboard shortcuts
        if (e.key === 'Escape') {
          console.log("Échap pressé, fermeture du conteneur d'input");
          this.closeBookmarkInput();
        }
        if (e.key === 'Enter') {
          console.log("Entrée pressée, ajout du marque-page");
          this.saveBookmark(noteInput.value);
          this.closeBookmarkInput();
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
  async saveBookmark(note) {
    // Use stored bookmark time if available, otherwise use current video time
    let time = null
    if (this.state.bookmarkTime) {
      time = this.state.bookmarkTime;
    } else {
      time = Math.round(this.currentVideoTime);
    }
    const formattedTime = this.formatTime(time);

    // Create bookmark object with all required properties
    const newBookmark = {
      time: time,
      formattedTime: formattedTime,
      url: this.currentUrl,
      // Capitalize first letter of note for consistency
      note: note ? note.charAt(0).toUpperCase() + note.slice(1) : note || ' '
    };

    try {
      // Check for duplicate before saving (same URL and timestamp)
      if (!this.state.bookmarks.some(b => 
        b.url === newBookmark.url && 
        b.time === time
      )) {
        this.state.bookmarks.push(newBookmark);
        this.state.bookmarksForThisUrl.push(newBookmark);
        await chrome.storage.local.set({ bookmarks: this.state.bookmarks });
        this.afficherMessage("Ajouté !", 'info');
        await this.closeBookmarkInput();
        await this.updateUIElements();
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout du marque-page:", error);
    }
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
    this.state.wasPlayingBeforeBookmark ? this.state.currentVideo.play() : this.state.currentVideo.pause();
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

    const icon = document.createElement('div');
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
    const deleteIcon = document.createElement('span');
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
    timeSpan.className = 't cursor-pointer';
    timeSpan.textContent = `🕓 ${formattedTime}`;
    newContent.appendChild(timeSpan);

    // Add note text if present
    if (bookmark.note && bookmark.note.trim() !== '') {
      const noteText = document.createElement('span');
      noteText.className = 't';
      noteText.textContent = bookmark.note;
      newContent.appendChild(noteText);
    }

    newContent.appendChild(deleteIcon);
    infoContainer.appendChild(newContent);

    // Drag-and-drop functionality for repositioning bookmarks
    let isDragging = false;
    let dragStartX, dragStartLeft, dragStartTime;

    /**
     * Initiates drag operation when user starts dragging the icon.
     */
    const startDragging = (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartLeft = parseFloat(iconContainer.style.left);
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

      const progressBarRect = this.state.progressBar.getBoundingClientRect();
      const newLeft = parseFloat(iconContainer.style.left);
      const newTime = (newLeft / progressBarRect.width) * this.state.currentVideo.duration;

      // Only update if moved more than 5 seconds to prevent accidental changes
      if (Math.abs(newTime - dragStartTime) > 5) {
        bookmark.time = newTime;
        try {
          await chrome.runtime.sendMessage({ action: 'updateBookmark', bookmark });
          this.loadBookmarks();
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

    deleteIcon.addEventListener('click', (e) => {
      console.log("Clic sur l'icône de suppression détecté");
      this.deleteBookmark(bookmark);
    });
  },
  
  /**
   * Updates the bookmarks list displayed in the YouTube sidebar.
   * Creates an expandable/collapsible panel showing all bookmarks for the current video.
   * Includes timestamp links, notes, and delete functionality for each bookmark.
   */
  async updateBookmarksList() {
    const parentContainer = this.state.parentContainer;
    if (parentContainer) { 
      // Clear existing bookmark list to rebuild it
      const elements = document.querySelectorAll('.bookmarks-list');
      elements.forEach(el => el.remove());
      this.state.bookmarksList = document.createElement('div');
      this.state.bookmarksList.style.marginBottom = '10px';
      this.state.bookmarksList.className = 'bookmarks-list flex-1 overflow-y-auto';
      await parentContainer.insertBefore(this.state.bookmarksList, parentContainer.firstChild);
      
      // Show empty state if no bookmarks for this video
      if (!this.state.bookmarksForThisUrl || this.state.bookmarksForThisUrl.length < 1) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "sct spc-md iso empty-msg grad-br-static-sm";
        emptyMessage.innerHTML = `
        <h3 class="text-xl font-century text-zinc-600 bold">Aucun bookmark pour cette vidéo</h3>
        `;
        this.state.bookmarksList?.appendChild(emptyMessage);
      } else {
        // Build the collapsible bookmark list UI
        const videoElement = document.createElement("div");
        videoElement.className = "video-item space-y-4 cursor-pointer sct spc-md iso grad-ult-bg-white-sm";
        videoElement.innerHTML = `
          <div class="flex flex-row justify-between">
            <h3 class="text-xl font-century text-zinc-600 bold">Bookmarks pour cette vidéo :</h3>
            <button class="hover:animate-spin text-lg delete-video" data-url="${this.currentUrl}">🗑️</button>
          </div>
          <div class="space-y-4 bookmarks-container hidden transform transition-all duration-300 ease-in-out origin-top scale-y-0 opacity-0">
          ${this.state.bookmarksForThisUrl.map(bookmark => `
            <div class="flex items-center justify-between bookmark-item text-lg bg-slate-400/10 rounded-md">
              <div class="flex items-center gap-3">
                <a href="#" class="text-zinc-800 cursor-pointer text-g timestamp" data-url="${this.currentUrl}&t=${bookmark.time}" data-time="${bookmark.time}">🕓 ${bookmark.formattedTime}</a>
                <span class="text-lg text-zinc-800">${bookmark.note}</span>
              </div>
              <button class="delete-bookmark hover:animate-ping" data-url="${bookmark.url}" data-timestamp="${bookmark.time}">
                🗑️
              </button>
              </div>
            `).join('')}
          </div>
          </div>
          </div>
          `;

        this.state.bookmarksList?.appendChild(videoElement);

        // Attach delete handlers to each bookmark's delete button
        const deleteBookmarkButtons = videoElement.querySelectorAll('.delete-bookmark');
        deleteBookmarkButtons.forEach(button => {
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const url = this.currentUrl;
            const timestamp = event.target.getAttribute('data-timestamp');
            console.log("appel de deleteBookmark avec : ", { url, timestamp });

            if (url && timestamp) {
              this.deleteBookmark({ url, time: Number(timestamp) });
            } else {
              console.error("Valeurs invalides pour la suppression du marque-page :", { url, timestamp });
            }
          });
        });
        
        // Toggle expand/collapse on click, but not on interactive children
        videoElement.addEventListener('click', (event) => {
          // Vérifiez si le clic n'a pas été effectué sur les éléments enfants spécifiques
          const isClickOnChildElement = event.target.closest('.timestamp') || 
            event.target.closest('.text') || 
            event.target.closest('.delete-bookmark');

          if (!isClickOnChildElement) {
            // Récupérer le conteneur des marque-pages
            const bookmarksContainer = videoElement.querySelector('.bookmarks-container');

            // Animate expand/collapse with CSS transitions
            if (bookmarksContainer.classList.contains('hidden')) {
              // Affichage du conteneur
              bookmarksContainer.classList.remove('hidden');
              setTimeout(() => {
                    bookmarksContainer.classList.remove('scale-y-0', 'opacity-0');
                    bookmarksContainer.classList.add('scale-y-100', 'opacity-100');
                  }, 0);
            } else {
              // Masquage du conteneur
              bookmarksContainer.classList.remove('scale-y-100', 'opacity-100');
              bookmarksContainer.classList.add('scale-y-0', 'opacity-0');
              
              // Attendre la fin de la transition avant de cacher
              bookmarksContainer.addEventListener('transitionend', () => {
                    bookmarksContainer.classList.add('hidden');
                  }, { once: true });
                }
            } else if (event.target.classList.contains('timestamp')) {
              // Timestamp click: jump to that position in the video
              const time = event.target.getAttribute('data-time');
              if (this.state.currentVideo) {
                this.state.currentVideo.currentTime = parseFloat(time);
              }
            }
          });
            
        const deleteVideoButton = videoElement.querySelector('.delete-video');
        if (deleteVideoButton) {
          deleteVideoButton.addEventListener('click', (event) => this.deleteVideo(event));
        } 
      }
    }
  },

  /**
   * Removes a bookmark from storage and updates all related UI elements.
   * Updates both the global bookmarks list and the current-video-only list.
   * 
   * @param {Object} bookmark - The bookmark to delete (must have url and time)
   */
  async deleteBookmark(bookmark) {
    console.log("Tentative de suppression du marque-page:", bookmark);
    try {
      // Remove from current video's bookmark list
      this.state.bookmarksForThisUrl = this.state.bookmarksForThisUrl.filter(b => b.time !== bookmark.time);
      console.log("Marque-page supprimé de la liste pour cette URL:", this.state.bookmarksForThisUrl);
      
      // Remove from global bookmark list
      this.state.bookmarks = this.state.bookmarks.filter(b => b.time !== bookmark.time);
      console.log("Marque-page supprimé de la liste globale:", this.state.bookmarks);
      
      // Persist to Chrome storage
      chrome.storage.local.set({ bookmarks: this.state.bookmarks });
      console.log("Marque-page supprimé avec succès dans le stockage local.");
    } catch (error) {
      console.error("Erreur de communication avec l'extension:", error);
      this.afficherMessage(`Erreur de communication avec l'extension : ${error}`, 'error');
    }
    await this.updateUIElements();
    console.log("Éléments de l'interface utilisateur mis à jour après la suppression du marque-page.");
  },

  /**
   * Navigates to the previous or next bookmark in the video timeline.
   * For 'prev', finds the nearest bookmark before current time (with 3s buffer).
   * For 'next', finds the nearest bookmark after current time.
   * 
   * @param {string} direction - 'prev' or 'next'
   */
  async navigateBookmarks(direction) {
    const currentTime = Math.round(this.currentVideoTime);
    
    if (direction === 'prev') {
      // Find the latest bookmark that's at least 3 seconds before current time
      // The 3s buffer prevents getting stuck on the current bookmark
      const prevBookmark = this.state.bookmarks
        .filter(b => b.timeInSeconds < currentTime - 3)
        .pop();
      if (prevBookmark) this.currentVideoTime = prevBookmark.timeInSeconds;
    } else if (direction === 'next') {
      // Find the earliest bookmark after current time
      const nextBookmark = this.state.bookmarks
        .filter(b => b.timeInSeconds > currentTime)
        .shift();
      if (nextBookmark) this.currentVideoTime = nextBookmark.timeInSeconds;
    }
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
    console.log("Tentative de suppression de la vidéo:", url);
    
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
      console.log("showBookmarkButtons : ", showBookmarkButtons);
    });
    chrome.storage.local.get('hideNotesByDefault', ({ hideNotesByDefault }) => {
      infoContainer.style.display = show || !hideNotesByDefault ? 'block' : 'none';
    });
    chrome.storage.local.get('floatingNotesPosition', ({ floatingNotesPosition }) => {
      console.log("floatingNotesPosition : ", floatingNotesPosition);
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

// Initialize the bookmarker when the script loads
YouTubeBookmarker.init()

/**
 * Connection listener for maintaining communication with the extension.
 * Handles reconnection if the background script connection is lost,
 * which can happen during extension updates or reloads.
 */
chrome.runtime.onConnect.addListener(function(port) {
if (port.name === "contentScript") {
  port.onDisconnect.addListener(function() {
    console.error("Connexion perdue avec l'extension. Tentative de reconnexion...");
    setTimeout(initializeExtension, 1000);
  });
}
});

// Safety check for Chrome runtime API availability
if (!chrome.runtime) {
console.error("L'API chrome.runtime n'est pas disponible. Vérifiez la compatibilité du navigateur.");
}
/* 
async checkelement() {
  if (document.querySelector('video')) {
    console.log("video trouvé");
    const video = document.querySelector('video');
    console.log(video); // Vérifiez l'élément
    video.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); 
    }, true); 
  }
}
window.addEventListener('popstate', () => {
console.log("Événement popstate détecté");
if (YouTubeBookmarker.currentUrl.includes('youtube.com/watch')) {
  YouTubeBookmarker.resetState().then(() => {
    YouTubeBookmarker.updateState();
    YouTubeBookmarker.loadBookmarks();
if (YouTubeBookmarker.currentUrl.includes('youtube.com/watch')) {
YouTubeBookmarker.init();
 async onPopState() {
    if (window.location.pathname === '/watch') {
      await this.resetState();
      this.loadBookmarks();
    }
  },
 */




