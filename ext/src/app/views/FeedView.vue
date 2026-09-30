<script setup lang="ts">
// Feed screen mirroring the Flutter videos screen: keep-watching rows plus the
// full synchronized video grid, with a per-card watched toggle.
import { onMounted, ref } from 'vue'
import { useAppI18n } from '@/app/i18n'
import { progressApi, videosApi, watchedApi } from '@/app/convex/api'
import type { VideoProgress, WatchedVideo, YouTubeVideo } from '@/app/convex/types'

const { t } = useAppI18n()

interface ResumeItem {
  video: YouTubeVideo
  progress: VideoProgress
}

interface AllProgressItem {
  youtubeVideoId: string
  progressSeconds: number
  durationSeconds?: number | null
  updatedAt?: number | string
}

const loading = ref(true)
const failed = ref(false)
const videos = ref<YouTubeVideo[]>([])
const watched = ref<Set<string>>(new Set())
const resumeRows = ref<ResumeItem[]>([])
const busyIds = ref<Set<string>>(new Set())

async function loadFeed() {
  loading.value = true
  failed.value = false
  try {
    const [rawVideos, rawWatched, rawProgress] = await Promise.all([
      videosApi.getAll('desc', true).catch(() => null),
      watchedApi.list().catch(() => null),
      progressApi.getAll().catch(() => null),
    ])
    const list = normalizeVideos(rawVideos)
    videos.value = list
    watched.value = buildWatchedSet(list, rawWatched)
    resumeRows.value = buildResumeRows(list, rawProgress ?? [])
    // A missing video query degrades to the error screen; a missing watched or
    // progress query only degrades the related section.
    failed.value = rawVideos === null
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadFeed()
})

function retry() {
  void loadFeed()
}

function playTarget(video: YouTubeVideo): { name: 'play'; query: { v: string } } {
  return { name: 'play', query: { v: video.youtubeVideoId } }
}

function normalizeVideos(raw: unknown): YouTubeVideo[] {
  if (Array.isArray(raw)) {
    return raw as YouTubeVideo[]
  }
  if (
    raw !== null &&
    typeof raw === 'object' &&
    Array.isArray((raw as { page?: unknown }).page)
  ) {
    return ((raw as { page: YouTubeVideo[] }).page)
  }
  return []
}

function buildWatchedSet(list: YouTubeVideo[], rawWatched: WatchedVideo[] | null): Set<string> {
  const ids = new Set<string>()
  if (rawWatched) {
    for (const item of rawWatched) {
      ids.add(item.youtubeVideoId)
    }
  }
  for (const item of list) {
    if (item.watched === true) {
      ids.add(item.youtubeVideoId)
    }
  }
  return ids
}

function toVideoProgress(item: AllProgressItem): VideoProgress {
  return {
    _id: '',
    youtubeVideoId: item.youtubeVideoId,
    progressSeconds: item.progressSeconds,
    durationSeconds: item.durationSeconds,
    updatedAt: typeof item.updatedAt === 'number' ? String(item.updatedAt) : item.updatedAt,
  } as VideoProgress
}

function buildResumeRows(list: YouTubeVideo[], raw: AllProgressItem[]): ResumeItem[] {
  const byId = new Map(list.map((v) => [v.youtubeVideoId, v]))
  const rows: ResumeItem[] = []
  for (const item of raw) {
    const video = byId.get(item.youtubeVideoId)
    if (!video || item.progressSeconds <= 0) {
      continue
    }
    const effective = resumeDuration(item, video)
    if (effective !== null && item.progressSeconds >= effective - 5) {
      continue
    }
    rows.push({ video, progress: toVideoProgress(item) })
  }
  rows.sort((a, b) => Number(b.progress.updatedAt) - Number(a.progress.updatedAt))
  return rows
}

function resumeDuration(progress: AllProgressItem, video: YouTubeVideo): number | null {
  if (typeof progress.durationSeconds === 'number' && progress.durationSeconds > 0) {
    return progress.durationSeconds
  }
  return videoDurationSeconds(video)
}

function resumePercentage(row: ResumeItem): number | null {
  const total = resumeDuration(row.progress, row.video)
  if (total === null || total <= 0) {
    return null
  }
  const ratio = Math.min(Math.max(row.progress.progressSeconds / total, 0), 1)
  return Math.round(ratio * 100)
}

function videoDurationSeconds(video: YouTubeVideo): number | null {
  if (typeof video.durationSeconds === 'number' && video.durationSeconds > 0) {
    return video.durationSeconds
  }
  const raw = video as unknown as { duration?: unknown }
  if (typeof raw.duration === 'string') {
    return parseIsoDuration(raw.duration)
  }
  return null
}

function parseIsoDuration(value: string): number | null {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value)
  if (!match) {
    return null
  }
  const total =
    Number(match[1] ?? 0) * 86400 +
    Number(match[2] ?? 0) * 3600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0)
  return total > 0 ? total : null
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
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

function channelTitleFor(video: YouTubeVideo): string {
  return video.channelTitle || ''
}

function isWatched(video: YouTubeVideo): boolean {
  return watched.value.has(video.youtubeVideoId)
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
  } catch {
    const revert = new Set(watched.value)
    if (previous) {
      revert.add(id)
    } else {
      revert.delete(id)
    }
    watched.value = revert
  } finally {
    busyIds.value.delete(id)
  }
}
</script>

<template>
  <div class="rg-feed">
    <div
      v-if="loading"
      class="rg-feed__state"
    >
      <p class="rg-feed__state-title">
        {{ t('common.loading') }}
      </p>
    </div>

    <div
      v-else-if="failed"
      class="rg-feed__state"
    >
      <p class="rg-feed__state-title rg-feed__state-title--error">
        {{ t('feed.loadFailed') }}
      </p>
      <button
        type="button"
        class="rg-btn"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <div
      v-else-if="videos.length === 0"
      class="rg-feed__state"
    >
      <p class="rg-feed__state-title">
        {{ t('feed.noVideosTitle') }}
      </p>
      <p class="rg-feed__state-desc">
        {{ t('feed.noVideosDesc') }}
      </p>
    </div>

    <div
      v-else
      class="rg-feed__content"
    >
      <section
        v-if="resumeRows.length > 0"
        class="rg-feed__section"
      >
        <h2 class="rg-feed__heading">
          {{ t('feed.keepWatching') }}
        </h2>
        <article
          v-for="row in resumeRows"
          :key="row.video.youtubeVideoId"
          class="rg-resume-row"
        >
          <router-link
            class="rg-resume-row__media"
            :to="playTarget(row.video)"
            :aria-label="t('feed.watch')"
          >
            <img
              :src="thumbnailUrlFor(row.video)"
              alt=""
              loading="lazy"
              class="rg-resume-row__thumb"
            >
          </router-link>
          <router-link
            class="rg-resume-row__body"
            :to="playTarget(row.video)"
          >
            <h3 class="rg-resume-row__title">
              {{ row.video.title }}
            </h3>
            <p class="rg-resume-row__channel">
              {{ channelTitleFor(row.video) }}
            </p>
            <div class="rg-resume-row__meta">
              <div
                v-if="resumePercentage(row) !== null"
                class="rg-resume-row__bar"
                aria-hidden="true"
              >
                <span
                  class="rg-resume-row__bar-fill"
                  :style="{ width: `${resumePercentage(row)}%` }"
                />
              </div>
              <span class="rg-resume-row__time">
                {{ t('feed.resumeAt', { time: formatDuration(row.progress.progressSeconds) }) }}
              </span>
            </div>
          </router-link>
          <span class="rg-resume-row__action">{{ t('feed.resume') }}</span>
        </article>
      </section>

      <section class="rg-feed__section">
        <h2 class="rg-feed__heading">
          {{ t('feed.allVideos') }}
        </h2>
        <div class="rg-feed__grid">
          <article
            v-for="video in videos"
            :key="video.youtubeVideoId"
            class="rg-card"
          >
            <div class="rg-card__media">
              <router-link
                class="rg-card__link"
                :to="playTarget(video)"
                :aria-label="t('feed.watch')"
              >
                <img
                  :src="thumbnailUrlFor(video)"
                  :alt="video.title"
                  loading="lazy"
                  class="rg-card__thumb"
                >
                <span
                  v-if="videoDurationSeconds(video) !== null"
                  class="rg-card__duration"
                >
                  {{ formatDuration(videoDurationSeconds(video)) }}
                </span>
              </router-link>
              <button
                type="button"
                class="rg-card__watch"
                :class="{ 'rg-card__watch--checked': isWatched(video) }"
                :aria-pressed="isWatched(video)"
                :title="isWatched(video) ? t('feed.markUnwatched') : t('feed.markWatched')"
                @click="toggleWatched(video)"
              >
                <svg
                  v-if="!isWatched(video)"
                  class="rg-card__watch-icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                <svg
                  v-else
                  class="rg-card__watch-icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
                </svg>
                <span>{{ isWatched(video) ? t('feed.watched') : t('feed.watch') }}</span>
              </button>
            </div>
            <router-link
              class="rg-card__body"
              :to="playTarget(video)"
            >
              <h3 class="rg-card__title">
                {{ video.title }}
              </h3>
              <p class="rg-card__channel">
                {{ channelTitleFor(video) }}
              </p>
            </router-link>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.rg-feed {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-4, 1.5rem);
  padding: var(--rg-space-4, 1.5rem);
}

.rg-feed__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  text-align: center;
  padding: var(--rg-space-5, 2rem) 0;
}

.rg-feed__state-title {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.rg-feed__state-title--error {
  color: var(--rg-color-danger, #f87171);
}

.rg-feed__state-desc {
  margin: 0;
  max-width: 24rem;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-feed__content {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-5, 2rem);
}

.rg-feed__section {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.rg-feed__heading {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--rg-color-muted, #a1a1a1);
}

.rg-feed__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: var(--rg-space-3, 1rem);
}

.rg-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
  box-shadow: var(--rg-shadow-card, 0 1px 2px rgba(0, 0, 0, 0.2));
}

.rg-card__media {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--rg-color-background, #141414);
}

.rg-card__link {
  display: block;
  width: 100%;
  height: 100%;
}

.rg-card__thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rg-card__duration {
  position: absolute;
  right: var(--rg-space-1, 0.5rem);
  bottom: var(--rg-space-1, 0.5rem);
  padding: 0.1rem 0.4rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: rgba(0, 0, 0, 0.75);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  font-variant-numeric: tabular-nums;
}

.rg-card__watch {
  position: absolute;
  right: var(--rg-space-1, 0.5rem);
  bottom: var(--rg-space-1, 0.5rem);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: rgba(0, 0, 0, 0.75);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  cursor: pointer;
}

.rg-card__watch--checked {
  border-color: var(--rg-color-success, #4ade80);
  color: var(--rg-color-success, #4ade80);
}

.rg-card__watch-icon {
  flex-shrink: 0;
}

.rg-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: var(--rg-space-2, 0.75rem);
  text-decoration: none;
}

.rg-card__title {
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.8125rem;
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-card__channel {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-resume-row {
  display: flex;
  align-items: stretch;
  gap: var(--rg-space-3, 1rem);
  padding: var(--rg-space-2, 0.75rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
}

.rg-resume-row__media {
  flex-shrink: 0;
  width: 10rem;
  aspect-ratio: 16 / 9;
  border-radius: var(--rg-radius-md, 0.625rem);
  overflow: hidden;
  align-self: center;
}

.rg-resume-row__thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rg-resume-row__body {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 0.15rem;
  text-decoration: none;
}

.rg-resume-row__title {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.875rem;
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-resume-row__channel {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-resume-row__meta {
  display: flex;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  margin-top: 0.3rem;
}

.rg-resume-row__bar {
  flex: 1;
  height: 0.3rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-border, #3f3f46);
  overflow: hidden;
}

.rg-resume-row__bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--rg-color-primary, #f59e0b);
}

.rg-resume-row__time {
  flex-shrink: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  font-variant-numeric: tabular-nums;
}

.rg-resume-row__action {
  flex-shrink: 0;
  align-self: center;
  padding: 0.35rem 0.75rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-primary, #f59e0b);
  color: var(--rg-color-primary-foreground, #1f2937);
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-btn {
  padding: 0.55rem 1rem;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface-raised, #2d2d31);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  cursor: pointer;
}

.rg-btn:hover {
  background: var(--rg-color-primary-hover, #b45309);
  color: var(--rg-color-primary-foreground, #1f2937);
}
</style>