<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { type Bookmark, normalizeBookmarks } from '../bookmarks'
const bookmarks = ref<Bookmark[]>([])
const error = ref('')
const editing = ref<Bookmark | null>(null)
const note = ref('')
const openOptions = () => chrome.runtime.openOptionsPage()
const load = async () => {
  try {
    const result = await chrome.storage.local.get('bookmarks')
    bookmarks.value = normalizeBookmarks(result.bookmarks ?? []).sort((a, b) => a.url.localeCompare(b.url) || a.time - b.time)
  } catch { error.value = 'Impossible de charger les marque-pages.' }
}
const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
  if (area === 'local' && changes.bookmarks) void load()
}
onMounted(() => { void load(); chrome.storage.onChanged.addListener(onStorage) })
onUnmounted(() => chrome.storage.onChanged.removeListener(onStorage))
const mutate = async (action: string, bookmark: Bookmark) => {
  error.value = ''
  try {
    const response = await chrome.runtime.sendMessage({ action, bookmark })
    if (response.error) throw new Error(response.error)
    editing.value = null
    await load()
  } catch (e) { error.value = e instanceof Error ? e.message : 'Échec de sauvegarde.' }
}
const visit = async (bookmark: Bookmark) => {
  await chrome.tabs.create({ url: `${bookmark.url}&t=${bookmark.time}s` })
}
</script>

<template>
  <main class="sg-popup">
    <div class="sg-brand-row">
      <div
        class="sg-brand-mark"
        aria-hidden="true"
      >
        R
      </div>
      <div>
        <p class="sg-eyebrow">
          ReplayGlows
        </p><h1 class="sg-title">
          YouTube Bookmarker
        </h1>
      </div>
    </div>
    <p
      v-if="error"
      role="alert"
      class="sg-muted"
    >
      {{ error }}
    </p>
    <section
      v-if="!bookmarks.length"
      class="sg-empty-state"
      aria-labelledby="empty-title"
    >
      <div
        class="sg-empty-icon"
        aria-hidden="true"
      >
        +
      </div>
      <h2
        id="empty-title"
        class="sg-section-title"
      >
        Prêt à capturer vos idées
      </h2>
      <p class="sg-muted">
        Ouvrez une vidéo YouTube pour ajouter un marque-page à un moment précis.
      </p>
    </section>
    <section
      v-else
      aria-label="Vos marque-pages"
    >
      <h2 class="sg-section-title">
        Vos marque-pages ({{ bookmarks.length }})
      </h2>
      <article
        v-for="bookmark in bookmarks"
        :key="`${bookmark.url}:${bookmark.time}`"
        class="sct"
      >
        <button
          type="button"
          class="sg-button"
          @click="visit(bookmark)"
        >
          {{ bookmark.title || 'Vidéo YouTube' }} · {{ bookmark.formattedTime }}
        </button>
        <form
          v-if="editing === bookmark"
          @submit.prevent="mutate('updateBookmark', { ...bookmark, note })"
        >
          <label>Note <input
            v-model="note"
            class="inp"
            aria-label="Modifier la note"
          ></label>
          <button
            class="sg-button sg-button--primary"
            type="submit"
          >
            Enregistrer
          </button>
          <button
            class="sg-button"
            type="button"
            @click="editing = null"
          >
            Annuler
          </button>
        </form>
        <template v-else>
          <p class="sg-muted">
            {{ bookmark.note || 'Sans note' }}
          </p>
          <button
            class="sg-button"
            type="button"
            @click="editing = bookmark; note = bookmark.note"
          >
            Modifier
          </button>
          <button
            class="sg-button"
            type="button"
            @click="mutate('deleteBookmark', bookmark)"
          >
            Supprimer
          </button>
        </template>
      </article>
    </section>
    <button
      class="sg-button sg-button--primary"
      type="button"
      @click="openOptions"
    >
      Options et import/export
    </button>
    <footer class="sg-popup-footer">
      <span
        class="sg-status-dot"
        aria-hidden="true"
      /><span>Vos marque-pages restent dans votre navigateur.</span>
    </footer>
  </main>
</template>
