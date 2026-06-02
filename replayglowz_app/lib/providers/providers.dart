import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:replayglowz_app/app/build_info.dart';
import 'package:replayglowz_app/auth/auth_state.dart';
import 'package:replayglowz_app/auth/auth_service.dart';
import 'package:replayglowz_app/convex/convex_client.dart';
import 'package:replayglowz_app/convex/convex_errors.dart';
import 'package:replayglowz_app/convex/convex_provider.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/utils/app_logger.dart';

// =============================================================================
// Typed Convex providers for the ReplayGlowz app.
//
// Each provider maps a Convex function path to a strongly-typed Dart model.
//
// * StreamProvider  — backed by ConvexService.subscribe (real-time).
// * FutureProvider  — backed by ConvexService.query   (one-shot).
// =============================================================================

/// Last video opened in the Play tab during the current app session.
class ActivePlayVideoIdNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void setVideoId(String videoId) {
    if (videoId.isEmpty) return;
    state = videoId;
  }

  void clear() {
    state = null;
  }
}

/// The bottom navigation can route to `/play` without query parameters. Keeping
/// this state lets the shell return to the active player instead of replacing it
/// with an empty Play screen.
final activePlayVideoIdProvider =
    NotifierProvider<ActivePlayVideoIdNotifier, String?>(
      ActivePlayVideoIdNotifier.new,
    );

enum PlaybackPreviewDirection { previous, next }

class AppPlaybackControllerState {
  const AppPlaybackControllerState({
    this.isPlaying = false,
    this.hasActiveVideo = false,
    this.controllerMode = false,
    this.toggleRequestId = 0,
    this.previousRequestId = 0,
    this.nextRequestId = 0,
    this.previewDirection,
    this.loopEnabled = false,
    this.hideCurrentVideoRequestId = 0,
    this.markCurrentVideoWatchedRequestId = 0,
    this.addCurrentVideoToPlaylistRequestId = 0,
    this.addCurrentChannelToFeedRequestId = 0,
    this.speedUpRequestId = 0,
    this.speedDownRequestId = 0,
    this.speedDeltaRequestId = 0,
    this.speedDelta = 0,
    this.playbackRate = 1,
    this.currentSeconds = 0,
    this.durationSeconds = 0,
    this.seekRequestId = 0,
    this.seekSeconds = 0,
  });

  final bool isPlaying;
  final bool hasActiveVideo;
  final bool controllerMode;
  final int toggleRequestId;
  final int previousRequestId;
  final int nextRequestId;
  final PlaybackPreviewDirection? previewDirection;
  final bool loopEnabled;
  final int hideCurrentVideoRequestId;
  final int markCurrentVideoWatchedRequestId;
  final int addCurrentVideoToPlaylistRequestId;
  final int addCurrentChannelToFeedRequestId;
  final int speedUpRequestId;
  final int speedDownRequestId;
  final int speedDeltaRequestId;
  final double speedDelta;
  final double playbackRate;
  final double currentSeconds;
  final double durationSeconds;
  final int seekRequestId;
  final double seekSeconds;

  AppPlaybackControllerState copyWith({
    bool? isPlaying,
    bool? hasActiveVideo,
    bool? controllerMode,
    int? toggleRequestId,
    int? previousRequestId,
    int? nextRequestId,
    PlaybackPreviewDirection? previewDirection,
    bool clearPreviewDirection = false,
    bool? loopEnabled,
    int? hideCurrentVideoRequestId,
    int? markCurrentVideoWatchedRequestId,
    int? addCurrentVideoToPlaylistRequestId,
    int? addCurrentChannelToFeedRequestId,
    int? speedUpRequestId,
    int? speedDownRequestId,
    int? speedDeltaRequestId,
    double? speedDelta,
    double? playbackRate,
    double? currentSeconds,
    double? durationSeconds,
    int? seekRequestId,
    double? seekSeconds,
  }) {
    return AppPlaybackControllerState(
      isPlaying: isPlaying ?? this.isPlaying,
      hasActiveVideo: hasActiveVideo ?? this.hasActiveVideo,
      controllerMode: controllerMode ?? this.controllerMode,
      toggleRequestId: toggleRequestId ?? this.toggleRequestId,
      previousRequestId: previousRequestId ?? this.previousRequestId,
      nextRequestId: nextRequestId ?? this.nextRequestId,
      previewDirection: clearPreviewDirection
          ? null
          : (previewDirection ?? this.previewDirection),
      loopEnabled: loopEnabled ?? this.loopEnabled,
      hideCurrentVideoRequestId:
          hideCurrentVideoRequestId ?? this.hideCurrentVideoRequestId,
      markCurrentVideoWatchedRequestId:
          markCurrentVideoWatchedRequestId ??
          this.markCurrentVideoWatchedRequestId,
      addCurrentVideoToPlaylistRequestId:
          addCurrentVideoToPlaylistRequestId ??
          this.addCurrentVideoToPlaylistRequestId,
      addCurrentChannelToFeedRequestId:
          addCurrentChannelToFeedRequestId ??
          this.addCurrentChannelToFeedRequestId,
      speedUpRequestId: speedUpRequestId ?? this.speedUpRequestId,
      speedDownRequestId: speedDownRequestId ?? this.speedDownRequestId,
      speedDeltaRequestId: speedDeltaRequestId ?? this.speedDeltaRequestId,
      speedDelta: speedDelta ?? this.speedDelta,
      playbackRate: playbackRate ?? this.playbackRate,
      currentSeconds: currentSeconds ?? this.currentSeconds,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      seekRequestId: seekRequestId ?? this.seekRequestId,
      seekSeconds: seekSeconds ?? this.seekSeconds,
    );
  }
}

class AppPlaybackControllerNotifier
    extends Notifier<AppPlaybackControllerState> {
  @override
  AppPlaybackControllerState build() => const AppPlaybackControllerState();

  void setActiveVideo(bool hasActiveVideo) {
    if (state.hasActiveVideo == hasActiveVideo) return;
    state = state.copyWith(hasActiveVideo: hasActiveVideo);
  }

  void setPlaying(bool isPlaying) {
    if (state.isPlaying == isPlaying) return;
    state = state.copyWith(isPlaying: isPlaying);
  }

  void requestToggle() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      toggleRequestId: state.toggleRequestId + 1,
    );
  }

  void requestPrevious() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      previousRequestId: state.previousRequestId + 1,
    );
  }

  void requestNext() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      nextRequestId: state.nextRequestId + 1,
    );
  }

  void showPreviousPreview() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      previewDirection: PlaybackPreviewDirection.previous,
    );
  }

  void showNextPreview() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      previewDirection: PlaybackPreviewDirection.next,
    );
  }

  void hidePreview() {
    if (state.previewDirection == null) return;
    state = state.copyWith(clearPreviewDirection: true);
  }

  void toggleLoop() {
    state = state.copyWith(
      controllerMode: true,
      loopEnabled: !state.loopEnabled,
    );
  }

  void requestHideCurrentVideo() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      hideCurrentVideoRequestId: state.hideCurrentVideoRequestId + 1,
    );
  }

  void requestMarkCurrentVideoWatched() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      markCurrentVideoWatchedRequestId:
          state.markCurrentVideoWatchedRequestId + 1,
    );
  }

  void requestAddCurrentVideoToPlaylist() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      addCurrentVideoToPlaylistRequestId:
          state.addCurrentVideoToPlaylistRequestId + 1,
    );
  }

  void requestAddCurrentChannelToFeed() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      addCurrentChannelToFeedRequestId:
          state.addCurrentChannelToFeedRequestId + 1,
    );
  }

  void requestSpeedUp() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      speedUpRequestId: state.speedUpRequestId + 1,
    );
  }

  void requestSpeedDown() {
    if (!state.hasActiveVideo) return;
    state = state.copyWith(
      controllerMode: true,
      speedDownRequestId: state.speedDownRequestId + 1,
    );
  }

  void requestSpeedDelta(double delta) {
    if (!state.hasActiveVideo || !delta.isFinite || delta == 0) return;
    state = state.copyWith(
      controllerMode: true,
      speedDelta: delta,
      speedDeltaRequestId: state.speedDeltaRequestId + 1,
    );
  }

  void setPlaybackRate(double playbackRate) {
    if (!playbackRate.isFinite || playbackRate <= 0) return;
    if ((state.playbackRate - playbackRate).abs() < 0.001) return;
    state = state.copyWith(playbackRate: playbackRate);
  }

  void setPlaybackPosition({
    required double currentSeconds,
    required double durationSeconds,
  }) {
    final current = currentSeconds.isFinite
        ? currentSeconds.clamp(0, double.infinity).toDouble()
        : 0.0;
    final duration = durationSeconds.isFinite
        ? durationSeconds.clamp(0, double.infinity).toDouble()
        : 0.0;
    if ((state.currentSeconds - current).abs() < 0.2 &&
        (state.durationSeconds - duration).abs() < 0.5) {
      return;
    }
    state = state.copyWith(currentSeconds: current, durationSeconds: duration);
  }

  void requestSeekTo(double seconds) {
    if (!state.hasActiveVideo) return;
    final max = state.durationSeconds > 0
        ? state.durationSeconds
        : math.max(seconds, 0.0);
    final clamped = seconds.clamp(0, max).toDouble();
    state = state.copyWith(
      controllerMode: true,
      currentSeconds: clamped,
      seekSeconds: clamped,
      seekRequestId: state.seekRequestId + 1,
    );
  }

  void requestSeekRelative(double deltaSeconds) {
    requestSeekTo(state.currentSeconds + deltaSeconds);
  }
}

final appPlaybackControllerProvider =
    NotifierProvider<AppPlaybackControllerNotifier, AppPlaybackControllerState>(
      AppPlaybackControllerNotifier.new,
    );

enum PlaybackSourceType { feed, playlist, virtualFeed, direct }

class PlaybackQueueItem {
  const PlaybackQueueItem({
    required this.youtubeVideoId,
    this.title,
    this.thumbnailUrl,
    this.duration,
    this.youtubeChannelId,
    this.channelTitle,
  });

  final String youtubeVideoId;
  final String? title;
  final String? thumbnailUrl;
  final String? duration;
  final String? youtubeChannelId;
  final String? channelTitle;

  factory PlaybackQueueItem.fromVideo(YouTubeVideo video) {
    return PlaybackQueueItem(
      youtubeVideoId: video.youtubeVideoId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      youtubeChannelId: video.youtubeChannelId,
      channelTitle: video.channelTitle,
    );
  }
}

class PlaybackSession {
  const PlaybackSession({
    this.sourceType = PlaybackSourceType.direct,
    this.sourceId,
    this.sourceTitle,
    this.items = const <PlaybackQueueItem>[],
    this.currentIndex = 0,
  });

  final PlaybackSourceType sourceType;
  final String? sourceId;
  final String? sourceTitle;
  final List<PlaybackQueueItem> items;
  final int currentIndex;

  List<String> get videoIds =>
      items.map((item) => item.youtubeVideoId).toList(growable: false);

  String? get currentVideoId => currentIndex >= 0 && currentIndex < items.length
      ? items[currentIndex].youtubeVideoId
      : null;

  bool get hasQueue => items.length > 1;

  String get displayTitle {
    final title = sourceTitle?.trim();
    if (title != null && title.isNotEmpty) return title;
    return switch (sourceType) {
      PlaybackSourceType.feed => 'Feed',
      PlaybackSourceType.playlist => 'Playlist',
      PlaybackSourceType.virtualFeed => 'ReplayGlowz feed',
      PlaybackSourceType.direct => 'Direct video',
    };
  }

  String? nextAfter(String videoId) {
    final index = videoIds.indexOf(videoId);
    if (index == -1 || index + 1 >= items.length) {
      return null;
    }
    return items[index + 1].youtubeVideoId;
  }

  String? previousBefore(String videoId) {
    final index = videoIds.indexOf(videoId);
    if (index <= 0) {
      return null;
    }
    return items[index - 1].youtubeVideoId;
  }

  PlaybackQueueItem? itemFor(String videoId) {
    for (final item in items) {
      if (item.youtubeVideoId == videoId) return item;
    }
    return null;
  }
}

class PlaybackSessionNotifier extends Notifier<PlaybackSession> {
  @override
  PlaybackSession build() => const PlaybackSession();

  void start({
    required PlaybackSourceType sourceType,
    String? sourceId,
    String? sourceTitle,
    required List<PlaybackQueueItem> items,
    String? currentVideoId,
  }) {
    final seen = <String>{};
    final cleanItems = <PlaybackQueueItem>[];
    for (final item in items) {
      final id = item.youtubeVideoId.trim();
      if (id.isEmpty || seen.contains(id)) continue;
      seen.add(id);
      cleanItems.add(item);
    }

    var currentIndex = 0;
    if (currentVideoId != null && currentVideoId.isNotEmpty) {
      final index = cleanItems.indexWhere(
        (item) => item.youtubeVideoId == currentVideoId,
      );
      if (index >= 0) {
        currentIndex = index;
      }
    }

    state = PlaybackSession(
      sourceType: sourceType,
      sourceId: sourceId,
      sourceTitle: sourceTitle,
      items: cleanItems,
      currentIndex: currentIndex,
    );
  }

  void markCurrent(String videoId) {
    final index = state.videoIds.indexOf(videoId);
    if (index == -1) {
      state = PlaybackSession(
        items: <PlaybackQueueItem>[PlaybackQueueItem(youtubeVideoId: videoId)],
      );
      return;
    }
    if (index == state.currentIndex) return;
    state = PlaybackSession(
      sourceType: state.sourceType,
      sourceId: state.sourceId,
      sourceTitle: state.sourceTitle,
      items: state.items,
      currentIndex: index,
    );
  }
}

final playbackSessionProvider =
    NotifierProvider<PlaybackSessionNotifier, PlaybackSession>(
      PlaybackSessionNotifier.new,
    );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Decodes a raw Convex response (JSON string or pre-decoded value) into a
/// [List<Map<String, dynamic>>].
///
/// Returns an empty list when the response is `null` or `"null"`.
List<Map<String, dynamic>> _decodeList(dynamic raw) {
  if (raw == null) return [];
  List<dynamic> list;
  if (raw is String) {
    if (raw == 'null' || raw.isEmpty) return [];
    final decoded = jsonDecode(raw);
    if (decoded is List) {
      list = decoded;
    } else if (decoded is Map<String, dynamic> && decoded['page'] is List) {
      list = decoded['page'] as List<dynamic>;
    } else {
      return [];
    }
  } else if (raw is List) {
    list = raw;
  } else if (raw is Map<String, dynamic> && raw['page'] is List) {
    list = raw['page'] as List<dynamic>;
  } else {
    return [];
  }
  return list.whereType<Map<String, dynamic>>().toList(growable: false);
}

/// Decodes a raw Convex response into a single [Map<String, dynamic>], or
/// `null` if the response is empty / null.
Map<String, dynamic>? _decodeMap(dynamic raw) {
  if (raw == null) return null;
  if (raw is Map<String, dynamic>) return raw;
  if (raw is String) {
    if (raw == 'null' || raw.isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is Map<String, dynamic>) return decoded;
    return null;
  }
  return null;
}

Map<String, dynamic>? _normalizeTranscriptMap(Map<String, dynamic>? raw) {
  if (raw == null) return null;

  final entriesRaw = raw['entries'];
  final entries = <Map<String, dynamic>>[];
  if (entriesRaw is List) {
    for (final item in entriesRaw) {
      if (item is! Map) continue;
      final start = (item['start'] as num?)?.toDouble();
      final duration = (item['duration'] as num?)?.toDouble();
      final text = item['text']?.toString() ?? '';
      if (start == null || duration == null || text.trim().isEmpty) {
        continue;
      }
      entries.add(<String, dynamic>{
        'start': start,
        'duration': duration,
        'text': text.trim(),
        if (item['speaker'] != null) 'speaker': item['speaker'].toString(),
      });
    }
  }

  return <String, dynamic>{...raw, 'entries': entries};
}

Map<String, dynamic> _normalizeSettingsMap(
  Map<String, dynamic>? raw,
  AuthUser user,
) {
  final json = <String, dynamic>{...?raw};
  json['_id'] ??= 'settings:${user.id}';
  json['userId'] ??= user.id;
  json['theme'] ??= 'system';
  json['language'] ??= 'en';
  json['notifications'] ??= <String, dynamic>{
    'email': true,
    'push': true,
    'newComments': true,
    'newLikes': false,
    'newVideos': true,
    'feedRefreshIntervalMinutes': 60,
  };
  json['playback'] ??= <String, dynamic>{
    'autoplay': true,
    'defaultQuality': 'auto',
    'defaultSpeed': 1,
    'mobileControlsPosition': 'bottom',
    'captionsEnabled': false,
    'autoMarkWatchedThreshold': 0.9,
  };
  json['notes'] ??= <String, dynamic>{
    'defaultTimestamped': true,
    'sortOrder': 'asc',
  };
  json['channelSync'] ??= <String, dynamic>{
    'autoSyncOnVisit': false,
    'syncIntervalMinutes': 0,
  };
  json['transcripts'] ??= <String, dynamic>{
    'defaultLanguage': 'en',
    'autoAttemptYoutubeCaptions': true,
    'autoAttemptLocalFallback': true,
    'sortBy': 'recommended',
  };
  return json;
}

Map<String, dynamic> _normalizeSubscriptionMap(
  Map<String, dynamic>? raw,
  AuthUser user,
) {
  final json = <String, dynamic>{...?raw};
  json['_id'] ??= 'subscription:${user.id}';
  json['userId'] ??= user.id;
  json['plan'] ??= 'free';
  json['status'] ??= 'active';
  json['features'] ??= <String, dynamic>{
    'maxVideos': 10,
    'maxNotesPerVideo': 50,
    'maxPlaylists': 3,
    'aiSummaries': false,
    'exportNotes': false,
  };
  json['cancelAtPeriodEnd'] ??= false;
  json['createdAt'] ??= 0;
  json['updatedAt'] ??= 0;
  return json;
}

class PreferencesData {
  const PreferencesData({
    required this.settings,
    required this.subscription,
    required this.user,
  });

  final UserSettings settings;
  final UserSubscription subscription;
  final ReplayGlowzUser? user;
}

class ProductAccessStatus {
  const ProductAccessStatus({
    required this.loading,
    required this.hasAccess,
    required this.accountRecognized,
    this.reasonCode,
    this.raw,
  });

  final bool loading;
  final bool hasAccess;
  final bool accountRecognized;
  final String? reasonCode;
  final Map<String, dynamic>? raw;
}

ReplayGlowzUser _fallbackUserFromAuth(AuthUser user) {
  return ReplayGlowzUser(
    id: 'user:${user.id}',
    clerkId: user.id,
    email: user.email,
    name: user.displayName,
    avatarUrl: user.imageUrl,
    youtubeConnected: false,
    createdAt: 0,
    updatedAt: 0,
  );
}

Future<dynamic> _queryWithTimeout(
  ConvexService service,
  String path,
  Map<String, dynamic> args,
) async {
  return service.query<dynamic>(path, args).timeout(const Duration(seconds: 8));
}

Future<dynamic> _mutateWithTimeout(
  ConvexService service,
  String path,
  Map<String, dynamic> args,
) async {
  return service
      .mutate<dynamic>(path, args)
      .timeout(const Duration(seconds: 8));
}

PreferencesData _localPreferencesData(AuthUser user) {
  return PreferencesData(
    settings: UserSettings.fromJson(_normalizeSettingsMap(null, user)),
    subscription: UserSubscription.fromJson(
      _normalizeSubscriptionMap(null, user),
    ),
    user: _fallbackUserFromAuth(user),
  );
}

Future<bool> _waitForConvexAuthReady(
  Ref ref, {
  required String consumer,
}) async {
  final authState = ref.watch(authStateProvider);
  if (authState is! AuthAuthenticated) {
    return false;
  }

  final auth = ref.read(authServiceProvider);
  final ready = await auth.waitForConvexTokenReady();
  if (!ready) {
    AppLogger.instance.log(
      '[convex_auth_not_ready] $consumer is using local fallbacks until '
      'Convex auth is ready for ${authState.user.id}',
      source: 'ConvexAuth',
      level: LogLevel.warning,
    );
  }
  return ready;
}

void _logFunctionMissing(
  String path, {
  required String consumer,
  String? fallback,
}) {
  final suffix = fallback == null ? '' : '; $fallback';
  AppLogger.instance.log(
    "[function_missing] $consumer could not call '$path'$suffix",
    source: 'ConvexContract',
    level: LogLevel.warning,
  );
}

void _logUnauthorizedFallback(
  String consumer, {
  required Object error,
  StackTrace? stackTrace,
  String? fallback,
}) {
  final suffix = fallback == null ? '' : '; $fallback';
  AppLogger.instance.log(
    '[convex_unauthorized] $consumer received an unauthenticated Convex '
    'response$suffix',
    source: 'ConvexAuth',
    level: LogLevel.warning,
    error: error,
    stackTrace: stackTrace,
  );
}

List<String> _legacyProductIds() {
  return replayGlowzLegacyProductIds
      .split(',')
      .map((value) => value.trim())
      .where((value) => value.isNotEmpty)
      .toList(growable: false);
}

// ---------------------------------------------------------------------------
// 1. videosProvider
// ---------------------------------------------------------------------------

/// Arguments for [videosProvider].
class VideosArgs {
  const VideosArgs({this.sortOrder = 'desc', this.includeWatched = true});

  final String sortOrder;
  final bool includeWatched;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is VideosArgs &&
          sortOrder == other.sortOrder &&
          includeWatched == other.includeWatched;

  @override
  int get hashCode => Object.hash(sortOrder, includeWatched);
}

/// Subscribes to `youtube:getAllVideos` and emits a typed
/// `List<YouTubeVideo>` on every server-side change.
final videosProvider = StreamProvider.family<List<YouTubeVideo>, VideosArgs>((
  ref,
  args,
) async* {
  final service = ref.watch(convexServiceProvider);
  if (!await _waitForConvexAuthReady(ref, consumer: 'videosProvider')) {
    yield const <YouTubeVideo>[];
    return;
  }

  yield* service
      .subscribe<dynamic>('youtube:getAllVideos', {
        'sortOrder': args.sortOrder,
        'includeWatched': args.includeWatched,
      })
      .map(
        (raw) => _decodeList(
          raw,
        ).map((json) => YouTubeVideo.fromJson(json)).toList(growable: false),
      );
});

/// One-shot lookup for a cached YouTube video by YouTube video id.
///
/// Used by Play actions that need current video metadata even before the full
/// library video stream has delivered its list.
final videoByYoutubeIdProvider = FutureProvider.family<YouTubeVideo?, String>((
  ref,
  youtubeVideoId,
) async {
  final id = youtubeVideoId.trim();
  if (id.isEmpty) return null;
  if (!await _waitForConvexAuthReady(
    ref,
    consumer: 'videoByYoutubeIdProvider',
  )) {
    return null;
  }

  final service = ref.watch(convexServiceProvider);
  final raw = await service.query<dynamic>('youtube:getVideoByYoutubeId', {
    'youtubeVideoId': id,
  });
  final json = _decodeMap(raw);
  return json == null ? null : YouTubeVideo.fromJson(json);
});

// ---------------------------------------------------------------------------
// 2. playlistsProvider
// ---------------------------------------------------------------------------

/// Subscribes to `youtube:getYoutubePlaylists` — real-time playlist list.
final playlistsProvider = StreamProvider<List<YouTubePlaylist>>((ref) async* {
  final service = ref.watch(convexServiceProvider);
  if (!await _waitForConvexAuthReady(ref, consumer: 'playlistsProvider')) {
    yield const <YouTubePlaylist>[];
    return;
  }

  yield* service
      .subscribe<dynamic>('youtube:getYoutubePlaylists', {})
      .map(
        (raw) => _decodeList(
          raw,
        ).map((json) => YouTubePlaylist.fromJson(json)).toList(growable: false),
      );
});

// ---------------------------------------------------------------------------
// 3b. virtualFeedsProvider
// ---------------------------------------------------------------------------

/// Loads local ReplayGlowz Feeds owned by the current user.
final virtualFeedsProvider = FutureProvider<List<VirtualFeed>>((ref) async {
  final authState = ref.watch(authStateProvider);
  if (authState is! AuthAuthenticated) {
    return const <VirtualFeed>[];
  }

  if (!await _waitForConvexAuthReady(ref, consumer: 'virtualFeedsProvider')) {
    return const <VirtualFeed>[];
  }

  final service = ref.watch(convexServiceProvider);
  final raw = await service.query<dynamic>('virtualFeeds:listFeeds', {
    'includeInactive': true,
  });
  return _decodeList(
    raw,
  ).map((json) => VirtualFeed.fromJson(json)).toList(growable: false);
});

class VirtualFeedDetailsArgs {
  const VirtualFeedDetailsArgs({
    required this.feedId,
    this.includeHidden = false,
    this.includeWatched = false,
    this.sortOrder,
    this.cursor,
    this.pageSize,
  });

  final String feedId;
  final bool includeHidden;
  final bool includeWatched;
  final String? sortOrder;
  final String? cursor;
  final int? pageSize;

  @override
  bool operator ==(Object other) {
    return other is VirtualFeedDetailsArgs &&
        feedId == other.feedId &&
        includeHidden == other.includeHidden &&
        includeWatched == other.includeWatched &&
        sortOrder == other.sortOrder &&
        cursor == other.cursor &&
        pageSize == other.pageSize;
  }

  @override
  int get hashCode => Object.hash(
    feedId,
    includeHidden,
    includeWatched,
    sortOrder,
    cursor,
    pageSize,
  );
}

/// Loads one virtual feed detail bundle (metadata + source projection + videos).
final virtualFeedDetailsProvider =
    FutureProvider.family<VirtualFeedDetails, VirtualFeedDetailsArgs>((
      ref,
      args,
    ) async {
      final authState = ref.watch(authStateProvider);
      if (authState is! AuthAuthenticated) {
        return VirtualFeedDetails.empty;
      }

      if (!await _waitForConvexAuthReady(
        ref,
        consumer: 'virtualFeedDetailsProvider',
      )) {
        return VirtualFeedDetails.empty;
      }

      final service = ref.watch(convexServiceProvider);
      final sortOrder = switch (args.sortOrder) {
        'asc' => 'oldest',
        'desc' => 'newest',
        final value => value,
      };
      final raw = await service.query<dynamic>('virtualFeeds:getFeedDetails', {
        'virtualFeedId': args.feedId,
        'includeHidden': args.includeHidden,
        'includeWatched': args.includeWatched,
        'sortOrder': ?sortOrder,
        if (args.cursor != null) 'cursor': args.cursor,
        if (args.pageSize != null) 'pageSize': args.pageSize,
      });

      final map = _decodeMap(raw);
      if (map == null) return VirtualFeedDetails.empty;
      return VirtualFeedDetails.fromJson(map);
    });

class PlaylistChannelCandidatesArgs {
  const PlaylistChannelCandidatesArgs({
    required this.feedId,
    required this.youtubePlaylistId,
  });

  final String feedId;
  final String youtubePlaylistId;

  @override
  bool operator ==(Object other) {
    return other is PlaylistChannelCandidatesArgs &&
        feedId == other.feedId &&
        youtubePlaylistId == other.youtubePlaylistId;
  }

  @override
  int get hashCode => Object.hash(feedId, youtubePlaylistId);
}

/// Loads channel candidates detected from cached videos in one playlist.
final playlistChannelCandidatesProvider =
    FutureProvider.family<
      PlaylistChannelCandidatesResult,
      PlaylistChannelCandidatesArgs
    >((ref, args) async {
      final authState = ref.watch(authStateProvider);
      if (authState is! AuthAuthenticated || args.youtubePlaylistId.isEmpty) {
        return PlaylistChannelCandidatesResult.empty;
      }

      if (!await _waitForConvexAuthReady(
        ref,
        consumer: 'playlistChannelCandidatesProvider',
      )) {
        return PlaylistChannelCandidatesResult.empty;
      }

      final service = ref.watch(convexServiceProvider);
      final raw = await service.query<dynamic>(
        'virtualFeeds:listPlaylistChannelCandidates',
        {
          'virtualFeedId': args.feedId,
          'youtubePlaylistId': args.youtubePlaylistId,
        },
      );
      final map = _decodeMap(raw);
      if (map == null) return PlaylistChannelCandidatesResult.empty;
      return PlaylistChannelCandidatesResult.fromJson(map);
    });

// Authenticated is provided by auth_state.dart.

// ---------------------------------------------------------------------------
// 3. notesProvider
// ---------------------------------------------------------------------------

/// Subscribes to `notes:getNotes` — all notes for the current user.
final notesProvider = StreamProvider<List<Note>>((ref) async* {
  final service = ref.watch(convexServiceProvider);
  if (!await _waitForConvexAuthReady(ref, consumer: 'notesProvider')) {
    yield const <Note>[];
    return;
  }

  yield* service
      .subscribe<dynamic>('notes:getNotes', {})
      .map(
        (raw) => _decodeList(
          raw,
        ).map((json) => Note.fromJson(json)).toList(growable: false),
      );
});

// ---------------------------------------------------------------------------
// 4. settingsProvider
// ---------------------------------------------------------------------------

/// Subscribes to `settings:getSettings` — current user's settings.
///
/// Emits `null` when no settings document exists yet (new user).
final settingsProvider = StreamProvider<UserSettings?>((ref) {
  final service = ref.watch(convexServiceProvider);
  return service.subscribe<dynamic>('settings:getSettings', {}).map((raw) {
    final json = _decodeMap(raw);
    return json != null ? UserSettings.fromJson(json) : null;
  });
});

// ---------------------------------------------------------------------------
// 5. subscriptionProvider
// ---------------------------------------------------------------------------

/// Subscribes to `subscriptions:getSubscription` — user's billing subscription.
///
/// Emits `null` when no subscription document exists (defaults to free).
final subscriptionProvider = StreamProvider<UserSubscription?>((ref) {
  final service = ref.watch(convexServiceProvider);
  return service.subscribe<dynamic>('subscriptions:getSubscription', {}).map((
    raw,
  ) {
    final json = _decodeMap(raw);
    return json != null ? UserSubscription.fromJson(json) : null;
  });
});

// ---------------------------------------------------------------------------
// 6. currentUserProvider
// ---------------------------------------------------------------------------

/// Subscribes to `users:getCurrentUser` — the currently authenticated user.
///
/// Emits `null` when the user is not authenticated.
final currentUserProvider = StreamProvider<ReplayGlowzUser?>((ref) {
  final service = ref.watch(convexServiceProvider);
  return service.subscribe<dynamic>('users:getCurrentUser', {}).map((raw) {
    final json = _decodeMap(raw);
    return json != null ? ReplayGlowzUser.fromJson(json) : null;
  });
});

// ---------------------------------------------------------------------------
// 7. youtubeConnectionProvider
// ---------------------------------------------------------------------------

/// One-shot query for `youtube:getYoutubeConnectionStatus`.
///
/// This intentionally uses [ConvexService.query] instead of a websocket
/// subscription because the web app already has a more reliable HTTP path for
/// one-shot reads than for auth-sensitive realtime subscriptions.
final youtubeConnectionProvider = FutureProvider<Map<String, dynamic>?>((
  ref,
) async {
  final authState = ref.watch(authStateProvider);
  if (authState is! AuthAuthenticated) {
    return <String, dynamic>{
      'hasTokens': false,
      'connected': false,
      'authReady': false,
    };
  }

  if (!await _waitForConvexAuthReady(
    ref,
    consumer: 'youtubeConnectionProvider',
  )) {
    return <String, dynamic>{
      'hasTokens': false,
      'connected': false,
      'authReady': false,
    };
  }

  final service = ref.watch(convexServiceProvider);
  final raw = await service.query<dynamic>(
    'youtube:getYoutubeConnectionStatus',
    {},
  );
  final status = _decodeMap(raw);
  if (status == null) return null;

  final hasTokens = status['hasTokens'] == true;
  final connected = status['connected'] == true && hasTokens;

  return <String, dynamic>{
    ...status,
    'hasTokens': hasTokens,
    'connected': connected,
    'needsReconnect': !connected,
  };
});

/// One-shot query for product access status enforced by the backend.
///
/// This is intentionally fail-closed: if the backend status function is not
/// available, the UI treats access as inactive.
final productAccessStatusProvider = FutureProvider<ProductAccessStatus>((
  ref,
) async {
  final authState = ref.watch(authStateProvider);
  if (authState is! AuthAuthenticated) {
    return const ProductAccessStatus(
      loading: false,
      hasAccess: false,
      accountRecognized: false,
      reasonCode: 'unauthenticated',
    );
  }

  if (!await _waitForConvexAuthReady(
    ref,
    consumer: 'productAccessStatusProvider',
  )) {
    return const ProductAccessStatus(
      loading: true,
      hasAccess: false,
      accountRecognized: true,
      reasonCode: 'auth_not_ready',
    );
  }

  final service = ref.watch(convexServiceProvider);
  try {
    await _mutateWithTimeout(service, 'users:ensureUser', {
      'email': authState.user.email,
      if (authState.user.displayName != null)
        'name': authState.user.displayName,
      if (authState.user.imageUrl != null) 'avatarUrl': authState.user.imageUrl,
    });

    final raw = await service.query<dynamic>('users:getProductAccessStatus', {
      'productId': replayGlowzProductId,
      'legacyProductIds': _legacyProductIds(),
    });
    final status = _decodeMap(raw) ?? const <String, dynamic>{};
    final hasAccess =
        status['hasAccess'] == true ||
        status['access'] == 'active' ||
        status['entitlementActive'] == true;
    final recognized =
        status['accountRecognized'] == true ||
        status['recognized'] == true ||
        status['userKnown'] == true;
    return ProductAccessStatus(
      loading: false,
      hasAccess: hasAccess,
      accountRecognized: recognized,
      reasonCode: status['reasonCode']?.toString(),
      raw: status,
    );
  } catch (e, st) {
    if (isMissingPublicConvexFunctionError(
      e,
      path: 'users:getProductAccessStatus',
    )) {
      _logFunctionMissing(
        'users:getProductAccessStatus',
        consumer: 'productAccessStatusProvider',
        fallback: 'denying access by default',
      );
      return const ProductAccessStatus(
        loading: false,
        hasAccess: false,
        accountRecognized: true,
        reasonCode: 'missing_access_status_function',
      );
    }
    if (isConvexUnauthorizedError(e)) {
      _logUnauthorizedFallback(
        'productAccessStatusProvider',
        error: e,
        stackTrace: st,
        fallback: 'denying access by default',
      );
      return const ProductAccessStatus(
        loading: false,
        hasAccess: false,
        accountRecognized: false,
        reasonCode: 'unauthorized',
      );
    }
    AppLogger.instance.log(
      'productAccessStatusProvider failed; denying access by default',
      source: 'ConvexAuth',
      level: LogLevel.warning,
      error: e,
      stackTrace: st,
    );
    return const ProductAccessStatus(
      loading: false,
      hasAccess: false,
      accountRecognized: true,
      reasonCode: 'status_query_failed',
    );
  }
});

// ---------------------------------------------------------------------------
// Preferences data provider
// ---------------------------------------------------------------------------

/// Loads the Preferences screen data in a robust, one-shot flow:
/// 1. ensure the Convex user exists
/// 2. fetch settings, subscription, and current user
///
/// This intentionally uses queries instead of subscriptions to avoid the
/// "infinite shimmer" case when a real-time subscription is established before
/// Convex auth is fully ready.
final preferencesDataProvider = FutureProvider<PreferencesData?>((ref) async {
  final authState = ref.watch(authStateProvider);
  if (authState is! AuthAuthenticated) {
    return null;
  }

  final service = ref.watch(convexServiceProvider);
  final authUser = authState.user;

  AppLogger.instance.log(
    'preferencesDataProvider start for ${authUser.id}',
    source: 'PreferencesData',
  );

  if (!await _waitForConvexAuthReady(
    ref,
    consumer: 'preferencesDataProvider',
  )) {
    return _localPreferencesData(authUser);
  }

  try {
    await _mutateWithTimeout(service, 'users:ensureUser', {
      'email': authUser.email,
      if (authUser.displayName != null) 'name': authUser.displayName,
      if (authUser.imageUrl != null) 'avatarUrl': authUser.imageUrl,
    });
    AppLogger.instance.log(
      'users:ensureUser succeeded',
      source: 'PreferencesData',
    );
  } catch (e, st) {
    AppLogger.instance.log(
      'users:ensureUser failed; falling back to local defaults',
      source: 'PreferencesData',
      level: LogLevel.warning,
      error: e,
      stackTrace: st,
    );
  }

  dynamic settingsRaw;
  dynamic subscriptionRaw;
  dynamic currentUserRaw;

  try {
    settingsRaw = await _queryWithTimeout(service, 'settings:getSettings', {});
    AppLogger.instance.log(
      'settings:getSettings succeeded',
      source: 'PreferencesData',
    );
  } catch (e, st) {
    AppLogger.instance.log(
      'settings:getSettings failed; using defaults',
      source: 'PreferencesData',
      level: LogLevel.warning,
      error: e,
      stackTrace: st,
    );
  }

  try {
    subscriptionRaw = await _queryWithTimeout(
      service,
      'subscriptions:getSubscription',
      {},
    );
    AppLogger.instance.log(
      'subscriptions:getSubscription succeeded',
      source: 'PreferencesData',
    );
  } catch (e, st) {
    AppLogger.instance.log(
      'subscriptions:getSubscription failed; using free plan fallback',
      source: 'PreferencesData',
      level: LogLevel.warning,
      error: e,
      stackTrace: st,
    );
  }

  try {
    currentUserRaw = await _queryWithTimeout(
      service,
      'users:getCurrentUser',
      {},
    );
    AppLogger.instance.log(
      'users:getCurrentUser succeeded',
      source: 'PreferencesData',
    );
  } catch (e, st) {
    AppLogger.instance.log(
      'users:getCurrentUser failed; using auth fallback user',
      source: 'PreferencesData',
      level: LogLevel.warning,
      error: e,
      stackTrace: st,
    );
  }

  final settings = UserSettings.fromJson(
    _normalizeSettingsMap(_decodeMap(settingsRaw), authUser),
  );
  final subscription = UserSubscription.fromJson(
    _normalizeSubscriptionMap(_decodeMap(subscriptionRaw), authUser),
  );
  final userJson = _decodeMap(currentUserRaw);
  final user = userJson != null
      ? ReplayGlowzUser.fromJson(userJson)
      : _fallbackUserFromAuth(authUser);

  return PreferencesData(
    settings: settings,
    subscription: subscription,
    user: user,
  );
});

class FeedbackAdminListArgs {
  const FeedbackAdminListArgs({this.status, this.type});

  final FeedbackEntryStatus? status;
  final FeedbackEntryType? type;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is FeedbackAdminListArgs &&
          status == other.status &&
          type == other.type;

  @override
  int get hashCode => Object.hash(status, type);
}

class TranscriptArgs {
  const TranscriptArgs({required this.youtubeVideoId, this.language = 'en'});

  final String youtubeVideoId;
  final String language;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TranscriptArgs &&
          youtubeVideoId == other.youtubeVideoId &&
          language == other.language;

  @override
  int get hashCode => Object.hash(youtubeVideoId, language);
}

/// One-shot query for `feedback:isAdmin`.
final feedbackIsAdminProvider = FutureProvider<bool>((ref) async {
  final authState = ref.watch(authStateProvider);
  if (authState is! AuthAuthenticated) {
    return false;
  }

  if (!await _waitForConvexAuthReady(
    ref,
    consumer: 'feedbackIsAdminProvider',
  )) {
    return false;
  }

  final service = ref.watch(convexServiceProvider);
  try {
    final raw = await service.query<dynamic>('feedback:isAdmin', {});
    return raw == true;
  } catch (e, st) {
    if (isMissingPublicConvexFunctionError(e, path: 'feedback:isAdmin')) {
      _logFunctionMissing(
        'feedback:isAdmin',
        consumer: 'feedbackIsAdminProvider',
        fallback: 'returning false',
      );
      return false;
    }
    if (isConvexUnauthorizedError(e)) {
      _logUnauthorizedFallback(
        'feedbackIsAdminProvider',
        error: e,
        stackTrace: st,
        fallback: 'returning false',
      );
      return false;
    }
    rethrow;
  }
});

/// One-shot query for `feedback:listAdmin`.
final feedbackAdminEntriesProvider =
    FutureProvider.family<List<FeedbackEntry>, FeedbackAdminListArgs>((
      ref,
      args,
    ) async {
      if (!await _waitForConvexAuthReady(
        ref,
        consumer: 'feedbackAdminEntriesProvider',
      )) {
        throw StateError('Feedback admin is not ready yet.');
      }

      final service = ref.watch(convexServiceProvider);
      try {
        final raw = await service.query<dynamic>('feedback:listAdmin', {
          if (args.status != null) 'status': args.status!.jsonValue,
          if (args.type != null) 'type': args.type!.name,
        });
        return _decodeList(
          raw,
        ).map((json) => FeedbackEntry.fromJson(json)).toList(growable: false);
      } catch (e) {
        if (isMissingPublicConvexFunctionError(e, path: 'feedback:listAdmin')) {
          _logFunctionMissing(
            'feedback:listAdmin',
            consumer: 'feedbackAdminEntriesProvider',
          );
          throw StateError(
            'Feedback admin is unavailable on the current backend deployment.',
          );
        }
        rethrow;
      }
    });

/// One-shot query for the active transcript for a video.
///
/// Primary source is `transcripts:getActiveTranscript`. If that function is
/// missing on the connected backend, this provider falls back to legacy
/// `youtube:getTranscript`.
final activeTranscriptProvider =
    FutureProvider.family<Map<String, dynamic>?, TranscriptArgs>((
      ref,
      args,
    ) async {
      if (args.youtubeVideoId.trim().isEmpty) {
        return null;
      }

      final service = ref.watch(convexServiceProvider);

      Future<Map<String, dynamic>?> queryTranscript(
        String path,
        Map<String, dynamic> queryArgs,
      ) async {
        final raw = await service.query<dynamic>(path, queryArgs);
        return _normalizeTranscriptMap(_decodeMap(raw));
      }

      try {
        final active = await queryTranscript(
          'transcripts:getActiveTranscript',
          {'youtubeVideoId': args.youtubeVideoId, 'language': args.language},
        );
        if (active != null) {
          return active;
        }
      } catch (e, st) {
        if (isMissingPublicConvexFunctionError(
          e,
          path: 'transcripts:getActiveTranscript',
        )) {
          _logFunctionMissing(
            'transcripts:getActiveTranscript',
            consumer: 'activeTranscriptProvider',
            fallback: 'falling back to youtube:getTranscript',
          );
        } else if (isConvexUnauthorizedError(e)) {
          _logUnauthorizedFallback(
            'activeTranscriptProvider',
            error: e,
            stackTrace: st,
            fallback: 'returning null',
          );
          return null;
        } else {
          rethrow;
        }
      }

      try {
        return await queryTranscript('youtube:getTranscript', {
          'youtubeVideoId': args.youtubeVideoId,
          'language': args.language,
        });
      } catch (e, st) {
        if (isMissingPublicConvexFunctionError(
          e,
          path: 'youtube:getTranscript',
        )) {
          _logFunctionMissing(
            'youtube:getTranscript',
            consumer: 'activeTranscriptProvider',
            fallback: 'returning null',
          );
          return null;
        }
        if (isConvexUnauthorizedError(e)) {
          _logUnauthorizedFallback(
            'activeTranscriptProvider',
            error: e,
            stackTrace: st,
            fallback: 'returning null',
          );
          return null;
        }
        rethrow;
      }
    });

/// One-shot query for cached YouTube subscriptions.
///
/// This provider is intentionally cache-only (`youtube:getYoutubeChannels`) so
/// route navigation and Preferences page loads do not trigger hidden YouTube
/// API quota spend.
final subscribedChannelsProvider = FutureProvider<List<YouTubeChannel>>((
  ref,
) async {
  if (!await _waitForConvexAuthReady(
    ref,
    consumer: 'subscribedChannelsProvider',
  )) {
    return const [];
  }

  final service = ref.watch(convexServiceProvider);
  final raw = await service.query<dynamic>('youtube:getYoutubeChannels', {});
  return _decodeList(
    raw,
  ).map((json) => YouTubeChannel.fromJson(json)).toList(growable: false);
});

/// One-shot query for channel-to-playlist automation links.
final channelLinksProvider = FutureProvider<List<ChannelPlaylistLink>>((
  ref,
) async {
  if (!await _waitForConvexAuthReady(ref, consumer: 'channelLinksProvider')) {
    return const [];
  }

  final service = ref.watch(convexServiceProvider);
  final raw = await service.query<dynamic>('channelLinks:getChannelLinks', {});
  return _decodeList(
    raw,
  ).map((json) => ChannelPlaylistLink.fromJson(json)).toList(growable: false);
});

/// One-shot query for transcript provider availability.
final transcriptProviderCatalogProvider =
    FutureProvider<List<TranscriptProviderCatalogItem>>((ref) async {
      if (!await _waitForConvexAuthReady(
        ref,
        consumer: 'transcriptProviderCatalogProvider',
      )) {
        return const [];
      }

      final service = ref.watch(convexServiceProvider);
      final raw = await service.query<dynamic>(
        'transcripts:getProviderCatalog',
        {},
      );
      return _decodeList(raw)
          .map((json) => TranscriptProviderCatalogItem.fromJson(json))
          .toList(growable: false);
    });

/// One-shot query for masked transcript provider secret status.
final transcriptSecretsStatusProvider =
    FutureProvider<List<TranscriptSecretStatus>>((ref) async {
      if (!await _waitForConvexAuthReady(
        ref,
        consumer: 'transcriptSecretsStatusProvider',
      )) {
        return const [];
      }

      final service = ref.watch(convexServiceProvider);
      final raw = await service.query<dynamic>(
        'transcriptSecrets:getSecretsStatus',
        {},
      );
      return _decodeList(raw)
          .map((json) => TranscriptSecretStatus.fromJson(json))
          .toList(growable: false);
    });

/// One-shot query for transcript versions on a video/language pair.
final transcriptVersionsProvider =
    FutureProvider.family<List<TranscriptVersion>, TranscriptArgs>((
      ref,
      args,
    ) async {
      if (args.youtubeVideoId.trim().isEmpty) {
        return const [];
      }
      if (!await _waitForConvexAuthReady(
        ref,
        consumer: 'transcriptVersionsProvider',
      )) {
        return const [];
      }

      final service = ref.watch(convexServiceProvider);
      final raw = await service.query<dynamic>(
        'transcripts:getTranscriptVersions',
        {'youtubeVideoId': args.youtubeVideoId, 'language': args.language},
      );
      return _decodeList(
        raw,
      ).map((json) => TranscriptVersion.fromJson(json)).toList(growable: false);
    });

/// One-shot query for the latest transcript generation job.
final latestTranscriptJobProvider =
    FutureProvider.family<TranscriptJob?, TranscriptArgs>((ref, args) async {
      if (args.youtubeVideoId.trim().isEmpty) {
        return null;
      }
      if (!await _waitForConvexAuthReady(
        ref,
        consumer: 'latestTranscriptJobProvider',
      )) {
        return null;
      }

      final service = ref.watch(convexServiceProvider);
      final raw = await service.query<dynamic>(
        'transcripts:getLatestTranscriptJob',
        {'youtubeVideoId': args.youtubeVideoId, 'language': args.language},
      );
      final json = _decodeMap(raw);
      return json == null ? null : TranscriptJob.fromJson(json);
    });

// ---------------------------------------------------------------------------
// 8. hiddenItemsProvider
// ---------------------------------------------------------------------------

/// One-shot query for `hidden:getHiddenItems`.
final hiddenItemsProvider = FutureProvider<List<HiddenItem>>((ref) async {
  final service = ref.watch(convexServiceProvider);
  final raw = await service.query<dynamic>('hidden:getHiddenItems', {});
  return _decodeList(
    raw,
  ).map((json) => HiddenItem.fromJson(json)).toList(growable: false);
});

// ---------------------------------------------------------------------------
// 9. watchedVideosProvider
// ---------------------------------------------------------------------------

/// One-shot query for `watched:getWatchedVideos`.
final watchedVideosProvider = FutureProvider<List<WatchedVideo>>((ref) async {
  final service = ref.watch(convexServiceProvider);
  final raw = await service.query<dynamic>('watched:getWatchedVideos', {});
  return _decodeList(
    raw,
  ).map((json) => WatchedVideo.fromJson(json)).toList(growable: false);
});

// ---------------------------------------------------------------------------
// 10. videoProgressProvider(videoId)
// ---------------------------------------------------------------------------

/// One-shot query for `progress:getProgress` for a single video.
///
/// Returns `null` when no progress has been saved for this video.
final videoProgressProvider = FutureProvider.family<VideoProgress?, String>((
  ref,
  videoId,
) async {
  final service = ref.watch(convexServiceProvider);
  final raw = await service.query<dynamic>('progress:getProgress', {
    'youtubeVideoId': videoId,
  });
  final json = _decodeMap(raw);
  return json != null ? VideoProgress.fromJson(json) : null;
});

// ---------------------------------------------------------------------------
// 11. quotaUsageProvider
// ---------------------------------------------------------------------------

class QuotaUsageSnapshot {
  const QuotaUsageSnapshot({
    required this.used,
    required this.limit,
    required this.raw,
  });

  final int used;
  final int limit;
  final Map<String, dynamic>? raw;

  int get remaining => (limit - used).clamp(0, limit);
  double get usageRatio => limit <= 0 ? 0 : used / limit;

  bool isRisky(int cost) {
    if (limit <= 0) return false;
    if (cost > remaining) return true;
    return (used + cost) / limit >= 0.9;
  }

  String describeCost(int cost) {
    final projected = used + cost;
    return '$cost quota unit${cost == 1 ? '' : 's'}; '
        '$remaining of $limit remaining today'
        '${projected > limit ? ' (would exceed the daily limit)' : ''}.';
  }
}

int _readQuotaInt(Map<String, dynamic>? data, List<String> keys, int fallback) {
  if (data == null) return fallback;
  for (final key in keys) {
    final value = data[key];
    if (value is num) return value.toInt();
    if (value is String) {
      final parsed = int.tryParse(value);
      if (parsed != null) return parsed;
    }
  }
  return fallback;
}

/// One-shot query for `metrics:getTodayQuotaUsage`.
///
/// Returns the raw map which typically includes `{ used: int, limit: int }`.
final quotaUsageProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final service = ref.watch(convexServiceProvider);
  final raw = await service.query<dynamic>('metrics:getTodayQuotaUsage', {});
  return _decodeMap(raw);
});

final quotaUsageSnapshotProvider = Provider<AsyncValue<QuotaUsageSnapshot>>((
  ref,
) {
  return ref.watch(quotaUsageProvider).whenData((data) {
    final limit = _readQuotaInt(data, const [
      'limit',
      'dailyLimit',
      'quotaLimit',
    ], 10000);
    return QuotaUsageSnapshot(
      used: _readQuotaInt(data, const ['used', 'quotaUsed', 'total'], 0),
      limit: limit <= 0 ? 10000 : limit,
      raw: data,
    );
  });
});

/// Subscribes to the latest backend-orchestrated YouTube sync job.
final youtubeSyncJobProvider = StreamProvider<Map<String, dynamic>?>((ref) {
  final service = ref.watch(convexServiceProvider);
  return service
      .subscribe<dynamic>('youtube:getLatestYoutubeSyncJob', {})
      .map(_decodeMap);
});

// ---------------------------------------------------------------------------
// 12. playlistVideosProvider(playlistId)
// ---------------------------------------------------------------------------

/// Subscribes to `youtube:getPlaylistVideos` for a specific playlist.
final playlistVideosProvider =
    StreamProvider.family<List<YouTubeVideo>, String>((ref, playlistId) {
      final service = ref.watch(convexServiceProvider);
      return service
          .subscribe<dynamic>('youtube:getPlaylistVideos', {
            'playlistId': playlistId,
          })
          .map(
            (raw) => _decodeList(raw)
                .map((json) => YouTubeVideo.fromJson(json))
                .toList(growable: false),
          );
    });

// ---------------------------------------------------------------------------
// 13. notificationsProvider
// ---------------------------------------------------------------------------

/// Subscribes to `notifications:getNotifications` — current user's notifications.
final notificationsProvider = StreamProvider<List<AppNotification>>((ref) {
  final authState = ref.watch(authStateProvider);
  if (authState is! AuthAuthenticated) {
    return Stream.value(const <AppNotification>[]);
  }

  final service = ref.watch(convexServiceProvider);
  return () async* {
    if (!await _waitForConvexAuthReady(
      ref,
      consumer: 'notificationsProvider',
    )) {
      yield const <AppNotification>[];
      return;
    }

    try {
      yield* service
          .subscribe<dynamic>('notifications:getNotifications', {})
          .map(
            (raw) => _decodeList(raw)
                .map((json) => AppNotification.fromJson(json))
                .toList(growable: false),
          );
    } catch (e, st) {
      if (isMissingPublicConvexFunctionError(
        e,
        path: 'notifications:getNotifications',
      )) {
        _logFunctionMissing(
          'notifications:getNotifications',
          consumer: 'notificationsProvider',
          fallback: 'returning an empty list',
        );
        yield const <AppNotification>[];
        return;
      }
      if (isConvexUnauthorizedError(e)) {
        _logUnauthorizedFallback(
          'notificationsProvider',
          error: e,
          stackTrace: st,
          fallback: 'returning an empty list',
        );
        yield const <AppNotification>[];
        return;
      }
      rethrow;
    }
  }();
});

// ---------------------------------------------------------------------------
// 14. unreadNotificationCountProvider
// ---------------------------------------------------------------------------

/// Subscribes to `notifications:getUnreadCount` — unread notification count.
final unreadNotificationCountProvider = StreamProvider<int>((ref) {
  final authState = ref.watch(authStateProvider);
  if (authState is! AuthAuthenticated) {
    return Stream.value(0);
  }

  final service = ref.watch(convexServiceProvider);
  return () async* {
    if (!await _waitForConvexAuthReady(
      ref,
      consumer: 'unreadNotificationCountProvider',
    )) {
      yield 0;
      return;
    }

    try {
      yield* service.subscribe<dynamic>('notifications:getUnreadCount', {}).map(
        (raw) {
          if (raw is int) return raw;
          if (raw is String) {
            final parsed = int.tryParse(raw);
            return parsed ?? 0;
          }
          if (raw is num) return raw.toInt();
          return 0;
        },
      );
    } catch (e, st) {
      if (isMissingPublicConvexFunctionError(
        e,
        path: 'notifications:getUnreadCount',
      )) {
        _logFunctionMissing(
          'notifications:getUnreadCount',
          consumer: 'unreadNotificationCountProvider',
          fallback: 'returning 0',
        );
        yield 0;
        return;
      }
      if (isConvexUnauthorizedError(e)) {
        _logUnauthorizedFallback(
          'unreadNotificationCountProvider',
          error: e,
          stackTrace: st,
          fallback: 'returning 0',
        );
        yield 0;
        return;
      }
      rethrow;
    }
  }();
});

// ---------------------------------------------------------------------------
// 15. videoNotesProvider(videoId)
// ---------------------------------------------------------------------------

/// Subscribes to `notes:getNotesByYoutubeVideo` for a specific video.
final videoNotesProvider = StreamProvider.family<List<Note>, String>((
  ref,
  videoId,
) {
  final service = ref.watch(convexServiceProvider);
  return service
      .subscribe<dynamic>('notes:getNotesByYoutubeVideo', {
        'youtubeVideoId': videoId,
      })
      .map(
        (raw) => _decodeList(
          raw,
        ).map((json) => Note.fromJson(json)).toList(growable: false),
      );
});
