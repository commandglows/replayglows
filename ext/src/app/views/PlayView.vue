<script setup lang="ts">
// Play screen: HTML5 iframe player for a synchronized video, with resume
// position, watched status, like/dislike and a save-position control.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppI18n } from '@/app/i18n'
import { likesApi, progressApi, videosApi, watchedApi } from '@/app/convex/api'
import type { VideoProgress, YouTubeVideo } from '@/app/convex/types'

const route = useRoute()
const { t } = useAppI18n()

const videoId = computed<string>(() => {
  const value = route.query.v
  return typeof value === 'string' ? value.trim() : ''
})

const loading = ref(true)
const failed = ref(false)
const notFound = ref(false)
const video = ref<YouTubeVideo | null>(null)
const progress = ref<VideoProgress | null>(null)
const isWatched = ref(false)
const likeChoice = ref<'like' | 'dislike' | null>(null)
const embedStart = ref<number | null>(null)
const embedKey = ref(0)
const saveInput = ref('0')
const savingPosition = ref(false)
const busyWatched = ref(false)
const busyLike = ref(false)
const feedback = ref<{ kind: 'ok' | 'error'; message: string } | null>(null)
const feedbackTimer = ref<number | null>(null)

// The backend `getVideoByYoutubeId` returns the YouTube id under `id` (no
// `youtubeVideoId` field), so fall back to it when the typed field is absent.
function videoIdOf(item: YouTubeVideo | null): string {
  if (!item) {
    return ''
  }
  return item.youtubeVideoId || (item as unknown as { id?: string }).id || ''
}

const embeddedId = computed(() => videoIdOf(video.value))
const channelTitle = computed(() => video.value?.channelTitle || '')
const savedSeconds = computed(() => Math.max(0, progress.value?.progressSeconds ?? 0))

const effectiveDuration = computed<number | null>(() => {
  const saved = progress.value?.durationSeconds
  if (typeof saved === 'number' && saved > 0) {
    return saved
  }
  return videoDurationSeconds(video.value)
})

const progressPct = computed<number | null>(() => {
  const total = effectiveDuration.value
  if (total === null || total <= 0 || savedSeconds.value <= 0) {
    return null
  }
  const ratio = Math.min(Math.max(savedSeconds.value / total, 0), 1)
  return Math.round(ratio * 100)
})

const embedSrc = computed(() => {
  const id = embeddedId.value
  if (!id) {
    return ''
  }
  const params = new URLSearchParams()
  const start = embedStart.value
  if (start !== null && start > 0) {
    params.set('start', String(Math.floor(start)))
  }
  params.set('rel', '0')
  const query = params.toString()
  return `https://www.youtube-nocookie.com/embed/${id}${query ? `?${query}` : ''}`
})

async function load() {
  const id = videoId.value
  loading.value = true
  failed.value = false
  notFound.value = false
  feedback.value = null
  video.value = null
  progress.value = null
  isWatched.value = false
  likeChoice.value = null
  embedStart.value = null
  embedKey.value = 0

  if (!id) {
    loading.value = false
    return
  }

  try {
    const [meta, savedProgress, rawWatched] = await Promise.all([
      videosApi.getByYoutubeId(id).catch(() => null),
      progressApi.get(id).catch(() => null),
      watchedApi.list().catch(() => null),
    ])
    const resolved = videoIdOf(meta)
    video.value = resolved ? meta : null
    notFound.value = !resolved
    progress.value = savedProgress
    saveInput.value = String(Math.round(savedProgress?.progressSeconds ?? 0))
    isWatched.value = rawWatched?.some((w) => w.youtubeVideoId === id) ?? false
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

watch(videoId, () => {
  void load()
})

function retry() {
  void load()
}

function resumePlayback() {
  const seconds = savedSeconds.value
  embedStart.value = seconds > 0 ? seconds : null
  embedKey.value += 1
}

function restart() {
  embedStart.value = null
  embedKey.value += 1
}

async function savePosition() {
  const id = videoId.value
  const parsed = Number(saveInput.value)
  if (!id || !Number.isFinite(parsed) || parsed < 0) {
    return
  }
  savingPosition.value = true
  try {
    const seconds = Math.floor(parsed)
    await progressApi.save({ youtubeVideoId: id, progressSeconds: seconds })
    const base: VideoProgress =
      progress.value ?? ({ _id: '', youtubeVideoId: id, progressSeconds: 0 } as VideoProgress)
    progress.value = { ...base, youtubeVideoId: id, progressSeconds: seconds }
    showFeedback('ok', t('play.positionSaved'))
  } catch {
    showFeedback('error', t('play.positionNotSaved'))
  } finally {
    savingPosition.value = false
  }
}

async function toggleWatched() {
  const id = videoId.value
  if (!id || busyWatched.value) {
    return
  }
  busyWatched.value = true
  const previous = isWatched.value
  isWatched.value = !previous
  try {
    if (isWatched.value) {
      await watchedApi.mark(id)
    } else {
      await watchedApi.unmark(id)
    }
    showFeedback('ok', t('play.watchedUpdated'))
  } catch {
    isWatched.value = previous
    showFeedback('error', t('play.watchedUpdateFailed'))
  } finally {
    busyWatched.value = false
  }
}

async function toggleLike(type: 'like' | 'dislike') {
  const id = videoId.value
  if (!id || busyLike.value) {
    return
  }
  busyLike.value = true
  const previous = likeChoice.value
  likeChoice.value = previous === type ? null : type
  try {
    await likesApi.toggle(id, type)
  } catch {
    likeChoice.value = previous
    showFeedback('error', t('play.actionFailed'))
  } finally {
    busyLike.value = false
  }
}

function showFeedback(kind: 'ok' | 'error', message: string) {
  feedback.value = { kind, message }
  if (feedbackTimer.value !== null) {
    window.clearTimeout(feedbackTimer.value)
  }
  feedbackTimer.value = window.setTimeout(() => {
    feedback.value = null
    feedbackTimer.value = null
  }, 3500)
}

onBeforeUnmount(() => {
  if (feedbackTimer.value !== null) {
    window.clearTimeout(feedbackTimer.value)
  }
})

function videoDurationSeconds(item: YouTubeVideo | null): number | null {
  if (!item) {
    return null
  }
  if (typeof item.durationSeconds === 'number' && item.durationSeconds > 0) {
    return item.durationSeconds
  }
  const raw = item as unknown as { duration?: unknown }
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
</script>

<template>
  <div class="rg-play">
    <router-link
      class="rg-play__back"
      :to="{ name: 'feed' }"
    >
      {{ t('play.backToFeed') }}
    </router-link>

    <div
      v-if="!videoId"
      class="rg-play__state"
    >
      <p class="rg-play__state-title">
        {{ t('play.chooseVideoTitle') }}
      </p>
      <p class="rg-play__state-desc">
        {{ t('play.chooseVideoDesc') }}
      </p>
    </div>

    <div
      v-else-if="loading"
      class="rg-play__state"
    >
      <p class="rg-play__state-title">
        {{ t('common.loading') }}
      </p>
    </div>

    <div
      v-else-if="failed"
      class="rg-play__state"
    >
      <p class="rg-play__state-title rg-play__state-title--error">
        {{ t('play.loadFailed') }}
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
      v-else-if="notFound || !embeddedId"
      class="rg-play__state"
    >
      <p class="rg-play__state-title">
        {{ t('play.metadataUnavailable') }}
      </p>
    </div>

    <div
      v-else
      class="rg-play__content"
    >
      <section class="rg-play__player">
        <iframe
          :key="embedKey"
          :src="embedSrc"
          class="rg-play__frame"
          title="YouTube embed"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
        />
        <div class="rg-play__meta">
          <h2 class="rg-play__title">
            {{ video?.title || '' }}
          </h2>
          <p class="rg-play__channel">
            {{ channelTitle }}
          </p>
        </div>
      </section>

      <aside class="rg-play__side">
        <section class="rg-panel">
          <h3 class="rg-panel__title">
            {{ t('play.resume') }}
          </h3>
          <p
            v-if="savedSeconds > 0"
            class="rg-panel__text"
          >
            {{ t('play.resumeAt', { time: formatDuration(savedSeconds) }) }}
          </p>
          <p
            v-else
            class="rg-panel__text"
          >
            {{ t('play.noPosition') }}
          </p>
          <div
            v-if="progressPct !== null"
            class="rg-progress"
            aria-hidden="true"
          >
            <span
              class="rg-progress__fill"
              :style="{ width: `${progressPct}%` }"
            />
          </div>
          <div class="rg-panel__row">
            <button
              type="button"
              class="rg-btn rg-btn--primary"
              @click="resumePlayback"
            >
              {{ t('play.resume') }}
            </button>
            <button
              type="button"
              class="rg-btn"
              @click="restart"
            >
              {{ t('play.startOver') }}
            </button>
          </div>
        </section>

        <section class="rg-panel">
          <h3 class="rg-panel__title">
            {{ t('play.savePosition') }}
          </h3>
          <label class="rg-field">
            <span class="rg-field__label">{{ t('play.positionSeconds') }}</span>
            <div class="rg-field__row">
              <input
                v-model="saveInput"
                class="rg-input"
                type="number"
                min="0"
                step="1"
              >
              <button
                type="button"
                class="rg-btn rg-btn--primary"
                :disabled="savingPosition"
                @click="savePosition"
              >
                {{ savingPosition ? t('common.processing') : t('common.save') }}
              </button>
            </div>
          </label>
        </section>

        <section class="rg-panel">
          <h3 class="rg-panel__title">
            {{ t('play.watched') }}
          </h3>
          <div class="rg-panel__row">
            <button
              type="button"
              class="rg-btn"
              :class="{ 'rg-btn--active': isWatched }"
              :aria-pressed="isWatched"
              :disabled="busyWatched"
              @click="toggleWatched"
            >
              {{ isWatched ? t('play.markUnwatched') : t('play.markWatched') }}
            </button>
            <button
              type="button"
              class="rg-btn"
              :class="{ 'rg-btn--active': likeChoice === 'like' }"
              :aria-pressed="likeChoice === 'like'"
              :disabled="busyLike"
              @click="toggleLike('like')"
            >
              {{ t('play.like') }}
            </button>
            <button
              type="button"
              class="rg-btn"
              :class="{ 'rg-btn--active': likeChoice === 'dislike' }"
              :aria-pressed="likeChoice === 'dislike'"
              :disabled="busyLike"
              @click="toggleLike('dislike')"
            >
              {{ t('play.dislike') }}
            </button>
          </div>
        </section>

        <p
          v-if="feedback"
          class="rg-feedback"
          :class="feedback.kind === 'error' ? 'rg-feedback--error' : 'rg-feedback--ok'"
          role="status"
        >
          {{ feedback.message }}
        </p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.rg-play {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
  padding: var(--rg-space-4, 1.5rem);
}

.rg-play__back {
  align-self: flex-start;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  text-decoration: none;
}

.rg-play__back:hover {
  color: var(--rg-color-foreground, #f7f7f2);
}

.rg-play__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  text-align: center;
  padding: var(--rg-space-5, 2rem) 0;
}

.rg-play__state-title {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.rg-play__state-title--error {
  color: var(--rg-color-danger, #f87171);
}

.rg-play__state-desc {
  margin: 0;
  max-width: 24rem;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-play__content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(15rem, 22rem);
  gap: var(--rg-space-4, 1.5rem);
  align-items: start;
}

.rg-play__player {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
  min-width: 0;
}

.rg-play__frame {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-background, #141414);
}

.rg-play__meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.rg-play__title {
  margin: 0;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.9375rem;
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-play__channel {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-play__side {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.rg-panel {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-3, 1rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
}

.rg-panel__title {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--rg-color-muted, #a1a1a1);
}

.rg-panel__text {
  margin: 0;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-panel__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-progress {
  height: 0.3rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-border, #3f3f46);
  overflow: hidden;
}

.rg-progress__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--rg-color-primary, #f59e0b);
}

.rg-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.rg-field__label {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-field__row {
  display: flex;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-input {
  flex: 1;
  min-width: 0;
  padding: 0.55rem 0.75rem;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface-raised, #2d2d31);
  color: var(--rg-color-foreground, #f7f7f2);
  font-family: var(--rg-font-body);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-btn {
  padding: 0.55rem 1rem;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface-raised, #2d2d31);
  color: var(--rg-color-foreground, #f7f7f2);
  font-family: var(--rg-font-body);
  font-size: var(--rg-text-small, 0.75rem);
  cursor: pointer;
}

.rg-btn:hover {
  background: var(--rg-color-primary-hover, #b45309);
  color: var(--rg-color-primary-foreground, #1f2937);
}

.rg-btn:disabled {
  opacity: var(--rg-disabled-opacity, 0.5);
  cursor: default;
}

.rg-btn--primary {
  background: var(--rg-color-primary, #f59e0b);
  border-color: var(--rg-color-primary, #f59e0b);
  color: var(--rg-color-primary-foreground, #1f2937);
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-btn--primary:hover {
  opacity: 0.9;
}

.rg-btn--active {
  border-color: var(--rg-color-primary, #f59e0b);
  color: var(--rg-color-primary, #f59e0b);
}

.rg-feedback {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-feedback--ok {
  color: var(--rg-color-success, #4ade80);
}

.rg-feedback--error {
  color: var(--rg-color-danger, #f87171);
}

@media (max-width: 799px) {
  .rg-play__content {
    grid-template-columns: 1fr;
  }
}
</style>