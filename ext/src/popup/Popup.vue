<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { type Bookmark, normalizeBookmarks } from '../bookmarks'
import PlaybackCard from '../playback/PlaybackCard.vue'
import DiscoveryGuide from '../discovery/DiscoveryGuide.vue'
import { recordAchievement, type Milestone } from '../discovery/state'
import type { PlaybackView } from '../playback/protocol'
import { useI18n } from '../i18n'
const { t, locale } = useI18n()
const guide = ref<InstanceType<typeof DiscoveryGuide>>()
const playback = ref<InstanceType<typeof PlaybackCard>>()
const playbackView = ref<PlaybackView | null>(null)
const guideVisible = ref(false)
const bookmarkSection = ref<HTMLElement>()
const helpButton = ref<HTMLButtonElement>()
const storageInfoVisible = ref(false)
const storageInfoId = 'storage-info'
let storageInfoCloseTimer: ReturnType<typeof setTimeout> | undefined
const storageInfoUrl = () => `https://replayglows.com${locale.value === 'fr' ? '/fr' : ''}/extension#bookmark-storage`
const keepStorageInfoOpen = () => {
  clearTimeout(storageInfoCloseTimer)
  storageInfoVisible.value = true
}
const scheduleStorageInfoClose = () => {
  clearTimeout(storageInfoCloseTimer)
  storageInfoCloseTimer = setTimeout(() => { storageInfoVisible.value = false }, 180)
}
const closeStorageInfo = (event: FocusEvent) => {
  if (!((event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))) scheduleStorageInfoClose()
}
const practice = async (topic: Milestone) => {
  if (topic === 'note' || topic === 'opened') {
    guideVisible.value = false
    await nextTick()
    bookmarkSection.value?.scrollIntoView({ block: 'start' })
    bookmarkSection.value?.focus()
  } else playback.value?.focusControls(topic === 'loop')
}
const bookmarks = ref<Bookmark[]>([])
const groups = computed(() => {
  const videos = new Map<string, { url: string; title: string; thumbnail: string; notes: Bookmark[] }>()
  for (const bookmark of bookmarks.value) {
    let video = videos.get(bookmark.url)
    if (!video) {
      video = { url: bookmark.url, title: bookmark.title || '', thumbnail: `https://img.youtube.com/vi/${new URL(bookmark.url).searchParams.get('v')}/mqdefault.jpg`, notes: [] }
      videos.set(bookmark.url, video)
    }
    if (!video.title && bookmark.title) video.title = bookmark.title
    video.notes.push(bookmark)
  }
  return [...videos.values()]
})
const failedThumbnails = ref(new Set<string>())
const startEditing = async (bookmark: Bookmark) => {
  editing.value = bookmark
  note.value = bookmark.note
  await nextTick()
  bookmarkSection.value?.querySelector<HTMLInputElement>('.sg-inline-note')?.focus()
}
const error = ref('')
const editing = ref<Bookmark | null>(null)
const note = ref('')
const openApp = () => void chrome.tabs.create({ url: chrome.runtime.getURL('src/app/index.html') })
const load = async () => {
  try {
    const result = await chrome.storage.local.get('bookmarks')
    bookmarks.value = normalizeBookmarks(result.bookmarks ?? []).sort((a, b) => a.url.localeCompare(b.url) || a.time - b.time)
    if (bookmarks.value.some(item => item.note?.trim())) {
      try { await recordAchievement('note') } catch { error.value = t('notesProgressError') }
    }
  } catch { error.value = t('loadBookmarksError') }
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
  } catch (e) { error.value = e instanceof Error ? e.message : t('saveError') }
}
const visit = async (bookmark: Bookmark) => {
  try {
    await chrome.tabs.create({ url: `${bookmark.url}&t=${bookmark.time}s` })
    try { await recordAchievement('opened') } catch { error.value = t('openedProgressError') }
  } catch { error.value = t('openVideoError') }
}
</script>

<template>
  <main class="sg-popup">
    <header class="sg-brand-row">
      <div class="sg-brand-info">
        <div class="sg-brand-mark" aria-hidden="true">R</div>
        <div class="sg-brand-copy">
          <h1 class="sg-title">ReplayGlows</h1>
          <div class="sg-storage-indicator" @mouseenter="keepStorageInfoOpen" @mouseleave="scheduleStorageInfoClose" @focusin="keepStorageInfoOpen" @focusout="closeStorageInfo">
            <button class="sg-local-indicator" type="button" :aria-controls="storageInfoId" :aria-expanded="storageInfoVisible" @click="storageInfoVisible ? scheduleStorageInfoClose() : keepStorageInfoOpen()">
              <span class="sg-status-dot" aria-hidden="true" />{{ t('localLabel') }}
            </button>
            <div :id="storageInfoId" v-show="storageInfoVisible" class="sg-storage-popover" @mouseenter="keepStorageInfoOpen" @mouseleave="scheduleStorageInfoClose">
              <p>{{ t('localInfo') }}</p>
              <a :href="storageInfoUrl()" target="_blank" rel="noopener noreferrer">{{ t('localLearnMore') }}</a>
            </div>
          </div>
        </div>
      </div>
      <div class="sg-popup-actions">
        <button class="sg-button sg-button--secondary" type="button" @click="openApp">
          {{ t('openApp') }}
        </button>
        <button
          ref="helpButton"
          class="sg-button sg-button--secondary sg-help-entry"
          type="button"
          aria-controls="discovery-guide"
          :aria-expanded="guideVisible"
          @click="playback?.closeReview(); guideVisible ? guide?.hide() : guide?.show()"
        >
          {{ t('discoverHelp') }}
        </button>
      </div>
    </header>
    <div class="sg-bookmark-scroll">
      <div id="discovery-guide" v-show="guideVisible">
        <DiscoveryGuide
          ref="guide"
          :view="playbackView"
          @visibility="guideVisible = $event"
          @practice="practice"
          @hidden="helpButton?.focus()"
        />
      </div>
      <div
        v-if="!guideVisible"
        ref="bookmarkSection"
        tabindex="-1"
        :aria-label="t('youtubeBookmarks')"
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
            {{ t('readyTitle') }}
          </h2>
          <p class="sg-muted">
            {{ t('readyBody') }}
          </p>
        </section>
        <section
          v-else
          :aria-label="t('yourBookmarks')"
        >
          <details v-for="group in groups" :key="group.url" class="sg-video-group">
            <summary class="sg-video-summary">
              <a class="sg-video-thumbnail" :href="group.url" target="_blank" rel="noopener noreferrer" :aria-label="group.title || t('youtubeVideo')" @click.stop>
                <img v-if="!failedThumbnails.has(group.url)" :src="group.thumbnail" alt="" loading="lazy" @error="failedThumbnails.add(group.url)">
                <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7Z" /></svg>
              </a>
              <span class="sg-video-heading">
                <span class="sg-video-title">{{ group.title || t('youtubeVideo') }}</span>
                <span class="sg-muted">{{ t('yourBookmarks') }} · {{ group.notes.length }}</span>
              </span>
              <svg class="sg-video-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <ul class="sg-note-list">
              <li v-for="bookmark in group.notes" :key="`${bookmark.url}:${bookmark.time}`" class="sg-note-row">
                <button type="button" class="sg-note-time" :aria-label="`${group.title || t('youtubeVideo')} · ${bookmark.formattedTime}`" @click="visit(bookmark)">
                  {{ bookmark.formattedTime }}
                </button>
                <template v-if="editing === bookmark">
                  <form class="sg-note-editor" @submit.prevent="mutate('updateBookmark', { ...bookmark, note })">
                    <input v-model="note" class="inp sg-inline-note" :aria-label="t('editNote')" @keyup.esc="editing = null">
                    <button class="sg-button sg-button--primary" type="submit">{{ t('save') }}</button>
                    <button class="sg-button" type="button" @click="editing = null">{{ t('cancel') }}</button>
                  </form>
                </template>
                <template v-else>
                  <p class="sg-note-text">{{ bookmark.note || t('noNote') }}</p>
                  <button class="sg-playback-icon-button" type="button" :aria-label="`${t('editNote')} · ${bookmark.formattedTime}`" :title="t('editNote')" @click="startEditing(bookmark)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15Z" /></svg>
                  </button>
                  <button class="sg-playback-icon-button sg-note-delete" type="button" :aria-label="`${t('delete')} · ${bookmark.formattedTime}`" :title="t('delete')" @click="mutate('deleteBookmark', bookmark)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" /></svg>
                  </button>
                </template>
              </li>
            </ul>
          </details>
        </section>
      </div>
    </div>
    <PlaybackCard
      ref="playback"
      :bookmarks="bookmarks"
      @view="playbackView = $event"
    />
  </main>
</template>
