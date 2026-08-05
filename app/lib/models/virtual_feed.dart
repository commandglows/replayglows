import 'video.dart';

/// Models for ReplayGlows virtual Feed aggregators.
///
/// A virtual Feed is a local playlist-like resource owned by the user that
/// aggregates YouTube videos from cached YouTube channels, playlists and the
/// existing subscriptions cache without mutating YouTube resources.
class VirtualFeed {
  final String id;
  final String userId;
  final String title;
  final String? description;
  final bool includeWatched;
  final String sortOrder;
  final String? color;
  final String? icon;
  final bool isActive;
  final int createdAt;
  final int updatedAt;
  final int sourceCount;
  final int activeSourceCount;

  const VirtualFeed({
    required this.id,
    required this.userId,
    required this.title,
    this.description,
    required this.includeWatched,
    required this.sortOrder,
    this.color,
    this.icon,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
    this.sourceCount = 0,
    this.activeSourceCount = 0,
  });

  factory VirtualFeed.fromJson(Map<String, dynamic> json) {
    return VirtualFeed(
      id: _optionalString(json['_id']) ?? _optionalString(json['id']) ?? '',
      userId: _optionalString(json['userId']) ?? '',
      title: _optionalString(json['title']) ?? 'Untitled Feed',
      description: _optionalString(json['description']),
      includeWatched: json['includeWatched'] as bool? ?? false,
      sortOrder: _optionalString(json['sortOrder']) ?? 'default',
      color: _optionalString(json['color']),
      icon: _optionalString(json['icon']),
      isActive: json['isActive'] as bool? ?? true,
      createdAt: _intValue(json['createdAt']),
      updatedAt: _intValue(json['updatedAt']),
      sourceCount: _intValue(json['sourceCount']),
      activeSourceCount: _intValue(json['activeSourceCount']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'userId': userId,
      'title': title,
      if (description != null) 'description': description,
      'includeWatched': includeWatched,
      'sortOrder': sortOrder,
      if (color != null) 'color': color,
      if (icon != null) 'icon': icon,
      'isActive': isActive,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'sourceCount': sourceCount,
      'activeSourceCount': activeSourceCount,
    };
  }

  VirtualFeed copyWith({
    String? title,
    String? description,
    bool? includeWatched,
    String? sortOrder,
    String? color,
    String? icon,
    bool? isActive,
  }) {
    return VirtualFeed(
      id: id,
      userId: userId,
      title: title ?? this.title,
      description: description ?? this.description,
      includeWatched: includeWatched ?? this.includeWatched,
      sortOrder: sortOrder ?? this.sortOrder,
      color: color ?? this.color,
      icon: icon ?? this.icon,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt,
      updatedAt: updatedAt,
      sourceCount: sourceCount,
      activeSourceCount: activeSourceCount,
    );
  }

  bool get isReplayGlowsFeed => true;

  String get initials => title.isEmpty
      ? 'F'
      : title.trim().split(' ').where((part) => part.isNotEmpty).isEmpty
      ? 'F'
      : title
            .trim()
            .split(' ')
            .where((part) => part.isNotEmpty)
            .first[0]
            .toUpperCase();

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is VirtualFeed &&
          id == other.id &&
          runtimeType == other.runtimeType;

  @override
  int get hashCode => id.hashCode;
}

class VirtualFeedSource {
  final String id;
  final String userId;
  final String virtualFeedId;
  final String sourceType;
  final String sourceId;
  final String sourceTitle;
  final bool isActive;
  final int position;
  final int createdAt;
  final int updatedAt;
  final bool isAvailable;
  final bool isStale;
  final String? staleReason;
  final int videoCount;

  const VirtualFeedSource({
    required this.id,
    required this.userId,
    required this.virtualFeedId,
    required this.sourceType,
    required this.sourceId,
    required this.sourceTitle,
    required this.isActive,
    required this.position,
    required this.createdAt,
    required this.updatedAt,
    required this.isAvailable,
    required this.isStale,
    this.staleReason,
    this.videoCount = 0,
  });

  factory VirtualFeedSource.fromJson(Map<String, dynamic> json) {
    return VirtualFeedSource(
      id: _optionalString(json['_id']) ?? _optionalString(json['id']) ?? '',
      userId: _optionalString(json['userId']) ?? '',
      virtualFeedId: _optionalString(json['virtualFeedId']) ?? '',
      sourceType: _optionalString(json['sourceType']) ?? 'playlist',
      sourceId: _optionalString(json['sourceId']) ?? '',
      sourceTitle: _optionalString(json['sourceTitle']) ?? 'Untitled source',
      isActive: json['isActive'] as bool? ?? true,
      position: _intValue(json['position']),
      createdAt: _intValue(json['createdAt']),
      updatedAt: _intValue(json['updatedAt']),
      isAvailable: json['isAvailable'] as bool? ?? true,
      isStale: json['isStale'] as bool? ?? false,
      staleReason: _optionalString(json['staleReason']),
      videoCount: _intValue(json['videoCount']),
    );
  }

  bool get isSubscriptionSource => sourceType == 'subscriptions';

  bool get isChannelSource => sourceType == 'channel';

  bool get isPlaylistSource => sourceType == 'playlist';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is VirtualFeedSource &&
          id == other.id &&
          runtimeType == other.runtimeType;

  @override
  int get hashCode => id.hashCode;
}

class VirtualFeedStats {
  final int sourceCount;
  final int activeSourceCount;
  final int staleSourceCount;
  final int matchedVideoCount;

  const VirtualFeedStats({
    required this.sourceCount,
    required this.activeSourceCount,
    required this.staleSourceCount,
    required this.matchedVideoCount,
  });

  factory VirtualFeedStats.fromJson(Map<String, dynamic> json) {
    return VirtualFeedStats(
      sourceCount: _intValue(json['sourceCount']),
      activeSourceCount: _intValue(json['activeSourceCount']),
      staleSourceCount: _intValue(json['staleSourceCount']),
      matchedVideoCount: _intValue(json['matchedVideoCount']),
    );
  }

  static const empty = VirtualFeedStats(
    sourceCount: 0,
    activeSourceCount: 0,
    staleSourceCount: 0,
    matchedVideoCount: 0,
  );
}

class VirtualFeedDetails {
  const VirtualFeedDetails({
    this.feed,
    required this.videos,
    required this.sources,
    required this.stats,
    required this.isDone,
    this.continueCursor,
    required this.sortOrder,
  });

  final VirtualFeed? feed;
  final List<YouTubeVideo> videos;
  final List<VirtualFeedSource> sources;
  final VirtualFeedStats stats;
  final bool isDone;
  final String? continueCursor;
  final String sortOrder;

  static const empty = VirtualFeedDetails(
    videos: <YouTubeVideo>[],
    sources: <VirtualFeedSource>[],
    stats: VirtualFeedStats.empty,
    isDone: true,
    continueCursor: null,
    sortOrder: 'default',
  );

  factory VirtualFeedDetails.fromJson(Map<String, dynamic> json) {
    final feedRaw = json['feed'];
    final feed = feedRaw is Map ? VirtualFeed.fromJson(_asMap(feedRaw)) : null;
    final videos = <YouTubeVideo>[];
    final sources = <VirtualFeedSource>[];

    final videosRaw = json['videos'];
    if (videosRaw is List) {
      for (final entry in videosRaw) {
        if (entry is Map<String, dynamic>) {
          videos.add(YouTubeVideo.fromJson(entry));
        }
      }
    }

    final sourcesRaw = json['sources'];
    if (sourcesRaw is List) {
      for (final entry in sourcesRaw) {
        if (entry is Map<String, dynamic>) {
          sources.add(VirtualFeedSource.fromJson(entry));
        }
      }
    }

    final statsRaw = json['stats'];
    final stats = statsRaw is Map
        ? VirtualFeedStats.fromJson(_asMap(statsRaw))
        : VirtualFeedStats.empty;

    return VirtualFeedDetails(
      feed: feed,
      videos: videos,
      sources: sources,
      stats: stats,
      isDone: json['isDone'] as bool? ?? true,
      continueCursor: _optionalString(json['continueCursor']),
      sortOrder: _optionalString(json['sortOrder']) ?? 'default',
    );
  }

  bool get hasFeed => feed != null;
}

class PlaylistChannelCandidate {
  const PlaylistChannelCandidate({
    required this.youtubeChannelId,
    required this.title,
    this.thumbnailUrl,
    required this.videoCount,
    required this.alreadyAdded,
    required this.isSubscribed,
  });

  final String youtubeChannelId;
  final String title;
  final String? thumbnailUrl;
  final int videoCount;
  final bool alreadyAdded;
  final bool isSubscribed;

  factory PlaylistChannelCandidate.fromJson(Map<String, dynamic> json) {
    return PlaylistChannelCandidate(
      youtubeChannelId: _optionalString(json['youtubeChannelId']) ?? '',
      title: _optionalString(json['title']) ?? 'Untitled channel',
      thumbnailUrl: _optionalString(json['thumbnailUrl']),
      videoCount: _intValue(json['videoCount']),
      alreadyAdded: json['alreadyAdded'] as bool? ?? false,
      isSubscribed: json['isSubscribed'] as bool? ?? false,
    );
  }
}

class PlaylistChannelCandidatesResult {
  const PlaylistChannelCandidatesResult({
    required this.youtubePlaylistId,
    required this.playlistTitle,
    required this.playlistVideoCount,
    required this.candidates,
    required this.missingMetadataCount,
    required this.totalVideoCount,
  });

  final String youtubePlaylistId;
  final String playlistTitle;
  final int playlistVideoCount;
  final List<PlaylistChannelCandidate> candidates;
  final int missingMetadataCount;
  final int totalVideoCount;

  static const empty = PlaylistChannelCandidatesResult(
    youtubePlaylistId: '',
    playlistTitle: '',
    playlistVideoCount: 0,
    candidates: <PlaylistChannelCandidate>[],
    missingMetadataCount: 0,
    totalVideoCount: 0,
  );

  factory PlaylistChannelCandidatesResult.fromJson(Map<String, dynamic> json) {
    final playlistRaw = json['playlist'];
    final playlist = playlistRaw is Map
        ? _asMap(playlistRaw)
        : <String, dynamic>{};
    final candidates = <PlaylistChannelCandidate>[];
    final rawCandidates = json['candidates'];
    if (rawCandidates is List) {
      for (final entry in rawCandidates) {
        if (entry is Map) {
          candidates.add(PlaylistChannelCandidate.fromJson(_asMap(entry)));
        }
      }
    }

    return PlaylistChannelCandidatesResult(
      youtubePlaylistId: _optionalString(playlist['youtubePlaylistId']) ?? '',
      playlistTitle: _optionalString(playlist['title']) ?? '',
      playlistVideoCount: _intValue(playlist['videoCount']),
      candidates: candidates,
      missingMetadataCount: _intValue(json['missingMetadataCount']),
      totalVideoCount: _intValue(json['totalVideoCount']),
    );
  }
}

class AddVirtualFeedSourcesResult {
  const AddVirtualFeedSourcesResult({
    required this.addedCount,
    required this.alreadyAddedCount,
    required this.rejectedCount,
  });

  final int addedCount;
  final int alreadyAddedCount;
  final int rejectedCount;

  factory AddVirtualFeedSourcesResult.fromJson(Map<String, dynamic> json) {
    return AddVirtualFeedSourcesResult(
      addedCount: _intValue(json['addedCount']),
      alreadyAddedCount: _intValue(json['alreadyAddedCount']),
      rejectedCount: _intValue(json['rejectedCount']),
    );
  }
}

class PlaylistChannelMetadataBackfillResult {
  const PlaylistChannelMetadataBackfillResult({
    required this.updatedCount,
    required this.requestedVideoCount,
    required this.unresolvedCount,
    required this.remainingMissingCount,
    required this.quotaUnits,
  });

  final int updatedCount;
  final int requestedVideoCount;
  final int unresolvedCount;
  final int remainingMissingCount;
  final int quotaUnits;

  factory PlaylistChannelMetadataBackfillResult.fromJson(
    Map<String, dynamic> json,
  ) {
    return PlaylistChannelMetadataBackfillResult(
      updatedCount: _intValue(json['updatedCount']),
      requestedVideoCount: _intValue(json['requestedVideoCount']),
      unresolvedCount: _intValue(json['unresolvedCount']),
      remainingMissingCount: _intValue(json['remainingMissingCount']),
      quotaUnits: _intValue(json['quotaUnits']),
    );
  }
}

String? _optionalString(Object? value) {
  if (value == null) return null;
  final text = value.toString();
  return text.isEmpty ? null : text;
}

int _intValue(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

Map<String, dynamic> _asMap(Object value) {
  return value is Map<String, dynamic> ? value : <String, dynamic>{};
}
