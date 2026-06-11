"use node";

import { v } from "convex/values";
import { ActionCtx, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getMessaging, Message } from "firebase-admin/messaging";

type PreparedDelivery = {
  attemptId: Id<"androidPushDeliveryAttempts">;
  registrationId: Id<"androidPushDeviceRegistrations">;
  token: string;
  title: string;
  body: string;
  imageUrl?: string;
  data: {
    notificationId: string;
    type: "new_video" | "transcript_ready" | "system";
    route: string;
    youtubeVideoId: string;
  };
};

type DeliveryResult =
  | { status: "not_configured"; prepared: 0; sent: 0 }
  | { status: "no_eligible_devices"; prepared: 0; sent: 0 }
  | { status: "sent"; prepared: number; sent: number; failed: number };

function readPrivateKey() {
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    return Buffer.from(
      process.env.FIREBASE_PRIVATE_KEY_BASE64,
      "base64",
    ).toString("utf8");
  }

  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function getFirebaseAppIfConfigured() {
  if (getApps().length > 0) return getApp();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = readPrivateKey();

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  if (projectId && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  return null;
}

function isInvalidTokenError(errorCode: string) {
  return (
    errorCode === "messaging/registration-token-not-registered" ||
    errorCode === "messaging/invalid-registration-token"
  );
}

function deliveryToMessage(delivery: PreparedDelivery): Message {
  return {
    token: delivery.token,
    notification: {
      title: delivery.title,
      body: delivery.body,
      imageUrl: delivery.imageUrl,
    },
    data: {
      notificationId: delivery.data.notificationId,
      type: delivery.data.type,
      route: delivery.data.route,
      youtubeVideoId: delivery.data.youtubeVideoId,
    },
    android: {
      priority:
        delivery.data.type === "transcript_ready" ? "high" : "normal",
      notification: {
        channelId:
          delivery.data.type === "transcript_ready"
            ? "replayglowz_transcript_ready"
            : delivery.data.type === "new_video"
              ? "replayglowz_new_videos"
              : "replayglowz_system",
        clickAction: "FLUTTER_NOTIFICATION_CLICK",
      },
    },
  };
}

async function sendNotificationById(
  ctx: ActionCtx,
  notificationId: Id<"notifications">,
): Promise<DeliveryResult> {
  const app = getFirebaseAppIfConfigured();
  if (!app) {
    return { status: "not_configured", prepared: 0, sent: 0 };
  }

  const deliveries: PreparedDelivery[] = await ctx.runMutation(
    internal.androidPush.prepareNotificationDelivery,
    { notificationId },
  );

  if (deliveries.length === 0) {
    return { status: "no_eligible_devices", prepared: 0, sent: 0 };
  }

  const messages = deliveries.map(deliveryToMessage);

  try {
    const response = await getMessaging(app).sendEach(messages);

    for (let index = 0; index < deliveries.length; index++) {
      const delivery = deliveries[index];
      const result = response.responses[index];

      if (result.success && result.messageId) {
        await ctx.runMutation(internal.androidPush.recordDeliverySuccess, {
          attemptId: delivery.attemptId,
          fcmMessageId: result.messageId,
        });
        continue;
      }

      const errorCode = result.error?.code ?? "messaging/unknown-error";
      await ctx.runMutation(internal.androidPush.recordDeliveryFailure, {
        attemptId: delivery.attemptId,
        errorCode,
      });

      if (isInvalidTokenError(errorCode)) {
        await ctx.runMutation(
          internal.androidPush.deactivateRegistrationInternal,
          {
            registrationId: delivery.registrationId,
            reason: "fcm_invalid",
          },
        );
      }
    }

    return {
      status: "sent",
      prepared: deliveries.length,
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    const errorCode =
      error instanceof Error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "messaging/send-failed";

    for (const delivery of deliveries) {
      await ctx.runMutation(internal.androidPush.recordDeliveryFailure, {
        attemptId: delivery.attemptId,
        errorCode,
      });
    }

    return {
      status: "sent",
      prepared: deliveries.length,
      sent: 0,
      failed: deliveries.length,
    };
  }
}

export const deliverNotification = internalAction({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args): Promise<DeliveryResult> => {
    return await sendNotificationById(ctx, args.notificationId);
  },
});

type DueDeliveryResult =
  | { status: "not_configured"; checked: 0; sent: 0 }
  | { status: "checked"; checked: number; sent: number };

export const deliverDueAndroidPushNotifications = internalAction({
  args: {},
  handler: async (ctx): Promise<DueDeliveryResult> => {
    const app = getFirebaseAppIfConfigured();
    if (!app) {
      return { status: "not_configured", checked: 0, sent: 0 };
    }

    const notificationIds: Id<"notifications">[] = await ctx.runQuery(
      internal.androidPush.getDueNotificationIds,
      {},
    );
    let sent = 0;

    for (const notificationId of notificationIds) {
      const result = await sendNotificationById(ctx, notificationId);
      sent += result.sent;
    }

    return { status: "checked", checked: notificationIds.length, sent };
  },
});
