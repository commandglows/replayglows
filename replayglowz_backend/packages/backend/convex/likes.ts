import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireReplayGlowzAccess } from "./access";

export const getLikes = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("likes")
      .withIndex("by_video_id", (q) => q.eq("videoId", args.videoId))
      .collect();
  },
});

export const toggleLike = mutation({
  args: {
    videoId: v.id("videos"),
    type: v.union(v.literal("like"), v.literal("dislike")),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("videoId", args.videoId)
      )
      .first();
    if (existing) {
      if (existing.type === args.type) {
        // Remove like/dislike
        await ctx.db.delete(existing._id);
      } else {
        // Change type
        await ctx.db.patch(existing._id, { type: args.type });
      }
    } else {
      // Add new
      await ctx.db.insert("likes", {
        videoId: args.videoId,
        userId,
        type: args.type,
      });
    }
  },
});
