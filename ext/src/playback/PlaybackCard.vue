<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Bookmark } from '../bookmarks'
import { RATE_MIN, RATE_MAX, type PlaybackView } from './protocol'
import { confirmsSpeed, recordAchievement, withTimeout, type Milestone } from '../discovery/state'

const props = defineProps<{ bookmarks: Bookmark[] }>()
const emit = defineEmits<{ view: [value: PlaybackView] }>()
const controls = ref<HTMLElement>()
const review = ref<HTMLDetailsElement>()
const notice = ref('')
async function complete(id: Milestone) {
  try { await recordAchievement(id) }
  catch { notice.value = 'Action réussie, mais progression du guide non enregistrée. Pour la vitesse, essayez une autre valeur ; les autres étapes seront revérifiées automatiquement.' }
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
  } catch { if (!disposed) error.value = 'Connexion interrompue. Rechargez la page puis rouvrez ce panneau.' }
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
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'La commande a échoué.' }
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
        notice.value = `Vitesse appliquée : ${next}×.`
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
  } catch { error.value = 'Onglet indisponible.'; loading.value = false }
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
          Vitesse de lecture
        </h2>
        <span
          v-if="view"
          class="sg-scope-label"
        >{{ view.pinned ? 'Épinglé · cet onglet' : 'Global · onglets non épinglés' }}</span>
      </div>
      <button
        v-if="view"
        class="sg-button sg-button--secondary"
        type="button"
        :aria-pressed="view.pinned"
        :title="view.pinned ? 'Reprendre la vitesse commune actuelle' : 'Exclure cet onglet de la vitesse commune pour choisir sa propre vitesse'"
        :disabled="pending || !media?.available"
        @click="act('rg:pin', { pinned: !view.pinned })"
      >
        {{ view.pinned ? 'Désépingler' : 'Épingler' }}
      </button>
      <button
        class="sg-button sg-button--secondary"
        type="button"
        aria-label="Réglages de lecture"
        @click="openOptions"
      >
        Réglages
      </button>
    </div>
    <progress
      v-if="pending || loading"
      aria-label="Vérification du lecteur"
    />
    <template v-if="view">
      <p class="sg-speed-value">
        <output aria-label="Vitesse actuelle">{{ (media?.available ? media.rate : view.rate).toFixed(2) }}×</output>
      </p>
      <input
        class="sg-speed-slider"
        type="range"
        aria-label="Vitesse de lecture"
        :min="RATE_MIN"
        :max="RATE_MAX"
        step="0.05"
        :value="previewRate ?? (media?.available ? media.rate : view.rate)"
        :disabled="!active || (pending && !changingRate)"
        @input="changeRate(Number(($event.target as HTMLInputElement).value))"
      >
      <div
        class="sg-speed-presets"
        aria-label="Vitesses prédéfinies"
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
          Favori
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
        Aucun média accessible. Lancez une vidéo ou un audio sur un site web. Après installation, rechargez la page. Certaines pages protégées par Chrome sont exclues.
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
        Vérifier à nouveau
      </button>
      <details
        ref="review"
        class="sg-review-controls"
      >
        <summary>{{ !view.settings.enabled ? 'Commandes suspendues · options' : media?.loop?.b != null ? 'Boucle A–B active · options' : 'Répéter un passage · boucle A–B' }}</summary>
        <p
          v-if="media?.available"
          class="sg-media-title sg-muted"
          :title="media.title"
        >
          {{ media.kind === 'audio' ? 'Audio' : 'Vidéo' }} · {{ media.title || 'Média de cet onglet' }}
        </p>
        <div class="sg-speed-presets">
          <button
            class="sg-button sg-button--secondary"
            type="button"
            :disabled="!active || pending"
            @click="command('markA')"
          >
            Début A
          </button>
          <button
            class="sg-button sg-button--secondary"
            type="button"
            :disabled="!active || pending || !media?.loop"
            @click="command('markB')"
          >
            Fin B
          </button>
          <button
            class="sg-button sg-button--secondary"
            type="button"
            :disabled="!media?.loop || pending"
            @click="command('clearLoop')"
          >
            Effacer
          </button>
        </div>
        <p
          class="sg-muted"
          role="status"
        >
          {{ media?.loop ? `A ${formatTime(media.loop.a)} → ${media.loop.b === null ? 'Choisissez la fin B' : `B ${formatTime(media.loop.b)} · répétition active`}` : 'Marquez le début, avancez à la fin puis marquez B.' }}
        </p>
        <form
          v-if="currentBookmarks.length >= 2"
          class="sg-loop-bookmarks"
          @submit.prevent="command('loopRange', { a: Number(a), b: Number(b) })"
        >
          <label>Début <select
            v-model="a"
            required
            class="sg-playback-input"
          ><option
            value=""
            disabled
          >Marque-page A</option><option
            v-for="item in currentBookmarks"
            :key="item.time"
            :value="String(item.time)"
          >{{ item.formattedTime }} · {{ item.note || 'Sans note' }}</option></select></label>
          <label>Fin <select
            v-model="b"
            required
            class="sg-playback-input"
          ><option
            value=""
            disabled
          >Marque-page B</option><option
            v-for="item in currentBookmarks"
            :key="item.time"
            :value="String(item.time)"
          >{{ item.formattedTime }} · {{ item.note || 'Sans note' }}</option></select></label>
          <button
            class="sg-button sg-button--primary"
            type="submit"
            :disabled="!active || pending || a === '' || b === '' || Number(b) <= Number(a)"
          >
            Répéter entre ces marque-pages
          </button>
        </form>
        <button
          class="sg-suspend-button"
          type="button"
          :disabled="pending"
          @click="act('rg:settings', { settings: { enabled: !view.settings.enabled } })"
        >
          {{ view.settings.enabled ? 'Suspendre les commandes sur tous les sites' : 'Commandes suspendues · réactiver' }}
        </button>
      </details>
    </template>
    <p
      v-else
      class="sg-muted"
      role="status"
    >
      {{ error || 'Recherche du média…' }}
    </p>
  </section>
</template>
