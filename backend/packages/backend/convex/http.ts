import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import { polarWebhookHandler } from './billing/polarWebhook';
import { relayReplayStripeWebhook } from './billing/stripeAdapter';

const http = httpRouter();

http.route({
  path: '/stripe-webhook',
  method: 'POST',
  handler: httpAction(async (_ctx, request) => relayReplayStripeWebhook(request)),
});

const noteImageCorsHeaders = {
  "Access-Control-Allow-Origin": "https://app.replayglows.com",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

http.route({
  path: "/note-image",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { headers: noteImageCorsHeaders })),
});

http.route({
  path: "/note-image",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    const identity = await ctx.auth.getUserIdentity();
    if (origin !== "https://app.replayglows.com" || !identity) {
      return new Response("Unauthorized", { status: 401, headers: noteImageCorsHeaders });
    }
    const noteId = new URL(request.url).searchParams.get("noteId");
    if (!noteId) return new Response("Not found", { status: 404, headers: noteImageCorsHeaders });
    const storageId = await ctx.runQuery(internal.notes.getCaptureImageForCurrentUser, {
      noteId: noteId as never,
    });
    if (!storageId) return new Response("Not found", { status: 404, headers: noteImageCorsHeaders });
    const blob = await ctx.storage.get(storageId);
    if (!blob) return new Response("Not found", { status: 404, headers: noteImageCorsHeaders });
    return new Response(blob, {
      headers: {
        ...noteImageCorsHeaders,
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }),
});

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

http.route({
  path: '/polar-webhook',
  method: 'POST',
  handler: polarWebhookHandler,
});

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

export default http;
