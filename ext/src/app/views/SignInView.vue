<script setup lang="ts">
import { ref } from 'vue'
import { useAppI18n } from '@/app/i18n'
import { useConvexAuth } from '@/app/convex/auth'

const { t } = useAppI18n()
const signingIn = ref(false)
const { status, error, user, isAuthenticated, signIn } = useConvexAuth()

function emailOf(): string | null {
  if (isAuthenticated.value && user.value) {
    return user.value.email ?? user.value.name ?? null
  }
  return null
}

async function handleSignIn(): Promise<void> {
  signingIn.value = true
  try {
    await signIn()
  } catch {
    // The auth provider surfaces the failure through `error`.
  } finally {
    signingIn.value = false
  }
}
</script>

<template>
  <div class="rg-sign-in">
    <div class="rg-sign-in__brand">
      <svg
        class="rg-sign-in__logo"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="var(--rg-color-primary, #f59e0b)"
          opacity="0.9"
        />
        <path
          d="M17 15.5v17l15-8.5z"
          fill="var(--rg-color-primary-foreground, #1f2937)"
        />
      </svg>
      <h1 class="rg-sign-in__title">
        {{ t('sign-in.title') }}
      </h1>
      <p class="rg-sign-in__tagline">
        {{ t('sign-in.tagline') }}
      </p>
    </div>

    <p
      v-if="status === 'loading'"
      class="rg-sign-in__checking"
    >
      {{ t('sign-in.checking') }}
    </p>

    <div
      v-else-if="isAuthenticated"
      class="rg-sign-in__connected"
    >
      <p class="rg-sign-in__connected-text">
        <template v-if="emailOf()">
          {{ t('sign-in.connectedAs', { email: emailOf() as string }) }}
        </template>
        <template v-else>
          {{ t('sign-in.connectedAs', { email: '' }).replace(': ', '').replace('{email}', '') }}
        </template>
      </p>
    </div>

    <div
      v-else
      class="rg-sign-in__actions"
    >
      <p
        v-if="error && error === ''"
        class="rg-sign-in__error"
      />
      <p
        v-if="status === 'error' && error"
        class="rg-sign-in__error"
      >
        {{ t('sign-in.errorPrefix') }}: {{ error }}
      </p>
      <p
        v-else-if="status === 'unauthenticated'"
        class="rg-sign-in__hint"
      >
        {{ t('common.notConnected') }}
      </p>
      <button
        type="button"
        class="rg-btn"
        :disabled="signingIn"
        @click="handleSignIn"
      >
        {{ t('common.signIn') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.rg-sign-in {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--rg-space-4, 1.5rem);
  padding: var(--rg-space-6, 2.5rem) var(--rg-space-4, 1.5rem);
  text-align: center;
}

.rg-sign-in__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-3, 1rem);
}

.rg-sign-in__logo {
  width: 3rem;
  height: 3rem;
}

.rg-sign-in__title {
  margin: 0;
  font-size: var(--rg-text-title, 1.125rem);
  font-weight: var(--rg-text-weight-strong, 700);
  color: var(--rg-color-foreground, #f7f7f2);
}

.rg-sign-in__tagline {
  margin: 0;
  max-width: 16rem;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
  line-height: 1.4;
}

.rg-sign-in__checking {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-sign-in__connected {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-3, 1rem);
}

.rg-sign-in__connected-text {
  margin: 0;
  color: var(--rg-color-foreground, #f7f7f2);
  font-size: var(--rg-text-small, 0.75rem);
  word-break: break-word;
}

.rg-sign-in__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-3, 1rem);
  width: 100%;
}

.rg-sign-in__hint {
  margin: 0;
  color: var(--rg-color-muted, #a1a1a1);
  font-size: var(--rg-text-small, 0.75rem);
}

.rg-sign-in__error {
  margin: 0;
  color: var(--rg-color-danger, #f87171);
  font-size: var(--rg-text-small, 0.75rem);
  word-break: break-word;
}
</style>
