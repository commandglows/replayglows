IFRAME ok
      const minPosition = (containerWidth / 2 / playerWidth) * 100;
      const maxPosition = 100 - minPosition;
      leftPosition = Math.max(minPosition, Math.min(leftPosition, maxPosition));
      inputContainer.style.left = `${leftPosition}%`;
      
      if (progressBar) {
        const rect = progressBar.getBoundingClientRect();

      } else {
        console.error("Barre de progression non trouvée");
        return;
      }

      // Créer l'iframe
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '15px';

      // Ajoutez l'iframe au conteneur
      inputContainer.appendChild(iframe);

      // Ajoutez le conteneur au body
      document.body.appendChild(inputContainer);

      // Accéder au document de l'iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.body.style.margin = '0';

      // Créer le champ de saisie
      const noteInput = iframeDoc.createElement('input');
      noteInput.type = 'text';
      noteInput.className = 'bookmark-input';
      noteInput.placeholder = 'Ajouter une note pour ce marque-page';

      // Appliquer des styles à l'input
      noteInput.style.width = '100%';
      noteInput.style.height = '100%';
      noteInput.style.boxSizing = 'border-box';

      // Ajoutez le champ de saisie à l'iframe
      iframeDoc.body.appendChild(noteInput);

      // Mettre le focus sur l'input
      noteInput.focus();
    }
  },
 async onPopState() {
    if (window.location.pathname === '/watch') {
      await this.resetState();
      this.loadBookmarks();
    }
  },
 */





  async addBookmark() {
    if (!this.state.bookmarkInputContainer) {
      const inputContainer = document.createElement('div');
      inputContainer.className = this.CONSTANTS.BOOKMARK_INPUT_CONTAINER_CLASS;
      const positionRatio = this.currentVideoTime / this.state.currentVideo.duration;
      let leftPosition = positionRatio * 100;
      const containerWidth = 240;
      const playerWidth = this.state.player.offsetWidth;
      const minPosition = (containerWidth / 2 / playerWidth) * 100;
      const maxPosition = 100 - minPosition;

      leftPosition = Math.max(minPosition, Math.min(leftPosition, maxPosition));
      inputContainer.style.left = `${leftPosition}%`;

      const noteInput = document.createElement('input');
      noteInput.type = 'text';
      noteInput.className = 'bookmark-input';
      noteInput.placeholder = 'Ajouter une note pour ce marque-page';

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

      if (this.state.player) {
        this.state.player.appendChild(inputContainer);
        this.state.bookmarkInputContainer = inputContainer;
        this.state.bookmarkInputElement = noteInput;
        noteInput.focus();
      } else {
        console.error("Conteneur du lecteur non trouvé");
      }

      const handleOutsideClick = (e) => {
        if (!inputContainer.contains(e.target) && e.target !== this.state.bookmarkButton) {
          document.addEventListener('click', handleOutsideClick);
          this.closeBookmarkInput();
          const videoPlayer = document.getElementById('container');
          console.log(videoPlayer);
          if (videoPlayer) {  
            videoPlayer.addEventListener('click', (e) => {
              e.preventDefault();
            });
          document.removeEventListener('click', handleOutsideClick);
        // Vérifier si le conteneur existe
        if (this.state.bookmarkInputContainer) {
          // Si le clic est en dehors du conteneur et du bouton de marque-page
          if (!this.state.bookmarkInputContainer.contains(e.target) && 
              e.target !== this.state.bookmarkButton) {
            this.closeBookmarkInput();
            document.removeEventListener('click', handleOutsideClick);
          }
        }
        console.log("click, fermeture du conteneur d'input");
      };

      // Ajouter l'écouteur d'événement une seule fois
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



