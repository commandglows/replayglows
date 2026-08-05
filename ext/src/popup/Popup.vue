<script setup lang="ts">
const openOptions = () => chrome.runtime.openOptionsPage()
</script>

<template>
  <main class="sg-popup">
    <div class="sg-brand-row">
      <div class="sg-brand-mark" aria-hidden="true">R</div>
      <div>
        <p class="sg-eyebrow">ReplayGlowz</p>
        <h1 class="sg-title">YouTube Bookmarker</h1>
      </div>
    </div>
    <section class="sg-empty-state" aria-labelledby="empty-title">
      <div class="sg-empty-icon" aria-hidden="true">+</div>
      <h2 id="empty-title" class="sg-section-title">Prêt à capturer vos idées</h2>
      <p class="sg-muted">Ouvrez une vidéo YouTube pour ajouter un marque-page à un moment précis.</p>
      <button class="sg-button sg-button--primary" type="button" @click="openOptions">
        Personnaliser les raccourcis
      </button>
    </section>
    <footer class="sg-popup-footer">
      <span class="sg-status-dot" aria-hidden="true"></span>
      <span>Vos marque-pages restent dans votre navigateur.</span>
    </footer>
  </main>
</template>
