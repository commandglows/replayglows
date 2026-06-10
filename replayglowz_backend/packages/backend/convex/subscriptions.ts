import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireReplayGlowzAccess } from "./access";

// Plan types and their features
export const PLANS = {
  free: {
    name: "Free",
    maxVideos: 10,
    maxNotesPerVideo: 50,
    maxPlaylists: 3,
    aiSummaries: false,
    exportNotes: false,
    dailyQuotaLimit: 1000,
  },
  pro: {
    name: "Pro",
    maxVideos: 100,
    maxNotesPerVideo: 500,
    maxPlaylists: 20,
    aiSummaries: true,
    exportNotes: true,
    dailyQuotaLimit: 10000,
  },
  team: {
    name: "Team",
    maxVideos: -1, // unlimited
    maxNotesPerVideo: -1,
    maxPlaylists: -1,
    aiSummaries: true,
    exportNotes: true,
    dailyQuotaLimit: 50000,
  },
} as const;

// Get current user's subscription
export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!subscription) {
      // Return default free subscription
      return {
        plan: "free" as const,
        status: "active" as const,
        features: PLANS.free,
        cancelAtPeriodEnd: false,
      };
    }

    return {
      ...subscription,
      features: PLANS[subscription.plan],
    };
  },
});

// Get subscription limits for the current user
export const getSubscriptionLimits = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!subscription) return PLANS.free;

    return PLANS[subscription.plan];
  },
});

// Check if user can perform an action based on their plan
export const checkLimit = query({
  args: {
    feature: v.union(
      v.literal("videos"),
      v.literal("notesPerVideo"),
      v.literal("playlists"),
      v.literal("aiSummaries"),
      v.literal("exportNotes")
    ),
    currentCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    const plan = subscription?.plan ?? "free";
    const features = PLANS[plan];

    switch (args.feature) {
      case "videos":
        if (features.maxVideos === -1) return { allowed: true };
        if (args.currentCount !== undefined && args.currentCount >= features.maxVideos) {
          return {
            allowed: false,
            reason: `You've reached the limit of ${features.maxVideos} videos on the ${features.name} plan`,
          };
        }
        return { allowed: true };

      case "notesPerVideo":
        if (features.maxNotesPerVideo === -1) return { allowed: true };
        if (args.currentCount !== undefined && args.currentCount >= features.maxNotesPerVideo) {
          return {
            allowed: false,
            reason: `You've reached the limit of ${features.maxNotesPerVideo} notes per video on the ${features.name} plan`,
          };
        }
        return { allowed: true };

      case "playlists":
        if (features.maxPlaylists === -1) return { allowed: true };
        if (args.currentCount !== undefined && args.currentCount >= features.maxPlaylists) {
          return {
            allowed: false,
            reason: `You've reached the limit of ${features.maxPlaylists} playlists on the ${features.name} plan`,
          };
        }
        return { allowed: true };

      case "aiSummaries":
        if (!features.aiSummaries) {
          return {
            allowed: false,
            reason: "AI summaries are not available on the Free plan",
          };
        }
        return { allowed: true };

      case "exportNotes":
        if (!features.exportNotes) {
          return {
            allowed: false,
            reason: "Note export is not available on the Free plan",
          };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: "Unknown feature" };
    }
  },
});

// Upsert subscription from Polar webhook
export const upsertSubscription = internalMutation({
  args: {
    polarCustomerId: v.string(),
    polarSubscriptionId: v.string(),
    polarProductId: v.string(),
    customerEmail: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("team")),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.literal("revoked")
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Try to find existing subscription by Polar subscription ID
    let existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_polar_subscription_id", (q) =>
        q.eq("polarSubscriptionId", args.polarSubscriptionId)
      )
      .first();

    // If not found, try by Polar customer ID
    if (!existingSubscription) {
      existingSubscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_polar_customer_id", (q) =>
          q.eq("polarCustomerId", args.polarCustomerId)
        )
        .first();
    }

    // If still not found, try to find user by email and link
    if (!existingSubscription) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.customerEmail))
        .first();

      if (user) {
        // Check if user already has a subscription
        existingSubscription = await ctx.db
          .query("subscriptions")
          .withIndex("by_user_id", (q) => q.eq("userId", user.clerkId))
          .first();
      }
    }

    if (existingSubscription) {
      await ctx.db.patch(existingSubscription._id, {
        plan: args.plan,
        status: args.status,
        polarCustomerId: args.polarCustomerId,
        polarSubscriptionId: args.polarSubscriptionId,
        polarProductId: args.polarProductId,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        updatedAt: now,
      });
      return existingSubscription._id;
    }

    // Find user by email to create new subscription
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.customerEmail))
      .first();

    if (!user) {
      console.error(`No user found for email: ${args.customerEmail}`);
      throw new Error("User not found");
    }

    return await ctx.db.insert("subscriptions", {
      userId: user.clerkId,
      plan: args.plan,
      status: args.status,
      polarCustomerId: args.polarCustomerId,
      polarSubscriptionId: args.polarSubscriptionId,
      polarProductId: args.polarProductId,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update subscription status from Polar webhook
export const updateSubscriptionStatus = internalMutation({
  args: {
    polarSubscriptionId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.literal("revoked")
    ),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_polar_subscription_id", (q) =>
        q.eq("polarSubscriptionId", args.polarSubscriptionId)
      )
      .first();

    if (!subscription) {
      console.error(`Subscription not found: ${args.polarSubscriptionId}`);
      return;
    }

    await ctx.db.patch(subscription._id, {
      status: args.status,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      updatedAt: Date.now(),
    });

    // If revoked, downgrade to free
    if (args.status === "revoked") {
      await ctx.db.patch(subscription._id, {
        plan: "free",
      });
    }
  },
});

// Link Polar customer to existing user by email
export const linkCustomerToUser = internalMutation({
  args: {
    polarCustomerId: v.string(),
    customerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.customerEmail))
      .first();

    if (!user) {
      console.log(`No user found for email: ${args.customerEmail}, will link when subscription created`);
      return;
    }

    // Check if user already has a subscription
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", user.clerkId))
      .first();

    if (existingSubscription) {
      // Update with Polar customer ID
      await ctx.db.patch(existingSubscription._id, {
        polarCustomerId: args.polarCustomerId,
        updatedAt: Date.now(),
      });
    }
    // If no subscription exists, it will be created when subscription.created fires
  },
});

// Cancel subscription (user-initiated via Polar portal)
export const cancelSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (subscription) {
      // Note: This just marks it locally. Real cancellation should go through Polar
      await ctx.db.patch(subscription._id, {
        cancelAtPeriodEnd: true,
        updatedAt: Date.now(),
      });
    }
  },
});

// Get all plan options for pricing page
export const getPlans = query({
  args: {},
  handler: async () => {
    return Object.entries(PLANS).map(([key, value]) => ({
      id: key,
      ...value,
    }));
  },
});

// Get Polar checkout URL (to be used with Polar SDK on frontend)
export const getPolarCheckoutInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    if (!user) return null;

    return {
      email: user.email,
      userId: userId,
    };
  },
});
