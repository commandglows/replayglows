import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  MutationCtx,
  mutation,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  REPLAYGLOWZ_LEGACY_PRODUCT_IDS,
  REPLAYGLOWZ_PRODUCT_ID,
  requireReplayGlowzAccess,
} from "./access";
import { normalizeNotifications } from "./settings";

const NEW_VIDEO_CADENCE_MS = {
  hourly: 60 * 60 * 1000,
  every_6_hours: 6 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  every_3_days: 3 * 24 * 60 * 60 * 1000,
} as const;

const deviceMetadataValidator = {
  token: v.string(),
  appInstallationId: v.optional(v.string()),
  deviceName: v.optional(v.string()),
  appVersion: v.optional(v.string()),
};

const deactivationReasonValidator = v.union(
  v.literal("sign_out"),
  v.literal("token_rotated"),
  v.literal("fcm_invalid"),
  v.literal("user_switched"),
  v.literal("user_disabled"),
  v.literal("stale"),
);

function sanitizeToken(token: string) {
  const trimmed = token.trim();
  if (trimmed.length < 20) {
    throw new Error("Invalid Android push token");
  }
  return trimmed;
}

function buildRouteData(notification: {
  _id: Id<"notifications">;
  type: "new_video" | "transcript_ready" | "system";
  youtubeVideoId?: string;
}) {
  const route =
    notification.type === "new_video" || notification.type === "transcript_ready"
      ? "play"
      : "notifications";

  return {
    notificationId: notification._id,
    type: notification.type,
    route,
    youtubeVideoId: notification.youtubeVideoId ?? "",
  };
}

async function sourceMatchesSelectedFeeds(
  ctx: MutationCtx,
  userId: string,
  youtubeChannelId: string | undefined,
  selectedFeedIds: Id<"virtualFeeds">[],
) {
  if (!youtubeChannelId || selectedFeedIds.length === 0) return false;

  for (const feedId of selectedFeedIds) {
    const feed = await ctx.db.get(feedId);
    if (!feed || feed.userId !== userId || feed.isActive === false) continue;

    const sources = await ctx.db
      .query("virtualFeedSources")
      .withIndex("by_feed", (q) => q.eq("virtualFeedId", feedId))
      .collect();

    if (
      sources.some(
        (source) =>
          source.userId === userId &&
          source.isActive !== false &&
          (source.sourceType === "subscriptions" ||
            (source.sourceType === "channel" &&
              source.sourceId === youtubeChannelId)),
      )
    ) {
      return true;
    }
  }

  return false;
}

async function sourceMatchesSelectedChannelSources(
  ctx: MutationCtx,
  userId: string,
  youtubeChannelId: string | undefined,
  selectedChannelSourceIds: Id<"virtualFeedSources">[],
) {
  if (!youtubeChannelId || selectedChannelSourceIds.length === 0) return false;

  for (const sourceId of selectedChannelSourceIds) {
    const source = await ctx.db.get(sourceId);
    if (
      source &&
      source.userId === userId &&
      source.isActive !== false &&
      source.sourceType === "channel" &&
      source.sourceId === youtubeChannelId
    ) {
      return true;
    }
  }

  return false;
}

async function getLastNewVideoPushAt(ctx: MutationCtx, userId: string) {
  const recentAttempts = await ctx.db
    .query("androidPushDeliveryAttempts")
    .withIndex("by_user_status_created", (q) =>
      q.eq("userId", userId).eq("status", "sent"),
    )
    .order("desc")
    .take(25);

  for (const attempt of recentAttempts) {
    const notification = await ctx.db.get(attempt.notificationId);
    if (notification?.type === "new_video") {
      return attempt.sentAt ?? attempt.createdAt;
    }
  }

  return 0;
}

async function hasCurrentReplayGlowzAccess(ctx: MutationCtx, userId: string) {
  const now = Date.now();
  for (const productId of [
    REPLAYGLOWZ_PRODUCT_ID,
    ...REPLAYGLOWZ_LEGACY_PRODUCT_IDS,
  ]) {
    const snapshot = await ctx.db
      .query("productAccessSnapshots")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", productId),
      )
      .first();

    if (
      snapshot &&
      snapshot.expiresAt > now &&
      (snapshot.status === "active" || snapshot.status === "trialing")
    ) {
      return true;
    }
  }

  return false;
}

async function isNotificationPushEligible(
  ctx: MutationCtx,
  notification: Doc<"notifications">,
) {
  const hasAccess = await hasCurrentReplayGlowzAccess(
    ctx,
    notification.userId,
  );
  if (!hasAccess) return false;

  const settings = await ctx.db
    .query("settings")
    .withIndex("by_user_id", (q) => q.eq("userId", notification.userId))
    .first();
  const notifications = normalizeNotifications(settings?.notifications);
  const androidPush = notifications.androidPush;

  if (!notifications.push || !androidPush.enabled) {
    return false;
  }

  if (!androidPush.types[notification.type as keyof typeof androidPush.types]) {
    return false;
  }

  if (notification.type === "new_video") {
    if (androidPush.sourceTargeting.mode === "selected") {
      const feedMatch = await sourceMatchesSelectedFeeds(
        ctx,
        notification.userId,
        notification.youtubeChannelId,
        androidPush.sourceTargeting.selectedFeedIds,
      );
      const channelMatch = await sourceMatchesSelectedChannelSources(
        ctx,
        notification.userId,
        notification.youtubeChannelId,
        androidPush.sourceTargeting.selectedChannelSourceIds,
      );
      if (!feedMatch && !channelMatch) return false;
    }

    const lastNewVideoPushAt = await getLastNewVideoPushAt(
      ctx,
      notification.userId,
    );
    const cadenceMs = NEW_VIDEO_CADENCE_MS[androidPush.cadence];
    if (Date.now() - lastNewVideoPushAt < cadenceMs) {
      return false;
    }
  }

  return true;
}

export const registerAndroidDevice = mutation({
  args: deviceMetadataValidator,
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    const token = sanitizeToken(args.token);
    const now = Date.now();

    const tokenMatches = await ctx.db
      .query("androidPushDeviceRegistrations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .collect();

    for (const registration of tokenMatches) {
      if (registration.userId !== userId && registration.active) {
        await ctx.db.patch(registration._id, {
          active: false,
          deactivatedAt: now,
          deactivationReason: "user_switched",
          updatedAt: now,
        });
      }
    }

    const existing = await ctx.db
      .query("androidPushDeviceRegistrations")
      .withIndex("by_user_token", (q) =>
        q.eq("userId", userId).eq("token", token),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        platform: "android",
        appInstallationId: args.appInstallationId,
        deviceName: args.deviceName,
        appVersion: args.appVersion,
        active: true,
        lastSeenAt: now,
        tokenUpdatedAt: now,
        deactivatedAt: undefined,
        deactivationReason: undefined,
        updatedAt: now,
      });
      return { registrationId: existing._id, active: true };
    }

    const registrationId = await ctx.db.insert("androidPushDeviceRegistrations", {
      userId,
      platform: "android",
      token,
      appInstallationId: args.appInstallationId,
      deviceName: args.deviceName,
      appVersion: args.appVersion,
      active: true,
      lastSeenAt: now,
      tokenUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { registrationId, active: true };
  },
});

export const deactivateAndroidDevice = mutation({
  args: {
    registrationId: v.optional(v.id("androidPushDeviceRegistrations")),
    token: v.optional(v.string()),
    reason: v.optional(deactivationReasonValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    const now = Date.now();

    const registration = args.registrationId
      ? await ctx.db.get(args.registrationId)
      : args.token
        ? await ctx.db
            .query("androidPushDeviceRegistrations")
            .withIndex("by_user_token", (q) =>
              q.eq("userId", userId).eq("token", sanitizeToken(args.token!)),
            )
            .first()
        : null;

    if (!registration || registration.userId !== userId) {
      throw new Error("Android push registration not found");
    }

    await ctx.db.patch(registration._id, {
      active: false,
      deactivatedAt: now,
      deactivationReason: args.reason ?? "sign_out",
      updatedAt: now,
    });

    return { registrationId: registration._id, active: false };
  },
});

export const deactivateRegistrationInternal = internalMutation({
  args: {
    registrationId: v.id("androidPushDeviceRegistrations"),
    reason: deactivationReasonValidator,
  },
  handler: async (ctx, args) => {
    const registration = await ctx.db.get(args.registrationId);
    if (!registration) return false;

    const now = Date.now();
    await ctx.db.patch(args.registrationId, {
      active: false,
      deactivatedAt: now,
      deactivationReason: args.reason,
      updatedAt: now,
    });

    return true;
  },
});

export const prepareNotificationDelivery = internalMutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return [];

    const eligible = await isNotificationPushEligible(ctx, notification);
    if (!eligible) return [];

    const registrations = await ctx.db
      .query("androidPushDeviceRegistrations")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", notification.userId).eq("active", true),
      )
      .collect();

    const now = Date.now();
    const deliveries = [];

    for (const registration of registrations) {
      const existingAttempt = await ctx.db
        .query("androidPushDeliveryAttempts")
        .withIndex("by_notification_device", (q) =>
          q
            .eq("notificationId", notification._id)
            .eq("deviceRegistrationId", registration._id),
        )
        .first();

      if (
        existingAttempt?.status === "sent" ||
        existingAttempt?.status === "pending"
      ) {
        continue;
      }

      const attemptId =
        existingAttempt?._id ??
        (await ctx.db.insert("androidPushDeliveryAttempts", {
          userId: notification.userId,
          notificationId: notification._id,
          deviceRegistrationId: registration._id,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        }));

      if (existingAttempt?.status === "failed") {
        await ctx.db.patch(existingAttempt._id, {
          status: "pending",
          errorCode: undefined,
          updatedAt: now,
        });
      }

      deliveries.push({
        attemptId,
        registrationId: registration._id,
        token: registration.token,
        title: notification.title,
        body: notification.body ?? "",
        imageUrl: notification.thumbnailUrl,
        data: buildRouteData(notification),
      });
    }

    return deliveries;
  },
});

export const recordDeliverySuccess = internalMutation({
  args: {
    attemptId: v.id("androidPushDeliveryAttempts"),
    fcmMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.attemptId, {
      status: "sent",
      fcmMessageId: args.fcmMessageId,
      errorCode: undefined,
      sentAt: now,
      updatedAt: now,
    });
  },
});

export const recordDeliveryFailure = internalMutation({
  args: {
    attemptId: v.id("androidPushDeliveryAttempts"),
    errorCode: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.attemptId, {
      status: "failed",
      errorCode: args.errorCode,
      failedAt: now,
      updatedAt: now,
    });
  },
});

export const getDueNotificationIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const registrations = await ctx.db
      .query("androidPushDeviceRegistrations")
      .withIndex("by_active", (q) => q.eq("active", true))
      .take(200);
    const userIds = Array.from(new Set(registrations.map((r) => r.userId)));
    const notificationIds: Id<"notifications">[] = [];

    for (const userId of userIds) {
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user_and_created", (q) => q.eq("userId", userId))
        .order("desc")
        .take(50);

      for (const notification of notifications) {
        const existingAttempts = await ctx.db
          .query("androidPushDeliveryAttempts")
          .withIndex("by_user_notification", (q) =>
            q.eq("userId", userId).eq("notificationId", notification._id),
          )
          .take(1);
        if (existingAttempts.length === 0) {
          notificationIds.push(notification._id);
        }
      }
    }

    return notificationIds.slice(0, 100);
  },
});
