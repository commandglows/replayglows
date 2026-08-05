import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireReplayGlowsAccess } from "./access";

// YouTube feed functions
export const getYouTubeFeed = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) return [];

    // In a real implementation, this would fetch from YouTube API
    // For now, return mock data
    return [
      {
        id: "1",
        title: "Sample YouTube Video 1",
        description: "This is a sample video description",
        thumbnailUrl: "https://via.placeholder.com/300x200",
        channelTitle: "Sample Channel",
        publishedAt: new Date().toISOString(),
      },
      {
        id: "2",
        title: "Sample YouTube Video 2",
        description: "Another sample video description",
        thumbnailUrl: "https://via.placeholder.com/300x200",
        channelTitle: "Another Channel",
        publishedAt: new Date().toISOString(),
      },
    ];
  },
});

// Get all videos for the current user
export const getVideos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("videos")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getVideo = query({
  args: { id: v.id("videos") },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    const video = await ctx.db.get(args.id);
    if (!video || video.userId !== userId) return null;
    return video;
  },
});

export const updateVideoViews = mutation({
  args: { id: v.id("videos") },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    const video = await ctx.db.get(args.id);
    if (!video || video.userId !== userId) throw new Error("Video not found");

    await ctx.db.patch(args.id, { views: video.views + 1 });
  },
});

export const deleteVideo = mutation({
  args: { id: v.id("videos") },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    const video = await ctx.db.get(args.id);
    if (!video || video.userId !== userId) throw new Error("Unauthorized");

    // Cascade delete related data
    const [comments, likes] = await Promise.all([
      ctx.db.query("comments").withIndex("by_video_id", (q) => q.eq("videoId", args.id)).collect(),
      ctx.db.query("likes").withIndex("by_video_id", (q) => q.eq("videoId", args.id)).collect(),
    ]);

    await Promise.all([
      ...comments.map((c) => ctx.db.delete(c._id)),
      ...likes.map((l) => ctx.db.delete(l._id)),
    ]);

    await ctx.db.delete(args.id);
  },
});
