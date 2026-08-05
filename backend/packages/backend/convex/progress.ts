import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireReplayGlowsAccess } from "./access";

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get all video progress records for the current user
 */
export const getAllProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) return [];

    const items = await ctx.db
      .query("videoProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return items.map((item) => ({
      youtubeVideoId: item.youtubeVideoId,
      progressSeconds: item.progressSeconds,
      durationSeconds: item.durationSeconds,
      updatedAt: item.updatedAt,
    }));
  },
});

/**
 * Get progress for a single video
 */
export const getProgress = query({
  args: {
    youtubeVideoId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) return null;

    const item = await ctx.db
      .query("videoProgress")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();

    if (!item) return null;

    return {
      progressSeconds: item.progressSeconds,
      durationSeconds: item.durationSeconds,
      updatedAt: item.updatedAt,
    };
  },
});

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Save (upsert) playback progress for a video
 */
export const saveProgress = mutation({
  args: {
    youtubeVideoId: v.string(),
    progressSeconds: v.number(),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("videoProgress")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        progressSeconds: args.progressSeconds,
        ...(args.durationSeconds !== undefined
          ? { durationSeconds: args.durationSeconds }
          : {}),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("videoProgress", {
        userId,
        youtubeVideoId: args.youtubeVideoId,
        progressSeconds: args.progressSeconds,
        durationSeconds: args.durationSeconds,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Clear progress for a video (e.g., when it reaches ENDED)
 */
export const clearProgress = mutation({
  args: {
    youtubeVideoId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db
      .query("videoProgress")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();

    if (item) {
      await ctx.db.delete(item._id);
    }
  },
});
