/**
 * Popup Script for YouTube Bookmarker Extension
 * 
 * Handles the popup UI that appears when clicking the extension icon.
 * Displays all bookmarks grouped by video with thumbnails and timestamps.
 * Provides controls for:
 * - Viewing and navigating to bookmarks
 * - Deleting individual bookmarks or entire videos
 * - Exporting bookmarks as Markdown
 * - Accessing extension settings
 */

/* // Message listener for popup-specific actions (currently disabled)
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "closePopup") {
    BMPopup.resetState();
  }
  return true;
}); */

/**
 * BMPopup - Main controller for the extension popup UI.
 * Manages the display of grouped bookmarks and user interactions.
 */
const BMPopup = {
  // Flag to prevent redundant initialization calls
  initializationComplete: false,
  
  /**
   * UI state and references to DOM elements.
   */
  state: {
    bookmarks: [],            // All bookmarks from storage
    groupedBookmarks: {},     // Bookmarks grouped by video URL
    bookmarksList: null,      // Container element for bookmark cards
    toggleNotesButton: null,  // Button to show/hide notes
    deleteVideoButton: null,  // Button to delete all bookmarks for a video
    deleteBookmarkButton: null, // Button to delete individual bookmark
    settingsButton: null,     // Opens options page
    exportMarkdownButton: null, // Triggers Markdown export
  },
  
  /**
   * Initializes the popup when opened.
   * Loads bookmarks from background script and renders the UI.
   */
  async init() {
    console.log("init this.state.groupedBookmarks", this.state.groupedBookmarks);
    console.log("init this.state.bookmarks", this.state.bookmarks);
    this.resetState();
    if (!this.initializationComplete) {
      try {
        await this.getGroupedBookmarks();
        console.log("BMPopup init getGroupedBookmarks:", this.state.groupedBookmarks);
      } catch (error) {
        console.error("BMPopup init error:", error);
      }
    } else {
      console.log("Initialization already completed, skipping redundant calls");
    }
    this.loadBookmarksIntoHTML();
    this.initializationComplete = true;
    this.addEventListeners();
  },

  /**
   * Attaches click handlers to settings and export buttons.
   */
  addEventListeners() {
    const settingsButton = document.getElementById("settings");
    const exportMarkdownButton = document.getElementById("export-markdown");

    if (settingsButton) {
      settingsButton.addEventListener("click", () => this.openSettings());
    }

    if (exportMarkdownButton) {
      exportMarkdownButton.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "exportBookmarksAsMarkdown" });
      });
    }
  },

  /**
   * Resets internal state and re-queries DOM elements.
   * Called on popup open to ensure fresh state.
   */
  async resetState() {
    const storedBookmarks = await chrome.storage.local.get('bookmarks');
    const storedGroupedBookmarks = await chrome.storage.local.get('groupedBookmarks');

    this.state = {
      bookmarks: storedBookmarks || [],
      groupedBookmarks: storedGroupedBookmarks || {},  
      bookmarksList: document.getElementById("bookmarks-list"),
      deleteVideoButton: document.querySelector(".delete-video"),
      deleteBookmarkButton: document.querySelector(".delete-bookmark"),
      settingsButton: document.getElementById("settings"),
      exportMarkdownButton: document.getElementById("export-markdown"),
    };
  },

  /**
   * Fetches grouped bookmarks from the background script.
   * Uses Chrome messaging API for cross-context communication.
   * 
   * @returns {Object} Grouped bookmarks data
   */
  async getGroupedBookmarks() {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "getGroupedBookmarks" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });

    if (response && response.groupedBookmarks) {
      this.state.groupedBookmarks = response.groupedBookmarks;
      console.log("Récupération des groupedBookmarks du background:", this.state.groupedBookmarks);
      return this.state.groupedBookmarks;
    } else {
      throw new Error("Réponse invalide du background script");
    }
  },

  /**
   * Renders the bookmark list in the popup UI.
   * Creates expandable video cards with thumbnails and bookmark lists.
   * Each bookmark shows formatted time and note with clickable timestamp.
   */
  async loadBookmarksIntoHTML() {
    const bookmarksList = this.state.bookmarksList;
    bookmarksList.innerHTML = "";
    console.log("loadBookmarksIntoHTML appelé");
    const groupedBookmarks = this.state.groupedBookmarks;

    if (groupedBookmarks && Object.keys(groupedBookmarks).length > 0) {
      Object.keys(groupedBookmarks).forEach((url) => {
        const videoData = groupedBookmarks[url];
        // Sort bookmarks by timestamp for consistent display order
        const bmList = videoData.bmList.sort((a, b) => a.time - b.time);
        
        // Create video card with thumbnail, title, and expandable bookmark list
        const videoElement = document.createElement("div");
        videoElement.className = "video-item cursor-pointer sct spc-md iso grad-ult-bg-white-sm";
        videoElement.innerHTML = `
          <div class="flex items-start gap-4">
            <a href="${url}" target="_blank" class="w-1/3">
              <div class="aspect-video relative">
                <img src="${videoData.thumbnailUrl}" alt="${videoData.title}" class="absolute inset-0 w-full h-full object-cover hover:text-gray-600 transition-colors rounded-lg shadow-md">
              </div>
            </a>
            <div class="flex-1 video-item-container">
              <div class="flex flex-row justify-between">
                <h3 class="text-base text-zinc-600 bold">${videoData.title}</h3>
                <div class="flex flex-col">
                  <button class="hover:animate-spin text-lg delete-video" data-url="${url}">🗑️</button>
                </div>
              </div>
              <div class="bookmarks-container hidden transform transition-all duration-300 ease-in-out origin-top scale-y-0 opacity-0">
              ${bmList.map(bookmark => `
                <div class="flex items-center justify-between text-base bg-slate-400/10 rounded-md">
                  <div class="flex items-center gap-3">
                    <a href="${url}&t=${bookmark.time}" class="text-zinc-800 cursor-pointer timestamp" data-url="${url}&t=${bookmark.time}">🕓 ${bookmark.formattedTime}</a>
                    <span class="text-zinc-800">${bookmark.note}</span>
                  </div>
                  <button class="delete-bookmark hover:animate-ping" data-url="${url}" data-timestamp="${bookmark.time}">
                    🗑️
                  </button>
                </div>
              `).join('')}
              </div>
            </div>
          </div>
        `;

          bookmarksList.appendChild(videoElement);

          // Attach delete handlers after element is in DOM
          const deleteBookmarkButtons = videoElement.querySelectorAll('.delete-bookmark');
          deleteBookmarkButtons.forEach(button => {
              button.addEventListener('click', (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  this.deleteBookmark(event);
              });
          });

          // Make timestamps clickable to open video at that time
          const timestampElements = videoElement.querySelectorAll('.timestamp');
          timestampElements.forEach(element => {
              element.addEventListener('click', (event) => {
                  event.preventDefault();
                  const url = element.getAttribute('data-url');
                  if (url) {
                      window.open(url, '_blank');
                  }
              });
          });

        // Toggle expand/collapse on card click (excluding interactive elements)
        videoElement.addEventListener('click', (event) => {
          // Exclure explicitement les boutons de suppression
          if (!event.target.closest('.delete-bookmark') && 
              !event.target.closest('.delete-video') && 
              !event.target.closest('a')) {
            const bookmarksContainer = videoElement.querySelector('.bookmarks-container');
            
            // Animate expand/collapse using CSS transforms
            if (bookmarksContainer.classList.contains('hidden')) {
              // Affichage
              bookmarksContainer.classList.remove('hidden');
              setTimeout(() => {
                bookmarksContainer.classList.remove('scale-y-0', 'opacity-0');
                bookmarksContainer.classList.add('scale-y-100', 'opacity-100');
              }, 0);
            } else {
              // Masquage
              bookmarksContainer.classList.remove('scale-y-100', 'opacity-100');
              bookmarksContainer.classList.add('scale-y-0', 'opacity-0');
              // Wait for transition to complete before hiding
              bookmarksContainer.addEventListener('transitionend', () => {
                bookmarksContainer.classList.add('hidden');
              }, { once: true });
            }
          }
        });

        const deleteVideoButton = videoElement.querySelector('.delete-video');
        if (deleteVideoButton) {
          deleteVideoButton.addEventListener('click', (event) => this.deleteVideo(event));
        }
      });
    } else {
      // Show empty state message when no bookmarks exist
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "sct spc-md iso grad-br-static-sm";
      emptyMessage.innerHTML = `
        <p class="t text-center">Aucun marque-page enregistré.</p>
      `;
      bookmarksList.appendChild(emptyMessage);
    }
  },

  /**
   * Deletes all bookmarks for a specific video.
   * Sends request to background script and refreshes UI on success.
   * 
   * @param {Event} event - Click event with data-url attribute
   */
  async deleteVideo(event) {
    event.preventDefault();
    event.stopPropagation();
    const url = event.currentTarget.dataset.url;
    console.log("Tentative de suppression de la vidéo:", url);
    
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
        // Refresh UI after successful deletion
        await this.getGroupedBookmarks();
        await this.loadBookmarksIntoHTML();
        this.afficherMessage("Vidéo supprimée avec succès", "info");
      } else {
        throw new Error(response.error || "Erreur inconnue");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression de la vidéo :", error);
      this.afficherMessage("Erreur lors de la suppression de la vidéo", "error");
    }
  },

  /**
   * Opens the extension options page in a new tab.
   */
  async openSettings() {
    chrome.runtime.openOptionsPage();
  },

  /**
   * Displays a toast notification message in the popup.
   * Auto-hides after 1.5 seconds (except for 'loading' type).
   * 
   * @param {string} message - Message text to display
   * @param {string} type - 'info' | 'error' | 'loading'
   */
  afficherMessage(message, type = 'info') {
    // Supprimer tous les messages existants avant d'en afficher un nouveau
    document.querySelectorAll('.pp').forEach(pp => pp.remove());

    const messageContainer = document.createElement('div');
    messageContainer.className = `pp ${type}`;
    messageContainer.textContent = message;
    document.body.appendChild(messageContainer);

    // Auto-hide after delay (except loading messages)
    if (type !== 'loading') {
        setTimeout(() => {
            messageContainer.classList.add('hide');
            setTimeout(() => {
                messageContainer.remove();
            }, 1000);
        }, 1500);
    }
  },

  /**
   * Copies text to clipboard and shows feedback message.
   * Used for Markdown export functionality.
   * 
   * @param {string} markdown - Text content to copy
   */
  async copyToClipboard(markdown) {
    try {
        this.afficherMessage("Copie du Markdown en cours...", "loading");
        await navigator.clipboard.writeText(markdown);
        this.afficherMessage("Markdown copié !", "info");
    } catch (err) {
        this.afficherMessage("Impossible de copier dans le presse-papiers.", "error");
    }
  },

  /**
   * Deletes a single bookmark via background script.
   * Keeps the video card expanded after deletion for better UX.
   * 
   * @param {Event} event - Click event with data attributes
   */
  async deleteBookmark(event) {
    console.log("BMPopup deleteBookmark appelé");
    const button = event.currentTarget;
    const url = button.dataset.url;
    const time = button.dataset.timestamp;

    // Store reference to current video card for re-expanding after refresh
    const videoElement = button.closest('.video-item');
    console.log("Tentative de suppression :", {
      url: url,
      time: time,
      buttonDataset: button.dataset,
      button: button
    });

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteBookmark',
        bookmark: {
          url: url,
          time: time
        }
      });

      if (response.success) {
        await this.getGroupedBookmarks();
        await this.loadBookmarksIntoHTML();
        
        // Re-open the bookmark list for the affected video
        if (videoElement) {
          const newVideoElement = document.querySelector(`[data-url="${url}"]`)?.closest('.video-item');
          if (newVideoElement) {
            const bookmarksContainer = newVideoElement.querySelector('.bookmarks-container');
            if (bookmarksContainer) {
              bookmarksContainer.classList.remove('hidden', 'scale-y-0', 'opacity-0');
              bookmarksContainer.classList.add('scale-y-100', 'opacity-100');
            }
          }
        }
        
        this.afficherMessage("Signet supprimé avec succès", "info");
      } else {
        this.afficherMessage('Erreur lors de la suppression du signet', 'error');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du signet:', error);
      this.afficherMessage('Erreur lors de la suppression du signet', 'error');
    }
  },

};

// Initialize popup when DOM is fully loaded
document.addEventListener("DOMContentLoaded", async () => {
  await BMPopup.init();
});

/**
 * Message listener for actions triggered by other extension components.
 * Handles clipboard operations and feedback messages.
 */
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "afficherMessage") {
    BMPopup.afficherMessage(request.message);
  }
  if (request.action === "copyToClipboard") {
    BMPopup.copyToClipboard(request.markdown);
  }
});
