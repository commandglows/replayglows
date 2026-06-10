"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireReplayGlowzAccess } from "./access";
import { type TranscriptProviderId } from "./transcriptProviders";
import {
  normalizeWorkerEntries,
  resolveAutomaticTranscriptProviders,
  type TranscriptEntry,
} from "./transcriptGeneration.helpers";

type NormalizedTranscript = {
  provider: TranscriptProviderId;
  language: string;
  sourceType: "captions" | "audio";
  entries: TranscriptEntry[];
  fullText: string;
  estimatedCostUsd?: number;
  warnings?: string[];
};

const transcriptProviderValidator = v.union(
  v.literal("youtube_captions"),
  v.literal("faster_whisper"),
  v.literal("sensevoice"),
  v.literal("openai_mini"),
  v.literal("openai"),
  v.literal("deepgram")
);

function providerSecretProvider(provider: TranscriptProviderId) {
  if (provider === "openai" || provider === "openai_mini") return "openai" as const;
  if (provider === "deepgram") return "deepgram" as const;
  return null;
}

function defaultFullText(entries: TranscriptEntry[]) {
  return entries.map((entry) => entry.text).join(" ").trim();
}

async function callWorker(
  provider: TranscriptProviderId,
  youtubeVideoId: string,
  language: string,
  apiKey?: string
): Promise<NormalizedTranscript> {
  const workerUrl = process.env.TRANSCRIPT_WORKER_URL;
  if (!workerUrl) {
    throw new Error("Local transcript worker is not configured.");
  }

  const response = await fetch(`${workerUrl.replace(/\/$/, "")}/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.TRANSCRIPT_WORKER_SECRET
        ? { Authorization: `Bearer ${process.env.TRANSCRIPT_WORKER_SECRET}` }
        : {}),
    },
    body: JSON.stringify({
      provider,
      youtubeVideoId,
      language,
      apiKey,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Transcript worker failed for provider ${provider}.`);
  }

  const payload = (await response.json()) as {
    entries?: unknown;
    fullText?: string;
    estimatedCostUsd?: number;
    warnings?: string[];
  };

  const entries = normalizeWorkerEntries(payload.entries);
  if (entries.length === 0) {
    throw new Error(`Transcript worker returned no transcript for provider ${provider}.`);
  }

  return {
    provider,
    language,
    sourceType: "audio",
    entries,
    fullText: payload.fullText?.trim() || defaultFullText(entries),
    estimatedCostUsd: payload.estimatedCostUsd,
    warnings: payload.warnings ?? [],
  };
}

async function fetchYouTubeCaptions(
  youtubeVideoId: string,
  language: string
): Promise<NormalizedTranscript> {
  const { getSubtitles } = await import("youtube-captions-scraper");
  const subtitles = await getSubtitles({
    videoID: youtubeVideoId,
    lang: language,
  });

  const entries = subtitles.map((sub) => ({
    start: typeof sub.start === "string" ? parseFloat(sub.start) : sub.start,
    duration: typeof sub.dur === "string" ? parseFloat(sub.dur) : sub.dur,
    text: sub.text,
  }));

  if (entries.length === 0) {
    throw new Error("YouTube captions are unavailable for this video.");
  }

  return {
    provider: "youtube_captions",
    language,
    sourceType: "captions",
    entries,
    fullText: defaultFullText(entries),
    warnings: [],
  };
}

async function runProvider(
  ctx: any,
  userId: string,
  provider: TranscriptProviderId,
  youtubeVideoId: string,
  language: string
): Promise<NormalizedTranscript> {
  if (provider === "youtube_captions") {
    return await fetchYouTubeCaptions(youtubeVideoId, language);
  }

  const secretProvider = providerSecretProvider(provider);
  let apiKey: string | undefined;
  if (secretProvider) {
    const stored = await ctx.runQuery(internal.transcriptSecrets.getDecryptedSecret, {
      userId,
      provider: secretProvider,
    });
    if (!stored?.apiKey) {
      throw new Error(`Missing ${secretProvider} API key for transcript provider ${provider}.`);
    }
    apiKey = stored.apiKey;
  }

  return await callWorker(provider, youtubeVideoId, language, apiKey);
}

export const generateTranscript = action({
  args: {
    youtubeVideoId: v.string(),
    language: v.optional(v.string()),
    provider: v.optional(transcriptProviderValidator),
    force: v.optional(v.boolean()),
    activate: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ versionId: any; reused: boolean; provider: TranscriptProviderId }> => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const language = args.language || "en";
    const force = args.force ?? false;
    const activate = args.activate ?? true;
    const transcriptSettings = await ctx.runQuery(internal.transcripts.getTranscriptSettings, { userId });
    const providerCatalog = await ctx.runQuery(internal.transcripts.getProviderCatalogInternal, { userId });

    const providersToTry = args.provider
      ? [args.provider]
      : resolveAutomaticTranscriptProviders(transcriptSettings);
    if (providersToTry.length === 0) {
      throw new Error("No transcript provider is configured.");
    }

    let lastError: Error | null = null;

    for (const provider of providersToTry) {
      const providerInfo = providerCatalog.find((item: { id: string }) => item.id === provider);
      if (!providerInfo) {
        lastError = new Error(`Unknown transcript provider: ${provider}.`);
        continue;
      }

      if (!force) {
        const existing: any = await ctx.runQuery(internal.transcripts.getLatestVersionForProvider, {
          userId,
          youtubeVideoId: args.youtubeVideoId,
          language,
          provider,
        });
        if (existing) {
          if (activate) {
            await ctx.runMutation(internal.transcripts.upsertSelection, {
              userId,
              youtubeVideoId: args.youtubeVideoId,
              language,
              versionId: existing._id,
            });
          }
          return { versionId: existing._id, reused: true, provider };
        }
      }

      if (!providerInfo.isAvailable) {
        lastError = new Error(`${providerInfo.label} is not configured.`);
        if (args.provider) break;
        continue;
      }

      const jobId = await ctx.runMutation(internal.transcripts.createJob, {
        userId,
        youtubeVideoId: args.youtubeVideoId,
        language,
        provider,
      });

      await ctx.runMutation(internal.transcripts.updateJob, {
        jobId,
        status: "running",
        progressMessage: `Generating transcript with ${providerInfo.label}`,
        startedAt: Date.now(),
      });

      try {
        const transcript = await runProvider(ctx, userId, provider, args.youtubeVideoId, language);
        const versionId: any = await ctx.runMutation(internal.transcripts.createVersion, {
          userId,
          youtubeVideoId: args.youtubeVideoId,
          language,
          provider,
          sourceType: transcript.sourceType,
          entries: transcript.entries,
          fullText: transcript.fullText,
          estimatedCostUsd: transcript.estimatedCostUsd,
          warnings: transcript.warnings,
        });

        if (activate) {
          await ctx.runMutation(internal.transcripts.upsertSelection, {
            userId,
            youtubeVideoId: args.youtubeVideoId,
            language,
            versionId,
          });
        }

        await ctx.runMutation(internal.transcripts.updateJob, {
          jobId,
          status: "completed",
          progressMessage: `${providerInfo.label} transcript ready`,
          versionId,
          finishedAt: Date.now(),
        });

        return { versionId, reused: false, provider };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await ctx.runMutation(internal.transcripts.updateJob, {
          jobId,
          status: "failed",
          errorMessage: message,
          finishedAt: Date.now(),
        });
        lastError = error instanceof Error ? error : new Error(message);
        if (args.provider) break;
      }
    }

    throw lastError ?? new Error("Failed to generate transcript.");
  },
});
