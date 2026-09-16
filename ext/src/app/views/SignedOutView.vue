<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAppI18n } from '@/app/i18n'
import LocalLibrary from './LocalLibrary.vue'
import SignInView from './SignInView.vue'
import WatchView from './WatchView.vue'

const route = useRoute()
const { t } = useAppI18n()
</script>

<template>
  <div class="rg-signed-out">
    <header class="rg-signed-out__topbar">
      <div class="rg-signed-out__mark">
        R
      </div>
      <h1 class="rg-signed-out__title">
        ReplayGlows
      </h1>
      <span class="rg-signed-out__local">
        {{ t('local.localOnly') }}
      </span>
    </header>

    <div class="rg-signed-out__grid">
      <main class="rg-signed-out__library">
        <WatchView v-if="route.name === 'watch'" />
        <LocalLibrary v-else />
      </main>

      <aside class="rg-signed-out__aside">
        <SignInView />
        <div class="rg-account-benefits">
          <h2 class="rg-account-benefits__title">
            {{ t('local.accountTitle') }}
          </h2>
          <ol class="rg-account-benefits__steps">
            <li>{{ t('local.stepOne') }}</li>
            <li>{{ t('local.stepTwo') }}</li>
            <li>{{ t('local.stepThree') }}</li>
          </ol>
          <p class="rg-account-benefits__optional">
            {{ t('local.accountOptional') }}
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.rg-signed-out {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-4, 1.5rem);
  padding: var(--rg-space-4, 1.5rem);
  background: var(--rg-color-bg, #0a0a0a);
}

.rg-signed-out__topbar {
  display: flex;
  align-items: center;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-signed-out__mark {
  width: 2rem;
  height: 2rem;
  border-radius: var(--rg-radius-sm, 0.375rem);
  background: var(--rg-color-primary, #0d87e1);
  color: var(--rg-color-primary-foreground, #0a0a0a);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--rg-text-weight-strong, 700);
}

.rg-signed-out__title {
  margin: 0;
  font-size: var(--rg-text-title, 1.125rem);
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.rg-signed-out__local {
  margin-left: auto;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-signed-out__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22rem;
  gap: var(--rg-space-4, 1.5rem);
  align-items: start;
}

.rg-signed-out__aside {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
  padding: var(--rg-space-4, 1.5rem);
  border: 1px solid var(--rg-color-border, #374151);
  border-radius: var(--rg-radius-md, 0.75rem);
  background: var(--rg-color-surface, #171717);
}

.rg-account-benefits {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2, 0.75rem);
}

.rg-account-benefits__title {
  margin: 0;
  font-size: var(--rg-text-body, 0.875rem);
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
  text-align: center;
}

.rg-account-benefits__steps {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-1, 0.5rem);
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  line-height: 1.4;
  text-align: left;
}

.rg-account-benefits__optional {
  margin: 0;
  padding-top: var(--rg-space-2, 0.75rem);
  border-top: 1px solid var(--rg-color-border, #374151);
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  text-align: center;
}

@media (max-width: 48rem) {
  .rg-signed-out__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>