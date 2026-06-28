export const TRANSCRIPT_PROVIDER_IDS = [
  "youtube_captions",
  "faster_whisper",
  "sensevoice",
  "openai_mini",
  "openai",
  "deepgram",
] as const;

export type TranscriptProviderId = (typeof TRANSCRIPT_PROVIDER_IDS)[number];

export type TranscriptSecretProvider = "openai" | "deepgram";

export interface TranscriptProviderDefinition {
  id: TranscriptProviderId;
  label: string;
  description: string;
  type: "free_remote" | "free_local" | "paid_api";
  requiresSecret: boolean;
  secretProvider?: TranscriptSecretProvider;
  requiresWorker: boolean;
  priceLabel: string;
  speedLabel: string;
  qualityLabel: string;
  recommendedUse: string;
  priceRank: number;
  speedRank: number;
  qualityRank: number;
}

export const DEFAULT_TRANSCRIPT_PROVIDER: TranscriptProviderId = "faster_whisper";

export const TRANSCRIPT_PROVIDER_CATALOG: TranscriptProviderDefinition[] = [
  {
    id: "youtube_captions",
    label: "YouTube captions",
    description: "Fastest option when captions are already published on YouTube.",
    type: "free_remote",
    requiresSecret: false,
    requiresWorker: false,
    priceLabel: "Free",
    speedLabel: "Very fast",
    qualityLabel: "Variable",
    recommendedUse: "First instant attempt before any audio transcription.",
    priceRank: 1,
    speedRank: 1,
    qualityRank: 5,
  },
  {
    id: "faster_whisper",
    label: "faster-whisper",
    description: "Local open-source default focused on cost control and solid quality.",
    type: "free_local",
    requiresSecret: false,
    requiresWorker: true,
    priceLabel: "Free (local compute)",
    speedLabel: "Fast",
    qualityLabel: "Good",
    recommendedUse: "Recommended default local fallback.",
    priceRank: 2,
    speedRank: 2,
    qualityRank: 4,
  },
  {
    id: "sensevoice",
    label: "SenseVoice",
    description: "Alternative local engine that can outperform Whisper-family models on some clips.",
    type: "free_local",
    requiresSecret: false,
    requiresWorker: true,
    priceLabel: "Free (local compute)",
    speedLabel: "Fast",
    qualityLabel: "Good to very good",
    recommendedUse: "Manual rerun when the default local result is weak.",
    priceRank: 2,
    speedRank: 2,
    qualityRank: 3,
  },
  {
    id: "openai_mini",
    label: "OpenAI mini",
    description: "Lower-cost premium provider using the user's OpenAI key.",
    type: "paid_api",
    requiresSecret: true,
    secretProvider: "openai",
    requiresWorker: true,
    priceLabel: "Billed by OpenAI; estimate configured in worker",
    speedLabel: "Very fast",
    qualityLabel: "Very good",
    recommendedUse: "Cheaper premium rerun when local quality is not enough.",
    priceRank: 3,
    speedRank: 1,
    qualityRank: 2,
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Highest-quality premium provider using the user's OpenAI key.",
    type: "paid_api",
    requiresSecret: true,
    secretProvider: "openai",
    requiresWorker: true,
    priceLabel: "Billed by OpenAI; estimate configured in worker",
    speedLabel: "Fast",
    qualityLabel: "Excellent",
    recommendedUse: "Premium rerun when quality matters most.",
    priceRank: 4,
    speedRank: 2,
    qualityRank: 1,
  },
  {
    id: "deepgram",
    label: "Deepgram",
    description: "Premium provider tuned for speed and difficult audio with the user's Deepgram key.",
    type: "paid_api",
    requiresSecret: true,
    secretProvider: "deepgram",
    requiresWorker: true,
    priceLabel: "~$0.0077/min+",
    speedLabel: "Very fast",
    qualityLabel: "Excellent",
    recommendedUse: "Premium rerun for noisy or multi-speaker audio.",
    priceRank: 5,
    speedRank: 1,
    qualityRank: 1,
  },
];

export const TRANSCRIPT_PROVIDER_OPTIONS = TRANSCRIPT_PROVIDER_CATALOG.map((provider) => provider.id);
