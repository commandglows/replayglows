import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { getUserId } from "./utils";
import { internal, api } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { YOUTUBE_QUOTA_COSTS } from "./metrics";

// Cost per video sync (playlistItems.insert + possibly videos.list if not cached)
const COST_PER_VIDEO_SYNC = YOUTUBE_QUOTA_COSTS["playlistItems.insert"]; // 50 units

// Type for cached video
type CachedVideo = Doc<"youtubeVideosCache">;

// Type assertions for self-referencing API (generated after convex dev)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const channelLinksInternal: any = (internal as any).channelLinks;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const channelLinksApi: any = (api as any).channelLinks;

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get all channel-playlist links for current user
 */
export const getChannelLinks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    const links = await ctx.db
      .query("channelPlaylistLinks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return links.map((link) => ({
      id: link._id,
      youtubeChannelId: link.youtubeChannelId,
      channelTitle: link.channelTitle,
      youtubePlaylistId: link.youtubePlaylistId,
      linkedAt: link.linkedAt,
      lastSyncedAt: link.lastSyncedAt,
      isActive: link.isActive,
    }));
  },
});

/**
 * Get channel links for a specific playlist
 */
export const getChannelLinksForPlaylist = query({
  args: { playlistId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    const links = await ctx.db
      .query("channelPlaylistLinks")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", userId).eq("youtubePlaylistId", args.playlistId),
      )
      .collect();

    return links.map((link) => ({
      id: link._id,
      youtubeChannelId: link.youtubeChannelId,
      channelTitle: link.channelTitle,
      youtubePlaylistId: link.youtubePlaylistId,
      linkedAt: link.linkedAt,
      lastSyncedAt: link.lastSyncedAt,
      isActive: link.isActive,
    }));
  },
});

/**
 * Check if a channel is already linked to any playlist
 */
export const getChannelLinkByChannel = query({
  args: { youtubeChannelId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const link = await ctx.db
      .query("channelPlaylistLinks")
      .withIndex("by_user_and_channel", (q) =>
        q.eq("userId", userId).eq("youtubeChannelId", args.youtubeChannelId),
      )
      .first();

    if (!link) return null;

    return {
      id: link._id,
      youtubeChannelId: link.youtubeChannelId,
      channelTitle: link.channelTitle,
      youtubePlaylistId: link.youtubePlaylistId,
      linkedAt: link.linkedAt,
      lastSyncedAt: link.lastSyncedAt,
      isActive: link.isActive,
    };
  },
});

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Link a YouTube channel to a playlist
 */
export const linkChannelToPlaylist = mutation({
  args: {
    youtubeChannelId: v.string(),
    channelTitle: v.string(),
    youtubePlaylistId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Check if link already exists
    const existing = await ctx.db
      .query("channelPlaylistLinks")
      .withIndex("by_user_and_channel", (q) =>
        q.eq("userId", userId).eq("youtubeChannelId", args.youtubeChannelId),
      )
      .first();

    if (existing) {
      if (
        existing.isActive &&
        existing.youtubePlaylistId !== args.youtubePlaylistId
      ) {
        throw new Error(
          "CHANNEL_ALREADY_LINKED: This channel is already linked to another playlist.",
        );
      }

      await ctx.db.patch(existing._id, {
        channelTitle: args.channelTitle,
        linkedAt: Date.now(),
        isActive: true,
      });
      return existing._id;
    }

    // Create new link
    const linkId = await ctx.db.insert("channelPlaylistLinks", {
      userId,
      youtubeChannelId: args.youtubeChannelId,
      channelTitle: args.channelTitle,
      youtubePlaylistId: args.youtubePlaylistId,
      linkedAt: Date.now(),
      isActive: true,
    });

    return linkId;
  },
});

/**
 * Unlink a channel from its playlist
 */
export const unlinkChannel = mutation({
  args: { linkId: v.id("channelPlaylistLinks") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const link = await ctx.db.get(args.linkId);
    if (!link || link.userId !== userId) {
      throw new Error("Link not found");
    }

    await ctx.db.delete(args.linkId);
  },
});

/**
 * Toggle link active status (pause/resume sync)
 */
export const toggleLinkStatus = mutation({
  args: { linkId: v.id("channelPlaylistLinks") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const link = await ctx.db.get(args.linkId);
    if (!link || link.userId !== userId) {
      throw new Error("Link not found");
    }

    await ctx.db.patch(args.linkId, {
      isActive: !link.isActive,
    });

    return !link.isActive;
  },
});

/**
 * Update last synced timestamp for a link
 */
export const updateLinkSyncTime = mutation({
  args: { linkId: v.id("channelPlaylistLinks") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const link = await ctx.db.get(args.linkId);
    if (!link || link.userId !== userId) {
      throw new Error("Link not found");
    }

    await ctx.db.patch(args.linkId, {
      lastSyncedAt: Date.now(),
    });
  },
});

// Internal mutation for actions to update sync time
export const internalUpdateLinkSyncTime = internalMutation({
  args: { linkId: v.id("channelPlaylistLinks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.linkId, {
      lastSyncedAt: Date.now(),
    });
  },
});

// =============================================================================
// INTERNAL QUERIES
// =============================================================================

/**
 * Internal query to get channel links for actions
 */
export const getLinksForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("channelPlaylistLinks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Internal query to get videos by channel for a user
 */
export const getVideosByChannel = internalQuery({
  args: { userId: v.string(), channelTitle: v.string() },
  handler: async (ctx, args) => {
    // Get all cached videos for user
    const allVideos = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter by channel title
    return allVideos.filter((v) => v.channelTitle === args.channelTitle);
  },
});

/**
 * Internal query to get video IDs in a playlist
 */
export const getPlaylistVideoIds = internalQuery({
  args: { userId: v.string(), playlistId: v.string() },
  handler: async (ctx, args) => {
    const videos = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", args.userId).eq("youtubePlaylistId", args.playlistId),
      )
      .collect();

    return videos.map((v) => v.youtubeVideoId);
  },
});

/**
 * Internal query to get user's quota usage for today
 */
export const getQuotaUsageForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get start of today in Pacific Time (YouTube quota resets at midnight PT)
    const now = new Date();
    const pacificString = now.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
    });
    const pacificDate = new Date(pacificString);
    pacificDate.setHours(0, 0, 0, 0);
    const pacificOffset = now.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      timeZoneName: "shortOffset",
    });
    const offsetMatch = pacificOffset.match(/GMT([+-]\d+)/);
    const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -8;
    const todayStart = pacificDate.getTime() - offsetHours * 60 * 60 * 1000;

    // Get user's subscription to determine quota limit
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    const PLAN_QUOTA_LIMITS = {
      free: 1000,
      pro: 10000,
      team: 50000,
    } as const;

    const plan = subscription?.plan ?? "free";
    const limit = PLAN_QUOTA_LIMITS[plan];

    const todayMetrics = await ctx.db
      .query("apiMetrics")
      .withIndex("by_user_and_timestamp", (q) =>
        q.eq("userId", args.userId).gte("timestamp", todayStart),
      )
      .collect();

    const used = todayMetrics.reduce((sum, m) => sum + m.quotaUnits, 0);

    return { used, limit, remaining: limit - used };
  },
});

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Sync past videos from a channel to a playlist
 * Adds cached videos from the channel that aren't already in the playlist
 * OPTIMIZED: Quota-aware - checks remaining quota before syncing and limits accordingly
 */
export const syncPastVideosFromChannel = action({
  args: {
    youtubeChannelId: v.string(),
    channelTitle: v.string(),
    youtubePlaylistId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;

    // Check current quota before syncing
    const quota = await ctx.runQuery(
      channelLinksInternal.getQuotaUsageForUser,
      {
        userId,
      },
    );

    // Calculate how many videos we can sync based on remaining quota
    const maxVideosAllowed = Math.floor(quota.remaining / COST_PER_VIDEO_SYNC);

    // Warn if quota is very low
    if (maxVideosAllowed < 1) {
      return {
        addedCount: 0,
        totalMatching: 0,
        errors: [],
        quotaExhausted: true,
        remainingQuota: quota.remaining,
        message: "Insufficient quota for sync. Each video costs 50 units.",
      };
    }

    // Get videos from this channel in cache
    const channelVideos = await ctx.runQuery(
      channelLinksInternal.getVideosByChannel,
      { userId, channelTitle: args.channelTitle },
    );

    // Get videos already in the target playlist
    const existingVideoIds = await ctx.runQuery(
      channelLinksInternal.getPlaylistVideoIds,
      { userId, playlistId: args.youtubePlaylistId },
    );

    const existingSet = new Set(existingVideoIds);

    // Filter to videos not already in playlist
    const videosToAdd = channelVideos.filter(
      (v: CachedVideo) => !existingSet.has(v.youtubeVideoId),
    );

    // Limit videos to sync based on quota (max 50 per sync, but respect quota)
    const syncLimit = Math.min(50, maxVideosAllowed);

    let addedCount = 0;
    const errors: string[] = [];

    // Add videos to playlist (with rate limiting)
    for (const video of videosToAdd) {
      // Check if we've hit the limit
      if (addedCount >= syncLimit) break;

      try {
        await ctx.runAction(api.youtube.addVideoToYoutubePlaylist, {
          playlistId: args.youtubePlaylistId,
          videoId: video.youtubeVideoId,
        });
        addedCount++;

        // Rate limit: wait 200ms between API calls
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to add video ${video.youtubeVideoId}:`, error);
        errors.push(video.youtubeVideoId);
      }
    }

    const quotaUsed = addedCount * COST_PER_VIDEO_SYNC;
    const remainingAfterSync = quota.remaining - quotaUsed;

    return {
      addedCount,
      totalMatching: videosToAdd.length,
      errors,
      quotaUsed,
      remainingQuota: remainingAfterSync,
      limitedByQuota:
        maxVideosAllowed < 50 && videosToAdd.length > maxVideosAllowed,
    };
  },
});

/**
 * Sync all active linked channels
 * Call this on app visit or scheduled sync
 */
export const syncAllLinkedChannels = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;

    // Get all active links
    const links = await ctx.runQuery(channelLinksInternal.getLinksForUser, {
      userId,
    });

    const activeLinks = links.filter(
      (link: Doc<"channelPlaylistLinks">) => link.isActive,
    );

    let totalAdded = 0;
    const results: Array<{
      channelTitle: string;
      playlistId: string;
      addedCount: number;
    }> = [];

    for (const link of activeLinks) {
      try {
        const result = await ctx.runAction(
          channelLinksApi.syncPastVideosFromChannel,
          {
            youtubeChannelId: link.youtubeChannelId,
            channelTitle: link.channelTitle,
            youtubePlaylistId: link.youtubePlaylistId,
          },
        );

        totalAdded += result.addedCount;
        results.push({
          channelTitle: link.channelTitle,
          playlistId: link.youtubePlaylistId,
          addedCount: result.addedCount,
        });

        // Update sync timestamp
        await ctx.runMutation(channelLinksInternal.internalUpdateLinkSyncTime, {
          linkId: link._id,
        });

        // Rate limit between channels
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to sync channel ${link.channelTitle}:`, error);
      }
    }

    return {
      totalAdded,
      channelsSynced: results.length,
      results,
    };
  },
});

/**
 * Get count of videos that would be synced for a channel-playlist link
 */
export const getVideosToSyncCount = action({
  args: {
    channelTitle: v.string(),
    youtubePlaylistId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;

    // Get videos from this channel in cache
    const channelVideos = await ctx.runQuery(
      channelLinksInternal.getVideosByChannel,
      { userId, channelTitle: args.channelTitle },
    );

    // Get videos already in the target playlist
    const existingVideoIds = await ctx.runQuery(
      channelLinksInternal.getPlaylistVideoIds,
      { userId, playlistId: args.youtubePlaylistId },
    );

    const existingSet = new Set(existingVideoIds);

    // Count videos not already in playlist
    const count = channelVideos.filter(
      (v: CachedVideo) => !existingSet.has(v.youtubeVideoId),
    ).length;

    return count;
  },
});
