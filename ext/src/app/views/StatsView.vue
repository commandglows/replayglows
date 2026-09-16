<script setup lang="ts">
// Stats screen mirroring the Flutter stats_screen: YouTube API daily quota bar,
// today summary metrics, last-7-days bar chart and a recent API calls table,
// all with loading / error / empty states and refresh.
import { onMounted, ref } from 'vue'
import { useAppI18n } from '@/app/i18n'
import { metricsApi } from '@/app/convex/api'
import type { QuotaUsage } from '@/app/convex/types'

const { t } = useAppI18n()

const loading = ref(true)
const failed = ref(false)
const usage = ref<QuotaUsage | null>(null)

const DAY_SHORT = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'] as const

onMounted(() => {
  void loadStats()
})

async function loadStats(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    usage.value = await metricsApi.todayQuota()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

function percentUsed(): number {
  const used = usage.value?.used ?? 0
  const limit = usage.value?.limit ?? 0
  if (limit <= 0) {
    return 0
  }
  return Math.round((used / limit) * 100)
}

function usedOfLabel(): string {
  const used = String(usage.value?.used ?? 0)
  const limit = String(usage.value?.limit ?? 0)
  return t('stats.usedOf', { used, limit })
}

function percentTodayLabel(): string {
  return t('stats.percentToday', { percent: percentUsed() })
}

function bars(): { label: string; value: number; heightPct: number }[] {
  const history = normaliseHistory(usage.value?.dailyHistory)
  const baseline = history.length > 0 ? Math.max(...history.map((h) => h.value), 1) : 1
  return history.map((entry) => ({
    label: t(`stats.${DAY_SHORT[entry.index] ?? 'daySun'}`),
    value: entry.value,
    heightPct: Math.round((entry.value / baseline) * 100),
  }))
}

function normaliseHistory(raw: unknown): { index: number; value: number }[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const entries: { index: number; value: number }[] = []
  const now = new Date()
  const today = now.getDay()
  for (let i = 6; i >= 0; i -= 1) {
    const index = (today - i + 7) % 7
    const rawEntry = raw[raw.length - 1 - i]
    const value = rawEntry && typeof rawEntry === 'object'
      ? Number((rawEntry as Record<string, unknown>).value ?? 0)
      : 0
    entries.push({ index, value: Number.isFinite(value) ? value : 0 })
  }
  return entries
}

function recentCalls(): { endpoint: string; time: string; cost: string }[] {
  const calls = usage.value?.recentCalls
  if (!Array.isArray(calls)) {
    return []
  }
  const rows: { endpoint: string; time: string; cost: string }[] = []
  for (const call of calls) {
    if (!call || typeof call !== 'object') {
      continue
    }
    const record = call as Record<string, unknown>
    const endpoint = typeof record.endpoint === 'string' ? record.endpoint : ''
    const time = typeof record.time === 'string' ? record.time : ''
    const cost = typeof record.cost === 'number' ? record.cost : typeof record.cost === 'string' ? record.cost : ''
    if (endpoint) {
      rows.push({ endpoint, time, cost: cost ? t('stats.units', { count: String(cost) }) : '' })
    }
  }
  return rows
}

function retry(): void {
  void loadStats()
}
</script>

<template>
  <div class="rg-stats">
    <header class="rg-heading rg-heading--row">
      <h1 class="rg-heading__title">
        {{ t('stats.title') }}
      </h1>
      <button
        type="button"
        class="rg-btn rg-stats__refresh"
        :disabled="loading"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
    </header>

    <p
      v-if="loading"
      class="rg-stats__state"
    >
      {{ t('common.loading') }}
    </p>

    <div
      v-else-if="failed"
      class="rg-stats__state rg-stats__state--error"
    >
      <p class="rg-stats__state-title">
        {{ t('stats.loadFailed') }}
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
      <section class="rg-stats__section">
        <h2 class="rg-stats__section-title">
          {{ t('stats.quotaTitle') }}
        </h2>
        <div class="rg-stats__quota">
          <p class="rg-stats__quota-value">
            {{ usedOfLabel() }}
          </p>
          <div
            class="rg-stats__quota-bar"
            role="progressbar"
            :aria-valuenow="percentUsed()"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span
              class="rg-stats__quota-fill"
              :style="{ width: `${Math.min(percentUsed(), 100)}%` }"
            />
          </div>
          <p class="rg-stats__quota-desc">
            {{ percentTodayLabel() }}
          </p>
        </div>

        <div
          v-if="bars().length > 0"
          class="rg-stats__bars"
        >
          <div
            v-for="bar in bars()"
            :key="bar.label"
            class="rg-stats__bar"
            :title="String(bar.value)"
          >
            <span
              class="rg-stats__bar-outer"
            >
              <span
                class="rg-stats__bar-fill"
                :style="{ height: `${Math.max(bar.heightPct, 2)}%` }"
              />
            </span>
            <span class="rg-stats__bar-label">{{ bar.label }}</span>
          </div>
        </div>
      </section>

      <section class="rg-stats__section">
        <h2 class="rg-stats__section-title">
          {{ t('stats.todaySummary') }}
        </h2>
        <dl class="rg-stats__summary">
          <div class="rg-stats__summary-row">
            <dt>{{ t('stats.syncs') }}</dt>
            <dd>{{ usage?.syncs ?? 0 }}</dd>
          </div>
          <div class="rg-stats__summary-row">
            <dt>{{ t('stats.videosFetched') }}</dt>
            <dd>{{ usage?.videosFetched ?? 0 }}</dd>
          </div>
          <div class="rg-stats__summary-row">
            <dt>{{ t('stats.playlists') }}</dt>
            <dd>{{ usage?.playlistCount ?? 0 }}</dd>
          </div>
        </dl>
      </section>

      <section class="rg-stats__section">
        <h2 class="rg-stats__section-title">
          {{ t('stats.recentCalls') }}
        </h2>
        <div
          v-if="recentCalls().length > 0"
          class="rg-stats__table-wrap"
        >
          <table class="rg-stats__table">
            <thead>
              <tr>
                <th scope="col">
                  {{ t('stats.endpoint') }}
                </th>
                <th scope="col">
                  {{ t('stats.time') }}
                </th>
                <th scope="col">
                  {{ t('stats.cost') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in recentCalls()"
                :key="row.endpoint + row.time"
              >
                <td>{{ row.endpoint }}</td>
                <td>{{ row.time }}</td>
                <td>{{ row.cost }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p
          v-else
          class="rg-stats__state rg-stats__state--muted"
        >
          {{ t('stats.noRecentCalls') }}
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.rg-stats {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-4, 1.5rem);
}

.rg-stats__refresh {
  margin-left: auto;
}

.rg-stats__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-5, 2rem) var(--rg-space-4, 1.5rem);
  margin: 0;
  text-align: center;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-stats__state--error .rg-stats__state-title {
  color: var(--rg-color-danger, #f87171);
}

.rg-stats__state--muted {
  color: var(--rg-color-muted, #a1a1a1);
}

.rg-stats__section {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.rg-stats__section-title {
  margin: 0;
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--rg-color-muted, #a1a1a1);
}

.rg-stats__quota {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-stats__quota-value {
  margin: 0;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-medium, 0.875rem);
  font-weight: var(--rg-text-weight-strong, 700);
  font-variant-numeric: tabular-nums;
}

.rg-stats__quota-bar {
  height: 0.5rem;
  border-radius: 9999px;
  background: var(--rg-color-surface-content, #3f3f46);
  overflow: hidden;
}

.rg-stats__quota-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--rg-color-primary, #f59e0b);
  transition: width 0.2s ease;
}

.rg-stats__quota-desc {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-stats__bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--rg-space-2, 0.75rem);
  padding: var(--rg-space-2, 0.75rem) 0;
}

.rg-stats__bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-1, 0.375rem);
  min-width: 1.5rem;
}

.rg-stats__bar-outer {
  display: flex;
  align-items: flex-end;
  width: 0.5rem;
  height: 5rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-surface-content, #3f3f46);
  overflow: hidden;
}

.rg-stats__bar-fill {
  display: block;
  width: 100%;
  border-radius: inherit;
  background: var(--rg-color-primary, #f59e0b);
}

.rg-stats__bar-label {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-tiny, 0.625rem);
}

.rg-stats__summary {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
  margin: 0;
}

.rg-stats__summary-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-stats__summary-row dt {
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-stats__summary-row dd {
  margin: 0;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  font-weight: var(--rg-text-weight-strong, 700);
  font-variant-numeric: tabular-nums;
}

.rg-stats__table-wrap {
  overflow-x: auto;
  border: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  border-radius: var(--rg-radius-md, 0.625rem);
}

.rg-stats__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-stats__table th,
.rg-stats__table td {
  padding: var(--rg-space-2, 0.75rem);
  border-bottom: var(--rg-border-width, 1px) solid var(--rg-color-border, #3f3f46);
  text-align: left;
  white-space: nowrap;
}

.rg-stats__table th {
  color: var(--rg-color-muted, #a1a1a1);
  font-weight: var(--rg-text-weight-strong, 700);
  text-transform: uppercase;
  font-size: var(--rg-text-tiny, 0.625rem);
}

.rg-stats__table td {
  color: var(--rg-color-foreground, #f7f7f2);
  font-variant-numeric: tabular-nums;
}
</style>
