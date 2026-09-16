<script setup lang="ts">
// Local bookmark library shown in the full page while signed out. Reads and
// writes the same chrome.storage bookmarks as the popup, through the shared
// normalization and the worker message contract.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAppI18n } from '@/app/i18n'
import { type Bookmark, groupBookmarks, normalizeBookmarks } from '@/bookmarks'

const { t } = useAppI18n()

const bookmarks = ref<Bookmark[]>([])
const error = ref('')
const editing = ref<Bookmark | null>(null)
const note = ref('')
const busy = ref<string | null>(null)

const groups = computed(() => Object.values(groupBookmarks(bookmarks.value)))

async function load(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('bookmarks')
    bookmarks.value = normalizeBookmarks(result.bookmarks ?? []).sort(
      (a, b) => (a.title ?? '').localeCompare(b.title ?? '') || a.time - b.time,
    )
  } catch {
    error.value = t('local.loadError')
  }
}

function onStorage(changes: Record<string, chrome.storage.StorageChange>, area: string): void {
  if (area === 'local' && changes.bookmarks) void load()
}

onMounted(() => {
  void load()
  chrome.storage.onChanged.addListener(onStorage)
})
onUnmounted(() => chrome.storage.onChanged.removeListener(onStorage))

async function mutate(action: string, bookmark: Bookmark): Promise<void> {
  error.value = ''
  const key = `${bookmark.url}:${bookmark.time}`
  busy.value = key
  try {
    const response = await chrome.runtime.sendMessage({ action, bookmark })
    if (response?.error) throw new Error(response.error)
    editing.value = null
    await load()
  } catch {
    error.value = t('common.error')
  } finally {
    busy.value = null
  }
}

function visit(bookmark: Bookmark): void {
  void chrome.tabs.create({ url: `${bookmark.url}&t=${bookmark.time}s` })
}

function startEdit(bookmark: Bookmark): void {
  editing.value = bookmark
  note.value = bookmark.note
}

function cancelEdit(): void {
  editing.value = null
}

function saveEdit(): void {
  if (editing.value) void mutate('updateBookmark', { ...editing.value, note: note.value })
}

function remove(bookmark: Bookmark): void {
  void mutate('deleteBookmark', bookmark)
}
</script>

<template>
  <section class="rg-local">
    <header class="rg-local__header">
      <h2 class="rg-local__title">
        {{ t('local.title', { count: String(bookmarks.length) }) }}
      </h2>
      <span class="rg-local__badge">
        {{ t('local.localOnly') }}
      </span>
    </header>

    <p
      v-if="error"
      class="rg-local__error"
      role="alert"
    >
      {{ error }}
    </p>

    <div
      v-if="bookmarks.length === 0"
      class="rg-local__empty"
    >
      <p class="rg-local__empty-title">
        {{ t('local.emptyTitle') }}
      </p>
      <p class="rg-local__empty-body">
        {{ t('local.emptyBody') }}
      </p>
    </div>

    <ul
      v-else
      class="rg-local__groups"
    >
      <li
        v-for="group in groups"
        :key="group.url"
        class="rg-local__group"
      >
        <h3 class="rg-local__group-title">
          {{ group.title === 'Vidéo YouTube' ? t('local.videoFallback') : group.title }}
        </h3>
        <ul class="rg-local__items">
          <li
            v-for="bookmark in group.bmList"
            :key="`${bookmark.url}:${bookmark.time}`"
            class="rg-local__item"
          >
            <div class="rg-local__row">
              <button
                type="button"
                class="rg-local__time"
                :title="t('local.openVideo')"
                @click="visit(bookmark)"
              >
                {{ bookmark.formattedTime }}
              </button>
              <p class="rg-local__note">
                {{ bookmark.note || t('local.noNote') }}
              </p>
              <div class="rg-local__actions">
                <button
                  type="button"
                  class="rg-link"
                  :disabled="busy === `${bookmark.url}:${bookmark.time}`"
                  @click="startEdit(bookmark)"
                >
                  {{ t('common.edit') }}
                </button>
                <button
                  type="button"
                  class="rg-link rg-link--danger"
                  :disabled="busy === `${bookmark.url}:${bookmark.time}`"
                  @click="remove(bookmark)"
                >
                  {{ t('common.delete') }}
                </button>
              </div>
            </div>
            <form
              v-if="editing === bookmark"
              class="rg-local__edit"
              @submit.prevent="saveEdit"
            >
              <input
                v-model="note"
                class="rg-input"
                :aria-label="t('local.editNote')"
              >
              <button
                type="submit"
                class="rg-btn"
                :disabled="busy === `${bookmark.url}:${bookmark.time}`"
              >
                {{ t('common.save') }}
              </button>
              <button
                type="button"
                class="rg-btn rg-btn--ghost"
                @click="cancelEdit"
              >
                {{ t('common.cancel') }}
              </button>
            </form>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.rg-local {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
  width: 100%;
}

.rg-local__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-local__title {
  margin: 0;
  font-size: var(--rg-text-title, 1.125rem);
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.rg-local__badge {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-local__error {
  margin: 0;
  color: var(--rg-color-danger, #f87171);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-local__empty {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-1, 0.5rem);
  padding: var(--rg-space-4, 1.5rem);
  border: 1px dashed var(--rg-color-border, #374151);
  border-radius: var(--rg-radius-md, 0.75rem);
}

.rg-local__empty-title {
  margin: 0;
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.rg-local__empty-body {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-local__groups,
.rg-local__items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.rg-local__group {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-3, 1rem);
  border: 1px solid var(--rg-color-border, #374151);
  border-radius: var(--rg-radius-md, 0.75rem);
}

.rg-local__group-title {
  margin: 0;
  font-size: var(--rg-text-body, 0.875rem);
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
  overflow-wrap: anywhere;
}

.rg-local__item {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-1, 0.5rem);
  padding: var(--rg-space-2, 0.75rem) 0;
  border-top: 1px solid var(--rg-color-border, #374151);
}

.rg-local__row {
  display: flex;
  align-items: baseline;
  gap: var(--rg-space-2, 0.75rem);
  flex-wrap: wrap;
}

.rg-local__time {
  padding: var(--rg-space-1, 0.5rem) var(--rg-space-2, 0.75rem);
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: color-mix(in oklab, var(--rg-color-primary, #0d87e1) 15%, transparent);
  color: var(--rg-color-primary, #0d87e1);
  font-size: var(--rg-text-small, 0.75rem);
  font-variant-numeric: tabular-nums;
}

.rg-local__note {
  margin: 0;
  flex: 1;
  min-width: 8rem;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  overflow-wrap: anywhere;
}

.rg-local__edit {
  display: flex;
  gap: var(--rg-space-1, 0.5rem);
  flex-wrap: wrap;
  align-items: center;
}

.rg-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--rg-color-primary, #0d87e1);
  font: inherit;
  font-size: var(--rg-text-small, 0.75rem);
  cursor: pointer;
  text-decoration: none;
  transition: opacity var(--rg-motion-fast, 120ms) var(--rg-ease, ease);
}

.rg-link:hover {
  opacity: 0.8;
}

.rg-link:disabled {
  cursor: default;
  opacity: 0.5;
}

.rg-link--danger {
  color: var(--rg-color-danger, #f87171);
}

.rg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--rg-space-1, 0.5rem);
  padding: var(--rg-space-1, 0.5rem) var(--rg-space-3, 1rem);
  border: 1px solid var(--rg-color-border, #374151);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface, #171717);
  color: var(--rg-color-foreground, #f7f7f2);
  font: inherit;
  cursor: pointer;
  transition: border-color var(--rg-motion-fast, 120ms) var(--rg-ease, ease), color var(--rg-motion-fast, 120ms) var(--rg-ease, ease);
}

.rg-btn:hover {
  border-color: var(--rg-color-primary, #0d87e1);
  color: var(--rg-color-primary, #0d87e1);
}

.rg-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.rg-btn--ghost {
  background: transparent;
}

.rg-input {
  flex: 1;
  min-width: 8rem;
  padding: var(--rg-space-1, 0.5rem) var(--rg-space-2, 0.75rem);
  border: 1px solid var(--rg-color-border, #374151);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-bg, #0a0a0a);
  color: var(--rg-color-foreground, #f7f7f2);
  font: inherit;
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-input:focus {
  outline: none;
  border-color: var(--rg-color-primary, #0d87e1);
}
</style>