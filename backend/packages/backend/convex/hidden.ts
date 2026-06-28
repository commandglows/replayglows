import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireReplayGlowzAccess } from "./access";

// Maximum hidden items per user (free tier limit)
const MAX_HIDDEN_ITEMS = 100;

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get all hidden items for the current user
 */
export const getHiddenItems = query({
  args: {
    itemType: v.optional(v.union(v.literal("video"), v.literal("playlist"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return [];

    let items;
    if (args.itemType) {
      items = await ctx.db
        .query("hiddenItems")
        .withIndex("by_user_and_type", (q) =>
          q.eq("userId", userId).eq("itemType", args.itemType!)
        )
        .collect();
    } else {
      items = await ctx.db
        .query("hiddenItems")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    }

    return items.map((item) => ({
      id: item._id,
      itemType: item.itemType,
      youtubeId: item.youtubeId,
      hiddenAt: item.hiddenAt,
    }));
  },
});

/**
 * Get Set of hidden IDs for a specific item type (for filtering)
 */
export const getHiddenIds = query({
  args: {
    itemType: v.union(v.literal("video"), v.literal("playlist")),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return [];

    const items = await ctx.db
      .query("hiddenItems")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", userId).eq("itemType", args.itemType)
      )
      .collect();

    return items.map((item) => item.youtubeId);
  },
});

/**
 * Check if a specific item is hidden
 */
export const isItemHidden = query({
  args: {
    itemType: v.union(v.literal("video"), v.literal("playlist")),
    youtubeId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return false;

    const item = await ctx.db
      .query("hiddenItems")
      .withIndex("by_user_type_and_id", (q) =>
        q
          .eq("userId", userId)
          .eq("itemType", args.itemType)
          .eq("youtubeId", args.youtubeId)
      )
      .first();

    return !!item;
  },
});

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Hide an item (video or playlist)
 * Enforces max limit by removing oldest items (FIFO)
 */
export const hideItem = mutation({
  args: {
    itemType: v.union(v.literal("video"), v.literal("playlist")),
    youtubeId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Check if already hidden
    const existing = await ctx.db
      .query("hiddenItems")
      .withIndex("by_user_type_and_id", (q) =>
        q
          .eq("userId", userId)
          .eq("itemType", args.itemType)
          .eq("youtubeId", args.youtubeId)
      )
      .first();

    if (existing) {
      // Already hidden, nothing to do
      return { alreadyHidden: true, removedCount: 0 };
    }

    // Get current count of hidden items for this user
    const allHiddenItems = await ctx.db
      .query("hiddenItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let removedCount = 0;

    // If at or over limit, remove oldest items to make room
    if (allHiddenItems.length >= MAX_HIDDEN_ITEMS) {
      // Sort by hiddenAt ascending (oldest first)
      const sortedItems = allHiddenItems.sort((a, b) => a.hiddenAt - b.hiddenAt);

      // Remove enough items to be under limit (remove oldest)
      const itemsToRemove = sortedItems.slice(0, allHiddenItems.length - MAX_HIDDEN_ITEMS + 1);

      for (const item of itemsToRemove) {
        await ctx.db.delete(item._id);
        removedCount++;
      }
    }

    // Insert the new hidden item
    await ctx.db.insert("hiddenItems", {
      userId,
      itemType: args.itemType,
      youtubeId: args.youtubeId,
      hiddenAt: Date.now(),
    });

    return { alreadyHidden: false, removedCount };
  },
});

/**
 * Unhide an item (video or playlist)
 */
export const unhideItem = mutation({
  args: {
    itemType: v.union(v.literal("video"), v.literal("playlist")),
    youtubeId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db
      .query("hiddenItems")
      .withIndex("by_user_type_and_id", (q) =>
        q
          .eq("userId", userId)
          .eq("itemType", args.itemType)
          .eq("youtubeId", args.youtubeId)
      )
      .first();

    if (item) {
      await ctx.db.delete(item._id);
      return { wasHidden: true };
    }

    return { wasHidden: false };
  },
});
