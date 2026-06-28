import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireReplayGlowzAccess } from "./access";
import { internal } from "./_generated/api";

// Notifications retention period (30 days in milliseconds)
const NOTIFICATIONS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Maximum notifications returned per query
const MAX_NOTIFICATIONS = 50;

/**
 * Get notifications for the current user, sorted newest first.
 */
export const getNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return [];

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_NOTIFICATIONS);

    return notifications;
  },
});

/**
 * Get unread notification count for the current user.
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", userId).eq("read", false)
      )
      .collect();

    return unread.length;
  },
});

/**
 * Mark a single notification as read.
 */
export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found");
    }

    await ctx.db.patch(args.notificationId, { read: true });
  },
});

/**
 * Mark all unread notifications as read for the current user.
 */
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", userId).eq("read", false)
      )
      .collect();

    for (const notification of unread) {
      await ctx.db.patch(notification._id, { read: true });
    }

    return unread.length;
  },
});

/**
 * Create a notification (internal — used by feedChecker cron).
 */
export const createNotification = internalMutation({
  args: {
    userId: v.string(),
    type: v.union(
      v.literal("new_video"),
      v.literal("transcript_ready"),
      v.literal("system")
    ),
    title: v.string(),
    body: v.optional(v.string()),
    youtubeVideoId: v.optional(v.string()),
    youtubeChannelId: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      youtubeVideoId: args.youtubeVideoId,
      youtubeChannelId: args.youtubeChannelId,
      thumbnailUrl: args.thumbnailUrl,
      read: false,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.pushDelivery.deliverNotification, {
      notificationId,
    });

    return notificationId;
  },
});

/**
 * Delete notifications older than 30 days (called by daily cron).
 */
export const cleanupOldNotifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - NOTIFICATIONS_RETENTION_MS;

    // Process in batches to avoid transaction limits
    let deleted = 0;
    const batchSize = 100;

    while (true) {
      const old = await ctx.db
        .query("notifications")
        .filter((q) => q.lt(q.field("createdAt"), cutoff))
        .take(batchSize);

      if (old.length === 0) break;

      for (const notification of old) {
        await ctx.db.delete(notification._id);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} old notifications`);
    }
  },
});
