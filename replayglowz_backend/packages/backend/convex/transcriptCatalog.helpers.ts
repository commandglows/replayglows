import {
  TRANSCRIPT_PROVIDER_CATALOG,
  type TranscriptProviderDefinition,
  type TranscriptSecretProvider,
} from "./transcriptProviders";

export type TranscriptSecretStatus = {
  provider: TranscriptSecretProvider;
  maskedValue?: string;
  updatedAt?: number;
};

export type TranscriptProviderCatalogRow = TranscriptProviderDefinition & {
  secretConfigured: boolean;
  workerConfigured: boolean;
  isAvailable: boolean;
  maskedSecret?: string;
  secretUpdatedAt?: number;
};

export function buildTranscriptProviderCatalog(
  secrets: TranscriptSecretStatus[],
  hasWorker: boolean
): TranscriptProviderCatalogRow[] {
  const secretMap = new Map(secrets.map((secret) => [secret.provider, secret]));

  return TRANSCRIPT_PROVIDER_CATALOG.map((provider) => {
    const secret = provider.secretProvider ? secretMap.get(provider.secretProvider) : null;
    const secretConfigured = Boolean(secret);
    const workerConfigured = provider.requiresWorker ? hasWorker : true;
    const isAvailable = provider.requiresSecret
      ? workerConfigured && secretConfigured
      : workerConfigured;

    return {
      ...provider,
      secretConfigured,
      workerConfigured,
      isAvailable,
      maskedSecret: secret?.maskedValue,
      secretUpdatedAt: secret?.updatedAt,
    };
  });
}
