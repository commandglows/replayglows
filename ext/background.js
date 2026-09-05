/**
 * Background Script for ReplayGlows Extension
 * 
 * This service worker handles:
 * - Extension lifecycle events (installation, updates)
 * - Message routing between content scripts and popup
 * - Bookmark data management and storage operations
 * - Video title and thumbnail fetching from YouTube
 * - Export/import functionality for bookmark data
 * 
 * Runs in the background and persists across browser sessions.
 */

// Initialisation des signets lors de l'installation de l'extension
chrome.runtime.onInstalled.addListener(async () => {
  try {
    console.log("BMBackground : Extension installée");
    await BMBackground.init();
    console.log("BMBackground init() this.state.bookmarks", BMBackground.state.bookmarks);
    console.log("BMBackground init() this.state.groupedBookmarks", BMBackground.state.groupedBookmarks);
  } catch (error) {
    console.error("BMBackground Erreur lors de l'initialisation :", error);
  }
});

/**
 * Clears all extension data from local storage.
 * Use with caution - this removes all bookmarks permanently.
 */
async function clearLocalStorage() {
  await chrome.storage.local.clear();
  console.log("BMBackground : stockage local effacé.");
}

/**
 * Central message router for handling requests from content scripts and popup.
 * Uses action-based routing to delegate to appropriate handler methods.
 * All handlers return true to indicate async response handling.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(request.action) {
    case 'deleteBookmark':
      console.log("BMBackground Message reçu : deleteBookmark");
      BMBackground.deleteBookmark(request.bookmark).then(sendResponse);
      console.log("BMBackground : deleteBookmark réponse du background");
      break;
    case 'updateBookmark':
      BMBackground.updateBookmark(request.bookmark).then(sendResponse);
      console.log("BMBackground : updateBookmark réponse du background");
      break;
    case 'getGroupedBookmarks':
      console.log("BMBackground Message reçu : getGroupedBookmarks");
      BMBackground.getGroupedBookmarks().then(groupedBookmarks => {
        console.log("BMBackground Envoi des marque-pages groupés :", groupedBookmarks);
        sendResponse({ groupedBookmarks });
      }).catch(error => {
        console.error("BMBackground Erreur lors de la récupération des groupes de marque-pages:", error);
        sendResponse({ error: error.message });
      });
      return true;
    case 'getVideoTitle':
      BMBackground.getVideoTitle(request.url).then(sendResponse);
      console.log("BMBackground : getVideoTitle réponse du background");
      break;
    case 'getBookmarksByUrl':
      BMBackground.getBookmarksByUrl(request.url).then(sendResponse);
      console.log("BMBackground : getBookmarksByUrl réponse du background");
      break;
    case 'exportBookmarksAsMarkdown':
      BMBackground.exportBookmarksAsMarkdown().then(sendResponse);
      return true;
    case 'deleteVideo':
      // Handle video deletion - removes all bookmarks for a specific video URL
      chrome.storage.local.get(['groupedBookmarks', 'bookmarks'], (result) => {
        try {
          let groupedBookmarks = result.groupedBookmarks || {};
          let bookmarks = result.bookmarks || [];
          
          // Supprimer la vidéo des groupedBookmarks
          delete groupedBookmarks[request.url];
          
          // Supprimer tous les bookmarks associés à cette URL
          bookmarks = bookmarks.filter(bookmark => bookmark.url !== request.url);
          
          // Sauvegarder les deux modifications
          chrome.storage.local.set({ 
            groupedBookmarks: groupedBookmarks,
            bookmarks: bookmarks 
          }, () => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true });
            }
          });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      });
      return true; // Important pour l'async
      break;
    default:
      sendResponse({ error: 'Action non reconnue' });
  }
  return true;
});

/**
 * BMBackground - Core bookmark management service.
 * 
 * Handles all bookmark CRUD operations, data transformation,
 * and communication with Chrome storage APIs.
 */
const BMBackground = {
  /**
   * In-memory cache for bookmark data.
   * Reduces storage reads and improves performance.
   */
  state: {
    groupedBookmarks: {},  // Bookmarks organized by video URL
    bookmarks: []          // Flat array of all bookmarks
  },
  
  /**
   * Initializes the background service by loading existing bookmarks from storage.
   * Creates empty storage entries if none exist.
   */
  async init() {
    console.log("BMBackground : initialisation des bookmarks");
    try {
      const resultBookmarks = await chrome.storage.local.get('bookmarks');
      this.state.bookmarks = resultBookmarks.bookmarks || [];
      
      // Initialize empty bookmarks array in storage if not present
      if (resultBookmarks.bookmarks === undefined) {
        console.log("BMBackground : bookmarks non trouvés, création d'un tableau vide");
        chrome.storage.local.set({ bookmarks: [] });
      }

      const resultGrouped = await chrome.storage.local.get('groupedBookmarks');
      this.state.groupedBookmarks = resultGrouped.groupedBookmarks || {};
      
      console.log("BMBackground init() storedBookmarks", resultBookmarks);
      console.log("BMBackground init() storedGroupedBookmarks", resultGrouped);
    } catch (error) {
      console.error("BMBackground init() error:", error);
    }
  },

  /**
   * Persists bookmarks array to Chrome storage.
   * @param {Array} bookmarks - Array of bookmark objects to save
   */
  async setBookmarks(bookmarks) {
    try {
      await chrome.storage.local.set({ bookmarks: bookmarks || [] });
    } catch (error) {
      console.error("BMBackground Erreur lors de la mise à jour des bookmarks : ", error);
    }
  },

  /**
   * Validates that a bookmark has the required properties.
   * @param {Object} bookmark - The bookmark to validate
   * @throws {Error} If bookmark is missing required fields
   */
  validateBookmark(bookmark) {
    if (!bookmark.url || !bookmark.time) {
      throw new Error("BMBackground validateBookmark : Le bookmark doit contenir une URL et un temps valides.");
    }
  },

  /**
   * Transforms flat bookmark array into URL-grouped structure.
   * This format is more efficient for displaying bookmarks organized by video.
   * 
   * @param {Array} bookmarks - Flat array of bookmarks
   * @returns {Object} Bookmarks grouped by video URL with metadata
   */
  async groupBookmarksByUrl(bookmarks) {
    console.log("BMBackground : groupBookmarksByUrl appelé avec bookmarks:", bookmarks);
    return new Promise((resolve) => {
      // Use setTimeout(0) to avoid blocking the event loop for large datasets
      setTimeout(() => {
        const grouped = bookmarks.reduce((acc, bookmark) => {
          // Skip invalid bookmarks
          if (!bookmark.url || !bookmark.time) {
            console.warn("Marque-page manquant des propriétés requises:", bookmark);
            return acc;
          }
          
          // Create group entry if it doesn't exist
          if (!acc[bookmark.url]) {
            acc[bookmark.url] = {
              title: bookmark.title || 'Titre non disponible',
              url: bookmark.url,
              bmList: []
            };
          }

          // Add bookmark to group's list
          acc[bookmark.url].bmList.push({
            time: bookmark.time,
            formattedTime: bookmark.formattedTime,
            note: bookmark.note || '',
          });
          return acc;
        }, {});

        this.state.groupedBookmarks = grouped;
        resolve(grouped);
      }, 0);
    });
  },

  /**
   * Retrieves bookmarks grouped by video URL for display in popup.
   * Uses caching to avoid re-processing when data hasn't changed.
   * Enriches groups with video titles and thumbnails from YouTube.
   * 
   * @returns {Object} Grouped bookmarks with video metadata
   */
  async getGroupedBookmarks() {
    console.log("BMBackground getGroupedBookmarks appelé");
    try {
      const result = await chrome.storage.local.get('bookmarks');
      const bookmarks = result.bookmarks || [];
      console.log("BMBackground storage de bookmarks", bookmarks);

      if (!bookmarks || bookmarks.length === 0) {
        console.log("Aucun bookmark trouvé, renvoi d'un objet vide");
        this.state.groupedBookmarks = {};
        return this.state.groupedBookmarks;
      }
      
      // Check if bookmarks have changed to determine if regrouping is needed
      // This caching logic improves performance for large bookmark collections
      if (this.state.bookmarks.length === 0 || this.state.bookmarks.some(bookmark => !bookmarks.includes(bookmark))) {
        console.log("Le nombre de bookmarks a changé, regroupement nécessaire");
        this.state.bookmarks = bookmarks;

        const groupedBookmarks = await this.groupBookmarksByUrl(bookmarks);
        
        // Enrich each group with video title and thumbnail
        for (const url in groupedBookmarks) {
          const group = groupedBookmarks[url];
          group.title = (await this.getVideoTitle(url)).title;
          group.thumbnailUrl = await this.getThumbnailUrl(url);
        }

        this.state.groupedBookmarks = groupedBookmarks;
        
        // Cache the grouped result in storage
        await chrome.storage.local.set({ groupedBookmarks: groupedBookmarks });
        console.log("BMBackground groupedBookmarks", groupedBookmarks);
        
        return groupedBookmarks;
      }
      else {
        // Return cached version if no changes detected
        console.log("BMBackground bookmarks identiques, retour des groupedBookmarks en cache");
        return this.state.groupedBookmarks;
      }
    } catch (error) {
      console.error("BMBackground Erreur lors de la récupération des groupes de marque-pages:", error);
      throw error;
    }
  },

  /**
   * Generates a YouTube thumbnail URL from a video URL.
   * Uses YouTube's predictable thumbnail URL format.
   * 
   * @param {string} videoUrl - Full YouTube video URL
   * @returns {string} URL to the video's thumbnail image
   */
  async getThumbnailUrl(videoUrl) {
    const videoId = new URL(videoUrl).searchParams.get('v');
    return `https://img.youtube.com/vi/${videoId}/0.jpg`;
  },

  /**
   * Fetches the video title from YouTube by parsing the page HTML.
   * Falls back to a default string if the title cannot be retrieved.
   * 
   * @param {string} url - YouTube video URL
   * @returns {Object} Object with 'title' property
   */
  async getVideoTitle(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      // Extract title from HTML <title> tag
      const match = text.match(/<title>(.*?)<\/title>/);
      const title = match ? match[1].replace(' - YouTube', '') : 'Titre non disponible';
      return { title };
    } catch (error) {
      console.error('Erreur lors de la récupération du titre:', error);
      return { error: 'Erreur lors de la récupération du titre' };
    }
  },

  /**
   * Retrieves all bookmarks for a specific video URL.
   * 
   * @param {string} url - Video URL to filter by
   * @returns {Object} Object with 'bookmarks' array
   */
  async getBookmarksByUrl(url) {
    try {
      const result = await chrome.storage.local.get('bookmarks');
      const bookmarks = result.bookmarks || [];
      const urlBookmarks = bookmarks.filter(bookmark => bookmark.url === url);
      return { bookmarks: urlBookmarks };
    } catch (error) {
      console.error("BMBackground Erreur lors de la récupération des marque-pages pour l'URL:", error);
      return { error: error.message };
    }
  },

  /**
   * Deletes a single bookmark from storage.
   * Matches by timestamp since the same URL can have multiple bookmarks.
   * 
   * @param {Object} bookmarkToDelete - Object with 'url' and 'time' properties
   * @returns {Object} Success indicator or error message
   */
  async deleteBookmark(bookmarkToDelete) {
    console.log("BMBackground : Début de deleteBookmark avec:", bookmarkToDelete);
    try {
      const result = await chrome.storage.local.get('bookmarks');
      console.log("BMBackground : Résultat de chrome.storage.local.get('bookmarks'):", result);
      
      let bookmarks = result.bookmarks || [];
      console.log("BMBackground : Bookmarks récupérés:", bookmarks);
      
      console.log("BMBackground : Bookmark à supprimer - URL:", bookmarkToDelete.url, "Time:", bookmarkToDelete.time);
      
      // Filter out the bookmark matching the given timestamp
      const updatedBookmarks = bookmarks.filter(b => {
        console.log("BMBackground Comparaison - Bookmark actuel:", b);
        console.log("Comparaison - Time:", b.time, "==", bookmarkToDelete.time);
        // Compare as numbers to handle type mismatches
        const shouldKeep = !(Number(b.time) === Number(bookmarkToDelete.time));
        console.log("BMBackground Garder ce bookmark?", shouldKeep);
        return shouldKeep;
      });

      // Only update storage if something was actually deleted
      if (updatedBookmarks.length !== bookmarks.length) {
        await chrome.storage.local.set({ bookmarks: updatedBookmarks });
        console.log("BMBackground : Stockage mis à jour avec succès");
        return { success: true };
      } else {
        console.error("BMBackground : Aucun signet supprimé, vérifiez les valeurs.");
        return { error: 'Aucun signet supprimé' };
      }
    } catch (error) {
      console.error("BMBackground Erreur lors de la suppression du marque-page:", error);
      return { error: error.message };
    }
  },

  /**
   * Updates an existing bookmark (e.g., after drag-and-drop repositioning).
   * Locates bookmark by URL and original time, then updates with new values.
   * 
   * @param {Object} updatedBookmark - New bookmark data with 'originalTime' property
   * @returns {Object} Success indicator or error message
   */
  async updateBookmark(updatedBookmark) {
    try {
      const result = await chrome.storage.local.get('bookmarks');
      let bookmarks = result.bookmarks || [];
      // Find bookmark by URL and original timestamp
      const index = bookmarks.findIndex(b => 
        b.url === updatedBookmark.url && b.time === updatedBookmark.originalTime
      );
      if (index !== -1) {
        bookmarks[index] = updatedBookmark;
        await chrome.storage.local.set({ bookmarks });
        return { success: true };
      } else {
        return { error: 'Marque-page non trouvé' };
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour du marque-page:", error);
      return { error: error.message };
    }
  },

  /**
   * Loads bookmarks from storage into memory.
   * Called during initialization and after external changes.
   */
  async loadInitialBookmarks() {
    try {
      const result = await chrome.storage.local.get('bookmarks');
      this.bookmarks = result.bookmarks || [];
    } catch (error) {
      console.error("Erreur lors du chargement initial des marque-pages:", error);
    }
  },

  /**
   * Exports all bookmarks as formatted Markdown text.
   * Groups by video and includes titles, thumbnails, and timestamps.
   * Sends the result to the popup for clipboard copying.
   */
  async exportBookmarksAsMarkdown() {
    console.log("Exportation des marque-pages en Markdown...");
    const bookmarks = await chrome.storage.local.get('bookmarks');
    if (!bookmarks || bookmarks.length === 0) {
      chrome.runtime.sendMessage({ action: "afficherMessage", message: "Aucun marque-page à exporter.", type: "error" });
      return;
    }
    const groupedBookmarks = await this.getGroupedBookmarks();
    
    console.log("BMBackground : groupedBookmarks:", groupedBookmarks);
    let markdown = '';

    // Build markdown with video sections and bookmark lists
    Object.values(groupedBookmarks).forEach(video => {
        markdown += `## ${video.title}\n[${video.title}](${video.url})\n![Thumbnail](${video.thumbnailUrl})\n`;
        video.bmList.forEach(bmList => {
            markdown += `[${bmList.formattedTime}](${video.url}&t=${bmList.time}): ${bmList.note}\n`;
        });
        markdown += '\n';
    });

    // Send to popup/options page for clipboard access
    chrome.runtime.sendMessage({ action: "copyToClipboard", markdown });
  },

  /**
   * Exports all bookmarks as a JSON file download.
   * Creates a Blob and triggers a download via temporary anchor element.
   * 
   * @param {Array} bookmarks - Array of bookmark objects to export
   */
  async exportBookmarksAsJSON(bookmarks) {
    const json = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create temporary download link
    const a = document.createElement('a');
    a.href = url;
      a.download = 'bookmarks.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  },

  /**
   * Imports bookmarks from a JSON file.
   * Replaces existing bookmarks with imported data.
   * 
   * @param {File} file - JSON file containing bookmark array
   */
  async importBookmarks(file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const bookmarks = JSON.parse(event.target.result);
              await chrome.storage.local.set({ bookmarks }); // Utilisation de local au lieu de sync
              alert('Marque-pages importés avec succès !');
          } catch (error) {
              alert('Erreur lors de l\'importation du fichier. Assurez-vous qu\'il s\'agit d\'un fichier JSON valide.');
          }
      };
      reader.readAsText(file);
  },
};
