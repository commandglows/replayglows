import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { getConvexClient } from './client'

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'error'

export interface AuthUser {
  id: string
  email?: string
  name?: string
  avatarUrl?: string
}

export interface AuthState {
  status: AuthStatus
  user?: AuthUser | null
  error?: string | null
}

/**
 * Auth contract for the full extension page. The provider is intentionally
 * pluggable: the parity chantier decided to spike the suite product customJwt
 * path first (decisions D1) and fall back to Clerk session acquisition. Until
 * that provider lands, the page stays in the unauthenticated state and the
 * shell shows the sign-in view.
 */
export interface AuthProvider {
  readonly state: ComputedRef<AuthState>
  init(): Promise<void>
  signIn(): Promise<void>
  signOut(): Promise<void>
  getToken(): Promise<string | null>
}

const authState: Ref<AuthState> = ref<AuthState>({ status: 'loading' })
let provider: AuthProvider | null = null

export function registerAuthProvider(next: AuthProvider): void {
  provider = next
}

export function useAuthProvider(): AuthProvider | null {
  return provider
}

export async function initialiseAuth(): Promise<void> {
  if (!provider) {
    // No provider yet: fail closed to the unauthenticated state so the shell
    // never renders product data without a verified session.
    authState.value = { status: 'unauthenticated' }
    return
  }
  authState.value = { status: 'loading' }
  await provider.init()
  authState.value = provider.state.value
}

export function useConvexAuth() {
  const status: ComputedRef<AuthStatus> = computed(() => authState.value.status)
  const user: ComputedRef<AuthUser | null> = computed(() => authState.value.user ?? null)
  const error: ComputedRef<string | null> = computed(() => authState.value.error ?? null)
  const isAuthenticated = computed(() => status.value === 'authenticated')

  async function refresh(): Promise<void> {
    await initialiseAuth()
  }

  async function signIn(): Promise<void> {
    if (provider) await provider.signIn()
    else await refresh()
  }

  async function signOut(): Promise<void> {
    if (provider) {
      await provider.signOut()
    } else {
      authState.value = { status: 'unauthenticated' }
    }
    await refresh()
  }

  return { authState, status, user, error, isAuthenticated, refresh, signIn, signOut }
}

export { authState }

export function convexTokenValidOrThrow(): void {
  if (authState.value.status !== 'authenticated') {
    throw new Error('Missing Convex auth token')
  }
  void getConvexClient()
}