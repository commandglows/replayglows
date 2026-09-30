<script setup lang="ts">
// Local player for a YouTube video passed by the extension overlay menu
// (#/watch?v=<id>&t=<seconds>). No Convex, no YouTube Data API: the embed
// resumes at the passed position and bookmarks go to chrome.storage.local.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppI18n } from '@/app/i18n'

const route = useRoute()
const router = useRouter()
const { t } = useAppI18n()

const videoId = computed<string>(() => {
  const value = route.query.v
  return typeof value === 'string' ? value.trim() : ''
})

const startSeconds = computed<number>(() => {
  const raw = route.query.t
  const parsed = typeof raw === 'string' ? Number(raw) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
})

const embedStart = ref<number>(startSeconds.value)
const embedKey = ref(0)
const currentSeconds = ref<number>(startSeconds.value)
const busy = ref(false)
const feedback = ref<{ kind: 'ok' | 'error'; message: string } | null>(null)

const embedSrc = computed(() => {
  const id = videoId.value
  if (!id) {
    return ''
  }
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    rel: '0',
    playsinline: '1',
  })
  if (embedStart.value > 0) {
    params.set('start', String(embedStart.value))
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
})

function back(): void {
  void router.push({ path: '/', replace: true })
}

function seekHere(): void {
  embedStart.value = Math.max(0, Math.round(currentSeconds.value))
  embedKey.value += 1
}

async function saveBookmark(): Promise<void> {
  const id = videoId.value
  if (!id || busy.value) {
    return
  }
  busy.value = true
  feedback.value = null
  try {
    const time = Math.max(0, Math.round(currentSeconds.value))
    const response = await chrome.runtime.sendMessage({
      action: 'addBookmark',
      bookmark: { url: `https://www.youtube.com/watch?v=${id}`, time },
    })
    if (response?.error) {
      throw new Error(response.error)
    }
    feedback.value = { kind: 'ok', message: t('local.saved') }
  } catch (error) {
    feedback.value = {
      kind: 'error',
      message: error instanceof Error ? error.message : t('local.saveFailed'),
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="rg-watch">
    <div
      v-if="!videoId"
      class="rg-watch__empty"
    >
      <p class="rg-local__empty-title">
        {{ t('local.invalidVideo') }}
      </p>
      <button
        type="button"
        class="rg-btn"
        @click="back"
      >
        ← {{ t('local.backToLibrary') }}
      </button>
    </div>

    <template v-else>
      <div class="rg-watch__frame">
        <iframe
          :key="embedKey"
          :src="embedSrc"
          class="rg-watch__iframe"
          :title="t('local.watchTitle')"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowfullscreen
        />
      </div>

      <div class="rg-watch__bar">
        <button
          type="button"
          class="rg-btn rg-btn--ghost"
          @click="back"
        >
          ← {{ t('local.backToLibrary') }}
        </button>
        <label class="rg-watch__field">
          <span>{{ t('local.position') }}</span>
          <input
            v-model.number="currentSeconds"
            class="rg-input rg-watch__input"
            type="number"
            min="0"
            step="1"
            :aria-label="t('local.position')"
          >
        </label>
        <button
          type="button"
          class="rg-btn"
          @click="seekHere"
        >
          {{ t('local.readFrom') }}
        </button>
        <button
          type="button"
          class="rg-btn rg-btn--primary"
          :disabled="busy"
          @click="saveBookmark"
        >
          {{ t('local.bookmarkAt') }}
        </button>
      </div>

      <p
        v-if="feedback"
        :class="feedback.kind === 'ok' ? 'rg-watch__ok' : 'rg-local__error'"
        role="status"
      >
        {{ feedback.message }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.rg-watch {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
  width: 100%;
}

.rg-watch__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-watch__frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: var(--rg-radius-md, 0.75rem);
  overflow: hidden;
}

.rg-watch__iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.rg-watch__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-watch__field {
  display: inline-flex;
  align-items: center;
  gap: var(--rg-space-1, 0.5rem);
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-watch__input {
  width: 6rem;
}

.rg-watch__ok {
  margin: 0;
  color: var(--rg-color-success, #22c55e);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-local__empty-title {
  margin: 0;
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.rg-local__error {
  margin: 0;
  color: var(--rg-color-danger, #f87171);
  font-size: var(--rg-text-small, 0.75rem);
  overflow-wrap: anywhere;
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

.rg-btn--primary {
  border-color: var(--rg-color-primary, #0d87e1);
  background: var(--rg-color-primary, #0d87e1);
  color: var(--rg-color-primary-foreground, #0a0a0a);
}

.rg-btn--primary:hover {
  border-color: var(--rg-color-primary-hover, #3896e6);
  background: var(--rg-color-primary-hover, #3896e6);
  color: var(--rg-color-primary-foreground, #0a0a0a);
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