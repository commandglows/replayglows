import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./utils";
import { DEFAULT_TRANSCRIPT_PROVIDER } from "./transcriptProviders";

// Settings validators
const notificationsValidator = v.object({
  email: v.boolean(),
  push: v.boolean(),
  newComments: v.boolean(),
  newLikes: v.boolean(),
  newVideos: v.optional(v.boolean()),
  feedRefreshIntervalMinutes: v.optional(v.number()),
  lastFeedCheckAt: v.optional(v.number()),
});

const playbackValidator = v.object({
  autoplay: v.boolean(),
  defaultQuality: v.optional(v.string()),
  defaultSpeed: v.optional(v.number()),
  mobileControlsPosition: v.optional(
    v.union(v.literal("bottom"), v.literal("player")),
  ),
  captionsEnabled: v.optional(v.boolean()),
  captionsLanguage: v.optional(v.string()),
  autoMarkWatchedThreshold: v.optional(v.number()),
});

const notesValidator = v.object({
  defaultTimestamped: v.boolean(),
  sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
});

const channelSyncValidator = v.object({
  autoSyncOnVisit: v.boolean(),
  syncIntervalMinutes: v.optional(v.number()),
  lastAutoSyncAt: v.optional(v.number()),
});

const transcriptsValidator = v.object({
  defaultProvider: v.optional(
    v.union(
      v.literal("youtube_captions"),
      v.literal("faster_whisper"),
      v.literal("sensevoice"),
      v.literal("openai_mini"),
      v.literal("openai"),
      v.literal("deepgram"),
    ),
  ),
  defaultLanguage: v.optional(v.string()),
  autoAttemptYoutubeCaptions: v.optional(v.boolean()),
  autoAttemptLocalFallback: v.optional(v.boolean()),
  sortBy: v.optional(
    v.union(
      v.literal("recommended"),
      v.literal("price"),
      v.literal("speed"),
      v.literal("quality"),
      v.literal("name"),
    ),
  ),
});

const uxSettingsValidator = v.object({
  dismissedHints: v.optional(v.array(v.string())),
  feed: v.optional(
    v.object({
      selectedTab: v.optional(
        v.union(
          v.literal("all"),
          v.literal("subscriptions"),
          v.literal("playlists"),
          v.literal("history"),
        ),
      ),
      viewMode: v.optional(v.union(v.literal("list"), v.literal("grid"))),
      showWatched: v.optional(v.boolean()),
    }),
  ),
  playlists: v.optional(
    v.object({
      viewMode: v.optional(v.union(v.literal("list"), v.literal("grid"))),
      layout: v.optional(
        v.union(v.literal("comfortable"), v.literal("compact")),
      ),
      lastFilterPlaylistId: v.optional(v.string()),
    }),
  ),
  notes: v.optional(
    v.object({
      sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
      viewMode: v.optional(v.union(v.literal("list"), v.literal("compact"))),
    }),
  ),
  player: v.optional(
    v.object({
      layout: v.optional(
        v.union(v.literal("default"), v.literal("focus"), v.literal("theater")),
      ),
      focusMode: v.optional(v.boolean()),
      shortcutsHintDismissed: v.optional(v.boolean()),
    }),
  ),
});

export const defaultTranscriptSettings = {
  defaultProvider: DEFAULT_TRANSCRIPT_PROVIDER,
  defaultLanguage: "en",
  autoAttemptYoutubeCaptions: true,
  autoAttemptLocalFallback: true,
  sortBy: "recommended" as const,
};

// Get current user's settings
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    // Return default settings if none exist
    if (!settings) {
      return {
        theme: "system" as const,
        language: "en",
        notifications: {
          email: true,
          push: true,
          newComments: true,
          newLikes: false,
          newVideos: true,
          feedRefreshIntervalMinutes: 60,
        },
        playback: {
          autoplay: true,
          defaultQuality: "auto",
          defaultSpeed: 1,
          mobileControlsPosition: "bottom" as const,
          captionsEnabled: false,
          captionsLanguage: undefined as string | undefined,
          autoMarkWatchedThreshold: 0.9,
        },
        notes: {
          defaultTimestamped: true,
          sortOrder: "asc" as const,
        },
        channelSync: {
          autoSyncOnVisit: false,
          syncIntervalMinutes: 0,
        },
        transcripts: defaultTranscriptSettings,
        ux: {
          dismissedHints: [],
        },
      };
    }

    return settings;
  },
});

// Update theme setting
export const updateTheme = mutation({
  args: {
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        theme: args.theme,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        userId,
        theme: args.theme,
        updatedAt: Date.now(),
      });
    }
  },
});

// Update language setting
export const updateLanguage = mutation({
  args: {
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        language: args.language,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        userId,
        language: args.language,
        updatedAt: Date.now(),
      });
    }
  },
});

// Update notification settings
export const updateNotifications = mutation({
  args: {
    notifications: notificationsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        notifications: args.notifications,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        userId,
        notifications: args.notifications,
        updatedAt: Date.now(),
      });
    }
  },
});

// Update playback settings
export const updatePlayback = mutation({
  args: {
    playback: playbackValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        playback: args.playback,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        userId,
        playback: args.playback,
        updatedAt: Date.now(),
      });
    }
  },
});

// Update notes settings
export const updateNotesSettings = mutation({
  args: {
    notes: notesValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        notes: args.notes,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        userId,
        notes: args.notes,
        updatedAt: Date.now(),
      });
    }
  },
});

// Update channel sync settings
export const updateChannelSyncSettings = mutation({
  args: {
    channelSync: channelSyncValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        channelSync: args.channelSync,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        userId,
        channelSync: args.channelSync,
        updatedAt: Date.now(),
      });
    }
  },
});

export const updateTranscriptSettings = mutation({
  args: {
    transcripts: transcriptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        transcripts: args.transcripts,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        userId,
        transcripts: args.transcripts,
        updatedAt: Date.now(),
      });
    }
  },
});

export const updateUxSettings = mutation({
  args: {
    ux: uxSettingsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        ux: args.ux,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        userId,
        ux: args.ux,
        updatedAt: Date.now(),
      });
    }
  },
});

// Update all settings at once
export const updateAllSettings = mutation({
  args: {
    theme: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    ),
    language: v.optional(v.string()),
    notifications: v.optional(notificationsValidator),
    playback: v.optional(playbackValidator),
    notes: v.optional(notesValidator),
    channelSync: v.optional(channelSyncValidator),
    transcripts: v.optional(transcriptsValidator),
    ux: v.optional(uxSettingsValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    const updateData: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.theme !== undefined) updateData.theme = args.theme;
    if (args.language !== undefined) updateData.language = args.language;
    if (args.notifications !== undefined)
      updateData.notifications = args.notifications;
    if (args.playback !== undefined) updateData.playback = args.playback;
    if (args.notes !== undefined) updateData.notes = args.notes;
    if (args.channelSync !== undefined)
      updateData.channelSync = args.channelSync;
    if (args.transcripts !== undefined)
      updateData.transcripts = args.transcripts;
    if (args.ux !== undefined) updateData.ux = args.ux;

    if (settings) {
      await ctx.db.patch(settings._id, updateData);
      return settings._id;
    } else {
      return await ctx.db.insert("settings", {
        userId,
        ...updateData,
      } as {
        userId: string;
        theme?: "light" | "dark" | "system";
        language?: string;
        notifications?: {
          email: boolean;
          push: boolean;
          newComments: boolean;
          newLikes: boolean;
        };
        playback?: {
          autoplay: boolean;
          defaultQuality?: string;
          defaultSpeed?: number;
        };
        notes?: {
          defaultTimestamped: boolean;
          sortOrder?: "asc" | "desc";
        };
        channelSync?: {
          autoSyncOnVisit: boolean;
          syncIntervalMinutes?: number;
          lastAutoSyncAt?: number;
        };
        transcripts?: {
          defaultProvider?:
            | "youtube_captions"
            | "faster_whisper"
            | "sensevoice"
            | "openai_mini"
            | "openai"
            | "deepgram";
          defaultLanguage?: string;
          autoAttemptYoutubeCaptions?: boolean;
          autoAttemptLocalFallback?: boolean;
          sortBy?: "recommended" | "price" | "speed" | "quality" | "name";
        };
        ux?: {
          dismissedHints?: string[];
          feed?: {
            selectedTab?: "all" | "subscriptions" | "playlists" | "history";
            viewMode?: "list" | "grid";
            showWatched?: boolean;
          };
          playlists?: {
            viewMode?: "list" | "grid";
            layout?: "comfortable" | "compact";
            lastFilterPlaylistId?: string;
          };
          notes?: {
            sortOrder?: "asc" | "desc";
            viewMode?: "list" | "compact";
          };
          player?: {
            layout?: "default" | "focus" | "theater";
            focusMode?: boolean;
            shortcutsHintDismissed?: boolean;
          };
        };
        updatedAt: number;
      });
    }
  },
});
