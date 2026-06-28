import { v } from "convex/values";
import { internalAction } from "./_generated/server";

import { internal } from "./_generated/api";
import { YOUTUBE_QUOTA_COSTS } from "./metrics";
import { getValidAccessTokenInternal } from "./youtube";

const SUBSCRIPTION_PLAYLIST_ID = "__subscriptions__";

/**
 * Cron entry point: check all eligible users' subscription feeds.
 * Runs every 15 minutes. Only processes users whose configured interval has elapsed.
 */
export const checkAllUserFeeds = internalAction({
  args: {},
  handler: async (ctx) => {
    const allSettings = await ctx.runQuery(
      internal.youtube.getSettingsWithFeedRefresh
    );

    const now = Date.now();
    const eligible = allSettings.filter((s: {
      notifications?: {
        feedRefreshIntervalMinutes?: number;
        lastFeedCheckAt?: number;
      };
    }) => {
      const interval = s.notifications!.feedRefreshIntervalMinutes! * 60 * 1000;
      const lastCheck = s.notifications!.lastFeedCheckAt ?? 0;
      return now - lastCheck >= interval;
    });

    if (eligible.length === 0) return;

    console.log(
      `Feed checker: ${eligible.length} user(s) eligible for refresh`
    );

    // Process users sequentially to avoid quota spikes
    for (const settings of eligible) {
      try {
        await ctx.runAction(internal.feedChecker.checkUserFeed, {
          userId: settings.userId,
        });
      } catch (error) {
        console.error(
          `Feed check failed for user ${settings.userId}:`,
          error
        );
      }
    }
  },
});

/**
 * Check a single user's subscription feed for new videos.
 * 1. Snapshot current cached video IDs
 * 2. Fetch fresh subscription videos from YouTube API
 * 3. Update cache
 * 4. Diff to find new videos → create notifications
 * 5. Update lastFeedCheckAt
 */
export const checkUserFeed = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = args;

    // 1. Snapshot current cached video IDs
    const previousVideoIds = new Set(
      await ctx.runQuery(internal.youtube.getSubscriptionVideoIds, { userId })
    );

    // 2. Get valid access token (refreshes if needed)
    let accessToken: string;
    try {
      accessToken = await getValidAccessTokenInternal(ctx, userId);
    } catch {
      console.log(`Feed check: user ${userId} has no YouTube connection, skipping`);
      await ctx.runMutation(internal.youtube.updateLastFeedCheckAt, { userId });
      return;
    }

    // 3. Get subscribed channels from cache
    const channels = await ctx.runQuery(
      internal.youtube.getSubscribedChannels,
      { userId }
    );

    if (!channels || channels.length === 0) {
      await ctx.runMutation(internal.youtube.updateLastFeedCheckAt, { userId });
      return;
    }

    // 4. Derive uploads playlist IDs and fetch recent videos
    const maxChannels = 20;
    const maxVideosPerChannel = 5;

    const selectedChannels = channels.slice(0, maxChannels);
    const uploadsPlaylists = selectedChannels
      .filter(
        (c: { youtubeChannelId?: string }) =>
          c.youtubeChannelId && c.youtubeChannelId.startsWith("UC")
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
        })
      );

    const allVideos: Array<{
      youtubeVideoId: string;
      title: string;
      description?: string;
      thumbnailUrl?: string;
      channelTitle: string;
      youtubeChannelId?: string;
      position: number;
      publishedAt?: string;
    }> = [];

    // Fetch in batches of 5 channels
    const BATCH_SIZE = 5;
    for (let i = 0; i < uploadsPlaylists.length; i += BATCH_SIZE) {
      const batch = uploadsPlaylists.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(
          async (channel: {
            channelId?: string;
            channelTitle: string;
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
              }
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
          }
        )
      );

      for (const result of results) {
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
          allVideos.push(...result.value);
        }
      }
    }

    // 5. Get video details for duration
    const videoIds = allVideos
      .map((v) => v.youtubeVideoId)
      .filter(Boolean);

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
        }
      );
      const responseTimeMs = Date.now() - startTime;

      await ctx.runMutation(internal.metrics.logApiCallInternal, {
        userId,
        endpoint: "videos.list",
        quotaUnits: YOUTUBE_QUOTA_COSTS["videos.list"],
        success: response.ok,
        errorMessage: response.ok
          ? undefined
          : await response.clone().text(),
        responseTimeMs,
      });

      if (response.ok) {
        const data = await response.json();
        for (const item of data.items || []) {
          durations[item.id] = parseDurationSimple(
            item.contentDetails?.duration
          );
          videoPublishDates[item.id] = item.snippet?.publishedAt;
        }
      }
    }

    // 6. Enrich and update cache
    const enrichedVideos = allVideos
      .filter((v) => v.youtubeVideoId)
      .map((v, index) => ({
        ...v,
        duration: durations[v.youtubeVideoId] || "",
        publishedAt: videoPublishDates[v.youtubeVideoId] || v.publishedAt,
        position: index,
      }));

    await ctx.runMutation(internal.youtube.internalUpdateSubscriptionPlaylist, {
      userId,
      videoCount: enrichedVideos.length,
    });

    await ctx.runMutation(internal.youtube.internalUpdateVideosCache, {
      userId,
      playlistId: SUBSCRIPTION_PLAYLIST_ID,
      videos: enrichedVideos,
    });

    // 7. Diff: find videos that are new since last check
    const newVideos = enrichedVideos.filter(
      (v) => !previousVideoIds.has(v.youtubeVideoId)
    );

    // 8. Create notifications for new videos (skip on first run when cache was empty)
    if (newVideos.length > 0 && previousVideoIds.size > 0) {
      console.log(
        `Feed checker: ${newVideos.length} new video(s) for user ${userId}`
      );

      for (const video of newVideos) {
        await ctx.runMutation(internal.notifications.createNotification, {
          userId,
          type: "new_video",
          title: video.title,
          body: video.channelTitle,
          youtubeVideoId: video.youtubeVideoId,
          youtubeChannelId: video.youtubeChannelId,
          thumbnailUrl: video.thumbnailUrl,
        });
      }
    }

    // 9. Update lastFeedCheckAt
    await ctx.runMutation(internal.youtube.updateLastFeedCheckAt, { userId });
  },
});

/**
 * Simple ISO 8601 duration parser (e.g., "PT1H23M45S" -> "1:23:45")
 */
function parseDurationSimple(duration: string | undefined): string {
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
