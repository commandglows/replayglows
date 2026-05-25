import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { getUserId } from "./utils";
import { internal, api } from "./_generated/api";
import { YOUTUBE_QUOTA_COSTS } from "./metrics";

// Cache TTL in milliseconds (1 hour - extended from 10 minutes to reduce API calls)
const CACHE_TTL = 60 * 60 * 1000;
const YOUTUBE_SYNC_LOCK_TTL_MS = 10 * 60 * 1000;
const YOUTUBE_SYNC_HARD_STOP_PERCENTAGE = 90;
const YOUTUBE_SYNC_WARN_PERCENTAGE = 70;

// Self-referencing generated API types are updated by Convex codegen after new
// functions exist. Keep these local aliases isolated to this module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const youtubeApi: any = (api as any).youtube;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const youtubeInternal: any = (internal as any).youtube;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const metricsInternal: any = (internal as any).metrics;

function getProjectDailyQuotaLimit(): number {
  const raw = process.env.YOUTUBE_PROJECT_DAILY_QUOTA;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000;
}

function getEffectiveQuotaLimit(productLimit: number): number {
  return Math.min(productLimit, getProjectDailyQuotaLimit());
}

function getQuotaPercentage(used: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(Math.round((used / limit) * 100), 100);
}

function shouldStopForQuota(used: number, limit: number): boolean {
  return getQuotaPercentage(used, limit) >= YOUTUBE_SYNC_HARD_STOP_PERCENTAGE;
}

function estimateFullSyncQuotaUnits(playlistCount: number): number {
  return (
    YOUTUBE_QUOTA_COSTS["playlists.list"] +
    playlistCount *
      (YOUTUBE_QUOTA_COSTS["playlistItems.list"] +
        YOUTUBE_QUOTA_COSTS["videos.list"])
  );
}

function formatSyncError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Check if the current user has YouTube connected
 */
export const getYoutubeConnectionStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return { connected: false };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    if (!user) return { connected: false };

    const hasTokens = !!(user.youtubeAccessToken && user.youtubeRefreshToken);

    return {
      connected: (user.youtubeConnected ?? false) && hasTokens,
      hasTokens,
      needsReconnect: !hasTokens,
    };
  },
});

/**
 * Get the latest YouTube sync job for the current user.
 */
export const getLatestYoutubeSyncJob = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    return ctx.db
      .query("youtubeSyncJobs")
      .withIndex("by_user_and_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
  },
});

/**
 * Internal query to find an active, non-expired YouTube sync job.
 */
export const getActiveYoutubeSyncJob = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const activeJobs = await ctx.db
      .query("youtubeSyncJobs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "running"),
      )
      .collect();

    return activeJobs.find((job) => job.lockExpiresAt > now) ?? null;
  },
});

/**
 * Internal query for cached playlist sync planning.
 */
export const getCachedPlaylistSyncPlan = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const playlists = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return playlists.map((playlist) => ({
      youtubePlaylistId: playlist.youtubePlaylistId,
      title: playlist.title,
      videoCount: playlist.videoCount,
      cachedAt: playlist.cachedAt,
    }));
  },
});

/**
 * Internal query for cached video details that can avoid a videos.list call.
 */
export const getCachedVideoDetailsByIds = internalQuery({
  args: {
    userId: v.string(),
    videoIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.videoIds.length === 0) return [];

    const requested = new Set(args.videoIds);
    const entries = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const byVideoId = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) {
      if (!requested.has(entry.youtubeVideoId)) continue;
      const existing = byVideoId.get(entry.youtubeVideoId);
      if (!existing || entry.cachedAt > existing.cachedAt) {
        byVideoId.set(entry.youtubeVideoId, entry);
      }
    }

    return Array.from(byVideoId.values()).map((entry) => ({
      youtubeVideoId: entry.youtubeVideoId,
      duration: entry.duration,
      publishedAt: entry.publishedAt,
      title: entry.title,
      channelTitle: entry.channelTitle,
      youtubeChannelId: entry.youtubeChannelId,
      thumbnailUrl: entry.thumbnailUrl,
      description: entry.description,
      cachedAt: entry.cachedAt,
    }));
  },
});

export const createYoutubeSyncJob = internalMutation({
  args: {
    userId: v.string(),
    total: v.number(),
    estimatedQuotaUnits: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("youtubeSyncJobs", {
      userId: args.userId,
      status: "running",
      phase: "planning",
      current: 0,
      total: args.total,
      estimatedQuotaUnits: args.estimatedQuotaUnits,
      usedQuotaUnits: 0,
      errors: [],
      startedAt: now,
      updatedAt: now,
      lockExpiresAt: now + YOUTUBE_SYNC_LOCK_TTL_MS,
    });
  },
});

export const updateYoutubeSyncJob = internalMutation({
  args: {
    jobId: v.id("youtubeSyncJobs"),
    status: v.optional(
      v.union(
        v.literal("running"),
        v.literal("completed"),
        v.literal("partial"),
        v.literal("failed"),
      ),
    ),
    phase: v.optional(
      v.union(
        v.literal("planning"),
        v.literal("playlists"),
        v.literal("videos"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
    current: v.optional(v.number()),
    total: v.optional(v.number()),
    estimatedQuotaUnits: v.optional(v.number()),
    usedQuotaUnits: v.optional(v.number()),
    currentPlaylistId: v.optional(v.string()),
    currentPlaylistTitle: v.optional(v.string()),
    error: v.optional(v.string()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    const now = Date.now();
    const nextErrors = args.error ? [...job.errors, args.error] : job.errors;
    const patch: Record<string, unknown> = {
      updatedAt: now,
      lockExpiresAt: now + YOUTUBE_SYNC_LOCK_TTL_MS,
      errors: nextErrors,
    };

    if (args.status !== undefined) patch.status = args.status;
    if (args.phase !== undefined) patch.phase = args.phase;
    if (args.current !== undefined) patch.current = args.current;
    if (args.total !== undefined) patch.total = args.total;
    if (args.estimatedQuotaUnits !== undefined) {
      patch.estimatedQuotaUnits = args.estimatedQuotaUnits;
    }
    if (args.usedQuotaUnits !== undefined)
      patch.usedQuotaUnits = args.usedQuotaUnits;
    if (args.currentPlaylistId !== undefined)
      patch.currentPlaylistId = args.currentPlaylistId;
    if (args.currentPlaylistTitle !== undefined) {
      patch.currentPlaylistTitle = args.currentPlaylistTitle;
    }
    if (args.completed) {
      patch.completedAt = now;
      patch.lockExpiresAt = now;
    }

    await ctx.db.patch(args.jobId, patch);
    return ctx.db.get(args.jobId);
  },
});

/**
 * Get YouTube playlists from cache (filters out hidden by default)
 */
export const getYoutubePlaylists = query({
  args: {
    includeHidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    // Fetch all data sources in parallel
    const [playlists, hiddenPlaylists, hiddenVideos, allCachedVideos] =
      await Promise.all([
        ctx.db
          .query("youtubePlaylistsCache")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        !args.includeHidden
          ? ctx.db
              .query("hiddenItems")
              .withIndex("by_user_and_type", (q) =>
                q.eq("userId", userId).eq("itemType", "playlist"),
              )
              .collect()
          : Promise.resolve([]),
        ctx.db
          .query("hiddenItems")
          .withIndex("by_user_and_type", (q) =>
            q.eq("userId", userId).eq("itemType", "video"),
          )
          .collect(),
        ctx.db
          .query("youtubeVideosCache")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
      ]);

    const hiddenPlaylistIds = new Set(hiddenPlaylists.map((h) => h.youtubeId));
    const hiddenVideoIds = new Set(hiddenVideos.map((h) => h.youtubeId));

    // Calculate visible video count and latest video date per playlist
    const visibleCountByPlaylist = new Map<string, number>();
    const latestVideoDateByPlaylist = new Map<string, string>();
    for (const video of allCachedVideos) {
      if (!hiddenVideoIds.has(video.youtubeVideoId)) {
        const current =
          visibleCountByPlaylist.get(video.youtubePlaylistId) || 0;
        visibleCountByPlaylist.set(video.youtubePlaylistId, current + 1);
      }
      // Track the most recent video publishedAt per playlist
      if (video.publishedAt) {
        const currentLatest = latestVideoDateByPlaylist.get(
          video.youtubePlaylistId,
        );
        if (!currentLatest || video.publishedAt > currentLatest) {
          latestVideoDateByPlaylist.set(
            video.youtubePlaylistId,
            video.publishedAt,
          );
        }
      }
    }

    return playlists
      .filter(
        (p) =>
          args.includeHidden || !hiddenPlaylistIds.has(p.youtubePlaylistId),
      )
      .map((p) => {
        // Use visible count if we have cached videos, otherwise fall back to YouTube count
        const cachedCount = visibleCountByPlaylist.get(p.youtubePlaylistId);
        const videoCount =
          cachedCount !== undefined ? cachedCount : p.videoCount;

        return {
          _id: p._id,
          id: p.youtubePlaylistId,
          youtubePlaylistId: p.youtubePlaylistId,
          title: p.title,
          description: p.description,
          thumbnailUrl: p.customThumbnailUrl || p.thumbnailUrl,
          customThumbnailUrl: p.customThumbnailUrl,
          videoCount,
          originalVideoCount: p.videoCount, // Keep original for reference
          privacyStatus: p.privacyStatus,
          publishedAt: p.publishedAt,
          lastVideoAddedAt: latestVideoDateByPlaylist.get(p.youtubePlaylistId),
          cachedAt: p.cachedAt,
          isStale: Date.now() - p.cachedAt > CACHE_TTL,
          color: p.color,
        };
      });
  },
});

/**
 * Get videos for a specific YouTube playlist from cache (filters out hidden by default)
 */
export const getPlaylistVideos = query({
  args: {
    playlistId: v.string(),
    includeHidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    const videos = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", userId).eq("youtubePlaylistId", args.playlistId),
      )
      .collect();

    // Get hidden video IDs unless includeHidden is true
    let hiddenIds: Set<string> = new Set();
    if (!args.includeHidden) {
      const hiddenItems = await ctx.db
        .query("hiddenItems")
        .withIndex("by_user_and_type", (q) =>
          q.eq("userId", userId).eq("itemType", "video"),
        )
        .collect();
      hiddenIds = new Set(hiddenItems.map((h) => h.youtubeId));
    }

    // Build channel thumbnail lookup from channels cache
    const channels = await ctx.db
      .query("youtubeChannelsCache")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const channelThumbnails = new Map(
      channels.map((c) => [c.youtubeChannelId, c.thumbnailUrl]),
    );

    const customOrder = await ctx.db
      .query("videoOrder")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", userId).eq("playlistId", args.playlistId),
      )
      .first();
    const orderIndex = new Map(
      (customOrder?.orderedIds ?? []).map((videoId, index) => [videoId, index]),
    );

    return videos
      .filter((v) => args.includeHidden || !hiddenIds.has(v.youtubeVideoId))
      .sort((a, b) => {
        const aIndex = orderIndex.get(a.youtubeVideoId);
        const bIndex = orderIndex.get(b.youtubeVideoId);
        if (aIndex !== undefined && bIndex !== undefined)
          return aIndex - bIndex;
        if (aIndex !== undefined) return -1;
        if (bIndex !== undefined) return 1;
        return a.position - b.position;
      })
      .map((v) => ({
        _id: v._id,
        id: v.youtubeVideoId,
        youtubeVideoId: v.youtubeVideoId,
        youtubePlaylistId: v.youtubePlaylistId,
        playlistItemId: v.playlistItemId,
        title: v.title,
        description: v.description,
        thumbnailUrl: v.thumbnailUrl,
        channelTitle: v.channelTitle,
        channelThumbnailUrl: v.youtubeChannelId
          ? channelThumbnails.get(v.youtubeChannelId)
          : undefined,
        duration: v.duration,
        position: v.position,
        publishedAt: v.publishedAt,
        cachedAt: v.cachedAt,
        isStale: Date.now() - v.cachedAt > CACHE_TTL,
      }));
  },
});

/**
 * Get a single playlist by ID from cache
 */
export const getPlaylistById = query({
  args: { playlistId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const playlist = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user_and_youtube_id", (q) =>
        q.eq("userId", userId).eq("youtubePlaylistId", args.playlistId),
      )
      .first();

    if (!playlist) return null;

    return {
      _id: playlist._id,
      id: playlist.youtubePlaylistId,
      youtubePlaylistId: playlist.youtubePlaylistId,
      title: playlist.title,
      description: playlist.description,
      thumbnailUrl: playlist.customThumbnailUrl || playlist.thumbnailUrl,
      customThumbnailUrl: playlist.customThumbnailUrl,
      videoCount: playlist.videoCount,
      privacyStatus: playlist.privacyStatus,
      publishedAt: playlist.publishedAt,
      cachedAt: playlist.cachedAt,
      isStale: Date.now() - playlist.cachedAt > CACHE_TTL,
      color: playlist.color,
    };
  },
});

/**
 * Get cached YouTube channels (subscriptions) for current user
 */
export const getYoutubeChannels = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    const channels = await ctx.db
      .query("youtubeChannelsCache")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return channels.map((c) => ({
      id: c.youtubeChannelId,
      title: c.title,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      subscriberCount: c.subscriberCount,
      videoCount: c.videoCount,
      cachedAt: c.cachedAt,
      isStale: Date.now() - c.cachedAt > CACHE_TTL,
    }));
  },
});

/**
 * Get a single channel by YouTube channel ID from cache
 */
export const getChannelByYoutubeId = query({
  args: { youtubeChannelId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const channel = await ctx.db
      .query("youtubeChannelsCache")
      .withIndex("by_user_and_channel", (q) =>
        q.eq("userId", userId).eq("youtubeChannelId", args.youtubeChannelId),
      )
      .first();

    if (!channel) return null;

    return {
      id: channel.youtubeChannelId,
      title: channel.title,
      thumbnailUrl: channel.thumbnailUrl,
    };
  },
});

/**
 * Get a single video by YouTube video ID from cache
 */
export const getVideoByYoutubeId = query({
  args: { youtubeVideoId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const video = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId),
      )
      .first();

    if (!video) return null;

    return {
      id: video.youtubeVideoId,
      title: video.title,
      channelTitle: video.channelTitle,
      youtubeChannelId: video.youtubeChannelId,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
    };
  },
});

/**
 * Batch fetch video + channel info for multiple YouTube video IDs (used by Notes page)
 */
export const getVideosInfoBatch = query({
  args: { youtubeVideoIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId || args.youtubeVideoIds.length === 0) return {};

    // Fetch all videos and channels in parallel
    const [videos, channels] = await Promise.all([
      Promise.all(
        args.youtubeVideoIds.map((vid) =>
          ctx.db
            .query("youtubeVideosCache")
            .withIndex("by_user_and_video", (q) =>
              q.eq("userId", userId).eq("youtubeVideoId", vid),
            )
            .first(),
        ),
      ),
      ctx.db
        .query("youtubeChannelsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const channelMap = new Map(channels.map((c) => [c.youtubeChannelId, c]));

    const result: Record<
      string,
      {
        title: string;
        channelTitle: string;
        youtubeChannelId?: string;
        channelThumbnailUrl?: string;
      }
    > = {};

    for (let i = 0; i < args.youtubeVideoIds.length; i++) {
      const video = videos[i];
      if (video) {
        const channel = video.youtubeChannelId
          ? channelMap.get(video.youtubeChannelId)
          : undefined;
        result[args.youtubeVideoIds[i]] = {
          title: video.title,
          channelTitle: video.channelTitle,
          youtubeChannelId: video.youtubeChannelId,
          channelThumbnailUrl: channel?.thumbnailUrl,
        };
      }
    }

    return result;
  },
});

/**
 * Get all videos from all playlists for the current user (filters out hidden by default)
 * NEW: Now includes playlist color enrichment for categorized channels and supports pagination
 */
export const getAllVideos = query({
  args: {
    includeHidden: v.optional(v.boolean()),
    includeWatched: v.optional(v.boolean()),
    sortOrder: v.optional(
      v.union(
        v.literal("asc"),
        v.literal("desc"),
        v.literal("oldest"),
        v.literal("newest"),
      ),
    ),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: null };

    // Fetch all data sources in parallel instead of sequentially
    const [
      allVideos,
      playlists,
      channels,
      hiddenVideos,
      hiddenPlaylists,
      watchedVideos,
    ] = await Promise.all([
      ctx.db
        .query("youtubeVideosCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("youtubePlaylistsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("youtubeChannelsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      !args.includeHidden
        ? ctx.db
            .query("hiddenItems")
            .withIndex("by_user_type_and_id", (q) =>
              q.eq("userId", userId).eq("itemType", "video"),
            )
            .collect()
        : Promise.resolve([]),
      !args.includeHidden
        ? ctx.db
            .query("hiddenItems")
            .withIndex("by_user_type_and_id", (q) =>
              q.eq("userId", userId).eq("itemType", "playlist"),
            )
            .collect()
        : Promise.resolve([]),
      !args.includeWatched
        ? ctx.db
            .query("watchedVideos")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect()
        : Promise.resolve([]),
    ]);

    // Build all lookup maps once
    const playlistMap = new Map(playlists.map((p) => [p.youtubePlaylistId, p]));
    const channelThumbnails = new Map(
      channels.map((c) => [c.youtubeChannelId, c.thumbnailUrl]),
    );
    const hiddenIds = new Set(hiddenVideos.map((h) => h.youtubeId));
    const hiddenPlaylistIds = new Set(hiddenPlaylists.map((h) => h.youtubeId));
    const watchedIds = new Set(watchedVideos.map((w) => w.youtubeVideoId));

    // Single pass: deduplicate + filter
    const seen = new Set<string>();
    const filtered = allVideos.filter((v) => {
      if (seen.has(v.youtubeVideoId)) return false;
      seen.add(v.youtubeVideoId);
      if (!args.includeHidden && hiddenIds.has(v.youtubeVideoId)) return false;
      if (!args.includeHidden && hiddenPlaylistIds.has(v.youtubePlaylistId))
        return false;
      if (!args.includeWatched && watchedIds.has(v.youtubeVideoId))
        return false;
      return true;
    });

    // Sort by publishedAt
    filtered.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return args.sortOrder === "asc" || args.sortOrder === "oldest"
        ? dateA - dateB
        : dateB - dateA;
    });

    // Enrich with playlist + channel data in a single map
    const finalVideos = filtered.map((v) => {
      const playlist = playlistMap.get(v.youtubePlaylistId);
      return {
        _id: v._id,
        id: v.youtubeVideoId,
        youtubeVideoId: v.youtubeVideoId,
        youtubePlaylistId: v.youtubePlaylistId,
        playlistId: v.youtubePlaylistId,
        title: v.title,
        description: v.description,
        thumbnailUrl: v.thumbnailUrl,
        channelTitle: v.channelTitle,
        channelThumbnailUrl: v.youtubeChannelId
          ? channelThumbnails.get(v.youtubeChannelId)
          : undefined,
        duration: v.duration,
        publishedAt: v.publishedAt,
        cachedAt: v.cachedAt,
        playlistColor: playlist?.color,
        playlistTitle: playlist?.title,
      };
    });

    // Handle pagination
    if (!args.paginationOpts) {
      return { page: finalVideos, isDone: true, continueCursor: null };
    }

    const { numItems, cursor } = args.paginationOpts;
    const startIndex = cursor ? parseInt(cursor) : 0;
    const endIndex = startIndex + numItems;
    const page = finalVideos.slice(startIndex, endIndex);
    const isDone = endIndex >= finalVideos.length;
    const continueCursor = isDone ? null : String(endIndex);

    return { page, isDone, continueCursor };
  },
});

/**
 * @deprecated Use getAllVideos instead - this query is kept for backward compatibility
 * Get videos from uncategorized channels only (channels not linked to playlists)
 * Supports pagination for infinite scrolling
 */
export const getUncategorizedVideos = query({
  args: {
    includeHidden: v.optional(v.boolean()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: null };

    // Fetch all data sources in parallel
    const [links, allVideos, channels, hiddenVideos] = await Promise.all([
      ctx.db
        .query("channelPlaylistLinks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect(),
      ctx.db
        .query("youtubeVideosCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("youtubeChannelsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      !args.includeHidden
        ? ctx.db
            .query("hiddenItems")
            .withIndex("by_user_type_and_id", (q) =>
              q.eq("userId", userId).eq("itemType", "video"),
            )
            .collect()
        : Promise.resolve([]),
    ]);

    const categorizedChannelIds = new Set(
      links.map((link) => link.youtubeChannelId),
    );
    const hiddenIds = new Set(hiddenVideos.map((h) => h.youtubeId));
    const channelThumbnails = new Map(
      channels.map((c) => [c.youtubeChannelId, c.thumbnailUrl]),
    );

    // Single pass: filter uncategorized + hidden + deduplicate
    const seen = new Set<string>();
    const filtered = allVideos.filter((video) => {
      if (seen.has(video.youtubeVideoId)) return false;
      seen.add(video.youtubeVideoId);
      if (
        video.youtubeChannelId &&
        categorizedChannelIds.has(video.youtubeChannelId)
      )
        return false;
      if (!args.includeHidden && hiddenIds.has(video.youtubeVideoId))
        return false;
      return true;
    });

    // Sort by publishedAt (newest first)
    filtered.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });

    const enriched = filtered.map((v) => ({
      id: v.youtubeVideoId,
      playlistId: v.youtubePlaylistId,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      channelTitle: v.channelTitle,
      channelThumbnailUrl: v.youtubeChannelId
        ? channelThumbnails.get(v.youtubeChannelId)
        : undefined,
      duration: v.duration,
      publishedAt: v.publishedAt,
      cachedAt: v.cachedAt,
    }));

    // Handle pagination
    if (!args.paginationOpts) {
      return { page: enriched, isDone: true, continueCursor: null };
    }

    const { numItems, cursor } = args.paginationOpts;
    const startIndex = cursor ? parseInt(cursor) : 0;
    const endIndex = startIndex + numItems;
    const page = enriched.slice(startIndex, endIndex);
    const isDone = endIndex >= enriched.length;
    const continueCursor = isDone ? null : String(endIndex);

    return { page, isDone, continueCursor };
  },
});

/**
 * @deprecated Use getAllVideos instead - this query is kept for backward compatibility
 * Get all videos from categorized channels with playlist info (color, title)
 * Supports pagination for infinite scrolling
 */
export const getAllCategorizedVideos = query({
  args: {
    includeHidden: v.optional(v.boolean()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))), // asc = oldest first, desc = newest first
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: null };

    // Fetch all data sources in parallel
    const [allVideos, playlists, channels, hiddenVideos] = await Promise.all([
      ctx.db
        .query("youtubeVideosCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("youtubePlaylistsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("youtubeChannelsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      !args.includeHidden
        ? ctx.db
            .query("hiddenItems")
            .withIndex("by_user_type_and_id", (q) =>
              q.eq("userId", userId).eq("itemType", "video"),
            )
            .collect()
        : Promise.resolve([]),
    ]);

    const playlistMap = new Map(playlists.map((p) => [p.youtubePlaylistId, p]));
    const hiddenIds = new Set(hiddenVideos.map((h) => h.youtubeId));
    const channelThumbnails = new Map(
      channels.map((c) => [c.youtubeChannelId, c.thumbnailUrl]),
    );

    // Single pass: deduplicate + filter hidden
    const seen = new Set<string>();
    const filtered = allVideos.filter((v) => {
      if (seen.has(v.youtubeVideoId)) return false;
      seen.add(v.youtubeVideoId);
      if (!args.includeHidden && hiddenIds.has(v.youtubeVideoId)) return false;
      return true;
    });

    // Sort by publishedAt
    filtered.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return args.sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    // Enrich with playlist + channel data in a single map
    const finalVideos = filtered.map((v) => {
      const playlist = playlistMap.get(v.youtubePlaylistId);
      return {
        id: v.youtubeVideoId,
        playlistId: v.youtubePlaylistId,
        title: v.title,
        description: v.description,
        thumbnailUrl: v.thumbnailUrl,
        channelTitle: v.channelTitle,
        channelThumbnailUrl: v.youtubeChannelId
          ? channelThumbnails.get(v.youtubeChannelId)
          : undefined,
        duration: v.duration,
        publishedAt: v.publishedAt,
        cachedAt: v.cachedAt,
        playlistColor: playlist?.color,
        playlistTitle: playlist?.title,
      };
    });

    // Handle pagination
    if (!args.paginationOpts) {
      return { page: finalVideos, isDone: true, continueCursor: null };
    }

    const { numItems, cursor } = args.paginationOpts;
    const startIndex = cursor ? parseInt(cursor) : 0;
    const endIndex = startIndex + numItems;
    const page = finalVideos.slice(startIndex, endIndex);
    const isDone = endIndex >= finalVideos.length;
    const continueCursor = isDone ? null : String(endIndex);

    return { page, isDone, continueCursor };
  },
});

/**
 * @deprecated No longer needed with unified feed - kept for backward compatibility
 * Check if all channels are categorized (linked to playlists)
 */
export const areAllChannelsCategorized = query({
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId)
      return {
        allCategorized: false,
        totalChannels: 0,
        categorizedCount: 0,
      };

    // Get all unique channel IDs from videos
    const allVideos = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const uniqueChannels = new Set(
      allVideos
        .map((v) => v.youtubeChannelId)
        .filter((id): id is string => id !== undefined),
    );

    // Get categorized channel IDs
    const links = await ctx.db
      .query("channelPlaylistLinks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const categorizedChannels = new Set(
      links.map((link) => link.youtubeChannelId),
    );

    // Check if all channels are categorized
    const allCategorized =
      uniqueChannels.size > 0 &&
      Array.from(uniqueChannels).every((id) => categorizedChannels.has(id));

    return {
      allCategorized,
      totalChannels: uniqueChannels.size,
      categorizedCount: categorizedChannels.size,
    };
  },
});

/**
 * Update playlist color
 */
export const updatePlaylistColor = mutation({
  args: {
    playlistId: v.string(), // YouTube playlist ID
    color: v.string(), // Hex color
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const playlist = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user_and_youtube_id", (q) =>
        q.eq("userId", userId).eq("youtubePlaylistId", args.playlistId),
      )
      .first();

    if (!playlist) {
      throw new Error("Playlist not found");
    }

    await ctx.db.patch(playlist._id, { color: args.color });
  },
});

/**
 * Update playlist details (cache-only: color and customThumbnailUrl)
 */
export const updatePlaylistDetails = mutation({
  args: {
    playlistId: v.string(),
    color: v.optional(v.string()),
    customThumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const playlist = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user_and_youtube_id", (q) =>
        q.eq("userId", userId).eq("youtubePlaylistId", args.playlistId),
      )
      .first();

    if (!playlist) throw new Error("Playlist not found");

    const patch: Record<string, string | undefined> = {};
    if (args.color !== undefined) patch.color = args.color;
    if (args.customThumbnailUrl !== undefined)
      patch.customThumbnailUrl = args.customThumbnailUrl;

    await ctx.db.patch(playlist._id, patch);
  },
});

/**
 * Internal mutation to update playlist title/description in cache after YouTube API call
 */
export const updatePlaylistTitleInCache = internalMutation({
  args: {
    userId: v.string(),
    playlistId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const playlist = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user_and_youtube_id", (q) =>
        q.eq("userId", args.userId).eq("youtubePlaylistId", args.playlistId),
      )
      .first();

    if (!playlist) return;

    const patch: Record<string, string> = { title: args.title };
    if (args.description !== undefined) patch.description = args.description;

    await ctx.db.patch(playlist._id, patch);
  },
});

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Save YouTube OAuth tokens after successful authentication
 */
export const saveYoutubeTokens = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresIn: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      youtubeAccessToken: args.accessToken,
      youtubeRefreshToken: args.refreshToken,
      youtubeTokenExpiry: Date.now() + args.expiresIn * 1000,
      youtubeConnected: true,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Disconnect YouTube (remove tokens and clear cache)
 */
export const disconnectYoutube = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    if (!user) throw new Error("User not found");

    // Remove tokens
    await ctx.db.patch(user._id, {
      youtubeAccessToken: undefined,
      youtubeRefreshToken: undefined,
      youtubeTokenExpiry: undefined,
      youtubeConnected: false,
      updatedAt: Date.now(),
    });

    // Clear playlists + videos cache in parallel
    const [playlists, videos] = await Promise.all([
      ctx.db
        .query("youtubePlaylistsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("youtubeVideosCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    await Promise.all([
      ...playlists.map((p) => ctx.db.delete(p._id)),
      ...videos.map((v) => ctx.db.delete(v._id)),
    ]);
  },
});

/**
 * Update playlists cache with fresh data from YouTube API
 */
export const updatePlaylistsCache = mutation({
  args: {
    playlists: v.array(
      v.object({
        youtubePlaylistId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        thumbnailUrl: v.optional(v.string()),
        videoCount: v.number(),
        privacyStatus: v.string(),
        publishedAt: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();

    // Get existing playlists
    const existingPlaylists = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const existingMap = new Map(
      existingPlaylists.map((p) => [p.youtubePlaylistId, p]),
    );

    // Update or insert playlists
    for (const playlist of args.playlists) {
      const existing = existingMap.get(playlist.youtubePlaylistId);

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...playlist,
          cachedAt: now,
        });
        existingMap.delete(playlist.youtubePlaylistId);
      } else {
        await ctx.db.insert("youtubePlaylistsCache", {
          userId,
          ...playlist,
          cachedAt: now,
        });
      }
    }

    // Delete playlists that no longer exist on YouTube
    for (const playlist of Array.from(existingMap.values())) {
      const staleVideos = await ctx.db
        .query("youtubeVideosCache")
        .withIndex("by_user_and_playlist", (q) =>
          q
            .eq("userId", userId)
            .eq("youtubePlaylistId", playlist.youtubePlaylistId),
        )
        .collect();
      for (const video of staleVideos) {
        await ctx.db.delete(video._id);
      }
      await ctx.db.delete(playlist._id);
    }
  },
});

/**
 * Update videos cache for a specific playlist
 */
export const updateVideosCache = mutation({
  args: {
    playlistId: v.string(),
    videos: v.array(
      v.object({
        youtubeVideoId: v.string(),
        playlistItemId: v.optional(v.string()),
        title: v.string(),
        description: v.optional(v.string()),
        thumbnailUrl: v.optional(v.string()),
        channelTitle: v.string(),
        youtubeChannelId: v.optional(v.string()),
        duration: v.optional(v.string()),
        position: v.number(),
        publishedAt: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();

    // Get existing videos for this playlist
    const existingVideos = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", userId).eq("youtubePlaylistId", args.playlistId),
      )
      .collect();

    const existingMap = new Map(
      existingVideos.map((v) => [v.youtubeVideoId, v]),
    );

    // Update or insert videos
    for (const video of args.videos) {
      const existing = existingMap.get(video.youtubeVideoId);

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...video,
          youtubePlaylistId: args.playlistId,
          cachedAt: now,
        });
        existingMap.delete(video.youtubeVideoId);
      } else {
        await ctx.db.insert("youtubeVideosCache", {
          userId,
          youtubePlaylistId: args.playlistId,
          ...video,
          cachedAt: now,
        });
      }
    }

    // Delete videos that no longer exist in the playlist
    for (const video of Array.from(existingMap.values())) {
      await ctx.db.delete(video._id);
    }
  },
});

/**
 * Update YouTube channels cache with fresh subscription data
 */
export const updateChannelsCache = mutation({
  args: {
    channels: v.array(
      v.object({
        youtubeChannelId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        thumbnailUrl: v.optional(v.string()),
        subscriberCount: v.optional(v.string()),
        videoCount: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();

    // Get existing channels
    const existingChannels = await ctx.db
      .query("youtubeChannelsCache")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const existingMap = new Map(
      existingChannels.map((c) => [c.youtubeChannelId, c]),
    );

    // Update or insert channels
    for (const channel of args.channels) {
      const existing = existingMap.get(channel.youtubeChannelId);

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...channel,
          cachedAt: now,
        });
        existingMap.delete(channel.youtubeChannelId);
      } else {
        await ctx.db.insert("youtubeChannelsCache", {
          userId,
          ...channel,
          cachedAt: now,
        });
      }
    }

    // Remove channels user is no longer subscribed to
    for (const channel of Array.from(existingMap.values())) {
      await ctx.db.delete(channel._id);
    }
  },
});

/**
 * Internal mutation to insert a video directly to cache (avoids API call after playlist insert)
 * Used by addVideoToYoutubePlaylist to avoid calling fetchPlaylistItems after each insert
 */
export const insertVideoToCache = internalMutation({
  args: {
    userId: v.string(),
    playlistId: v.string(),
    video: v.object({
      videoId: v.string(),
      playlistItemId: v.string(),
      title: v.string(),
      channelTitle: v.string(),
      youtubeChannelId: v.optional(v.string()),
      thumbnailUrl: v.optional(v.string()),
      description: v.optional(v.string()),
      duration: v.optional(v.string()),
      position: v.number(),
      publishedAt: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Check if video already exists in this playlist
    const existing = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", args.userId).eq("youtubePlaylistId", args.playlistId),
      )
      .filter((q) => q.eq(q.field("youtubeVideoId"), args.video.videoId))
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        playlistItemId: args.video.playlistItemId,
        title: args.video.title,
        channelTitle: args.video.channelTitle,
        youtubeChannelId: args.video.youtubeChannelId,
        thumbnailUrl: args.video.thumbnailUrl,
        description: args.video.description,
        duration: args.video.duration,
        position: args.video.position,
        publishedAt: args.video.publishedAt,
        cachedAt: Date.now(),
      });
    } else {
      // Insert new video
      await ctx.db.insert("youtubeVideosCache", {
        userId: args.userId,
        youtubePlaylistId: args.playlistId,
        youtubeVideoId: args.video.videoId,
        playlistItemId: args.video.playlistItemId,
        title: args.video.title,
        channelTitle: args.video.channelTitle,
        youtubeChannelId: args.video.youtubeChannelId,
        thumbnailUrl: args.video.thumbnailUrl,
        description: args.video.description,
        duration: args.video.duration,
        position: args.video.position,
        publishedAt: args.video.publishedAt,
        cachedAt: Date.now(),
      });
    }

    // Update playlist video count
    const playlist = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user_and_youtube_id", (q) =>
        q.eq("userId", args.userId).eq("youtubePlaylistId", args.playlistId),
      )
      .first();

    if (playlist && !existing) {
      await ctx.db.patch(playlist._id, {
        videoCount: (playlist.videoCount ?? 0) + 1,
      });
    }
  },
});

/**
 * Internal query to get a cached video by ID (for reusing video details)
 */
export const getCachedVideoById = internalQuery({
  args: {
    userId: v.string(),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find any cached instance of this video (from any playlist)
    const videos = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("youtubeVideoId"), args.videoId))
      .first();

    if (!videos) return null;

    return {
      videoId: videos.youtubeVideoId,
      title: videos.title,
      channelTitle: videos.channelTitle,
      youtubeChannelId: videos.youtubeChannelId,
      thumbnailUrl: videos.thumbnailUrl,
      description: videos.description,
      duration: videos.duration,
      publishedAt: videos.publishedAt,
    };
  },
});

/**
 * Internal query to get ALL cache entries for a video across all playlists
 * Used by removeVideoFromAllPlaylists
 */
export const getVideoCacheEntries = internalQuery({
  args: {
    userId: v.string(),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", args.userId).eq("youtubeVideoId", args.videoId),
      )
      .collect();

    return entries.map((e) => ({
      playlistId: e.youtubePlaylistId,
      playlistItemId: e.playlistItemId,
    }));
  },
});

/**
 * Internal mutation to remove a video from cache (avoids API call after playlist delete)
 * Used by removeVideoFromYoutubePlaylist to avoid calling fetchPlaylistItems after each delete
 */
export const removeVideoFromCache = internalMutation({
  args: {
    userId: v.string(),
    playlistId: v.string(),
    playlistItemId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find and delete the video from cache
    const video = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", args.userId).eq("youtubePlaylistId", args.playlistId),
      )
      .filter((q) => q.eq(q.field("playlistItemId"), args.playlistItemId))
      .first();

    if (video) {
      await ctx.db.delete(video._id);

      // Update playlist video count
      const playlist = await ctx.db
        .query("youtubePlaylistsCache")
        .withIndex("by_user_and_youtube_id", (q) =>
          q.eq("userId", args.userId).eq("youtubePlaylistId", args.playlistId),
        )
        .first();

      if (playlist && playlist.videoCount > 0) {
        await ctx.db.patch(playlist._id, {
          videoCount: playlist.videoCount - 1,
        });
      }
    }
  },
});

/**
 * Internal mutation to update video position in cache (avoids API call after playlist reorder)
 * Used by moveVideoInYoutubePlaylist to avoid calling fetchPlaylistItems after move
 */
export const updateVideoPositionInCache = internalMutation({
  args: {
    userId: v.string(),
    playlistId: v.string(),
    playlistItemId: v.string(),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all videos in the playlist
    const videos = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", args.userId).eq("youtubePlaylistId", args.playlistId),
      )
      .collect();

    // Find the moved video
    const movedVideo = videos.find(
      (v) => v.playlistItemId === args.playlistItemId,
    );
    if (!movedVideo) return;

    const oldPosition = movedVideo.position;
    const newPosition = args.newPosition;

    // Update positions for affected videos
    for (const video of videos) {
      if (video.playlistItemId === args.playlistItemId) {
        // Update the moved video's position
        await ctx.db.patch(video._id, {
          position: newPosition,
          cachedAt: Date.now(),
        });
      } else if (oldPosition < newPosition) {
        // Moving down: shift videos in between up by 1
        if (video.position > oldPosition && video.position <= newPosition) {
          await ctx.db.patch(video._id, { position: video.position - 1 });
        }
      } else if (oldPosition > newPosition) {
        // Moving up: shift videos in between down by 1
        if (video.position >= newPosition && video.position < oldPosition) {
          await ctx.db.patch(video._id, { position: video.position + 1 });
        }
      }
    }
  },
});

/**
 * Internal mutation to update tokens after refresh
 */
export const updateYoutubeTokens = internalMutation({
  args: {
    userId: v.string(),
    accessToken: v.string(),
    expiresIn: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      youtubeAccessToken: args.accessToken,
      youtubeTokenExpiry: Date.now() + args.expiresIn * 1000,
      updatedAt: Date.now(),
    });
  },
});

// =============================================================================
// ACTIONS (External API calls)
// =============================================================================

/**
 * Get user's YouTube tokens (for use in actions)
 */
async function getYoutubeTokens(ctx: any, userId: string) {
  const user = await ctx.runQuery(internal.youtube.getUserTokens, { userId });
  return user;
}

/**
 * Internal query to get user tokens for actions
 */
export const getUserTokens = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) return null;

    return {
      accessToken: user.youtubeAccessToken,
      refreshToken: user.youtubeRefreshToken,
      tokenExpiry: user.youtubeTokenExpiry,
    };
  },
});

/**
 * Refresh YouTube access token using refresh token
 */
export const refreshYoutubeToken = action({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const tokens = await ctx.runQuery(internal.youtube.getUserTokens, {
      userId,
    });

    if (!tokens?.refreshToken) {
      throw new Error("No refresh token available");
    }

    const clientId =
      process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Missing Google OAuth credentials:", {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        clientIdSource: process.env.GOOGLE_CLIENT_ID
          ? "GOOGLE_CLIENT_ID"
          : process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
            ? "NEXT_PUBLIC_GOOGLE_CLIENT_ID"
            : "none",
      });
      throw new Error("Google OAuth credentials not configured");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Token refresh failed:", error);
      throw new Error("Failed to refresh token");
    }

    const data = await response.json();

    // Update tokens in database
    await ctx.runMutation(internal.youtube.updateYoutubeTokens, {
      userId,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });

    return data.access_token;
  },
});

/**
 * Helper to get valid access token (refreshes if expired)
 */
async function getValidAccessToken(ctx: any, userId: string): Promise<string> {
  const tokens = await ctx.runQuery(internal.youtube.getUserTokens, { userId });

  if (!tokens?.accessToken) {
    throw new Error("YouTube not connected");
  }

  // Check if token is expired or will expire soon (within 5 minutes)
  if (tokens.tokenExpiry && tokens.tokenExpiry < Date.now() + 5 * 60 * 1000) {
    const newToken = await ctx.runAction(api.youtube.refreshYoutubeToken, {});
    if (!newToken) throw new Error("Failed to refresh token");
    return newToken;
  }

  return tokens.accessToken;
}

/**
 * Fetch user's YouTube playlists from API
 */
export const fetchYoutubePlaylists = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    const startTime = Date.now();
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/playlists?" +
        new URLSearchParams({
          part: "snippet,contentDetails,status",
          mine: "true",
          maxResults: "50",
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const responseTimeMs = Date.now() - startTime;

    // Log API metrics
    await ctx.runMutation(internal.metrics.logApiCallInternal, {
      userId,
      endpoint: "playlists.list",
      quotaUnits: YOUTUBE_QUOTA_COSTS["playlists.list"],
      success: response.ok,
      errorMessage: response.ok ? undefined : await response.clone().text(),
      responseTimeMs,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      throw new Error("Failed to fetch playlists");
    }

    const data = await response.json();

    const playlists = (data.items || []).map((item: any) => ({
      youtubePlaylistId: item.id,
      title: item.snippet.title,
      description: item.snippet.description || "",
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url,
      videoCount: item.contentDetails?.itemCount || 0,
      privacyStatus: item.status?.privacyStatus || "private",
      publishedAt: item.snippet.publishedAt,
    }));

    // Update cache
    await ctx.runMutation(api.youtube.updatePlaylistsCache, { playlists });

    return playlists;
  },
});

/**
 * Fetch videos for a specific playlist from YouTube API
 */
export const fetchPlaylistItems = action({
  args: { playlistId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    // Fetch playlist items
    const startTime1 = Date.now();
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/playlistItems?" +
        new URLSearchParams({
          part: "snippet,contentDetails",
          playlistId: args.playlistId,
          maxResults: "50",
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const responseTimeMs1 = Date.now() - startTime1;

    // Log playlistItems.list API call
    await ctx.runMutation(internal.metrics.logApiCallInternal, {
      userId,
      endpoint: "playlistItems.list",
      quotaUnits: YOUTUBE_QUOTA_COSTS["playlistItems.list"],
      success: response.ok,
      errorMessage: response.ok ? undefined : await response.clone().text(),
      responseTimeMs: responseTimeMs1,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      throw new Error("Failed to fetch playlist items");
    }

    const data = await response.json();

    // Get video IDs for duration lookup
    const videoIdList: string[] = (data.items || [])
      .map((item: any) => item.contentDetails?.videoId)
      .filter(Boolean);
    const uniqueVideoIds: string[] = Array.from(new Set(videoIdList));

    const cachedDetails = await ctx.runQuery(
      youtubeInternal.getCachedVideoDetailsByIds,
      {
        userId,
        videoIds: uniqueVideoIds,
      },
    );
    const cachedDetailsById = new Map<string, any>(
      cachedDetails.map((video: any) => [video.youtubeVideoId, video]),
    );
    const missingVideoIds = uniqueVideoIds.filter((videoId) => {
      const cached = cachedDetailsById.get(videoId);
      return !cached?.duration || !cached?.publishedAt;
    });

    // Fetch video details for duration and actual upload date
    let durations: Record<string, string> = {};
    let videoPublishDates: Record<string, string> = {};
    for (const video of cachedDetails) {
      if (video.duration) durations[video.youtubeVideoId] = video.duration;
      if (video.publishedAt)
        videoPublishDates[video.youtubeVideoId] = video.publishedAt;
    }

    if (missingVideoIds.length > 0) {
      const startTime2 = Date.now();
      const videosResponse = await fetch(
        "https://www.googleapis.com/youtube/v3/videos?" +
          new URLSearchParams({
            part: "contentDetails,snippet",
            id: missingVideoIds.join(","),
          }),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const responseTimeMs2 = Date.now() - startTime2;

      // Log videos.list API call
      await ctx.runMutation(internal.metrics.logApiCallInternal, {
        userId,
        endpoint: "videos.list",
        quotaUnits: YOUTUBE_QUOTA_COSTS["videos.list"],
        success: videosResponse.ok,
        errorMessage: videosResponse.ok
          ? undefined
          : await videosResponse.clone().text(),
        responseTimeMs: responseTimeMs2,
      });

      if (videosResponse.ok) {
        const videosData = await videosResponse.json();
        durations = (videosData.items || []).reduce(
          (acc: Record<string, string>, item: any) => {
            acc[item.id] = parseDuration(item.contentDetails?.duration);
            return acc;
          },
          {},
        );
        // Extract actual video upload dates
        videoPublishDates = (videosData.items || []).reduce(
          (acc: Record<string, string>, item: any) => {
            acc[item.id] = item.snippet?.publishedAt;
            return acc;
          },
          {},
        );
      }
    }

    const videos = (data.items || []).map((item: any, index: number) => ({
      youtubeVideoId: item.contentDetails?.videoId,
      playlistItemId: item.id,
      title: item.snippet.title,
      description: item.snippet.description || "",
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url,
      channelTitle: item.snippet.videoOwnerChannelTitle || "",
      youtubeChannelId: item.snippet.videoOwnerChannelId || undefined,
      duration: durations[item.contentDetails?.videoId] || "",
      position: item.snippet.position ?? index,
      publishedAt:
        videoPublishDates[item.contentDetails?.videoId] ||
        item.snippet.publishedAt,
    }));

    // Update cache
    await ctx.runMutation(api.youtube.updateVideosCache, {
      playlistId: args.playlistId,
      videos,
    });

    return videos;
  },
});

/**
 * Quota-aware full sync orchestration.
 *
 * This replaces the Flutter-side loop over every playlist with one backend
 * action that can enforce quota, expose progress, and reuse an active job.
 */
export const startQuotaSafeSync = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const activeJob = await ctx.runQuery(
      youtubeInternal.getActiveYoutubeSyncJob,
      {
        userId,
      },
    );
    if (activeJob) {
      return { reused: true, job: activeJob };
    }

    const cachedPlan = await ctx.runQuery(
      youtubeInternal.getCachedPlaylistSyncPlan,
      {
        userId,
      },
    );
    const quotaBefore = await ctx.runQuery(
      metricsInternal.getQuotaUsageForUserInternal,
      {
        userId,
      },
    );
    const effectiveLimit = getEffectiveQuotaLimit(quotaBefore.limit);
    const usedBefore = quotaBefore.used;
    const percentageBefore = getQuotaPercentage(usedBefore, effectiveLimit);

    if (percentageBefore >= YOUTUBE_SYNC_HARD_STOP_PERCENTAGE) {
      throw new Error(
        `YouTube sync disabled: quota usage is ${percentageBefore}% of the daily limit.`,
      );
    }

    const initialEstimate = estimateFullSyncQuotaUnits(cachedPlan.length);
    const jobId = await ctx.runMutation(youtubeInternal.createYoutubeSyncJob, {
      userId,
      total: cachedPlan.length,
      estimatedQuotaUnits: initialEstimate,
    });

    try {
      await ctx.runMutation(youtubeInternal.updateYoutubeSyncJob, {
        jobId,
        phase: "playlists",
        current: 0,
        usedQuotaUnits: 0,
      });

      const playlists = await ctx.runAction(
        youtubeApi.fetchYoutubePlaylists,
        {},
      );
      const playlistSummaries = (Array.isArray(playlists) ? playlists : [])
        .map((playlist: any) => ({
          youtubePlaylistId: playlist.youtubePlaylistId?.toString() ?? "",
          title: playlist.title?.toString() ?? "",
          videoCount: Number(playlist.videoCount ?? 0),
        }))
        .filter((playlist: any) => playlist.youtubePlaylistId.length > 0);

      await ctx.runMutation(youtubeInternal.updateYoutubeSyncJob, {
        jobId,
        phase: "videos",
        total: playlistSummaries.length,
        estimatedQuotaUnits: estimateFullSyncQuotaUnits(
          playlistSummaries.length,
        ),
        usedQuotaUnits: YOUTUBE_QUOTA_COSTS["playlists.list"],
      });

      let completedPlaylists = 0;
      let stoppedForQuota = false;
      let terminalJob: unknown = null;

      for (const playlist of playlistSummaries) {
        const quotaNow = await ctx.runQuery(
          metricsInternal.getQuotaUsageForUserInternal,
          {
            userId,
          },
        );
        const currentEffectiveLimit = getEffectiveQuotaLimit(quotaNow.limit);
        if (shouldStopForQuota(quotaNow.used, currentEffectiveLimit)) {
          stoppedForQuota = true;
          terminalJob = await ctx.runMutation(
            youtubeInternal.updateYoutubeSyncJob,
            {
              jobId,
              status: "partial",
              phase: "videos",
              current: completedPlaylists,
              usedQuotaUnits: quotaNow.used - usedBefore,
              error:
                "Stopped before the next playlist because YouTube quota usage reached the safety threshold.",
              completed: true,
            },
          );
          break;
        }

        await ctx.runMutation(youtubeInternal.updateYoutubeSyncJob, {
          jobId,
          phase: "videos",
          current: completedPlaylists,
          currentPlaylistId: playlist.youtubePlaylistId,
          currentPlaylistTitle: playlist.title,
          usedQuotaUnits: quotaNow.used - usedBefore,
        });

        try {
          await ctx.runAction(youtubeApi.fetchPlaylistItems, {
            playlistId: playlist.youtubePlaylistId,
          });
        } catch (error) {
          await ctx.runMutation(youtubeInternal.updateYoutubeSyncJob, {
            jobId,
            error: `Playlist ${playlist.title || playlist.youtubePlaylistId}: ${formatSyncError(error)}`,
          });
        }

        completedPlaylists += 1;
      }

      if (!stoppedForQuota) {
        const quotaAfter = await ctx.runQuery(
          metricsInternal.getQuotaUsageForUserInternal,
          {
            userId,
          },
        );
        const latestJob = await ctx.runMutation(
          youtubeInternal.updateYoutubeSyncJob,
          {
            jobId,
            status: "completed",
            phase: "completed",
            current: playlistSummaries.length,
            total: playlistSummaries.length,
            usedQuotaUnits: quotaAfter.used - usedBefore,
            completed: true,
          },
        );

        return { reused: false, job: latestJob };
      }

      return { reused: false, job: terminalJob };
    } catch (error) {
      const quotaAfter = await ctx.runQuery(
        metricsInternal.getQuotaUsageForUserInternal,
        {
          userId,
        },
      );
      await ctx.runMutation(youtubeInternal.updateYoutubeSyncJob, {
        jobId,
        status: "failed",
        phase: "failed",
        usedQuotaUnits: quotaAfter.used - usedBefore,
        error: formatSyncError(error),
        completed: true,
      });
      throw error;
    }
  },
});

/**
 * Create a new YouTube playlist
 */
export const createYoutubePlaylist = action({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    privacyStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    const startTime = Date.now();
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/playlists?part=snippet",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            title: args.title,
            description: args.description || "",
          },
          status: {
            privacyStatus: args.privacyStatus || "private",
          },
        }),
      },
    );
    const responseTimeMs = Date.now() - startTime;

    // Log playlists.insert API call
    await ctx.runMutation(internal.metrics.logApiCallInternal, {
      userId,
      endpoint: "playlists.insert",
      quotaUnits: YOUTUBE_QUOTA_COSTS["playlists.insert"],
      success: response.ok,
      errorMessage: response.ok ? undefined : await response.clone().text(),
      responseTimeMs,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("YouTube API error creating playlist:", errorText);
      // Try to parse the error for a more helpful message
      let errorMessage = errorText;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage =
          errorData?.error?.errors?.[0]?.reason ||
          errorData?.error?.message ||
          errorText;
      } catch {
        // Keep errorText as-is
      }
      throw new Error(`Failed to create playlist: ${errorMessage}`);
    }

    const data = await response.json();

    // Note: Frontend calls refreshPlaylists() after creation to update the list

    return {
      id: data.id,
      title: data.snippet.title,
    };
  },
});

/**
 * Add a video to a YouTube playlist
 * OPTIMIZED: Uses direct cache insert instead of fetching full playlist after insert
 * Saves 2 API units per video (playlistItems.list + videos.list)
 */
export const addVideoToYoutubePlaylist = action({
  args: {
    playlistId: v.string(),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    // Check if we already have this video cached (from any playlist)
    // This avoids an extra videos.list API call if the video is already known
    let cachedVideo = await ctx.runQuery(internal.youtube.getCachedVideoById, {
      userId,
      videoId: args.videoId,
    });

    // If video is not in cache, fetch details from API (1 unit)
    let videoDetails: {
      videoId: string;
      title: string;
      channelTitle: string;
      youtubeChannelId?: string;
      thumbnailUrl?: string;
      description?: string;
      duration?: string;
      publishedAt?: string;
    };

    if (cachedVideo) {
      videoDetails = cachedVideo;
    } else {
      // Fetch video details (1 unit)
      const detailsStartTime = Date.now();
      const detailsResponse = await fetch(
        "https://www.googleapis.com/youtube/v3/videos?" +
          new URLSearchParams({
            part: "snippet,contentDetails",
            id: args.videoId,
          }),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const detailsResponseTimeMs = Date.now() - detailsStartTime;

      await ctx.runMutation(internal.metrics.logApiCallInternal, {
        userId,
        endpoint: "videos.list",
        quotaUnits: YOUTUBE_QUOTA_COSTS["videos.list"],
        success: detailsResponse.ok,
        errorMessage: detailsResponse.ok
          ? undefined
          : await detailsResponse.clone().text(),
        responseTimeMs: detailsResponseTimeMs,
      });

      if (!detailsResponse.ok) {
        throw new Error("Failed to fetch video details");
      }

      const detailsData = await detailsResponse.json();
      const video = detailsData.items?.[0];

      if (!video) {
        throw new Error("Video not found");
      }

      videoDetails = {
        videoId: args.videoId,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        youtubeChannelId: video.snippet.channelId,
        thumbnailUrl:
          video.snippet.thumbnails?.high?.url ||
          video.snippet.thumbnails?.medium?.url ||
          video.snippet.thumbnails?.default?.url,
        description: video.snippet.description,
        duration: parseDuration(video.contentDetails?.duration),
        publishedAt: video.snippet.publishedAt,
      };
    }

    // Insert video to YouTube playlist (50 units - unavoidable)
    const startTime = Date.now();
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            playlistId: args.playlistId,
            resourceId: {
              kind: "youtube#video",
              videoId: args.videoId,
            },
          },
        }),
      },
    );
    const responseTimeMs = Date.now() - startTime;

    // Log playlistItems.insert API call
    await ctx.runMutation(internal.metrics.logApiCallInternal, {
      userId,
      endpoint: "playlistItems.insert",
      quotaUnits: YOUTUBE_QUOTA_COSTS["playlistItems.insert"],
      success: response.ok,
      errorMessage: response.ok ? undefined : await response.clone().text(),
      responseTimeMs,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      throw new Error("Failed to add video to playlist");
    }

    const data = await response.json();

    // Update local cache directly (0 API units - saves 2 units vs fetchPlaylistItems)
    await ctx.runMutation(internal.youtube.insertVideoToCache, {
      userId,
      playlistId: args.playlistId,
      video: {
        videoId: args.videoId,
        playlistItemId: data.id,
        title: videoDetails.title,
        channelTitle: videoDetails.channelTitle,
        youtubeChannelId: videoDetails.youtubeChannelId,
        thumbnailUrl: videoDetails.thumbnailUrl,
        description: videoDetails.description,
        duration: videoDetails.duration,
        position: data.snippet?.position ?? 0,
        publishedAt: videoDetails.publishedAt,
      },
    });

    return { playlistItemId: data.id };
  },
});

/**
 * Remove a video from a YouTube playlist
 * OPTIMIZED: Uses direct cache removal instead of fetching full playlist after delete
 * Saves 2 API units per video (playlistItems.list + videos.list)
 */
export const removeVideoFromYoutubePlaylist = action({
  args: {
    playlistItemId: v.string(),
    playlistId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    const startTime = Date.now();
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?id=${args.playlistItemId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const responseTimeMs = Date.now() - startTime;

    // Log playlistItems.delete API call
    await ctx.runMutation(internal.metrics.logApiCallInternal, {
      userId,
      endpoint: "playlistItems.delete",
      quotaUnits: YOUTUBE_QUOTA_COSTS["playlistItems.delete"],
      success: response.ok,
      errorMessage: response.ok ? undefined : await response.clone().text(),
      responseTimeMs,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      throw new Error("Failed to remove video from playlist");
    }

    // Update local cache directly (0 API units - saves 2 units vs fetchPlaylistItems)
    await ctx.runMutation(internal.youtube.removeVideoFromCache, {
      userId,
      playlistId: args.playlistId,
      playlistItemId: args.playlistItemId,
    });
  },
});

/**
 * Remove a video from ALL user playlists (feed-level delete)
 * Finds every youtubeVideosCache entry for this videoId, calls the YouTube API
 * to delete from real playlists, removes cache entries, and hides the video.
 */
export const removeVideoFromAllPlaylists = action({
  args: {
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    // Find all cache entries for this video across all playlists
    const entries = await ctx.runQuery(internal.youtube.getVideoCacheEntries, {
      userId,
      videoId: args.videoId,
    });

    let removedCount = 0;

    for (const entry of entries) {
      // Skip subscription feed entries — can't delete from channel uploads
      if (entry.playlistId === SUBSCRIPTION_PLAYLIST_ID) continue;
      if (!entry.playlistItemId) continue;

      // Call YouTube API to remove from this playlist
      const startTime = Date.now();
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?id=${entry.playlistItemId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const responseTimeMs = Date.now() - startTime;

      await ctx.runMutation(internal.metrics.logApiCallInternal, {
        userId,
        endpoint: "playlistItems.delete",
        quotaUnits: YOUTUBE_QUOTA_COSTS["playlistItems.delete"],
        success: response.ok,
        errorMessage: response.ok ? undefined : await response.clone().text(),
        responseTimeMs,
      });

      if (response.ok) {
        // Remove from cache
        await ctx.runMutation(internal.youtube.removeVideoFromCache, {
          userId,
          playlistId: entry.playlistId,
          playlistItemId: entry.playlistItemId,
        });
        removedCount++;
      }
    }

    // Also hide the video so it doesn't reappear from subscription feed
    await ctx.runMutation(api.hidden.hideItem, {
      itemType: "video",
      youtubeId: args.videoId,
    });

    return { removedCount };
  },
});

/**
 * Search for videos on YouTube
 */
export const searchYoutubeVideos = action({
  args: {
    query: v.string(),
    maxResults: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    const maxResults = args.maxResults ?? 10;

    // Search for videos
    const startTime1 = Date.now();
    const searchResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/search?" +
        new URLSearchParams({
          part: "snippet",
          q: args.query,
          type: "video",
          maxResults: String(maxResults),
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const responseTimeMs1 = Date.now() - startTime1;

    // Log search.list API call (100 units!)
    await ctx.runMutation(internal.metrics.logApiCallInternal, {
      userId,
      endpoint: "search.list",
      quotaUnits: YOUTUBE_QUOTA_COSTS["search.list"],
      success: searchResponse.ok,
      errorMessage: searchResponse.ok
        ? undefined
        : await searchResponse.clone().text(),
      responseTimeMs: responseTimeMs1,
    });

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      console.error("YouTube API error:", error);
      throw new Error("Failed to search videos");
    }

    const searchData = await searchResponse.json();

    // Get video IDs for duration lookup
    const videoIds = (searchData.items || [])
      .map((item: any) => item.id?.videoId)
      .filter(Boolean)
      .join(",");

    // Fetch video details for duration
    let durations: Record<string, string> = {};
    if (videoIds) {
      const startTime2 = Date.now();
      const videosResponse = await fetch(
        "https://www.googleapis.com/youtube/v3/videos?" +
          new URLSearchParams({
            part: "contentDetails,statistics",
            id: videoIds,
          }),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const responseTimeMs2 = Date.now() - startTime2;

      // Log videos.list API call
      await ctx.runMutation(internal.metrics.logApiCallInternal, {
        userId,
        endpoint: "videos.list",
        quotaUnits: YOUTUBE_QUOTA_COSTS["videos.list"],
        success: videosResponse.ok,
        errorMessage: videosResponse.ok
          ? undefined
          : await videosResponse.clone().text(),
        responseTimeMs: responseTimeMs2,
      });

      if (videosResponse.ok) {
        const videosData = await videosResponse.json();
        durations = (videosData.items || []).reduce(
          (acc: Record<string, string>, item: any) => {
            acc[item.id] = parseDuration(item.contentDetails?.duration);
            return acc;
          },
          {},
        );
      }
    }

    return (searchData.items || []).map((item: any) => ({
      id: item.id?.videoId,
      title: item.snippet.title,
      description: item.snippet.description || "",
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      duration: durations[item.id?.videoId] || "",
    }));
  },
});

/**
 * Get video details by ID (for adding external videos)
 */
export const getYoutubeVideoDetails = action({
  args: { videoId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    const startTime = Date.now();
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/videos?" +
        new URLSearchParams({
          part: "snippet,contentDetails,statistics",
          id: args.videoId,
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const responseTimeMs = Date.now() - startTime;

    // Log videos.list API call
    await ctx.runMutation(internal.metrics.logApiCallInternal, {
      userId,
      endpoint: "videos.list",
      quotaUnits: YOUTUBE_QUOTA_COSTS["videos.list"],
      success: response.ok,
      errorMessage: response.ok ? undefined : await response.clone().text(),
      responseTimeMs,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      throw new Error("Failed to get video details");
    }

    const data = await response.json();
    const video = data.items?.[0];

    if (!video) {
      throw new Error("Video not found");
    }

    return {
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description || "",
      thumbnailUrl:
        video.snippet.thumbnails?.high?.url ||
        video.snippet.thumbnails?.medium?.url ||
        video.snippet.thumbnails?.default?.url,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      duration: parseDuration(video.contentDetails?.duration),
      viewCount: parseInt(video.statistics?.viewCount || "0", 10),
      likeCount: parseInt(video.statistics?.likeCount || "0", 10),
    };
  },
});

/**
 * Move a video to a new position within a YouTube playlist
 */
export const moveVideoInYoutubePlaylist = action({
  args: {
    playlistId: v.string(),
    playlistItemId: v.string(),
    videoId: v.string(),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    // YouTube API requires updating the playlistItem with the new position
    const startTime = Date.now();
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: args.playlistItemId,
          snippet: {
            playlistId: args.playlistId,
            resourceId: {
              kind: "youtube#video",
              videoId: args.videoId,
            },
            position: args.newPosition,
          },
        }),
      },
    );
    const responseTimeMs = Date.now() - startTime;

    // Log playlistItems.update API call
    await ctx.runMutation(internal.metrics.logApiCallInternal, {
      userId,
      endpoint: "playlistItems.update",
      quotaUnits: YOUTUBE_QUOTA_COSTS["playlistItems.update"],
      success: response.ok,
      errorMessage: response.ok ? undefined : await response.clone().text(),
      responseTimeMs,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      throw new Error("Failed to move video in playlist");
    }

    // Update local cache directly (0 API units - saves 2 units vs fetchPlaylistItems)
    await ctx.runMutation(internal.youtube.updateVideoPositionInCache, {
      userId,
      playlistId: args.playlistId,
      playlistItemId: args.playlistItemId,
      newPosition: args.newPosition,
    });

    return { success: true };
  },
});

/**
 * Delete a YouTube playlist
 */
export const deleteYoutubePlaylist = action({
  args: { playlistId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    const startTime = Date.now();
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?id=${args.playlistId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const responseTimeMs = Date.now() - startTime;

    // Log playlists.delete API call
    await ctx.runMutation(internal.metrics.logApiCallInternal, {
      userId,
      endpoint: "playlists.delete",
      quotaUnits: YOUTUBE_QUOTA_COSTS["playlists.delete"],
      success: response.ok,
      errorMessage: response.ok ? undefined : await response.clone().text(),
      responseTimeMs,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      throw new Error("Failed to delete playlist");
    }

    // Refresh playlists cache (this will log its own playlists.list call)
    await ctx.runAction(api.youtube.fetchYoutubePlaylists, {});
  },
});

/**
 * Update a YouTube playlist title/description via YouTube API
 */
export const updateYoutubePlaylist = action({
  args: {
    playlistId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    const startTime = Date.now();
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: args.playlistId,
          snippet: {
            title: args.title,
            description: args.description ?? "",
          },
        }),
      },
    );
    const responseTimeMs = Date.now() - startTime;

    await ctx.runMutation(internal.metrics.logApiCallInternal, {
      userId,
      endpoint: "playlists.update",
      quotaUnits: YOUTUBE_QUOTA_COSTS["playlists.update"],
      success: response.ok,
      errorMessage: response.ok ? undefined : await response.clone().text(),
      responseTimeMs,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error updating playlist:", error);
      throw new Error("Failed to update playlist");
    }

    // Update cache
    await ctx.runMutation(internal.youtube.updatePlaylistTitleInCache, {
      userId,
      playlistId: args.playlistId,
      title: args.title,
      description: args.description,
    });

    return { success: true };
  },
});

/**
 * Fetch user's YouTube subscriptions (channels they're subscribed to)
 */
export const fetchYoutubeSubscriptions = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    const allChannels: Array<{
      youtubeChannelId: string;
      title: string;
      description?: string;
      thumbnailUrl?: string;
      subscriberCount?: string;
      videoCount?: string;
    }> = [];

    let pageToken: string | undefined;

    // Fetch all subscriptions with pagination (max 50 per page)
    do {
      const params = new URLSearchParams({
        part: "snippet",
        mine: "true",
        maxResults: "50",
      });
      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const startTime = Date.now();
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/subscriptions?${params}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const responseTimeMs = Date.now() - startTime;

      // Log subscriptions.list API call (1 unit per page)
      await ctx.runMutation(internal.metrics.logApiCallInternal, {
        userId,
        endpoint: "subscriptions.list",
        quotaUnits: YOUTUBE_QUOTA_COSTS["subscriptions.list"],
        success: response.ok,
        errorMessage: response.ok ? undefined : await response.clone().text(),
        responseTimeMs,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("YouTube API error:", error);
        throw new Error("Failed to fetch subscriptions");
      }

      const data = await response.json();

      for (const item of data.items || []) {
        allChannels.push({
          youtubeChannelId: item.snippet.resourceId?.channelId,
          title: item.snippet.title,
          description: item.snippet.description || undefined,
          thumbnailUrl:
            item.snippet.thumbnails?.high?.url ||
            item.snippet.thumbnails?.medium?.url ||
            item.snippet.thumbnails?.default?.url,
        });
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    // Update cache
    await ctx.runMutation(api.youtube.updateChannelsCache, {
      channels: allChannels,
    });

    return allChannels;
  },
});

// =============================================================================
// TRANSCRIPT FUNCTIONS (YouTube Captions/Subtitles)
// =============================================================================

/**
 * Get cached transcript for a YouTube video by videoId + language
 */
export const getTranscript = query({
  args: {
    youtubeVideoId: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("youtubeTranscriptsCache")
      .withIndex("by_video_and_lang", (q) =>
        q
          .eq("youtubeVideoId", args.youtubeVideoId)
          .eq("language", args.language),
      )
      .first();

    if (!cached) return null;

    return {
      entries: cached.entries,
      cachedAt: cached.cachedAt,
    };
  },
});

/**
 * Internal mutation to upsert transcript cache entries
 */
export const upsertTranscriptCache = internalMutation({
  args: {
    youtubeVideoId: v.string(),
    language: v.string(),
    entries: v.array(
      v.object({
        start: v.number(),
        duration: v.number(),
        text: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("youtubeTranscriptsCache")
      .withIndex("by_video_and_lang", (q) =>
        q
          .eq("youtubeVideoId", args.youtubeVideoId)
          .eq("language", args.language),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        entries: args.entries,
        cachedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("youtubeTranscriptsCache", {
        youtubeVideoId: args.youtubeVideoId,
        language: args.language,
        entries: args.entries,
        cachedAt: Date.now(),
      });
    }
  },
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// =============================================================================
// SUBSCRIPTION FEED
// =============================================================================

const SUBSCRIPTION_PLAYLIST_ID = "__subscriptions__";

/**
 * Internal query to get subscribed channels from cache
 */
export const getSubscribedChannels = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("youtubeChannelsCache")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Create/update the virtual "Subscriptions" playlist entry
 */
export const updateSubscriptionPlaylist = mutation({
  args: {
    videoCount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user_and_youtube_id", (q) =>
        q
          .eq("userId", userId)
          .eq("youtubePlaylistId", SUBSCRIPTION_PLAYLIST_ID),
      )
      .first();

    const playlistData = {
      userId,
      youtubePlaylistId: SUBSCRIPTION_PLAYLIST_ID,
      title: "Subscriptions",
      description: "Recent videos from your YouTube subscriptions",
      videoCount: args.videoCount,
      privacyStatus: "private",
      cachedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, playlistData);
    } else {
      await ctx.db.insert("youtubePlaylistsCache", playlistData);
    }
  },
});

/**
 * Fetch recent videos from user's YouTube subscriptions.
 * Gets channels the user is subscribed to, derives their "Uploads" playlist IDs,
 * and fetches the latest videos from each.
 *
 * Quota cost: ~1 (subscriptions if not cached) + N (playlistItems per channel) + ceil(totalVideos/50) (video details)
 * For 20 channels with 5 videos each: ~23 units
 */
export const fetchSubscriptionFeed = action({
  args: {
    maxChannels: v.optional(v.number()),
    maxVideosPerChannel: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userId = identity.subject;
    const accessToken = await getValidAccessToken(ctx, userId);

    const maxChannels = args.maxChannels ?? 20;
    const maxVideosPerChannel = args.maxVideosPerChannel ?? 5;

    // 1. Get subscribed channels from cache
    let channels = await ctx.runQuery(internal.youtube.getSubscribedChannels, {
      userId,
    });

    // If no channels cached, fetch them first
    if (!channels || channels.length === 0) {
      await ctx.runAction(api.youtube.fetchYoutubeSubscriptions);
      channels = await ctx.runQuery(internal.youtube.getSubscribedChannels, {
        userId,
      });
    }

    if (!channels || channels.length === 0) {
      return { videoCount: 0 };
    }

    // 2. Take first N channels and derive uploads playlist IDs
    // YouTube channel IDs start with "UC", uploads playlist IDs start with "UU"
    const selectedChannels = channels.slice(0, maxChannels);
    const uploadsPlaylists = selectedChannels
      .filter(
        (c: { youtubeChannelId?: string }) =>
          c.youtubeChannelId && c.youtubeChannelId.startsWith("UC"),
      )
      .map(
        (c: {
          youtubeChannelId?: string;
          title: string;
          thumbnailUrl?: string;
        }) => ({
          channelId: c.youtubeChannelId!,
          channelTitle: c.title,
          channelThumbnailUrl: c.thumbnailUrl,
          uploadsPlaylistId: "UU" + c.youtubeChannelId!.slice(2),
        }),
      );

    // 3. Fetch recent videos from each uploads playlist (parallel batches of 5)
    const allVideos: Array<{
      youtubeVideoId: string;
      playlistItemId?: string;
      title: string;
      description?: string;
      thumbnailUrl?: string;
      channelTitle: string;
      youtubeChannelId?: string;
      duration?: string;
      position: number;
      publishedAt?: string;
    }> = [];

    const BATCH_SIZE = 5;
    for (let i = 0; i < uploadsPlaylists.length; i += BATCH_SIZE) {
      const batch = uploadsPlaylists.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(
          async (channel: {
            channelId?: string;
            channelTitle: string;
            channelThumbnailUrl?: string;
            uploadsPlaylistId: string;
          }) => {
            const startTime = Date.now();
            const response = await fetch(
              "https://www.googleapis.com/youtube/v3/playlistItems?" +
                new URLSearchParams({
                  part: "snippet,contentDetails",
                  playlistId: channel.uploadsPlaylistId,
                  maxResults: String(maxVideosPerChannel),
                }),
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              },
            );
            const responseTimeMs = Date.now() - startTime;

            await ctx.runMutation(internal.metrics.logApiCallInternal, {
              userId,
              endpoint: "playlistItems.list",
              quotaUnits: YOUTUBE_QUOTA_COSTS["playlistItems.list"],
              success: response.ok,
              errorMessage: response.ok
                ? undefined
                : await response.clone().text(),
              responseTimeMs,
            });

            if (!response.ok) return [];

            const data = await response.json();
            return (data.items || []).map((item: any, index: number) => ({
              youtubeVideoId: item.contentDetails?.videoId,
              title: item.snippet?.title || "",
              description: item.snippet?.description || "",
              thumbnailUrl:
                item.snippet?.thumbnails?.high?.url ||
                item.snippet?.thumbnails?.medium?.url ||
                item.snippet?.thumbnails?.default?.url,
              channelTitle:
                item.snippet?.videoOwnerChannelTitle || channel.channelTitle,
              youtubeChannelId:
                item.snippet?.videoOwnerChannelId || channel.channelId,
              position: index,
              publishedAt: item.snippet?.publishedAt,
            }));
          },
        ),
      );

      for (const result of results) {
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
          allVideos.push(...result.value);
        }
      }
    }

    // 4. Get video details for duration and actual publish dates (batch up to 50)
    const videoIds = allVideos.map((v) => v.youtubeVideoId).filter(Boolean);

    const durations: Record<string, string> = {};
    const videoPublishDates: Record<string, string> = {};

    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const startTime = Date.now();
      const response = await fetch(
        "https://www.googleapis.com/youtube/v3/videos?" +
          new URLSearchParams({
            part: "contentDetails,snippet",
            id: batch.join(","),
          }),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const responseTimeMs = Date.now() - startTime;

      await ctx.runMutation(internal.metrics.logApiCallInternal, {
        userId,
        endpoint: "videos.list",
        quotaUnits: YOUTUBE_QUOTA_COSTS["videos.list"],
        success: response.ok,
        errorMessage: response.ok ? undefined : await response.clone().text(),
        responseTimeMs,
      });

      if (response.ok) {
        const data = await response.json();
        for (const item of data.items || []) {
          durations[item.id] = parseDuration(item.contentDetails?.duration);
          videoPublishDates[item.id] = item.snippet?.publishedAt;
        }
      }
    }

    // 5. Enrich videos with duration and actual publish dates
    const enrichedVideos = allVideos
      .filter((v) => v.youtubeVideoId)
      .map((v, index) => ({
        ...v,
        duration: durations[v.youtubeVideoId] || "",
        publishedAt: videoPublishDates[v.youtubeVideoId] || v.publishedAt,
        position: index,
      }));

    // 6. Create virtual playlist and cache videos
    await ctx.runMutation(api.youtube.updateSubscriptionPlaylist, {
      videoCount: enrichedVideos.length,
    });

    await ctx.runMutation(api.youtube.updateVideosCache, {
      playlistId: SUBSCRIPTION_PLAYLIST_ID,
      videos: enrichedVideos,
    });

    return { videoCount: enrichedVideos.length };
  },
});

// =============================================================================
// INTERNAL HELPERS (for cron/feedChecker — no auth context required)
// =============================================================================

/**
 * Refresh a YouTube access token without requiring auth context.
 * Used by the feed checker cron.
 */
export const internalRefreshYoutubeToken = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const tokens = await ctx.runQuery(internal.youtube.getUserTokens, {
      userId: args.userId,
    });

    if (!tokens?.refreshToken) {
      throw new Error("No refresh token available");
    }

    const clientId =
      process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Internal token refresh failed:", error);
      throw new Error("Failed to refresh token");
    }

    const data = await response.json();

    await ctx.runMutation(internal.youtube.updateYoutubeTokens, {
      userId: args.userId,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });

    return data.access_token;
  },
});

/**
 * Get a valid access token for a user, refreshing if needed.
 * Internal version for cron usage (no auth context).
 */
export async function getValidAccessTokenInternal(
  ctx: any,
  userId: string,
): Promise<string> {
  const tokens = await ctx.runQuery(internal.youtube.getUserTokens, { userId });

  if (!tokens?.accessToken) {
    throw new Error("YouTube not connected");
  }

  if (tokens.tokenExpiry && tokens.tokenExpiry < Date.now() + 5 * 60 * 1000) {
    return await ctx.runAction(internal.youtube.internalRefreshYoutubeToken, {
      userId,
    });
  }

  return tokens.accessToken;
}

/**
 * Get cached video IDs for the subscription playlist.
 */
export const getSubscriptionVideoIds = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const videos = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user_and_playlist", (q) =>
        q
          .eq("userId", args.userId)
          .eq("youtubePlaylistId", SUBSCRIPTION_PLAYLIST_ID),
      )
      .collect();

    return videos.map((v) => v.youtubeVideoId);
  },
});

/**
 * Get all settings documents that have feed refresh enabled.
 */
export const getSettingsWithFeedRefresh = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allSettings = await ctx.db.query("settings").collect();
    return allSettings.filter((s) => {
      const notifs = s.notifications;
      return (
        notifs &&
        notifs.newVideos !== false &&
        notifs.feedRefreshIntervalMinutes &&
        notifs.feedRefreshIntervalMinutes > 0
      );
    });
  },
});

/**
 * Update lastFeedCheckAt timestamp in user settings.
 */
export const updateLastFeedCheckAt = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (settings && settings.notifications) {
      await ctx.db.patch(settings._id, {
        notifications: {
          ...settings.notifications,
          lastFeedCheckAt: Date.now(),
        },
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Internal mutation to update subscription playlist (no auth required).
 * Used by feedChecker cron.
 */
export const internalUpdateSubscriptionPlaylist = internalMutation({
  args: {
    userId: v.string(),
    videoCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user_and_youtube_id", (q) =>
        q
          .eq("userId", args.userId)
          .eq("youtubePlaylistId", SUBSCRIPTION_PLAYLIST_ID),
      )
      .first();

    const playlistData = {
      userId: args.userId,
      youtubePlaylistId: SUBSCRIPTION_PLAYLIST_ID,
      title: "Subscriptions",
      description: "Recent videos from your YouTube subscriptions",
      videoCount: args.videoCount,
      privacyStatus: "private",
      cachedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, playlistData);
    } else {
      await ctx.db.insert("youtubePlaylistsCache", playlistData);
    }
  },
});

/**
 * Internal mutation to update videos cache for a playlist (no auth required).
 * Used by feedChecker cron.
 */
export const internalUpdateVideosCache = internalMutation({
  args: {
    userId: v.string(),
    playlistId: v.string(),
    videos: v.array(
      v.object({
        youtubeVideoId: v.string(),
        playlistItemId: v.optional(v.string()),
        title: v.string(),
        description: v.optional(v.string()),
        thumbnailUrl: v.optional(v.string()),
        channelTitle: v.string(),
        youtubeChannelId: v.optional(v.string()),
        duration: v.optional(v.string()),
        position: v.number(),
        publishedAt: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existingVideos = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user_and_playlist", (q) =>
        q.eq("userId", args.userId).eq("youtubePlaylistId", args.playlistId),
      )
      .collect();

    const existingMap = new Map(
      existingVideos.map((v) => [v.youtubeVideoId, v]),
    );

    for (const video of args.videos) {
      const existing = existingMap.get(video.youtubeVideoId);

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...video,
          youtubePlaylistId: args.playlistId,
          cachedAt: now,
        });
        existingMap.delete(video.youtubeVideoId);
      } else {
        await ctx.db.insert("youtubeVideosCache", {
          userId: args.userId,
          youtubePlaylistId: args.playlistId,
          ...video,
          cachedAt: now,
        });
      }
    }

    for (const video of Array.from(existingMap.values())) {
      await ctx.db.delete(video._id);
    }
  },
});

/**
 * Parse ISO 8601 duration to human-readable format
 * e.g., "PT1H23M45S" -> "1:23:45"
 */
function parseDuration(duration: string | undefined): string {
  if (!duration) return "";

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";

  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
