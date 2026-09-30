<script setup lang="ts">
// Settings screen mirroring the Flutter preferences_screen: appearance,
// notifications, playback, notes, channel sync and transcripts sections, all
// loaded from Convex settings and saved as a full patch with a saved flash.
import { onMounted, ref } from 'vue'
import { useAppI18n } from '@/app/i18n'
import { settingsApi } from '@/app/convex/api'
import type { Settings } from '@/app/convex/types'

const { t } = useAppI18n()

const loading = ref(true)
const failed = ref(false)
const saving = ref(false)
const saved = ref(false)
const saveFailed = ref(false)

const theme = ref<'light' | 'dark' | 'system'>('system')
const language = ref<'en' | 'fr' | 'es' | 'de' | 'pt'>('en')
const emailNotifications = ref(true)
const pushNotifications = ref(true)
const newVideos = ref(true)
const newComments = ref(true)
const newLikes = ref(true)
const transcriptReady = ref(true)
const systemNotifications = ref(true)
const pushCadence = ref('perVideo')
const feedInterval = ref('hourly')
const autoplay = ref(true)
const defaultQuality = ref('auto')
const defaultSpeed = ref(1)
const autoMarkWatched = ref(80)
const autoTimestamp = ref(true)
const notesSort = ref('desc')
const channelAutoSync = ref(true)
const syncInterval = ref(60)
const transcriptLanguage = ref('auto')
const defaultProvider = ref('auto')
const autoYouTubeCaptions = ref(true)
const localFallback = ref(true)

const CANDENCES = ['every30Min', 'everyHour', 'every6Hours', 'daily'] as const
const INTERVALS = ['every30Min', 'everyHour', 'every2Hours', 'every6Hours', 'daily'] as const

onMounted(() => {
  void loadSettings()
})

async function loadSettings(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    const settings = await settingsApi.get()
    applySettings(settings)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

function applySettings(settings: Settings | null): void {
  if (!settings) {
    return
  }
  theme.value = settings.theme ?? 'system'
  language.value = settings.language ?? 'en'
  const notifications = settings.notifications
  if (notifications) {
    emailNotifications.value = notifications.email ?? true
    pushNotifications.value = notifications.push ?? true
    newVideos.value = notifications.newVideos ?? true
    newComments.value = notifications.newComments ?? true
    newLikes.value = notifications.newLikes ?? true
    transcriptReady.value = notifications.transcriptReady ?? true
    systemNotifications.value = notifications.system ?? true
  }
  const playback = settings.playback
  if (playback) {
    autoplay.value = playback.autoplay ?? true
    defaultQuality.value = playback.defaultQuality ?? 'auto'
    defaultSpeed.value = playback.defaultSpeed ?? 1
    if (typeof playback.autoMarkWatchedThreshold === 'number') {
      autoMarkWatched.value = playback.autoMarkWatchedThreshold
    }
  }
  const notes = settings.notes
  if (notes) {
    autoTimestamp.value = notes.defaultTimestamped ?? true
    notesSort.value = notes.sortOrder ?? 'desc'
  }
  const channelSync = settings.channelSync
  if (channelSync) {
    channelAutoSync.value = channelSync.autoSyncOnVisit ?? true
    if (typeof channelSync.syncIntervalMinutes === 'number') {
      syncInterval.value = channelSync.syncIntervalMinutes
    }
  }
  const transcripts = settings.transcripts
  if (transcripts) {
    transcriptLanguage.value = transcripts.defaultLanguage ?? 'auto'
    defaultProvider.value = transcripts.defaultProvider ?? 'auto'
    autoYouTubeCaptions.value = transcripts.autoAttemptYoutubeCaptions ?? true
    localFallback.value = transcripts.autoAttemptLocalFallback ?? true
  }
}

function ringLabelFor(key: 'preferences.every30Min' | 'preferences.everyHour' | 'preferences.every6Hours' | 'preferences.daily'): string {
  return t(key)
}

function intervalLabelFor(key: 'preferences.every30Min' | 'preferences.everyHour' | 'preferences.every2Hours' | 'preferences.every6Hours' | 'preferences.daily'): string {
  return t(key)
}

async function save(): Promise<void> {
  saving.value = true
  saved.value = false
  saveFailed.value = false
  const patch: Partial<Settings> = {
    theme: theme.value,
    language: language.value,
    notifications: {
      email: emailNotifications.value,
      push: pushNotifications.value,
      newVideos: newVideos.value,
      newComments: newComments.value,
      newLikes: newLikes.value,
      transcriptReady: transcriptReady.value,
      system: systemNotifications.value,
    },
    playback: {
      autoplay: autoplay.value,
      defaultQuality: defaultQuality.value,
      defaultSpeed: defaultSpeed.value,
      autoMarkWatchedThreshold: autoMarkWatched.value,
    },
    notes: {
      defaultTimestamped: autoTimestamp.value,
      sortOrder: notesSort.value as 'asc' | 'desc',
    },
    channelSync: {
      autoSyncOnVisit: channelAutoSync.value,
      syncIntervalMinutes: syncInterval.value,
    },
    transcripts: {
      defaultLanguage: transcriptLanguage.value,
      defaultProvider: defaultProvider.value,
      autoAttemptYoutubeCaptions: autoYouTubeCaptions.value,
      autoAttemptLocalFallback: localFallback.value,
    },
  }
  try {
    await settingsApi.updateAll(patch)
    saved.value = true
  } catch {
    saveFailed.value = true
  } finally {
    saving.value = false
  }
}

function retry(): void {
  void loadSettings()
}
</script>

<template>
  <div class="rg-preferences">
    <header class="rg-heading rg-heading--row">
      <h1 class="rg-heading__title">
        {{ t('preferences.title') }}
      </h1>
    </header>

    <p
      v-if="loading"
      class="rg-preferences__state"
    >
      {{ t('common.loading') }}
    </p>

    <div
      v-else-if="failed"
      class="rg-preferences__state rg-preferences__state--error"
    >
      <p class="rg-preferences__state-title">
        {{ t('preferences.loadFailed') }}
      </p>
      <button
        type="button"
        class="rg-btn"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <form
      v-else
      class="rg-preferences__form"
      @submit.prevent="save"
    >
      <section class="rg-preferences__section">
        <h2 class="rg-preferences__section-title">
          {{ t('preferences.sectionAppearance') }}
        </h2>

        <div class="rg-field">
          <span
            class="rg-label"
          >
            {{ t('preferences.theme') }}
          </span>
          <div class="rg-seg">
            <button
              type="button"
              class="rg-seg__btn"
              :class="{ 'rg-seg__btn--active': theme === 'light' }"
              :aria-pressed="theme === 'light'"
              @click="theme = 'light'"
            >
              {{ t('preferences.themeLight') }}
            </button>
            <button
              type="button"
              class="rg-seg__btn"
              :class="{ 'rg-seg__btn--active': theme === 'dark' }"
              :aria-pressed="theme === 'dark'"
              @click="theme = 'dark'"
            >
              {{ t('preferences.themeDark') }}
            </button>
            <button
              type="button"
              class="rg-seg__btn"
              :class="{ 'rg-seg__btn--active': theme === 'system' }"
              :aria-pressed="theme === 'system'"
              @click="theme = 'system'"
            >
              {{ t('preferences.themeSystem') }}
            </button>
          </div>
        </div>

        <div class="rg-field">
          <label
            class="rg-label"
            for="rg-preferences-language"
          >
            {{ t('preferences.language') }}
          </label>
          <select
            id="rg-preferences-language"
            v-model="language"
            class="rg-select"
          >
            <option value="en">
              {{ t('preferences.langEn') }}
            </option>
            <option value="fr">
              {{ t('preferences.langFr') }}
            </option>
            <option value="es">
              {{ t('preferences.langEs') }}
            </option>
            <option value="de">
              {{ t('preferences.langDe') }}
            </option>
            <option value="pt">
              {{ t('preferences.langPt') }}
            </option>
          </select>
        </div>
      </section>

      <section class="rg-preferences__section">
        <h2 class="rg-preferences__section-title">
          {{ t('preferences.sectionNotifications') }}
        </h2>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="emailNotifications"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.emailNotifications') }}</span>
        </label>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="pushNotifications"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.pushNotifications') }}</span>
        </label>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="newVideos"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.newVideos') }}</span>
        </label>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="newComments"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.newComments') }}</span>
        </label>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="newLikes"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.newLikes') }}</span>
        </label>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="transcriptReady"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.transcriptReady') }}</span>
        </label>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="systemNotifications"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.systemNotifications') }}</span>
        </label>

        <div class="rg-field">
          <label
            class="rg-label"
            for="rg-preferences-cadence"
          >
            {{ t('preferences.pushCadence') }}
          </label>
          <select
            id="rg-preferences-cadence"
            v-model="pushCadence"
            class="rg-select"
          >
            <option
              v-for="candidate in CANDENCES"
              :key="candidate"
              :value="candidate === 'every30Min' ? 'every30Min' : candidate"
            >
              {{ ringLabelFor(`preferences.${candidate}` as 'preferences.every30Min' | 'preferences.everyHour' | 'preferences.every6Hours' | 'preferences.daily') }}
            </option>
          </select>
        </div>

        <div class="rg-field">
          <label
            class="rg-label"
            for="rg-preferences-interval"
          >
            {{ t('preferences.feedInterval') }}
          </label>
          <select
            id="rg-preferences-interval"
            v-model="feedInterval"
            class="rg-select"
          >
            <option
              v-for="candidate in INTERVALS"
              :key="candidate"
              :value="candidate"
            >
              {{ intervalLabelFor(`preferences.${candidate}` as 'preferences.every30Min' | 'preferences.everyHour' | 'preferences.every2Hours' | 'preferences.every6Hours' | 'preferences.daily') }}
            </option>
          </select>
        </div>
      </section>

      <section class="rg-preferences__section">
        <h2 class="rg-preferences__section-title">
          {{ t('preferences.sectionPlayback') }}
        </h2>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="autoplay"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.autoplay') }}</span>
        </label>

        <div class="rg-field">
          <label
            class="rg-label"
            for="rg-preferences-quality"
          >
            {{ t('preferences.defaultQuality') }}
          </label>
          <select
            id="rg-preferences-quality"
            v-model="defaultQuality"
            class="rg-select"
          >
            <option value="auto">
              {{ t('preferences.qualityAuto') }}
            </option>
            <option value="2160">
              2160p
            </option>
            <option value="1440">
              1440p
            </option>
            <option value="1080">
              1080p
            </option>
            <option value="720">
              720p
            </option>
            <option value="480">
              480p
            </option>
            <option value="360">
              360p
            </option>
          </select>
        </div>

        <div class="rg-field">
          <label
            class="rg-label"
            for="rg-preferences-speed"
          >
            {{ t('preferences.defaultSpeed') }}
          </label>
          <select
            id="rg-preferences-speed"
            v-model.number="defaultSpeed"
            class="rg-select"
          >
            <option :value="0.5">
              0.5x
            </option>
            <option :value="0.75">
              0.75x
            </option>
            <option :value="1">
              1x
            </option>
            <option :value="1.25">
              1.25x
            </option>
            <option :value="1.5">
              1.5x
            </option>
            <option :value="2">
              2x
            </option>
          </select>
        </div>

        <div class="rg-field">
          <label
            class="rg-label"
            for="rg-preferences-watched"
          >
            {{ t('preferences.autoMarkWatched') }}
          </label>
          <input
            id="rg-preferences-watched"
            v-model.number="autoMarkWatched"
            type="number"
            min="0"
            max="100"
            step="5"
            class="rg-input"
          >
        </div>
      </section>

      <section class="rg-preferences__section">
        <h2 class="rg-preferences__section-title">
          {{ t('preferences.sectionNotes') }}
        </h2>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="autoTimestamp"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.autoTimestamp') }}</span>
        </label>

        <div class="rg-field">
          <label
            class="rg-label"
            for="rg-preferences-notes-sort"
          >
            {{ t('preferences.sortOrder') }}
          </label>
          <select
            id="rg-preferences-notes-sort"
            v-model="notesSort"
            class="rg-select"
          >
            <option value="desc">
              {{ t('preferences.sortDesc') }}
            </option>
            <option value="asc">
              {{ t('preferences.sortAsc') }}
            </option>
          </select>
        </div>
      </section>

      <section class="rg-preferences__section">
        <h2 class="rg-preferences__section-title">
          {{ t('preferences.sectionChannelSync') }}
        </h2>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="channelAutoSync"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.channelAutoSync') }}</span>
        </label>

        <div class="rg-field">
          <label
            class="rg-label"
            for="rg-preferences-sync-interval"
          >
            {{ t('preferences.syncInterval') }}
          </label>
          <input
            id="rg-preferences-sync-interval"
            v-model.number="syncInterval"
            type="number"
            min="5"
            max="1440"
            step="5"
            class="rg-input"
          >
        </div>
      </section>

      <section class="rg-preferences__section">
        <h2 class="rg-preferences__section-title">
          {{ t('preferences.sectionTranscripts') }}
        </h2>

        <div class="rg-field">
          <label
            class="rg-label"
            for="rg-preferences-transcript-lang"
          >
            {{ t('preferences.transcriptLanguage') }}
          </label>
          <select
            id="rg-preferences-transcript-lang"
            v-model="transcriptLanguage"
            class="rg-select"
          >
            <option value="auto">
              {{ t('preferences.autoDetect') }}
            </option>
            <option value="en">
              en
            </option>
            <option value="fr">
              fr
            </option>
            <option value="es">
              es
            </option>
            <option value="de">
              de
            </option>
            <option value="pt">
              pt
            </option>
          </select>
        </div>

        <div class="rg-field">
          <label
            class="rg-label"
            for="rg-preferences-provider"
          >
            {{ t('preferences.defaultProvider') }}
          </label>
          <select
            id="rg-preferences-provider"
            v-model="defaultProvider"
            class="rg-select"
          >
            <option value="auto">
              {{ t('preferences.providerAutomatic') }}
            </option>
            <option value="youtubeCaptions">
              YouTube
            </option>
            <option value="fasterWhisper">
              Faster-Whisper
            </option>
          </select>
        </div>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="autoYouTubeCaptions"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.autoYouTubeCaptions') }}</span>
        </label>

        <label class="rg-check rg-preferences__check">
          <input
            v-model="localFallback"
            type="checkbox"
            class="rg-check__input"
          >
          <span class="rg-check__text">{{ t('preferences.localFallback') }}</span>
        </label>
      </section>

      <div class="rg-preferences__footer">
        <p
          v-if="saved"
          class="rg-preferences__notice rg-preferences__notice--success"
        >
          {{ t('preferences.saved') }}
        </p>
        <p
          v-else-if="saveFailed"
          class="rg-preferences__notice rg-preferences__notice--error"
        >
          {{ t('preferences.saveFailed') }}
        </p>
        <button
          type="submit"
          class="rg-btn rg-btn--primary"
          :disabled="saving"
        >
          {{ saving ? t('common.processing') : t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.rg-preferences {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-4, 1.5rem);
}

.rg-preferences__form {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-8, 2.5rem);
}

.rg-preferences__section {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.rg-preferences__section-title {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--rg-color-muted, #a1a1a1);
}

.rg-preferences__check {
  width: 100%;
}

.rg-preferences__footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  padding-top: var(--rg-space-4, 1.5rem);
  border-top: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
}

.rg-preferences__notice {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-preferences__notice--success {
  color: var(--rg-color-success, #4ade80);
}

.rg-preferences__notice--error {
  color: var(--rg-color-danger, #f87171);
}
</style>
