import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireReplayGlowzAccess } from "./access";

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get all watched video IDs for the current user
 */
export const getWatchedIds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return [];

    const items = await ctx.db
      .query("watchedVideos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return items.map((item) => item.youtubeVideoId);
  },
});

/**
 * Get all watched videos with metadata for the current user
 */
export const getWatchedVideos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return [];

    const items = await ctx.db
      .query("watchedVideos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return items.map((item) => ({
      id: item._id,
      youtubeVideoId: item.youtubeVideoId,
      watchedAt: item.watchedAt,
    }));
  },
});

/**
 * Check if a specific video is watched
 */
export const isVideoWatched = query({
  args: {
    youtubeVideoId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return false;

    const item = await ctx.db
      .query("watchedVideos")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();

    return !!item;
  },
});

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Mark a video as watched
 */
export const markAsWatched = mutation({
  args: {
    youtubeVideoId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Check if already watched
    const existing = await ctx.db
      .query("watchedVideos")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();

    if (existing) {
      // Update the watchedAt timestamp
      await ctx.db.patch(existing._id, { watchedAt: Date.now() });
      return { alreadyWatched: true };
    }

    // Insert new watched record
    await ctx.db.insert("watchedVideos", {
      userId,
      youtubeVideoId: args.youtubeVideoId,
      watchedAt: Date.now(),
    });

    return { alreadyWatched: false };
  },
});

/**
 * Unmark a video as watched
 */
export const unmarkAsWatched = mutation({
  args: {
    youtubeVideoId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db
      .query("watchedVideos")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();

    if (item) {
      await ctx.db.delete(item._id);
      return { wasWatched: true };
    }

    return { wasWatched: false };
  },
});

/**
 * Clear all watch history
 */
export const clearWatchHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const items = await ctx.db
      .query("watchedVideos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    return { deletedCount: items.length };
  },
});
