<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { DEFAULT_SETTINGS, DEFAULT_KEYS, RATE_MIN, RATE_MAX, type PlaybackAction, type PlaybackSettings } from './protocol'
import { useI18n } from '../i18n'
const { t } = useI18n()
const settings = ref<PlaybackSettings>(structuredClone(DEFAULT_SETTINGS))
const message = ref('')
const failed = ref(false)
const busy = ref(false)
const labels: Record<PlaybackAction, () => string> = {
  slower: () => t('slower'), faster: () => t('faster'), reset: () => t('reset'), favorite: () => t('favoriteRate'), rewind: () => t('rewind'), forward: () => t('forward'), boost: () => t('boost'), markA: () => t('markStart'), markB: () => t('markEnd'), clearLoop: () => t('clearLoop'), suspend: () => t('suspend'),
}
onMounted(async () => {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'rg:context' })
    if (result.error) throw new Error(result.error)
    settings.value = structuredClone(result.settings)
  } catch { failed.value = true; message.value = t('settingsLoadError') }
})
function recordKey(event: KeyboardEvent, action: PlaybackAction) {
  if (event.key === 'Tab') return
  event.preventDefault()
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return
  if (['Backspace', 'Delete'].includes(event.key)) { settings.value.keys[action] = ''; return }
  settings.value.keys[action] = [event.ctrlKey && 'CTRL', event.altKey && 'ALT', event.shiftKey && 'SHIFT', event.metaKey && 'META', event.key === ' ' ? 'SPACE' : event.key.toUpperCase()].filter(Boolean).join('+')
}
async function save() {
  busy.value = true; failed.value = false; message.value = ''
  try {
    const keys = Object.values(settings.value.keys).filter(Boolean)
    const bookmarks = await chrome.storage.local.get('hotkeys')
    const existing = Object.values(bookmarks.hotkeys ?? { a: 'ALT+B', b: 'ALT+D', c: 'ALT+Q', d: 'ALT+1', e: 'ALT+2' })
    if (new Set(keys).size !== keys.length || keys.some(key => existing.includes(key))) throw new Error(t('duplicateShortcut'))
    const result = await chrome.runtime.sendMessage({ action: 'rg:settings', settings: { favorite: settings.value.favorite, step: settings.value.step, keys: settings.value.keys } })
    if (result.error) throw new Error(result.error)
    message.value = t('playbackSaved')
  } catch (cause) { failed.value = true; message.value = cause instanceof Error ? cause.message : t('saveError') }
  finally { busy.value = false }
}
</script>

<template>
  <section
    class="sct sg-playback-options"
    aria-labelledby="playback-options-title"
  >
    <h2
      id="playback-options-title"
      class="h2"
    >
      {{ t('playbackEverywhere') }}
    </h2>
    <p class="sg-muted">
      {{ t('playbackIntro') }}
    </p>
    <p class="sg-muted">
      {{ t('accessIntro') }}
    </p>
    <form
      class="sg-playback-form"
      @submit.prevent="save"
    >
      <label>{{ t('favoriteSpeed') }} <input
        v-model.number="settings.favorite"
        class="sg-playback-input"
        type="number"
        :min="RATE_MIN"
        :max="RATE_MAX"
        step="0.05"
        required
      ></label>
      <label>{{ t('shortcutStep') }} <input
        v-model.number="settings.step"
        class="sg-playback-input"
        type="number"
        min="0.05"
        max="1"
        step="0.05"
        required
      ></label>
      <p class="sg-muted">
        {{ t('recordShortcut') }}
      </p>
      <label
        v-for="(label, action) in labels"
        :key="action"
      >{{ label() }}<input
        class="sg-playback-input"
        :value="settings.keys[action]"
        readonly
        :placeholder="t('disabled')"
        @keydown="recordKey($event, action)"
      ></label>
      <div class="sg-speed-presets">
        <button
          class="sg-button sg-button--primary"
          type="submit"
          :disabled="busy"
        >
          {{ t('savePlayback') }}
        </button>
        <button
          class="sg-button sg-button--secondary"
          type="button"
          @click="settings.keys = { ...DEFAULT_KEYS }"
        >
          {{ t('defaultShortcuts') }}
        </button>
      </div>
      <p
        v-if="message"
        :class="failed ? 'sg-playback-error' : 'sg-muted'"
        :role="failed ? 'alert' : 'status'"
      >
        {{ message }}
      </p>
    </form>
  </section>
</template>
