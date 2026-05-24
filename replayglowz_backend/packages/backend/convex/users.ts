import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getUserId } from "./utils";
import { defaultTranscriptSettings } from "./settings";

const REPLAYGLOWZ_PRODUCT_ID = "replayglowz";
const REPLAYGLOWZ_LEGACY_PRODUCT_IDS = ["tubeflow"];
const DEFAULT_FREE_ACCESS_REASON = "default_free_entitlement";

function isActiveAccessStatus(status: string) {
  return status === "active" || status === "trialing";
}

// Get current user from Convex (synced from Clerk)
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    return user;
  },
});

export const getProductAccessStatus = query({
  args: {
    productId: v.optional(v.string()),
    legacyProductIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      return {
        loading: false,
        hasAccess: false,
        accountRecognized: false,
        productId: args.productId ?? REPLAYGLOWZ_PRODUCT_ID,
        reasonCode: "unauthenticated",
      };
    }

    const productId = args.productId ?? REPLAYGLOWZ_PRODUCT_ID;
    const legacyProductIds =
      args.legacyProductIds && args.legacyProductIds.length > 0
        ? args.legacyProductIds
        : REPLAYGLOWZ_LEGACY_PRODUCT_IDS;
    const acceptedProductIds = [productId, ...legacyProductIds];
    const now = Date.now();

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    let revokedSnapshot:
      | {
          productId: string;
          reasonCode?: string;
          globalUserId?: string;
        }
      | null = null;

    for (const acceptedProductId of acceptedProductIds) {
      const snapshot = await ctx.db
        .query("productAccessSnapshots")
        .withIndex("by_user_product", (q) =>
          q.eq("userId", userId).eq("productId", acceptedProductId)
        )
        .first();

      if (!snapshot || snapshot.expiresAt <= now) continue;

      if (isActiveAccessStatus(snapshot.status)) {
        return {
          loading: false,
          hasAccess: true,
          accountRecognized: true,
          productId,
          matchedProductId: acceptedProductId,
          globalUserId: snapshot.globalUserId,
        };
      }

      if (snapshot.status === "revoked") {
        revokedSnapshot = {
          productId: acceptedProductId,
          reasonCode: snapshot.reasonCode,
          globalUserId: snapshot.globalUserId,
        };
      }
    }

    if (revokedSnapshot) {
      return {
        loading: false,
        hasAccess: false,
        accountRecognized: true,
        productId,
        matchedProductId: revokedSnapshot.productId,
        globalUserId: revokedSnapshot.globalUserId,
        reasonCode: revokedSnapshot.reasonCode ?? "product_access_revoked",
      };
    }

    if (user !== null && productId === REPLAYGLOWZ_PRODUCT_ID) {
      return {
        loading: false,
        hasAccess: true,
        accountRecognized: true,
        productId,
        matchedProductId: REPLAYGLOWZ_PRODUCT_ID,
        reasonCode: DEFAULT_FREE_ACCESS_REASON,
      };
    }

    return {
      loading: false,
      hasAccess: false,
      accountRecognized: user !== null,
      productId,
      reasonCode: user === null ? "account_not_found" : "missing_product_entitlement",
    };
  },
});

// Get user by Clerk ID
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

// Create or update user from Clerk webhook
export const upsertUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    const now = Date.now();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
        updatedAt: now,
      });
      return existingUser._id;
    } else {
      // Create new user
      const userId = await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
        createdAt: now,
        updatedAt: now,
      });

      // Create default settings for new user
      await ctx.db.insert("settings", {
        userId: args.clerkId,
        theme: "system",
        language: "en",
        notifications: {
          email: true,
          push: true,
          newComments: true,
          newLikes: false,
        },
        playback: {
          autoplay: true,
          defaultQuality: "auto",
          defaultSpeed: 1,
        },
        notes: {
          defaultTimestamped: true,
          sortOrder: "asc",
        },
        transcripts: defaultTranscriptSettings,
        updatedAt: now,
      });

      // Create default free subscription
      await ctx.db.insert("subscriptions", {
        userId: args.clerkId,
        plan: "free",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      return userId;
    }
  },
});

// Delete user and ALL related data from Clerk webhook
export const deleteUser = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return;

    const uid = args.clerkId;

    // Fetch all user data in parallel across all tables
    const [
      settings,
      subscriptions,
      channels,
      videos,
      notes,
      playlists,
      comments,
      likes,
      ytPlaylistsCache,
      ytVideosCache,
      ytChannelsCache,
      ytLikes,
      ytComments,
      channelLinks,
      hiddenItems,
      watchedVideos,
      videoProgress,
      playlistOrder,
      videoOrder,
      transcriptVersions,
      transcriptJobs,
      transcriptSelections,
      transcriptSecrets,
      apiMetrics,
    ] = await Promise.all([
      ctx.db.query("settings").withIndex("by_user_id", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("subscriptions").withIndex("by_user_id", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("channels").withIndex("by_user_id", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("videos").withIndex("by_user_id", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("notes").withIndex("by_user_id", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("playlists").withIndex("by_user_id", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("comments").withIndex("by_user_id", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("likes").withIndex("by_user_and_video", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("youtubePlaylistsCache").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("youtubeVideosCache").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("youtubeChannelsCache").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("youtubeLikes").withIndex("by_user_and_video", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("youtubeComments").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("channelPlaylistLinks").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("hiddenItems").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("watchedVideos").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("videoProgress").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("playlistOrder").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("videoOrder").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("transcriptVersions").withIndex("by_user_video_lang", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("transcriptJobs").withIndex("by_user_video_lang", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("transcriptSelections").withIndex("by_user_video_lang", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("transcriptProviderSecrets").withIndex("by_user_and_provider", (q) => q.eq("userId", uid)).collect(),
      ctx.db.query("apiMetrics").withIndex("by_user", (q) => q.eq("userId", uid)).collect(),
    ]);

    // Delete all records across all tables
    const allRecords = [
      ...settings, ...subscriptions, ...channels, ...videos, ...notes,
      ...playlists, ...comments, ...likes, ...ytPlaylistsCache, ...ytVideosCache,
      ...ytChannelsCache, ...ytLikes, ...ytComments, ...channelLinks,
      ...hiddenItems, ...watchedVideos, ...videoProgress, ...playlistOrder,
      ...videoOrder, ...transcriptVersions, ...transcriptJobs,
      ...transcriptSelections, ...transcriptSecrets, ...apiMetrics,
    ];

    await Promise.all(allRecords.map((record) => ctx.db.delete(record._id)));

    // Delete user last
    await ctx.db.delete(user._id);
  },
});

// Update user profile (called from frontend)
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.avatarUrl !== undefined && { avatarUrl: args.avatarUrl }),
      updatedAt: Date.now(),
    });

    return user._id;
  },
});

// Ensure user exists (create if not) - called on first app load
export const ensureUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    const now = Date.now();

    if (existingUser) {
      return existingUser._id;
    }

    // Create new user
    const newUserId = await ctx.db.insert("users", {
      clerkId: userId,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      createdAt: now,
      updatedAt: now,
    });

    // Create default settings
    await ctx.db.insert("settings", {
      userId: userId,
      theme: "system",
      language: "en",
      notifications: {
        email: true,
        push: true,
        newComments: true,
        newLikes: false,
      },
      playback: {
        autoplay: true,
        defaultQuality: "auto",
        defaultSpeed: 1,
      },
      notes: {
        defaultTimestamped: true,
        sortOrder: "asc",
      },
      transcripts: defaultTranscriptSettings,
      updatedAt: now,
    });

    // Create default free subscription
    await ctx.db.insert("subscriptions", {
      userId: userId,
      plan: "free",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return newUserId;
  },
});
