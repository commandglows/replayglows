<script setup lang="ts">
// Notes screen mirroring the Flutter notes_screen: notes grouped by video,
// with search and sort together with graceful loading / error / empty states.
import { onMounted, ref } from 'vue'
import { useAppI18n } from '@/app/i18n'
import { notesApi, videosApi } from '@/app/convex/api'
import type { Note } from '@/app/convex/types'

const { t } = useAppI18n()

const loading = ref(true)
const failed = ref(false)
const notes = ref<Note[]>([])
const search = ref('')
const videoTitles = ref<Map<string, string>>(new Map())

onMounted(() => {
  void loadNotes()
})

async function loadNotes(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    const list = await notesApi.list()
    notes.value = list ?? []
    await hydrateVideoTitles(list ?? [])
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function hydrateVideoTitles(list: Note[]): Promise<void> {
  const ids = new Set<string>()
  for (const note of list) {
    if (note.youtubeVideoId) {
      ids.add(note.youtubeVideoId)
    }
  }
  if (ids.size === 0) {
    videoTitles.value = new Map()
    return
  }
  const entries: [string, string][] = []
  for (const id of ids) {
    try {
      const video = await videosApi.getByYoutubeId(id)
      if (video) {
        entries.push([id, video.title])
      }
    } catch {
      // Title hydration is best-effort; a failure keeps the note listed
      // without its video title.
    }
  }
  videoTitles.value = new Map(entries)
}

function filteredNotes(): Note[] {
  const query = search.value.trim().toLowerCase()
  const list = [...notes.value]
  if (query) {
    const kept: Note[] = []
    for (const note of list) {
      const haystack = [note.content.toLowerCase(), titleFor(note).toLowerCase()].join(' ')
      if (haystack.includes(query)) {
        kept.push(note)
      }
    }
    list.length = 0
    list.push(...kept)
  }
  list.sort((a, b) => {
    const aTime = numericDate(a.updatedAt ?? a.createdAt ?? a._creationTime ?? 0)
    const bTime = numericDate(b.updatedAt ?? b.createdAt ?? b._creationTime ?? 0)
    return bTime - aTime
  })
  return list
}

function numericDate(value: number | string | undefined): number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
    const asDate = Date.parse(value)
    if (Number.isFinite(asDate)) {
      return asDate
    }
  }
  return 0
}

interface NoteGroup {
  label: string
  videoId: string | null
  notes: Note[]
}

function groupedNotes(): NoteGroup[] {
  const groups: NoteGroup[] = []
  const byVideo = new Map<string, Note[]>()
  const standalone: Note[] = []
  for (const note of filteredNotes()) {
    if (note.youtubeVideoId && videoTitles.value.has(note.youtubeVideoId)) {
      const bucket = byVideo.get(note.youtubeVideoId) ?? []
      bucket.push(note)
      byVideo.set(note.youtubeVideoId, bucket)
    } else {
      standalone.push(note)
    }
  }
  for (const [videoId, items] of byVideo) {
    items.sort((a, b) => numericDate(b.updatedAt ?? b.createdAt ?? 0) - numericDate(a.updatedAt ?? a.createdAt ?? 0))
    groups.push({ label: titleFor(items[0]) || videoId, videoId, notes: items })
  }
  if (standalone.length > 0) {
    standalone.sort((a, b) => numericDate(b.updatedAt ?? b.createdAt ?? 0) - numericDate(a.updatedAt ?? a.createdAt ?? 0))
    groups.push({ label: t('notes.groupStandalone'), videoId: null, notes: standalone })
  }
  return groups
}

function titleFor(note: Note): string {
  return videoTitles.value.get(note.youtubeVideoId) ?? ''
}

function noteCountLabel(count: number): string {
  return t('notes.notesCount', { count })
}

function retry(): void {
  void loadNotes()
}
</script>

<template>
  <div class="rg-notes">
    <header class="rg-heading rg-heading--row rg-notes__header">
      <h1 class="rg-heading__title">
        {{ t('notes.title') }}
      </h1>
    </header>

    <p
      v-if="loading"
      class="rg-notes__state"
    >
      {{ t('common.loading') }}
    </p>

    <div
      v-else-if="failed"
      class="rg-notes__state rg-notes__state--error"
    >
      <p class="rg-notes__state-title">
        {{ t('notes.loadFailed') }}
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
      <div class="rg-field rg-notes__search">
        <input
          v-model="search"
          type="search"
          class="rg-input"
          :placeholder="t('notes.searchPlaceholder')"
        >
      </div>

      <p
        v-if="notes.length === 0"
        class="rg-notes__state"
      >
        <span class="rg-notes__state-title">{{ t('notes.noNotesTitle') }}</span>
        <span class="rg-notes__state-desc">{{ t('notes.noNotesDescription') }}</span>
      </p>

      <p
        v-else-if="filteredNotes().length === 0"
        class="rg-notes__state"
      >
        <span class="rg-notes__state-title">{{ t('notes.noResultsTitle') }}</span>
        <span class="rg-notes__state-desc">{{ t('notes.noResultsDescription') }}</span>
      </p>

      <section
        v-for="group in groupedNotes()"
        v-else
        :key="group.videoId ?? 'standalone'"
        class="rg-notes__group"
      >
        <h2 class="rg-notes__group-label">
          {{ group.label }}
          <span class="rg-notes__group-count">{{ noteCountLabel(group.notes.length) }}</span>
        </h2>
        <ul class="rg-notes__list">
          <li
            v-for="note in group.notes"
            :key="note._id"
            class="rg-notes__item"
          >
            <router-link
              class="rg-notes__link"
              :to="{ name: 'note-detail', params: { slug: note._id } }"
            >
              <span class="rg-notes__excerpt">{{ note.content }}</span>
              <span class="rg-notes__date">{{ t('notes.createdAt', { date: note.createdAt ?? '' }) }}</span>
            </router-link>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.rg-notes {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.rg-notes__header {
  align-items: center;
}

.rg-notes__sort {
  margin-left: auto;
  width: auto;
}

.rg-notes__search {
  width: 100%;
}

.rg-notes__state {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-1, 0.375rem);
  padding: var(--rg-space-5, 2rem) var(--rg-space-4, 1.5rem);
  margin: 0;
  text-align: center;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-notes__state--error .rg-notes__state-title {
  color: var(--rg-color-danger, #f87171);
}

.rg-notes__state-title {
  color: var(--rg-color-foreground, #f7f7f2);
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-notes__group {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-notes__group-label {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--rg-color-muted, #a1a1a1);
}

.rg-notes__group-count {
  margin-left: var(--rg-space-1, 0.375rem);
  color: var(--rg-color-muted, #a1a1a1);
  font-weight: var(--rg-text-weight, 400);
}

.rg-notes__list {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.rg-notes__item {
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface, #232327);
  overflow: hidden;
}

.rg-notes__link {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-1, 0.375rem);
  padding: var(--rg-space-3, 1rem);
  text-decoration: none;
  color: inherit;
}

.rg-notes__excerpt {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  line-height: 1.4;
}

.rg-notes__date {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-tiny, 0.625rem);
}
</style>
