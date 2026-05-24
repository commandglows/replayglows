/// Model representing a YouTube playlist cached from the user's account.
///
/// Maps to the `youtubePlaylistsCache` table in Convex, with additional
/// computed fields used by the Flutter UI.
class YouTubePlaylist {
  /// Convex document ID (`_id`).
  final String id;

  /// YouTube playlist ID (e.g. "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf").
  final String youtubePlaylistId;

  /// Playlist title.
  final String title;

  /// Playlist description.
  final String? description;

  /// Default thumbnail URL from YouTube.
  final String? thumbnailUrl;

  /// User-chosen custom thumbnail URL (overrides [thumbnailUrl] when set).
  final String? customThumbnailUrl;

  /// Current number of videos in the local cache.
  final int videoCount;

  /// Original video count as reported by YouTube API.
  final int originalVideoCount;

  /// YouTube privacy status (e.g. "public", "private", "unlisted").
  final String privacyStatus;

  /// ISO 8601 publish date from YouTube.
  final String? publishedAt;

  /// Timestamp (ms since epoch) of the most recently added video.
  final int? lastVideoAddedAt;

  /// Timestamp (ms since epoch) when this entry was cached.
  final int cachedAt;

  /// Whether the cached data is considered stale and should be refreshed.
  final bool isStale;

  /// Hex color code for playlist theming (e.g. "#8b5cf6").
  final String? color;

  const YouTubePlaylist({
    required this.id,
    required this.youtubePlaylistId,
    required this.title,
    this.description,
    this.thumbnailUrl,
    this.customThumbnailUrl,
    required this.videoCount,
    required this.originalVideoCount,
    required this.privacyStatus,
    this.publishedAt,
    this.lastVideoAddedAt,
    required this.cachedAt,
    required this.isStale,
    this.color,
  });

  /// Returns the best available thumbnail: custom first, then YouTube default.
  String? get effectiveThumbnailUrl => customThumbnailUrl ?? thumbnailUrl;

  factory YouTubePlaylist.fromJson(Map<String, dynamic> json) {
    final youtubePlaylistId =
        _optionalString(json['youtubePlaylistId']) ??
        _optionalString(json['id']) ??
        '';
    final videoCount = _intValue(json['videoCount']);

    return YouTubePlaylist(
      id:
          _optionalString(json['_id']) ??
          _optionalString(json['id']) ??
          youtubePlaylistId,
      youtubePlaylistId: youtubePlaylistId,
      title: _optionalString(json['title']) ?? 'Untitled playlist',
      description: _optionalString(json['description']),
      thumbnailUrl: _optionalString(json['thumbnailUrl']),
      customThumbnailUrl: _optionalString(json['customThumbnailUrl']),
      videoCount: videoCount,
      originalVideoCount:
          _optionalInt(json['originalVideoCount']) ?? videoCount,
      privacyStatus: _optionalString(json['privacyStatus']) ?? 'private',
      publishedAt: _optionalString(json['publishedAt']),
      lastVideoAddedAt: _optionalEpochMs(json['lastVideoAddedAt']),
      cachedAt: _intValue(json['cachedAt']),
      isStale: json['isStale'] as bool? ?? false,
      color: _optionalString(json['color']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'youtubePlaylistId': youtubePlaylistId,
      'title': title,
      if (description != null) 'description': description,
      if (thumbnailUrl != null) 'thumbnailUrl': thumbnailUrl,
      if (customThumbnailUrl != null) 'customThumbnailUrl': customThumbnailUrl,
      'videoCount': videoCount,
      'originalVideoCount': originalVideoCount,
      'privacyStatus': privacyStatus,
      if (publishedAt != null) 'publishedAt': publishedAt,
      if (lastVideoAddedAt != null) 'lastVideoAddedAt': lastVideoAddedAt,
      'cachedAt': cachedAt,
      'isStale': isStale,
      if (color != null) 'color': color,
    };
  }

  YouTubePlaylist copyWith({
    String? id,
    String? youtubePlaylistId,
    String? title,
    String? description,
    String? thumbnailUrl,
    String? customThumbnailUrl,
    int? videoCount,
    int? originalVideoCount,
    String? privacyStatus,
    String? publishedAt,
    int? lastVideoAddedAt,
    int? cachedAt,
    bool? isStale,
    String? color,
  }) {
    return YouTubePlaylist(
      id: id ?? this.id,
      youtubePlaylistId: youtubePlaylistId ?? this.youtubePlaylistId,
      title: title ?? this.title,
      description: description ?? this.description,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      customThumbnailUrl: customThumbnailUrl ?? this.customThumbnailUrl,
      videoCount: videoCount ?? this.videoCount,
      originalVideoCount: originalVideoCount ?? this.originalVideoCount,
      privacyStatus: privacyStatus ?? this.privacyStatus,
      publishedAt: publishedAt ?? this.publishedAt,
      lastVideoAddedAt: lastVideoAddedAt ?? this.lastVideoAddedAt,
      cachedAt: cachedAt ?? this.cachedAt,
      isStale: isStale ?? this.isStale,
      color: color ?? this.color,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is YouTubePlaylist &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'YouTubePlaylist(id: $id, title: $title)';
}

String? _optionalString(Object? value) {
  if (value == null) return null;
  final string = value.toString();
  return string.isEmpty ? null : string;
}

int _intValue(Object? value) => _optionalInt(value) ?? 0;

int? _optionalInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

int? _optionalEpochMs(Object? value) {
  final integer = _optionalInt(value);
  if (integer != null) return integer;

  final string = _optionalString(value);
  if (string == null) return null;

  return DateTime.tryParse(string)?.millisecondsSinceEpoch;
}
