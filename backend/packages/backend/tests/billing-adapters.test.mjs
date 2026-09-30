import assert from 'node:assert/strict'
import test from 'node:test'
import { polarPlanForProduct } from '../convex/billing/polarAdapter.ts'
import { replayStripeMerchant, verifyReplayStripeEvent, relayReplayStripeWebhook } from '../convex/billing/stripeAdapter.ts'

test('Polar products must be explicitly known', () => {
  const env = { POLAR_PRODUCT_ID_PRO_MONTHLY: 'polar_pro' }
  assert.equal(polarPlanForProduct('polar_pro', env), 'pro')
  assert.equal(polarPlanForProduct('polar_power', env), null)
  assert.equal(polarPlanForProduct('unrecognized', env), null)
})

test('ReplayGlows Stripe adapter requires its own complete merchant configuration', () => {
  const env = { STRIPE_REPLAYGLOWS_ACCOUNT_ID: 'acct_replay123', STRIPE_REPLAYGLOWS_SECRET_KEY: 'sk_test_replay',
    STRIPE_REPLAYGLOWS_WEBHOOK_SECRET: 'whsec_replay', STRIPE_SECRET_KEY: 'sk_test_command' }
  assert.deepEqual(replayStripeMerchant(env), { accountId: 'acct_replay123', secretKey: 'sk_test_replay', webhookSecret: 'whsec_replay' })
  assert.equal(replayStripeMerchant({ ...env, STRIPE_REPLAYGLOWS_SECRET_KEY: undefined }), null)
  assert.equal(replayStripeMerchant({ ...env, STRIPE_REPLAYGLOWS_ACCOUNT_ID: 'invalid' }), null)
})

test('ReplayGlows Stripe adapter rejects a key bound to another account', async () => {
  const config = { accountId: 'acct_replay123', secretKey: 'sk_test_replay', webhookSecret: 'whsec_replay' }
  const stripe = { webhooks: { constructEventAsync: async () => ({ id: 'evt_test', livemode: false }) },
    accounts: { retrieve: async () => ({ id: 'acct_command123' }) } }
  await assert.rejects(verifyReplayStripeEvent('{}', 't=1,v1=signature', config, stripe), /stripe_account_mismatch/)
})

test('ReplayGlows Stripe adapter rejects a signed event from another account or mode', async () => {
  const config = { accountId: 'acct_replay123', secretKey: 'sk_test_replay', webhookSecret: 'whsec_replay' }
  const stripe = { webhooks: { constructEventAsync: async () => ({ id: 'evt_test', livemode: false, account: 'acct_other' }) },
    accounts: { retrieve: async () => ({ id: 'acct_replay123' }) } }
  await assert.rejects(verifyReplayStripeEvent('{}', 'signature', config, stripe), /stripe_account_mismatch/)
  stripe.webhooks.constructEventAsync = async () => ({ id: 'evt_test', livemode: true })
  await assert.rejects(verifyReplayStripeEvent('{}', 'signature', config, stripe), /stripe_mode_mismatch/)
})

test('Stripe ingress relays the original signed body only to the configured central route', async () => {
  const env = { STRIPE_REPLAYGLOWS_ACCOUNT_ID: 'acct_replay123', STRIPE_REPLAYGLOWS_SECRET_KEY: 'sk_test_replay',
    STRIPE_REPLAYGLOWS_WEBHOOK_SECRET: 'whsec_replay',
    STRIPE_REPLAYGLOWS_COMMERCE_WEBHOOK_URL: 'https://dev.commandglows.com/api/commerce/webhooks/replayglows' }
  const body = '{"id":"evt_test", "livemode":false}\n'
  const stripe = { webhooks: { constructEventAsync: async (raw, signature, secret) => {
    assert.equal(new TextDecoder().decode(raw), body)
    assert.equal(signature, 'signed')
    assert.equal(secret, 'whsec_replay')
    return { id: 'evt_test', livemode: false }
  } }, accounts: { retrieve: async () => ({ id: 'acct_replay123' }) } }
  let calls = 0
  const fetch = async (url, options) => {
    calls++
    assert.equal(url.toString(), env.STRIPE_REPLAYGLOWS_COMMERCE_WEBHOOK_URL)
    assert.equal(new TextDecoder().decode(options.body), body)
    assert.equal(options.headers['stripe-signature'], 'signed')
    return new Response('ok', { status: 200 })
  }
  const request = () => new Request('https://replayglows.test/stripe-webhook', { method: 'POST', body,
    headers: { 'stripe-signature': 'signed' } })
  assert.equal((await relayReplayStripeWebhook(request(), env, { stripe, fetch })).status, 200)
  assert.equal(calls, 1)
  assert.equal((await relayReplayStripeWebhook(request(), { ...env,
    STRIPE_REPLAYGLOWS_COMMERCE_WEBHOOK_URL: 'https://dev.commandglows.com/other' }, { stripe, fetch })).status, 503)
  assert.equal(calls, 1)
})

test('Stripe ingress fails closed without the business configuration', async () => {
  const request = new Request('https://replayglows.test/stripe-webhook', { method: 'POST', body: '{}',
    headers: { 'stripe-signature': 't=1,v1=invalid' } })
  assert.equal((await relayReplayStripeWebhook(request, {})).status, 503)
})
