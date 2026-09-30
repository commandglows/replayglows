<script setup lang="ts">
// Hidden videos / playlists mirroring the Flutter hidden_screen: two tabs,
// unhide with a two-step confirm, plus loading / error / empty states.
import { computed, onMounted, ref } from 'vue'
import { useAppI18n } from '@/app/i18n'
import { hiddenApi } from '@/app/convex/api'
import type { HiddenItem } from '@/app/convex/types'

const { t } = useAppI18n()

const loading = ref(true)
const failed = ref(false)
const items = ref<HiddenItem[]>([])
const activeTab = ref<'videos' | 'playlists'>('videos')
const busyId = ref<string | null>(null)
const armId = ref<string | null>(null)

onMounted(() => {
  void loadHidden()
})

const videos = computed(() => items.value.filter((item) => item.itemType === 'video'))
const playlists = computed(() => items.value.filter((item) => item.itemType === 'playlist'))
const activeCount = computed(() => (activeTab.value === 'videos' ? videos.value : playlists.value).length)

async function loadHidden(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    items.value = (await hiddenApi.list()) ?? []
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

function typeLabel(item: HiddenItem): string {
  return t(item.itemType === 'video' ? 'hidden.typeVideo' : 'hidden.typePlaylist')
}

function itemName(item: HiddenItem): string {
  return item.youtubeId
}

function hiddenAtLabel(item: HiddenItem): string {
  if (!item.hiddenAt) {
    return ''
  }
  const label = t('hidden.hiddenAt', { date: item.hiddenAt })
  return label === 'hidden.hiddenAt' ? '' : label
}

function armUnhide(item: HiddenItem): void {
  armId.value = item._id
}

function cancelUnhide(): void {
  armId.value = null
}

async function performUnhide(item: HiddenItem): Promise<void> {
  busyId.value = item._id
  try {
    await hiddenApi.unhide({ hiddenItemId: item._id })
    items.value = items.value.filter((candidate) => candidate._id !== item._id)
  } catch {
    failed.value = true
  } finally {
    busyId.value = null
    armId.value = null
  }
}

function retry(): void {
  void loadHidden()
}

function tabLabel(tab: 'videos' | 'playlists'): string {
  return tab === 'videos' ? t('hidden.tabVideos') : t('hidden.tabPlaylists')
}

function emptyTitleFor(tab: 'videos' | 'playlists'): string {
  return tab === 'videos' ? t('hidden.emptyVideos') : t('hidden.emptyPlaylists')
}

function emptyDescriptionFor(tab: 'videos' | 'playlists'): string {
  return tab === 'videos' ? t('hidden.emptyVideosDescription') : t('hidden.emptyPlaylistsDescription')
}
</script>

<template>
  <div class="rg-hidden">
    <header class="rg-heading rg-heading--row">
      <h1 class="rg-heading__title">
        {{ t('hidden.title') }}
      </h1>
    </header>

    <p
      v-if="loading"
      class="rg-hidden__state"
    >
      {{ t('common.loading') }}
    </p>

    <div
      v-else-if="failed"
      class="rg-hidden__state rg-hidden__state--error"
    >
      <p class="rg-hidden__state-title">
        {{ t('hidden.loadFailed') }}
      </p>
      <button
        type="button"
        class="rg-btn"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <template v-else>
      <div
        role="tablist"
        class="rg-tabs rg-hidden__tabs"
        :aria-label="t('hidden.title')"
      >
        <button
          v-for="tab in (['videos', 'playlists'] as const)"
          :key="tab"
          type="button"
          role="tab"
          class="rg-tabs__tab"
          :class="{ 'rg-tabs__tab--active': activeTab === tab }"
          :aria-selected="activeTab === tab"
          @click="activeTab = tab"
        >
          {{ tabLabel(tab) }}
        </button>
      </div>

      <p
        v-if="activeCount === 0"
        class="rg-hidden__state"
      >
        <span class="rg-hidden__state-title">{{ emptyTitleFor(activeTab) }}</span>
        <span class="rg-hidden__state-desc">{{ emptyDescriptionFor(activeTab) }}</span>
      </p>

      <ul
        v-else
        class="rg-hidden__list"
      >
        <li
          v-for="item in activeTab === 'videos' ? videos : playlists"
          :key="item._id"
          class="rg-hidden__item"
        >
          <div class="rg-hidden__info">
            <span class="rg-hidden__name">{{ itemName(item) }}</span>
            <span class="rg-hidden__meta">
              {{ typeLabel(item) }}<template v-if="hiddenAtLabel(item)"> · {{ hiddenAtLabel(item) }}</template>
            </span>
          </div>

          <template v-if="armId !== item._id">
            <button
              type="button"
              class="rg-btn"
              :disabled="busyId === item._id"
              @click="armUnhide(item)"
            >
              {{ t('hidden.unhide') }}
            </button>
          </template>

          <template v-else>
            <div class="rg-hidden__confirm">
              <p class="rg-hidden__confirm-title">
                {{ t('hidden.unhideConfirmTitle', { type: typeLabel(item) }) }}
              </p>
              <p class="rg-hidden__confirm-desc">
                {{ t('hidden.unhideConfirmBody', { name: itemName(item) }) }}
              </p>
              <div class="rg-hidden__confirm-actions">
                <button
                  type="button"
                  class="rg-btn"
                  :disabled="busyId === item._id"
                  @click="cancelUnhide"
                >
                  {{ t('common.cancel') }}
                </button>
                <button
                  type="button"
                  class="rg-btn rg-btn--danger"
                  :disabled="busyId === item._id"
                  @click="performUnhide(item)"
                >
                  {{ t('hidden.unhide') }}
                </button>
              </div>
            </div>
          </template>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.rg-hidden {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.rg-hidden__tabs {
  width: 100%;
}

.rg-hidden__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-1, 0.375rem);
  padding: var(--rg-space-5, 2rem) var(--rg-space-4, 1.5rem);
  margin: 0;
  text-align: center;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-hidden__state--error .rg-hidden__state-title {
  color: var(--rg-color-danger, #f87171);
}

.rg-hidden__state-title {
  color: var(--rg-color-foreground, #f7f7f2);
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-hidden__state-desc {
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-hidden__list {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.rg-hidden__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-3, 1rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface, #232327);
}

.rg-hidden__info {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-1, 0.375rem);
  min-width: 0;
}

.rg-hidden__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-hidden__meta {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-tiny, 0.625rem);
}

.rg-hidden__confirm {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-1, 0.375rem);
  max-width: 16rem;
  padding: var(--rg-space-2, 0.75rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-danger, #f87171);
  border-radius: var(--rg-radius-md, 0.625rem);
}

.rg-hidden__confirm-title {
  margin: 0;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-hidden__confirm-desc {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-hidden__confirm-actions {
  display: flex;
  gap: var(--rg-space-1, 0.375rem);
}
</style>
