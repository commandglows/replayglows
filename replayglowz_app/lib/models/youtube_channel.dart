class YouTubeChannel {
  const YouTubeChannel({
    required this.youtubeChannelId,
    required this.title,
    this.description,
    this.thumbnailUrl,
  });

  final String youtubeChannelId;
  final String title;
  final String? description;
  final String? thumbnailUrl;

  factory YouTubeChannel.fromJson(Map<String, dynamic> json) {
    return YouTubeChannel(
      youtubeChannelId: json['youtubeChannelId']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Untitled channel',
      description: json['description']?.toString(),
      thumbnailUrl: json['thumbnailUrl']?.toString(),
    );
  }
}

class ChannelPlaylistLink {
  const ChannelPlaylistLink({
    required this.id,
    required this.youtubeChannelId,
    required this.channelTitle,
    required this.youtubePlaylistId,
    required this.linkedAt,
    this.lastSyncedAt,
    required this.isActive,
  });

  final String id;
  final String youtubeChannelId;
  final String channelTitle;
  final String youtubePlaylistId;
  final int linkedAt;
  final int? lastSyncedAt;
  final bool isActive;

  factory ChannelPlaylistLink.fromJson(Map<String, dynamic> json) {
    return ChannelPlaylistLink(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      youtubeChannelId: json['youtubeChannelId']?.toString() ?? '',
      channelTitle: json['channelTitle']?.toString() ?? 'Untitled channel',
      youtubePlaylistId: json['youtubePlaylistId']?.toString() ?? '',
      linkedAt: (json['linkedAt'] as num?)?.toInt() ?? 0,
      lastSyncedAt: (json['lastSyncedAt'] as num?)?.toInt(),
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}

class ChannelSyncResult {
  const ChannelSyncResult({
    required this.addedCount,
    required this.totalMatching,
    required this.errors,
    this.quotaUsed,
    this.remainingQuota,
    this.quotaExhausted = false,
    this.limitedByQuota = false,
    this.message,
  });

  final int addedCount;
  final int totalMatching;
  final List<String> errors;
  final int? quotaUsed;
  final int? remainingQuota;
  final bool quotaExhausted;
  final bool limitedByQuota;
  final String? message;

  factory ChannelSyncResult.fromJson(Map<String, dynamic> json) {
    return ChannelSyncResult(
      addedCount: (json['addedCount'] as num?)?.toInt() ?? 0,
      totalMatching: (json['totalMatching'] as num?)?.toInt() ?? 0,
      errors:
          (json['errors'] as List?)
              ?.map((item) => item.toString())
              .toList(growable: false) ??
          const [],
      quotaUsed: (json['quotaUsed'] as num?)?.toInt(),
      remainingQuota: (json['remainingQuota'] as num?)?.toInt(),
      quotaExhausted: json['quotaExhausted'] as bool? ?? false,
      limitedByQuota: json['limitedByQuota'] as bool? ?? false,
      message: json['message']?.toString(),
    );
  }
}
