import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireReplayGlowsAccess } from "./access";
import { defaultTranscriptSettings } from "./settings";
import { buildTranscriptProviderCatalog } from "./transcriptCatalog.helpers";

const transcriptProviderValidator = v.union(
  v.literal("youtube_captions"),
  v.literal("faster_whisper"),
  v.literal("sensevoice"),
  v.literal("openai_mini"),
  v.literal("openai"),
  v.literal("deepgram"),
);

const transcriptEntryValidator = v.object({
  start: v.number(),
  duration: v.number(),
  text: v.string(),
  speaker: v.optional(v.string()),
});

async function buildProviderCatalog(ctx: any, userId: string) {
  const secrets = await ctx.db
    .query("transcriptProviderSecrets")
    .withIndex("by_user_and_provider", (q: any) => q.eq("userId", userId))
    .collect();

  const hasWorker = Boolean(process.env.TRANSCRIPT_WORKER_URL);
  return buildTranscriptProviderCatalog(secrets, hasWorker);
}

export const getTranscriptSettings = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    return settings?.transcripts ?? defaultTranscriptSettings;
  },
});

export const getProviderCatalogInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => await buildProviderCatalog(ctx, args.userId),
});

export const getProviderCatalog = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) return [];
    return await buildProviderCatalog(ctx, userId);
  },
});

export const getTranscriptVersions = query({
  args: {
    youtubeVideoId: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) return [];

    const versions = await ctx.db
      .query("transcriptVersions")
      .withIndex("by_user_video_lang", (q) =>
        q
          .eq("userId", userId)
          .eq("youtubeVideoId", args.youtubeVideoId)
          .eq("language", args.language),
      )
      .collect();

    const selection = await ctx.db
      .query("transcriptSelections")
      .withIndex("by_user_video_lang", (q) =>
        q
          .eq("userId", userId)
          .eq("youtubeVideoId", args.youtubeVideoId)
          .eq("language", args.language),
      )
      .first();

    return versions
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((version) => ({
        _id: version._id,
        provider: version.provider,
        version: version.version,
        status: version.status,
        sourceType: version.sourceType,
        estimatedCostUsd: version.estimatedCostUsd,
        warnings: version.warnings ?? [],
        errorMessage: version.errorMessage,
        previewText: version.fullText.slice(0, 180),
        createdAt: version.createdAt,
        isActive: selection?.versionId === version._id,
      }));
  },
});

export const getLatestTranscriptJob = query({
  args: {
    youtubeVideoId: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) return null;

    const jobs = await ctx.db
      .query("transcriptJobs")
      .withIndex("by_user_video_lang", (q) =>
        q
          .eq("userId", userId)
          .eq("youtubeVideoId", args.youtubeVideoId)
          .eq("language", args.language),
      )
      .collect();

    const job = jobs.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
    if (!job) return null;

    return {
      _id: job._id,
      provider: job.provider,
      status: job.status,
      progressMessage: job.progressMessage,
      errorMessage: job.errorMessage,
      versionId: job.versionId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  },
});

export const getActiveTranscript = query({
  args: {
    youtubeVideoId: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) return null;

    const selection = await ctx.db
      .query("transcriptSelections")
      .withIndex("by_user_video_lang", (q) =>
        q
          .eq("userId", userId)
          .eq("youtubeVideoId", args.youtubeVideoId)
          .eq("language", args.language),
      )
      .first();

    let version = selection ? await ctx.db.get(selection.versionId) : null;

    if (!version) {
      const versions = await ctx.db
        .query("transcriptVersions")
        .withIndex("by_user_video_lang", (q) =>
          q
            .eq("userId", userId)
            .eq("youtubeVideoId", args.youtubeVideoId)
            .eq("language", args.language),
        )
        .collect();
      version =
        versions
          .filter((item) => item.status === "ready")
          .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
    }

    if (!version || version.status !== "ready") return null;

    return {
      _id: version._id,
      provider: version.provider,
      language: version.language,
      sourceType: version.sourceType,
      entries: version.entries,
      fullText: version.fullText,
      warnings: version.warnings ?? [],
      estimatedCostUsd: version.estimatedCostUsd,
      createdAt: version.createdAt,
    };
  },
});

export const getLatestVersionForProvider = internalQuery({
  args: {
    userId: v.string(),
    youtubeVideoId: v.string(),
    language: v.string(),
    provider: transcriptProviderValidator,
  },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("transcriptVersions")
      .withIndex("by_user_video_lang_provider", (q) =>
        q
          .eq("userId", args.userId)
          .eq("youtubeVideoId", args.youtubeVideoId)
          .eq("language", args.language)
          .eq("provider", args.provider),
      )
      .collect();

    return (
      versions
        .filter((version) => version.status === "ready")
        .sort((a, b) => b.version - a.version)[0] ?? null
    );
  },
});

export const createJob = internalMutation({
  args: {
    userId: v.string(),
    youtubeVideoId: v.string(),
    language: v.string(),
    provider: transcriptProviderValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("transcriptJobs", {
      userId: args.userId,
      youtubeVideoId: args.youtubeVideoId,
      language: args.language,
      provider: args.provider,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateJob = internalMutation({
  args: {
    jobId: v.id("transcriptJobs"),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("canceled"),
      ),
    ),
    progressMessage: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    versionId: v.optional(v.id("transcriptVersions")),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const update: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    if (args.status !== undefined) update.status = args.status;
    if (args.progressMessage !== undefined)
      update.progressMessage = args.progressMessage;
    if (args.errorMessage !== undefined)
      update.errorMessage = args.errorMessage;
    if (args.versionId !== undefined) update.versionId = args.versionId;
    if (args.startedAt !== undefined) update.startedAt = args.startedAt;
    if (args.finishedAt !== undefined) update.finishedAt = args.finishedAt;
    await ctx.db.patch(args.jobId, update);
  },
});

export const createVersion = internalMutation({
  args: {
    userId: v.string(),
    youtubeVideoId: v.string(),
    language: v.string(),
    provider: transcriptProviderValidator,
    sourceType: v.union(v.literal("captions"), v.literal("audio")),
    entries: v.array(transcriptEntryValidator),
    fullText: v.string(),
    estimatedCostUsd: v.optional(v.number()),
    warnings: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("transcriptVersions")
      .withIndex("by_user_video_lang_provider", (q) =>
        q
          .eq("userId", args.userId)
          .eq("youtubeVideoId", args.youtubeVideoId)
          .eq("language", args.language)
          .eq("provider", args.provider),
      )
      .collect();
    const now = Date.now();
    return await ctx.db.insert("transcriptVersions", {
      userId: args.userId,
      youtubeVideoId: args.youtubeVideoId,
      language: args.language,
      provider: args.provider,
      status: "ready",
      sourceType: args.sourceType,
      version: versions.length + 1,
      entries: args.entries,
      fullText: args.fullText,
      estimatedCostUsd: args.estimatedCostUsd,
      warnings: args.warnings,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const upsertSelection = internalMutation({
  args: {
    userId: v.string(),
    youtubeVideoId: v.string(),
    language: v.string(),
    versionId: v.id("transcriptVersions"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("transcriptSelections")
      .withIndex("by_user_video_lang", (q) =>
        q
          .eq("userId", args.userId)
          .eq("youtubeVideoId", args.youtubeVideoId)
          .eq("language", args.language),
      )
      .first();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        versionId: args.versionId,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("transcriptSelections", {
      userId: args.userId,
      youtubeVideoId: args.youtubeVideoId,
      language: args.language,
      versionId: args.versionId,
      updatedAt: now,
    });
  },
});

export const selectTranscriptVersion = mutation({
  args: {
    versionId: v.id("transcriptVersions"),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const version = await ctx.db.get(args.versionId);
    if (!version || version.userId !== userId) {
      throw new Error("Transcript version not found.");
    }

    const existing = await ctx.db
      .query("transcriptSelections")
      .withIndex("by_user_video_lang", (q) =>
        q
          .eq("userId", userId)
          .eq("youtubeVideoId", version.youtubeVideoId)
          .eq("language", version.language),
      )
      .first();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        versionId: version._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("transcriptSelections", {
        userId,
        youtubeVideoId: version.youtubeVideoId,
        language: version.language,
        versionId: version._id,
        updatedAt: now,
      });
    }

    return version._id;
  },
});
