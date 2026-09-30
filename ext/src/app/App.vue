<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAppI18n } from '@/app/i18n'
import { useConvexAuth } from '@/app/convex/auth'
import SignedOutView from './views/SignedOutView.vue'

const route = useRoute()
const { t, locale } = useAppI18n()
const { authState } = useConvexAuth()

const isCompact = ref(false)

function updateLayout() { isCompact.value = window.innerWidth < 600 }

onMounted(() => { updateLayout(); window.addEventListener('resize', updateLayout) })
onUnmounted(() => window.removeEventListener('resize', updateLayout))

const primaryRoutes = [
  { path: '/feed', label: { fr: 'Fil', en: 'Feed' } },
  { path: '/play', label: { fr: 'Lire', en: 'Play' } },
  { path: '/playlists', label: { fr: 'Listes', en: 'Lists' } },
  { path: '/notes', label: { fr: 'Notes', en: 'Notes' } },
]

const secondaryRoutes = [
  { path: '/notifications', label: { fr: 'Alertes', en: 'Alerts' } },
  { path: '/preferences', label: { fr: 'Réglages', en: 'Settings' } },
  { path: '/hidden', label: { fr: 'Masqués', en: 'Hidden' } },
  { path: '/stats', label: { fr: 'Stats', en: 'Stats' } },
]

function isActive(path: string) { return route.path === path || route.path.startsWith(path + '/') }
</script>

<template>
  <!-- Sign-in gate: show sign-in if unauthenticated -->
  <div
    v-if="authState.status === 'loading'"
    class="rg-loading"
  >
    {{ t('common.loading') }}
  </div>

  <div
    v-else-if="authState.status === 'unauthenticated' || authState.status === 'error'"
    class="rg-shell-logged-out"
  >
    <SignedOutView />
  </div>

  <div
    v-else
    class="rg-app-shell"
  >
    <!-- Compact: bottom navigation -->
    <nav
      v-if="isCompact"
      class="rg-bottom-nav"
      aria-label="Primary"
    >
      <router-link
        v-for="item in primaryRoutes"
        :key="item.path"
        :to="item.path"
        class="rg-nav-item"
        :class="{ 'rg-nav-item--active': isActive(item.path) }"
      >
        {{ item.label[locale] }}
      </router-link>
    </nav>

    <!-- Wide: side rail -->
    <aside
      v-else
      class="rg-side-nav"
      aria-label="Primary"
    >
      <div class="rg-side-nav__brand">
        R
      </div>
      <router-link
        v-for="item in primaryRoutes"
        :key="item.path"
        :to="item.path"
        class="rg-nav-item"
        :class="{ 'rg-nav-item--active': isActive(item.path) }"
      >
        {{ item.label[locale] }}
      </router-link>
    </aside>

    <!-- Main content area -->
    <div class="rg-main">
      <header class="rg-header">
        <div class="rg-header__left">
          {{ t((['feed','play','playlists','notes','notifications','preferences','hidden','stats'].find(n => n === route.name) ?? 'feed') + '.title' as any) }}
        </div>
        <div class="rg-header__right">
          <router-link
            v-for="item in secondaryRoutes"
            :key="item.path"
            :to="item.path"
            class="rg-secondary-link"
            :class="{ 'rg-secondary-link--active': isActive(item.path) }"
          >
            {{ item.label[locale] }}
          </router-link>
        </div>
      </header>
      <main class="rg-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.rg-loading { display:flex; align-items:center; justify-content:center; min-height:100vh; color:var(--rg-color-muted); font-family:var(--rg-font-body); }
.rg-shell-logged-out { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:var(--rg-space-3); }

.rg-app-shell { display:flex; min-height:100vh; }

.rg-side-nav { width:var(--rg-side-nav-width,72px); background:var(--rg-color-surface); display:flex; flex-direction:column; align-items:center; padding:var(--rg-space-2) 0; gap:var(--rg-space-1); border-right:1px solid var(--rg-color-border); }
.rg-side-nav__brand { width:40px; height:40px; border-radius:var(--rg-radius-sm); background:var(--rg-color-primary); color:var(--rg-color-primary-foreground); display:flex; align-items:center; justify-content:center; font-weight:var(--rg-text-weight-strong); margin-bottom:var(--rg-space-2); font-size:1.125rem; }

.rg-nav-item { padding:var(--rg-space-1) var(--rg-space-2); border-radius:var(--rg-radius-sm); color:var(--rg-color-muted); text-decoration:none; font-size:0.875rem; text-align:center; transition:background var(--rg-motion-fast) var(--rg-ease), color var(--rg-motion-fast) var(--rg-ease); }
.rg-nav-item:hover, .rg-nav-item--active { color:var(--rg-color-primary); background:color-mix(in oklab, var(--rg-color-primary) 12%, transparent); }

.rg-main { flex:1; display:flex; flex-direction:column; min-width:0; }
.rg-header { display:flex; align-items:center; justify-content:space-between; padding:var(--rg-space-1) var(--rg-space-3); background:var(--rg-color-surface); border-bottom:1px solid var(--rg-color-border); gap:var(--rg-space-2); }
.rg-header__left { font-weight:var(--rg-text-weight-strong); font-size:1.125rem; white-space:nowrap; }
.rg-header__right { display:flex; gap:var(--rg-space-1); flex-wrap:wrap; }
.rg-secondary-link { color:var(--rg-color-muted); text-decoration:none; font-size:0.8125rem; padding:var(--rg-space-1); border-radius:var(--rg-radius-sm); transition:color var(--rg-motion-fast) var(--rg-ease); }
.rg-secondary-link:hover, .rg-secondary-link--active { color:var(--rg-color-foreground); }

.rg-content { flex:1; overflow-y:auto; padding:var(--rg-space-3); }

.rg-bottom-nav { position:fixed; bottom:0; left:0; right:0; display:flex; background:var(--rg-color-surface); border-top:1px solid var(--rg-color-border); padding:var(--rg-space-1); z-index:var(--rg-layer-header); gap:var(--rg-space-1); }
.rg-bottom-nav .rg-nav-item { flex:1; padding:var(--rg-space-1); font-size:0.8125rem; }
</style>
