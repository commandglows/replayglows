import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Check if a webhook has already been processed (idempotency guard).
 * Returns true if already processed, false if new.
 * If new, marks it as processed atomically.
 */
export const checkAndMarkWebhook = internalMutation({
  args: {
    webhookId: v.string(),
    source: v.union(v.literal("clerk"), v.literal("polar")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processedWebhooks")
      .withIndex("by_webhook_id", (q) => q.eq("webhookId", args.webhookId))
      .first();

    if (existing) return true; // Already processed

    await ctx.db.insert("processedWebhooks", {
      webhookId: args.webhookId,
      source: args.source,
      processedAt: Date.now(),
    });

    return false; // First time — proceed
  },
});

/**
 * Cleanup old processed webhook records (older than 7 days).
 * Called by the existing daily cron.
 */
export const cleanupOldWebhooks = internalMutation({
  handler: async (ctx) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("processedWebhooks")
      .filter((q) => q.lt(q.field("processedAt"), sevenDaysAgo))
      .collect();

    await Promise.all(old.map((w) => ctx.db.delete(w._id)));
    return old.length;
  },
});
