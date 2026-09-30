<script setup lang="ts">
// Create screen mirroring the Flutter create dialog: a ReplayGlows Feed or a
// real YouTube playlist, keeping French/English parity through i18n keys.
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppI18n } from '@/app/i18n'
import { feedsApi, videosApi } from '@/app/convex/api'

const router = useRouter()
const { t } = useAppI18n()

const palette = ['#7b61ff', '#00c8ff', '#00ff88', '#ffd000', '#ff5c8a', '#ff8a3d'] as const

const mode = ref<'feed' | 'playlist'>('feed')
const busy = ref(false)
const errorText = ref<string | null>(null)

const feedName = ref('')
const feedDescription = ref('')
const feedIncludeWatched = ref(true)
const feedSortOrder = ref<'newest' | 'oldest' | 'sourceOrder'>('newest')
const feedColor = ref<string | null>('#7b61ff')
const feedNameError = ref<string | null>(null)

const playlistName = ref('')
const playlistDescription = ref('')
const playlistPublic = ref(false)
const playlistColor = ref('#ff5c8a')
const playlistNameError = ref<string | null>(null)

const cleanName = (value: string) => value.trim()

function validateFeedName(): boolean {
  const name = cleanName(feedName.value)
  if (!name) {
    feedNameError.value = t('lists.feedNameRequired')
    return false
  }
  if (name.length < 2) {
    feedNameError.value = t('lists.feedNameTooShort')
    return false
  }
  feedNameError.value = null
  return true
}

function validatePlaylistName(): boolean {
  const name = cleanName(playlistName.value)
  if (!name) {
    playlistNameError.value = t('lists.playlistNameRequired')
    return false
  }
  if (name.length < 2) {
    playlistNameError.value = t('lists.playlistNameTooShort')
    return false
  }
  playlistNameError.value = null
  return true
}

async function createFeed() {
  if (!validateFeedName() || busy.value) {
    return
  }
  busy.value = true
  errorText.value = null
  try {
    const created = await feedsApi.create({
      title: cleanName(feedName.value),
      description: feedDescription.value.trim() || undefined,
      includeWatched: feedIncludeWatched.value,
      sortOrder: feedSortOrder.value,
      color: feedColor.value,
      isActive: true,
    })
    await router.push({ name: 'feed-detail', params: { id: created._id } })
  } catch {
    errorText.value = t('lists.feedCreateError')
  } finally {
    busy.value = false
  }
}

async function createPlaylist() {
  if (!validatePlaylistName() || busy.value) {
    return
  }
  busy.value = true
  errorText.value = null
  try {
    const created = await videosApi.createYoutubePlaylist({
      title: cleanName(playlistName.value),
      description: playlistDescription.value.trim() || undefined,
      privacyStatus: playlistPublic.value ? 'public' : 'private',
    })
    try {
      await videosApi.updatePlaylistDetails(created.id, playlistColor.value)
    } catch {
      errorText.value = t('lists.playlistUpdateFailed')
      return
    }
    await router.push({ name: 'playlist-detail', params: { id: created.id } })
  } catch {
    errorText.value = t('lists.playlistCreateError')
  } finally {
    busy.value = false
  }
}

const canSubmit = computed(() => (mode.value === 'feed' ? feedName.value.trim().length >= 2 : playlistName.value.trim().length >= 2))

const sortOptions = computed(() => [
  { value: 'newest' as const, label: t('lists.sortNewest') },
  { value: 'oldest' as const, label: t('lists.sortOldest') },
  { value: 'sourceOrder' as const, label: t('lists.sortSourceOrder') },
])
</script>

<template>
  <div class="cpv">
    <router-link
      class="cpv__back"
      :to="{ name: 'playlists' }"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
      </svg>
      <span>{{ t('lists.backToPlaylists') }}</span>
    </router-link>

    <h1 class="cpv__title">
      {{ t('lists.createTitle') }}
    </h1>
    <p class="cpv__intro">
      {{ t('lists.createIntro') }}
    </p>

    <div
      class="cpv__tabs"
      role="tablist"
      aria-label="Type"
    >
      <button
        type="button"
        class="cpv__tab"
        :class="{ 'cpv__tab--active': mode === 'feed' }"
        role="tab"
        :aria-selected="mode === 'feed'"
        @click="mode = 'feed'"
      >
        {{ t('lists.createFeedTab') }}
      </button>
      <button
        type="button"
        class="cpv__tab"
        :class="{ 'cpv__tab--active': mode === 'playlist' }"
        role="tab"
        :aria-selected="mode === 'playlist'"
        @click="mode = 'playlist'"
      >
        {{ t('lists.createPlaylistTab') }}
      </button>
    </div>

    <form
      v-if="mode === 'feed'"
      class="cpv__form"
      novalidate
      @submit.prevent="createFeed"
    >
      <h2 class="cpv__form-title">
        {{ t('lists.createFeedTitle') }}
      </h2>
      <p class="cpv__form-desc">
        {{ t('lists.createFeedDescription') }}
      </p>

      <label class="cpv__field">
        <span class="cpv__label">{{ t('lists.feedNameLabel') }}</span>
        <input
          v-model.trim="feedName"
          class="cpv__input"
          type="text"
          :placeholder="t('lists.feedNameHint')"
          autocomplete="off"
        >
        <span
          v-if="feedNameError"
          class="cpv__error"
        >{{ feedNameError }}</span>
      </label>

      <label class="cpv__field">
        <span class="cpv__label">{{ t('lists.feedDescriptionLabel') }}</span>
        <textarea
          v-model="feedDescription"
          class="cpv__input cpv__input--area"
          rows="3"
          :placeholder="t('lists.feedDescriptionHint')"
        />
        <span class="cpv__hint">{{ t('lists.feedDescriptionHelp') }}</span>
      </label>

      <label class="cpv__check">
        <input
          v-model="feedIncludeWatched"
          type="checkbox"
        >
        <span class="cpv__check-text">
          <span class="cpv__check-title">{{ t('lists.includeWatched') }}</span>
          <span class="cpv__check-desc">{{ t('lists.includeWatchedHint') }}</span>
        </span>
      </label>

      <fieldset class="cpv__group">
        <legend class="cpv__label">
          {{ t('lists.sortLabel') }}
        </legend>
        <div class="cpv__sort">
          <label
            v-for="opt in sortOptions"
            :key="opt.value"
            class="cpv__choice"
          >
            <input
              v-model="feedSortOrder"
              type="radio"
              name="sortOrder"
              :value="opt.value"
            >
            <span>{{ opt.label }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="cpv__group">
        <legend class="cpv__label">
          {{ t('lists.playlistColorLabel') }}
        </legend>
        <div class="cpv__colors">
          <button
            v-for="color in palette"
            :key="color"
            type="button"
            class="cpv__swatch"
            :class="{ 'cpv__swatch--active': feedColor === color }"
            :style="{ background: color }"
            :title="color"
            :aria-label="color"
            @click="feedColor = color"
          />
        </div>
      </fieldset>

      <p
        v-if="errorText"
        class="cpv__error cpv__error--block"
      >
        {{ errorText }}
      </p>

      <button
        type="submit"
        class="cpv__submit"
        :disabled="busy || !canSubmit"
      >
        {{ busy ? t('common.processing') : t('lists.feedSaveAction') }}
      </button>
    </form>

    <form
      v-else
      class="cpv__form"
      novalidate
      @submit.prevent="createPlaylist"
    >
      <h2 class="cpv__form-title">
        {{ t('lists.createPlaylistTab') }}
      </h2>
      <p class="cpv__form-desc">
        {{ t('lists.createPlaylistDescription') }}
      </p>

      <label class="cpv__field">
        <span class="cpv__label">{{ t('lists.playlistTitleLabel') }}</span>
        <input
          v-model.trim="playlistName"
          class="cpv__input"
          type="text"
          :placeholder="t('lists.playlistTitlePlaceholder')"
          autocomplete="off"
        >
        <span
          v-if="playlistNameError"
          class="cpv__error"
        >{{ playlistNameError }}</span>
      </label>

      <label class="cpv__field">
        <span class="cpv__label">{{ t('lists.playlistDescriptionLabel') }}</span>
        <textarea
          v-model="playlistDescription"
          class="cpv__input cpv__input--area"
          rows="3"
          :placeholder="t('lists.playlistDescriptionPlaceholder')"
        />
      </label>

      <label class="cpv__check">
        <input
          v-model="playlistPublic"
          type="checkbox"
        >
        <span class="cpv__check-text">
          <span class="cpv__check-title">{{ t('lists.playlistMakePublic') }}</span>
          <span class="cpv__check-desc">
            {{ playlistPublic ? t('lists.playlistPublicDescription') : t('lists.playlistPrivateDescription') }}
          </span>
        </span>
      </label>

      <fieldset class="cpv__group">
        <legend class="cpv__label">
          {{ t('lists.playlistColorLabel') }}
        </legend>
        <div class="cpv__colors">
          <button
            v-for="color in palette"
            :key="color"
            type="button"
            class="cpv__swatch"
            :class="{ 'cpv__swatch--active': playlistColor === color }"
            :style="{ background: color }"
            :title="color"
            :aria-label="color"
            @click="playlistColor = color"
          />
        </div>
      </fieldset>

      <p
        v-if="errorText"
        class="cpv__error cpv__error--block"
      >
        {{ errorText }}
      </p>

      <button
        type="submit"
        class="cpv__submit"
        :disabled="busy || !canSubmit"
      >
        {{ busy ? t('common.processing') : t('lists.playlistCreateAction') }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.cpv {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
  max-width: 34rem;
}

.cpv__back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.35rem;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  text-decoration: none;
}

.cpv__back:hover {
  color: var(--rg-color-foreground, #f7f7f2);
}

.cpv__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.cpv__intro {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.cpv__tabs {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface, #232327);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
}

.cpv__tab {
  padding: 0.45rem 0.9rem;
  border: none;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: transparent;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  cursor: pointer;
}

.cpv__tab--active {
  background: var(--rg-color-surface-raised, #2d2d31);
  color: var(--rg-color-foreground, #f7f7f2);
  font-weight: var(--rg-text-weight-strong, 700);
}

.cpv__form {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
  padding: var(--rg-space-3, 1rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-lg, 1rem);
  background: var(--rg-color-surface, #232327);
}

.cpv__form-title {
  margin: 0;
  font-size: 1rem;
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.cpv__form-desc {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.cpv__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.cpv__label {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.cpv__input {
  padding: 0.55rem 0.7rem;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-background, #141414);
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.875rem;
  font-family: inherit;
}

.cpv__input:focus {
  outline: none;
  border-color: var(--rg-color-primary, #f59e0b);
}

.cpv__input--area {
  resize: vertical;
  min-height: 4rem;
}

.cpv__hint {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: 0.6875rem;
}

.cpv__check {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  cursor: pointer;
}

.cpv__check input {
  margin-top: 0.25rem;
  accent-color: var(--rg-color-primary, #f59e0b);
}

.cpv__check-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.cpv__check-title {
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.8125rem;
}

.cpv__check-desc {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.cpv__group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0;
  margin: 0;
  border: none;
}

.cpv__sort {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.cpv__choice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: 0.8125rem;
}

.cpv__choice input {
  accent-color: var(--rg-color-primary, #f59e0b);
}

.cpv__colors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.cpv__swatch {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
}

.cpv__swatch--active {
  border-color: var(--rg-color-foreground, #f7f7f2);
}

.cpv__error {
  color: var(--rg-color-danger, #f87171);
  font-size: var(--rg-text-small, 0.75rem);
}

.cpv__error--block {
  margin: 0;
  padding: 0.5rem 0.7rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: color-mix(in oklab, var(--rg-color-danger, #f87171) 14%, transparent);
}

.cpv__submit {
  padding: 0.6rem 1rem;
  border: none;
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-primary, #f59e0b);
  color: var(--rg-color-primary-foreground, #1f2937);
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  cursor: pointer;
}

.cpv__submit:hover:not(:disabled) {
  background: var(--rg-color-primary-hover, #b45309);
}

.cpv__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>