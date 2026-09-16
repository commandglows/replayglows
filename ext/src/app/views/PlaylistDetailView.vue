<script setup lang="ts">
// Playlist detail screen mirroring the Flutter playlist_detail screen: header
// stats, play all, per-item watched/hidden/remove actions and a reorder mode
// persisted through videoOrder:updateOrder.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppI18n } from '@/app/i18n'
import { hiddenApi, playlistApi, videoOrderApi, videosApi, watchedApi } from '@/app/convex/api'
import type { YouTubePlaylist, YouTubeVideo } from '@/app/convex/types'

const route = useRoute()
const router = useRouter()
const { t } = useAppI18n()

const playlistId = route.params.id as string

const loading = ref(true)
const failed = ref(false)
const notFound = ref(false)
const videosFailed = ref(false)
const playlist = ref<YouTubePlaylist | null>(null)
const videos = ref<YouTubeVideo[]>([])
const watched = ref<Set<string>>(new Set())
const busyIds = ref<Set<string>>(new Set())
const busy = ref(false)

const reorderMode = ref(false)
const reorderList = ref<YouTubeVideo[]>([])

const notice = ref<{ text: string; ok: boolean } | null>(null)
let noticeTimer: number | undefined

function notify(text: string, ok = true) {
  notice.value = { text, ok }
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = null
  }, 2800)
}

const videoWithItem = (video: YouTubeVideo): YouTubeVideo & { playlistItemId?: string } =>
  video as YouTubeVideo & { playlistItemId?: string }

function isWatched(video: YouTubeVideo): boolean {
  return watched.value.has(video.youtubeVideoId)
}

async function load() {
  loading.value = true
  failed.value = false
  notFound.value = false
  videosFailed.value = false
  try {
    const [rawPlaylists, rawVideos, rawWatched] = await Promise.all([
      videosApi.getPlaylists().catch(() => null),
      videosApi.getPlaylistVideos(playlistId).catch(() => null),
      watchedApi.list().catch(() => null),
    ])
    if (rawPlaylists === null) {
      failed.value = true
      return
    }
    const plists = Array.isArray(rawPlaylists) ? rawPlaylists : []
    playlist.value = plists.find((p) => p.youtubePlaylistId === playlistId) ?? null
    notFound.value = playlist.value === null
    videosFailed.value = rawVideos === null
    videos.value = Array.isArray(rawVideos) ? rawVideos : []
    watched.value = new Set<string>()
    if (Array.isArray(rawWatched)) {
      for (const item of rawWatched) {
        watched.value.add(item.youtubeVideoId)
      }
    }
    for (const video of videos.value) {
      if (video.watched === true) {
        watched.value.add(video.youtubeVideoId)
      }
    }
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

function retry() {
  void load()
}

function playTarget(video: YouTubeVideo): { name: 'play'; query: { v: string } } {
  return { name: 'play', query: { v: video.youtubeVideoId } }
}

function playAll() {
  if (videos.value.length === 0) {
    return
  }
  void router.push({ name: 'play', query: { v: videos.value[0].youtubeVideoId } })
}

const totalDurationSeconds = computed(() =>
  videos.value.reduce((sum, video) => sum + videoDurationSeconds(video), 0),
)

function videoDurationSeconds(video: YouTubeVideo): number {
  if (typeof video.durationSeconds === 'number' && Number.isFinite(video.durationSeconds) && video.durationSeconds > 0) {
    return video.durationSeconds
  }
  return 0
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return ''
  }
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}

function thumbnailUrlFor(video: YouTubeVideo): string {
  return video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeVideoId}/hqdefault.jpg`
}

async function toggleWatched(video: YouTubeVideo) {
  const id = video.youtubeVideoId
  if (busyIds.value.has(id)) {
    return
  }
  const previous = watched.value.has(id)
  const next = new Set(watched.value)
  if (previous) {
    next.delete(id)
  } else {
    next.add(id)
  }
  watched.value = next
  busyIds.value.add(id)
  try {
    if (previous) {
      await watchedApi.unmark(id)
    } else {
      await watchedApi.mark(id)
    }
    notify(t('lists.watchedUpdated'))
  } catch {
    const revert = new Set(watched.value)
    if (previous) {
      revert.add(id)
    } else {
      revert.delete(id)
    }
    watched.value = revert
    notify(t('lists.watchedUpdateFailed'), false)
  } finally {
    busyIds.value.delete(id)
  }
}

async function hideVideo(video: YouTubeVideo) {
  const id = video.youtubeVideoId
  if (busyIds.value.has(id)) {
    return
  }
  busyIds.value.add(id)
  try {
    await hiddenApi.hide(id, 'video')
    videos.value = videos.value.filter((v) => v.youtubeVideoId !== id)
    notify(t('lists.videoHidden'))
  } catch {
    notify(t('lists.hideFailed'), false)
  } finally {
    busyIds.value.delete(id)
  }
}

async function removeVideo(video: YouTubeVideo) {
  const id = video.youtubeVideoId
  if (busyIds.value.has(id)) {
    return
  }
  if (!window.confirm(t('lists.removeVideoConfirm'))) {
    return
  }
  busyIds.value.add(id)
  try {
    const playlistItemId = videoWithItem(video).playlistItemId
    if (playlistItemId && playlistItemId.length > 0) {
      await videosApi.removeVideoFromPlaylist(playlistId, playlistItemId)
    } else {
      await playlistApi.removeVideo(playlistId, id)
    }
    videos.value = videos.value.filter((v) => v.youtubeVideoId !== id)
    notify(t('lists.videoRemoved'))
  } catch {
    notify(t('lists.removeFailed'), false)
  } finally {
    busyIds.value.delete(id)
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(`https://www.youtube.com/playlist?list=${playlistId}`)
    notify(t('lists.playlistLinkCopied'))
  } catch {
    notify(t('lists.playlistUpdateFailed'), false)
  }
}

function startReorder() {
  reorderList.value = videos.value.slice()
  reorderMode.value = true
}

function cancelReorder() {
  reorderMode.value = false
  reorderList.value = []
}

function moveInReorder(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= reorderList.value.length) {
    return
  }
  const list = reorderList.value.slice()
  const item = list[index]
  list[index] = list[target]
  list[target] = item
  reorderList.value = list
}

async function saveReorder() {
  if (busy.value) {
    return
  }
  busy.value = true
  try {
    await videoOrderApi.update({
      playlistId,
      orderedIds: reorderList.value.map((video) => video.youtubeVideoId),
    })
    videos.value = reorderList.value
    reorderMode.value = false
    reorderList.value = []
    notify(t('lists.orderSaved'))
  } catch {
    notify(t('lists.orderSaveFailed'), false)
  } finally {
    busy.value = false
  }
}

const orderedVideos = computed(() => (reorderMode.value ? reorderList.value : videos.value))
</script>

<template>
  <div class="pdv">
    <router-link
      class="pdv__back"
      :to="{ name: 'playlists' }"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
      </svg>
      <span>{{ t('lists.backToPlaylists') }}</span>
    </router-link>

    <div
      v-if="loading"
      class="pdv__state"
    >
      <p class="pdv__state-title">
        {{ t('common.loading') }}
      </p>
    </div>

    <div
      v-else-if="failed"
      class="pdv__state"
    >
      <p class="pdv__state-title pdv__state-title--error">
        {{ t('lists.loadPlaylistsError') }}
      </p>
      <button
        type="button"
        class="pdv__btn"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <div
      v-else-if="notFound"
      class="pdv__state"
    >
      <p class="pdv__state-title">
        {{ t('lists.playlistNotFound') }}
      </p>
      <p class="pdv__state-desc">
        {{ t('lists.playlistUnavailable') }}
      </p>
      <router-link
        class="pdv__btn"
        :to="{ name: 'playlists' }"
      >
        {{ t('lists.backToPlaylists') }}
      </router-link>
    </div>

    <div
      v-else
      class="pdv__content"
    >
      <div
        v-if="notice"
        class="pdv__notice"
        :class="{ 'pdv__notice--error': !notice.ok }"
        role="status"
      >
        {{ notice.text }}
      </div>

      <header class="pdv__header">
        <div class="pdv__header-main">
          <span
            class="pdv__tile"
            :style="{ background: playlist?.color || '#7b61ff' }"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
            >
              <path d="M4 5h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm0 4h10v2H4z" />
            </svg>
          </span>
          <div class="pdv__header-body">
            <h1 class="pdv__title">
              {{ playlist?.title }}
            </h1>
            <p
              v-if="playlist?.description"
              class="pdv__desc"
            >
              {{ playlist.description }}
            </p>
            <p class="pdv__stats">
              <span>{{ t('lists.videoCountStats', { count: videos.length }) }}</span>
              <span
                v-if="totalDurationSeconds > 0"
                class="pdv__stats-dot"
              >·</span>
              <span v-if="totalDurationSeconds > 0">
                {{ t('lists.durationTotal', { duration: formatDuration(totalDurationSeconds) }) }}
              </span>
            </p>
          </div>
        </div>
        <div class="pdv__header-actions">
          <button
            type="button"
            class="pdv__btn pdv__btn--primary"
            :disabled="videos.length === 0"
            @click="playAll"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>{{ t('lists.playAll') }}</span>
          </button>
          <button
            type="button"
            class="pdv__btn"
            @click="copyLink"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10 19h6a3 3 0 0 0 0-6h-2v2h2a1 1 0 0 1 0 2h-6a1 1 0 0 1 0-2H8a3 3 0 0 0 0 2zm4-14H8a3 3 0 0 0 0 6h2V9H8a1 1 0 0 1 0-2h6a1 1 0 0 1 .7 1.7l1.4-1.4A3 3 0 0 0 14 5z" />
            </svg>
            <span>{{ t('lists.copyPlaylistLink') }}</span>
          </button>
        </div>
      </header>

      <div class="pdv__toolbar">
        <button
          v-if="!reorderMode"
          type="button"
          class="pdv__btn pdv__btn--ghost"
          @click="startReorder"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h12v2H3z" />
          </svg>
          <span>{{ t('lists.reorder') }}</span>
        </button>
        <template v-else>
          <button
            type="button"
            class="pdv__btn pdv__btn--primary"
            :disabled="busy"
            @click="saveReorder"
          >
            {{ busy ? t('common.processing') : t('lists.reorderDone') }}
          </button>
          <button
            type="button"
            class="pdv__btn pdv__btn--ghost"
            @click="cancelReorder"
          >
            {{ t('common.cancel') }}
          </button>
        </template>
      </div>

      <div
        v-if="videosFailed"
        class="pdv__state"
      >
        <p class="pdv__state-title pdv__state-title--error">
          {{ t('lists.loadPlaylistsError') }}
        </p>
        <button
          type="button"
          class="pdv__btn"
          @click="retry"
        >
          {{ t('common.retry') }}
        </button>
      </div>

      <div
        v-else-if="orderedVideos.length === 0"
        class="pdv__state"
      >
        <p class="pdv__state-title">
          {{ t('lists.emptyPlaylist') }}
        </p>
        <p class="pdv__state-desc">
          {{ t('lists.emptyPlaylistDescription') }}
        </p>
      </div>

      <ul
        v-else
        class="pdv__videos"
      >
        <li
          v-for="(video, index) in orderedVideos"
          :key="video.youtubeVideoId"
          class="pdv__video"
          :class="{ 'pdv__video--reorder': reorderMode }"
        >
          <div
            v-if="reorderMode"
            class="pdv__grip"
          >
            <button
              type="button"
              class="pdv__icon-btn"
              :disabled="index === 0"
              :aria-label="t('lists.reorder')"
              @click="moveInReorder(index, -1)"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M11 7.4V4h2v3.4l2.5-2.5 1.4 1.4L12 11 7.1 6.3l1.4-1.4zM13 16.6V20h-2v-3.4l-2.5 2.5-1.4-1.4L12 13l4.9 4.7-1.4 1.4z" />
              </svg>
            </button>
            <button
              type="button"
              class="pdv__icon-btn"
              :disabled="index === orderedVideos.length - 1"
              :aria-label="t('lists.reorder')"
              @click="moveInReorder(index, 1)"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M11 7.4V4h2v3.4l2.5-2.5 1.4 1.4L12 11 7.1 6.3l1.4-1.4zM13 16.6V20h-2v-3.4l-2.5 2.5-1.4-1.4L12 13l4.9 4.7-1.4 1.4z" />
              </svg>
            </button>
          </div>
          <router-link
            class="pdv__video-thumb"
            :to="!reorderMode ? playTarget(video) : {}"
          >
            <img
              :src="thumbnailUrlFor(video)"
              :alt="video.title"
              loading="lazy"
            >
            <span
              v-if="videoDurationSeconds(video) > 0"
              class="pdv__video-duration"
            >
              {{ formatDuration(videoDurationSeconds(video)) }}
            </span>
          </router-link>
          <div class="pdv__video-body">
            <h3 class="pdv__video-title">
              {{ video.title }}
            </h3>
            <p class="pdv__video-channel">
              {{ video.channelTitle || '' }}
            </p>
          </div>
          <div
            v-if="!reorderMode"
            class="pdv__video-actions"
          >
            <router-link
              class="pdv__action"
              :to="playTarget(video)"
              :title="t('lists.play')"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </router-link>
            <button
              type="button"
              class="pdv__action"
              :class="{ 'pdv__action--active': isWatched(video) }"
              :title="isWatched(video) ? t('lists.markUnwatched') : t('lists.markWatched')"
              :aria-pressed="isWatched(video)"
              @click="toggleWatched(video)"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
              </svg>
            </button>
            <button
              type="button"
              class="pdv__action"
              :title="t('lists.hideVideo')"
              @click="hideVideo(video)"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 4C8.5 4 5.6 6 4.2 8.5L12 12l-7.8 3.5C5.6 18 8.5 20 12 20s6.4-2 7.8-4.5L12 12l7.8-3.5C18.4 6 15.5 4 12 4z" />
              </svg>
            </button>
            <button
              type="button"
              class="pdv__action"
              :title="t('lists.removeVideoTitle')"
              @click="removeVideo(video)"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7 5V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1h4v2h-2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7H4V5zm2 0h6V4H9zm-1 2v12h8V7z" />
              </svg>
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.pdv {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.pdv__back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.35rem;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  text-decoration: none;
}

.pdv__back:hover {
  color: var(--rg-color-foreground, #f7f7f2);
}

.pdv__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  text-align: center;
  padding: var(--rg-space-5, 2rem) 0;
}

.pdv__state-title {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.pdv__state-title--error {
  color: var(--rg-color-danger, #f87171);
}

.pdv__state-desc {
  margin: 0;
  max-width: 24rem;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.pdv__content {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.pdv__notice {
  padding: 0.5rem 0.7rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: color-mix(in oklab, var(--rg-color-success, #4ade80) 14%, transparent);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
}

.pdv__notice--error {
  background: color-mix(in oklab, var(--rg-color-danger, #f87171) 14%, transparent);
  color: var(--rg-color-danger, #f87171);
}

.pdv__header {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-3, 1rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
}

.pdv__header-main {
  display: flex;
  align-items: center;
  gap: var(--rg-space-3, 1rem);
}

.pdv__tile {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: var(--rg-radius-md, 0.625rem);
  color: #ffffff;
}

.pdv__header-body {
  flex: 1;
  min-width: 0;
}

.pdv__title {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.125rem;
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.pdv__desc {
  margin: 0.2rem 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.pdv__stats {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.3rem 0 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.pdv__header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rg-space-2, 0.75rem);
}

.pdv__toolbar {
  display: flex;
  gap: var(--rg-space-2, 0.75rem);
}

.pdv__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface-raised, #2d2d31);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  text-decoration: none;
  cursor: pointer;
}

.pdv__btn:hover:not(:disabled) {
  background: var(--rg-color-primary, #f59e0b);
  color: var(--rg-color-primary-foreground, #1f2937);
}

.pdv__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pdv__btn--primary {
  border-color: transparent;
  background: var(--rg-color-primary, #f59e0b);
  color: var(--rg-color-primary-foreground, #1f2937);
  font-weight: var(--rg-text-weight-strong, 700);
}

.pdv__btn--ghost {
  background: transparent;
}

.pdv__videos {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.pdv__video {
  display: flex;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-1, 0.5rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
}

.pdv__video--reorder {
  border-color: var(--rg-color-primary, #f59e0b);
}

.pdv__grip {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.pdv__icon-btn {
  padding: 0.2rem;
  border: none;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: transparent;
  color: var(--rg-color-muted, #a1a1a1);
  cursor: pointer;
}

.pdv__icon-btn:hover:not(:disabled) {
  color: var(--rg-color-foreground, #f7f7f2);
  background: var(--rg-color-surface-raised, #2d2d31);
}

.pdv__icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.pdv__video-thumb {
  position: relative;
  flex-shrink: 0;
  width: 8rem;
  aspect-ratio: 16 / 9;
  border-radius: var(--rg-radius-md, 0.625rem);
  overflow: hidden;
  display: block;
  background: var(--rg-color-background, #141414);
}

.pdv__video-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pdv__video-duration {
  position: absolute;
  right: 0.3rem;
  bottom: 0.3rem;
  padding: 0.05rem 0.35rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: rgba(0, 0, 0, 0.75);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
}

.pdv__video-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.pdv__video-title {
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.8125rem;
  font-weight: var(--rg-text-weight-strong, 700);
}

.pdv__video-channel {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.pdv__video-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.25rem;
}

.pdv__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: transparent;
  color: var(--rg-color-muted, #a1a1a1);
  text-decoration: none;
  cursor: pointer;
}

.pdv__action:hover {
  color: var(--rg-color-foreground, #f7f7f2);
  background: var(--rg-color-surface-raised, #2d2d31);
}

.pdv__action--active {
  color: var(--rg-color-success, #4ade80);
}
</style>