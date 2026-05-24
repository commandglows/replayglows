import { query } from "./_generated/server";
import { getUserId } from "./utils";

/**
 * Diagnostic query to check for videos without channel IDs
 */
export const checkVideosWithoutChannelId = query({
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return { total: 0, withoutChannelId: 0, videos: [] };

    const allVideos = await ctx.db
      .query("youtubeVideosCache")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const videosWithoutChannelId = allVideos.filter(v => !v.youtubeChannelId);

    return {
      total: allVideos.length,
      withoutChannelId: videosWithoutChannelId.length,
      videos: videosWithoutChannelId.map(v => ({
        id: v.youtubeVideoId,
        title: v.title,
        channelTitle: v.channelTitle,
        playlistId: v.youtubePlaylistId,
      })),
    };
  },
});

/**
 * Diagnostic query to check channel links
 */
export const checkChannelLinks = query({
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    const links = await ctx.db
      .query("channelPlaylistLinks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return links.map(link => ({
      channelTitle: link.channelTitle,
      channelId: link.youtubeChannelId,
      playlistId: link.youtubePlaylistId,
      isActive: link.isActive,
    }));
  },
});
