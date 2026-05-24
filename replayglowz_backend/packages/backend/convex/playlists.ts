import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./utils";

// Get all playlists for the current user
export const getPlaylists = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("playlists")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Get a single playlist by ID
export const getPlaylist = query({
  args: { id: v.id("playlists") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const playlist = await ctx.db.get(args.id);

    // Return null if playlist doesn't exist or is private and not owned by user
    if (!playlist) return null;
    if (!playlist.isPublic && playlist.userId !== userId) return null;

    return playlist;
  },
});

// Get playlist with video details
export const getPlaylistWithVideos = query({
  args: { id: v.id("playlists") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const playlist = await ctx.db.get(args.id);

    if (!playlist) return null;
    if (!playlist.isPublic && playlist.userId !== userId) return null;

    // Fetch all videos in the playlist
    const videos = await Promise.all(
      playlist.videoIds.map((videoId) => ctx.db.get(videoId))
    );

    return {
      ...playlist,
      videos: videos.filter((v) => v !== null),
    };
  },
});

// Create a new playlist
export const createPlaylist = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    if (args.name.length > 200) throw new Error("Name too long (max 200 chars)");
    if (args.description && args.description.length > 2000) throw new Error("Description too long (max 2,000 chars)");

    const now = Date.now();

    return await ctx.db.insert("playlists", {
      userId,
      name: args.name.trim(),
      description: args.description?.trim(),
      videoIds: [],
      isPublic: args.isPublic ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update playlist details
export const updatePlaylist = mutation({
  args: {
    id: v.id("playlists"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const playlist = await ctx.db.get(args.id);
    if (!playlist || playlist.userId !== userId) {
      throw new Error("Unauthorized");
    }

    if (args.name !== undefined && args.name.length > 200) throw new Error("Name too long (max 200 chars)");
    if (args.description !== undefined && args.description.length > 2000) throw new Error("Description too long (max 2,000 chars)");

    const updateData: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updateData.name = args.name.trim();
    if (args.description !== undefined) updateData.description = args.description.trim();
    if (args.isPublic !== undefined) updateData.isPublic = args.isPublic;

    await ctx.db.patch(args.id, updateData);
    return args.id;
  },
});

// Add a video to a playlist
export const addVideoToPlaylist = mutation({
  args: {
    playlistId: v.id("playlists"),
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Check if video exists
    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Video not found");

    // Add video ID if not already in playlist
    if (!playlist.videoIds.includes(args.videoId)) {
      await ctx.db.patch(args.playlistId, {
        videoIds: [...playlist.videoIds, args.videoId],
        updatedAt: Date.now(),
      });
    }

    return args.playlistId;
  },
});

// Remove a video from a playlist
export const removeVideoFromPlaylist = mutation({
  args: {
    playlistId: v.id("playlists"),
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.playlistId, {
      videoIds: playlist.videoIds.filter((id) => id !== args.videoId),
      updatedAt: Date.now(),
    });

    return args.playlistId;
  },
});

// Reorder videos in a playlist
export const reorderPlaylistVideos = mutation({
  args: {
    playlistId: v.id("playlists"),
    videoIds: v.array(v.id("videos")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Verify all video IDs are valid and in the original playlist
    const originalSet = new Set(playlist.videoIds.map((id) => id.toString()));
    const newSet = new Set(args.videoIds.map((id) => id.toString()));

    if (originalSet.size !== newSet.size) {
      throw new Error("Video list mismatch");
    }

    for (const id of args.videoIds) {
      if (!originalSet.has(id.toString())) {
        throw new Error("Invalid video ID in reorder list");
      }
    }

    await ctx.db.patch(args.playlistId, {
      videoIds: args.videoIds,
      updatedAt: Date.now(),
    });

    return args.playlistId;
  },
});

// Delete a playlist
export const deletePlaylist = mutation({
  args: { id: v.id("playlists") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const playlist = await ctx.db.get(args.id);
    if (!playlist || playlist.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});

// Get public playlists (for discovery)
export const getPublicPlaylists = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const playlists = await ctx.db
      .query("playlists")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .take(limit);

    return playlists;
  },
});
