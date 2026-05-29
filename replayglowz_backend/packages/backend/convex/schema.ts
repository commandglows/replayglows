import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // =============================================================================
  // USER-RELATED TABLES
  // =============================================================================

  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    // YouTube OAuth tokens
    youtubeConnected: v.optional(v.boolean()),
    youtubeAccessToken: v.optional(v.string()),
    youtubeRefreshToken: v.optional(v.string()),
    youtubeTokenExpiry: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  settings: defineTable({
    userId: v.string(),
    theme: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    ),
    language: v.optional(v.string()),
    notifications: v.optional(
      v.object({
        email: v.boolean(),
        push: v.boolean(),
        newComments: v.boolean(),
        newLikes: v.boolean(),
        newVideos: v.optional(v.boolean()),
        feedRefreshIntervalMinutes: v.optional(v.number()), // 0=disabled, 30, 60, 120, 360, 1440
        lastFeedCheckAt: v.optional(v.number()),
      }),
    ),
    playback: v.optional(
      v.object({
        autoplay: v.boolean(),
        defaultQuality: v.optional(v.string()),
        defaultSpeed: v.optional(v.number()),
        mobileControlsPosition: v.optional(
          v.union(v.literal("bottom"), v.literal("player")),
        ),
        captionsEnabled: v.optional(v.boolean()),
        captionsLanguage: v.optional(v.string()),
        autoMarkWatchedThreshold: v.optional(v.number()),
      }),
    ),
    notes: v.optional(
      v.object({
        defaultTimestamped: v.boolean(),
        sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
      }),
    ),
    channelSync: v.optional(
      v.object({
        autoSyncOnVisit: v.boolean(),
        syncIntervalMinutes: v.optional(v.number()), // 0 = disabled, 60, 360, 1440
        lastAutoSyncAt: v.optional(v.number()),
      }),
    ),
    transcripts: v.optional(
      v.object({
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
      }),
    ),
    ux: v.optional(
      v.object({
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
            viewMode: v.optional(
              v.union(v.literal("list"), v.literal("compact")),
            ),
          }),
        ),
        player: v.optional(
          v.object({
            layout: v.optional(
              v.union(
                v.literal("default"),
                v.literal("focus"),
                v.literal("theater"),
              ),
            ),
            focusMode: v.optional(v.boolean()),
            shortcutsHintDismissed: v.optional(v.boolean()),
          }),
        ),
      }),
    ),
    updatedAt: v.optional(v.number()),
  }).index("by_user_id", ["userId"]),

  subscriptions: defineTable({
    userId: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("team")),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.literal("revoked"),
    ),
    // Polar integration
    polarCustomerId: v.optional(v.string()),
    polarSubscriptionId: v.optional(v.string()),
    polarProductId: v.optional(v.string()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_polar_customer_id", ["polarCustomerId"])
    .index("by_polar_subscription_id", ["polarSubscriptionId"]),

  productAccessSnapshots: defineTable({
    userId: v.string(),
    globalUserId: v.optional(v.string()),
    productId: v.string(),
    source: v.union(v.literal("suite"), v.literal("legacy")),
    status: v.union(
      v.literal("active"),
      v.literal("trialing"),
      v.literal("inactive"),
      v.literal("revoked"),
    ),
    reasonCode: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_product", ["userId", "productId"])
    .index("by_global_user_product", ["globalUserId", "productId"]),

  // =============================================================================
  // CONTENT TABLES
  // =============================================================================

  channels: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_user_id", ["userId"]),

  videos: defineTable({
    userId: v.string(),
    url: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    channelTitle: v.optional(v.string()),
    duration: v.optional(v.string()),
    views: v.number(),
    likes: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_url", ["url"]),

  // Notes (supports both generic notes and YouTube video notes)
  notes: defineTable({
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
    // YouTube video notes support
    youtubeVideoId: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_youtube_video", ["userId", "youtubeVideoId"]),

  playlists: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    videoIds: v.array(v.id("videos")),
    isPublic: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_public", ["isPublic"]),

  virtualFeeds: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    includeWatched: v.optional(v.boolean()),
    sortOrder: v.optional(
      v.union(v.literal("newest"), v.literal("oldest"), v.literal("default")),
    ),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  virtualFeedSources: defineTable({
    userId: v.string(),
    virtualFeedId: v.id("virtualFeeds"),
    sourceType: v.union(
      v.literal("channel"),
      v.literal("playlist"),
      v.literal("subscriptions"),
    ),
    sourceId: v.string(),
    sourceTitle: v.string(),
    isActive: v.optional(v.boolean()),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_feed", ["virtualFeedId"])
    .index("by_feed_position", ["virtualFeedId", "position"])
    .index("by_user_source", ["userId", "sourceType", "sourceId"]),

  // =============================================================================
  // SOCIAL FEATURES
  // =============================================================================

  comments: defineTable({
    videoId: v.id("videos"),
    userId: v.string(),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_video_id", ["videoId"])
    .index("by_user_id", ["userId"]),

  likes: defineTable({
    videoId: v.id("videos"),
    userId: v.string(),
    type: v.union(v.literal("like"), v.literal("dislike")),
  })
    .index("by_video_id", ["videoId"])
    .index("by_user_and_video", ["userId", "videoId"]),

  // =============================================================================
  // YOUTUBE INTEGRATION CACHE
  // =============================================================================

  youtubePlaylistsCache: defineTable({
    userId: v.string(),
    youtubePlaylistId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    videoCount: v.number(),
    privacyStatus: v.string(),
    publishedAt: v.optional(v.string()),
    cachedAt: v.number(),
    color: v.optional(v.string()), // Hex color code (e.g., "#8b5cf6")
    customThumbnailUrl: v.optional(v.string()),
    source: v.optional(
      v.union(
        v.literal("owned"),
        v.literal("url_import"),
        v.literal("subscriptions"),
      ),
    ),
    importedByUrlAt: v.optional(v.number()),
    importedPlaylistId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_youtube_id", ["userId", "youtubePlaylistId"]),

  youtubeVideosCache: defineTable({
    userId: v.string(),
    youtubePlaylistId: v.string(),
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
    cachedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_playlist", ["userId", "youtubePlaylistId"])
    .index("by_user_and_video", ["userId", "youtubeVideoId"]),

  youtubeSyncJobs: defineTable({
    userId: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("partial"),
      v.literal("failed"),
    ),
    phase: v.union(
      v.literal("planning"),
      v.literal("playlists"),
      v.literal("videos"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    current: v.number(),
    total: v.number(),
    estimatedQuotaUnits: v.number(),
    usedQuotaUnits: v.number(),
    currentPlaylistId: v.optional(v.string()),
    currentPlaylistTitle: v.optional(v.string()),
    errors: v.array(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    lockExpiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_user_and_updated", ["userId", "updatedAt"]),

  // =============================================================================
  // YOUTUBE VIDEO INTERACTIONS (likes/comments on YouTube videos by string ID)
  // =============================================================================

  youtubeLikes: defineTable({
    youtubeVideoId: v.string(),
    userId: v.string(),
    type: v.union(v.literal("like"), v.literal("dislike")),
    createdAt: v.number(),
  })
    .index("by_video", ["youtubeVideoId"])
    .index("by_user_and_video", ["userId", "youtubeVideoId"]),

  youtubeComments: defineTable({
    youtubeVideoId: v.string(),
    userId: v.string(),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_video", ["youtubeVideoId"])
    .index("by_user", ["userId"]),

  // =============================================================================
  // YOUTUBE CHANNEL SUBSCRIPTIONS CACHE
  // =============================================================================

  youtubeChannelsCache: defineTable({
    userId: v.string(),
    youtubeChannelId: v.string(), // YouTube channel ID
    title: v.string(), // Channel name
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    subscriberCount: v.optional(v.string()),
    videoCount: v.optional(v.string()),
    cachedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_channel", ["userId", "youtubeChannelId"]),

  // =============================================================================
  // CHANNEL-PLAYLIST LINKS (Auto-sync)
  // =============================================================================

  channelPlaylistLinks: defineTable({
    userId: v.string(),
    youtubeChannelId: v.string(), // YouTube channel ID (from subscriptions)
    channelTitle: v.string(), // YouTube channel name (for display)
    youtubePlaylistId: v.string(), // Target playlist to sync to
    linkedAt: v.number(), // Timestamp when link was created
    lastSyncedAt: v.optional(v.number()),
    isActive: v.boolean(), // Pause/resume sync
  })
    .index("by_user", ["userId"])
    .index("by_user_and_channel", ["userId", "youtubeChannelId"])
    .index("by_user_and_playlist", ["userId", "youtubePlaylistId"]),

  // =============================================================================
  // HIDDEN ITEMS (User-hidden videos and playlists)
  // =============================================================================

  hiddenItems: defineTable({
    userId: v.string(),
    itemType: v.union(v.literal("video"), v.literal("playlist")),
    youtubeId: v.string(), // youtubeVideoId or youtubePlaylistId
    hiddenAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_type", ["userId", "itemType"])
    .index("by_user_type_and_id", ["userId", "itemType", "youtubeId"]),

  // =============================================================================
  // WATCHED VIDEOS (User's watch history)
  // =============================================================================

  watchedVideos: defineTable({
    userId: v.string(),
    youtubeVideoId: v.string(),
    watchedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_video", ["userId", "youtubeVideoId"]),

  // =============================================================================
  // VIDEO PROGRESS (Per-video resume position)
  // =============================================================================

  videoProgress: defineTable({
    userId: v.string(),
    youtubeVideoId: v.string(),
    progressSeconds: v.number(),
    durationSeconds: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_video", ["userId", "youtubeVideoId"]),

  // =============================================================================
  // PLAYLIST ORDER (User-defined playlist display order)
  // =============================================================================

  playlistOrder: defineTable({
    userId: v.string(),
    orderedIds: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  videoOrder: defineTable({
    userId: v.string(),
    playlistId: v.string(),
    orderedIds: v.array(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_playlist", ["userId", "playlistId"]),

  // =============================================================================
  // API METRICS (YouTube API quota tracking)
  // =============================================================================

  youtubeTranscriptsCache: defineTable({
    youtubeVideoId: v.string(),
    language: v.string(),
    entries: v.array(
      v.object({
        start: v.number(),
        duration: v.number(),
        text: v.string(),
      }),
    ),
    cachedAt: v.number(),
  }).index("by_video_and_lang", ["youtubeVideoId", "language"]),

  transcriptVersions: defineTable({
    userId: v.string(),
    youtubeVideoId: v.string(),
    language: v.string(),
    provider: v.string(),
    status: v.union(
      v.literal("ready"),
      v.literal("failed"),
      v.literal("superseded"),
    ),
    sourceType: v.union(v.literal("captions"), v.literal("audio")),
    version: v.number(),
    entries: v.array(
      v.object({
        start: v.number(),
        duration: v.number(),
        text: v.string(),
        speaker: v.optional(v.string()),
      }),
    ),
    fullText: v.string(),
    estimatedCostUsd: v.optional(v.number()),
    warnings: v.optional(v.array(v.string())),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_video_lang", ["userId", "youtubeVideoId", "language"])
    .index("by_user_video_lang_provider", [
      "userId",
      "youtubeVideoId",
      "language",
      "provider",
    ]),

  transcriptJobs: defineTable({
    userId: v.string(),
    youtubeVideoId: v.string(),
    language: v.string(),
    provider: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("canceled"),
    ),
    progressMessage: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    versionId: v.optional(v.id("transcriptVersions")),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_video_lang", ["userId", "youtubeVideoId", "language"])
    .index("by_user_and_status", ["userId", "status"]),

  transcriptSelections: defineTable({
    userId: v.string(),
    youtubeVideoId: v.string(),
    language: v.string(),
    versionId: v.id("transcriptVersions"),
    updatedAt: v.number(),
  }).index("by_user_video_lang", ["userId", "youtubeVideoId", "language"]),

  transcriptProviderSecrets: defineTable({
    userId: v.string(),
    provider: v.union(v.literal("openai"), v.literal("deepgram")),
    encryptedValue: v.string(),
    maskedValue: v.string(),
    updatedAt: v.number(),
  }).index("by_user_and_provider", ["userId", "provider"]),

  apiMetrics: defineTable({
    userId: v.string(),
    endpoint: v.string(), // e.g., "playlists.list", "search.list"
    quotaUnits: v.number(), // Cost in quota units
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    responseTimeMs: v.optional(v.number()),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_user_and_timestamp", ["userId", "timestamp"]),

  // =============================================================================
  // NOTIFICATIONS
  // =============================================================================

  notifications: defineTable({
    userId: v.string(),
    type: v.union(
      v.literal("new_video"),
      v.literal("transcript_ready"),
      v.literal("system"),
    ),
    title: v.string(),
    body: v.optional(v.string()),
    youtubeVideoId: v.optional(v.string()),
    youtubeChannelId: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "read"])
    .index("by_user_and_created", ["userId", "createdAt"]),

  // =============================================================================
  // FEEDBACK
  // =============================================================================

  feedbackEntries: defineTable({
    type: v.union(v.literal("text"), v.literal("audio")),
    status: v.union(v.literal("new"), v.literal("reviewed")),
    message: v.optional(v.string()),
    audioStorageId: v.optional(v.id("_storage")),
    audioDurationMs: v.optional(v.number()),
    platform: v.union(
      v.literal("web"),
      v.literal("android"),
      v.literal("other"),
    ),
    locale: v.string(),
    buildCommitSha: v.optional(v.string()),
    buildEnvironment: v.optional(v.string()),
    buildTimestamp: v.optional(v.string()),
    userId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    reviewedByEmail: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_status_and_created_at", ["status", "createdAt"])
    .index("by_type_and_created_at", ["type", "createdAt"]),

  // =============================================================================
  // WEBHOOK IDEMPOTENCY
  // =============================================================================

  processedWebhooks: defineTable({
    webhookId: v.string(),
    source: v.union(v.literal("clerk"), v.literal("polar")),
    processedAt: v.number(),
  }).index("by_webhook_id", ["webhookId"]),
});
