import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireReplayGlowzAccess } from "./access";

/**
 * Get the saved playlist display order for the current user.
 * Returns the ordered array of YouTube playlist IDs, or null if no order saved.
 */
export const getPlaylistOrder = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return null;

    const order = await ctx.db
      .query("playlistOrder")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return order?.orderedIds ?? null;
  },
});

/**
 * Save/update the playlist display order for the current user.
 * Upserts: creates if not exists, updates if exists.
 */
export const savePlaylistOrder = mutation({
  args: {
    orderedIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("playlistOrder")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        orderedIds: args.orderedIds,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("playlistOrder", {
        userId,
        orderedIds: args.orderedIds,
        updatedAt: Date.now(),
      });
    }
  },
});
