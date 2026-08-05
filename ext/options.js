/**
 * Options Page Script for YouTube Bookmarker Extension
 * 
 * Handles user preferences and settings including:
 * - Custom keyboard shortcuts configuration
 * - UI preferences (hide notes, show bookmark buttons)
 * - Bookmark import/export functionality
 * 
 * All settings are persisted to Chrome local storage.
 */

/**
 * BMOptions - Controller for the extension options page.
 * Manages hotkey configuration, display preferences, and data export/import.
 */
const BMOptions = {
    // DOM element references (populated after DOMContentLoaded)
    elements: {},
    // Flag to prevent duplicate event listener attachment
    eventListenersAdded: false,
    
    /**
     * Default keyboard shortcuts for all bookmark actions.
     * Users can customize these in the options page.
     */
    defaultHotkeys: {
        'add-bookmark': 'ALT+B',      // Open bookmark input with note field
        'delete-bookmark': 'ALT+D',   // Delete bookmark at current time
        'quick-bookmark': 'ALT+Q',    // Add bookmark without note
        'prev-bookmark': 'ALT+1',     // Jump to previous bookmark
        'next-bookmark': 'ALT+2',     // Jump to next bookmark
    },

    /**
     * Initializes the options page after DOM is ready.
     * Loads saved options and sets up event listeners.
     */
    init() {
        document.addEventListener('DOMContentLoaded', async () => {
            this.elements = this.getPageElements();
            await this.loadOptions();
            if (!this.eventListenersAdded) {
                this.setupEventListeners();
                this.eventListenersAdded = true;
            }
        });
    },

    /**
     * Queries and caches references to all interactive DOM elements.
     * @returns {Object} Object containing element references
     */
    getPageElements() {
        return {
            hotkeyForm: document.getElementById('hotkeys-form'),
            exportMarkdownBtn: document.getElementById('export-markdown'),
            exportJSONBtn: document.getElementById('export-json'),
            importBtn: document.getElementById('import-bookmarks'),
            importFileInput: document.getElementById('import-file'),
            hideNotesCheckbox: document.getElementById('hide-notes-by-default'),
            showBookmarkButtonsCheckbox: document.getElementById('show-bookmark-buttons'),
            hotkeyInputs: document.querySelectorAll('input[type="text"]'),
            quickBookmarkInput: document.getElementById('quick-bookmark')
        };
    },

    /**
     * Loads saved options from Chrome storage and populates form fields.
     * Uses default values for any missing settings.
     */
    async loadOptions() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['hotkeys', 'hideNotesByDefault', 'showBookmarkButtons'], (result) => {
                const hotkeys = result.hotkeys || this.defaultHotkeys;
                
                // Populate hotkey input fields with saved values
                Object.entries(hotkeys).forEach(([key, value]) => {
                    const element = document.getElementById(key);
                    if (element) {
                        element.value = value;
                    }
                });

                // Update delete button visibility based on whether hotkey is set
                this.elements.hotkeyInputs.forEach(input => {
                    const deleteButton = document.querySelector(`.delete-${input.id}`);

                    if (!hotkeys[input.id]) {
                        input.placeholder = 'Aucun';
                        if (deleteButton) {
                            deleteButton.style.visibility = 'hidden';
                            deleteButton.style.pointerEvents = 'none';
                        }
                    } else {
                        if (deleteButton) {
                            deleteButton.style.visibility = 'visible';
                            deleteButton.style.pointerEvents = 'auto';
                        }
                    }
                });

                // Initialize storage with defaults if not present
                if (!result.hotkeys) {
                    chrome.storage.local.set({ hotkeys: this.defaultHotkeys });
                }

                // Load checkbox states
                if (this.elements.hideNotesCheckbox) {
                    this.elements.hideNotesCheckbox.checked = result.hideNotesByDefault || false;
                } else {
                    console.warn("L'élément hideNotesCheckbox n'a pas été trouvé dans le DOM.");
                }
                if (this.elements.showBookmarkButtonsCheckbox) {
                    this.elements.showBookmarkButtonsCheckbox.checked = result.showBookmarkButtons || false;
                } else {
                    console.warn("L'élément showBookmarkButtonsCheckbox n'a pas été trouvé dans le DOM.");
                }
                resolve();
            });
        });
    },

    /**
     * Displays a toast notification message.
     * Auto-hides after 1.5 seconds (except 'loading' type).
     * 
     * @param {string} message - Message text to display
     * @param {string} type - 'info' | 'error' | 'loading'
     */
    afficherMessage(message, type = 'info') {
        // Remove existing messages to prevent stacking
        document.querySelectorAll('.msg').forEach(msg => msg.remove());

        const messageContainer = document.createElement('div');
        messageContainer.className = `msg ${type}`;
        messageContainer.textContent = message;
        document.body.appendChild(messageContainer);

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
     * Sets up all event listeners for the options page.
     * Handles hotkey inputs, checkboxes, and export/import buttons.
     */
    setupEventListeners() {
        // Attach keydown handler to all hotkey input fields
        this.elements.hotkeyInputs.forEach(input => {
            input.addEventListener('keydown', this.handleHotkeyInput.bind(this));
        });

        // Charger les raccourcis existants
        this.loadHotkeys();

        // Attach handlers for data-action based hotkey inputs
        const hotkeyInputs = document.querySelectorAll('[data-action]');
        hotkeyInputs.forEach(input => {
            input.addEventListener('keydown', this.handleHotkeyCapture.bind(this));
        });

        // Save display preferences when checkboxes change
        this.elements.hideNotesCheckbox.addEventListener('change', (e) => {
            chrome.storage.local.set({ hideNotesByDefault: e.target.checked }, () => {
                console.log('Données enregistrées avec succès !');
            });
            this.afficherMessage('Option enregistrée !');
        });

        this.elements.showBookmarkButtonsCheckbox.addEventListener('change', (e) => {
            chrome.storage.local.set({ showBookmarkButtons: e.target.checked }, () => {
                console.log('Données enregistrées avec succès !');
            });
            this.afficherMessage('Option enregistrée !');
        });

        // Export buttons - delegate to background script
        this.elements.exportMarkdownBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: "exportBookmarksAsMarkdown" });
        });

        this.elements.exportJSONBtn.addEventListener('click', () => {
            chrome.storage.local.get('bookmarks', ({ bookmarks }) => {
                this.handleExportJSON(bookmarks);
            });
        });

        // Import button - requires file selection first
        this.elements.importBtn.addEventListener('click', () => {
            const file = this.elements.importFileInput.files[0];
            if (!file) {
                alert('Veuillez sélectionner un fichier à importer.');
                return;
            }
            importBookmarks(file);
        });

        // Delete buttons for each hotkey action
        Object.keys(this.defaultHotkeys).forEach(hotkeyId => {
            const deleteButton = document.querySelector(`.delete-${hotkeyId}`);
            if (deleteButton) {
                deleteButton.addEventListener('click', (e) => {
                    const input = document.getElementById(hotkeyId);
                    this.handleHotkeyDeletion(e, input);
                });
            }
        });
    },

    /**
     * Handles keydown events on hotkey input fields.
     * Captures the key combination and updates the input value.
     * 
     * @param {KeyboardEvent} e - The keydown event
     */
    handleHotkeyInput(e) {
        e.preventDefault();
        const hotkey = this.generateHotkeyString(e);
        e.target.value = hotkey;
        this.saveHotkeys();
    },

    /**
     * Generates a hotkey string from a keyboard event.
     * Combines modifier keys (Ctrl, Alt, Shift) with the pressed key.
     * 
     * @param {KeyboardEvent} e - The keyboard event
     * @returns {string} Formatted hotkey string (e.g., "Ctrl+Alt+B")
     */
    generateHotkeyString(e) {
        const key = e.key.toUpperCase();
        const modifiers = ['Ctrl', 'Alt', 'Shift'].filter(mod => e[`${mod.toLowerCase()}Key`]);
        return [...modifiers, key].join('+');
    },

    /**
     * Persists all hotkey settings to Chrome storage.
     * Collects values from all text inputs with IDs.
     */
    saveHotkeys() {
        const hotkeys = Object.fromEntries(
            Array.from(document.querySelectorAll('input[type="text"]'))
                .map(input => [input.id, input.value])
        );
        chrome.storage.local.set({ hotkeys });
        this.afficherMessage('Raccourci enregistré !');
    },

    /**
     * Handler for hide notes checkbox change.
     * @deprecated Use inline handler in setupEventListeners
     */
    handleHideNotesChange(e) {
        chrome.storage.local.set({ hideNotesByDefault: e.target.checked }, () => {
            console.log('Données enregistrées avec succès !');
        });
        this.afficherMessage('Option enregistrée !');
    },

    /**
     * Handler for show bookmark buttons checkbox change.
     * @deprecated Use inline handler in setupEventListeners
     */
    handleShowBookmarkButtonsChange(e) {
        chrome.storage.local.set({ showBookmarkButtons: e.target.checked }, () => {
            console.log('Données enregistrées avec succès !');
        });
        this.afficherMessage('Option enregistrée !');
    },
    
    /**
     * Copies text to clipboard with loading feedback.
     * 
     * @param {string} markdown - Text to copy
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
     * Triggers JSON export via message to background script.
     */
    handleExportJSON() {
        chrome.runtime.sendMessage({ action: "exportBookmarksAsJSON" });
        console.log("exportJSONButton appelé");
    },

    /**
     * Handles bookmark import from selected file.
     * 
     * @param {HTMLInputElement} fileInput - File input element
     */
    handleImport(fileInput) {
        const file = fileInput.files[0];
        if (!file) {
            this.afficherMessage('Veuillez sélectionner un fichier à importer.', 'warning');
            return;
        }
        importBookmarks(file);
        this.afficherMessage('Importation terminée !', 'info');
    },

    /**
     * Loads saved hotkeys from storage and populates input fields.
     * Uses data-action attributes to match inputs with actions.
     */
    loadHotkeys() {
        chrome.storage.local.get('hotkeys', ({ hotkeys }) => {
            if (hotkeys) {
                Object.entries(hotkeys).forEach(([action, hotkey]) => {
                    const input = document.querySelector(`[data-action="${action}"]`);
                    input.value = hotkey;
                });
            }
        });
    },

    /**
     * Captures keyboard input for hotkey configuration.
     * Builds modifier+key string from the event.
     * 
     * @param {KeyboardEvent} event - The keydown event
     */
    handleHotkeyCapture(event) {
        event.preventDefault();
        
        const keys = [];
        if (event.ctrlKey) keys.push('Ctrl');
        if (event.altKey) keys.push('Alt');
        if (event.shiftKey) keys.push('Shift');
        
        // Don't include modifier keys as the final key
        if (!['Control', 'Alt', 'Shift'].includes(event.key)) {
            keys.push(event.key.toUpperCase());
        }
        
        const hotkeyString = keys.join('+');
        event.target.value = hotkeyString;
    },

    /**
     * Clears a hotkey assignment when delete button is clicked.
     * Updates storage and shows placeholder text.
     * 
     * @param {Event} e - Click event
     * @param {HTMLInputElement} input - The hotkey input to clear
     */
    handleHotkeyDeletion(e, input) {
        e.preventDefault();
        input.value = '';
        input.placeholder = 'Aucun';

        // Remove this hotkey from storage
        chrome.storage.local.get('hotkeys', ({ hotkeys }) => {
            if (hotkeys) {
                const updatedHotkeys = { ...hotkeys };
                delete updatedHotkeys[input.id];
                chrome.storage.local.set({ hotkeys: updatedHotkeys }, () => {
                    this.afficherMessage('Raccourci supprimé !');
                });
            }
        });
    },
}

// Initialize options page
BMOptions.init();

/**
 * Message listener for actions from other extension components.
 * Handles feedback messages, clipboard operations, and export triggers.
 */
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "showMessage") {
        BMOptions.afficherMessage(request.message);
    }
    if (request.action === "copyToClipboard") {
        BMOptions.copyToClipboard(request.markdown);
    }
    if (request.action === "exportBookmarksAsJSON") {
        BMOptions.handleExportJSON();
    }
});
