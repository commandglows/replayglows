import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

// Clerk webhook endpoint for user sync
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET is not set");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Get the Svix headers for verification
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    // Get the body
    const body = await request.text();

    // Verify the webhook signature
    const wh = new Webhook(webhookSecret);
    let evt: ClerkWebhookEvent;

    try {
      evt = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      console.error("Webhook verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    // Idempotency check — skip if already processed
    const alreadyProcessed = await ctx.runMutation(internal.webhooks.checkAndMarkWebhook, {
      webhookId: svixId,
      source: "clerk",
    });
    if (alreadyProcessed) {
      return new Response("Already processed", { status: 200 });
    }

    // Handle the webhook event
    const eventType = evt.type;

    try {
      if (eventType === "user.created" || eventType === "user.updated") {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data;

        const primaryEmail = email_addresses.find(
          (email: { id: string }) => email.id === evt.data.primary_email_address_id
        );

        await ctx.runMutation(internal.users.upsertUser, {
          clerkId: id,
          email: primaryEmail?.email_address ?? "",
          name: [first_name, last_name].filter(Boolean).join(" ") || undefined,
          avatarUrl: image_url || undefined,
        });

        console.log(`User ${eventType === "user.created" ? "created" : "updated"}: ${id}`);
      }

      if (eventType === "user.deleted") {
        const { id } = evt.data;

        if (id) {
          await ctx.runMutation(internal.users.deleteUser, {
            clerkId: id,
          });

          console.log(`User deleted: ${id}`);
        }
      }
    } catch (err) {
      console.error(`Clerk webhook ${eventType} failed:`, err);
      return new Response("Webhook processing failed", { status: 500 });
    }

    return new Response("Webhook processed", { status: 200 });
  }),
});

// Polar webhook endpoint for subscription management
http.route({
  path: "/polar-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
    const wh = new Webhook(webhookSecret);
    let evt: PolarWebhookEvent;

    try {
      evt = wh.verify(body, {
        "webhook-id": webhookId,
        "webhook-timestamp": webhookTimestamp,
        "webhook-signature": webhookSignature,
      }) as PolarWebhookEvent;
    } catch (err) {
      console.error("Polar webhook verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    // Idempotency check — skip if already processed
    const alreadyProcessed = await ctx.runMutation(internal.webhooks.checkAndMarkWebhook, {
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
        const plan = mapPolarProductToPlan(subscription.product.id);

        await ctx.runMutation(internal.subscriptions.upsertSubscription, {
          polarCustomerId: customer.id,
          polarSubscriptionId: subscription.id,
          polarProductId: subscription.product.id,
          customerEmail: customer.email,
          plan,
          status: "active",
          currentPeriodStart: new Date(subscription.current_period_start).getTime(),
          currentPeriodEnd: new Date(subscription.current_period_end).getTime(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        console.log(`Subscription ${eventType}: ${subscription.id} for ${customer.email}`);
      }

      if (eventType === "subscription.canceled") {
        const subscription = evt.data as PolarSubscriptionData;

        await ctx.runMutation(internal.subscriptions.updateSubscriptionStatus, {
          polarSubscriptionId: subscription.id,
          status: "canceled",
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        console.log(`Subscription canceled: ${subscription.id}`);
      }

      if (eventType === "subscription.uncanceled") {
        const subscription = evt.data as PolarSubscriptionData;

        await ctx.runMutation(internal.subscriptions.updateSubscriptionStatus, {
          polarSubscriptionId: subscription.id,
          status: "active",
          cancelAtPeriodEnd: false,
        });

        console.log(`Subscription uncanceled (reactivated): ${subscription.id}`);
      }

      if (eventType === "subscription.revoked") {
        const subscription = evt.data as PolarSubscriptionData;

        await ctx.runMutation(internal.subscriptions.updateSubscriptionStatus, {
          polarSubscriptionId: subscription.id,
          status: "revoked",
          cancelAtPeriodEnd: false,
        });

        console.log(`Subscription revoked: ${subscription.id}`);
      }

      if (eventType === "subscription.past_due") {
        const subscription = evt.data as PolarSubscriptionData;

        await ctx.runMutation(internal.subscriptions.updateSubscriptionStatus, {
          polarSubscriptionId: subscription.id,
          status: "past_due",
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        console.log(`Subscription past due: ${subscription.id}`);
      }

      // Handle customer created - link to existing user by email
      if (eventType === "customer.created") {
        const customer = evt.data as PolarCustomerData;

        await ctx.runMutation(internal.subscriptions.linkCustomerToUser, {
          polarCustomerId: customer.id,
          customerEmail: customer.email,
        });

        console.log(`Customer created: ${customer.id} (${customer.email})`);
      }
    } catch (err) {
      console.error(`Polar webhook ${eventType} failed:`, err);
      return new Response("Webhook processing failed", { status: 500 });
    }

    return new Response("Webhook processed", { status: 200 });
  }),
});

// Map Polar product IDs to plan names
// Update these IDs with your actual Polar product IDs
function mapPolarProductToPlan(productId: string): "free" | "pro" | "team" {
  const productMap: Record<string, "free" | "pro" | "team"> = {
    // Add your Polar product IDs here
    "3c20cb58-bbc8-4616-837d-6b2165d9b24d": "pro",
    // "prod_yyy": "team",
  };

  return productMap[productId] ?? "pro"; // Default to pro for unknown products
}

// Type definitions for Clerk webhook events
interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{
      id: string;
      email_address: string;
    }>;
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
}

// Type definitions for Polar webhook events
interface PolarSubscriptionData {
  id: string;
  customer: {
    id: string;
    email: string;
  };
  product: {
    id: string;
    name: string;
  };
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  status: string;
}

interface PolarCustomerData {
  id: string;
  email: string;
}

interface PolarWebhookEvent {
  type: string;
  data: PolarSubscriptionData | PolarCustomerData;
}

export default http;
