import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";

const MAX_FEEDBACK_MESSAGE_LENGTH = 2000;
const MAX_AUDIO_DURATION_MS = 120000;
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;

type FeedbackIdentity = {
  userId?: string;
  userEmail?: string;
};

function normalizeEmail(value: string | undefined | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function adminAllowlist() {
  return (process.env.FEEDBACK_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter((value): value is string => value !== undefined);
}

async function getFeedbackIdentity(ctx: QueryCtx | MutationCtx): Promise<FeedbackIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return {};
  }

  const userId = identity.subject;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
    .first();

  return {
    userId,
    userEmail: normalizeEmail(user?.email) ?? normalizeEmail(identity.email),
  };
}

async function getFeedbackAdminEmail(ctx: QueryCtx | MutationCtx) {
  const { userEmail } = await getFeedbackIdentity(ctx);
  if (!userEmail) {
    return null;
  }

  return adminAllowlist().includes(userEmail) ? userEmail : null;
}

async function requireFeedbackAdmin(ctx: QueryCtx | MutationCtx) {
  const adminEmail = await getFeedbackAdminEmail(ctx);
  if (!adminEmail) {
    throw new Error("Unauthorized");
  }
  return adminEmail;
}

function normalizeMessage(message: string | undefined) {
  const trimmed = message?.trim();
  return trimmed ? trimmed.slice(0, MAX_FEEDBACK_MESSAGE_LENGTH) : undefined;
}

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    return (await getFeedbackAdminEmail(ctx)) !== null;
  },
});

export const getUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const createText = mutation({
  args: {
    message: v.string(),
    platform: v.union(v.literal("web"), v.literal("android"), v.literal("other")),
    locale: v.string(),
    buildCommitSha: v.optional(v.string()),
    buildEnvironment: v.optional(v.string()),
    buildTimestamp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = normalizeMessage(args.message);
    if (!message) {
      throw new Error("Feedback message is required");
    }

    const identity = await getFeedbackIdentity(ctx);

    return await ctx.db.insert("feedbackEntries", {
      type: "text",
      status: "new",
      message,
      platform: args.platform,
      locale: args.locale.trim() || "en",
      buildCommitSha: args.buildCommitSha?.trim() || undefined,
      buildEnvironment: args.buildEnvironment?.trim() || undefined,
      buildTimestamp: args.buildTimestamp?.trim() || undefined,
      userId: identity.userId,
      userEmail: identity.userEmail,
      createdAt: Date.now(),
    });
  },
});

export const createAudio = mutation({
  args: {
    audioStorageId: v.id("_storage"),
    audioDurationMs: v.number(),
    platform: v.union(v.literal("web"), v.literal("android"), v.literal("other")),
    locale: v.string(),
    message: v.optional(v.string()),
    buildCommitSha: v.optional(v.string()),
    buildEnvironment: v.optional(v.string()),
    buildTimestamp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.audioDurationMs <= 0 || args.audioDurationMs > MAX_AUDIO_DURATION_MS) {
      await ctx.storage.delete(args.audioStorageId);
      throw new Error("Audio duration is invalid");
    }

    const metadata = await ctx.db.system.get("_storage", args.audioStorageId);
    if (!metadata) {
      throw new Error("Uploaded audio file not found");
    }

    if (metadata.size > MAX_AUDIO_SIZE_BYTES) {
      await ctx.storage.delete(args.audioStorageId);
      throw new Error("Uploaded audio file is too large");
    }

    if (metadata.contentType && !metadata.contentType.startsWith("audio/")) {
      await ctx.storage.delete(args.audioStorageId);
      throw new Error("Uploaded file is not audio");
    }

    const identity = await getFeedbackIdentity(ctx);
    const message = normalizeMessage(args.message);

    return await ctx.db.insert("feedbackEntries", {
      type: "audio",
      status: "new",
      message,
      audioStorageId: args.audioStorageId,
      audioDurationMs: args.audioDurationMs,
      platform: args.platform,
      locale: args.locale.trim() || "en",
      buildCommitSha: args.buildCommitSha?.trim() || undefined,
      buildEnvironment: args.buildEnvironment?.trim() || undefined,
      buildTimestamp: args.buildTimestamp?.trim() || undefined,
      userId: identity.userId,
      userEmail: identity.userEmail,
      createdAt: Date.now(),
    });
  },
});

export const listAdmin = query({
  args: {
    status: v.optional(v.union(v.literal("new"), v.literal("reviewed"))),
    type: v.optional(v.union(v.literal("text"), v.literal("audio"))),
  },
  handler: async (ctx, args) => {
    await requireFeedbackAdmin(ctx);

    let entries;
    if (args.status) {
      entries = await ctx.db
        .query("feedbackEntries")
        .withIndex("by_status_and_created_at", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    } else if (args.type) {
      entries = await ctx.db
        .query("feedbackEntries")
        .withIndex("by_type_and_created_at", (q) => q.eq("type", args.type!))
        .order("desc")
        .collect();
    } else {
      entries = await ctx.db
        .query("feedbackEntries")
        .withIndex("by_created_at")
        .order("desc")
        .collect();
    }

    const filtered = entries.filter((entry) => {
      if (args.status && entry.status !== args.status) return false;
      if (args.type && entry.type !== args.type) return false;
      return true;
    });

    return await Promise.all(
      filtered.map(async (entry) => ({
        id: entry._id,
        type: entry.type,
        status: entry.status,
        message: entry.message,
        audioStorageId: entry.audioStorageId,
        audioDurationMs: entry.audioDurationMs,
        audioUrl: entry.audioStorageId
          ? await ctx.storage.getUrl(entry.audioStorageId)
          : null,
        platform: entry.platform,
        locale: entry.locale,
        buildCommitSha: entry.buildCommitSha,
        buildEnvironment: entry.buildEnvironment,
        buildTimestamp: entry.buildTimestamp,
        userId: entry.userId,
        userEmail: entry.userEmail,
        reviewedAt: entry.reviewedAt,
        reviewedByEmail: entry.reviewedByEmail,
        createdAt: entry.createdAt,
      }))
    );
  },
});

export const markReviewed = mutation({
  args: {
    feedbackId: v.id("feedbackEntries"),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireFeedbackAdmin(ctx);

    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    await ctx.db.patch(args.feedbackId, {
      status: "reviewed",
      reviewedAt: Date.now(),
      reviewedByEmail: adminEmail,
    });
  },
});
