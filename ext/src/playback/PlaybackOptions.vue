<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { DEFAULT_SETTINGS, DEFAULT_KEYS, RATE_MIN, RATE_MAX, type PlaybackAction, type PlaybackSettings } from './protocol'
const settings = ref<PlaybackSettings>(structuredClone(DEFAULT_SETTINGS))
const message = ref('')
const failed = ref(false)
const busy = ref(false)
const labels: Record<PlaybackAction, string> = {
  slower: 'Ralentir', faster: 'Accélérer', reset: 'Revenir à 1×', favorite: 'Vitesse favorite',
  rewind: 'Reculer de 10 secondes', forward: 'Avancer de 10 secondes', boost: 'Accélérer pendant l’appui',
  markA: 'Marquer le début A', markB: 'Marquer la fin B', clearLoop: 'Effacer la boucle', suspend: 'Suspendre / réactiver les commandes',
}
onMounted(async () => {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'rg:context' })
    if (result.error) throw new Error(result.error)
    settings.value = structuredClone(result.settings)
  } catch { failed.value = true; message.value = 'Impossible de charger les réglages. Rouvrez les options.' }
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
    if (new Set(keys).size !== keys.length || keys.some(key => existing.includes(key))) throw new Error('Deux actions utilisent le même raccourci. Choisissez des touches distinctes.')
    const result = await chrome.runtime.sendMessage({ action: 'rg:settings', settings: { favorite: settings.value.favorite, step: settings.value.step, keys: settings.value.keys } })
    if (result.error) throw new Error(result.error)
    message.value = 'Réglages de lecture enregistrés.'
  } catch (cause) { failed.value = true; message.value = cause instanceof Error ? cause.message : 'Échec de sauvegarde.' }
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
      Lecture sur tous les sites
    </h2>
    <p class="sg-muted">
      Une vitesse commune pour vos vidéos et audios. Épinglez un onglet depuis le popup pour lui donner sa propre vitesse. Le pin reste actif jusqu’à la fermeture de l’onglet ou au redémarrage du navigateur.
    </p>
    <p class="sg-muted">
      L’accès aux sites permet de contrôler leurs médias HTML5. Vos réglages et marque-pages restent dans ce navigateur. Les pages protégées par Chrome ne sont pas accessibles.
    </p>
    <form
      class="sg-playback-form"
      @submit.prevent="save"
    >
      <label>Vitesse favorite <input
        v-model.number="settings.favorite"
        class="sg-playback-input"
        type="number"
        :min="RATE_MIN"
        :max="RATE_MAX"
        step="0.05"
        required
      ></label>
      <label>Pas des raccourcis <input
        v-model.number="settings.step"
        class="sg-playback-input"
        type="number"
        min="0.05"
        max="1"
        step="0.05"
        required
      ></label>
      <p class="sg-muted">
        Cliquez dans un champ et appuyez sur votre combinaison. Retour arrière efface le raccourci. Les commandes sont ignorées pendant la saisie de texte.
      </p>
      <label
        v-for="(label, action) in labels"
        :key="action"
      >{{ label }}<input
        class="sg-playback-input"
        :value="settings.keys[action]"
        readonly
        placeholder="Désactivé"
        @keydown="recordKey($event, action)"
      ></label>
      <div class="sg-speed-presets">
        <button
          class="sg-button sg-button--primary"
          type="submit"
          :disabled="busy"
        >
          Enregistrer la lecture
        </button>
        <button
          class="sg-button sg-button--secondary"
          type="button"
          @click="settings.keys = { ...DEFAULT_KEYS }"
        >
          Raccourcis par défaut
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
