import { httpAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { polarPlanForProduct, verifyPolarWebhook, type PolarWebhookEvent, type PolarSubscriptionData } from './polarAdapter'

export const polarWebhookHandler = httpAction(async (ctx, request) => {
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("POLAR_WEBHOOK_SECRET is not set");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Get the Svix headers for verification (Polar uses Standard Webhooks)
    const webhookId = request.headers.get("webhook-id");
    const webhookTimestamp = request.headers.get("webhook-timestamp");
    const webhookSignature = request.headers.get("webhook-signature");

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      return new Response("Missing webhook headers", { status: 400 });
    }

    // Get the body
    const body = await request.text();

    // Verify the webhook signature
    let evt: PolarWebhookEvent;

    try {
      evt = verifyPolarWebhook(body, {
        "webhook-id": webhookId,
        "webhook-timestamp": webhookTimestamp,
        "webhook-signature": webhookSignature,
      }, webhookSecret);
    } catch (err) {
      console.error("Polar webhook verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    // Idempotency check — skip if already processed
    const alreadyProcessed = await ctx.runQuery(internal.webhooks.hasProcessedWebhook, {
      webhookId: webhookId,
      source: "polar",
    });
    if (alreadyProcessed) {
      return new Response("Already processed", { status: 200 });
    }

    const eventType = evt.type;

    try {
      // Handle subscription events
      if (eventType === "subscription.created" || eventType === "subscription.updated" || eventType === "subscription.active") {
        const subscription = evt.data as PolarSubscriptionData;
        const customer = subscription.customer;

        // Map Polar product to our plan
        const plan = polarPlanForProduct(subscription.product.id);
        if (!plan) throw new Error('Unknown Polar product');

        await ctx.runMutation(internal.subscriptions.upsertSubscription, {
          provider: "polar",
          providerCustomerId: customer.id,
          providerSubscriptionId: subscription.id,
          providerProductId: subscription.product.id,
          customerEmail: customer.email,
          plan,
          status: "active",
          currentPeriodStart: new Date(subscription.current_period_start).getTime(),
          currentPeriodEnd: new Date(subscription.current_period_end).getTime(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        console.log(`Subscription ${eventType}: ${subscription.id}`);
      }

      if (eventType === "subscription.canceled") {
        const subscription = evt.data as PolarSubscriptionData;

        await ctx.runMutation(internal.subscriptions.updateSubscriptionStatus, {
          provider: "polar",
          providerSubscriptionId: subscription.id,
          status: "canceled",
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        console.log(`Subscription canceled: ${subscription.id}`);
      }

      if (eventType === "subscription.uncanceled") {
        const subscription = evt.data as PolarSubscriptionData;

        await ctx.runMutation(internal.subscriptions.updateSubscriptionStatus, {
          provider: "polar",
          providerSubscriptionId: subscription.id,
          status: "active",
          cancelAtPeriodEnd: false,
        });

        console.log(`Subscription uncanceled (reactivated): ${subscription.id}`);
      }

      if (eventType === "subscription.revoked") {
        const subscription = evt.data as PolarSubscriptionData;

        await ctx.runMutation(internal.subscriptions.updateSubscriptionStatus, {
          provider: "polar",
          providerSubscriptionId: subscription.id,
          status: "revoked",
          cancelAtPeriodEnd: false,
        });

        console.log(`Subscription revoked: ${subscription.id}`);
      }

      if (eventType === "subscription.past_due") {
        const subscription = evt.data as PolarSubscriptionData;

        await ctx.runMutation(internal.subscriptions.updateSubscriptionStatus, {
          provider: "polar",
          providerSubscriptionId: subscription.id,
          status: "past_due",
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        console.log(`Subscription past due: ${subscription.id}`);
      }

    } catch (err) {
      console.error(`Polar webhook ${eventType} failed:`, err);
      return new Response("Webhook processing failed", { status: 500 });
    }

    await ctx.runMutation(internal.webhooks.checkAndMarkWebhook, { webhookId, source: 'polar' });
    return new Response("Webhook processed", { status: 200 });
});
