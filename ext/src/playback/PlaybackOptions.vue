<script setup lang="ts">
import EraserIcon from '../components/EraserIcon.vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { DEFAULT_SETTINGS, DEFAULT_KEYS, RATE_MIN, RATE_MAX, type PlaybackAction, type PlaybackSettings } from './protocol'
import { useI18n } from '../i18n'
const { t, locale } = useI18n()
const lt = (fr: string, en: string) => locale.value === 'fr' ? fr : en
const settings = ref<PlaybackSettings>(structuredClone(DEFAULT_SETTINGS))
const message = ref('')
const failed = ref(false)
const ready = ref(false)
const form = ref<HTMLFormElement | null>(null)
const shortcutsForm = ref<HTMLFormElement | null>(null)
let pendingSave = Promise.resolve()
let revision = 0
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => clearTimeout(feedbackTimer))
const labels: Record<PlaybackAction, () => string> = {
  slower: () => t('slower'), faster: () => t('faster'), reset: () => t('reset'), favorite: () => t('favoriteRate'), rewind: () => t('rewind'), forward: () => t('forward'), boost: () => t('boost'), markA: () => t('markStart'), markB: () => t('markEnd'), clearLoop: () => t('clearLoop'), suspend: () => t('suspend'),
}
const shortcutGroups: { fr: string; en: string; actions: PlaybackAction[] }[] = [
  { fr: 'Vitesse', en: 'Speed', actions: ['slower', 'faster', 'reset', 'favorite', 'boost'] },
  { fr: 'Déplacement', en: 'Seeking', actions: ['rewind', 'forward'] },
  { fr: 'Boucle A–B', en: 'A–B loop', actions: ['markA', 'markB', 'clearLoop'] },
  { fr: 'Commandes', en: 'Controls', actions: ['suspend'] },
]
onMounted(async () => {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'rg:context' })
    if (result.error) throw new Error(result.error)
    settings.value = structuredClone(result.settings)
    ready.value = true
  } catch { failed.value = true; message.value = t('settingsLoadError') }
})
function clearShortcut(action: PlaybackAction) {
  settings.value.keys = { ...settings.value.keys, [action]: '' }
  save()
}
function recordKey(event: KeyboardEvent, action: PlaybackAction) {
  if (event.key === 'Tab') return
  if (event.key === 'Escape') { (event.target as HTMLInputElement).blur(); return }
  event.preventDefault()
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return
  if (['Backspace', 'Delete'].includes(event.key)) { clearShortcut(action); return }
  settings.value.keys[action] = [event.ctrlKey && 'CTRL', event.altKey && 'ALT', event.shiftKey && 'SHIFT', event.metaKey && 'META', event.key === ' ' ? 'SPACE' : event.key.toUpperCase()].filter(Boolean).join('+')
  save()
}
function save() {
  if (!ready.value || !form.value?.reportValidity() || !shortcutsForm.value?.reportValidity()) return
  const snapshot = JSON.parse(JSON.stringify(settings.value)) as PlaybackSettings
  const current = ++revision
  clearTimeout(feedbackTimer)
  failed.value = false
  message.value = ''
  pendingSave = pendingSave.then(async () => {
    try {
      const canonical = (key: string) => {
        const parts = key.toUpperCase().split('+')
        return [...parts.slice(0, -1).sort(), parts.at(-1)].join('+')
      }
      const keys = Object.values(snapshot.keys).filter(Boolean).map(canonical)
      const bookmarks = await chrome.storage.local.get('hotkeys')
      const existing = (Object.values(bookmarks.hotkeys ?? { a: 'ALT+B', b: 'ALT+D', c: 'ALT+Q', d: 'ALT+1', e: 'ALT+2' }) as string[]).filter(Boolean).map(canonical)
      if (new Set(keys).size !== keys.length || keys.some(key => existing.includes(key))) throw new Error(t('duplicateShortcut'))
      const result = await chrome.runtime.sendMessage({ action: 'rg:settings', settings: { videoHoverSplits: snapshot.videoHoverSplits, altSeekOnSpeedBar: snapshot.altSeekOnSpeedBar, attachPointerToSpeedBar: snapshot.attachPointerToSpeedBar, favorite: snapshot.favorite, step: snapshot.step, keys: snapshot.keys } })
      if (result.error) throw new Error(result.error)
      if (current === revision) {
        message.value = t('playbackSaved')
        feedbackTimer = setTimeout(() => { if (current === revision) message.value = '' }, 2000)
      }
    } catch (cause) {
      if (current === revision) {
        failed.value = true
        message.value = cause instanceof Error ? cause.message : t('saveError')
      }
    }
  })
}

</script>

<template>
  <div class="sg-options-grid">
    <div class="sg-options-column">
      <h2 class="h2">
        {{ lt('Lecture et affichage', 'Playback and display') }}
      </h2>
      <form
        ref="form"
        class="sct sg-playback-form"
        @change="save"
        @submit.prevent="save"
      >
        <h3 class="h2">
          {{ lt('Lecture', 'Playback') }}
        </h3>
        <fieldset
          :disabled="!ready"
          class="sg-playback-fields"
        >
          <label class="lbl">
            <span class="t">{{ t('favoriteSpeed') }}</span>
            <input
              v-model.number="settings.favorite"
              class="inp sg-options-number"
              type="number"
              :min="RATE_MIN"
              :max="RATE_MAX"
              step="0.05"
              required
            >
          </label>
          <label class="lbl sg-options-toggle">
            <span class="sg-options-label-copy"><span class="t">{{ t('videoHoverSplits') }}</span><span
              id="video-splits-help"
              class="sg-muted"
            >{{ lt('Volume, luminosité, vitesse et position à la molette.', 'Adjust volume, brightness, speed and position with the scroll wheel.') }}</span></span>
            <input
              v-model="settings.videoHoverSplits"
              class="sg-option-checkbox"
              type="checkbox"
              aria-describedby="video-splits-help"
            >
          </label>
          <label class="lbl sg-options-toggle">
            <span class="sg-options-label-copy"><span class="t">{{ t('attachPointerToSpeedBar') }}</span><span
              id="speedbar-pointer-help"
              class="sg-muted"
            >{{ lt('Réglez la vitesse au survol du curseur sur YouTube.', 'Adjust speed by hovering over the slider on YouTube.') }}</span></span>
            <input
              v-model="settings.attachPointerToSpeedBar"
              class="sg-option-checkbox"
              type="checkbox"
              aria-describedby="speedbar-pointer-help"
            >
          </label>
          <label class="lbl sg-options-toggle">
            <span class="sg-options-label-copy"><span class="t">{{ t('altSeekOnSpeedBar') }}</span><span
              id="speedbar-alt-help"
              class="sg-muted"
            >{{ lt('Nécessite l’attachement du pointeur ci-dessus.', 'Requires pointer attachment above.') }}</span></span>
            <input
              v-model="settings.altSeekOnSpeedBar"
              class="sg-option-checkbox"
              type="checkbox"
              aria-describedby="speedbar-alt-help"
            >
          </label>
        </fieldset>
      </form>
      <slot name="appearance" />
    </div>

    <div class="sg-options-column">
      <h2 class="h2">
        {{ lt('Raccourcis de lecture', 'Playback shortcuts') }}
      </h2>
      <form
        ref="shortcutsForm"
        class="sct sg-playback-form"
        @change="save"
        @submit.prevent="save"
      >
        <p class="sg-muted">
          {{ lt('Cliquez dans un champ, puis pressez votre combinaison.', 'Click a field, then press your key combination.') }}
        </p>
        <fieldset
          :disabled="!ready"
          class="sg-playback-fields"
        >
          <section
            v-for="group in shortcutGroups"
            :key="group.en"
            class="sg-options-shortcut-group"
            :aria-label="lt(group.fr, group.en)"
          >
            <h3 class="h2">
              {{ lt(group.fr, group.en) }}
            </h3>
            <label
              v-if="group.en === 'Speed'"
              class="lbl"
            >
              <span class="t">{{ t('shortcutStep') }}</span>
              <input
                v-model.number="settings.step"
                class="inp sg-options-number"
                type="number"
                min="0.05"
                max="1"
                step="0.05"
                required
              >
            </label>
            <div class="cont flex-col">
              <div
                v-for="action in group.actions"
                :key="action"
                class="lbl hotkey-input"
              >
                <label
                  :for="`playback-shortcut-${action}`"
                  class="t"
                >{{ labels[action]() }}</label>
                <span class="sg-hotkey-controls">
                  <input
                    :id="`playback-shortcut-${action}`"
                    class="inp"
                    :value="settings.keys[action]"
                    readonly
                    @keydown="recordKey($event, action)"
                  >
                  <button
                    class="sg-button sg-button--secondary sg-hotkey-clear"
                    type="button"
                    :aria-label="t('clearShortcut', { action: labels[action]() })"
                    :title="t('clearShortcut', { action: labels[action]() })"
                    @click="clearShortcut(action)"
                  ><EraserIcon /></button>
                </span>
              </div>
            </div>
          </section>
          <button
            class="sg-button sg-button--secondary"
            type="button"
            @click="settings.keys = { ...DEFAULT_KEYS }; save()"
          >
            {{ t('defaultShortcuts') }}
          </button>
        </fieldset>
      </form>
    </div>

    <div class="sg-options-column">
      <h2 class="h2">
        {{ lt('Marque-pages et données', 'Bookmarks and data') }}
      </h2>
      <slot />
    </div>
  </div>
  <p
    v-if="message"
    :class="['sg-toast', failed ? 'sg-toast--error' : 'sg-toast--info']"
    :role="failed ? 'alert' : 'status'"
  >
    {{ message }}
  </p>
</template>
