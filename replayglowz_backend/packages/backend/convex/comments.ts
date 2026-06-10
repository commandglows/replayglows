import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireReplayGlowzAccess } from "./access";

export const getComments = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_video_id", (q) => q.eq("videoId", args.videoId))
      .collect();
  },
});

export const createComment = mutation({
  args: { videoId: v.id("videos"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const commentId = await ctx.db.insert("comments", {
      videoId: args.videoId,
      userId,
      content: args.content,
      createdAt: Date.now(),
    });
    return commentId;
  },
});

export const deleteComment = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    const comment = await ctx.db.get(args.id);
    if (!comment || comment.userId !== userId) throw new Error("Unauthorized");

    await ctx.db.delete(args.id);
  },
});
