<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { DEFAULT_KEYS, type PlaybackView } from '../playback/protocol'
import { MILESTONES, achieved, key, nextLesson, withTimeout, type Milestone } from './state'
import { useI18n } from '../i18n'
const { locale, t } = useI18n()

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
const titles = computed<Record<Milestone, string>>(() => locale.value === 'fr'
  ? { speed: 'Trouver votre rythme', pin: 'Garder une vitesse pour cet onglet', loop: 'Répéter un passage', note: 'Enregistrer une idée sur YouTube', opened: 'Retrouver un moment enregistré' }
  : { speed: 'Find your pace', pin: 'Keep a speed for this tab', loop: 'Repeat a passage', note: 'Save an idea on YouTube', opened: 'Return to a saved moment' })
const copy = computed(() => locale.value === 'fr' ? {
  aria: 'Découverte de ReplayGlows', next: 'Votre prochain petit pas', saving: 'Enregistrement de votre progression…', progress: 'réussites confirmées · à votre rythme', choose: 'Que voulez-vous découvrir ?', success: 'Réussi', later: 'Pour plus tard', confirmed: '✓ Réussite déjà confirmée.', speed: 'Lancez une vidéo ou un audio, puis choisissez une autre vitesse dans le panneau de lecture. Une vitesse commune s’applique à tous les onglets compatibles non épinglés.', suspended: 'Les commandes sont suspendues. Réactivez-les dans le panneau de lecture pour essayer.', noMedia: 'Aucun média détecté ici. Ouvrez un lecteur sur un site web, lancez-le et rouvrez l’extension. Après installation, rechargez d’abord la page.', pin: 'Cliquez sur « Épingler », puis choisissez une vitesse. Cet onglet sort de la vitesse commune. « Désépingler » lui réapplique la vitesse commune actuelle. Ce choix dure jusqu’à la fermeture de l’onglet ou au redémarrage du navigateur ; il n’épingle pas l’onglet dans Chrome.', loop: 'Dans « Répéter un passage », marquez le Début A, avancez dans le lecteur, puis marquez la Fin B. Le passage se répète. « Effacer », changer de vidéo ou sortir du passage arrête cette boucle temporaire. Sur YouTube, deux marque-pages peuvent aussi servir de bornes.', note: 'Sur une vidéo YouTube, fermez le popup, cliquez dans le lecteur puis utilisez le raccourci « Ajouter un marque-page ». Écrivez votre idée et enregistrez-la. Rouvrez ensuite l’extension pour la retrouver.', shortcut: 'Votre raccourci', shortcutEnd: 'S’il est désactivé, configurez-le dans les réglages. Les raccourcis ne se déclenchent pas pendant la saisie.', opened: 'Dans vos marque-pages, cliquez sur le titre accompagné de l’heure. La vidéo s’ouvre dans un nouvel onglet à l’adresse du moment enregistré. La réussite confirme l’ouverture de cet onglet.', myBookmarks: 'Voir mes marque-pages', chooseBookmark: 'Choisir un marque-page', controls: 'Aller aux commandes', resume: 'Reprendre cet exercice', nextLesson: 'Découvrir la suite', expert: '⚡ Favori, boost et raccourcis', expertBody: '« Favori » applique votre vitesse préférée, réglable dans les options. Maintenez le raccourci de boost pour accélérer temporairement ; relâchez-le pour retrouver votre vitesse.', shortcutHelp: 'Utilisez les raccourcis dans la page du lecteur, hors des champs de saisie. Vous pouvez les modifier ou les désactiver dans les réglages.', recovery: '🛟 Un lecteur ne répond pas ?', recoveryBody: 'Lancez d’abord la vidéo ou l’audio. Après installation ou mise à jour, rechargez la page puis rouvrez le popup. Si Chrome limite l’accès de l’extension à ce site, vérifiez cet accès dans les réglages de l’extension.', recoveryLimits: 'Les pages internes de Chrome, les fichiers locaux et certains lecteurs ne sont pas compatibles. Si le site refuse une vitesse, essayez une autre valeur ou utilisez son lecteur. « Suspendre les commandes » désactive le contrôle sur tous les sites ; « Réactiver » le reprend.', data: '💾 Garder et transférer vos notes', dataBody: 'Les notes concernent YouTube et restent dans ce navigateur, sans synchronisation automatique avec l’application ReplayGlows. Exportez une sauvegarde avant de désinstaller l’extension.', dataExport: 'Dans les options : JSON télécharge une sauvegarde ; Markdown copie les notes dans le presse-papiers. L’import JSON remplace tous les marque-pages après confirmation : exportez les notes actuelles d’abord. La progression de ce guide n’est pas incluse dans les exports.', hide: 'Masquer les conseils', openSettings: 'Ouvrir les réglages'
} : {
  aria: 'Discover ReplayGlows', next: 'Your next small step', saving: 'Saving your progress…', progress: 'confirmed achievements · at your own pace', choose: 'What would you like to discover?', success: 'Completed', later: 'For later', confirmed: '✓ Achievement already confirmed.', speed: 'Start a video or audio file, then choose another speed in the playback panel. One shared speed applies to all compatible unpinned tabs.', suspended: 'Controls are paused. Reactivate them in the playback panel to try this.', noMedia: 'No media detected here. Open a player on a website, start it, and reopen the extension. Reload the page first after installation.', pin: 'Click “Pin”, then choose a speed. This tab leaves the shared speed. “Unpin” applies the current shared speed again. This lasts until the tab or browser closes; it does not pin the tab in Chrome.', loop: 'Under “Repeat a passage”, mark Start A, move forward in the player, then mark End B. The passage repeats. Clearing it, changing video, or moving outside it stops this temporary loop. On YouTube, two bookmarks can also define its bounds.', note: 'On a YouTube video, close the popup, click the player, then use the “Add a bookmark” shortcut. Write and save your idea, then reopen the extension to find it.', shortcut: 'Your shortcut', shortcutEnd: 'If it is disabled, configure it in Settings. Shortcuts do not trigger while typing.', opened: 'In your bookmarks, click the title and time. The video opens in a new tab at the saved moment. The achievement confirms that the tab opened.', myBookmarks: 'View my bookmarks', chooseBookmark: 'Choose a bookmark', controls: 'Go to controls', resume: 'Resume this exercise', nextLesson: 'Discover the next step', expert: '⚡ Favorite, boost, and shortcuts', expertBody: '“Favorite” applies your preferred speed, configured in Settings. Hold the boost shortcut to speed up temporarily; release it to return to your speed.', shortcutHelp: 'Use shortcuts on the player page, outside text fields. You can change or disable them in Settings.', recovery: '🛟 Player not responding?', recoveryBody: 'Start the video or audio first. After installing or updating, reload the page and reopen the popup. If Chrome limits extension access to this site, check site access in the extension settings.', recoveryLimits: 'Chrome internal pages, local files, and some players are not compatible. If a site refuses a speed, try another value or use its player. “Pause controls” disables control on every site; “Reactivate” resumes it.', data: '💾 Keep and transfer your notes', dataBody: 'Notes are for YouTube and stay in this browser, without automatic synchronization with the ReplayGlows app. Export a backup before uninstalling the extension.', dataExport: 'In Settings, JSON downloads a backup and Markdown copies notes to the clipboard. JSON import replaces every bookmark after confirmation, so export current notes first. Guide progress is not included in exports.', hide: 'Hide tips', openSettings: 'Open settings'
})
const icons: Record<Milestone, string> = { speed: '⏱', pin: '📌', loop: '🔁', note: '📝', opened: '↗' }
const completed = computed(() => MILESTONES.filter(id => achieved(data.value, id)).length)
const effectiveKeys = ref({ ...DEFAULT_KEYS })
const playbackKeys = computed(() => props.view?.settings.keys ?? effectiveKeys.value)
const shortcutLabels = computed(() => ({ slower: t('slower'), faster: t('faster'), reset: t('reset'), favorite: t('favoriteRate'), boost: t('boost'), rewind: t('rewind'), forward: t('forward'), markA: t('markA'), markB: t('markB'), clearLoop: t('clearLoop'), suspend: t('suspend') }))
const bookmarkKey = computed(() => {
  const value = (data.value.hotkeys as Record<string, unknown> | undefined)?.['add-bookmark']
  return typeof value === 'string' ? value : data.value.hotkeys ? '' : 'ALT+B'
})
const shortcut = (value: string) => value || t('disabled')
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
  } catch { error.value = locale.value === 'fr' ? 'Impossible de lire votre progression. Réessayez ; les commandes restent disponibles.' : 'Unable to read your progress. Try again; controls remain available.' }
}
async function save(values: Record<string, unknown>) {
  busy.value = true
  try {
    await withTimeout(chrome.storage.local.set(values))
    Object.assign(data.value, values)
    error.value = ''
    return true
  } catch { error.value = locale.value === 'fr' ? 'Progression non enregistrée. Réessayez ; vos marque-pages ne sont pas modifiés.' : 'Progress was not saved. Try again; your bookmarks were not changed.'; return false }
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
    :aria-label="copy.aria"
    :aria-busy="busy"
  >
    <h2
      ref="heading"
      class="sg-section-title"
      tabindex="-1"
    >
      {{ copy.next }}
    </h2>
    <progress
      v-if="busy"
      :aria-label="copy.saving"
    />
    <p
      v-if="busy"
      class="sg-muted"
      role="status"
    >
      {{ copy.saving }}
    </p>
    <p
      class="sg-muted"
      role="status"
    >
      {{ completed }} / 5 {{ copy.progress }}
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
      {{ locale === 'fr' ? 'Réessayer' : 'Try again' }}
    </button>
    <template v-if="loaded">
      <select
        id="discovery-topic"
        :aria-label="copy.choose"
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
          {{ icons[id] }} {{ titles[id] }}{{ achieved(data, id) ? ` · ${copy.success}` : data[key(`skip.${id}`)] === true ? ` · ${copy.later}` : '' }}
        </option>
      </select>
      <div class="sg-discovery-lesson">
        <p
          v-if="achieved(data, selected)"
          class="sg-discovery-success"
          role="status"
        >
          {{ copy.confirmed }}
        </p>
        <template v-if="selected === 'speed'">
          <p class="sg-muted">
            {{ copy.speed }}
          </p>
          <p
            v-if="view && !view.settings.enabled"
            class="sg-muted"
          >
            {{ copy.suspended }}
          </p>
          <p
            v-else-if="view && !view.media?.available"
            class="sg-muted"
          >
            {{ copy.noMedia }}
          </p>
        </template>
        <p
          v-else-if="selected === 'pin'"
          class="sg-muted"
        >
          {{ copy.pin }}
        </p>
        <p
          v-else-if="selected === 'loop'"
          class="sg-muted"
        >
          {{ copy.loop }}
        </p>
        <template v-else-if="selected === 'note'">
          <p class="sg-muted">
            {{ copy.note }}
          </p>
          <p class="sg-muted">
            {{ copy.shortcut }} : <kbd>{{ shortcut(bookmarkKey) }}</kbd>. {{ copy.shortcutEnd }}
          </p>
        </template>
        <p
          v-else
          class="sg-muted"
        >
          {{ copy.opened }}
        </p>
        <button
          v-if="!standalone"
          class="sg-button sg-button--primary"
          type="button"
          @click="emit('practice', selected)"
        >
          {{ selected === 'note' ? copy.myBookmarks : selected === 'opened' ? copy.chooseBookmark : copy.controls }}
        </button>
        <div class="sg-discovery-actions">
          <button
            v-if="!achieved(data, selected) && data[key(`skip.${selected}`)] !== true"
            class="sg-button"
            type="button"
            :disabled="busy"
            @click="skip"
          >
            {{ copy.later }}
          </button>
          <button
            v-if="!achieved(data, selected) && data[key(`skip.${selected}`)] === true"
            class="sg-button"
            type="button"
            :disabled="busy"
            @click="resume"
          >
            {{ copy.resume }}
          </button>
          <button
            v-if="achieved(data, selected) && nextLesson(data)"
            class="sg-button"
            type="button"
            :disabled="busy"
            @click="select(nextLesson(data)!)"
          >
            {{ copy.nextLesson }}
          </button>
        </div>
      </div>
      <details class="sg-help-topic">
        <summary>{{ copy.expert }}</summary>
        <p class="sg-muted">
          {{ copy.expertBody }}
        </p>
        <dl class="sg-shortcuts">
          <template
            v-for="(label, action) in shortcutLabels"
            :key="action"
          >
            <dt>{{ label }}</dt><dd><kbd>{{ shortcut(playbackKeys[action]) }}</kbd></dd>
          </template>
        </dl>
        <p class="sg-muted">
          {{ copy.shortcutHelp }}
        </p>
      </details>
      <details class="sg-help-topic">
        <summary>{{ copy.recovery }}</summary>
        <p class="sg-muted">
          {{ copy.recoveryBody }}
        </p>
        <p class="sg-muted">
          {{ copy.recoveryLimits }}
        </p>
      </details>
      <details class="sg-help-topic">
        <summary>{{ copy.data }}</summary>
        <p class="sg-muted">
          {{ copy.dataBody }}
        </p>
        <p class="sg-muted">
          {{ copy.dataExport }}
        </p>
      </details>
      <div class="sg-discovery-actions">
        <button
          class="sg-button"
          type="button"
          @click="openOptions"
        >
          {{ copy.openSettings }}
        </button>
        <button
          v-if="!standalone"
          class="sg-button"
          type="button"
          :disabled="busy"
          @click="hide"
        >
          {{ copy.hide }}
        </button>
      </div>
    </template>
  </section>
</template>
