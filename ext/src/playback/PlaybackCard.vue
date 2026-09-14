<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Bookmark } from '../bookmarks'
import { RATE_MIN, RATE_MAX, type PlaybackView } from './protocol'
import { confirmsSpeed, recordAchievement, withTimeout, type Milestone } from '../discovery/state'
import { useI18n } from '../i18n'
const { t } = useI18n()

const props = defineProps<{ bookmarks: Bookmark[] }>()
const emit = defineEmits<{ view: [value: PlaybackView] }>()
const controls = ref<HTMLElement>()
const review = ref<HTMLDetailsElement>()
const notice = ref('')
async function complete(id: Milestone) {
  try { await recordAchievement(id) }
  catch { notice.value = t('guideProgressError') }
}
function focusControls(loop: boolean) {
  if (loop && review.value) review.value.open = true
  const target = loop ? review.value?.querySelector('summary') : controls.value?.querySelector<HTMLInputElement>('input')
  target?.focus()
  target?.scrollIntoView({ block: 'nearest' })
}
const closeReview = () => { if (review.value) review.value.open = false }
defineExpose({ focusControls, closeReview })
const view = ref<PlaybackView | null>(null)
const tabId = ref<number>()
const tabUrl = ref('')
const error = ref('')
const pending = ref(false)
const loading = ref(true)
const previewRate = ref<number | null>(null)
const openOptions = () => chrome.runtime.openOptionsPage()
const a = ref('')
const b = ref('')
let timer: ReturnType<typeof setInterval> | undefined
let fetching = false
let fetchDone: Promise<void> = Promise.resolve()
let disposed = false
const media = computed(() => view.value?.media)
const active = computed(() => Boolean(media.value?.available && view.value?.settings.enabled))
const currentBookmarks = computed(() => props.bookmarks.filter(item => {
  try {
    const current = new URL(tabUrl.value)
    return current.hostname === 'www.youtube.com' && new URL(item.url).searchParams.get('v') === current.searchParams.get('v')
  } catch { return false }
}))
const formatTime = (time: number) => `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`
async function refresh(afterCommand = false) {
  if (fetching) { await fetchDone; if (!afterCommand) return }
  if (pending.value || tabId.value === undefined || disposed) return
  fetching = true
  let finish!: () => void
  fetchDone = new Promise(resolve => { finish = resolve })
  try {
    const tab = await withTimeout(chrome.tabs.get(tabId.value))
    if ((tab.url ?? '') !== tabUrl.value) { tabUrl.value = tab.url ?? ''; a.value = ''; b.value = '' }
    const result = await withTimeout(chrome.runtime.sendMessage({ action: 'rg:get', tabId: tabId.value }))
    if (result.error) throw new Error(result.error)
    if (!disposed && !pending.value) {
      view.value = result
      emit('view', result)
      error.value = ''
      if (result.pinned && result.media?.available) await complete('pin')
      if (result.media?.available && !result.media.error && result.media.loop?.b != null) await complete('loop')
    }
  } catch { if (!disposed) error.value = t('connectionInterrupted') }
  finally { fetching = false; loading.value = false; finish() }
}
async function act(action: string, values: Record<string, unknown> = {}) {
  if (pending.value || tabId.value === undefined) return
  pending.value = true
  error.value = ''
  let succeeded = false
  try {
    const result = await withTimeout(chrome.runtime.sendMessage({ action, tabId: tabId.value, ...values }))
    if (result.error) throw new Error(result.error)
    succeeded = true
  } catch (cause) { error.value = cause instanceof Error ? cause.message : t('commandFailed') }
  finally {
    const commandError = error.value
    pending.value = false
    await refresh(true)
    if (commandError) error.value = commandError
  }
  return succeeded
}
let queuedRate: number | null = null
const changingRate = ref(false)
async function changeRate(rate: number) {
  previewRate.value = rate
  queuedRate = rate
  if (changingRate.value) return
  changingRate.value = true
  try {
    while (queuedRate !== null) {
      const next = queuedRate
      queuedRate = null
      const before = media.value?.rate
      const urlBefore = tabUrl.value
      const succeeded = await act('rg:rate', { rate: next })
      if (succeeded && !error.value && tabUrl.value === urlBefore && confirmsSpeed(before, next, media.value)) {
        notice.value = t('speedApplied', { rate: next })
        await complete('speed')
      }
    }
  } finally { changingRate.value = false; previewRate.value = null }
}
const command = (command: string, values: Record<string, unknown> = {}) => act('rg:command', { command, ...values })
onMounted(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    tabId.value = tab?.id
    tabUrl.value = tab?.url ?? ''
    if (tabId.value === undefined) throw new Error()
    await refresh()
    if (!disposed) timer = setInterval(() => void refresh(), 800)
  } catch { error.value = t('tabUnavailable'); loading.value = false }
})
onUnmounted(() => { disposed = true; clearInterval(timer) })
</script>

<template>
  <section
    ref="controls"
    class="sg-speed-card"
    aria-labelledby="speed-title"
    :aria-busy="pending || loading"
  >
    <div class="sg-speed-heading">
      <div>
        <h2
          id="speed-title"
          class="sg-section-title"
        >
          {{ t('playbackTitle') }}
        </h2>
        <span
          v-if="view"
          class="sg-scope-label"
        >{{ view.pinned ? t('pinnedScope') : t('globalScope') }}</span>
      </div>
      <button
        v-if="view"
        class="sg-button sg-button--secondary"
        type="button"
        :aria-pressed="view.pinned"
        :title="view.pinned ? t('unpin') : t('pin')"
        :disabled="pending || !media?.available"
        @click="act('rg:pin', { pinned: !view.pinned })"
      >
        {{ view.pinned ? t('unpin') : t('pin') }}
      </button>
      <button
        class="sg-button sg-button--secondary"
        type="button"
        :aria-label="t('playbackSettings')"
        @click="openOptions"
      >
        {{ t('settings') }}
      </button>
    </div>
    <progress
      v-if="pending || loading"
      :aria-label="t('checkPlayer')"
    />
    <template v-if="view">
      <p class="sg-speed-value">
        <output :aria-label="t('currentSpeed')">{{ (media?.available ? media.rate : view.rate).toFixed(2) }}×</output>
      </p>
      <input
        class="sg-speed-slider"
        type="range"
        :aria-label="t('playbackTitle')"
        :min="RATE_MIN"
        :max="RATE_MAX"
        step="0.05"
        :value="previewRate ?? (media?.available ? media.rate : view.rate)"
        :disabled="!active || (pending && !changingRate)"
        @input="changeRate(Number(($event.target as HTMLInputElement).value))"
      >
      <div
        class="sg-speed-presets"
        :aria-label="t('presets')"
      >
        <button
          v-for="rate in [0.5, 1, 1.5, 2]"
          :key="rate"
          class="sg-button sg-button--secondary"
          type="button"
          :aria-pressed="Math.abs((media?.rate ?? view.rate) - rate) < 0.025"
          :disabled="!active || pending"
          @click="changeRate(rate)"
        >
          {{ rate }}×
        </button>
        <button
          class="sg-button sg-button--secondary"
          type="button"
          :disabled="!active || pending"
          @click="changeRate(view.settings.favorite)"
        >
          {{ t('favorite') }}
        </button>
      </div>
      <p
        v-if="notice"
        class="sg-muted"
        role="status"
      >
        {{ notice }}
      </p>
      <p
        v-if="!media?.available"
        class="sg-muted"
        role="status"
      >
        {{ t('noMedia') }}
      </p>
      <p
        v-if="error || media?.error"
        class="sg-playback-error"
        role="alert"
      >
        {{ error || media?.error }}
      </p>
      <button
        v-if="!media?.available || error || media?.error"
        class="sg-button"
        type="button"
        :disabled="pending || loading"
        @click="refresh()"
      >
        {{ t('retry') }}
      </button>
      <details
        ref="review"
        class="sg-review-controls"
      >
        <summary>{{ !view.settings.enabled ? t('suspendedOptions') : media?.loop?.b != null ? t('loopActiveOptions') : t('repeatSection') }}</summary>
        <p
          v-if="media?.available"
          class="sg-media-title sg-muted"
          :title="media.title"
        >
          {{ media.kind === 'audio' ? t('audio') : t('video') }} · {{ media.title || t('tabMedia') }}
        </p>
        <div class="sg-speed-presets">
          <button
            class="sg-button sg-button--secondary"
            type="button"
            :disabled="!active || pending"
            @click="command('markA')"
          >
            {{ t('markA') }}
          </button>
          <button
            class="sg-button sg-button--secondary"
            type="button"
            :disabled="!active || pending || !media?.loop"
            @click="command('markB')"
          >
            {{ t('markB') }}
          </button>
          <button
            class="sg-button sg-button--secondary"
            type="button"
            :disabled="!media?.loop || pending"
            @click="command('clearLoop')"
          >
            {{ t('clear') }}
          </button>
        </div>
        <p
          class="sg-muted"
          role="status"
        >
          {{ media?.loop ? `A ${formatTime(media.loop.a)} → ${media.loop.b === null ? t('chooseEnd') : `B ${formatTime(media.loop.b)} · ${t('repeatActive')}`}` : t('markInstructions') }}
        </p>
        <form
          v-if="currentBookmarks.length >= 2"
          class="sg-loop-bookmarks"
          @submit.prevent="command('loopRange', { a: Number(a), b: Number(b) })"
        >
          <label>{{ t('start') }} <select
            v-model="a"
            required
            class="sg-playback-input"
          ><option
            value=""
            disabled
          >{{ t('bookmarkA') }}</option><option
            v-for="item in currentBookmarks"
            :key="item.time"
            :value="String(item.time)"
          >{{ item.formattedTime }} · {{ item.note || t('noNote') }}</option></select></label>
          <label>{{ t('end') }} <select
            v-model="b"
            required
            class="sg-playback-input"
          ><option
            value=""
            disabled
          >{{ t('bookmarkB') }}</option><option
            v-for="item in currentBookmarks"
            :key="item.time"
            :value="String(item.time)"
          >{{ item.formattedTime }} · {{ item.note || t('noNote') }}</option></select></label>
          <button
            class="sg-button sg-button--primary"
            type="submit"
            :disabled="!active || pending || a === '' || b === '' || Number(b) <= Number(a)"
          >
            {{ t('repeatBookmarks') }}
          </button>
        </form>
        <button
          class="sg-suspend-button"
          type="button"
          :disabled="pending"
          @click="act('rg:settings', { settings: { enabled: !view.settings.enabled } })"
        >
          {{ view.settings.enabled ? t('suspendAll') : t('reactivate') }}
        </button>
      </details>
    </template>
    <p
      v-else
      class="sg-muted"
      role="status"
    >
      {{ error || t('findingMedia') }}
    </p>
  </section>
</template>
