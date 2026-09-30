<script setup lang="ts">
// Note detail mirroring the Flutter note_detail_screen: load a single note by
// its _id (the :slug route param), allow inline editing with explicit save and
// a two-step delete confirm, and link out to the related video on /play.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppI18n } from '@/app/i18n'
import { notesApi, videosApi } from '@/app/convex/api'
import type { Note } from '@/app/convex/types'

const { t } = useAppI18n()
const route = useRoute()
const router = useRouter()
const videoApi = videosApi

const loading = ref(true)
const failed = ref(false)
const note = ref<Note | null>(null)
const content = ref('')
const saving = ref(false)
const saveFailed = ref('')
const deleting = ref(false)
const deleteArmed = ref(false)
const confirmDelete = ref(false)
const videoTitle = ref<string | null>(null)

const noteId = computed(() => String(route.params.slug ?? ''))

onMounted(() => {
  void loadNote()
})

async function loadNote(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    const list = (await notesApi.list()) ?? []
    const item = list.find((candidate) => candidate._id === noteId.value)
    if (!item) {
      failed.value = true
      return
    }
    note.value = item
    content.value = item.content
    if (item.youtubeVideoId) {
      try {
        const video = await videoApi.getByYoutubeId(item.youtubeVideoId)
        videoTitle.value = video?.title ?? null
      } catch {
        videoTitle.value = null
      }
    }
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  if (!note.value) {
    return
  }
  saving.value = true
  saveFailed.value = ''
  try {
    await notesApi.update(note.value._id, content.value)
    if (note.value) {
      note.value.content = content.value
    }
  } catch {
    saveFailed.value = t('notes.saveFailed')
  } finally {
    saving.value = false
  }
}

function armDelete(): void {
  deleteArmed.value = true
}

function cancelDelete(): void {
  deleteArmed.value = false
  confirmDelete.value = false
}

function askConfirm(): void {
  confirmDelete.value = true
}

function retry(): void {
  void loadNote()
}

async function deleteNote(): Promise<void> {
  if (!note.value) {
    return
  }
  deleting.value = true
  try {
    await notesApi.remove(note.value._id)
    await router.push({ name: 'notes' })
  } catch {
    saveFailed.value = t('notes.deleteFailed')
  } finally {
    deleting.value = false
  }
}

function openVideo(): void {
  if (!note.value?.youtubeVideoId) {
    return
  }
  void router.push({ name: 'play', query: { v: note.value.youtubeVideoId } })
}

function dateLabel(value: string | number | undefined, prefix: 'notes.createdAt' | 'notes.updatedAt'): string {
  if (!value) {
    return ''
  }
  return t(prefix, { date: String(value) })
}
</script>

<template>
  <div class="rg-note-detail">
    <p
      v-if="loading"
      class="rg-note-detail__state"
    >
      {{ t('common.loading') }}
    </p>

    <div
      v-else-if="failed"
      class="rg-note-detail__state rg-note-detail__state--error"
    >
      <p class="rg-note-detail__state-title">
        {{ t('notes.detailLoadFailed') }}
      </p>
      <button
        type="button"
        class="rg-btn"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <template v-else-if="note">
      <header class="rg-heading rg-heading--row rg-note-detail__header">
        <router-link
          class="rg-btn rg-note-detail__back"
          :to="{ name: 'notes' }"
        >
          {{ t('notes.backToList') }}
        </router-link>
        <h1 class="rg-heading__title">
          {{ t('note-detail.title') }}
        </h1>
      </header>

      <p class="rg-note-detail__meta">
        <template v-if="dateLabel(note.createdAt, 'notes.createdAt')">
          <span>{{ dateLabel(note.createdAt, 'notes.createdAt') }}</span>
        </template>
        <template v-if="dateLabel(note.updatedAt, 'notes.updatedAt')">
          <span>{{ dateLabel(note.updatedAt, 'notes.updatedAt') }}</span>
        </template>
      </p>

      <div
        v-if="note.youtubeVideoId"
        class="rg-note-detail__video"
      >
        <p class="rg-note-detail__video-title">
          {{ videoTitle ?? note.youtubeVideoId }}
        </p>
        <button
          type="button"
          class="rg-btn"
          @click="openVideo"
        >
          {{ t('notes.goToVideo') }}
        </button>
      </div>

      <div class="rg-field rg-note-detail__editor">
        <label
          class="rg-label"
          for="rg-note-content"
        >
          <span class="rg-label__text">{{ t('note-detail.title') }}</span>
        </label>
        <textarea
          id="rg-note-content"
          v-model="content"
          class="rg-textarea"
          rows="10"
        />
      </div>

      <p
        v-if="saveFailed"
        class="rg-note-detail__error"
      >
        {{ saveFailed }}
      </p>

      <div class="rg-note-detail__actions">
        <button
          type="button"
          class="rg-btn rg-btn--primary"
          :disabled="saving || deleting"
          @click="save"
        >
          {{ saving ? t('common.processing') : t('common.save') }}
        </button>

        <template v-if="!deleteArmed">
          <button
            type="button"
            class="rg-btn rg-btn--danger"
            :disabled="deleting"
            @click="armDelete"
          >
            {{ t('common.delete') }}
          </button>
        </template>

        <template v-else>
          <button
            type="button"
            class="rg-btn rg-btn--danger"
            :disabled="deleting"
            @click="confirmDelete ? deleteNote() : askConfirm()"
          >
            {{ confirmDelete ? t('notes.deleteQuestion') : t('notes.deleteQuestion') }}
          </button>
          <button
            type="button"
            class="rg-btn"
            @click="cancelDelete"
          >
            {{ t('common.cancel') }}
          </button>
        </template>
      </div>

      <div
        v-if="deleteArmed"
        class="rg-note-detail__confirm"
      >
        <p class="rg-note-detail__confirm-title">
          {{ t('notes.deleteWarning') }}
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rg-note-detail {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.rg-note-detail__header {
  align-items: center;
}

.rg-note-detail__back {
  margin-right: auto;
}

.rg-note-detail__meta {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-1, 0.375rem);
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-note-detail__video {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-3, 1rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface, #232327);
}

.rg-note-detail__video-title {
  margin: 0;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-note-detail__editor {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-1, 0.375rem);
}

.rg-note-detail__error {
  margin: 0;
  color: var(--rg-color-danger, #f87171);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-note-detail__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-note-detail__confirm {
  padding: var(--rg-space-2, 0.75rem);
  border: var(--rg-border-width, 1px) solid var(--rg-color-danger, #f87171);
  border-radius: var(--rg-radius-md, 0.625rem);
}

.rg-note-detail__confirm-title {
  margin: 0;
  color: var(--rg-color-danger, #f87171);
  font-size: var(--rg-text-small, 0.75rem);
}
</style>
