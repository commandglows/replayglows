<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { type Bookmark, normalizeBookmarks } from '../bookmarks'
import PlaybackCard from '../playback/PlaybackCard.vue'
import DiscoveryGuide from '../discovery/DiscoveryGuide.vue'
import { recordAchievement, type Milestone } from '../discovery/state'
import type { PlaybackView } from '../playback/protocol'
const guide = ref<InstanceType<typeof DiscoveryGuide>>()
const playback = ref<InstanceType<typeof PlaybackCard>>()
const playbackView = ref<PlaybackView | null>(null)
const bookmarkSection = ref<HTMLElement>()
const helpButton = ref<HTMLButtonElement>()
const practice = (topic: Milestone) => {
  if (topic === 'note' || topic === 'opened') {
    bookmarkSection.value?.scrollIntoView({ block: 'start' })
    bookmarkSection.value?.focus()
  } else playback.value?.focusControls(topic === 'loop')
}
const bookmarks = ref<Bookmark[]>([])
const error = ref('')
const editing = ref<Bookmark | null>(null)
const note = ref('')
const openOptions = () => chrome.runtime.openOptionsPage()
const load = async () => {
  try {
    const result = await chrome.storage.local.get('bookmarks')
    bookmarks.value = normalizeBookmarks(result.bookmarks ?? []).sort((a, b) => a.url.localeCompare(b.url) || a.time - b.time)
    if (bookmarks.value.some(item => item.note?.trim())) {
      try { await recordAchievement('note') } catch { error.value = 'Vos notes sont chargées, mais la progression du guide n’a pas pu être enregistrée.' }
    }
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
  try {
    await chrome.tabs.create({ url: `${bookmark.url}&t=${bookmark.time}s` })
    try { await recordAchievement('opened') } catch { error.value = 'Vidéo ouverte, mais progression du guide non enregistrée.' }
  } catch { error.value = 'Impossible d’ouvrir la vidéo. Réessayez depuis ce marque-page.' }
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
          Lecture & marque-pages
        </p><h1 class="sg-title">
          ReplayGlows
        </h1>
      </div>
      <button
        ref="helpButton"
        class="sg-button sg-button--secondary sg-help-entry"
        type="button"
        @click="playback?.closeReview(); guide?.show()"
      >
        Découvrir / Aide
      </button>
    </div>
    <div class="sg-bookmark-scroll">
      <DiscoveryGuide
        ref="guide"
        :view="playbackView"
        @practice="practice"
        @hidden="helpButton?.focus()"
      />
      <div
        ref="bookmarkSection"
        tabindex="-1"
        aria-label="Marque-pages YouTube"
      >
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
      </div>
      <button
        class="sg-button sg-button--primary"
        type="button"
        @click="openOptions"
      >
        Options et import/export
      </button>
    </div>
    <PlaybackCard
      ref="playback"
      :bookmarks="bookmarks"
      @view="playbackView = $event"
    />
    <footer class="sg-popup-footer">
      <span
        class="sg-status-dot"
        aria-hidden="true"
      /><span>Vos marque-pages restent dans votre navigateur.</span>
    </footer>
  </main>
</template>
