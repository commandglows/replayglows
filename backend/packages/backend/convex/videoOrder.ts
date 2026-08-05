import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireReplayGlowsAccess } from "./access";

/**
 * Get the saved video display order for a specific playlist.
 * Returns the ordered array of YouTube video IDs, or null if no order saved.
 */
export const getVideoOrder = query({
  args: {
    playlistId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) return null;

    const order = await ctx.db
      .query("videoOrder")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", userId).eq("playlistId", args.playlistId)
      )
      .first();

    return order?.orderedIds ?? null;
  },
});

/**
 * Save/update the video display order for a specific playlist.
 * Upserts: creates if not exists, updates if exists.
 */
export const saveVideoOrder = mutation({
  args: {
    playlistId: v.string(),
    orderedIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("videoOrder")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", userId).eq("playlistId", args.playlistId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        orderedIds: args.orderedIds,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("videoOrder", {
        userId,
        playlistId: args.playlistId,
        orderedIds: args.orderedIds,
        updatedAt: Date.now(),
      });
    }
  },
});
