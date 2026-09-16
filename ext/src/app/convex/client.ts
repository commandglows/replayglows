import { ConvexClient } from 'convex/browser'

// The Convex deployment URL is a public build-time constant (the Flutter web
// bundle exposes it in its shipped JS), not a secret. It is left empty until
// the parity chantier's auth spike confirms the deployment.
export const CONVEX_URL = ''

let client: ConvexClient | null = null

function assertUrl(url: string): asserts url is string {
  if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
    throw new Error('Convex deployment URL is not configured')
  }
}

export function initConvexClient(url: string = CONVEX_URL): ConvexClient {
  assertUrl(url)
  if (!client) {
    const c = new ConvexClient(url)
    c.setAuth(() => Promise.resolve(null))
    client = c
  }
  return client
}

export function getConvexClient(): ConvexClient {
  if (!client) throw new Error('Convex client not initialised')
  return client
}