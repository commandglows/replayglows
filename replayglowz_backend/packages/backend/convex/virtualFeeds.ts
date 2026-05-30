import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { getUserId } from "./utils";
import { Doc, Id } from "./_generated/dataModel";

const SUBSCRIPTIONS_SOURCE_ID = "__subscriptions__";
const DEFAULT_FEED_PAGE_SIZE = 100;

type VirtualFeedSourceType = "channel" | "playlist" | "subscriptions";
type VirtualFeedSortOrder = "default" | "newest" | "oldest";
type AddSourceOutcome = "added" | "alreadyAdded" | "rejected";

type CachedVideo = Doc<"youtubeVideosCache">;
type CachedPlaylist = Doc<"youtubePlaylistsCache">;
type CachedChannel = Doc<"youtubeChannelsCache">;
type VirtualFeedSource = Doc<"virtualFeedSources">;
type HiddenItem = Doc<"hiddenItems">;
type WatchedVideo = Doc<"watchedVideos">;
type FeedDoc = Doc<"virtualFeeds">;
type ConvexReadCtx = QueryCtx | MutationCtx;

interface SourceWithState extends VirtualFeedSource {
  videoCount: number;
  isAvailable: boolean;
  isStale: boolean;
  staleReason: string | null;
}

interface SourceValidationResult {
  title: string;
  valid: boolean;
  error?: string;
}

function normalizeSortOrder(
  sortOrder: string | undefined,
  feedSortOrder: string | undefined,
): VirtualFeedSortOrder {
  const normalized = (sortOrder ?? feedSortOrder ?? "default").toLowerCase();
  if (normalized === "newest") return "newest";
  if (normalized === "oldest") return "oldest";
  return "default";
}

function toDateNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInt(value: number | undefined | null, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return fallback;
}

function normalizePaging(
  pageSize: number | undefined,
  cursor: string | null | undefined,
): { pageSize: number; cursorIndex: number } {
  const safePageSize = Math.max(
    1,
    Math.min(toInt(pageSize, DEFAULT_FEED_PAGE_SIZE), 500),
  );

  const parsed = cursor == null ? 0 : parseInt(cursor, 10);
  const safeCursor =
    Number.isNaN(parsed) || parsed < 0 ? 0 : Math.trunc(parsed);

  return { pageSize: safePageSize, cursorIndex: safeCursor };
}

async function getUserOwnedFeed(
  ctx: ConvexReadCtx,
  userId: string,
  feedId: string,
): Promise<FeedDoc | null> {
  const feed = (await ctx.db.get(feedId as Id<"virtualFeeds">)) as
    | FeedDoc
    | null;
  if (!feed || feed.userId !== userId) return null;
  return feed;
}

async function getSourcesByFeed(
  ctx: ConvexReadCtx,
  feedId: string,
): Promise<VirtualFeedSource[]> {
  const sources = await ctx.db
    .query("virtualFeedSources")
    .withIndex("by_feed_position", (q: any) => q.eq("virtualFeedId", feedId))
    .collect();

  const normalized = [...sources].sort((a, b) => {
    if (a.position === b.position) {
      return a._creationTime - b._creationTime;
    }
    return a.position - b.position;
  });

  return normalized;
}

function sortVideosBySourceOrder(
  videos: CachedVideo[],
  sources: VirtualFeedSource[],
  channelIds: Set<string>,
  playlistIds: Set<string>,
  includeSubscriptions: boolean,
  includeWatched: boolean,
  hiddenIds: Set<string>,
  hiddenPlaylistIds: Set<string>,
  watchedIds: Set<string>,
  subscriptionSourceId: string,
): { video: CachedVideo; source: VirtualFeedSource }[] {
  const result: { video: CachedVideo; source: VirtualFeedSource }[] = [];
  const seen = new Set<string>();
  const activeSources = sources.filter((source) => source.isActive !== false);

  for (const video of videos) {
    if (seen.has(video.youtubeVideoId)) continue;

    if (hiddenIds.has(video.youtubeVideoId)) continue;
    if (hiddenPlaylistIds.has(video.youtubePlaylistId)) continue;
    if (!includeWatched && watchedIds.has(video.youtubeVideoId)) continue;

    let matchedSource: VirtualFeedSource | null = null;
    for (const source of activeSources) {
      if (source.sourceType === "playlist") {
        if (video.youtubePlaylistId === source.sourceId) {
          matchedSource = source;
          break;
        }
        continue;
      }

      if (source.sourceType === "channel") {
        if (video.youtubeChannelId && video.youtubeChannelId === source.sourceId) {
          matchedSource = source;
          break;
        }
        continue;
      }

      if (
        includeSubscriptions &&
        source.sourceType === "subscriptions" &&
        source.sourceId === subscriptionSourceId &&
        video.youtubeChannelId != null &&
        channelIds.has(video.youtubeChannelId)
      ) {
        matchedSource = source;
        break;
      }
    }

    if (!matchedSource) continue;
    seen.add(video.youtubeVideoId);
    result.push({ video, source: matchedSource });
  }

  return result;
}

function toVideoProjection(
  video: CachedVideo,
  source: VirtualFeedSource,
  playlist?: CachedPlaylist,
  channelThumbnail?: string | undefined,
): Record<string, unknown> {
  return {
    _id: video._id,
    id: video.youtubeVideoId,
    youtubeVideoId: video.youtubeVideoId,
    youtubePlaylistId: video.youtubePlaylistId,
    playlistId: video.youtubePlaylistId,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    channelTitle: video.channelTitle,
    channelThumbnailUrl: channelThumbnail,
    duration: video.duration,
    playlistItemId: video.playlistItemId,
    publishedAt: video.publishedAt,
    cachedAt: video.cachedAt,
    playlistTitle: playlist?.title,
    playlistColor: playlist?.color,
    feedSourceType: source.sourceType,
    feedSourceId: source.sourceId,
    feedSourceTitle: source.sourceTitle,
  };
}

async function getSourceAvailability(
  ctx: ConvexReadCtx,
  userId: string,
  source: VirtualFeedSource,
  channelIds: Set<string>,
  videoChannelIds: Set<string>,
  playlistIds: Set<string>,
): Promise<{ isAvailable: boolean; reason: string | null }> {
  if (source.sourceType === "channel") {
    const hasChannel = channelIds.has(source.sourceId) || videoChannelIds.has(source.sourceId);
    return {
      isAvailable: hasChannel,
      reason: hasChannel ? null : "Channel is no longer available in your cache.",
    };
  }

  if (source.sourceType === "playlist") {
    const playlist = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user_and_youtube_id", (q: any) =>
        q
          .eq("userId", userId)
          .eq("youtubePlaylistId", source.sourceId),
      )
      .first();
    return {
      isAvailable: !!playlist,
      reason: playlist
        ? null
        : "Playlist is no longer available in your cache. Sync YouTube first.",
    };
  }

  if (source.sourceType === "subscriptions") {
    return {
      isAvailable: channelIds.size > 0,
      reason: channelIds.size > 0
        ? null
        : "No channel subscriptions available. Refresh subscriptions in ReplayGlowz.",
    };
  }

  return { isAvailable: false, reason: "Unknown source type." };
}

function withUpdatedTimestamps(data: { feed: FeedDoc; updatedAt: number }): FeedDoc {
  return {
    ...data.feed,
    updatedAt: data.updatedAt,
  };
}

async function validateFeedSource(
  ctx: MutationCtx,
  userId: string,
  sourceType: VirtualFeedSourceType,
  sourceId: string,
  fallbackTitle: string,
): Promise<SourceValidationResult> {
  if (sourceType === "subscriptions") {
    if (sourceId !== SUBSCRIPTIONS_SOURCE_ID) {
      return { title: fallbackTitle, valid: false, error: "Invalid subscriptions source identifier." };
    }
    const channels = await ctx.db
      .query("youtubeChannelsCache")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (channels.length === 0) {
      return {
        title: fallbackTitle,
        valid: false,
        error: "Cannot add subscriptions source: no subscribed channels available.",
      };
    }
    return { title: fallbackTitle, valid: true };
  }

  if (sourceType === "playlist") {
    const playlist = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user_and_youtube_id", (q) =>
        q.eq("userId", userId).eq("youtubePlaylistId", sourceId),
      )
      .first();
    if (!playlist) {
      return { title: fallbackTitle, valid: false, error: "Playlist not found in your cache." };
    }
    return { title: playlist.title, valid: true };
  }

  const channel = await ctx.db
    .query("youtubeChannelsCache")
    .withIndex("by_user_and_channel", (q) =>
      q.eq("userId", userId).eq("youtubeChannelId", sourceId),
    )
    .first();
  if (channel) {
    return { title: channel.title, valid: true };
  }

  const videos = await ctx.db
    .query("youtubeVideosCache")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const video = videos.find((entry) => entry.youtubeChannelId === sourceId);
  if (!video) {
    return { title: fallbackTitle, valid: false, error: "Channel not found in your cache." };
  }
  return { title: video.channelTitle || fallbackTitle, valid: true };
}

async function findExistingSource(
  ctx: MutationCtx,
  virtualFeedId: Id<"virtualFeeds">,
  sourceType: VirtualFeedSourceType,
  sourceId: string,
): Promise<VirtualFeedSource | null> {
  return await ctx.db
    .query("virtualFeedSources")
    .withIndex("by_feed", (q) => q.eq("virtualFeedId", virtualFeedId))
    .filter((q) =>
      q.and(
        q.eq(q.field("sourceType"), sourceType),
        q.eq(q.field("sourceId"), sourceId),
      ),
    )
    .first();
}

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export const listFeeds = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    const includeInactive = args.includeInactive === true;
    const feeds = await ctx.db
      .query("virtualFeeds")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const filtered = feeds
      .filter((feed) => (includeInactive ? true : feed.isActive !== false))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const feedIds = filtered.map((feed) => feed._id);
    const sourceBuckets = await Promise.all(
      feedIds.map((feedId) =>
        ctx.db
          .query("virtualFeedSources")
          .withIndex("by_feed", (q) => q.eq("virtualFeedId", feedId))
          .collect(),
      ),
    );

    return filtered.map((feed, index) => {
      const sources = sourceBuckets[index] ?? [];
      const activeSources = sources.filter((source) => source.isActive !== false);
      return {
        ...feed,
        sourceCount: sources.length,
        activeSourceCount: activeSources.length,
      };
    });
  },
});

export const getFeedDetails = query({
  args: {
    virtualFeedId: v.id("virtualFeeds"),
    includeHidden: v.optional(v.boolean()),
    includeWatched: v.optional(v.boolean()),
    sortOrder: v.optional(
      v.union(v.literal("newest"), v.literal("oldest"), v.literal("default")),
    ),
    cursor: v.optional(v.union(v.string(), v.null())),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      return {
        feed: null,
        videos: [],
        sources: [],
        stats: {
          sourceCount: 0,
          activeSourceCount: 0,
          staleSourceCount: 0,
          matchedVideoCount: 0,
        },
        isDone: true,
        continueCursor: null,
        sortOrder: "default",
      };
    }

    const feed = await getUserOwnedFeed(ctx, userId, args.virtualFeedId);
    if (!feed) {
      return {
        feed: null,
        videos: [],
        sources: [],
        stats: {
          sourceCount: 0,
          activeSourceCount: 0,
          staleSourceCount: 0,
          matchedVideoCount: 0,
        },
        isDone: true,
        continueCursor: null,
        sortOrder: "default",
      };
    }

    const [
      sources,
      allVideos,
      cachedChannels,
      cachedPlaylists,
      hiddenVideos,
      hiddenPlaylists,
      watchedVideos,
    ] = await Promise.all([
      getSourcesByFeed(ctx, args.virtualFeedId),
      ctx.db
        .query("youtubeVideosCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("youtubeChannelsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("youtubePlaylistsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      !args.includeHidden
        ? ctx.db
            .query("hiddenItems")
            .withIndex("by_user_type_and_id", (q) =>
              q.eq("userId", userId).eq("itemType", "video"),
            )
            .collect()
        : Promise.resolve([] as HiddenItem[]),
      !args.includeHidden
        ? ctx.db
            .query("hiddenItems")
            .withIndex("by_user_type_and_id", (q) =>
              q.eq("userId", userId).eq("itemType", "playlist"),
            )
            .collect()
        : Promise.resolve([] as HiddenItem[]),
      !args.includeWatched
        ? ctx.db
            .query("watchedVideos")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect()
        : Promise.resolve([] as WatchedVideo[]),
    ]);

    const includeWatched = args.includeWatched ?? !!feed.includeWatched;
    const effectiveSortOrder = normalizeSortOrder(args.sortOrder, feed.sortOrder);
    const hiddenIds = new Set<string>(hiddenVideos.map((item) => item.youtubeId));
    const hiddenPlaylistIds = new Set<string>(
      hiddenPlaylists.map((item) => item.youtubeId),
    );
    const watchedIds = new Set<string>(watchedVideos.map((item) => item.youtubeVideoId));
    const channelIds = new Set<string>(cachedChannels.map((channel) => channel.youtubeChannelId));
    const videoChannelIds = new Set<string>(
      allVideos
        .map((video) => video.youtubeChannelId)
        .filter((channelId): channelId is string => typeof channelId === "string" && channelId.length > 0),
    );
    const playlistIds = new Set<string>(
      cachedPlaylists.map((playlist) => playlist.youtubePlaylistId),
    );

    const activeSources = sources.filter((source) => source.isActive !== false);
    const includeSubscriptions = activeSources.some(
      (source) =>
        source.sourceType === "subscriptions" &&
        source.sourceId === SUBSCRIPTIONS_SOURCE_ID,
    );

    const sourceCounts = new Map<string, number>();
    const enriched = sortVideosBySourceOrder(
      allVideos,
      sources,
      channelIds,
      playlistIds,
      includeSubscriptions,
      includeWatched,
      hiddenIds,
      hiddenPlaylistIds,
      watchedIds,
      SUBSCRIPTIONS_SOURCE_ID,
    )
      .filter((entry) => {
        const { source } = entry;
        const current = sourceCounts.get(source._id) ?? 0;
        sourceCounts.set(source._id, current + 1);
        return true;
      })
      .map(({ video, source }) => {
        const playlist = cachedPlaylists.find(
          (item) => item.youtubePlaylistId === video.youtubePlaylistId,
        );
        return toVideoProjection(
          video,
          source,
          playlist,
          video.youtubeChannelId
            ? cachedChannels.find(
                (entry) => entry.youtubeChannelId === video.youtubeChannelId,
              )?.thumbnailUrl
            : undefined,
        );
      });

    enriched.sort((a, b) => {
      const dateA = toDateNumber(a.publishedAt as string | undefined);
      const dateB = toDateNumber(b.publishedAt as string | undefined);
      return effectiveSortOrder === "oldest" ? dateA - dateB : dateB - dateA;
    });

    const { pageSize, cursorIndex } = normalizePaging(args.pageSize, args.cursor);
    const endIndex = cursorIndex + pageSize;
    const page = enriched.slice(cursorIndex, endIndex);
    const isDone = endIndex >= enriched.length;
    const continueCursor = isDone ? null : String(endIndex);

    const sourceStates = await Promise.all(
      sources.map(async (source) => {
        const availability = await getSourceAvailability(
          ctx,
          userId,
          source,
          channelIds,
          videoChannelIds,
          playlistIds,
        );

        const isStale = !availability.isAvailable;
        return {
          ...source,
          isAvailable: availability.isAvailable,
          isStale,
          staleReason: isStale ? availability.reason : null,
          videoCount: sourceCounts.get(source._id) ?? 0,
        };
      }),
    );

    return {
      feed: {
        ...feed,
      },
      videos: page,
      sources: sourceStates,
      stats: {
        sourceCount: sources.length,
        activeSourceCount: activeSources.length,
        staleSourceCount: sourceStates.filter((source) => source.isStale).length,
        matchedVideoCount: enriched.length,
      },
      isDone,
      continueCursor,
      sortOrder: effectiveSortOrder,
    };
  },
});

export const getFeed = query({
  args: { virtualFeedId: v.id("virtualFeeds") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    return getUserOwnedFeed(ctx, userId, args.virtualFeedId);
  },
});

export const listPlaylistChannelCandidates = query({
  args: {
    virtualFeedId: v.id("virtualFeeds"),
    youtubePlaylistId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const feed = await getUserOwnedFeed(ctx, userId, args.virtualFeedId);
    if (!feed) throw new Error("Unauthorized");

    const youtubePlaylistId = args.youtubePlaylistId.trim();
    const playlist = await ctx.db
      .query("youtubePlaylistsCache")
      .withIndex("by_user_and_youtube_id", (q) =>
        q.eq("userId", userId).eq("youtubePlaylistId", youtubePlaylistId),
      )
      .first();
    if (!playlist) {
      throw new Error("Playlist not found in your cache.");
    }

    const [videos, channels, sources] = await Promise.all([
      ctx.db
        .query("youtubeVideosCache")
        .withIndex("by_user_and_playlist", (q) =>
          q.eq("userId", userId).eq("youtubePlaylistId", youtubePlaylistId),
        )
        .collect(),
      ctx.db
        .query("youtubeChannelsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      getSourcesByFeed(ctx, args.virtualFeedId),
    ]);

    const channelCache = new Map(channels.map((channel) => [channel.youtubeChannelId, channel]));
    const alreadyAddedChannelIds = new Set(
      sources
        .filter((source) => source.sourceType === "channel")
        .map((source) => source.sourceId),
    );
    const groups = new Map<string, { title: string; count: number }>();
    let missingMetadataCount = 0;

    for (const video of videos) {
      const channelId = video.youtubeChannelId;
      if (!channelId) {
        missingMetadataCount += 1;
        continue;
      }
      const current = groups.get(channelId);
      if (current) {
        current.count += 1;
        if (!current.title && video.channelTitle) current.title = video.channelTitle;
      } else {
        groups.set(channelId, {
          title: video.channelTitle || channelCache.get(channelId)?.title || "Untitled channel",
          count: 1,
        });
      }
    }

    const candidates = [...groups.entries()]
      .map(([youtubeChannelId, group]) => {
        const cachedChannel = channelCache.get(youtubeChannelId);
        return {
          youtubeChannelId,
          title: cachedChannel?.title || group.title,
          thumbnailUrl: cachedChannel?.thumbnailUrl,
          videoCount: group.count,
          alreadyAdded: alreadyAddedChannelIds.has(youtubeChannelId),
          isSubscribed: !!cachedChannel,
        };
      })
      .sort((a, b) => {
        if (a.alreadyAdded !== b.alreadyAdded) return a.alreadyAdded ? 1 : -1;
        if (a.videoCount !== b.videoCount) return b.videoCount - a.videoCount;
        return a.title.localeCompare(b.title);
      });

    return {
      playlist: {
        youtubePlaylistId: playlist.youtubePlaylistId,
        title: playlist.title,
        videoCount: playlist.videoCount,
      },
      candidates,
      missingMetadataCount,
      totalVideoCount: videos.length,
    };
  },
});

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

export const createFeed = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    includeWatched: v.optional(v.boolean()),
    sortOrder: v.optional(v.union(v.literal("newest"), v.literal("oldest"), v.literal("default"))),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const title = args.title.trim();
    if (!title) {
      throw new Error("Feed title is required.");
    }

    const now = Date.now();
    return await ctx.db.insert("virtualFeeds", {
      userId,
      title,
      description: args.description?.trim(),
      includeWatched: args.includeWatched ?? false,
      sortOrder: args.sortOrder ?? "default",
      color: args.color?.trim(),
      icon: args.icon?.trim(),
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateFeed = mutation({
  args: {
    virtualFeedId: v.id("virtualFeeds"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    includeWatched: v.optional(v.boolean()),
    sortOrder: v.optional(v.union(v.literal("newest"), v.literal("oldest"), v.literal("default"))),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const feed = await getUserOwnedFeed(ctx, userId, args.virtualFeedId);
    if (!feed) throw new Error("Unauthorized");

    const patch: Partial<FeedDoc> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Feed title is required.");
      patch.title = title;
    }

    if (args.description !== undefined) {
      patch.description = args.description.trim();
    }

    if (args.includeWatched !== undefined) {
      patch.includeWatched = args.includeWatched;
    }

    if (args.sortOrder !== undefined) {
      patch.sortOrder = args.sortOrder;
    }

    if (args.color !== undefined) {
      patch.color = args.color.trim() || undefined;
    }

    if (args.icon !== undefined) {
      patch.icon = args.icon.trim() || undefined;
    }

    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }

    await ctx.db.patch(args.virtualFeedId, patch as Record<string, unknown>);
    return args.virtualFeedId;
  },
});

export const deleteFeed = mutation({
  args: { virtualFeedId: v.id("virtualFeeds") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const feed = await getUserOwnedFeed(ctx, userId, args.virtualFeedId);
    if (!feed) throw new Error("Unauthorized");

    const sources = await getSourcesByFeed(ctx, args.virtualFeedId);
    await Promise.all(
      sources.map((source) => ctx.db.delete(source._id)),
    );
    await ctx.db.delete(args.virtualFeedId);
  },
});

export const addFeedSource = mutation({
  args: {
    virtualFeedId: v.id("virtualFeeds"),
    sourceType: v.union(
      v.literal("channel"),
      v.literal("playlist"),
      v.literal("subscriptions"),
    ),
    sourceId: v.string(),
    sourceTitle: v.string(),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const feed = await getUserOwnedFeed(ctx, userId, args.virtualFeedId);
    if (!feed) throw new Error("Unauthorized");

    const sourceTitle = args.sourceTitle.trim();
    const sourceId = args.sourceId.trim();
    if (!sourceTitle) throw new Error("Source title is required.");
    if (!sourceId) throw new Error("Source id is required.");

    const validation = await validateFeedSource(
      ctx,
      userId,
      args.sourceType,
      sourceId,
      sourceTitle,
    );
    if (!validation.valid) {
      throw new Error(validation.error ?? "Source is not available in your cache.");
    }

    const existing = await findExistingSource(
      ctx,
      args.virtualFeedId,
      args.sourceType,
      sourceId,
    );

    if (existing) {
      return args.virtualFeedId;
    }

    const sources = await getSourcesByFeed(ctx, args.virtualFeedId);
    const maxPosition = sources.reduce(
      (max, source) => Math.max(max, source.position),
      -1,
    );

    const now = Date.now();
    await ctx.db.insert("virtualFeedSources", {
      userId,
      virtualFeedId: args.virtualFeedId,
      sourceType: args.sourceType,
      sourceId,
      sourceTitle: validation.title,
      isActive: args.isActive ?? true,
      position: maxPosition + 1,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(feed._id, {
      updatedAt: now,
    });

    return args.virtualFeedId;
  },
});

export const addFeedSources = mutation({
  args: {
    virtualFeedId: v.id("virtualFeeds"),
    sources: v.array(
      v.object({
        sourceType: v.literal("channel"),
        sourceId: v.string(),
        sourceTitle: v.string(),
        isActive: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const feed = await getUserOwnedFeed(ctx, userId, args.virtualFeedId);
    if (!feed) throw new Error("Unauthorized");

    const existingSources = await getSourcesByFeed(ctx, args.virtualFeedId);
    let nextPosition = existingSources.reduce(
      (max, source) => Math.max(max, source.position),
      -1,
    ) + 1;
    const seenInRequest = new Set<string>();
    const now = Date.now();
    let addedCount = 0;
    const [cachedChannels, cachedVideos] = await Promise.all([
      ctx.db
        .query("youtubeChannelsCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("youtubeVideosCache")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    const channelTitleById = new Map<string, string>();
    for (const channel of cachedChannels) {
      channelTitleById.set(channel.youtubeChannelId, channel.title);
    }
    for (const video of cachedVideos) {
      if (video.youtubeChannelId && !channelTitleById.has(video.youtubeChannelId)) {
        channelTitleById.set(video.youtubeChannelId, video.channelTitle);
      }
    }

    const results: Array<{
      sourceId: string;
      sourceTitle: string;
      status: AddSourceOutcome;
      reason?: string;
    }> = [];

    for (const candidate of args.sources) {
      const sourceId = candidate.sourceId.trim();
      const sourceTitle = candidate.sourceTitle.trim();

      if (!sourceId || !sourceTitle) {
        results.push({
          sourceId,
          sourceTitle,
          status: "rejected",
          reason: "Source id and title are required.",
        });
        continue;
      }

      if (seenInRequest.has(sourceId)) {
        results.push({
          sourceId,
          sourceTitle,
          status: "alreadyAdded",
          reason: "Duplicate in this request.",
        });
        continue;
      }
      seenInRequest.add(sourceId);

      const validatedTitle = channelTitleById.get(sourceId);
      if (!validatedTitle) {
        results.push({
          sourceId,
          sourceTitle,
          status: "rejected",
          reason: "Channel not found in your cache.",
        });
        continue;
      }

      const existing = await findExistingSource(
        ctx,
        args.virtualFeedId,
        "channel",
        sourceId,
      );
      if (existing) {
        results.push({
          sourceId,
          sourceTitle: existing.sourceTitle,
          status: "alreadyAdded",
        });
        continue;
      }

      await ctx.db.insert("virtualFeedSources", {
        userId,
        virtualFeedId: args.virtualFeedId,
        sourceType: "channel",
        sourceId,
        sourceTitle: validatedTitle,
        isActive: candidate.isActive ?? true,
        position: nextPosition,
        createdAt: now,
        updatedAt: now,
      });
      nextPosition += 1;
      addedCount += 1;
      results.push({
        sourceId,
        sourceTitle: validatedTitle,
        status: "added",
      });
    }

    if (addedCount > 0) {
      await ctx.db.patch(feed._id, { updatedAt: now });
    }

    return {
      virtualFeedId: args.virtualFeedId,
      addedCount,
      alreadyAddedCount: results.filter((result) => result.status === "alreadyAdded").length,
      rejectedCount: results.filter((result) => result.status === "rejected").length,
      results,
    };
  },
});

export const removeFeedSource = mutation({
  args: { virtualFeedSourceId: v.id("virtualFeedSources") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const source = await ctx.db.get(args.virtualFeedSourceId);
    if (!source || source.userId !== userId) {
      throw new Error("Source not found");
    }

    await ctx.db.delete(args.virtualFeedSourceId);

    const remaining = await getSourcesByFeed(ctx, source.virtualFeedId);
    const patchPromises = remaining
      .filter((entry, index) => entry.position !== index)
      .map((entry, index) =>
        ctx.db.patch(entry._id, {
          position: index,
          updatedAt: Date.now(),
        }),
      );

    await Promise.all(patchPromises);

    await ctx.db.patch(source.virtualFeedId, {
      updatedAt: Date.now(),
    });
  },
});

export const reorderFeedSources = mutation({
  args: {
    virtualFeedId: v.id("virtualFeeds"),
    sourceIds: v.array(v.id("virtualFeedSources")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const feed = await getUserOwnedFeed(ctx, userId, args.virtualFeedId);
    if (!feed) throw new Error("Unauthorized");

    const allSources = await getSourcesByFeed(ctx, args.virtualFeedId);
    if (allSources.length !== args.sourceIds.length) {
      throw new Error("Source list is out of date. Reload and retry.");
    }

    const sourceSet = new Set(allSources.map((source) => source._id.toString()));
    for (const sourceId of args.sourceIds) {
      if (!sourceSet.has(sourceId)) {
        throw new Error("Cannot reorder: stale source list.");
      }
    }

    const now = Date.now();
    await Promise.all(
      args.sourceIds.map((sourceId, index) =>
        ctx.db.patch(sourceId, {
          position: index,
          updatedAt: now,
        }),
      ),
    );
    await ctx.db.patch(args.virtualFeedId, { updatedAt: now });
  },
});

export const toggleFeedSource = mutation({
  args: {
    virtualFeedSourceId: v.id("virtualFeedSources"),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const source = await ctx.db.get(args.virtualFeedSourceId);
    if (!source || source.userId !== userId) {
      throw new Error("Source not found");
    }

    const nextValue =
      args.isActive === undefined ? !source.isActive : args.isActive;

    await ctx.db.patch(args.virtualFeedSourceId, {
      isActive: nextValue,
      updatedAt: Date.now(),
    });

    const feed = await getUserOwnedFeed(ctx, userId, source.virtualFeedId);
    if (feed) {
      await ctx.db.patch(source.virtualFeedId, { updatedAt: Date.now() });
    }

    return nextValue;
  },
});
