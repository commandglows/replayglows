import Stripe from 'stripe'

export interface StripeMerchantConfig {
  accountId: string
  secretKey: string
  webhookSecret: string
}

export function replayStripeMerchant(env: Record<string, string | undefined> = process.env): StripeMerchantConfig | null {
  const accountId = env.STRIPE_REPLAYGLOWS_ACCOUNT_ID?.trim()
  const secretKey = env.STRIPE_REPLAYGLOWS_SECRET_KEY?.trim()
  const webhookSecret = env.STRIPE_REPLAYGLOWS_WEBHOOK_SECRET?.trim()
  if (!accountId || !/^acct_[A-Za-z0-9]+$/.test(accountId) || !secretKey || !/^sk_(test|live)_/.test(secretKey) || !webhookSecret) return null
  return { accountId, secretKey, webhookSecret }
}

/** Verify a ReplayGlows Stripe event before any product or entitlement projection. */
export async function verifyReplayStripeEvent(
  rawBody: string | Uint8Array,
  signature: string,
  config: StripeMerchantConfig,
  stripe: Stripe = new Stripe(config.secretKey),
): Promise<Stripe.Event> {
  if (!signature) throw new Error('stripe_signature_required')
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, config.webhookSecret)
  } catch {
    throw new Error('stripe_signature_invalid')
  }
  let account: Stripe.Account
  try {
    account = await stripe.accounts.retrieve(null)
  } catch {
    throw new Error('stripe_verification_unavailable')
  }
  if (account.id !== config.accountId) throw new Error('stripe_account_mismatch')
  if (event.account && event.account !== config.accountId) throw new Error('stripe_account_mismatch')
  if (typeof event.livemode !== 'boolean' ||
      event.livemode !== config.secretKey.startsWith('sk_live_')) throw new Error('stripe_mode_mismatch')
  return event
}

export async function relayReplayStripeWebhook(
  request: Request,
  env: Record<string, string | undefined> = process.env,
  dependencies: { stripe?: Stripe; fetch?: typeof fetch } = {},
): Promise<Response> {
  const config = replayStripeMerchant(env)
  const target = env.STRIPE_REPLAYGLOWS_COMMERCE_WEBHOOK_URL
  if (!config || !target) return new Response('Stripe merchant is not configured', { status: 503 })
  let destination: URL
  try {
    destination = new URL(target)
    if (destination.protocol !== 'https:' || !destination.hostname || destination.username || destination.password ||
      destination.search || destination.hash || destination.pathname !== '/api/commerce/webhooks/replayglows') throw new Error('invalid_target')
  } catch {
    return new Response('Stripe commerce destination is invalid', { status: 503 })
  }
  const signature = request.headers.get('stripe-signature') ?? ''
  const body = new Uint8Array(await request.arrayBuffer())
  try {
    await verifyReplayStripeEvent(body, signature, config, dependencies.stripe)
  } catch (error) {
    const reason = error instanceof Error ? error.message : ''
    return ['stripe_account_mismatch', 'stripe_mode_mismatch', 'stripe_verification_unavailable'].includes(reason)
      ? new Response('Stripe merchant verification unavailable', { status: 503 })
      : new Response('Invalid Stripe event', { status: 400 })
  }
  try {
    const forwarded = await (dependencies.fetch ?? fetch)(destination, { method: 'POST', body: body.buffer, redirect: 'manual', headers: {
      'stripe-signature': signature, 'content-type': 'application/json',
    } })
    if (!forwarded.ok) return new Response('Commerce processing unavailable', { status: 502 })
    return new Response('Webhook processed', { status: 200 })
  } catch {
    return new Response('Commerce processing unavailable', { status: 502 })
  }
}
