import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { requireReplayGlowsAccess } from "./access";

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
    const userId = await requireReplayGlowsAccess(ctx);

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
    const userId = await requireReplayGlowsAccess(ctx);

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
    const userId = await requireReplayGlowsAccess(ctx);

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

// Project a provider subscription into local feature limits.
export const upsertSubscription = internalMutation({
  args: {
    provider: v.union(v.literal("polar"), v.literal("stripe")),
    providerCustomerId: v.string(),
    providerSubscriptionId: v.string(),
    providerProductId: v.string(),
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

    // A provider subscription ID is only meaningful within its provider.
    let existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_provider_subscription_id", (q) =>
        q.eq("provider", args.provider).eq("providerSubscriptionId", args.providerSubscriptionId)
      )
      .first();

    // A customer may replace a subscription within the same provider.
    if (!existingSubscription) {
      existingSubscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_provider_customer_id", (q) =>
          q.eq("provider", args.provider).eq("providerCustomerId", args.providerCustomerId)
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
      if (existingSubscription.provider && existingSubscription.provider !== args.provider) {
        throw new Error("Another payment provider already owns this local subscription");
      }
      await ctx.db.patch(existingSubscription._id, {
        plan: args.plan,
        status: args.status,
        provider: args.provider,
        providerCustomerId: args.providerCustomerId,
        providerSubscriptionId: args.providerSubscriptionId,
        providerProductId: args.providerProductId,
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
      provider: args.provider,
      providerCustomerId: args.providerCustomerId,
      providerSubscriptionId: args.providerSubscriptionId,
      providerProductId: args.providerProductId,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update the local projection from a verified provider event.
export const updateSubscriptionStatus = internalMutation({
  args: {
    provider: v.union(v.literal("polar"), v.literal("stripe")),
    providerSubscriptionId: v.string(),
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
      .withIndex("by_provider_subscription_id", (q) =>
        q.eq("provider", args.provider).eq("providerSubscriptionId", args.providerSubscriptionId)
      )
      .first();

    if (!subscription) {
      console.error(`Subscription not found: ${args.provider}:${args.providerSubscriptionId}`);
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
