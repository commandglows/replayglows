import 'settings.dart';

class TranscriptProviderCatalogItem {
  const TranscriptProviderCatalogItem({
    required this.id,
    required this.label,
    required this.description,
    required this.type,
    required this.requiresSecret,
    this.secretProvider,
    required this.requiresWorker,
    required this.priceLabel,
    required this.speedLabel,
    required this.qualityLabel,
    required this.recommendedUse,
    required this.available,
    this.unavailableReason,
    this.maskedSecret,
  });

  final TranscriptProvider? id;
  final String label;
  final String description;
  final String type;
  final bool requiresSecret;
  final String? secretProvider;
  final bool requiresWorker;
  final String priceLabel;
  final String speedLabel;
  final String qualityLabel;
  final String recommendedUse;
  final bool available;
  final String? unavailableReason;
  final String? maskedSecret;

  factory TranscriptProviderCatalogItem.fromJson(Map<String, dynamic> json) {
    return TranscriptProviderCatalogItem(
      id: TranscriptProvider.fromJson(json['id']?.toString()),
      label: json['label']?.toString() ?? 'Transcript provider',
      description: json['description']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      requiresSecret: json['requiresSecret'] as bool? ?? false,
      secretProvider: json['secretProvider']?.toString(),
      requiresWorker: json['requiresWorker'] as bool? ?? false,
      priceLabel: json['priceLabel']?.toString() ?? '',
      speedLabel: json['speedLabel']?.toString() ?? '',
      qualityLabel: json['qualityLabel']?.toString() ?? '',
      recommendedUse: json['recommendedUse']?.toString() ?? '',
      available:
          json['isAvailable'] as bool? ?? json['available'] as bool? ?? false,
      unavailableReason:
          json['unavailableReason']?.toString() ??
          json['availabilityReason']?.toString(),
      maskedSecret:
          json['maskedSecret']?.toString() ?? json['maskedValue']?.toString(),
    );
  }
}

class TranscriptSecretStatus {
  const TranscriptSecretStatus({
    required this.provider,
    required this.maskedValue,
    this.updatedAt,
  });

  final String provider;
  final String maskedValue;
  final int? updatedAt;

  factory TranscriptSecretStatus.fromJson(Map<String, dynamic> json) {
    return TranscriptSecretStatus(
      provider: json['provider']?.toString() ?? '',
      maskedValue: json['maskedValue']?.toString() ?? '',
      updatedAt: (json['updatedAt'] as num?)?.toInt(),
    );
  }
}

class TranscriptVersion {
  const TranscriptVersion({
    required this.id,
    this.provider,
    required this.version,
    required this.status,
    required this.sourceType,
    this.estimatedCostUsd,
    required this.warnings,
    this.errorMessage,
    required this.previewText,
    required this.createdAt,
    required this.isActive,
  });

  final String id;
  final TranscriptProvider? provider;
  final int version;
  final String status;
  final String sourceType;
  final double? estimatedCostUsd;
  final List<String> warnings;
  final String? errorMessage;
  final String previewText;
  final int createdAt;
  final bool isActive;

  factory TranscriptVersion.fromJson(Map<String, dynamic> json) {
    return TranscriptVersion(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      provider: TranscriptProvider.fromJson(json['provider']?.toString()),
      version: (json['version'] as num?)?.toInt() ?? 1,
      status: json['status']?.toString() ?? 'unknown',
      sourceType: json['sourceType']?.toString() ?? '',
      estimatedCostUsd: (json['estimatedCostUsd'] as num?)?.toDouble(),
      warnings:
          (json['warnings'] as List?)
              ?.map((item) => item.toString())
              .toList(growable: false) ??
          const [],
      errorMessage: json['errorMessage']?.toString(),
      previewText: json['previewText']?.toString() ?? '',
      createdAt: (json['createdAt'] as num?)?.toInt() ?? 0,
      isActive: json['isActive'] as bool? ?? false,
    );
  }
}

class TranscriptJob {
  const TranscriptJob({
    required this.id,
    this.provider,
    required this.status,
    this.progressMessage,
    this.errorMessage,
    this.versionId,
    required this.createdAt,
    required this.updatedAt,
    this.startedAt,
    this.finishedAt,
  });

  final String id;
  final TranscriptProvider? provider;
  final String status;
  final String? progressMessage;
  final String? errorMessage;
  final String? versionId;
  final int createdAt;
  final int updatedAt;
  final int? startedAt;
  final int? finishedAt;

  bool get isRunning => status == 'queued' || status == 'running';

  factory TranscriptJob.fromJson(Map<String, dynamic> json) {
    return TranscriptJob(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      provider: TranscriptProvider.fromJson(json['provider']?.toString()),
      status: json['status']?.toString() ?? 'unknown',
      progressMessage: json['progressMessage']?.toString(),
      errorMessage: json['errorMessage']?.toString(),
      versionId: json['versionId']?.toString(),
      createdAt: (json['createdAt'] as num?)?.toInt() ?? 0,
      updatedAt: (json['updatedAt'] as num?)?.toInt() ?? 0,
      startedAt: (json['startedAt'] as num?)?.toInt(),
      finishedAt: (json['finishedAt'] as num?)?.toInt(),
    );
  }
}
