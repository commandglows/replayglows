<script setup lang="ts">
// Feed detail screen mirroring the Flutter virtual_feed_detail screen: header,
// sources (toggle/reorder/remove), a multi-mode add-source picker, sort
// control, paginated video list, cache refresh and feed deletion.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppI18n } from '@/app/i18n'
import { feedsApi, hiddenApi, videosApi, watchedApi } from '@/app/convex/api'
import type {
  FeedDetails,
  FeedSource,
  PlaylistChannelCandidate,
  VirtualFeed,
  YouTubeChannel,
  YouTubePlaylist,
  YouTubeVideo,
} from '@/app/convex/types'

const route = useRoute()
const router = useRouter()
const { t } = useAppI18n()

const feedId = route.params.id as string

type SortValue = 'newest' | 'oldest' | 'sourceOrder'
type PickerMode = 'channels' | 'playlist' | 'playlistChannels' | null

interface CandidatesResult {
  playlist: { youtubePlaylistId: string; title: string; videoCount: number } | null
  candidates: PlaylistChannelCandidate[]
  missingMetadataCount: number
  totalVideoCount: number
}

const loading = ref(true)
const failed = ref(false)
const feed = ref<VirtualFeed | null>(null)
const videos = ref<YouTubeVideo[]>([])
const sources = ref<FeedSource[]>([])
const stats = ref<FeedDetails['stats']>(undefined)
const sortOrder = ref<SortValue>('newest')
const isDone = ref(true)
const continueCursor = ref<string | null>(null)
const loadMoreBusy = ref(false)
const loadMoreFailed = ref(false)

const watched = ref<Set<string>>(new Set())
const busyIds = ref<Set<string>>(new Set())
const busySourceId = ref<string | null>(null)
const reorderingSources = ref(false)
const savingOrder = ref(false)
const refreshing = ref(false)
const deleting = ref(false)

const pickerOpen = ref(false)
const pickerMode = ref<PickerMode>(null)
const pickerBusy = ref(false)
const pickerFailed = ref(false)
const channels = ref<YouTubeChannel[]>([])
const pickerPlaylists = ref<YouTubePlaylist[]>([])
const searchQuery = ref('')
const selectedChannels = ref<Set<string>>(new Set())
const selectedPlaylistId = ref<string | null>(null)
const candidates = ref<CandidatesResult | null>(null)
const selectedCandidates = ref<Set<string>>(new Set())

const notice = ref<{ text: string; ok: boolean } | null>(null)
let noticeTimer: number | undefined

function notify(text: string, ok = true) {
  notice.value = { text, ok }
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = null
  }, 2800)
}

function isSortValue(value: string): value is SortValue {
  return value === 'newest' || value === 'oldest' || value === 'sourceOrder'
}

async function load(reset = true) {
  if (reset) {
    loading.value = true
    failed.value = false
    loadMoreFailed.value = false
  }
  try {
    const details = await feedsApi.details({
      virtualFeedId: feedId,
      includeHidden: false,
      includeWatched: feed.value ? feed.value.includeWatched : true,
      sortOrder: sortOrder.value,
      cursor: reset ? null : continueCursor.value,
      pageSize: 60,
    })
    feed.value = details.feed ?? null
    sources.value = details.sources ?? []
    stats.value = details.stats
    if (isSortValue(details.sortOrder)) {
      sortOrder.value = details.sortOrder
    }
    if (reset) {
      videos.value = details.videos ?? []
      watched.value = new Set<string>()
    } else {
      videos.value = [...videos.value, ...(details.videos ?? [])]
    }
    for (const video of details.videos ?? []) {
      if (video.watched === true) {
        watched.value.add(video.youtubeVideoId)
      }
    }
    isDone.value = details.isDone !== false
    continueCursor.value = details.continueCursor ?? null
    if (reset) {
      failed.value = details.feed == null
    }
  } catch {
    if (reset) {
      failed.value = true
    } else {
      loadMoreFailed.value = true
    }
  } finally {
    if (reset) {
      loading.value = false
    }
    loadMoreBusy.value = false
  }
}

onMounted(() => {
  void load(true)
})

async function loadMore() {
  if (loadMoreBusy.value || isDone.value) {
    return
  }
  loadMoreBusy.value = true
  loadMoreFailed.value = false
  await load(false)
}

function retryLoadMore() {
  void loadMore()
}

function playTarget(video: YouTubeVideo): { name: 'play'; query: { v: string } } {
  return { name: 'play', query: { v: video.youtubeVideoId } }
}

function playAllFeed() {
  if (videos.value.length === 0) {
    return
  }
  void router.push({ name: 'play', query: { v: videos.value[0].youtubeVideoId } })
}

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

function isWatched(video: YouTubeVideo): boolean {
  return watched.value.has(video.youtubeVideoId)
}

async function toggleWatched(video: YouTubeVideo) {
  const id = video.youtubeVideoId
  if (busyIds.value.has(id) || !feed.value) {
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
    if (!feed.value.includeWatched && next.has(id)) {
      videos.value = videos.value.filter((v) => v.youtubeVideoId !== id)
    }
  } catch {
    const revert = new Set(watched.value)
    if (previous) {
      revert.add(id)
    } else {
      revert.delete(id)
    }
    watched.value = revert
    notify(t('lists.watchedUpdateFailed'), false)
    return
  } finally {
    busyIds.value.delete(id)
  }
  notify(t('lists.watchedUpdated'))
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

const sourceCountLabel = computed(() => {
  const count = stats.value?.sourceCount ?? sources.value.length
  return `${count} ${count > 1 ? t('lists.sourceCountPlural') : t('lists.sourceCountSingular')}`
})

const hasStaleSources = computed(() => (stats.value?.staleSourceCount ?? 0) > 0)

async function applySort(next: SortValue) {
  if (next === sortOrder.value || !feed.value) {
    return
  }
  const previous = sortOrder.value
  sortOrder.value = next
  try {
    await feedsApi.update({
      virtualFeedId: feedId,
      includeWatched: feed.value.includeWatched,
      sortOrder: next,
    })
    await load(true)
    notify(t('lists.sortUpdated'))
  } catch {
    sortOrder.value = previous
    notify(t('lists.sortUpdateFailed'), false)
  }
}

async function toggleSource(source: FeedSource) {
  if (!source._id || busySourceId.value === source._id) {
    return
  }
  const previous = source.isActive
  source.isActive = !previous
  busySourceId.value = source._id
  try {
    await feedsApi.toggleSource(source._id, source.isActive)
    notify(source.isActive ? t('lists.sourceToggledOn') : t('lists.sourceToggledOff'))
    await load(true)
  } catch {
    source.isActive = previous
    notify(t('lists.sourceToggleFailed'), false)
  } finally {
    busySourceId.value = null
  }
}

async function removeSource(source: FeedSource) {
  if (!source._id || busySourceId.value === source._id) {
    return
  }
  if (!window.confirm(t('lists.removeSourceConfirm'))) {
    return
  }
  busySourceId.value = source._id
  try {
    await feedsApi.removeSource(source._id)
    notify(t('lists.sourceRemoved'))
    await load(true)
  } catch {
    notify(t('lists.sourceRemoveFailed'), false)
  } finally {
    busySourceId.value = null
  }
}

function startSourceReorder() {
  reorderingSources.value = true
}

function moveSource(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= sources.value.length) {
    return
  }
  const list = sources.value.slice()
  const item = list[index]
  list[index] = list[target]
  list[target] = item
  sources.value = list
}

async function saveSourceOrder() {
  if (savingOrder.value) {
    return
  }
  savingOrder.value = true
  try {
    await feedsApi.reorderSources(
      feedId,
      sources.value.map((source) => source._id),
    )
    reorderingSources.value = false
    notify(t('lists.sourceReordered'))
    await load(true)
  } catch {
    notify(t('lists.sourceOrderFailed'), false)
    reorderingSources.value = false
    await load(true)
  } finally {
    savingOrder.value = false
  }
}

function cancelSourceReorder() {
  reorderingSources.value = false
  void load(true)
}

async function refreshCache() {
  if (refreshing.value) {
    return
  }
  refreshing.value = true
  try {
    await videosApi.startQuotaSafeSync()
    notify(t('lists.refreshDone'))
  } catch {
    notify(t('lists.refreshFailed'), false)
  } finally {
    refreshing.value = false
  }
}

async function deleteFeed() {
  if (deleting.value) {
    return
  }
  if (!window.confirm(t('lists.deleteFeedConfirmBody'))) {
    return
  }
  deleting.value = true
  try {
    await feedsApi.remove(feedId)
    notify(t('lists.feedDeleted'))
    await router.push({ name: 'playlists' })
  } catch {
    notify(t('lists.deleteFeedFailed'), false)
  } finally {
    deleting.value = false
  }
}

const sourceIds = computed(() => new Set(sources.value.map((source) => source.sourceId)))
const sourceTypeLabel = (source: FeedSource): string => {
  switch (source.sourceType) {
    case 'subscriptions':
      return t('lists.sourceTypeSubscriptions')
    case 'playlist':
      return t('lists.sourceTypePlaylist')
    default:
      return t('lists.sourceTypeChannel')
  }
}

function openPicker(mode: Exclude<PickerMode, null>) {
  pickerOpen.value = true
  pickerMode.value = mode
  pickerFailed.value = false
  pickerBusy.value = true
  searchQuery.value = ''
  selectedChannels.value = new Set()
  selectedPlaylistId.value = null
  candidates.value = null
  selectedCandidates.value = new Set()
  if (mode === 'channels') {
    void loadChannels()
  } else {
    void loadPickerPlaylists()
  }
}

async function loadChannels() {
  pickerFailed.value = false
  pickerBusy.value = true
  try {
    const raw = await videosApi.getChannels()
    channels.value = Array.isArray(raw) ? raw : []
  } catch {
    pickerFailed.value = true
  } finally {
    pickerBusy.value = false
  }
}

async function loadPickerPlaylists() {
  pickerFailed.value = false
  pickerBusy.value = true
  try {
    const raw = await videosApi.getPlaylists()
    const list = Array.isArray(raw) ? raw : []
    pickerPlaylists.value = list.filter((p) => (p as { source?: string }).source !== 'subscriptions')
  } catch {
    pickerFailed.value = true
  } finally {
    pickerBusy.value = false
  }
}

function closePicker() {
  pickerOpen.value = false
  pickerMode.value = null
  pickerBusy.value = false
  pickerFailed.value = false
  channels.value = []
  pickerPlaylists.value = []
  searchQuery.value = ''
  selectedChannels.value = new Set()
  selectedPlaylistId.value = null
  candidates.value = null
  selectedCandidates.value = new Set()
}

const visibleChannels = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return channels.value.filter((channel) => query === '' || channel.title.toLowerCase().includes(query))
})

function toggleChannelSelection(youtubeChannelId: string) {
  const next = new Set(selectedChannels.value)
  if (next.has(youtubeChannelId)) {
    next.delete(youtubeChannelId)
  } else {
    next.add(youtubeChannelId)
  }
  selectedChannels.value = next
}

async function addSelectedChannels() {
  const selected = channels.value.filter((channel) => selectedChannels.value.has(channel.youtubeChannelId))
  if (selected.length === 0 || pickerBusy.value) {
    return
  }
  pickerBusy.value = true
  try {
    const result = await feedsApi.addSources({
      virtualFeedId: feedId,
      sources: selected.map((channel) => ({
        sourceType: 'channel' as const,
        sourceId: channel.youtubeChannelId,
        sourceTitle: channel.title,
        isActive: true,
      })),
    })
    notify(
      t('lists.batchSourceAdded', {
        added: result.addedCount,
        already: result.alreadyAddedCount,
        rejected: result.rejectedCount,
      }),
    )
    closePicker()
    await load(true)
  } catch {
    notify(t('lists.sourceAddFailed'), false)
  } finally {
    pickerBusy.value = false
  }
}

async function addPlaylistSource(playlist: YouTubePlaylist) {
  if (busySourceId.value) {
    return
  }
  busySourceId.value = playlist.youtubePlaylistId
  try {
    await feedsApi.addSource({
      virtualFeedId: feedId,
      sourceType: 'playlist',
      sourceId: playlist.youtubePlaylistId,
      sourceTitle: playlist.title,
      isActive: true,
    })
    notify(t('lists.sourceAdded'))
    closePicker()
    await load(true)
  } catch {
    notify(t('lists.sourceAddFailed'), false)
  } finally {
    busySourceId.value = null
  }
}

async function detectChannels() {
  if (!selectedPlaylistId.value || pickerBusy.value) {
    return
  }
  pickerBusy.value = true
  pickerFailed.value = false
  candidates.value = null
  selectedCandidates.value = new Set()
  try {
    candidates.value = await feedsApi.candidates(feedId, selectedPlaylistId.value)
  } catch {
    pickerFailed.value = true
  } finally {
    pickerBusy.value = false
  }
}

function toggleCandidateSelection(youtubeChannelId: string) {
  const next = new Set(selectedCandidates.value)
  if (next.has(youtubeChannelId)) {
    next.delete(youtubeChannelId)
  } else {
    next.add(youtubeChannelId)
  }
  selectedCandidates.value = next
}

async function addCandidateChannels() {
  const chosen = (candidates.value?.candidates ?? []).filter(
    (candidate) => !candidate.alreadyAdded && selectedCandidates.value.has(candidate.youtubeChannelId),
  )
  if (chosen.length === 0 || pickerBusy.value) {
    return
  }
  pickerBusy.value = true
  try {
    const result = await feedsApi.addSources({
      virtualFeedId: feedId,
      sources: chosen.map((candidate) => ({
        sourceType: 'channel' as const,
        sourceId: candidate.youtubeChannelId,
        sourceTitle: candidate.title,
        isActive: true,
      })),
    })
    notify(
      t('lists.batchSourceAdded', {
        added: result.addedCount,
        already: result.alreadyAddedCount,
        rejected: result.rejectedCount,
      }),
    )
    closePicker()
    await load(true)
  } catch {
    notify(t('lists.sourceAddFailed'), false)
  } finally {
    pickerBusy.value = false
  }
}

const selectableCandidates = computed(() =>
  (candidates.value?.candidates ?? []).filter((candidate) => !candidate.alreadyAdded),
)

const addablePlaylists = computed(() => pickerPlaylists.value.filter((p) => !sourceIds.value.has(p.youtubePlaylistId)))
const displaySources = computed(() => sources.value)
</script>

<template>
  <div class="fdv">
    <router-link
      class="fdv__back"
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
      class="fdv__state"
    >
      <p class="fdv__state-title">
        {{ t('common.loading') }}
      </p>
    </div>

    <div
      v-else-if="failed || !feed"
      class="fdv__state"
    >
      <p class="fdv__state-title fdv__state-title--error">
        {{ t('lists.feedNotFound') }}
      </p>
      <p class="fdv__state-desc">
        {{ t('lists.feedUnavailable') }}
      </p>
      <router-link
        class="fdv__btn"
        :to="{ name: 'playlists' }"
      >
        {{ t('lists.backToPlaylists') }}
      </router-link>
    </div>

    <div
      v-else
      class="fdv__content"
    >
      <div
        v-if="notice"
        class="fdv__notice"
        :class="{ 'fdv__notice--error': !notice.ok }"
        role="status"
      >
        {{ notice.text }}
      </div>

      <header class="fdv__header">
        <div class="fdv__header-main">
          <span
            class="fdv__tile"
            :style="{ background: feed.color || '#7b61ff' }"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
            >
              <path d="M10 8.6v6.8l5.8-3.4z" />
              <path
                d="M3 6h2v12H3zm4 0h2v12H7zm10 0h2v12h-2zm4 0h2v12h-2z"
                opacity="0.65"
              />
            </svg>
          </span>
          <div class="fdv__header-body">
            <h1 class="fdv__title">
              {{ feed.title }}
            </h1>
            <p
              v-if="feed.description"
              class="fdv__desc"
            >
              {{ feed.description }}
            </p>
            <p
              v-else
              class="fdv__desc"
            >
              {{ t('lists.feedDescriptionFallback') }}
            </p>
            <p class="fdv__stats">
              <span>{{ t('lists.videoCountFeed', { count: stats?.matchedVideoCount ?? videos.length }) }}</span>
              <span class="fdv__stats-sep">·</span>
              <span>{{ sourceCountLabel }}</span>
            </p>
          </div>
        </div>
        <div class="fdv__header-actions">
          <button
            type="button"
            class="fdv__btn fdv__btn--primary"
            :disabled="videos.length === 0"
            @click="playAllFeed"
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
            <span>{{ t('lists.playAllFeed') }}</span>
          </button>
          <button
            type="button"
            class="fdv__btn"
            :disabled="refreshing"
            @click="refreshCache"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h7V4z" />
            </svg>
            <span>{{ t('lists.refreshCache') }}</span>
          </button>
          <button
            type="button"
            class="fdv__btn fdv__btn--danger"
            :disabled="deleting"
            @click="deleteFeed"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7 5V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1h4v2h-2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7H4V5zm2 0h6V4H9zm-1 2v12h8V7z" />
            </svg>
            <span>{{ t('lists.deleteFeed') }}</span>
          </button>
        </div>
        <div class="fdv__sort">
          <label
            class="fdv__sort-label"
            for="fdv-sort"
          >{{ t('lists.sortLabel') }}</label>
          <select
            id="fdv-sort"
            class="fdv__select"
            :value="sortOrder"
            @change="applySort(($event.target as HTMLSelectElement).value as SortValue)"
          >
            <option value="newest">
              {{ t('lists.sortNewest') }}
            </option>
            <option value="oldest">
              {{ t('lists.sortOldest') }}
            </option>
            <option value="sourceOrder">
              {{ t('lists.sortSourceOrder') }}
            </option>
          </select>
        </div>
      </header>

      <section class="fdv__sources">
        <div class="fdv__section-head">
          <h2 class="fdv__heading">
            {{ t('lists.sourceSectionTitle') }}
          </h2>
          <button
            v-if="!reorderingSources"
            type="button"
            class="fdv__link-btn"
            @click="openPicker('channels')"
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
            </svg>
            <span>{{ t('lists.addSource') }}</span>
          </button>
        </div>
        <p class="fdv__section-help">
          {{ t('lists.sourceSectionHelp') }}
        </p>
        <p
          v-if="hasStaleSources"
          class="fdv__stale"
        >
          {{ t('lists.sourceUnavailable') }} — {{ t('lists.sourceUnavailableDescription') }}
        </p>

        <div
          v-if="sources.length === 0"
          class="fdv__state fdv__state--card"
        >
          <p class="fdv__state-title">
            {{ t('lists.emptySources') }}
          </p>
          <p class="fdv__state-desc">
            {{ t('lists.emptySourcesDescription') }}
          </p>
        </div>

        <ul
          v-else
          class="fdv__source-list"
        >
          <li
            v-for="(source, index) in displaySources"
            :key="source._id"
            class="fdv__source"
            :class="{ 'fdv__source--reorder': reorderingSources }"
          >
            <div
              v-if="reorderingSources"
              class="fdv__grip"
            >
              <button
                type="button"
                class="fdv__icon-btn"
                :disabled="index === 0"
                :aria-label="t('lists.reorder')"
                @click="moveSource(index, -1)"
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
                class="fdv__icon-btn"
                :disabled="index === displaySources.length - 1"
                :aria-label="t('lists.reorder')"
                @click="moveSource(index, 1)"
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
            <span
              class="fdv__source-type"
              :title="t('lists.sourceTypePlaylist')"
            >{{ sourceTypeLabel(source) }}</span>
            <span class="fdv__source-body">
              <span class="fdv__source-title">{{ source.sourceTitle }}</span>
              <span
                v-if="typeof source.videoCount === 'number'"
                class="fdv__source-sub"
              >
                {{ t('lists.videoCountFeed', { count: source.videoCount }) }}
              </span>
            </span>
            <div
              v-if="!reorderingSources"
              class="fdv__source-actions"
            >
              <button
                type="button"
                class="fdv__switch"
                :class="{ 'fdv__switch--on': source.isActive === true }"
                role="switch"
                :aria-checked="source.isActive === true"
                :title="source.isActive === true ? t('lists.sourceToggledOff') : t('lists.sourceToggledOn')"
                @click="toggleSource(source)"
              >
                <span class="fdv__switch-knob" />
              </button>
              <button
                type="button"
                class="fdv__action"
                :title="t('lists.removeSource')"
                @click="removeSource(source)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M7 5V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1h4v2h-2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7H4V5zm2 0h6V4H9zm-1 2v12h8V7z" />
                </svg>
              </button>
            </div>
          </li>
        </ul>

        <div
          v-if="sources.length > 0 && !reorderingSources"
          class="fdv__source-toolbar"
        >
          <button
            type="button"
            class="fdv__btn fdv__btn--ghost"
            @click="startSourceReorder"
          >
            {{ t('lists.reorder') }}
          </button>
        </div>
        <div
          v-else-if="reorderingSources"
          class="fdv__source-toolbar"
        >
          <button
            type="button"
            class="fdv__btn fdv__btn--primary"
            :disabled="savingOrder"
            @click="saveSourceOrder"
          >
            {{ savingOrder ? t('common.processing') : t('lists.reorderDone') }}
          </button>
          <button
            type="button"
            class="fdv__btn fdv__btn--ghost"
            @click="cancelSourceReorder"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
      </section>

      <section
        v-if="pickerOpen"
        class="fdv__picker"
      >
        <div class="fdv__picker-head">
          <h3 class="fdv__picker-title">
            {{ t('lists.addSource') }}
          </h3>
          <button
            type="button"
            class="fdv__action"
            :title="t('lists.closePicker')"
            @click="closePicker"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" />
            </svg>
          </button>
        </div>
        <p class="fdv__picker-help">
          {{ t('lists.addSourceHelp') }}
        </p>

        <div
          v-if="!pickerMode"
          class="fdv__modes"
        >
          <button
            type="button"
            class="fdv__mode"
            @click="openPicker('channels')"
          >
            <span class="fdv__mode-title">{{ t('lists.sourceModeChannels') }}</span>
            <span class="fdv__mode-desc">{{ t('lists.sourceModeChannelsDescription') }}</span>
          </button>
          <button
            type="button"
            class="fdv__mode"
            @click="openPicker('playlist')"
          >
            <span class="fdv__mode-title">{{ t('lists.sourceModePlaylist') }}</span>
            <span class="fdv__mode-desc">{{ t('lists.sourceModePlaylistDescription') }}</span>
          </button>
          <button
            type="button"
            class="fdv__mode"
            @click="openPicker('playlistChannels')"
          >
            <span class="fdv__mode-title">{{ t('lists.sourceModePlaylistChannels') }}</span>
            <span class="fdv__mode-desc">{{ t('lists.sourceModePlaylistChannelsDescription') }}</span>
          </button>
        </div>

        <div
          v-else-if="pickerBusy"
          class="fdv__picker-state"
        >
          <p class="fdv__state-title">
            {{ t('lists.emptySourcePickerLoading') }}
          </p>
          <p class="fdv__state-desc">
            {{ t('lists.emptySourcePickerLoadingDescription') }}
          </p>
        </div>

        <div
          v-else-if="pickerFailed"
          class="fdv__picker-state"
        >
          <p class="fdv__state-title fdv__state-title--error">
            {{ t('lists.emptySourcePickerError') }}
          </p>
          <p class="fdv__state-desc">
            {{ t('lists.emptySourcePickerErrorDescription') }}
          </p>
          <div class="fdv__picker-errors">
            <button
              type="button"
              class="fdv__btn"
              :disabled="refreshing"
              @click="refreshCache"
            >
              {{ t('lists.sourcePickerRefresh') }}
            </button>
            <button
              type="button"
              class="fdv__btn"
              @click="pickerMode === 'channels' ? loadChannels() : loadPickerPlaylists()"
            >
              {{ t('common.retry') }}
            </button>
          </div>
        </div>

        <div
          v-else-if="pickerMode === 'channels'"
          class="fdv__channels"
        >
          <input
            v-model="searchQuery"
            class="fdv__input"
            type="search"
            :placeholder="t('lists.searchChannels')"
          >
          <div
            v-if="visibleChannels.length > 0"
            class="fdv__picker-list"
          >
            <label
              v-for="channel in visibleChannels"
              :key="channel.youtubeChannelId"
              class="fdv__candidate"
            >
              <input
                type="checkbox"
                :value="channel.youtubeChannelId"
                :checked="selectedChannels.has(channel.youtubeChannelId)"
                :disabled="sourceIds.has(channel.youtubeChannelId)"
                @change="toggleChannelSelection(channel.youtubeChannelId)"
              >
              <img
                v-if="channel.thumbnailUrl"
                class="fdv__candidate-avatar"
                :src="channel.thumbnailUrl"
                alt=""
                loading="lazy"
              >
              <span class="fdv__candidate-title">{{ channel.title }}</span>
              <span
                v-if="sourceIds.has(channel.youtubeChannelId)"
                class="fdv__candidate-badge"
              >
                {{ t('lists.sourceAlreadyAdded') }}
              </span>
            </label>
          </div>
          <div
            v-else-if="channels.length === 0"
            class="fdv__picker-state"
          >
            <p class="fdv__state-title">
              {{ t('lists.sourceModeChannelsEmpty') }}
            </p>
          </div>
          <div
            v-else
            class="fdv__picker-state"
          >
            <p class="fdv__state-title">
              {{ t('lists.sourceSearchNoMatch') }}
            </p>
          </div>
          <button
            type="button"
            class="fdv__btn fdv__btn--primary fdv__picker-submit"
            :disabled="selectedChannels.size === 0"
            @click="addSelectedChannels"
          >
            {{ t('lists.addSelectedSources') }}
          </button>
        </div>

        <div
          v-else-if="pickerMode === 'playlist'"
          class="fdv__playlists"
        >
          <div
            v-if="addablePlaylists.length > 0"
            class="fdv__picker-list"
          >
            <div
              v-for="playlist in pickerPlaylists"
              :key="playlist.youtubePlaylistId"
              class="fdv__playlist-row"
            >
              <span
                class="fdv__playlist-dot"
                :style="{ background: playlist.color || '#7b61ff' }"
                aria-hidden="true"
              />
              <span class="fdv__candidate-title">{{ playlist.title }}</span>
              <span
                v-if="playlist.videoCount"
                class="fdv__candidate-sub"
              >
                {{ t('lists.videoCountFeed', { count: playlist.videoCount }) }}
              </span>
              <button
                v-if="!sourceIds.has(playlist.youtubePlaylistId)"
                type="button"
                class="fdv__btn fdv__btn--small"
                :disabled="busySourceId === playlist.youtubePlaylistId"
                @click="addPlaylistSource(playlist)"
              >
                {{ t('lists.addSource') }}
              </button>
              <span
                v-else
                class="fdv__candidate-badge"
              >{{ t('lists.sourceAlreadyAdded') }}</span>
            </div>
          </div>
          <div
            v-else-if="pickerPlaylists.length === 0"
            class="fdv__picker-state"
          >
            <p class="fdv__state-title">
              {{ t('lists.emptySourcePicker') }}
            </p>
            <p class="fdv__state-desc">
              {{ t('lists.emptySourcePickerDescription') }}
            </p>
          </div>
          <div
            v-else
            class="fdv__picker-state"
          >
            <p class="fdv__state-title">
              {{ t('lists.noPlaylistSources') }}
            </p>
            <p class="fdv__state-desc">
              {{ t('lists.noPlaylistSourcesDescription') }}
            </p>
          </div>
        </div>

        <div
          v-else
          class="fdv__playlist-channels"
        >
          <label class="fdv__field">
            <span class="fdv__label">{{ t('lists.sourceModePlaylist') }}</span>
            <select
              v-model="selectedPlaylistId"
              class="fdv__select"
            >
              <option
                :value="null"
                disabled
              >{{ t('lists.sourceModePlaylistChannelsDescription') }}</option>
              <option
                v-for="playlist in pickerPlaylists"
                :key="playlist.youtubePlaylistId"
                :value="playlist.youtubePlaylistId"
              >
                {{ playlist.title }}
              </option>
            </select>
          </label>
          <button
            type="button"
            class="fdv__btn"
            :disabled="!selectedPlaylistId"
            @click="detectChannels"
          >
            {{ t('lists.sourceModePlaylistChannels') }}
          </button>

          <div
            v-if="candidates"
            class="fdv__candidates"
          >
            <p class="fdv__section-help">
              {{ t('lists.playlistChannelSelectHelp') }}
            </p>
            <p
              v-if="candidates.missingMetadataCount > 0"
              class="fdv__stale"
            >
              {{ t('lists.playlistChannelMissingMetadata', { count: candidates.missingMetadataCount }) }}
            </p>
            <div
              v-if="selectableCandidates.length > 0"
              class="fdv__picker-list"
            >
              <label
                v-for="candidate in selectableCandidates"
                :key="candidate.youtubeChannelId"
                class="fdv__candidate"
              >
                <input
                  type="checkbox"
                  :value="candidate.youtubeChannelId"
                  :checked="selectedCandidates.has(candidate.youtubeChannelId)"
                  @change="toggleCandidateSelection(candidate.youtubeChannelId)"
                >
                <img
                  v-if="candidate.thumbnailUrl"
                  class="fdv__candidate-avatar"
                  :src="candidate.thumbnailUrl"
                  alt=""
                  loading="lazy"
                >
                <span class="fdv__candidate-title">{{ candidate.title }}</span>
              </label>
            </div>
            <div
              v-else
              class="fdv__picker-state"
            >
              <p class="fdv__state-title">
                {{ t('lists.noPlaylistChannels') }}
              </p>
              <p class="fdv__state-desc">
                {{ t('lists.noPlaylistChannelsDescription') }}
              </p>
            </div>
            <button
              type="button"
              class="fdv__btn fdv__btn--primary fdv__picker-submit"
              :disabled="selectedCandidates.size === 0"
              @click="addCandidateChannels"
            >
              {{ t('lists.addSelectedSources') }}
            </button>
          </div>
        </div>
      </section>

      <section class="fdv__videos">
        <h2 class="fdv__heading">
          {{ t('lists.title') }}
        </h2>

        <div
          v-if="videos.length === 0 && !loadMoreBusy"
          class="fdv__state fdv__state--card"
        >
          <p class="fdv__state-title">
            {{ t('lists.noVideosTitle') }}
          </p>
          <p class="fdv__state-desc">
            {{ t('lists.noVideosDescription') }}
          </p>
        </div>

        <ul
          v-else
          class="fdv__video-list"
        >
          <li
            v-for="video in videos"
            :key="video.youtubeVideoId"
            class="fdv__video"
          >
            <router-link
              class="fdv__video-thumb"
              :to="playTarget(video)"
            >
              <img
                :src="thumbnailUrlFor(video)"
                :alt="video.title"
                loading="lazy"
              >
              <span
                v-if="videoDurationSeconds(video) > 0"
                class="fdv__video-duration"
              >
                {{ formatDuration(videoDurationSeconds(video)) }}
              </span>
            </router-link>
            <div class="fdv__video-body">
              <h3 class="fdv__video-title">
                {{ video.title }}
              </h3>
              <p class="fdv__video-channel">
                {{ video.channelTitle || '' }}
              </p>
            </div>
            <div class="fdv__video-actions">
              <router-link
                class="fdv__action"
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
                class="fdv__action"
                :class="{ 'fdv__action--active': isWatched(video) }"
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
                class="fdv__action"
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
            </div>
          </li>
        </ul>

        <div class="fdv__more">
          <p
            v-if="isDone && videos.length > 0"
            class="fdv__hint"
          >
            {{ t('lists.activeVideoHint') }}
          </p>
          <button
            v-if="!isDone && !loadMoreFailed"
            type="button"
            class="fdv__btn"
            :disabled="loadMoreBusy"
            @click="loadMore"
          >
            {{ loadMoreBusy ? t('common.loading') : t('lists.loadMore') }}
          </button>
          <div
            v-if="loadMoreFailed"
            class="fdv__loadmore-error"
          >
            <p class="fdv__state-title fdv__state-title--error">
              {{ t('lists.loadFeedsError') }}
            </p>
            <button
              type="button"
              class="fdv__btn"
              @click="retryLoadMore"
            >
              {{ t('common.retry') }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.fdv {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.fdv__back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.35rem;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  text-decoration: none;
}

.fdv__back:hover {
  color: var(--rg-color-foreground, #f7f7f2);
}

.fdv__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  text-align: center;
  padding: var(--rg-space-4, 1.5rem) 0;
}

.fdv__state--card {
  padding: var(--rg-space-3, 1rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
}

.fdv__state-title {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.fdv__state-title--error {
  color: var(--rg-color-danger, #f87171);
}

.fdv__state-desc {
  margin: 0;
  max-width: 24rem;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__content {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-4, 1.5rem);
}

.fdv__notice {
  padding: 0.5rem 0.7rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: color-mix(in oklab, var(--rg-color-success, #4ade80) 14%, transparent);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__notice--error {
  background: color-mix(in oklab, var(--rg-color-danger, #f87171) 14%, transparent);
  color: var(--rg-color-danger, #f87171);
}

.fdv__header {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-3, 1rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
}

.fdv__header-main {
  display: flex;
  align-items: center;
  gap: var(--rg-space-3, 1rem);
}

.fdv__tile {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: var(--rg-radius-md, 0.625rem);
  color: #ffffff;
}

.fdv__header-body {
  flex: 1;
  min-width: 0;
}

.fdv__title {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.125rem;
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.fdv__desc {
  margin: 0.2rem 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__stats {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.3rem 0 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__stats-sep {
  opacity: 0.6;
}

.fdv__header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rg-space-2, 0.75rem);
}

.fdv__sort {
  display: flex;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
}

.fdv__sort-label {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__select {
  padding: 0.4rem 0.6rem;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-background, #141414);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  font-family: inherit;
}

.fdv__sources,
.fdv__picker,
.fdv__videos {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
}

.fdv__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rg-space-2, 0.75rem);
}

.fdv__heading {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--rg-color-muted, #a1a1a1);
}

.fdv__section-help {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__stale {
  margin: 0;
  padding: 0.4rem 0.6rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: color-mix(in oklab, var(--rg-color-warning, #fbbf24) 16%, transparent);
  color: var(--rg-color-warning, #fbbf24);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__source-list,
.fdv__video-list {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.fdv__source {
  display: flex;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-2, 0.75rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
}

.fdv__source--reorder {
  border-color: var(--rg-color-primary, #f59e0b);
}

.fdv__grip {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.fdv__icon-btn {
  padding: 0.2rem;
  border: none;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: transparent;
  color: var(--rg-color-muted, #a1a1a1);
  cursor: pointer;
}

.fdv__icon-btn:hover:not(:disabled) {
  color: var(--rg-color-foreground, #f7f7f2);
  background: var(--rg-color-surface-raised, #2d2d31);
}

.fdv__icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.fdv__source-type {
  flex-shrink: 0;
  padding: 0.15rem 0.45rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-surface-raised, #2d2d31);
  color: var(--rg-color-muted, #a1a1a1);
  font-size: 0.6875rem;
}

.fdv__source-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.fdv__source-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.8125rem;
  font-weight: var(--rg-text-weight-strong, 700);
}

.fdv__source-sub {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__source-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.4rem;
}

.fdv__switch {
  position: relative;
  width: 2rem;
  height: 1.15rem;
  border: none;
  border-radius: 1rem;
  background: var(--rg-color-border, #3f3f46);
  cursor: pointer;
  transition: background var(--rg-motion-fast, 0.15s) var(--rg-ease, ease);
}

.fdv__switch--on {
  background: var(--rg-color-success, #4ade80);
}

.fdv__switch-knob {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 50%;
  background: var(--rg-color-foreground, #f7f7f2);
  transition: transform var(--rg-motion-fast, 0.15s) var(--rg-ease, ease);
}

.fdv__switch--on .fdv__switch-knob {
  transform: translateX(0.85rem);
}

.fdv__action {
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

.fdv__action:hover {
  color: var(--rg-color-foreground, #f7f7f2);
  background: var(--rg-color-surface-raised, #2d2d31);
}

.fdv__action--active {
  color: var(--rg-color-success, #4ade80);
}

.fdv__source-toolbar {
  display: flex;
  gap: var(--rg-space-2, 0.75rem);
}

.fdv__btn {
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

.fdv__btn:hover:not(:disabled) {
  background: var(--rg-color-primary, #f59e0b);
  color: var(--rg-color-primary-foreground, #1f2937);
}

.fdv__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fdv__btn--small {
  padding: 0.3rem 0.6rem;
}

.fdv__btn--primary {
  border-color: transparent;
  background: var(--rg-color-primary, #f59e0b);
  color: var(--rg-color-primary-foreground, #1f2937);
  font-weight: var(--rg-text-weight-strong, 700);
}

.fdv__btn--ghost {
  background: transparent;
}

.fdv__btn--danger:hover:not(:disabled) {
  background: var(--rg-color-danger, #f87171);
  color: var(--rg-color-foreground, #f7f7f2);
}

.fdv__link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-surface-raised, #2d2d31);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  cursor: pointer;
}

.fdv__picker {
  padding: var(--rg-space-3, 1rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
}

.fdv__picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fdv__picker-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.fdv__picker-help {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__picker-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  text-align: center;
  padding: var(--rg-space-3, 1rem) 0;
}

.fdv__picker-errors {
  display: flex;
  gap: var(--rg-space-2, 0.75rem);
}

.fdv__modes {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
}

.fdv__mode {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  text-align: left;
  padding: var(--rg-space-2, 0.75rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-background, #141414);
  color: var(--rg-color-foreground, #f7f7f2);
  cursor: pointer;
}

.fdv__mode:hover {
  border-color: var(--rg-color-primary, #f59e0b);
}

.fdv__mode-title {
  font-size: 0.8125rem;
  font-weight: var(--rg-text-weight-strong, 700);
}

.fdv__mode-desc {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__channels,
.fdv__playlists,
.fdv__playlist-channels {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
}

.fdv__input {
  padding: 0.5rem 0.7rem;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-background, #141414);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.875rem;
  font-family: inherit;
}

.fdv__input:focus {
  outline: none;
  border-color: var(--rg-color-primary, #f59e0b);
}

.fdv__picker-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 16rem;
  overflow-y: auto;
}

.fdv__candidate {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.5rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  cursor: pointer;
}

.fdv__candidate:hover {
  background: var(--rg-color-surface-raised, #2d2d31);
}

.fdv__candidate input {
  accent-color: var(--rg-color-primary, #f59e0b);
}

.fdv__candidate-avatar {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  object-fit: cover;
  background: var(--rg-color-border, #3f3f46);
}

.fdv__candidate-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.8125rem;
}

.fdv__candidate-sub {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__candidate-badge {
  flex-shrink: 0;
  padding: 0.1rem 0.4rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-surface-raised, #2d2d31);
  color: var(--rg-color-muted, #a1a1a1);
  font-size: 0.6875rem;
}

.fdv__picker-submit {
  align-self: flex-start;
}

.fdv__playlist-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.5rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
}

.fdv__playlist-row:hover {
  background: var(--rg-color-surface-raised, #2d2d31);
}

.fdv__playlist-dot {
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
}

.fdv__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.fdv__label {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__candidates {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
}

.fdv__video {
  display: flex;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-1, 0.5rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
}

.fdv__video-thumb {
  position: relative;
  flex-shrink: 0;
  width: 8rem;
  aspect-ratio: 16 / 9;
  border-radius: var(--rg-radius-md, 0.625rem);
  overflow: hidden;
  display: block;
  background: var(--rg-color-background, #141414);
}

.fdv__video-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fdv__video-duration {
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

.fdv__video-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.fdv__video-title {
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.8125rem;
  font-weight: var(--rg-text-weight-strong, 700);
}

.fdv__video-channel {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__video-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.25rem;
}

.fdv__more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-2, 0.75rem) 0;
}

.fdv__hint {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.fdv__loadmore-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
}
</style>