import { Webhook } from 'svix'

export interface PolarSubscriptionData {
  id: string
  customer: { id: string; email: string }
  product: { id: string; name: string }
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  status: string
}

export interface PolarWebhookEvent {
  type: string
  data: PolarSubscriptionData
}

export function verifyPolarWebhook(body: string, headers: Record<string, string>, secret: string): PolarWebhookEvent {
  return new Webhook(secret).verify(body, headers) as PolarWebhookEvent
}

export function polarPlanForProduct(productId: string, env: Record<string, string | undefined> = process.env): 'pro' | 'team' | null {
  const pairs: [string | undefined, 'pro' | 'team'][] = [
    [env.POLAR_PRODUCT_ID_PRO_MONTHLY, 'pro'],
    [env.POLAR_PRODUCT_ID_PRO_ANNUAL, 'pro'],
  ]
  return pairs.find(([id]) => id && id === productId)?.[1] ?? null
}
