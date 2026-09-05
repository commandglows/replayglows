<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { DEFAULT_KEYS, type PlaybackView } from '../playback/protocol'
import { MILESTONES, achieved, key, nextLesson, withTimeout, type Milestone } from './state'

const props = defineProps<{ view?: PlaybackView | null; standalone?: boolean }>()
const emit = defineEmits<{ practice: [topic: Milestone]; hidden: [] }>()
const data = ref<Record<string, unknown>>({})
const loaded = ref(false)
const busy = ref(false)
const error = ref('')
const visible = ref(false)
const selected = ref<Milestone>('speed')
const heading = ref<HTMLElement>()
const openOptions = () => chrome.runtime.openOptionsPage()
const titles: Record<Milestone, string> = { speed: 'Trouver votre rythme', pin: 'Garder une vitesse pour cet onglet', loop: 'Répéter un passage', note: 'Enregistrer une idée sur YouTube', opened: 'Retrouver un moment enregistré' }
const icons: Record<Milestone, string> = { speed: '⏱', pin: '📌', loop: '🔁', note: '📝', opened: '↗' }
const completed = computed(() => MILESTONES.filter(id => achieved(data.value, id)).length)
const effectiveKeys = ref({ ...DEFAULT_KEYS })
const playbackKeys = computed(() => props.view?.settings.keys ?? effectiveKeys.value)
const bookmarkKey = computed(() => {
  const value = (data.value.hotkeys as Record<string, unknown> | undefined)?.['add-bookmark']
  return typeof value === 'string' ? value : data.value.hotkeys ? '' : 'ALT+B'
})
const shortcut = (value: string) => value || 'Désactivé dans les réglages'
async function load() {
  try {
    data.value = await withTimeout(chrome.storage.local.get([
      ...MILESTONES.map(key), ...MILESTONES.map(id => key(`skip.${id}`)), key('selected'), key('hidden'), 'hotkeys',
    ]))
    const context = await withTimeout(chrome.runtime.sendMessage({ action: 'rg:context' }))
    if (context.error) throw new Error(context.error)
    effectiveKeys.value = context.settings.keys
    if (!loaded.value) {
      const saved = data.value[key('selected')]
      selected.value = MILESTONES.includes(saved as Milestone) ? saved as Milestone : nextLesson(data.value) ?? 'speed'
      visible.value = props.standalone || data.value[key('hidden')] !== true
    }
    loaded.value = true
    error.value = ''
  } catch { error.value = 'Impossible de lire votre progression. Réessayez ; les commandes restent disponibles.' }
}
async function save(values: Record<string, unknown>) {
  busy.value = true
  try {
    await withTimeout(chrome.storage.local.set(values))
    Object.assign(data.value, values)
    error.value = ''
    return true
  } catch { error.value = 'Progression non enregistrée. Réessayez ; vos marque-pages ne sont pas modifiés.'; return false }
  finally { busy.value = false }
}
async function show() {
  visible.value = true
  await save({ [key('hidden')]: false })
  await nextTick()
  heading.value?.focus()
  heading.value?.scrollIntoView({ block: 'start' })
}
async function hide() {
  if (await save({ [key('hidden')]: true })) { visible.value = false; emit('hidden') }
}
async function select(id: Milestone) {
  selected.value = id
  await save({ [key('selected')]: id })
}
async function skip() {
  if (await save({ [key(`skip.${selected.value}`)]: true })) {
    await select(nextLesson(data.value) ?? 'speed')
    await nextTick(); heading.value?.focus()
  }
}
async function resume() { await save({ [key(`skip.${selected.value}`)]: false }); await nextTick(); heading.value?.focus() }
const onStorage = (_changes: Record<string, chrome.storage.StorageChange>, area: string) => { if (area === 'local') void load() }
onMounted(() => { void load(); chrome.storage.onChanged.addListener(onStorage) })
onUnmounted(() => chrome.storage.onChanged.removeListener(onStorage))
defineExpose({ show })
</script>

<template>
  <section
    v-if="visible || error"
    class="sg-discovery"
    aria-label="Découverte de ReplayGlows"
    :aria-busy="busy"
  >
    <h2
      ref="heading"
      class="sg-section-title"
      tabindex="-1"
    >
      Votre prochain petit pas
    </h2>
    <progress
      v-if="busy"
      aria-label="Enregistrement de la progression"
    />
    <p
      v-if="busy"
      class="sg-muted"
      role="status"
    >
      Enregistrement de votre progression…
    </p>
    <p
      class="sg-muted"
      role="status"
    >
      {{ completed }} / 5 réussites confirmées · à votre rythme
    </p>
    <p
      v-if="error"
      class="sg-playback-error"
      role="alert"
    >
      {{ error }}
    </p>
    <button
      v-if="error"
      class="sg-button"
      type="button"
      @click="load"
    >
      Réessayer
    </button>
    <template v-if="loaded">
      <select
        id="discovery-topic"
        aria-label="Que voulez-vous découvrir ?"
        class="sg-playback-input"
        :value="selected"
        :disabled="busy"
        @change="select(($event.target as HTMLSelectElement).value as Milestone)"
      >
        <option
          v-for="id in MILESTONES"
          :key="id"
          :value="id"
        >
          {{ icons[id] }} {{ titles[id] }}{{ achieved(data, id) ? ' · Réussi' : data[key(`skip.${id}`)] === true ? ' · Pour plus tard' : '' }}
        </option>
      </select>
      <div class="sg-discovery-lesson">
        <p
          v-if="achieved(data, selected)"
          class="sg-discovery-success"
          role="status"
        >
          ✓ Réussite déjà confirmée.
        </p>
        <template v-if="selected === 'speed'">
          <p class="sg-muted">
            Lancez une vidéo ou un audio, puis choisissez une autre vitesse dans le panneau de lecture. Une vitesse commune s’applique à tous les onglets compatibles non épinglés.
          </p>
          <p
            v-if="view && !view.settings.enabled"
            class="sg-muted"
          >
            Les commandes sont suspendues. Réactivez-les dans le panneau de lecture pour essayer.
          </p>
          <p
            v-else-if="view && !view.media?.available"
            class="sg-muted"
          >
            Aucun média détecté ici. Ouvrez un lecteur sur un site web, lancez-le et rouvrez l’extension. Après installation, rechargez d’abord la page.
          </p>
        </template>
        <p
          v-else-if="selected === 'pin'"
          class="sg-muted"
        >
          Cliquez sur « Épingler », puis choisissez une vitesse. Cet onglet sort de la vitesse commune. « Désépingler » lui réapplique la vitesse commune actuelle. Ce choix dure jusqu’à la fermeture de l’onglet ou au redémarrage du navigateur ; il n’épingle pas l’onglet dans Chrome.
        </p>
        <p
          v-else-if="selected === 'loop'"
          class="sg-muted"
        >
          Dans « Répéter un passage », marquez le Début A, avancez dans le lecteur, puis marquez la Fin B. Le passage se répète. « Effacer », changer de vidéo ou sortir du passage arrête cette boucle temporaire. Sur YouTube, deux marque-pages peuvent aussi servir de bornes.
        </p>
        <template v-else-if="selected === 'note'">
          <p class="sg-muted">
            Sur une vidéo YouTube, fermez le popup, cliquez dans le lecteur puis utilisez le raccourci « Ajouter un marque-page ». Écrivez votre idée et enregistrez-la. Rouvrez ensuite l’extension pour la retrouver.
          </p>
          <p class="sg-muted">
            Votre raccourci : <kbd>{{ shortcut(bookmarkKey) }}</kbd>. S’il est désactivé, configurez-le dans les réglages. Les raccourcis ne se déclenchent pas pendant la saisie.
          </p>
        </template>
        <p
          v-else
          class="sg-muted"
        >
          Dans vos marque-pages, cliquez sur le titre accompagné de l’heure. La vidéo s’ouvre dans un nouvel onglet à l’adresse du moment enregistré. La réussite confirme l’ouverture de cet onglet.
        </p>
        <button
          v-if="!standalone"
          class="sg-button sg-button--primary"
          type="button"
          @click="emit('practice', selected)"
        >
          {{ selected === 'note' ? 'Voir mes marque-pages' : selected === 'opened' ? 'Choisir un marque-page' : 'Aller aux commandes' }}
        </button>
        <div class="sg-discovery-actions">
          <button
            v-if="!achieved(data, selected) && data[key(`skip.${selected}`)] !== true"
            class="sg-button"
            type="button"
            :disabled="busy"
            @click="skip"
          >
            Pour plus tard
          </button>
          <button
            v-if="!achieved(data, selected) && data[key(`skip.${selected}`)] === true"
            class="sg-button"
            type="button"
            :disabled="busy"
            @click="resume"
          >
            Reprendre cet exercice
          </button>
          <button
            v-if="achieved(data, selected) && nextLesson(data)"
            class="sg-button"
            type="button"
            :disabled="busy"
            @click="select(nextLesson(data)!)"
          >
            Découvrir la suite
          </button>
        </div>
      </div>
      <details class="sg-help-topic">
        <summary>⚡ Favori, boost et raccourcis</summary>
        <p class="sg-muted">
          « Favori » applique votre vitesse préférée, réglable dans les options. Maintenez le raccourci de boost pour accélérer temporairement ; relâchez-le pour retrouver votre vitesse.
        </p>
        <dl class="sg-shortcuts">
          <template
            v-for="(label, action) in { slower: 'Ralentir', faster: 'Accélérer', reset: 'Revenir à 1×', favorite: 'Vitesse favorite', boost: 'Boost maintenu', rewind: 'Reculer de 10 s', forward: 'Avancer de 10 s', markA: 'Début A', markB: 'Fin B', clearLoop: 'Effacer la boucle', suspend: 'Suspendre / réactiver' }"
            :key="action"
          >
            <dt>{{ label }}</dt><dd><kbd>{{ shortcut(playbackKeys[action]) }}</kbd></dd>
          </template>
        </dl>
        <p class="sg-muted">
          Utilisez les raccourcis dans la page du lecteur, hors des champs de saisie. Vous pouvez les modifier ou les désactiver dans les réglages.
        </p>
      </details>
      <details class="sg-help-topic">
        <summary>🛟 Un lecteur ne répond pas ?</summary>
        <p class="sg-muted">
          Lancez d’abord la vidéo ou l’audio. Après installation ou mise à jour, rechargez la page puis rouvrez le popup. Si Chrome limite l’accès de l’extension à ce site, vérifiez cet accès dans les réglages de l’extension.
        </p>
        <p class="sg-muted">
          Les pages internes de Chrome, les fichiers locaux et certains lecteurs ne sont pas compatibles. Si le site refuse une vitesse, essayez une autre valeur ou utilisez son lecteur. « Suspendre les commandes » désactive le contrôle sur tous les sites ; « Réactiver » le reprend.
        </p>
      </details>
      <details class="sg-help-topic">
        <summary>💾 Garder et transférer vos notes</summary>
        <p class="sg-muted">
          Les notes concernent YouTube et restent dans ce navigateur, sans synchronisation automatique avec l’application ReplayGlows. Exportez une sauvegarde avant de désinstaller l’extension.
        </p>
        <p class="sg-muted">
          Dans les options : JSON télécharge une sauvegarde ; Markdown copie les notes dans le presse-papiers. L’import JSON remplace tous les marque-pages après confirmation : exportez les notes actuelles d’abord. La progression de ce guide n’est pas incluse dans les exports.
        </p>
      </details>
      <div class="sg-discovery-actions">
        <button
          class="sg-button"
          type="button"
          @click="openOptions"
        >
          Ouvrir les réglages
        </button>
        <button
          v-if="!standalone"
          class="sg-button"
          type="button"
          :disabled="busy"
          @click="hide"
        >
          Masquer les conseils
        </button>
      </div>
    </template>
  </section>
</template>
