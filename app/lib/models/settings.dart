/// Theme preference for the application.
///
/// Named [AppThemeMode] to avoid collision with Flutter's [ThemeMode].
enum AppThemeMode {
  light,
  dark,
  system;

  static AppThemeMode fromJson(String? value) {
    switch (value) {
      case 'light':
        return AppThemeMode.light;
      case 'dark':
        return AppThemeMode.dark;
      case 'system':
      default:
        return AppThemeMode.system;
    }
  }

  String toJson() => name;
}

/// Position of mobile video player controls overlay.
enum MobileControlsPosition {
  bottom,
  player;

  static MobileControlsPosition fromJson(String? value) {
    switch (value) {
      case 'player':
        return MobileControlsPosition.player;
      case 'bottom':
      default:
        return MobileControlsPosition.bottom;
    }
  }

  String toJson() => name;
}

/// Sort direction for notes display.
enum NoteSortOrder {
  asc,
  desc;

  static NoteSortOrder fromJson(String? value) {
    switch (value) {
      case 'asc':
        return NoteSortOrder.asc;
      case 'desc':
      default:
        return NoteSortOrder.desc;
    }
  }

  String toJson() => name;
}

/// Transcript provider identifier.
enum TranscriptProvider {
  youtubeCaptions,
  fasterWhisper,
  sensevoice,
  openaiMini,
  openai,
  deepgram;

  static TranscriptProvider? fromJson(String? value) {
    switch (value) {
      case 'youtube_captions':
        return TranscriptProvider.youtubeCaptions;
      case 'faster_whisper':
        return TranscriptProvider.fasterWhisper;
      case 'sensevoice':
        return TranscriptProvider.sensevoice;
      case 'openai_mini':
        return TranscriptProvider.openaiMini;
      case 'openai':
        return TranscriptProvider.openai;
      case 'deepgram':
        return TranscriptProvider.deepgram;
      default:
        return null;
    }
  }

  String toJson() {
    switch (this) {
      case TranscriptProvider.youtubeCaptions:
        return 'youtube_captions';
      case TranscriptProvider.fasterWhisper:
        return 'faster_whisper';
      case TranscriptProvider.sensevoice:
        return 'sensevoice';
      case TranscriptProvider.openaiMini:
        return 'openai_mini';
      case TranscriptProvider.openai:
        return 'openai';
      case TranscriptProvider.deepgram:
        return 'deepgram';
    }
  }
}

/// Sort criteria for transcript provider list.
enum TranscriptSortBy {
  recommended,
  price,
  speed,
  quality,
  name;

  static TranscriptSortBy fromJson(String? value) {
    switch (value) {
      case 'price':
        return TranscriptSortBy.price;
      case 'speed':
        return TranscriptSortBy.speed;
      case 'quality':
        return TranscriptSortBy.quality;
      case 'name':
        return TranscriptSortBy.name;
      case 'recommended':
      default:
        return TranscriptSortBy.recommended;
    }
  }

  String toJson() {
    switch (this) {
      case TranscriptSortBy.recommended:
        return 'recommended';
      case TranscriptSortBy.price:
        return 'price';
      case TranscriptSortBy.speed:
        return 'speed';
      case TranscriptSortBy.quality:
        return 'quality';
      case TranscriptSortBy.name:
        return 'name';
    }
  }
}

Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.cast<String, dynamic>();
  return null;
}

bool? _asBool(dynamic value) => value is bool ? value : null;

String? _asString(dynamic value) => value is String ? value : null;

int? _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return null;
}

List<String>? _asStringList(dynamic value) {
  if (value is! List) return null;
  return value.whereType<String>().toList();
}

// ---------------------------------------------------------------------------
// Nested settings objects
// ---------------------------------------------------------------------------

/// Notification preferences.
enum PushCadence {
  hourly,
  every6Hours,
  daily,
  every3Days;

  static PushCadence fromJson(String? value) {
    switch (value) {
      case 'hourly':
        return PushCadence.hourly;
      case 'every_6_hours':
        return PushCadence.every6Hours;
      case 'every_3_days':
        return PushCadence.every3Days;
      case 'daily':
      default:
        return PushCadence.daily;
    }
  }

  String toJson() {
    switch (this) {
      case PushCadence.hourly:
        return 'hourly';
      case PushCadence.every6Hours:
        return 'every_6_hours';
      case PushCadence.daily:
        return 'daily';
      case PushCadence.every3Days:
        return 'every_3_days';
    }
  }
}

class NotificationSettings {
  final bool email;
  final bool push;
  final bool newComments;
  final bool newLikes;
  final bool newVideos;
  final bool transcriptReady;
  final bool system;
  final PushCadence pushCadence;
  final bool notifyAllSources;
  final List<String> selectedFeedIds;
  final List<String> selectedChannelSourceIds;

  /// Feed refresh interval in minutes. 0 means disabled.
  /// Typical values: 0, 30, 60, 120, 360, 1440.
  final int feedRefreshIntervalMinutes;

  const NotificationSettings({
    this.email = true,
    this.push = false,
    this.newComments = true,
    this.newLikes = true,
    this.newVideos = true,
    this.transcriptReady = true,
    this.system = true,
    this.pushCadence = PushCadence.daily,
    this.notifyAllSources = true,
    this.selectedFeedIds = const [],
    this.selectedChannelSourceIds = const [],
    this.feedRefreshIntervalMinutes = 60,
  });

  factory NotificationSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const NotificationSettings();
    final androidPush = _asMap(json['androidPush']);
    final androidPushTypes = _asMap(androidPush?['types']);
    final sourceTargeting = _asMap(androidPush?['sourceTargeting']);
    final sourceTargetingMode = sourceTargeting?['mode'] as String?;
    return NotificationSettings(
      email: json['email'] as bool? ?? true,
      push: json['push'] as bool? ?? androidPush?['enabled'] as bool? ?? false,
      newComments: json['newComments'] as bool? ?? true,
      newLikes: json['newLikes'] as bool? ?? true,
      newVideos: json['newVideos'] as bool? ?? true,
      transcriptReady:
          json['transcriptReady'] as bool? ??
          androidPushTypes?['transcript_ready'] as bool? ??
          true,
      system:
          json['system'] as bool? ??
          androidPushTypes?['system'] as bool? ??
          true,
      pushCadence: PushCadence.fromJson(
        json['pushCadence'] as String? ?? androidPush?['cadence'] as String?,
      ),
      notifyAllSources:
          json['notifyAllSources'] as bool? ??
          sourceTargetingMode != 'selected',
      selectedFeedIds:
          _asStringList(json['selectedFeedIds']) ??
          _asStringList(sourceTargeting?['selectedFeedIds']) ??
          const [],
      selectedChannelSourceIds:
          _asStringList(json['selectedChannelSourceIds']) ??
          _asStringList(sourceTargeting?['selectedChannelSourceIds']) ??
          const [],
      feedRefreshIntervalMinutes:
          json['feedRefreshIntervalMinutes'] as int? ?? 60,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'push': push,
      'newComments': newComments,
      'newLikes': newLikes,
      'newVideos': newVideos,
      'feedRefreshIntervalMinutes': feedRefreshIntervalMinutes,
      'androidPush': {
        'enabled': push,
        'cadence': pushCadence.toJson(),
        'types': {
          'new_video': newVideos,
          'transcript_ready': transcriptReady,
          'system': system,
        },
        'sourceTargeting': {
          'mode': notifyAllSources ? 'all' : 'selected',
          'selectedFeedIds': selectedFeedIds,
          'selectedChannelSourceIds': selectedChannelSourceIds,
        },
      },
    };
  }

  NotificationSettings copyWith({
    bool? email,
    bool? push,
    bool? newComments,
    bool? newLikes,
    bool? newVideos,
    bool? transcriptReady,
    bool? system,
    PushCadence? pushCadence,
    bool? notifyAllSources,
    List<String>? selectedFeedIds,
    List<String>? selectedChannelSourceIds,
    int? feedRefreshIntervalMinutes,
  }) {
    return NotificationSettings(
      email: email ?? this.email,
      push: push ?? this.push,
      newComments: newComments ?? this.newComments,
      newLikes: newLikes ?? this.newLikes,
      newVideos: newVideos ?? this.newVideos,
      transcriptReady: transcriptReady ?? this.transcriptReady,
      system: system ?? this.system,
      pushCadence: pushCadence ?? this.pushCadence,
      notifyAllSources: notifyAllSources ?? this.notifyAllSources,
      selectedFeedIds: selectedFeedIds ?? this.selectedFeedIds,
      selectedChannelSourceIds:
          selectedChannelSourceIds ?? this.selectedChannelSourceIds,
      feedRefreshIntervalMinutes:
          feedRefreshIntervalMinutes ?? this.feedRefreshIntervalMinutes,
    );
  }
}

/// Video playback preferences.
class PlaybackSettings {
  final bool autoplay;
  final String? defaultQuality;
  final double? defaultSpeed;
  final MobileControlsPosition? mobileControlsPosition;
  final bool? captionsEnabled;
  final String? captionsLanguage;

  /// Percentage (0.0-1.0) of video watched before auto-marking as watched.
  final double? autoMarkWatchedThreshold;

  const PlaybackSettings({
    this.autoplay = true,
    this.defaultQuality,
    this.defaultSpeed,
    this.mobileControlsPosition,
    this.captionsEnabled,
    this.captionsLanguage,
    this.autoMarkWatchedThreshold,
  });

  factory PlaybackSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const PlaybackSettings();
    return PlaybackSettings(
      autoplay: json['autoplay'] as bool? ?? true,
      defaultQuality: json['defaultQuality'] as String?,
      defaultSpeed: (json['defaultSpeed'] as num?)?.toDouble(),
      mobileControlsPosition: json['mobileControlsPosition'] != null
          ? MobileControlsPosition.fromJson(
              json['mobileControlsPosition'] as String?,
            )
          : null,
      captionsEnabled: json['captionsEnabled'] as bool?,
      captionsLanguage: json['captionsLanguage'] as String?,
      autoMarkWatchedThreshold: (json['autoMarkWatchedThreshold'] as num?)
          ?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'autoplay': autoplay,
      if (defaultQuality != null) 'defaultQuality': defaultQuality,
      if (defaultSpeed != null) 'defaultSpeed': defaultSpeed,
      if (mobileControlsPosition != null)
        'mobileControlsPosition': mobileControlsPosition!.toJson(),
      if (captionsEnabled != null) 'captionsEnabled': captionsEnabled,
      if (captionsLanguage != null) 'captionsLanguage': captionsLanguage,
      if (autoMarkWatchedThreshold != null)
        'autoMarkWatchedThreshold': autoMarkWatchedThreshold,
    };
  }

  PlaybackSettings copyWith({
    bool? autoplay,
    String? defaultQuality,
    double? defaultSpeed,
    MobileControlsPosition? mobileControlsPosition,
    bool? captionsEnabled,
    String? captionsLanguage,
    double? autoMarkWatchedThreshold,
  }) {
    return PlaybackSettings(
      autoplay: autoplay ?? this.autoplay,
      defaultQuality: defaultQuality ?? this.defaultQuality,
      defaultSpeed: defaultSpeed ?? this.defaultSpeed,
      mobileControlsPosition:
          mobileControlsPosition ?? this.mobileControlsPosition,
      captionsEnabled: captionsEnabled ?? this.captionsEnabled,
      captionsLanguage: captionsLanguage ?? this.captionsLanguage,
      autoMarkWatchedThreshold:
          autoMarkWatchedThreshold ?? this.autoMarkWatchedThreshold,
    );
  }
}

/// Note-taking preferences.
class NoteSettings {
  final bool defaultTimestamped;
  final NoteSortOrder? sortOrder;

  const NoteSettings({this.defaultTimestamped = true, this.sortOrder});

  factory NoteSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const NoteSettings();
    return NoteSettings(
      defaultTimestamped: json['defaultTimestamped'] as bool? ?? true,
      sortOrder: json['sortOrder'] != null
          ? NoteSortOrder.fromJson(json['sortOrder'] as String?)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'defaultTimestamped': defaultTimestamped,
      if (sortOrder != null) 'sortOrder': sortOrder!.toJson(),
    };
  }

  NoteSettings copyWith({bool? defaultTimestamped, NoteSortOrder? sortOrder}) {
    return NoteSettings(
      defaultTimestamped: defaultTimestamped ?? this.defaultTimestamped,
      sortOrder: sortOrder ?? this.sortOrder,
    );
  }
}

/// YouTube channel auto-sync preferences.
class ChannelSyncSettings {
  final bool autoSyncOnVisit;

  /// Sync interval in minutes. 0 means disabled.
  final int? syncIntervalMinutes;

  /// Timestamp (ms since epoch) of last automatic sync.
  final int? lastAutoSyncAt;

  const ChannelSyncSettings({
    this.autoSyncOnVisit = false,
    this.syncIntervalMinutes,
    this.lastAutoSyncAt,
  });

  factory ChannelSyncSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const ChannelSyncSettings();
    return ChannelSyncSettings(
      autoSyncOnVisit: json['autoSyncOnVisit'] as bool? ?? false,
      syncIntervalMinutes: json['syncIntervalMinutes'] as int?,
      lastAutoSyncAt: json['lastAutoSyncAt'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'autoSyncOnVisit': autoSyncOnVisit,
      if (syncIntervalMinutes != null)
        'syncIntervalMinutes': syncIntervalMinutes,
      if (lastAutoSyncAt != null) 'lastAutoSyncAt': lastAutoSyncAt,
    };
  }

  ChannelSyncSettings copyWith({
    bool? autoSyncOnVisit,
    int? syncIntervalMinutes,
    int? lastAutoSyncAt,
  }) {
    return ChannelSyncSettings(
      autoSyncOnVisit: autoSyncOnVisit ?? this.autoSyncOnVisit,
      syncIntervalMinutes: syncIntervalMinutes ?? this.syncIntervalMinutes,
      lastAutoSyncAt: lastAutoSyncAt ?? this.lastAutoSyncAt,
    );
  }
}

/// Transcript generation preferences.
class TranscriptSettings {
  final TranscriptProvider? defaultProvider;
  final String? defaultLanguage;
  final bool? autoAttemptYoutubeCaptions;
  final bool? autoAttemptLocalFallback;
  final TranscriptSortBy? sortBy;

  const TranscriptSettings({
    this.defaultProvider,
    this.defaultLanguage,
    this.autoAttemptYoutubeCaptions,
    this.autoAttemptLocalFallback,
    this.sortBy,
  });

  factory TranscriptSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const TranscriptSettings();
    return TranscriptSettings(
      defaultProvider: json['defaultProvider'] != null
          ? TranscriptProvider.fromJson(json['defaultProvider'] as String?)
          : null,
      defaultLanguage: json['defaultLanguage'] as String?,
      autoAttemptYoutubeCaptions: json['autoAttemptYoutubeCaptions'] as bool?,
      autoAttemptLocalFallback: json['autoAttemptLocalFallback'] as bool?,
      sortBy: json['sortBy'] != null
          ? TranscriptSortBy.fromJson(json['sortBy'] as String?)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (defaultProvider != null) 'defaultProvider': defaultProvider!.toJson(),
      if (defaultLanguage != null) 'defaultLanguage': defaultLanguage,
      if (autoAttemptYoutubeCaptions != null)
        'autoAttemptYoutubeCaptions': autoAttemptYoutubeCaptions,
      if (autoAttemptLocalFallback != null)
        'autoAttemptLocalFallback': autoAttemptLocalFallback,
      if (sortBy != null) 'sortBy': sortBy!.toJson(),
    };
  }

  TranscriptSettings copyWith({
    TranscriptProvider? defaultProvider,
    String? defaultLanguage,
    bool? autoAttemptYoutubeCaptions,
    bool? autoAttemptLocalFallback,
    TranscriptSortBy? sortBy,
  }) {
    return TranscriptSettings(
      defaultProvider: defaultProvider ?? this.defaultProvider,
      defaultLanguage: defaultLanguage ?? this.defaultLanguage,
      autoAttemptYoutubeCaptions:
          autoAttemptYoutubeCaptions ?? this.autoAttemptYoutubeCaptions,
      autoAttemptLocalFallback:
          autoAttemptLocalFallback ?? this.autoAttemptLocalFallback,
      sortBy: sortBy ?? this.sortBy,
    );
  }
}

enum FeedTabPreference { all, subscriptions, playlists, history }

extension FeedTabPreferenceJson on FeedTabPreference {
  static FeedTabPreference? fromJson(String? value) {
    switch (value) {
      case 'all':
        return FeedTabPreference.all;
      case 'subscriptions':
        return FeedTabPreference.subscriptions;
      case 'playlists':
        return FeedTabPreference.playlists;
      case 'history':
        return FeedTabPreference.history;
      default:
        return null;
    }
  }

  String toJson() => name;
}

enum CollectionViewMode { list, grid }

extension CollectionViewModeJson on CollectionViewMode {
  static CollectionViewMode? fromJson(String? value) {
    switch (value) {
      case 'list':
        return CollectionViewMode.list;
      case 'grid':
        return CollectionViewMode.grid;
      default:
        return null;
    }
  }

  String toJson() => name;
}

enum DensityLayout { comfortable, compact }

extension DensityLayoutJson on DensityLayout {
  static DensityLayout? fromJson(String? value) {
    switch (value) {
      case 'comfortable':
        return DensityLayout.comfortable;
      case 'compact':
        return DensityLayout.compact;
      default:
        return null;
    }
  }

  String toJson() => name;
}

enum NotesViewMode { list, compact }

extension NotesViewModeJson on NotesViewMode {
  static NotesViewMode? fromJson(String? value) {
    switch (value) {
      case 'list':
        return NotesViewMode.list;
      case 'compact':
        return NotesViewMode.compact;
      default:
        return null;
    }
  }

  String toJson() => name;
}

enum PlayerLayoutPreference { defaultLayout, focus, theater }

extension PlayerLayoutPreferenceJson on PlayerLayoutPreference {
  static PlayerLayoutPreference? fromJson(String? value) {
    switch (value) {
      case 'default':
        return PlayerLayoutPreference.defaultLayout;
      case 'focus':
        return PlayerLayoutPreference.focus;
      case 'theater':
        return PlayerLayoutPreference.theater;
      default:
        return null;
    }
  }

  String toJson() {
    switch (this) {
      case PlayerLayoutPreference.defaultLayout:
        return 'default';
      case PlayerLayoutPreference.focus:
        return 'focus';
      case PlayerLayoutPreference.theater:
        return 'theater';
    }
  }
}

class UxFeedSettings {
  final FeedTabPreference? selectedTab;
  final CollectionViewMode? viewMode;
  final bool? showWatched;

  const UxFeedSettings({this.selectedTab, this.viewMode, this.showWatched});

  factory UxFeedSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const UxFeedSettings();
    return UxFeedSettings(
      selectedTab: FeedTabPreferenceJson.fromJson(
        _asString(json['selectedTab']),
      ),
      viewMode: CollectionViewModeJson.fromJson(_asString(json['viewMode'])),
      showWatched: _asBool(json['showWatched']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (selectedTab != null) 'selectedTab': selectedTab!.toJson(),
      if (viewMode != null) 'viewMode': viewMode!.toJson(),
      if (showWatched != null) 'showWatched': showWatched,
    };
  }
}

class UxPlaylistsSettings {
  final CollectionViewMode? viewMode;
  final DensityLayout? layout;
  final String? lastFilterPlaylistId;

  const UxPlaylistsSettings({
    this.viewMode,
    this.layout,
    this.lastFilterPlaylistId,
  });

  factory UxPlaylistsSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const UxPlaylistsSettings();
    return UxPlaylistsSettings(
      viewMode: CollectionViewModeJson.fromJson(_asString(json['viewMode'])),
      layout: DensityLayoutJson.fromJson(_asString(json['layout'])),
      lastFilterPlaylistId: _asString(json['lastFilterPlaylistId']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (viewMode != null) 'viewMode': viewMode!.toJson(),
      if (layout != null) 'layout': layout!.toJson(),
      if (lastFilterPlaylistId != null)
        'lastFilterPlaylistId': lastFilterPlaylistId,
    };
  }
}

class UxNotesSettings {
  final NoteSortOrder? sortOrder;
  final NotesViewMode? viewMode;

  const UxNotesSettings({this.sortOrder, this.viewMode});

  factory UxNotesSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const UxNotesSettings();
    return UxNotesSettings(
      sortOrder: json['sortOrder'] != null
          ? NoteSortOrder.fromJson(_asString(json['sortOrder']))
          : null,
      viewMode: NotesViewModeJson.fromJson(_asString(json['viewMode'])),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (sortOrder != null) 'sortOrder': sortOrder!.toJson(),
      if (viewMode != null) 'viewMode': viewMode!.toJson(),
    };
  }
}

class UxPlayerSettings {
  final PlayerLayoutPreference? layout;
  final bool? focusMode;
  final bool? shortcutsHintDismissed;

  const UxPlayerSettings({
    this.layout,
    this.focusMode,
    this.shortcutsHintDismissed,
  });

  factory UxPlayerSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const UxPlayerSettings();
    return UxPlayerSettings(
      layout: PlayerLayoutPreferenceJson.fromJson(_asString(json['layout'])),
      focusMode: _asBool(json['focusMode']),
      shortcutsHintDismissed: _asBool(json['shortcutsHintDismissed']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (layout != null) 'layout': layout!.toJson(),
      if (focusMode != null) 'focusMode': focusMode,
      if (shortcutsHintDismissed != null)
        'shortcutsHintDismissed': shortcutsHintDismissed,
    };
  }
}

class UxSettings {
  final List<String> dismissedHints;
  final UxFeedSettings feed;
  final UxPlaylistsSettings playlists;
  final UxNotesSettings notes;
  final UxPlayerSettings player;

  const UxSettings({
    this.dismissedHints = const [],
    this.feed = const UxFeedSettings(),
    this.playlists = const UxPlaylistsSettings(),
    this.notes = const UxNotesSettings(),
    this.player = const UxPlayerSettings(),
  });

  factory UxSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const UxSettings();
    return UxSettings(
      dismissedHints: _asStringList(json['dismissedHints']) ?? const [],
      feed: UxFeedSettings.fromJson(_asMap(json['feed'])),
      playlists: UxPlaylistsSettings.fromJson(_asMap(json['playlists'])),
      notes: UxNotesSettings.fromJson(_asMap(json['notes'])),
      player: UxPlayerSettings.fromJson(_asMap(json['player'])),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'dismissedHints': dismissedHints,
      if (feed.toJson().isNotEmpty) 'feed': feed.toJson(),
      if (playlists.toJson().isNotEmpty) 'playlists': playlists.toJson(),
      if (notes.toJson().isNotEmpty) 'notes': notes.toJson(),
      if (player.toJson().isNotEmpty) 'player': player.toJson(),
    };
  }
}

// ---------------------------------------------------------------------------
// Top-level settings model
// ---------------------------------------------------------------------------

/// Complete user settings document.
///
/// Maps to the `settings` table in Convex. All nested objects use sensible
/// defaults so the UI always has a valid settings state even when the
/// backend returns partial data.
class UserSettings {
  /// Convex document ID (`_id`).
  final String id;

  /// Auth provider user ID.
  final String userId;

  /// App theme preference.
  final AppThemeMode theme;

  /// BCP-47 language code (e.g. "en", "fr").
  final String? language;

  /// Notification preferences.
  final NotificationSettings notifications;

  /// Video playback preferences.
  final PlaybackSettings playback;

  /// Note-taking preferences.
  final NoteSettings notes;

  /// YouTube channel auto-sync preferences.
  final ChannelSyncSettings channelSync;

  /// Transcript generation preferences.
  final TranscriptSettings transcripts;

  /// Persisted UX preferences and dismissed helper hints.
  final UxSettings ux;

  /// Last update timestamp (ms since epoch).
  final int? updatedAt;

  const UserSettings({
    required this.id,
    required this.userId,
    this.theme = AppThemeMode.system,
    this.language,
    this.notifications = const NotificationSettings(),
    this.playback = const PlaybackSettings(),
    this.notes = const NoteSettings(),
    this.channelSync = const ChannelSyncSettings(),
    this.transcripts = const TranscriptSettings(),
    this.ux = const UxSettings(),
    this.updatedAt,
  });

  factory UserSettings.fromJson(Map<String, dynamic> json) {
    return UserSettings(
      id: json['_id'] as String,
      userId: json['userId'] as String,
      theme: AppThemeMode.fromJson(json['theme'] as String?),
      language: json['language'] as String?,
      notifications: NotificationSettings.fromJson(
        _asMap(json['notifications']),
      ),
      playback: PlaybackSettings.fromJson(_asMap(json['playback'])),
      notes: NoteSettings.fromJson(_asMap(json['notes'])),
      channelSync: ChannelSyncSettings.fromJson(_asMap(json['channelSync'])),
      transcripts: TranscriptSettings.fromJson(_asMap(json['transcripts'])),
      ux: UxSettings.fromJson(_asMap(json['ux'])),
      updatedAt: _asInt(json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'userId': userId,
      'theme': theme.toJson(),
      if (language != null) 'language': language,
      'notifications': notifications.toJson(),
      'playback': playback.toJson(),
      'notes': notes.toJson(),
      'channelSync': channelSync.toJson(),
      'transcripts': transcripts.toJson(),
      'ux': ux.toJson(),
      if (updatedAt != null) 'updatedAt': updatedAt,
    };
  }

  UserSettings copyWith({
    String? id,
    String? userId,
    AppThemeMode? theme,
    String? language,
    NotificationSettings? notifications,
    PlaybackSettings? playback,
    NoteSettings? notes,
    ChannelSyncSettings? channelSync,
    TranscriptSettings? transcripts,
    UxSettings? ux,
    int? updatedAt,
  }) {
    return UserSettings(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      theme: theme ?? this.theme,
      language: language ?? this.language,
      notifications: notifications ?? this.notifications,
      playback: playback ?? this.playback,
      notes: notes ?? this.notes,
      channelSync: channelSync ?? this.channelSync,
      transcripts: transcripts ?? this.transcripts,
      ux: ux ?? this.ux,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UserSettings &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'UserSettings(id: $id, userId: $userId)';
}
