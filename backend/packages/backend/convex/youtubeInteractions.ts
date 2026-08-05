import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireReplayGlowsAccess } from "./access";

// =============================================================================
// YOUTUBE VIDEO LIKES
// =============================================================================

// Get like status for a YouTube video
export const getLikeStatus = query({
  args: { youtubeVideoId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) {
      return { userLike: null, likeCount: 0, dislikeCount: 0 };
    }

    const likes = await ctx.db
      .query("youtubeLikes")
      .withIndex("by_video", (q) => q.eq("youtubeVideoId", args.youtubeVideoId))
      .collect();

    const userLike = likes.find((l) => l.userId === userId);
    const likeCount = likes.filter((l) => l.type === "like").length;
    const dislikeCount = likes.filter((l) => l.type === "dislike").length;

    return {
      userLike: userLike?.type ?? null,
      likeCount,
      dislikeCount,
    };
  },
});

// Toggle like/dislike on a YouTube video
export const toggleLike = mutation({
  args: {
    youtubeVideoId: v.string(),
    type: v.union(v.literal("like"), v.literal("dislike")),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("youtubeLikes")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();

    if (existing) {
      if (existing.type === args.type) {
        // Remove like/dislike
        await ctx.db.delete(existing._id);
        return { action: "removed" };
      } else {
        // Change type
        await ctx.db.patch(existing._id, { type: args.type });
        return { action: "changed" };
      }
    } else {
      // Add new like/dislike
      await ctx.db.insert("youtubeLikes", {
        youtubeVideoId: args.youtubeVideoId,
        userId,
        type: args.type,
        createdAt: Date.now(),
      });
      return { action: "added" };
    }
  },
});

// =============================================================================
// YOUTUBE VIDEO COMMENTS
// =============================================================================

// Get comments for a YouTube video
export const getComments = query({
  args: { youtubeVideoId: v.string() },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("youtubeComments")
      .withIndex("by_video", (q) => q.eq("youtubeVideoId", args.youtubeVideoId))
      .collect();

    // Deduplicate user IDs and batch fetch
    const uniqueUserIds = Array.from(new Set(comments.map((c) => c.userId)));
    const users = await Promise.all(
      uniqueUserIds.map((uid) =>
        ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", uid))
          .first()
      )
    );
    const userMap = new Map(
      uniqueUserIds.map((uid, i) => [uid, users[i]])
    );

    // Sort by creation date (newest first)
    return comments
      .map((comment) => {
        const user = userMap.get(comment.userId);
        return {
          ...comment,
          userName: user?.name || "Anonymous",
          userAvatar: user?.avatarUrl,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get comment count for a YouTube video
export const getCommentCount = query({
  args: { youtubeVideoId: v.string() },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("youtubeComments")
      .withIndex("by_video", (q) => q.eq("youtubeVideoId", args.youtubeVideoId))
      .collect();

    return comments.length;
  },
});

// Create a comment on a YouTube video
export const createComment = mutation({
  args: {
    youtubeVideoId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    if (!args.content.trim()) {
      throw new Error("Comment cannot be empty");
    }
    if (args.content.length > 5000) {
      throw new Error("Comment too long (max 5,000 chars)");
    }

    const commentId = await ctx.db.insert("youtubeComments", {
      youtubeVideoId: args.youtubeVideoId,
      userId,
      content: args.content.trim(),
      createdAt: Date.now(),
    });

    return commentId;
  },
});

// Delete a comment
export const deleteComment = mutation({
  args: { id: v.id("youtubeComments") },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== userId) throw new Error("Unauthorized");

    await ctx.db.delete(args.id);
  },
});
