<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
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
          <p class="sg-eyebrow">{{ t('playbackBookmarks') }}</p>
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
          <h2 class="sg-section-title">
            {{ t('yourBookmarks') }} ({{ bookmarks.length }})
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
              {{ bookmark.title || t('youtubeVideo') }} · {{ bookmark.formattedTime }}
            </button>
            <input
              v-if="editing === bookmark"
              v-model="note"
              class="inp sg-inline-note"
              :aria-label="t('editNote')"
              @keyup.enter="mutate('updateBookmark', { ...bookmark, note })"
              @keyup.esc="editing = null"
            >
            <p
              v-else
              class="sg-muted"
            >
                {{ bookmark.note || t('noNote') }}
            </p>
            <template v-if="editing === bookmark">
              <button
                class="sg-button sg-button--primary"
                type="button"
                @click="mutate('updateBookmark', { ...bookmark, note })"
              >
                {{ t('save') }}
              </button>
              <button
                class="sg-button"
                type="button"
                @click="editing = null"
              >
                {{ t('cancel') }}
              </button>
            </template>
            <template v-else>
              <button
                class="sg-button"
                type="button"
                @click="editing = bookmark; note = bookmark.note"
              >
                {{ t('edit') }}
              </button>
              <button
                class="sg-button"
                type="button"
                @click="mutate('deleteBookmark', bookmark)"
              >
                {{ t('delete') }}
              </button>
            </template>
          </article>
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
