import { DEFAULT_TRANSCRIPT_PROVIDER, type TranscriptProviderId } from "./transcriptProviders";

export type TranscriptEntry = {
  start: number;
  duration: number;
  text: string;
  speaker?: string;
};

export type TranscriptSettingsSnapshot = {
  defaultProvider?: TranscriptProviderId;
  autoAttemptYoutubeCaptions?: boolean;
  autoAttemptLocalFallback?: boolean;
};

export function normalizeWorkerEntries(rawEntries: unknown): TranscriptEntry[] {
  if (!Array.isArray(rawEntries)) return [];

  const normalized: TranscriptEntry[] = [];
  for (const entry of rawEntries) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as {
      start?: number | string;
      duration?: number | string;
      text?: string;
      speaker?: string;
    };
    if (candidate.text === undefined || candidate.start === undefined || candidate.duration === undefined) {
      continue;
    }

    const start =
      typeof candidate.start === "string" ? Number.parseFloat(candidate.start) : candidate.start;
    const duration =
      typeof candidate.duration === "string"
        ? Number.parseFloat(candidate.duration)
        : candidate.duration;

    if (Number.isNaN(start) || Number.isNaN(duration)) continue;

    normalized.push({
      start,
      duration,
      text: candidate.text,
      ...(candidate.speaker ? { speaker: candidate.speaker } : {}),
    });
  }

  return normalized;
}

export function resolveAutomaticTranscriptProviders(
  transcriptSettings: TranscriptSettingsSnapshot
): TranscriptProviderId[] {
  const automaticProviders: TranscriptProviderId[] = [];

  if (transcriptSettings.autoAttemptYoutubeCaptions !== false) {
    automaticProviders.push("youtube_captions");
  }

  const preferredProvider = transcriptSettings.defaultProvider || DEFAULT_TRANSCRIPT_PROVIDER;
  const fallbackProvider =
    preferredProvider === "youtube_captions" ? DEFAULT_TRANSCRIPT_PROVIDER : preferredProvider;

  if (
    transcriptSettings.autoAttemptLocalFallback !== false &&
    fallbackProvider &&
    !automaticProviders.includes(fallbackProvider)
  ) {
    automaticProviders.push(fallbackProvider);
  }

  return automaticProviders;
}
