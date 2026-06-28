import 'dart:convert';

import 'package:replayglowz_app/utils/duration_utils.dart';

enum ShortFormVideoFilter { all, excludeShorts, onlyShorts }

/// Model representing a YouTube video cached from a user's playlist.
///
/// Maps to the `youtubeVideosCache` table in Convex, with additional
/// denormalized fields from the parent playlist for display convenience.
class YouTubeVideo {
  /// Convex document ID (`_id`).
  final String id;

  /// YouTube video ID (e.g. "dQw4w9WgXcQ").
  final String youtubeVideoId;

  /// ID of the playlist this video belongs to.
  final String playlistId;

  /// YouTube playlist item ID (required for remove/move operations).
  final String? playlistItemId;

  /// Video title.
  final String title;

  /// Video description (may be truncated by YouTube API).
  final String? description;

  /// URL of the video thumbnail.
  final String? thumbnailUrl;

  /// Best known thumbnail dimensions when provided by the backend.
  final int? thumbnailWidth;
  final int? thumbnailHeight;

  /// Name of the YouTube channel that uploaded this video.
  final String channelTitle;

  /// Thumbnail URL of the uploading channel.
  final String? channelThumbnailUrl;

  /// YouTube channel ID of the uploader.
  final String? youtubeChannelId;

  /// ISO 8601 duration string (e.g. "PT5M30S").
  final String? duration;

  /// ISO 8601 publish date from YouTube.
  final String? publishedAt;

  /// Backend-derived short-form classification and score when available.
  final bool? isShortForm;
  final int? shortFormSignalScoreOverride;

  /// Timestamp (ms since epoch) when this entry was cached.
  final int cachedAt;

  /// Hex color code inherited from the parent playlist (e.g. "#8b5cf6").
  final String? playlistColor;

  /// Title of the parent playlist (denormalized for display).
  final String? playlistTitle;

  /// Virtual feed source metadata, present on virtual feed detail responses.
  final String? feedSourceType;
  final String? feedSourceId;
  final String? feedSourceTitle;

  const YouTubeVideo({
    required this.id,
    required this.youtubeVideoId,
    required this.playlistId,
    this.playlistItemId,
    required this.title,
    this.description,
    this.thumbnailUrl,
    this.thumbnailWidth,
    this.thumbnailHeight,
    required this.channelTitle,
    this.channelThumbnailUrl,
    this.youtubeChannelId,
    this.duration,
    this.publishedAt,
    this.isShortForm,
    this.shortFormSignalScoreOverride,
    required this.cachedAt,
    this.playlistColor,
    this.playlistTitle,
    this.feedSourceType,
    this.feedSourceId,
    this.feedSourceTitle,
  });

  factory YouTubeVideo.fromJson(Map<String, dynamic> json) {
    final youtubeVideoId =
        _optionalString(json['youtubeVideoId']) ??
        _optionalString(json['id']) ??
        '';

    return YouTubeVideo(
      id:
          _optionalString(json['_id']) ??
          _optionalString(json['id']) ??
          youtubeVideoId,
      youtubeVideoId: youtubeVideoId,
      playlistId:
          _optionalString(json['youtubePlaylistId']) ??
          _optionalString(json['playlistId']) ??
          '',
      playlistItemId: _optionalString(json['playlistItemId']),
      title: _optionalString(json['title']) ?? 'Untitled video',
      description: _optionalString(json['description']),
      thumbnailUrl: _optionalString(json['thumbnailUrl']),
      thumbnailWidth: _intOrNull(json['thumbnailWidth']),
      thumbnailHeight: _intOrNull(json['thumbnailHeight']),
      channelTitle: _optionalString(json['channelTitle']) ?? '',
      channelThumbnailUrl: _optionalString(json['channelThumbnailUrl']),
      youtubeChannelId: _optionalString(json['youtubeChannelId']),
      duration: _optionalString(json['duration']),
      publishedAt: _optionalString(json['publishedAt']),
      isShortForm: json['isShortForm'] as bool?,
      shortFormSignalScoreOverride: _intOrNull(json['shortFormSignalScore']),
      cachedAt: _intValue(json['cachedAt']),
      playlistColor: _optionalString(json['playlistColor']),
      playlistTitle: _optionalString(json['playlistTitle']),
      feedSourceType: _optionalString(json['feedSourceType']),
      feedSourceId: _optionalString(json['feedSourceId']),
      feedSourceTitle: _optionalString(json['feedSourceTitle']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'youtubeVideoId': youtubeVideoId,
      'youtubePlaylistId': playlistId,
      if (playlistItemId != null) 'playlistItemId': playlistItemId,
      'title': title,
      if (description != null) 'description': description,
      if (thumbnailUrl != null) 'thumbnailUrl': thumbnailUrl,
      if (thumbnailWidth != null) 'thumbnailWidth': thumbnailWidth,
      if (thumbnailHeight != null) 'thumbnailHeight': thumbnailHeight,
      'channelTitle': channelTitle,
      if (channelThumbnailUrl != null)
        'channelThumbnailUrl': channelThumbnailUrl,
      if (youtubeChannelId != null) 'youtubeChannelId': youtubeChannelId,
      if (duration != null) 'duration': duration,
      if (publishedAt != null) 'publishedAt': publishedAt,
      if (isShortForm != null) 'isShortForm': isShortForm,
      if (shortFormSignalScoreOverride != null)
        'shortFormSignalScore': shortFormSignalScoreOverride,
      'cachedAt': cachedAt,
      if (playlistColor != null) 'playlistColor': playlistColor,
      if (playlistTitle != null) 'playlistTitle': playlistTitle,
      if (feedSourceType != null) 'feedSourceType': feedSourceType,
      if (feedSourceId != null) 'feedSourceId': feedSourceId,
      if (feedSourceTitle != null) 'feedSourceTitle': feedSourceTitle,
    };
  }

  YouTubeVideo copyWith({
    String? id,
    String? youtubeVideoId,
    String? playlistId,
    String? playlistItemId,
    String? title,
    String? description,
    String? thumbnailUrl,
    int? thumbnailWidth,
    int? thumbnailHeight,
    String? channelTitle,
    String? channelThumbnailUrl,
    String? youtubeChannelId,
    String? duration,
    String? publishedAt,
    bool? isShortForm,
    int? shortFormSignalScoreOverride,
    int? cachedAt,
    String? playlistColor,
    String? playlistTitle,
    String? feedSourceType,
    String? feedSourceId,
    String? feedSourceTitle,
  }) {
    return YouTubeVideo(
      id: id ?? this.id,
      youtubeVideoId: youtubeVideoId ?? this.youtubeVideoId,
      playlistId: playlistId ?? this.playlistId,
      playlistItemId: playlistItemId ?? this.playlistItemId,
      title: title ?? this.title,
      description: description ?? this.description,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      thumbnailWidth: thumbnailWidth ?? this.thumbnailWidth,
      thumbnailHeight: thumbnailHeight ?? this.thumbnailHeight,
      channelTitle: channelTitle ?? this.channelTitle,
      channelThumbnailUrl: channelThumbnailUrl ?? this.channelThumbnailUrl,
      youtubeChannelId: youtubeChannelId ?? this.youtubeChannelId,
      duration: duration ?? this.duration,
      publishedAt: publishedAt ?? this.publishedAt,
      isShortForm: isShortForm ?? this.isShortForm,
      shortFormSignalScoreOverride:
          shortFormSignalScoreOverride ?? this.shortFormSignalScoreOverride,
      cachedAt: cachedAt ?? this.cachedAt,
      playlistColor: playlistColor ?? this.playlistColor,
      playlistTitle: playlistTitle ?? this.playlistTitle,
      feedSourceType: feedSourceType ?? this.feedSourceType,
      feedSourceId: feedSourceId ?? this.feedSourceId,
      feedSourceTitle: feedSourceTitle ?? this.feedSourceTitle,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is YouTubeVideo &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'YouTubeVideo(id: $id, title: $title)';

  int get shortFormSignalScore {
    if (shortFormSignalScoreOverride != null) {
      return shortFormSignalScoreOverride!;
    }

    var score = 0;
    final metadata = [
      title,
      description,
      thumbnailUrl,
    ].whereType<String>().join(' ').toLowerCase();

    if (metadata.contains('#shorts') || metadata.contains('/shorts/')) {
      score += 3;
    }

    if (thumbnailUrl != null) {
      final thumbnail = thumbnailUrl!.toLowerCase();
      if (thumbnail.contains('oar2') ||
          thumbnail.contains('hq2.jpg') ||
          thumbnail.contains('shorts')) {
        score += 2;
      }
    }

    if (thumbnailWidth != null &&
        thumbnailHeight != null &&
        thumbnailWidth! > 0 &&
        thumbnailHeight! > 0) {
      final ratio = thumbnailHeight! / thumbnailWidth!;
      if (ratio >= 1.35) {
        score += 2;
      } else if (ratio >= 1.1) {
        score += 1;
      }
    }

    final durationSeconds = parseDuration(duration);
    if (durationSeconds != null) {
      if (durationSeconds <= 60) {
        score += 2;
      } else if (durationSeconds <= 180) {
        score += 1;
      }
    }

    return score;
  }

  bool get isProbablyShortForm => isShortForm ?? shortFormSignalScore >= 2;
}

String? _optionalString(Object? value) {
  if (value == null) return null;
  final string = value.toString();
  return string.isEmpty ? null : string;
}

int _intValue(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

int? _intOrNull(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

/// Decodes video responses from Convex queries.
///
/// Some query projections return a raw list, while paginated projections return
/// `{ page, isDone, continueCursor }`. Keeping both shapes here prevents callers
/// from treating a loaded paginated response as missing metadata.
List<YouTubeVideo> decodeYouTubeVideoList(dynamic raw) {
  final decoded = raw is String ? _decodeJsonOrNull(raw) : raw;
  final items = _extractVideoItems(decoded);
  return items.map(YouTubeVideo.fromJson).toList(growable: false);
}

Object? _decodeJsonOrNull(String raw) {
  if (raw.isEmpty || raw == 'null') return null;
  return jsonDecode(raw);
}

List<Map<String, dynamic>> _extractVideoItems(Object? decoded) {
  final list = switch (decoded) {
    final List<dynamic> items => items,
    final Map<dynamic, dynamic> map when map['page'] is List<dynamic> =>
      map['page'] as List<dynamic>,
    _ => const <dynamic>[],
  };

  return list
      .whereType<Map<dynamic, dynamic>>()
      .map((item) => item.map((key, value) => MapEntry(key.toString(), value)))
      .toList(growable: false);
}
