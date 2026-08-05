import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:replayglowz_app/app/theme.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/i18n/translations.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/providers/mutations.dart';
import 'package:replayglowz_app/providers/providers.dart';
import 'package:replayglowz_app/utils/browser_environment.dart';
import 'package:replayglowz_app/utils/duration_utils.dart';
import 'package:replayglowz_app/widgets/app_states.dart';
import 'package:replayglowz_app/widgets/common_app_bar_actions.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';
import 'package:replayglowz_app/widgets/media/media_thumbnail.dart';
import 'package:replayglowz_app/widgets/notes/note_tile.dart';
import 'package:replayglowz_app/widgets/play/comments_placeholder.dart';
import 'package:replayglowz_app/widgets/play/player_panel.dart';
import 'package:replayglowz_app/widgets/play/web_youtube_embed.dart';
import 'package:replayglowz_app/widgets/transcripts/transcript_entry_tile.dart';
import 'package:replayglowz_app/widgets/ui_hint_card.dart';
import 'package:replayglowz_app/widgets/youtube_connect.dart';
import 'package:replayglowz_app/widgets/youtube_quota_guard.dart';

class _TranscriptEntry {
  const _TranscriptEntry({
    required this.startSeconds,
    required this.durationSeconds,
    required this.text,
    this.speaker,
  });

  final double startSeconds;
  final double durationSeconds;
  final String text;
  final String? speaker;

  double get endSeconds => startSeconds + durationSeconds;
}

class _ShortSurfaceButton extends StatelessWidget {
  const _ShortSurfaceButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: AppSizes.iconSmall),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(44),
        textStyle: theme.textTheme.labelMedium?.copyWith(
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _VideoPlaylistActionTarget {
  const _VideoPlaylistActionTarget({
    required this.youtubeVideoId,
    required this.title,
  });

  final String youtubeVideoId;
  final String title;
}

class _ChannelFeedActionTarget {
  const _ChannelFeedActionTarget({
    required this.youtubeVideoId,
    required this.sourceId,
    required this.sourceTitle,
  });

  final String youtubeVideoId;
  final String sourceId;
  final String sourceTitle;
}

class _ChannelFeedActionSelection {
  const _ChannelFeedActionSelection({required this.target, required this.feed});

  final _ChannelFeedActionTarget target;
  final VirtualFeed feed;
}

enum _ShortPanelKind { notes, transcript, comments }

enum _PlaybackMenuAction { hide, watched, playlist, channel }

class _TranscriptControlHeader extends StatelessWidget {
  const _TranscriptControlHeader({
    required this.language,
    required this.isGenerating,
    required this.jobAsync,
    required this.versionsAsync,
    required this.onGenerate,
    required this.onSelectVersion,
  });

  final String language;
  final bool isGenerating;
  final AsyncValue<TranscriptJob?> jobAsync;
  final AsyncValue<List<TranscriptVersion>> versionsAsync;
  final VoidCallback onGenerate;
  final Future<void> Function(String versionId) onSelectVersion;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Transcript · $language',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                FilledButton.icon(
                  onPressed: isGenerating ? null : onGenerate,
                  icon: isGenerating
                      ? const SizedBox(
                          width: AppSizes.iconSmall,
                          height: AppSizes.iconSmall,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.auto_awesome),
                  label: Text(isGenerating ? 'Generating...' : 'Generate'),
                ),
              ],
            ),
            jobAsync.when(
              data: (job) {
                if (job == null) return const SizedBox.shrink();
                final text =
                    job.errorMessage ?? job.progressMessage ?? job.status;
                return Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xs),
                  child: Row(
                    children: [
                      Icon(
                        job.isRunning ? Icons.sync : Icons.info_outline,
                        size: AppSizes.iconSmall,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(child: Text(text)),
                    ],
                  ),
                );
              },
              loading: () => const SizedBox.shrink(),
              error: (error, stack) => const SizedBox.shrink(),
            ),
            versionsAsync.when(
              data: (versions) {
                if (versions.isEmpty) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xs),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: versions
                        .map((version) {
                          final label =
                              '${version.provider?.toJson() ?? 'provider'} v${version.version}';
                          return ChoiceChip(
                            label: Text(label),
                            selected: version.isActive,
                            onSelected: version.isActive
                                ? null
                                : (_) => onSelectVersion(version.id),
                          );
                        })
                        .toList(growable: false),
                  ),
                );
              },
              loading: () => const Padding(
                padding: EdgeInsets.only(top: AppSpacing.xs),
                child: LinearProgressIndicator(),
              ),
              error: (error, stack) => const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

/// Video player screen with notes, transcript, and comments tabs.
///
/// Convex queries/mutations used:
/// - `youtube.getAllVideos` — resolve metadata and current playlist queue
/// - `youtube.getPlaylistVideos` — load the playlist queue drawer
/// - `notes.getNotesByYoutubeVideo` — fetch notes for the current video
/// - `notes.createNote` — create a timestamped note
/// - `notes.deleteNote` — remove a note
/// - `progress.getProgress` — load saved playback position
/// - `progress.upsertProgress` — save current playback position
/// - `transcripts.getActiveTranscript` / `youtube.getTranscript` — transcript
/// - `transcriptGeneration.generateTranscript` — generate transcript on demand
class PlayScreen extends ConsumerStatefulWidget {
  /// YouTube video ID of the video to play.
  final String videoId;
  final bool autoPlay;

  const PlayScreen({super.key, required this.videoId, this.autoPlay = false});

  @override
  ConsumerState<PlayScreen> createState() => _PlayScreenState();
}

class _PlayScreenState extends ConsumerState<PlayScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  static const _prefsFocusMode = 'play.pref.focusMode';
  static const _prefsBackgroundPlaybackHintDismissed =
      'play.pref.backgroundPlaybackHintDismissed';
  static const _playbackRates = <double>[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
  late final TabController _tabController;
  late final YoutubePlayerController _playerController;
  StreamSubscription<YoutubePlayerValue>? _playerValueSubscription;
  StreamSubscription<YoutubeVideoState>? _videoStateSubscription;
  final WebYoutubePlayerController _webPlayerController =
      WebYoutubePlayerController();
  final TextEditingController _noteController = TextEditingController();

  String _loadedVideoId = '';
  bool _isPlayerReady = false;
  bool _isPlaying = false;
  bool _progressRestored = false;
  bool _isGeneratingTranscript = false;
  int _lastSyncedSecond = -1;
  double _currentTimestamp = 0.0;
  double? _pendingSeekSeconds;
  double? _pendingPlaybackRate;
  int _activeTabIndex = 0;
  WebYoutubePlayerSnapshot _webPlayerSnapshot =
      const WebYoutubePlayerSnapshot();
  YouTubeVideo? _latestCurrentVideo;
  bool _focusMode = false;
  bool _showWebPosterOverlay = true;
  PlaybackPreviewDirection? _playbackPreviewDirection;
  bool _backgroundPlaybackHintDismissed = false;
  bool _backgroundPlaybackHintVisible = false;
  bool _isAppBackgrounded = false;
  bool _wasPlayingBeforeBackground = false;
  bool _playerPausedDuringBackground = false;
  DateTime? _backgroundedAt;
  _PlaybackMenuAction? _activePlaybackMenuAction;
  int _lastHandledPlaybackToggleRequestId = 0;
  int _lastHandledPlaybackPreviousRequestId = 0;
  int _lastHandledPlaybackNextRequestId = 0;
  int _lastHandledPlaybackSeekRequestId = 0;
  int _lastHandledHideCurrentVideoRequestId = 0;
  int _lastHandledMarkCurrentVideoWatchedRequestId = 0;
  int _lastHandledAddCurrentVideoToPlaylistRequestId = 0;
  int _lastHandledAddCurrentChannelToFeedRequestId = 0;
  int _lastHandledSpeedUpRequestId = 0;
  int _lastHandledSpeedDownRequestId = 0;
  int _lastHandledSpeedDeltaRequestId = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(_syncActiveTab);
    _loadedVideoId = widget.videoId;
    _showWebPosterOverlay = !widget.autoPlay;
    ref
        .read(appPlaybackControllerProvider.notifier)
        .setActiveVideo(widget.videoId.isNotEmpty);
    if (widget.videoId.isNotEmpty) {
      ref.read(activePlayVideoIdProvider.notifier).setVideoId(widget.videoId);
      ref.read(playbackSessionProvider.notifier).markCurrent(widget.videoId);
    }
    _playerController = YoutubePlayerController.fromVideoId(
      videoId: _initialPlayerVideoId(widget.videoId),
      autoPlay: widget.autoPlay,
      params: const YoutubePlayerParams(
        enableCaption: true,
        captionLanguage: 'en',
      ),
    );
    _playerValueSubscription = _playerController.stream.listen(
      _syncPlayerValue,
    );
    _videoStateSubscription = _playerController.videoStateStream.listen(
      _syncVideoState,
    );
    _loadPrefs();
  }

  @override
  void didUpdateWidget(covariant PlayScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoId == widget.videoId) {
      return;
    }

    _loadedVideoId = widget.videoId;
    _showWebPosterOverlay = !widget.autoPlay;
    ref
        .read(appPlaybackControllerProvider.notifier)
        .setActiveVideo(widget.videoId.isNotEmpty);
    if (widget.videoId.isNotEmpty) {
      ref.read(activePlayVideoIdProvider.notifier).setVideoId(widget.videoId);
      ref.read(playbackSessionProvider.notifier).markCurrent(widget.videoId);
    }
    _progressRestored = false;
    _currentTimestamp = 0;
    _pendingSeekSeconds = null;
    _pendingPlaybackRate = null;
    _lastSyncedSecond = -1;
    _webPlayerSnapshot = const WebYoutubePlayerSnapshot();
    _isPlaying = false;
    ref
        .read(appPlaybackControllerProvider.notifier)
        .setPlaybackPosition(currentSeconds: 0, durationSeconds: 0);
    ref.read(appPlaybackControllerProvider.notifier).setPlaying(false);
    _dismissPlaybackPreview(updateController: true);
    if (kIsWeb) {
      _isPlayerReady = false;
    }

    if (_isPlayerReady && _loadedVideoId.isNotEmpty && !kIsWeb) {
      _playerController.loadVideoById(videoId: _loadedVideoId);
      if (widget.autoPlay) {
        _playerController.playVideo();
      }
    }
  }

  @override
  void dispose() {
    _saveProgress();
    WidgetsBinding.instance.removeObserver(this);
    _tabController.removeListener(_syncActiveTab);
    _playerValueSubscription?.cancel();
    _videoStateSubscription?.cancel();
    _playerController.close();
    _tabController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  void _syncActiveTab() {
    if (!mounted || _activeTabIndex == _tabController.index) {
      return;
    }
    setState(() => _activeTabIndex = _tabController.index);
  }

  void _syncAppPlaybackState(bool isPlaying) {
    ref.read(appPlaybackControllerProvider.notifier).setPlaying(isPlaying);
  }

  void _syncAppPlaybackPosition({
    YouTubeVideo? currentVideo,
    double? currentSeconds,
  }) {
    ref
        .read(appPlaybackControllerProvider.notifier)
        .setPlaybackPosition(
          currentSeconds: currentSeconds ?? _currentTimestamp,
          durationSeconds: _resolvedDurationSeconds(currentVideo).toDouble(),
        );
  }

  void _setPlaybackPreview(PlaybackPreviewDirection? direction) {
    if (!mounted) return;

    setState(() => _playbackPreviewDirection = direction);
  }

  void _dismissPlaybackPreview({bool updateController = false}) {
    _playbackPreviewDirection = null;
    if (updateController) {
      ref.read(appPlaybackControllerProvider.notifier).hidePreview();
    }
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final focus = prefs.getBool(_prefsFocusMode) ?? false;
    final backgroundHintDismissed =
        prefs.getBool(_prefsBackgroundPlaybackHintDismissed) ?? false;
    if (!mounted) return;
    setState(() {
      _focusMode = focus;
      _backgroundPlaybackHintDismissed = backgroundHintDismissed;
    });
  }

  Future<void> _persistPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefsFocusMode, _focusMode);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (!kIsWeb) {
      return;
    }

    switch (state) {
      case AppLifecycleState.resumed:
        _handleAppResumed();
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
        _handleAppBackgrounded();
    }
  }

  void _handleAppBackgrounded() {
    if (_isAppBackgrounded) {
      return;
    }
    _isAppBackgrounded = true;
    _wasPlayingBeforeBackground = _isPlaying;
    _playerPausedDuringBackground = false;
    _backgroundedAt = DateTime.now();
  }

  void _handleAppResumed() {
    if (!_isAppBackgrounded) {
      return;
    }
    _isAppBackgrounded = false;
    _webPlayerController.requestSync();

    Future<void>.delayed(const Duration(milliseconds: 700), () {
      if (!mounted) {
        return;
      }
      _maybeShowBackgroundPlaybackInterruptionHint();
      _wasPlayingBeforeBackground = false;
      _playerPausedDuringBackground = false;
      _backgroundedAt = null;
    });
  }

  AppLocale _locale(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'fr'
      ? AppLocale.fr
      : AppLocale.en;

  /// Save playback progress to Convex on dispose / pause.
  Future<void> _saveProgress() async {
    if (_currentTimestamp <= 0 || widget.videoId.isEmpty) {
      return;
    }
    try {
      await upsertProgress(ref, widget.videoId, _currentTimestamp);
    } catch (_) {
      // Best-effort save; don't crash on dispose.
    }
  }

  void _syncPlayerValue(YoutubePlayerValue value) {
    if (kIsWeb) {
      return;
    }
    if (!mounted) return;

    var becameReady = false;
    if (!_isPlayerReady &&
        (value.playerState == PlayerState.cued ||
            value.playerState == PlayerState.playing ||
            value.playerState == PlayerState.paused)) {
      setState(() => _isPlayerReady = true);
      becameReady = true;
    }

    final playing = value.playerState == PlayerState.playing;
    ref
        .read(appPlaybackControllerProvider.notifier)
        .setPlaybackRate(value.playbackRate);
    if (becameReady) {
      _applyPendingPlaybackRate();
    }

    if (value.playerState == PlayerState.ended) {
      final playerDuration = value.metaData.duration.inSeconds.toDouble();
      setState(() {
        _isPlaying = false;
        _currentTimestamp = playerDuration;
      });
      _handlePlaybackEnded();
      return;
    }

    if (playing == _isPlaying) {
      return;
    }

    setState(() {
      _isPlaying = playing;
    });
    _syncAppPlaybackState(playing);
  }

  void _syncVideoState(YoutubeVideoState state) {
    if (kIsWeb || !mounted) {
      return;
    }

    final second = state.position.inSeconds;
    if (second == _lastSyncedSecond) {
      return;
    }

    _lastSyncedSecond = second;
    setState(() {
      _currentTimestamp = state.position.inMilliseconds / 1000;
    });
    _syncAppPlaybackPosition(currentSeconds: _currentTimestamp);
  }

  String _playbackMenuActionLabel(_PlaybackMenuAction action) {
    return switch (action) {
      _PlaybackMenuAction.hide => 'Hide',
      _PlaybackMenuAction.watched => 'Watched',
      _PlaybackMenuAction.playlist => 'Playlist',
      _PlaybackMenuAction.channel => 'Channel',
    };
  }

  bool _tryStartPlaybackMenuAction(_PlaybackMenuAction action) {
    final activeAction = _activePlaybackMenuAction;
    if (activeAction != null) {
      if (mounted && activeAction != action) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '${_playbackMenuActionLabel(activeAction)} is still in progress.',
            ),
          ),
        );
      }
      return false;
    }
    if (mounted) {
      setState(() => _activePlaybackMenuAction = action);
    } else {
      _activePlaybackMenuAction = action;
    }
    return true;
  }

  void _finishPlaybackMenuAction(_PlaybackMenuAction action) {
    if (_activePlaybackMenuAction != action) {
      return;
    }
    if (mounted) {
      setState(() => _activePlaybackMenuAction = null);
    } else {
      _activePlaybackMenuAction = null;
    }
  }

  Future<void> _runPlaybackMenuAction(
    _PlaybackMenuAction action,
    Future<void> Function() operation,
  ) async {
    if (!_tryStartPlaybackMenuAction(action)) {
      return;
    }
    try {
      await operation();
    } finally {
      _finishPlaybackMenuAction(action);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AppPlaybackControllerState>(appPlaybackControllerProvider, (
      previous,
      next,
    ) {
      if (next.toggleRequestId != _lastHandledPlaybackToggleRequestId) {
        _lastHandledPlaybackToggleRequestId = next.toggleRequestId;
        _togglePlayPause();
      }
      if (next.previousRequestId != _lastHandledPlaybackPreviousRequestId) {
        _lastHandledPlaybackPreviousRequestId = next.previousRequestId;
        _playPreviousFeedVideo();
      }
      if (next.nextRequestId != _lastHandledPlaybackNextRequestId) {
        _lastHandledPlaybackNextRequestId = next.nextRequestId;
        _playNextFeedVideo();
      }
      if (next.seekRequestId != _lastHandledPlaybackSeekRequestId) {
        _lastHandledPlaybackSeekRequestId = next.seekRequestId;
        _seekToSeconds(next.seekSeconds);
      }
      if (next.previewDirection != previous?.previewDirection) {
        _setPlaybackPreview(next.previewDirection);
      }
      if (next.hideCurrentVideoRequestId !=
          _lastHandledHideCurrentVideoRequestId) {
        _lastHandledHideCurrentVideoRequestId = next.hideCurrentVideoRequestId;
        unawaited(
          _runPlaybackMenuAction(
            _PlaybackMenuAction.hide,
            _hideCurrentVideoFromPlaybackBar,
          ),
        );
      }
      if (next.markCurrentVideoWatchedRequestId !=
          _lastHandledMarkCurrentVideoWatchedRequestId) {
        _lastHandledMarkCurrentVideoWatchedRequestId =
            next.markCurrentVideoWatchedRequestId;
        unawaited(
          _runPlaybackMenuAction(
            _PlaybackMenuAction.watched,
            _markCurrentVideoWatchedFromPlaybackBar,
          ),
        );
      }
      if (next.addCurrentVideoToPlaylistRequestId !=
          _lastHandledAddCurrentVideoToPlaylistRequestId) {
        _lastHandledAddCurrentVideoToPlaylistRequestId =
            next.addCurrentVideoToPlaylistRequestId;
        unawaited(
          _runPlaybackMenuAction(
            _PlaybackMenuAction.playlist,
            _showAddCurrentVideoToPlaylistSheet,
          ),
        );
      }
      if (next.addCurrentChannelToFeedRequestId !=
          _lastHandledAddCurrentChannelToFeedRequestId) {
        _lastHandledAddCurrentChannelToFeedRequestId =
            next.addCurrentChannelToFeedRequestId;
        unawaited(
          _runPlaybackMenuAction(
            _PlaybackMenuAction.channel,
            _showAddCurrentChannelToFeedSheet,
          ),
        );
      }
      if (next.speedUpRequestId != _lastHandledSpeedUpRequestId) {
        _lastHandledSpeedUpRequestId = next.speedUpRequestId;
        _changePlaybackRate(forward: true);
      }
      if (next.speedDownRequestId != _lastHandledSpeedDownRequestId) {
        _lastHandledSpeedDownRequestId = next.speedDownRequestId;
        _changePlaybackRate(forward: false);
      }
      if (next.speedDeltaRequestId != _lastHandledSpeedDeltaRequestId) {
        _lastHandledSpeedDeltaRequestId = next.speedDeltaRequestId;
        _adjustPlaybackRate(next.speedDelta);
      }
    });

    final youtubeConnectionAsync = ref.watch(youtubeConnectionProvider);
    final youtubeConnected =
        youtubeConnectionAsync.asData?.value?['connected'] == true;
    final hasVideoId = widget.videoId.isNotEmpty;

    final notesAsync = youtubeConnected && hasVideoId
        ? ref.watch(videoNotesProvider(widget.videoId))
        : const AsyncValue<List<Note>>.data(<Note>[]);
    final progressAsync = youtubeConnected && hasVideoId
        ? ref.watch(videoProgressProvider(widget.videoId))
        : const AsyncValue<VideoProgress?>.data(null);
    final libraryVideosAsync = youtubeConnected && hasVideoId
        ? ref.watch(
            videosProvider(
              const VideosArgs(sortOrder: 'newest', includeWatched: true),
            ),
          )
        : const AsyncValue<List<YouTubeVideo>>.data(<YouTubeVideo>[]);

    final settings = ref.watch(settingsProvider).asData?.value;
    final transcriptLanguage = _effectiveTranscriptLanguage(settings);
    final isTranscriptTabActive = _activeTabIndex == 1;
    final transcriptAsync =
        youtubeConnected && hasVideoId && isTranscriptTabActive
        ? ref.watch(
            activeTranscriptProvider(
              TranscriptArgs(
                youtubeVideoId: widget.videoId,
                language: transcriptLanguage,
              ),
            ),
          )
        : const AsyncValue<Map<String, dynamic>?>.data(null);

    // Restore saved progress once per video load.
    progressAsync.whenData((progress) {
      if (_progressRestored ||
          progress == null ||
          progress.progressSeconds <= 0) {
        return;
      }
      _progressRestored = true;
      final resumeAt = progress.progressSeconds;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() => _currentTimestamp = resumeAt);
        _seekToSeconds(resumeAt);
      });
    });

    final libraryVideos =
        libraryVideosAsync.asData?.value ?? const <YouTubeVideo>[];
    final currentVideo = _findLibraryVideo(libraryVideos, widget.videoId);
    _latestCurrentVideo = currentVideo;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _syncAppPlaybackPosition(currentVideo: currentVideo);
    });
    final playerTitle = _playerController.metadata.title.trim();
    final title =
        currentVideo?.title ??
        (playerTitle.isEmpty ? 'Now Playing' : playerTitle);
    final l = _locale(context);
    final mediaQuery = MediaQuery.of(context);
    final useShortLayout =
        !_focusMode &&
        mediaQuery.size.width < 600 &&
        mediaQuery.orientation == Orientation.portrait &&
        _isShortFormVideo(currentVideo);

    return Scaffold(
      appBar: AppBar(
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            icon: Icon(
              _focusMode
                  ? Icons.center_focus_strong
                  : Icons.panorama_horizontal,
            ),
            tooltip: t('p3.play.focusMode', locale: l),
            onPressed: () {
              setState(() => _focusMode = !_focusMode);
              _persistPrefs();
            },
          ),
          IconButton(
            icon: const Icon(Icons.keyboard_outlined),
            tooltip: t('p3.play.shortcuts', locale: l),
            onPressed: () => _showShortcutsOverlay(l),
          ),
          IconButton(
            icon: const Icon(Icons.playlist_play),
            tooltip: 'Up next',
            onPressed: () async {
              if (!youtubeConnected) {
                await startYoutubeConnectFlow(context, returnTo: Routes.play);
                return;
              }
              await _showQueueDrawer();
            },
          ),
          IconButton(
            icon: const Icon(Icons.more_vert),
            tooltip: 'Video options',
            onPressed: () => _showVideoOptions(currentVideo),
          ),
          ...commonAppBarActions(context, ref),
        ],
      ),
      body: youtubeConnectionAsync.when(
        data: (status) {
          if (status?['connected'] != true) {
            return const YoutubeConnectRequiredState(
              title: 'Connect YouTube to watch and take notes',
              description:
                  'Playback, transcript lookups, and timestamped notes all depend on your YouTube library being connected first.',
              returnTo: Routes.play,
            );
          }

          if (!hasVideoId) {
            return Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.play_circle_outline_rounded,
                        size: AppSizes.emptyStateIcon,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Choose a video to start playback',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Open Feed or Playlists, then select a synced YouTube video to unlock playback, transcript, and notes.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          return CallbackShortcuts(
            bindings: _shortcutBindings(l),
            child: Focus(
              autofocus: true,
              child: useShortLayout
                  ? _buildShortMobileLayout(
                      currentVideo: currentVideo,
                      libraryVideosAsync: libraryVideosAsync,
                      notesAsync: notesAsync,
                      transcriptLanguage: transcriptLanguage,
                    )
                  : Column(
                      children: [
                        _buildPlayerSurface(
                          libraryVideosAsync,
                          useShortAspectRatio: false,
                        ),
                        if (!_focusMode &&
                            MediaQuery.sizeOf(context).width < 600)
                          UiHintCard(
                            hintId: 'play-mobile-bottom-bar-actions',
                            icon: Icons.touch_app_outlined,
                            title: t(
                              'playPage.mobileControlsHintTitle',
                              locale: l,
                            ),
                            message: t(
                              'playPage.mobileControlsHintMessage',
                              locale: l,
                            ),
                          ),
                        if (!_focusMode)
                          UiHintCard(
                            hintId: 'play-shortcuts-hint',
                            icon: Icons.keyboard,
                            title: t('p3.play.hintTitle', locale: l),
                            message: t('p3.play.hintMessage', locale: l),
                            actionLabel: t('p3.play.shortcuts', locale: l),
                            onAction: () => _showShortcutsOverlay(l),
                          ),
                        if (!_focusMode)
                          TabBar(
                            controller: _tabController,
                            tabs: const [
                              Tab(text: 'Notes'),
                              Tab(text: 'Transcript'),
                              Tab(text: 'Comments'),
                            ],
                          ),
                        Expanded(
                          child: _focusMode
                              ? _buildNotesTab(notesAsync)
                              : TabBarView(
                                  controller: _tabController,
                                  children: [
                                    _buildNotesTab(notesAsync),
                                    isTranscriptTabActive
                                        ? _buildTranscriptTab(
                                            transcriptAsync,
                                            language: transcriptLanguage,
                                          )
                                        : const SizedBox.shrink(),
                                    _buildCommentsTab(),
                                  ],
                                ),
                        ),
                      ],
                    ),
            ),
          );
        },
        loading: () => const YoutubeConnectionLoadingState(
          title: 'Checking playback access',
          description:
              'ReplayGlowz is confirming your YouTube connection before opening the player.',
        ),
        error: (error, stack) => ErrorStateView(
          error: error,
          prefix: 'Failed to check YouTube connection',
          onRetry: () => ref.invalidate(youtubeConnectionProvider),
        ),
      ),
    );
  }

  bool _isTypingInInput() {
    final focused = FocusManager.instance.primaryFocus;
    final focusContext = focused?.context;
    if (focusContext == null) return false;
    if (focusContext.widget is EditableText) return true;

    var hasEditableAncestor = false;
    focusContext.visitAncestorElements((element) {
      if (element.widget is EditableText) {
        hasEditableAncestor = true;
        return false;
      }
      return true;
    });
    return hasEditableAncestor;
  }

  Map<ShortcutActivator, VoidCallback> _shortcutBindings(AppLocale l) {
    return <ShortcutActivator, VoidCallback>{
      const SingleActivator(LogicalKeyboardKey.space): () {
        if (_isTypingInInput()) return;
        _togglePlayPause();
      },
      const SingleActivator(LogicalKeyboardKey.arrowLeft): () {
        if (_isTypingInInput()) return;
        _seekToSeconds(_currentTimestamp - 10);
      },
      const SingleActivator(LogicalKeyboardKey.arrowRight): () {
        if (_isTypingInInput()) return;
        _seekToSeconds(_currentTimestamp + 10);
      },
      const SingleActivator(LogicalKeyboardKey.slash): () {
        if (_isTypingInInput()) return;
        _showShortcutsOverlay(l);
      },
    };
  }

  Future<void> _showShortcutsOverlay(AppLocale l) async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(t('p3.play.shortcuts', locale: l)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Space: ${t('p3.play.shortcutPlayPause', locale: l)}'),
            Text('← / →: ${t('p3.play.shortcutSeek', locale: l)}'),
            Text('/: ${t('p3.play.shortcutHelp', locale: l)}'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayerSurface(
    AsyncValue<List<YouTubeVideo>> libraryVideosAsync, {
    required bool useShortAspectRatio,
  }) {
    final session = ref.watch(playbackSessionProvider);
    final previousVideoId = session.previousBefore(widget.videoId);
    final nextVideoId = session.nextAfter(widget.videoId);
    final libraryVideos =
        libraryVideosAsync.asData?.value ?? const <YouTubeVideo>[];
    final previousVideo = _findLibraryVideo(libraryVideos, previousVideoId);
    final nextVideo = _findLibraryVideo(libraryVideos, nextVideoId);
    final currentVideo = _findLibraryVideo(libraryVideos, widget.videoId);

    String? previewVideoId;
    YouTubeVideo? previewVideo;
    PlaybackQueueItem? previewItem;
    IconData? previewIcon;
    String? previewLabel;
    switch (_playbackPreviewDirection) {
      case PlaybackPreviewDirection.previous:
        previewVideoId = previousVideoId;
        previewVideo = previousVideo;
        previewIcon = Icons.skip_previous_rounded;
        previewLabel = 'Previous';
      case PlaybackPreviewDirection.next:
        previewVideoId = nextVideoId;
        previewVideo = nextVideo;
        previewIcon = Icons.skip_next_rounded;
        previewLabel = 'Next';
      case null:
        break;
    }
    if (previewVideoId != null) {
      previewItem = session.itemFor(previewVideoId);
    }

    return Stack(
      children: [
        _buildPlayerArea(
          currentVideo,
          aspectRatio: useShortAspectRatio ? 9 / 16 : 16 / 9,
        ),
        if (previewVideoId != null &&
            previewIcon != null &&
            previewLabel != null)
          _buildPlaybackPreviewOverlay(
            videoId: previewVideoId,
            video: previewVideo,
            item: previewItem,
            icon: previewIcon,
            label: previewLabel,
          ),
      ],
    );
  }

  YouTubeVideo? _findLibraryVideo(List<YouTubeVideo> videos, String? videoId) {
    if (videoId == null || videoId.isEmpty) return null;
    for (final video in videos) {
      if (video.youtubeVideoId == videoId) {
        return video;
      }
    }
    return null;
  }

  Widget _buildPlaybackPreviewOverlay({
    required String videoId,
    required YouTubeVideo? video,
    required PlaybackQueueItem? item,
    required IconData icon,
    required String label,
  }) {
    final theme = Theme.of(context);
    final title = video?.title ?? item?.title ?? 'Queued video';
    final channelTitle = video?.channelTitle;
    final thumbnailUrl =
        video?.thumbnailUrl ??
        item?.thumbnailUrl ??
        'https://img.youtube.com/vi/$videoId/hqdefault.jpg';

    return Positioned.fill(
      child: IgnorePointer(
        child: AnimatedOpacity(
          duration: AppMotion.fast,
          opacity: 1,
          child: Stack(
            fit: StackFit.expand,
            children: [
              MediaThumbnail(
                imageUrl: thumbnailUrl,
                width: double.infinity,
                height: double.infinity,
                fit: BoxFit.cover,
              ),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      theme.colorScheme.scrim.withValues(alpha: 0.22),
                      theme.colorScheme.scrim.withValues(alpha: 0.04),
                      theme.colorScheme.scrim.withValues(alpha: 0.28),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md2),
                child: Align(
                  alignment: Alignment.bottomLeft,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Icon(
                        icon,
                        color: theme.colorScheme.onPrimary,
                        size: AppSizes.iconLarge,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              label,
                              style: theme.textTheme.labelLarge?.copyWith(
                                color: theme.colorScheme.onPrimary.withValues(
                                  alpha: 0.7,
                                ),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xxs),
                            Text(
                              title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleMedium?.copyWith(
                                color: theme.colorScheme.onPrimary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            if (channelTitle != null &&
                                channelTitle.isNotEmpty) ...[
                              const SizedBox(height: AppSpacing.xxs),
                              Text(
                                channelTitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onPrimary.withValues(
                                    alpha: 0.78,
                                  ),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPlayerArea(
    YouTubeVideo? currentVideo, {
    required double aspectRatio,
  }) {
    return PlayerPanel(
      videoId: _loadedVideoId,
      aspectRatio: aspectRatio,
      controller: _playerController,
      webController: _webPlayerController,
      onWebStateChanged: _handleWebPlayerSnapshot,
      showPoster: kIsWeb && _showWebPosterOverlay,
      posterThumbnailUrl:
          currentVideo?.thumbnailUrl ??
          (_loadedVideoId.isNotEmpty
              ? 'https://img.youtube.com/vi/$_loadedVideoId/hqdefault.jpg'
              : null),
      posterTitle: currentVideo?.title,
      posterChannelTitle: currentVideo?.channelTitle,
      posterChannelThumbnailUrl: currentVideo?.channelThumbnailUrl,
      onPosterPlay: _playFromPoster,
      onReady: () {
        if (!mounted) return;
        if (!_isPlayerReady) {
          setState(() => _isPlayerReady = true);
        }
        if (!kIsWeb &&
            _loadedVideoId.isNotEmpty &&
            _playerController.metadata.videoId != _loadedVideoId) {
          _playerController.loadVideoById(videoId: _loadedVideoId);
        }
        final pendingSeek = _pendingSeekSeconds;
        if (pendingSeek != null) {
          _pendingSeekSeconds = null;
          _seekToSeconds(pendingSeek);
        }
        _applyPendingPlaybackRate();
        if (widget.autoPlay && kIsWeb && _loadedVideoId.isNotEmpty) {
          setState(() => _showWebPosterOverlay = false);
          _webPlayerController.play();
        }
      },
      onEnded: () {
        if (kIsWeb) return;
        final playerDuration = _playerController.metadata.duration.inSeconds
            .toDouble();
        setState(() {
          _isPlaying = false;
          _currentTimestamp = playerDuration;
        });
        _handlePlaybackEnded();
      },
    );
  }

  Widget _buildShortMobileLayout({
    required YouTubeVideo? currentVideo,
    required AsyncValue<List<YouTubeVideo>> libraryVideosAsync,
    required AsyncValue<List<Note>> notesAsync,
    required String transcriptLanguage,
  }) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Center(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final playerWidth = math.min(
                    constraints.maxWidth,
                    constraints.maxHeight * (9 / 16),
                  );
                  return SizedBox(
                    width: playerWidth,
                    child: _buildPlayerSurface(
                      libraryVideosAsync,
                      useShortAspectRatio: true,
                    ),
                  );
                },
              ),
            ),
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: _ShortSurfaceButton(
                    icon: Icons.note_alt_outlined,
                    label: 'Notes',
                    onPressed: () => _showShortPanelSheet(
                      _ShortPanelKind.notes,
                      notesAsync: notesAsync,
                      transcriptLanguage: transcriptLanguage,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: _ShortSurfaceButton(
                    icon: Icons.subtitles_outlined,
                    label: 'Transcript',
                    onPressed: () => _showShortPanelSheet(
                      _ShortPanelKind.transcript,
                      notesAsync: notesAsync,
                      transcriptLanguage: transcriptLanguage,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: _ShortSurfaceButton(
                    icon: Icons.forum_outlined,
                    label: 'Comments',
                    onPressed: () => _showShortPanelSheet(
                      _ShortPanelKind.comments,
                      notesAsync: notesAsync,
                      transcriptLanguage: transcriptLanguage,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          child: Text(
            currentVideo?.title ?? 'Short',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _showShortPanelSheet(
    _ShortPanelKind kind, {
    required AsyncValue<List<Note>> notesAsync,
    required String transcriptLanguage,
  }) async {
    final title = switch (kind) {
      _ShortPanelKind.notes => 'Notes',
      _ShortPanelKind.transcript => 'Transcript',
      _ShortPanelKind.comments => 'Comments',
    };

    if (kind == _ShortPanelKind.transcript && _activeTabIndex != 1) {
      setState(() => _activeTabIndex = 1);
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: SizedBox(
            height: MediaQuery.sizeOf(sheetContext).height * 0.72,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: Theme.of(sheetContext).textTheme.titleMedium,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Consumer(
                    builder: (context, ref, _) {
                      switch (kind) {
                        case _ShortPanelKind.notes:
                          return _buildNotesTab(notesAsync);
                        case _ShortPanelKind.transcript:
                          final transcriptAsync = ref.watch(
                            activeTranscriptProvider(
                              TranscriptArgs(
                                youtubeVideoId: widget.videoId,
                                language: transcriptLanguage,
                              ),
                            ),
                          );
                          return _buildTranscriptTab(
                            transcriptAsync,
                            language: transcriptLanguage,
                          );
                        case _ShortPanelKind.comments:
                          return _buildCommentsTab();
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  bool _isShortFormVideo(YouTubeVideo? currentVideo) {
    if (currentVideo?.isProbablyShortForm == true) {
      return true;
    }

    final fallbackDuration = _resolvedDurationSeconds(currentVideo);
    if (fallbackDuration > 0 && fallbackDuration <= 60) {
      return true;
    }

    final playerTitle = _playerController.metadata.title.toLowerCase();
    return playerTitle.contains('#shorts') || playerTitle.contains('/shorts/');
  }

  Widget _buildNotesTab(AsyncValue<List<Note>> notesAsync) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _noteController,
                  decoration: InputDecoration(
                    hintText:
                        'Add a note at ${_formatTime(_currentTimestamp)}...',
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  maxLines: 2,
                  minLines: 1,
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              IconButton.filled(
                icon: const Icon(Icons.send),
                onPressed: () async {
                  final content = _noteController.text.trim();
                  if (content.isEmpty || widget.videoId.isEmpty) return;
                  try {
                    await createNote(
                      ref,
                      videoId: widget.videoId,
                      content: content,
                      timestamp: _currentTimestamp,
                    );
                    _noteController.clear();
                  } catch (e) {
                    if (!mounted) return;
                    showErrorSnackBar(
                      context,
                      error: e,
                      prefix: 'Failed to save note',
                    );
                  }
                },
              ),
            ],
          ),
        ),
        const Divider(height: AppElevation.raised),
        Expanded(
          child: notesAsync.when(
            data: (notes) {
              if (notes.isEmpty) {
                return const AppEmptyState(
                  icon: Icons.note_add_outlined,
                  title: 'No notes yet',
                  description:
                      'Add a note above to keep timestamped highlights.',
                  maxWidth: 360,
                );
              }
              return ListView.builder(
                padding: const EdgeInsets.all(AppSpacing.sm),
                itemCount: notes.length,
                itemBuilder: (context, index) {
                  final note = notes[index];
                  return NoteTile(
                    content: note.content,
                    timestampLabel: note.isTimestamped
                        ? '[${note.formattedTimestamp}]'
                        : null,
                    onTimestampTap: note.isTimestamped
                        ? () => _seekToSeconds(note.timestamp!)
                        : null,
                    trailing: IconButton(
                      icon: const Icon(
                        Icons.delete_outline,
                        size: AppSizes.iconMedium,
                      ),
                      onPressed: () async {
                        try {
                          await deleteNote(ref, note.id);
                        } catch (e) {
                          if (context.mounted) {
                            showErrorSnackBar(
                              context,
                              error: e,
                              prefix: 'Failed to delete note',
                            );
                          }
                        }
                      },
                    ),
                  );
                },
              );
            },
            loading: () => AppLoadingListSkeleton(
              itemCount: 3,
              padding: const EdgeInsets.all(AppSpacing.sm),
              itemBuilder: (context, index) => Card(
                margin: const EdgeInsets.only(bottom: AppSpacing.xs),
                child: Container(
                  height: 56,
                  color: Theme.of(context).colorScheme.surface,
                ),
              ),
            ),
            error: (error, stack) =>
                ErrorStateView(error: error, prefix: 'Failed to load notes'),
          ),
        ),
      ],
    );
  }

  Widget _buildTranscriptTab(
    AsyncValue<Map<String, dynamic>?> transcriptAsync, {
    required String language,
  }) {
    final args = TranscriptArgs(
      youtubeVideoId: widget.videoId,
      language: language,
    );
    final versionsAsync = ref.watch(transcriptVersionsProvider(args));
    final jobAsync = ref.watch(latestTranscriptJobProvider(args));

    return transcriptAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stack) => ErrorStateView(
        error: error,
        prefix: 'Failed to load transcript',
        onRetry: () => ref.invalidate(
          activeTranscriptProvider(
            TranscriptArgs(youtubeVideoId: widget.videoId, language: language),
          ),
        ),
      ),
      data: (rawTranscript) {
        final entries = _parseTranscriptEntries(rawTranscript);
        final header = _TranscriptControlHeader(
          language: language,
          isGenerating: _isGeneratingTranscript,
          jobAsync: jobAsync,
          versionsAsync: versionsAsync,
          onGenerate: () => _generateTranscript(language),
          onSelectVersion: (versionId) => selectTranscriptVersion(
            ref,
            versionId: versionId,
            youtubeVideoId: widget.videoId,
            language: language,
          ),
        );

        if (entries.isEmpty) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              header,
              const SizedBox(height: AppSpacing.lg),
              Icon(
                Icons.subtitles_off,
                size: 40,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                'No transcript available yet.',
                textAlign: TextAlign.center,
              ),
            ],
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(AppSpacing.sm),
          itemCount: entries.length + 1,
          itemBuilder: (context, index) {
            if (index == 0) return header;
            final entry = entries[index - 1];
            final isActive =
                _currentTimestamp >= entry.startSeconds &&
                _currentTimestamp < entry.endSeconds;
            return TranscriptEntryTile(
              timestampLabel: _formatTime(entry.startSeconds),
              text: entry.text,
              speaker: entry.speaker,
              isActive: isActive,
              onTap: () => _seekToSeconds(entry.startSeconds),
            );
          },
        );
      },
    );
  }

  Widget _buildCommentsTab() {
    return const CommentsPlaceholderPanel();
  }

  String _effectiveTranscriptLanguage(UserSettings? settings) {
    final preferred = settings?.transcripts.defaultLanguage?.trim();
    if (preferred != null && preferred.isNotEmpty) {
      return preferred;
    }
    return 'en';
  }

  String _initialPlayerVideoId(String videoId) {
    if (videoId.length == 11) {
      return videoId;
    }
    // Stable fallback so the controller can initialize even before route state
    // resolves a valid video.
    return 'M7lc1UVf-VE';
  }

  int _resolvedDurationSeconds(YouTubeVideo? currentVideo) {
    if (kIsWeb) {
      final webDuration = _webPlayerSnapshot.durationSeconds.round();
      if (webDuration > 0) {
        return webDuration;
      }
    }
    final playerDuration = _playerController.metadata.duration.inSeconds;
    if (playerDuration > 0) {
      return playerDuration;
    }
    final parsed = parseDuration(currentVideo?.duration);
    if (parsed != null && parsed > 0) {
      return parsed;
    }
    return 0;
  }

  void _seekToSeconds(double seconds) {
    final duration = kIsWeb
        ? _webPlayerSnapshot.durationSeconds
        : _playerController.metadata.duration.inSeconds.toDouble();
    final max = duration > 0 ? duration : math.max(seconds, 0.0);
    final clamped = seconds.clamp(0, max).toDouble();
    setState(() => _currentTimestamp = clamped);
    _syncAppPlaybackPosition(currentSeconds: clamped);

    if (!_isPlayerReady) {
      _pendingSeekSeconds = clamped;
      return;
    }

    _pendingSeekSeconds = null;
    if (kIsWeb) {
      _webPlayerController.seekTo(clamped);
      return;
    }

    _playerController.seekTo(seconds: clamped, allowSeekAhead: true);
  }

  void _togglePlayPause() {
    if (!_isPlayerReady) {
      return;
    }
    if (_isPlaying) {
      if (kIsWeb) {
        _webPlayerController.pause();
      } else {
        _playerController.pauseVideo();
      }
      _syncAppPlaybackState(false);
      _saveProgress();
    } else {
      if (kIsWeb) {
        if (_showWebPosterOverlay) {
          setState(() => _showWebPosterOverlay = false);
        }
        _webPlayerController.play();
      } else {
        _playerController.playVideo();
      }
      _syncAppPlaybackState(true);
    }
  }

  void _playFromPoster() {
    if (!_isPlayerReady || !kIsWeb) {
      return;
    }
    if (_showWebPosterOverlay) {
      setState(() => _showWebPosterOverlay = false);
    }
    _webPlayerController.play();
    _syncAppPlaybackState(true);
  }

  double get _currentPlaybackRate {
    final rate = kIsWeb
        ? _webPlayerSnapshot.playbackRate
        : _playerController.value.playbackRate;
    if (!rate.isFinite || rate <= 0) {
      return 1;
    }
    return rate;
  }

  double _normalizedPlaybackRate(double rate) {
    if (!rate.isFinite || rate <= 0) return 1;
    return rate.clamp(_playbackRates.first, _playbackRates.last).toDouble();
  }

  void _applyPendingPlaybackRate() {
    final pendingRate = _pendingPlaybackRate;
    if (!_isPlayerReady || pendingRate == null) return;
    _pendingPlaybackRate = null;
    _applyPlaybackRate(pendingRate);
  }

  void _queueOrApplyPlaybackRate(double rate) {
    final nextRate = _normalizedPlaybackRate(rate);
    ref.read(appPlaybackControllerProvider.notifier).setPlaybackRate(nextRate);
    if (!_isPlayerReady) {
      _pendingPlaybackRate = nextRate;
      return;
    }
    _pendingPlaybackRate = null;
    _applyPlaybackRate(nextRate);
  }

  void _applyPlaybackRate(double rate) {
    final nextRate = _normalizedPlaybackRate(rate);
    if (kIsWeb) {
      _webPlayerController.setPlaybackRate(nextRate);
    } else {
      _playerController.setPlaybackRate(nextRate);
    }
    ref.read(appPlaybackControllerProvider.notifier).setPlaybackRate(nextRate);
  }

  void _changePlaybackRate({required bool forward}) {
    final current = _pendingPlaybackRate ?? _currentPlaybackRate;
    final nextRate = forward
        ? _playbackRates.firstWhere(
            (rate) => rate > current + 0.01,
            orElse: () => _playbackRates.last,
          )
        : _playbackRates.lastWhere(
            (rate) => rate < current - 0.01,
            orElse: () => _playbackRates.first,
          );

    if ((nextRate - current).abs() < 0.001) {
      return;
    }

    _queueOrApplyPlaybackRate(nextRate);
  }

  void _adjustPlaybackRate(double delta) {
    if (!delta.isFinite || delta == 0) {
      return;
    }

    final current = _pendingPlaybackRate ?? _currentPlaybackRate;
    final nextRate = (current + delta)
        .clamp(_playbackRates.first, _playbackRates.last)
        .toDouble();
    if ((nextRate - current).abs() < 0.001) {
      return;
    }

    _queueOrApplyPlaybackRate(nextRate);
  }

  Future<void> _hideCurrentVideoFromPlaybackBar() async {
    final videoId = widget.videoId;
    if (videoId.isEmpty) return;

    try {
      await hideVideo(ref, videoId);
      ref
        ..invalidate(hiddenItemsProvider)
        ..invalidate(videosProvider);
      if (!mounted) return;
      ref.read(activePlayVideoIdProvider.notifier).clear();
      final playbackNotifier = ref.read(appPlaybackControllerProvider.notifier);
      playbackNotifier
        ..setPlaying(false)
        ..setActiveVideo(false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Video hidden from library.')),
      );
      context.go(Routes.videos);
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Could not hide video');
    }
  }

  Future<void> _markCurrentVideoWatchedFromPlaybackBar() async {
    final videoId = widget.videoId;
    if (videoId.isEmpty) return;

    try {
      await markWatched(ref, videoId);
      ref
        ..invalidate(watchedVideosProvider)
        ..invalidate(videosProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Marked watched.')));
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Could not mark watched');
    }
  }

  Future<void> _showAddCurrentVideoToPlaylistSheet() async {
    final target = await _resolveCurrentVideoForPlaylistAction();
    if (target == null || target.youtubeVideoId.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Open a video before adding it.')),
      );
      return;
    }
    if (!mounted) return;

    final selectedPlaylist = await showModalBottomSheet<YouTubePlaylist>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        final theme = Theme.of(sheetContext);
        final maxHeight = MediaQuery.sizeOf(sheetContext).height * 0.72;
        return SafeArea(
          child: Consumer(
            builder: (context, ref, _) {
              final playlistsAsync = ref.watch(playlistsProvider);
              return ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: 240,
                  maxHeight: maxHeight,
                ),
                child: playlistsAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (error, stack) => Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: ErrorStateView(
                      error: error,
                      prefix: 'Could not load playlists',
                    ),
                  ),
                  data: (playlists) {
                    final eligiblePlaylists = playlists
                        .where(
                          (playlist) => playlist.youtubePlaylistId.isNotEmpty,
                        )
                        .toList();
                    if (eligiblePlaylists.isEmpty) {
                      return Padding(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Add video to playlist',
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              'No playlist available yet.',
                              style: theme.textTheme.bodyMedium,
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      );
                    }
                    return ListView(
                      shrinkWrap: true,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      children: [
                        Text(
                          'Add video to playlist',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          target.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        for (final playlist in eligiblePlaylists)
                          ListTile(
                            leading: const CircleAvatar(
                              child: Icon(Icons.queue_music_rounded),
                            ),
                            title: Text(playlist.title),
                            subtitle: Text(
                              '${playlist.videoCount} video${playlist.videoCount == 1 ? '' : 's'}',
                            ),
                            onTap: () =>
                                Navigator.of(sheetContext).pop(playlist),
                          ),
                      ],
                    );
                  },
                ),
              );
            },
          ),
        );
      },
    );

    if (selectedPlaylist == null || !mounted) return;

    final confirmed = await confirmYoutubeQuotaRisk(
      context: context,
      ref: ref,
      cost: YoutubeQuotaCost.addPlaylistItem,
      actionLabel: 'Adding this video to a playlist',
    );
    if (!confirmed) return;

    try {
      await addVideoToYoutubePlaylist(
        ref,
        playlistId: selectedPlaylist.youtubePlaylistId,
        videoId: target.youtubeVideoId,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Video added to ${selectedPlaylist.title}.')),
      );
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Add to playlist failed');
    }
  }

  Future<_VideoPlaylistActionTarget?>
  _resolveCurrentVideoForPlaylistAction() async {
    final routeVideoId = widget.videoId.trim();
    if (routeVideoId.isNotEmpty) {
      final cached = _latestCurrentVideo;
      if (cached != null && cached.youtubeVideoId.trim() == routeVideoId) {
        return _VideoPlaylistActionTarget(
          youtubeVideoId: routeVideoId,
          title: _titleForPlaylistAction(video: cached, videoId: routeVideoId),
        );
      }

      return _VideoPlaylistActionTarget(
        youtubeVideoId: routeVideoId,
        title: _titleForPlaylistAction(videoId: routeVideoId),
      );
    }

    final cached = _latestCurrentVideo;
    if (cached != null && cached.youtubeVideoId.trim().isNotEmpty) {
      final cachedVideoId = cached.youtubeVideoId.trim();
      return _VideoPlaylistActionTarget(
        youtubeVideoId: cachedVideoId,
        title: _titleForPlaylistAction(video: cached, videoId: cachedVideoId),
      );
    }

    return null;
  }

  String _titleForPlaylistAction({
    YouTubeVideo? video,
    required String videoId,
  }) {
    final videoTitle = video?.title.trim();
    if (videoTitle != null && videoTitle.isNotEmpty) return videoTitle;

    final normalizedVideoId = videoId.trim();
    final cached = _latestCurrentVideo;
    if (cached != null && cached.youtubeVideoId.trim() == normalizedVideoId) {
      final cachedTitle = cached.title.trim();
      if (cachedTitle.isNotEmpty) return cachedTitle;
    }

    final playerMetadata = _playerController.metadata;
    if (playerMetadata.videoId.trim() == normalizedVideoId) {
      final playerTitle = playerMetadata.title.trim();
      if (playerTitle.isNotEmpty) return playerTitle;
    }

    return 'Current video';
  }

  Future<void> _showAddCurrentChannelToFeedSheet() async {
    final selected = await _showAddCurrentChannelToFeedPickerSheet();
    if (selected == null || !mounted) return;

    try {
      await addVirtualFeedSource(
        ref,
        feedId: selected.feed.id,
        sourceType: 'channel',
        sourceId: selected.target.sourceId,
        sourceTitle: selected.target.sourceTitle,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Channel added to ${selected.feed.title}.')),
      );
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(
        context,
        error: e,
        prefix: 'Could not add channel to feed',
      );
    }
  }

  Future<_ChannelFeedActionSelection?>
  _showAddCurrentChannelToFeedPickerSheet() {
    final routeVideoId = widget.videoId.trim();
    final cached = _latestCurrentVideo;
    final immediateTarget =
        cached != null && cached.youtubeVideoId.trim() == routeVideoId
        ? _channelFeedActionTargetFromVideo(cached)
        : _channelFeedActionTargetFromQueueItem(
            ref.read(playbackSessionProvider).itemFor(routeVideoId),
          );

    return showModalBottomSheet<_ChannelFeedActionSelection>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        final theme = Theme.of(sheetContext);
        final maxHeight = MediaQuery.sizeOf(sheetContext).height * 0.72;
        return SafeArea(
          child: Consumer(
            builder: (context, ref, _) {
              final backendVideoAsync =
                  immediateTarget == null && routeVideoId.isNotEmpty
                  ? ref.watch(videoByYoutubeIdProvider(routeVideoId))
                  : const AsyncValue<YouTubeVideo?>.data(null);
              final resolvedTarget =
                  immediateTarget ??
                  _channelFeedActionTargetFromVideo(
                    backendVideoAsync.asData?.value,
                  );

              Widget child;
              if (backendVideoAsync.isLoading && resolvedTarget == null) {
                child = const Center(child: CircularProgressIndicator());
              } else if (backendVideoAsync.hasError && resolvedTarget == null) {
                child = Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: ErrorStateView(
                    error: backendVideoAsync.error!,
                    prefix: 'Could not resolve channel metadata',
                  ),
                );
              } else if (resolvedTarget == null ||
                  resolvedTarget.youtubeVideoId.isEmpty ||
                  resolvedTarget.sourceId.trim().isEmpty ||
                  resolvedTarget.sourceTitle.trim().isEmpty) {
                child = Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Add channel to feed',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Current video channel metadata is not ready yet.',
                        style: theme.textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                );
              } else {
                final feedsAsync = ref.watch(virtualFeedsProvider);
                child = feedsAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (error, stack) => Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: ErrorStateView(
                      error: error,
                      prefix: 'Could not load feeds',
                    ),
                  ),
                  data: (feeds) {
                    final activeFeeds = feeds
                        .where((feed) => feed.isActive)
                        .toList();
                    if (activeFeeds.isEmpty) {
                      return Padding(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Add channel to feed',
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              'Create a ReplayGlowz feed first.',
                              style: theme.textTheme.bodyMedium,
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      );
                    }
                    return ListView(
                      shrinkWrap: true,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      children: [
                        Text(
                          'Add channel to feed',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          resolvedTarget.sourceTitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        for (final feed in activeFeeds)
                          ListTile(
                            leading: CircleAvatar(child: Text(feed.initials)),
                            title: Text(feed.title),
                            subtitle: Text(
                              '${feed.sourceCount} source${feed.sourceCount == 1 ? '' : 's'}',
                            ),
                            onTap: () => Navigator.of(sheetContext).pop(
                              _ChannelFeedActionSelection(
                                target: resolvedTarget,
                                feed: feed,
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                );
              }

              return ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: 240,
                  maxHeight: maxHeight,
                ),
                child: child,
              );
            },
          ),
        );
      },
    );
  }

  _ChannelFeedActionTarget? _channelFeedActionTargetFromVideo(
    YouTubeVideo? video,
  ) {
    if (video == null || video.youtubeVideoId.trim().isEmpty) return null;
    final sourceId = video.youtubeChannelId?.trim();
    final sourceTitle = video.channelTitle.trim();
    if (sourceId == null || sourceId.isEmpty || sourceTitle.isEmpty) {
      return null;
    }
    return _ChannelFeedActionTarget(
      youtubeVideoId: video.youtubeVideoId.trim(),
      sourceId: sourceId,
      sourceTitle: sourceTitle,
    );
  }

  _ChannelFeedActionTarget? _channelFeedActionTargetFromQueueItem(
    PlaybackQueueItem? item,
  ) {
    if (item == null || item.youtubeVideoId.trim().isEmpty) return null;
    final sourceId = item.youtubeChannelId?.trim();
    final sourceTitle = item.channelTitle?.trim();
    if (sourceId == null ||
        sourceId.isEmpty ||
        sourceTitle == null ||
        sourceTitle.isEmpty) {
      return null;
    }
    return _ChannelFeedActionTarget(
      youtubeVideoId: item.youtubeVideoId.trim(),
      sourceId: sourceId,
      sourceTitle: sourceTitle,
    );
  }

  Future<void> _maybeShowBackgroundPlaybackInterruptionHint() async {
    if (!kIsWeb ||
        _backgroundPlaybackHintDismissed ||
        _backgroundPlaybackHintVisible ||
        !_wasPlayingBeforeBackground ||
        _isPlaying ||
        widget.videoId.isEmpty) {
      return;
    }

    final backgroundedAt = _backgroundedAt;
    final wasAwayLongEnough =
        backgroundedAt == null ||
        DateTime.now().difference(backgroundedAt) >
            const Duration(milliseconds: 900);
    if (!_playerPausedDuringBackground && !wasAwayLongEnough) {
      return;
    }

    _backgroundPlaybackHintVisible = true;

    final l = _locale(context);
    final browser = currentBrowserEnvironment();
    final messageKey = browser.isFirefox
        ? 'playPage.backgroundPlaybackFirefoxMessage'
        : 'playPage.backgroundPlaybackGenericMessage';

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(t('playPage.backgroundPlaybackTitle', locale: l)),
        content: Text(t(messageKey, locale: l)),
        actions: [
          TextButton(
            onPressed: () async {
              final prefs = await SharedPreferences.getInstance();
              await prefs.setBool(_prefsBackgroundPlaybackHintDismissed, true);
              if (!mounted) {
                return;
              }
              setState(() => _backgroundPlaybackHintDismissed = true);
              if (dialogContext.mounted) {
                Navigator.of(dialogContext).pop();
              }
            },
            child: Text(t('common.dontShowAgain', locale: l)),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(t('common.ok', locale: l)),
          ),
        ],
      ),
    );

    _backgroundPlaybackHintVisible = false;
  }

  void _handleWebPlayerSnapshot(WebYoutubePlayerSnapshot snapshot) {
    if (!mounted) return;

    final wasPlaying = _webPlayerSnapshot.isPlaying;
    final currentSeconds = snapshot.currentSeconds.isFinite
        ? snapshot.currentSeconds
        : 0.0;
    final second = currentSeconds.floor();
    final hasTimeChanged = second != _lastSyncedSecond;
    final hasPlayStateChanged = snapshot.isPlaying != _isPlaying;
    final hasDurationChanged =
        snapshot.durationSeconds.round() !=
        _webPlayerSnapshot.durationSeconds.round();
    final hasRateChanged =
        (snapshot.playbackRate - _webPlayerSnapshot.playbackRate).abs() > 0.001;
    final endedTransition = snapshot.hasEnded && !_webPlayerSnapshot.hasEnded;
    if (_isAppBackgrounded &&
        _wasPlayingBeforeBackground &&
        wasPlaying &&
        !snapshot.isPlaying &&
        !snapshot.hasEnded) {
      _playerPausedDuringBackground = true;
    }

    _webPlayerSnapshot = snapshot;
    if (!hasTimeChanged &&
        !hasPlayStateChanged &&
        !hasDurationChanged &&
        !hasRateChanged &&
        !endedTransition) {
      return;
    }

    _lastSyncedSecond = second;
    setState(() {
      _currentTimestamp = currentSeconds.clamp(0, double.infinity).toDouble();
      _isPlaying = snapshot.isPlaying;
      if (snapshot.isPlaying) {
        _showWebPosterOverlay = false;
      }
    });
    _syncAppPlaybackState(snapshot.isPlaying);
    _syncAppPlaybackPosition(currentSeconds: currentSeconds);
    ref
        .read(appPlaybackControllerProvider.notifier)
        .setPlaybackRate(snapshot.playbackRate);

    if (endedTransition) {
      _handlePlaybackEnded();
    }
  }

  void _handlePlaybackEnded() {
    final loopEnabled = ref.read(appPlaybackControllerProvider).loopEnabled;
    if (loopEnabled) {
      _seekToSeconds(0);
      if (kIsWeb) {
        if (_showWebPosterOverlay) {
          setState(() => _showWebPosterOverlay = false);
        }
        _webPlayerController.play();
      } else {
        _playerController.playVideo();
      }
      _syncAppPlaybackState(true);
      return;
    }

    _playNextFeedVideo();
  }

  void _playPreviousFeedVideo() {
    _dismissPlaybackPreview(updateController: true);
    final previousVideoId = ref
        .read(playbackSessionProvider)
        .previousBefore(widget.videoId);
    if (previousVideoId == null || previousVideoId.isEmpty) {
      return;
    }

    _saveProgress();
    context.go(
      Uri(
        path: Routes.play,
        queryParameters: {'videoId': previousVideoId, 'autoPlay': '1'},
      ).toString(),
    );
  }

  void _playNextFeedVideo() {
    _dismissPlaybackPreview(updateController: true);
    _saveProgress();
    final nextVideoId = ref
        .read(playbackSessionProvider)
        .nextAfter(widget.videoId);
    if (nextVideoId == null || nextVideoId.isEmpty) {
      return;
    }

    context.go(
      Uri(
        path: Routes.play,
        queryParameters: {'videoId': nextVideoId, 'autoPlay': '1'},
      ).toString(),
    );
  }

  List<_TranscriptEntry> _parseTranscriptEntries(
    Map<String, dynamic>? transcript,
  ) {
    if (transcript == null) {
      return const <_TranscriptEntry>[];
    }
    final entriesRaw = transcript['entries'];
    if (entriesRaw is! List) {
      return const <_TranscriptEntry>[];
    }

    final entries = <_TranscriptEntry>[];
    for (final item in entriesRaw) {
      if (item is! Map) continue;
      final start = (item['start'] as num?)?.toDouble();
      final duration = (item['duration'] as num?)?.toDouble();
      final text = item['text']?.toString() ?? '';

      if (start == null || duration == null || text.trim().isEmpty) {
        continue;
      }

      entries.add(
        _TranscriptEntry(
          startSeconds: start,
          durationSeconds: duration,
          text: text.trim(),
          speaker: item['speaker']?.toString(),
        ),
      );
    }

    entries.sort((a, b) => a.startSeconds.compareTo(b.startSeconds));
    return entries;
  }

  Future<void> _generateTranscript(String language) async {
    if (_isGeneratingTranscript || widget.videoId.isEmpty) {
      return;
    }

    setState(() => _isGeneratingTranscript = true);
    try {
      await generateTranscript(
        ref,
        youtubeVideoId: widget.videoId,
        language: language,
      );
      ref.invalidate(
        activeTranscriptProvider(
          TranscriptArgs(youtubeVideoId: widget.videoId, language: language),
        ),
      );
      ref
        ..invalidate(
          transcriptVersionsProvider(
            TranscriptArgs(youtubeVideoId: widget.videoId, language: language),
          ),
        )
        ..invalidate(
          latestTranscriptJobProvider(
            TranscriptArgs(youtubeVideoId: widget.videoId, language: language),
          ),
        );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Transcript generated.')));
      }
    } catch (e) {
      if (mounted) {
        showErrorSnackBar(
          context,
          error: e,
          prefix: 'Transcript generation failed',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isGeneratingTranscript = false);
      }
    }
  }

  Future<void> _showQueueDrawer() async {
    final session = ref.read(playbackSessionProvider);
    final queue = session.items;
    final currentVideoId = widget.videoId;

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        return SafeArea(
          child: SizedBox(
            height: MediaQuery.sizeOf(sheetContext).height * 0.65,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Up next',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        '${session.displayTitle} · ${queue.length} video${queue.length == 1 ? '' : 's'}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                if (queue.isEmpty || !session.hasQueue)
                  Expanded(
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        child: Text(
                          'No active queue. Start playback from Feed, a playlist, or a ReplayGlowz feed to build Up next.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                        ),
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.builder(
                      itemCount: queue.length,
                      itemBuilder: (context, index) {
                        final item = queue[index];
                        final isCurrent = item.youtubeVideoId == currentVideoId;
                        final durationSec = parseDuration(item.duration);

                        return ListTile(
                          leading: Icon(
                            isCurrent
                                ? Icons.play_circle_filled
                                : Icons.play_circle,
                            color: isCurrent
                                ? Theme.of(context).colorScheme.primary
                                : Theme.of(
                                    context,
                                  ).colorScheme.onSurfaceVariant,
                          ),
                          title: Text(
                            item.title ?? 'Queued video',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            durationSec != null
                                ? formatDuration(durationSec)
                                : '',
                          ),
                          onTap: () {
                            Navigator.of(sheetContext).pop();
                            if (!mounted) return;
                            ref
                                .read(playbackSessionProvider.notifier)
                                .markCurrent(item.youtubeVideoId);
                            this.context.go(
                              Uri(
                                path: Routes.play,
                                queryParameters: {
                                  'videoId': item.youtubeVideoId,
                                },
                              ).toString(),
                            );
                          },
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showVideoOptions(YouTubeVideo? currentVideo) async {
    final videoId = currentVideo?.youtubeVideoId ?? widget.videoId;
    if (videoId.isEmpty) {
      showErrorSnackBar(
        context,
        error: 'Cannot resolve the current video id.',
        prefix: 'Options unavailable',
      );
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.share_outlined),
                title: const Text('Copy YouTube link'),
                onTap: () async {
                  Navigator.of(sheetContext).pop();
                  final link = 'https://www.youtube.com/watch?v=$videoId';
                  await Clipboard.setData(ClipboardData(text: link));
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('YouTube link copied.')),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.visibility_off_outlined),
                title: const Text('Hide from library'),
                onTap: () async {
                  Navigator.of(sheetContext).pop();
                  try {
                    await hideVideo(ref, videoId);
                    if (!mounted) return;
                    ref.read(activePlayVideoIdProvider.notifier).clear();
                    final playbackNotifier = ref.read(
                      appPlaybackControllerProvider.notifier,
                    );
                    playbackNotifier
                      ..setPlaying(false)
                      ..setActiveVideo(false);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Video hidden from library.'),
                      ),
                    );
                    context.go(Routes.videos);
                  } catch (e) {
                    if (!mounted) return;
                    showErrorSnackBar(
                      context,
                      error: e,
                      prefix: 'Could not hide video',
                    );
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.report_outlined),
                title: const Text('Send feedback'),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  if (!mounted) return;
                  context.go(Routes.feedback);
                },
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
          ),
        );
      },
    );
  }

  String _formatTime(double seconds) {
    final total = seconds.floor();
    final mins = total ~/ 60;
    final secs = total % 60;
    return '$mins:${secs.toString().padLeft(2, '0')}';
  }
}
