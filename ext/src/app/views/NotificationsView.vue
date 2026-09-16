<script setup lang="ts">
// Notifications mirroring the Flutter notifications_screen: list of
// notifications grouped by recency, unread badge, mark single or all read,
// and graceful loading / error / empty states.
import { computed, onMounted, ref } from 'vue'
import { useAppI18n } from '@/app/i18n'
import { notificationsApi } from '@/app/convex/api'
import type { Notification } from '@/app/convex/types'

const { t } = useAppI18n()

const loading = ref(true)
const failed = ref(false)
const notifs = ref<Notification[]>([])
const busyIds = ref<Set<string>>(new Set())
const markingAll = ref(false)

onMounted(() => {
  void loadNotifications()
})

async function loadNotifications(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    const list = await notificationsApi.list()
    notifs.value = list ?? []
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

const unreadCount = computed(() => {
  let count = 0
  for (const item of notifs.value) {
    if (!item.read) {
      count += 1
    }
  }
  return count
})

function isBusy(id: string): boolean {
  return busyIds.value.has(id)
}

async function markRead(item: Notification): Promise<void> {
  if (item.read || isBusy(item._id)) {
    return
  }
  busyIds.value.add(item._id)
  try {
    await notificationsApi.markAsRead(item._id)
    const target = notifs.value.find((candidate) => candidate._id === item._id)
    if (target) {
      target.read = true
    }
  } catch {
    failed.value = true
  } finally {
    busyIds.value.delete(item._id)
  }
}

async function markAllRead(): Promise<void> {
  if (unreadCount.value === 0) {
    return
  }
  markingAll.value = true
  try {
    await notificationsApi.markAllAsRead()
    for (const item of notifs.value) {
      item.read = true
    }
  } catch {
    failed.value = true
  } finally {
    markingAll.value = false
  }
}

function relativeLabel(item: Notification): string {
  const raw = item.createdAt ?? 0
  const time = typeof raw === 'number' ? raw : Number(String(raw))
  if (!Number.isFinite(time) || time <= 0) {
    return t('notifications.justNow')
  }
  const diff = Date.now() - time
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) {
    return t('notifications.justNow')
  }
  if (minutes < 60) {
    return t('notifications.minutesAgo', { n: minutes })
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return t('notifications.hoursAgo', { n: hours })
  }
  const days = Math.floor(hours / 24)
  if (days < 7) {
    return t('notifications.daysAgo', { n: days })
  }
  return t('notifications.weeksAgo', { n: Math.floor(days / 7) })
}

function retry(): void {
  void loadNotifications()
}
</script>

<template>
  <div class="rg-notifications">
    <header class="rg-heading rg-heading--row rg-notifications__header">
      <h1 class="rg-heading__title">
        {{ t('notifications.title') }}
      </h1>
      <button
        v-if="unreadCount > 0"
        type="button"
        class="rg-btn rg-notifications__mark-all"
        :disabled="markingAll"
        @click="markAllRead"
      >
        {{ t('notifications.markAllRead') }}
      </button>
    </header>

    <p
      v-if="loading"
      class="rg-notifications__state"
    >
      {{ t('common.loading') }}
    </p>

    <div
      v-else-if="failed"
      class="rg-notifications__state"
    >
      <p class="rg-notifications__state-title rg-notifications__state-title--error">
        {{ t('notifications.loadFailed') }}
      </p>
      <button
        type="button"
        class="rg-btn"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <div
      v-else-if="notifs.length === 0"
      class="rg-notifications__state"
    >
      <p class="rg-notifications__state-title">
        {{ t('notifications.emptyTitle') }}
      </p>
      <p class="rg-notifications__state-desc">
        {{ t('notifications.emptyDescription') }}
      </p>
    </div>

    <ul
      v-else
      class="rg-notifications__list"
    >
      <li
        v-for="item in notifs"
        :key="item._id"
        class="rg-notifications__item"
        :class="{ 'rg-notifications__item--unread': !item.read }"
      >
        <button
          type="button"
          class="rg-notifications__content"
          :aria-label="item.title"
          :disabled="isBusy(item._id)"
          @click="markRead(item)"
        >
          <span
            v-if="!item.read"
            class="rg-notifications__dot"
            aria-hidden="true"
          />
          <span class="rg-notifications__text">
            <span class="rg-notifications__title">
              {{ item.title }}
            </span>
            <span
              v-if="item.body"
              class="rg-notifications__body"
            >
              {{ item.body }}
            </span>
            <span class="rg-notifications__time">
              {{ relativeLabel(item) }}
            </span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.rg-notifications {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.rg-notifications__mark-all {
  margin-left: auto;
  width: auto;
}

.rg-notifications__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-5, 2rem) var(--rg-space-4, 1.5rem);
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  text-align: center;
}

.rg-notifications__state-title {
  margin: 0;
  color: var(--rg-color-foreground, #f7f7f2);
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-notifications__state-title--error {
  color: var(--rg-color-danger, #f87171);
}

.rg-notifications__list {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.rg-notifications__item {
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
  background: var(--rg-color-surface, #232327);
  overflow: hidden;
}

.rg-notifications__item--unread {
  border-color: var(--rg-color-primary, #f59e0b);
}

.rg-notifications__content {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-3, 1rem);
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.rg-notifications__content:disabled {
  cursor: default;
  opacity: 0.6;
}

.rg-notifications__dot {
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  margin-top: 0.25rem;
  border-radius: 9999px;
  background: var(--rg-color-primary, #f59e0b);
}

.rg-notifications__text {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-1, 0.375rem);
  min-width: 0;
}

.rg-notifications__title {
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-notifications__body {
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  line-height: 1.4;
}

.rg-notifications__time {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-tiny, 0.625rem);
}
</style>
