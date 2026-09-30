<script setup lang="ts">
// Lists screen mirroring the Flutter playlists screen: ReplayGlows Feeds plus
// YouTube playlists, with a create entry and per-section degrade on failure.
import { computed, onMounted, ref } from 'vue'
import { useAppI18n } from '@/app/i18n'
import { feedsApi, videosApi } from '@/app/convex/api'
import type { VirtualFeed, YouTubePlaylist } from '@/app/convex/types'

const { t } = useAppI18n()

const loading = ref(true)
const feeds = ref<VirtualFeed[]>([])
const feedsLoaded = ref(false)
const feedsFailed = ref(false)
const playlists = ref<YouTubePlaylist[]>([])
const playlistsLoaded = ref(false)
const playlistsFailed = ref(false)

const feedWithCounts = (feed: VirtualFeed): VirtualFeed & { sourceCount?: number; activeSourceCount?: number } =>
  feed as VirtualFeed & { sourceCount?: number; activeSourceCount?: number }

async function loadFeeds() {
  try {
    const raw = await feedsApi.list(false)
    feeds.value = Array.isArray(raw) ? raw : []
  } catch {
    feedsFailed.value = true
  } finally {
    feedsLoaded.value = true
  }
}

async function loadPlaylists() {
  try {
    const raw = await videosApi.getPlaylists()
    const list = Array.isArray(raw) ? raw : []
    playlists.value = list.filter((p) => (p as { source?: string }).source !== 'subscriptions')
  } catch {
    playlistsFailed.value = true
  } finally {
    playlistsLoaded.value = true
  }
}

async function loadAll() {
  loading.value = true
  feedsLoaded.value = false
  feedsFailed.value = false
  playlistsLoaded.value = false
  playlistsFailed.value = false
  await Promise.all([loadFeeds(), loadPlaylists()])
  loading.value = false
}

onMounted(() => {
  void loadAll()
})

function retry() {
  void loadAll()
}

const bothEmpty = computed(
  () =>
    feedsLoaded.value &&
    playlistsLoaded.value &&
    !feedsFailed.value &&
    !playlistsFailed.value &&
    feeds.value.length === 0 &&
    playlists.value.length === 0,
)

const showFeeds = computed(() => feedsLoaded.value && !feedsFailed.value && feeds.value.length > 0)
const showPlaylists = computed(
  () => playlistsLoaded.value && !playlistsFailed.value && playlists.value.length > 0,
)
const anyFailure = computed(() => feedsFailed.value || playlistsFailed.value)

function colorOf(item: { color?: string | null }): string {
  return item.color && item.color.length > 0 ? item.color : '#7b61ff'
}

function feedCountLabel(feed: VirtualFeed): string | null {
  const count = feedWithCounts(feed).sourceCount
  if (typeof count !== 'number' || count < 0) {
    return null
  }
  return `${count} ${count > 1 ? t('lists.feedSourceCountPlural') : t('lists.feedSourceCountSingular')}`
}

function playlistCountLabel(playlist: YouTubePlaylist): string {
  return t('lists.videoCountStats', { count: playlist.videoCount ?? 0 })
}
</script>

<template>
  <div class="plv">
    <section class="plv__bar">
      <router-link
        class="plv__create"
        :to="{ name: 'create-playlist' }"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
        </svg>
        <span>{{ t('lists.createEntry') }}</span>
      </router-link>
      <p class="plv__create-desc">
        {{ t('lists.createEntryDescription') }}
      </p>
    </section>

    <div
      v-if="loading"
      class="plv__state"
    >
      <p class="plv__state-title">
        {{ t('common.loading') }}
      </p>
    </div>

    <div
      v-else-if="bothEmpty"
      class="plv__state"
    >
      <p class="plv__state-title">
        {{ t('lists.emptyTitle') }}
      </p>
      <p class="plv__state-desc">
        {{ t('lists.emptyDescription') }}
      </p>
      <router-link
        class="plv__btn"
        :to="{ name: 'create-playlist' }"
      >
        {{ t('lists.createEntry') }}
      </router-link>
    </div>

    <div
      v-else
      class="plv__content"
    >
      <section
        v-if="showFeeds"
        class="plv__section"
      >
        <h2 class="plv__heading">
          {{ t('lists.replayFeedsSection') }}
        </h2>
        <div class="plv__list">
          <router-link
            v-for="feed in feeds"
            :key="feed._id"
            class="plv__row"
            :to="{ name: 'feed-detail', params: { id: feed._id } }"
          >
            <span
              class="plv__tile"
              :style="{ background: colorOf(feed) }"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
              >
                <path d="M10 8.6v6.8l5.8-3.4z" />
                <path
                  d="M3 6h2v12H3zm4 0h2v12H7zm10 0h2v12h-2zm4 0h2v12h-2z"
                  opacity="0.65"
                />
              </svg>
            </span>
            <span class="plv__row-body">
              <span class="plv__row-title">{{ feed.title }}</span>
              <span
                v-if="feedCountLabel(feed)"
                class="plv__row-sub"
              >{{ feedCountLabel(feed) }}</span>
            </span>
            <svg
              class="plv__chevron"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M9.3 6.7 15.6 13l-6.3 6.3 1.4 1.4 6.3-6.3a2 2 0 0 0 0-2.8L10.7 5.3z" />
            </svg>
          </router-link>
        </div>
      </section>

      <section
        v-if="showPlaylists"
        class="plv__section"
      >
        <h2 class="plv__heading">
          {{ t('lists.youtubePlaylistsSection') }}
        </h2>
        <div class="plv__list">
          <router-link
            v-for="playlist in playlists"
            :key="playlist.youtubePlaylistId"
            class="plv__row"
            :to="{ name: 'playlist-detail', params: { id: playlist.youtubePlaylistId } }"
          >
            <span
              class="plv__tile"
              :style="{ background: colorOf(playlist) }"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
              >
                <path d="M4 5h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm0 4h10v2H4z" />
              </svg>
            </span>
            <span class="plv__row-body">
              <span class="plv__row-title">{{ playlist.title }}</span>
              <span
                v-if="playlist.videoCount"
                class="plv__row-sub"
              >
                {{ playlistCountLabel(playlist) }}
              </span>
            </span>
            <svg
              class="plv__chevron"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M9.3 6.7 15.6 13l-6.3 6.3 1.4 1.4 6.3-6.3a2 2 0 0 0 0-2.8L10.7 5.3z" />
            </svg>
          </router-link>
        </div>
      </section>

      <section
        v-if="anyFailure"
        class="plv__state"
      >
        <p class="plv__state-title plv__state-title--error">
          {{ feedsFailed ? t('lists.loadFeedsError') : t('lists.loadPlaylistsError') }}
        </p>
        <button
          type="button"
          class="plv__btn"
          @click="retry"
        >
          {{ t('common.retry') }}
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.plv {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.plv__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rg-space-2, 0.75rem);
  flex-wrap: wrap;
}

.plv__create {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  border: none;
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-primary, #f59e0b);
  color: var(--rg-color-primary-foreground, #1f2937);
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  text-decoration: none;
  cursor: pointer;
  transition: background var(--rg-motion-fast, 0.15s) var(--rg-ease, ease);
}

.plv__create:hover {
  background: var(--rg-color-primary-hover, #b45309);
}

.plv__create-desc {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.plv__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  text-align: center;
  padding: var(--rg-space-5, 2rem) 0;
}

.plv__state-title {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.plv__state-title--error {
  color: var(--rg-color-danger, #f87171);
}

.plv__state-desc {
  margin: 0;
  max-width: 24rem;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.plv__content {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-4, 1.5rem);
}

.plv__section {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
}

.plv__heading {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--rg-color-muted, #a1a1a1);
}

.plv__list {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
}

.plv__row {
  display: flex;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-2, 0.75rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
  text-decoration: none;
  transition: border-color var(--rg-motion-fast, 0.15s) var(--rg-ease, ease);
}

.plv__row:hover {
  border-color: var(--rg-color-primary, #f59e0b);
}

.plv__tile {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--rg-radius-md, 0.625rem);
  color: #ffffff;
}

.plv__row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.plv__row-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.875rem;
  font-weight: var(--rg-text-weight-strong, 700);
}

.plv__row-sub {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.plv__chevron {
  flex-shrink: 0;
  color: var(--rg-color-muted, #a1a1a1);
}

.plv__btn {
  padding: 0.55rem 1rem;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface-raised, #2d2d31);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  text-decoration: none;
  cursor: pointer;
}

.plv__btn:hover {
  background: var(--rg-color-primary, #f59e0b);
  color: var(--rg-color-primary-foreground, #1f2937);
}
</style>