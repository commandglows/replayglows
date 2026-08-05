const YouTubeBookmarker = {

  state: {
    currentVideo: null,
    player: null,
    bookmarks: [],
    groupedBookmarks: {},
    bookmarkButton: null,
    timeDisplay: null,
    progressBar: null,
    bookmarkContainerVisible: false,
    bookmarkInputContainer: null,
    bookmarkInputElement: null,
    isInitialized: false,
    wasPlayingBeforeBookmark: null,
    clickCount: 0,
    lastClickTime: 0,
    bookmarksList: null,
    parentContainer: null,
    bookmarksForThisUrl: []
  },

  get currentVideoTime() {
    return this.state.currentVideo ? this.state.currentVideo.currentTime : 0;
  },

  get currentUrl() {
    console.log("currentUrl : ", window.location.href);
    console.log("currentUrl : ", window.location.href.split('&')[0]);
    return window.location.href.split('&')[0];
  },

  CONSTANTS: {
    BOOKMARK_BUTTON_ID: 'bookmark-button',
    BOOKMARK_ICON_CLASS: 'custom-bookmark-icon',
    BOOKMARK_ICON_CONTAINER_CLASS: 'custom-bookmark-icon-container',
    BOOKMARK_DELETE_ICON_CLASS: 'custom-bookmark-delete-icon',
    BOOKMARK_INPUT_CONTAINER_CLASS: 'bookmark-input-container'
  },
  
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

  setupEventListeners() { 
    document.addEventListener('yt-navigate-finish', () => this.onNavigate());
    this.state.bookmarkButton?.addEventListener('click', (e) => this.handleAddBookmark(e, this.state.bookmarkButton));
    this.state.progressBar?.addEventListener('click', (e) => this.handleAddBookmark(e, this.state.progressBar));
  },

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

    document.addEventListener('keydown', (e) => {
      const pressedHotkey = [
          e.ctrlKey ? 'Ctrl' : '',
          e.altKey ? 'Alt' : '',
          e.shiftKey ? 'Shift' : '',
          e.key.toUpperCase()
      ].filter(Boolean).join('+');

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

  onNavigate() {
    console.log("Événement yt-navigate-finish déclenché dans onNavigate");
    if (window.location.pathname === '/watch') {
      const currentUrl = this.currentUrl;
      this.init();
    }
  },

  async addBookmarkButton() {
    this.waitForYouTubePlayer().then(() => {
      if (!this.state.player) {
        console.error("Le lecteur YouTube est introuvable.");
        return;
      }
      if (this.state.bookmarkButton) {
        console.log("Le bouton de marque-page existe déjà.");
        return;
      }
    });

    const button = document.createElement('button');
    button.id = this.CONSTANTS.BOOKMARK_BUTTON_ID;

    const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgIcon.setAttribute("viewBox", "0 0 24 24");
    svgIcon.setAttribute("width", "22");
    svgIcon.setAttribute("height", "18");
    svgIcon.innerHTML = '<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" fill="white"/>';
    /* <defs>
      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="00%" style="stop-color:#ff00c8ff; stop-opacity:1" />
        <stop offset="20%" style="stop-color:#ffe500ff; stop-opacity:1" />
        <stop offset="40%" style="stop-color:#00ff44ff; stop-opacity:1" />
        <stop offset="60%" style="stop-color:#00c8ffff; stop-opacity:1" />
        <stop offset="80%" style="stop-color:#ffe590ff; stop-opacity:1" />
        <stop offset="100%" style="stop-color:#ff0033ff; stop-opacity:1" />
      </linearGradient>
    </defs>
    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" fill="url(#gradient)" />
    */
    const buttonText = document.createElement('span');
    buttonText.textContent = 'Ajouter un marque-page';

    button.appendChild(svgIcon);
    button.appendChild(buttonText);

    if (this.state.timeDisplay) {
      this.state.timeDisplay.parentNode.insertBefore(button, this.state.timeDisplay.nextSibling);
      this.state.bookmarkButton = button;

      console.log("Bouton de marque-page ajouté avec succès.");
    } else {
      console.info("timeDisplay est introuvable, le bouton ne peut pas être ajouté.");
    }
  },

  async handleAddBookmark(event, target) {
    this.state.wasPlayingBeforeBookmark = this.state.player && !this.state.player.paused;

    const currentTime = Date.now();
    if (currentTime - this.state.lastClickTime < 400) {
        this.state.clickCount++;
      } else {
          this.state.clickCount = 1;
      }
    this.state.lastClickTime = currentTime;

    clearTimeout(this.state.clickTimeout);
    this.state.clickTimeout = setTimeout(async () => {
      switch (this.state.clickCount) {
        case 1:
          if (target === this.state.bookmarkButton) {
            this.state.bookmarkContainerVisible ? this.saveBookmark('') : this.addBookmark();
            break;
          }
        case 2:
          if (target === this.state.bookmarkButton) {
            await this.saveBookmark('');
            break
          }
          if (target === this.state.progressBar) {
            await this.addBookmark();
            break;
          }
        case 3:
          await this.saveBookmark('');
          break;
        default:
          this.state.clickCount = 0;
          break;
      }
    }, 500);
  },

  async addBookmark() {
    this.state.wasPlayingBeforeBookmark = this.state.player && !this.state.player.paused;
    if (!this.state.bookmarkInputContainer) {
      const progressBar = this.state.progressBar;
      const rect = progressBar.getBoundingClientRect();
      const inputContainer = document.createElement('div');
      this.state.bookmarkContainerVisible = true;
      inputContainer.className = this.CONSTANTS.BOOKMARK_INPUT_CONTAINER_CLASS;
      inputContainer.className = "iso grad-ult-bg-white-lg tbflwz";
      const positionRatio = this.currentVideoTime / this.state.currentVideo.duration;
      let leftPosition = positionRatio * 100;
      const containerWidth = 220;
      const playerWidth = this.state.player.offsetWidth;
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
      
      const handleOutsideClick = (e) => {
        if (this.state.bookmarkInputContainer) {
          if (e.target == this.state.player) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.state.wasPlayingBeforeBookmark ? this.state.currentVideo.play() : this.state.currentVideo.pause();
          }
          if (!this.state.bookmarkInputContainer.contains(e.target) && 
              e.target !== this.state.bookmarkButton && 
              e.target !== this.state.progressBar) {
            this.closeBookmarkInput();
          }
        }
        document.removeEventListener('click', handleOutsideClick);
      };

      document.addEventListener('click', handleOutsideClick);

      inputContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });

      noteInput.addEventListener('keydown', e => {
        e.stopPropagation();
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

  async saveBookmark(note) {
    let time = null
    if (this.state.bookmarkTime) {
      time = this.state.bookmarkTime;
    } else {
      time = Math.round(this.currentVideoTime);
    }
    const formattedTime = this.formatTime(time);

    const newBookmark = {
      time: time,
      formattedTime: formattedTime,
      url: this.currentUrl,
      note: note ? note.charAt(0).toUpperCase() + note.slice(1) : note || ' '
    };

    try {
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

  async updateUIElements() {
    await this.loadBookmarks();
    await this.updateBookmarksList();
  },

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
    this.state.wasPlayingBeforeBookmark ? this.state.currentVideo.play() : this.state.currentVideo.pause();
    return;
  },

  async loadBookmarks() {
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

  async addBookmarkIcon(bookmark) {
    if (!this.state.progressBar || !this.state.currentVideo) {
      this.afficherMessage("Impossible ! La barre de progression ou la vidéo actuelle sont manquantes.", 'error');
      return;
    }

    const iconContainer = document.createElement('div');
    iconContainer.className = this.CONSTANTS.BOOKMARK_ICON_CONTAINER_CLASS;
    iconContainer.style.left = `${(bookmark.time / this.state.currentVideo.duration) * 100}%`;
    iconContainer.style.zIndex = '9999'; 

    const icon = document.createElement('div');
    icon.className = this.CONSTANTS.BOOKMARK_ICON_CLASS;

    const infoContainer = document.createElement('div');
    infoContainer.className = 'custom-bookmark-info-container';/* 
    infoContainer.style.maxWidth = '110px';
    infoContainer.style.overflow = 'hidden';

    const toggleArrow = document.createElement('span');
    toggleArrow.textContent = '▼';
    toggleArrow.style.cursor = 'pointer';
    toggleArrow.style.position = 'absolute';
    toggleArrow.style.left = '0';
    toggleArrow.style.top = '0';

    let isExpanded = false;

    toggleArrow.addEventListener('click', () => {
        isExpanded = !isExpanded;
        infoContainer.style.maxHeight = isExpanded ? '500px' : '50px';
        toggleArrow.textContent = isExpanded ? '▲' : '▼';
    });

    infoContainer.appendChild(toggleArrow); */

    iconContainer.appendChild(icon);
    iconContainer.appendChild(infoContainer);
    this.state.progressBar.appendChild(iconContainer);

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
    
    // Créer le conteneur pour le nouveau contenu
    const newContent = document.createElement('div');
    newContent.className = 'flex items-center gap-4 flex-row justify-between';

    // Ajouter le temps formaté
    const timeSpan = document.createElement('span');
    timeSpan.className = 't cursor-pointer';
    timeSpan.textContent = `🕓 ${formattedTime}`;
    newContent.appendChild(timeSpan);

    // Ajouter la note
    if (bookmark.note && bookmark.note.trim() !== '') {
      const noteText = document.createElement('span');
      noteText.className = 't';
      noteText.textContent = bookmark.note;
      newContent.appendChild(noteText);
    }

    // Ajouter deleteIcon
    newContent.appendChild(deleteIcon);

    // Ajouter le nouveau contenu à infoContainer
    infoContainer.appendChild(newContent);

    let isDragging = false;
    let dragStartX, dragStartLeft, dragStartTime;

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
    
    const stopDragging = async (e) => {
      isDragging = false;
      iconContainer.classList.remove('dragging');
      document.removeEventListener('mousemove', dragBookmark);
      document.removeEventListener('mouseup', stopDragging);

      const progressBarRect = this.state.progressBar.getBoundingClientRect();
      const newLeft = parseFloat(iconContainer.style.left);
      const newTime = (newLeft / progressBarRect.width) * this.state.currentVideo.duration;

      if (Math.abs(newTime - dragStartTime) > 5) {
        bookmark.time = newTime;
        try {
          await chrome.runtime.sendMessage({ action: 'updateBookmark', bookmark });
          this.loadBookmarks();
        } catch (error) {
          console.error("Erreur lors de la mise à jour du marque-page:", error);
          iconContainer.style.left = `${(dragStartTime / this.state.currentVideo.duration) * progressBarRect.width}px`;
        }
      } else {
        iconContainer.style.left = `${(dragStartTime / this.state.currentVideo.duration) * progressBarRect.width}px`;
      }
    };

    iconContainer.addEventListener('mousedown', startDragging);

    deleteIcon.addEventListener('click', (e) => {
      console.log("Clic sur l'icône de suppression détecté");
      this.deleteBookmark(bookmark);
    });
  },
  
  async updateBookmarksList() {
    const parentContainer = this.state.parentContainer;
    if (parentContainer) { 
      const elements = document.querySelectorAll('.bookmarks-list');
      elements.forEach(el => el.remove());
      this.state.bookmarksList = document.createElement('div');
      this.state.bookmarksList.style.marginBottom = '10px';
      this.state.bookmarksList.className = 'bookmarks-list flex-1 overflow-y-auto';
      await parentContainer.insertBefore(this.state.bookmarksList, parentContainer.firstChild);
      if (!this.state.bookmarksForThisUrl || this.state.bookmarksForThisUrl.length < 1) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "sct spc-md iso empty-msg grad-br-static-sm";
        emptyMessage.innerHTML = `
        <h3 class="text-xl font-century text-zinc-600 bold">Aucun bookmark pour cette vidéo</h3>
        `;
        this.state.bookmarksList?.appendChild(emptyMessage);
      } else {
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
        
        videoElement.addEventListener('click', (event) => {
          // Vérifiez si le clic n'a pas été effectué sur les éléments enfants spécifiques
          const isClickOnChildElement = event.target.closest('.timestamp') || 
            event.target.closest('.text') || 
            event.target.closest('.delete-bookmark');

          if (!isClickOnChildElement) {
            // Récupérer le conteneur des marque-pages
            const bookmarksContainer = videoElement.querySelector('.bookmarks-container');

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
              // Si le clic est sur un timestamp, sauter à l'heure spécifiée
              const time = event.target.getAttribute('data-time'); // Récupérer le timestamp
              if (this.state.currentVideo) {
                this.state.currentVideo.currentTime = parseFloat(time); // Sauter à l'heure spécifiée
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

  async deleteBookmark(bookmark) {
    console.log("Tentative de suppression du marque-page:", bookmark);
    try {
      this.state.bookmarksForThisUrl = this.state.bookmarksForThisUrl.filter(b => b.time !== bookmark.time);
      console.log("Marque-page supprimé de la liste pour cette URL:", this.state.bookmarksForThisUrl);
      this.state.bookmarks = this.state.bookmarks.filter(b => b.time !== bookmark.time);
      console.log("Marque-page supprimé de la liste globale:", this.state.bookmarks);
      chrome.storage.local.set({ bookmarks: this.state.bookmarks });
      console.log("Marque-page supprimé avec succès dans le stockage local.");
    } catch (error) {
      console.error("Erreur de communication avec l'extension:", error);
      this.afficherMessage(`Erreur de communication avec l'extension : ${error}`, 'error');
    }
    await this.updateUIElements();
    console.log("Éléments de l'interface utilisateur mis à jour après la suppression du marque-page.");
  },

  async navigateBookmarks(direction) {
    const currentTime = Math.round(this.currentVideoTime);
    
    if (direction === 'prev') {
      const prevBookmark = this.state.bookmarks
        .filter(b => b.timeInSeconds < currentTime - 3)
        .pop();
      if (prevBookmark) this.currentVideoTime = prevBookmark.timeInSeconds;
    } else if (direction === 'next') {
      const nextBookmark = this.state.bookmarks
        .filter(b => b.timeInSeconds > currentTime)
        .shift();
      if (nextBookmark) this.currentVideoTime = nextBookmark.timeInSeconds;
    }
  },

  async deleteVideo(event) {
    this.state.bookmarksForThisUrl = [];
    const url = event.currentTarget.dataset.url;
    console.log("Tentative de suppression de la vidéo:", url); // Debug
    
    try {
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

  async modifOptions() {
    chrome.storage.local.get('showBookmarkButtons', ({ showBookmarkButtons }) => {
      console.log("showBookmarkButtons : ", showBookmarkButtons);
    });
    chrome.storage.local.get('hideNotesByDefault', ({ hideNotesByDefault }) => {
      infoContainer.style.display = show || !hideNotesByDefault ? 'block' : 'none';
    });
    chrome.storage.local.get('floatingNotesPosition', ({ floatingNotesPosition }) => {
      console.log("floatingNotesPosition : ", floatingNotesPosition);
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

YouTubeBookmarker.init()

chrome.runtime.onConnect.addListener(function(port) {
if (port.name === "contentScript") {
  port.onDisconnect.addListener(function() {
    console.error("Connexion perdue avec l'extension. Tentative de reconnexion...");
    setTimeout(initializeExtension, 1000);
  });
}
});

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




