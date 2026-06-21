import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/i18n/translations.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/providers/mutations.dart';
import 'package:replayglowz_app/providers/providers.dart';
import 'package:replayglowz_app/utils/duration_utils.dart';
import 'package:replayglowz_app/widgets/app_states.dart';
import 'package:replayglowz_app/widgets/common_app_bar_actions.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';
import 'package:replayglowz_app/widgets/media/video_card.dart';
import 'package:replayglowz_app/widgets/media/video_list_tile.dart';
import 'package:replayglowz_app/widgets/ui_hint_card.dart';
import 'package:replayglowz_app/widgets/youtube_channel_onboarding.dart';
import 'package:replayglowz_app/widgets/youtube_quota_guard.dart';
import 'package:replayglowz_app/widgets/youtube_connect.dart';

/// Video feed screen with multiple view modes.
///
/// Convex queries/mutations used:
/// - `youtube.getAllVideos` — fetch all cached videos across playlists
/// - `notes.getNotes` — fetch notes count per video for badge display
/// - `settings.getSettings` — load user preferences (default view mode, etc.)
class VideosScreen extends ConsumerStatefulWidget {
  const VideosScreen({
    super.key,
    this.activeVideoScrollToken,
    this.activeVideoScrollId,
  });

  final String? activeVideoScrollToken;
  final String? activeVideoScrollId;

  @override
  ConsumerState<VideosScreen> createState() => _VideosScreenState();
}

class _VideosScreenState extends ConsumerState<VideosScreen>
    with SingleTickerProviderStateMixin {
  static const _compactViewBreakpoint = 640.0;
  static const _filteredFeedPageSize = 60;
  static const _filteredFeedLoadMoreExtent = 960.0;
  static const _watchTransitionDuration = Duration(milliseconds: 320);
  static const _feedSnapAnimationDuration = Duration(milliseconds: 300);
  static const _feedSyncAnimationDuration = Duration(milliseconds: 360);
  static const _feedSlowSnapVelocity = 420.0;
  static const _feedDisabledSnapVelocity = 2200.0;
  static const Curve _feedSnapCurve = Curves.easeOutCubic;
  static const Curve _feedSyncCurve = Curves.easeOutCubic;
  static const _prefsTab = 'videos.pref.tab';
  static const _prefsSort = 'videos.pref.sort';
  static const _prefsWatched = 'videos.pref.watched';
  static const _prefsShorts = 'videos.pref.shorts';
  static const _prefsPlaylist = 'videos.pref.playlist';
  static const _prefsPlaylists = 'videos.pref.playlists';
  static const _prefsFeedFilter = 'videos.pref.feedFilter';
  static const _prefsFeedFilters = 'videos.pref.feedFilters';
  static const _prefsScroll = 'videos.pref.scroll';
  late final TabController _tabController;
  final _cardScrollController = ScrollController();
  final _listScrollController = ScrollController();
  final _summaryScrollController = ScrollController();
  final List<Map<String, GlobalKey>> _feedItemKeysByTab = List.generate(
    3,
    (_) => <String, GlobalKey>{},
  );
  final List<GlobalKey> _feedViewportKeysByTab = List.generate(
    3,
    (_) => GlobalKey(),
  );
  final Map<String, List<String?>> _requestedFeedCursorsByFeedId =
      <String, List<String?>>{};
  final Map<String, bool> _watchOverrides = <String, bool>{};
  final Set<String> _exitingWatchedVideoIds = <String>{};
  final Set<String> _enteringWatchedVideoIds = <String>{};
  List<YouTubeVideo> _visibleFeedQueue = const <YouTubeVideo>[];
  Offset _feedActionDragDelta = Offset.zero;
  String _sortOrder = 'desc';
  bool _includeWatched = true;
  ShortFormVideoFilter _shortFormFilter = ShortFormVideoFilter.all;
  bool _feedActionRefreshMode = false;
  final Set<String> _feedFilterIds = <String>{};
  bool _prefsLoaded = false;
  String? _handledActiveVideoScrollToken;
  int _lastSyncedTabIndex = 0;
  _FeedScrollAnchor? _lastFeedScrollAnchor;
  final List<_FeedScrollAnchor?> _pendingFeedScrollAnchorsByTab =
      List<_FeedScrollAnchor?>.filled(3, null);
  bool _isAdjustingFeedScroll = false;
  Timer? _feedSnapIdleTimer;
  double _feedScrollVelocityPxPerSecond = 0;
  DateTime? _lastFeedScrollSampleAt;
  double? _lastFeedScrollSamplePixels;

  VideosArgs get _videosArgs =>
      VideosArgs(sortOrder: _sortOrder, includeWatched: true);

  VirtualFeedDetailsArgs _filteredFeedDetailsArgs(
    String feedId, {
    String? cursor,
  }) {
    return VirtualFeedDetailsArgs(
      feedId: feedId,
      includeWatched: true,
      sortOrder: _sortOrder,
      cursor: cursor,
      pageSize: _filteredFeedPageSize,
    );
  }

  List<String?> _requestedFeedCursors(String feedId) {
    return _requestedFeedCursorsByFeedId[feedId] ?? const <String?>[null];
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _lastSyncedTabIndex = _tabController.index;
    _tabController.addListener(_handleTabChanged);
    _tabController.animation?.addListener(_handleTabAnimation);
    _loadLocalPrefs();
  }

  @override
  void dispose() {
    _tabController.animation?.removeListener(_handleTabAnimation);
    _tabController.removeListener(_handleTabChanged);
    _feedSnapIdleTimer?.cancel();
    _tabController.dispose();
    _cardScrollController.dispose();
    _listScrollController.dispose();
    _summaryScrollController.dispose();
    super.dispose();
  }

  void _handleTabChanged() {
    final previousIndex = _lastSyncedTabIndex;
    final nextIndex = _tabController.index;
    if (previousIndex != nextIndex) {
      _syncScrollPositionBetweenViewModes(previousIndex, nextIndex);
      _lastSyncedTabIndex = nextIndex;
    }
    _persistLocalPrefs();
    if (mounted) {
      setState(() {});
    }
  }

  void _handleTabAnimation() {
    final value = _tabController.animation?.value;
    if (value == null || _visibleFeedQueue.isEmpty) return;

    final lowerTab = value.floor().clamp(0, 2);
    final upperTab = value.ceil().clamp(0, 2);
    if (lowerTab == upperTab) return;

    final sourceTab = _lastSyncedTabIndex.clamp(0, 2);
    final anchor =
        _anchorForVisibleVideo(sourceTab, snapToNearest: true) ??
        _lastFeedScrollAnchor;
    if (anchor == null) return;

    for (final tabIndex in {lowerTab, upperTab}) {
      if (tabIndex == sourceTab) continue;
      _queueOrJumpFeedTabToAnchor(tabIndex, anchor);
    }
  }

  Future<void> _loadLocalPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final tab = prefs.getInt(_prefsTab) ?? 0;
    final sort = prefs.getString(_prefsSort) ?? 'desc';
    final watched = prefs.getBool(_prefsWatched) ?? true;
    final shorts = _shortFormFilterFromPrefs(
      prefs.getString(_prefsShorts) ?? 'all',
    );
    final feedFilter = prefs.getString(_prefsFeedFilter);
    final feedFilters = prefs.getStringList(_prefsFeedFilters);
    final scroll = prefs.getDouble(_prefsScroll) ?? 0;
    final selectedFeeds = feedFilters == null
        ? <String>{if (feedFilter != null && feedFilter.isNotEmpty) feedFilter}
        : feedFilters.where((id) => id.isNotEmpty).toSet();

    if (!mounted) return;
    setState(() {
      _sortOrder = sort;
      _includeWatched = watched;
      _shortFormFilter = shorts;
      _feedFilterIds
        ..clear()
        ..addAll(selectedFeeds);
      _prefsLoaded = true;
    });
    _tabController.index = tab.clamp(0, 2);
    _lastSyncedTabIndex = _tabController.index;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = _activeScrollController();
      if (mounted && controller.hasClients) {
        controller.jumpTo(scroll.clamp(0, 200000));
      }
    });
  }

  Future<void> _persistLocalPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_prefsTab, _tabController.index);
    await prefs.setString(_prefsSort, _sortOrder);
    await prefs.setBool(_prefsWatched, _includeWatched);
    await prefs.setString(_prefsShorts, _shortFormFilterPrefsValue);
    final feedIds = _feedFilterIds.toList()..sort();
    await prefs.setStringList(_prefsFeedFilters, feedIds);
    await prefs.setString(
      _prefsFeedFilter,
      feedIds.isEmpty ? '' : feedIds.first,
    );
    await prefs.setStringList(_prefsPlaylists, const <String>[]);
    await prefs.setString(_prefsPlaylist, '');
  }

  Future<void> _persistScroll() async {
    final controller = _activeScrollController();
    if (!controller.hasClients) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_prefsScroll, controller.offset);
  }

  ScrollController _activeScrollController() {
    switch (_tabController.index) {
      case 1:
        return _listScrollController;
      case 2:
        return _summaryScrollController;
      case 0:
      default:
        return _cardScrollController;
    }
  }

  bool get _hasFeedFilters => _feedFilterIds.isNotEmpty;

  Set<String> _effectiveWatchedIds(Set<String> watchedIds) {
    if (_watchOverrides.isEmpty) return watchedIds;
    final effective = Set<String>.of(watchedIds);
    for (final entry in _watchOverrides.entries) {
      if (entry.value) {
        effective.add(entry.key);
      } else {
        effective.remove(entry.key);
      }
    }
    return effective;
  }

  void _clearWatchTransitionIds(
    Set<String> videoIds, {
    required bool entering,
  }) {
    if (videoIds.isEmpty) return;
    Future<void>.delayed(_watchTransitionDuration, () {
      if (!mounted) return;
      setState(() {
        if (entering) {
          _enteringWatchedVideoIds.removeAll(videoIds);
        } else {
          _exitingWatchedVideoIds.removeAll(videoIds);
        }
      });
    });
  }

  void _toggleWatchedVisibilityFilter(
    Set<String> watchedIds,
    List<YouTubeVideo> sourceVideos,
  ) {
    final transitioningIds = sourceVideos
        .where((video) => watchedIds.contains(video.youtubeVideoId))
        .map((video) => video.youtubeVideoId)
        .toSet();
    final nextIncludeWatched = !_includeWatched;
    setState(() {
      _includeWatched = nextIncludeWatched;
      if (nextIncludeWatched) {
        _exitingWatchedVideoIds.removeAll(transitioningIds);
        _enteringWatchedVideoIds.addAll(transitioningIds);
      } else {
        _enteringWatchedVideoIds.removeAll(transitioningIds);
        _exitingWatchedVideoIds.addAll(transitioningIds);
      }
    });
    _persistLocalPrefs();
    _clearWatchTransitionIds(
      transitioningIds,
      entering: nextIncludeWatched,
    );
  }

  void _stageWatchStateTransition(
    String videoId, {
    required bool watched,
    required bool animateVisibility,
  }) {
    setState(() {
      _watchOverrides[videoId] = watched;
      if (!animateVisibility) {
        _exitingWatchedVideoIds.remove(videoId);
        _enteringWatchedVideoIds.remove(videoId);
        return;
      }
      if (watched) {
        _enteringWatchedVideoIds.remove(videoId);
        _exitingWatchedVideoIds.add(videoId);
      } else {
        _exitingWatchedVideoIds.remove(videoId);
        _enteringWatchedVideoIds.add(videoId);
      }
    });
    _clearWatchTransitionIds({videoId}, entering: !watched);
    if (watched) {
      _clearWatchTransitionIds({videoId}, entering: false);
    }
  }

  String get _shortFormFilterPrefsValue => switch (_shortFormFilter) {
    ShortFormVideoFilter.all => 'all',
    ShortFormVideoFilter.excludeShorts => 'exclude',
    ShortFormVideoFilter.onlyShorts => 'only',
  };

  ShortFormVideoFilter _shortFormFilterFromPrefs(String value) {
    return switch (value) {
      'exclude' => ShortFormVideoFilter.excludeShorts,
      'only' => ShortFormVideoFilter.onlyShorts,
      _ => ShortFormVideoFilter.all,
    };
  }

  void _resetFilteredFeedPagination({Iterable<String>? feedIds}) {
    if (feedIds == null) {
      _requestedFeedCursorsByFeedId.clear();
      return;
    }
    for (final feedId in feedIds) {
      _requestedFeedCursorsByFeedId.remove(feedId);
    }
  }

  void _pruneFilteredFeedPaginationState(Iterable<String> selectedFeedIds) {
    final selected = selectedFeedIds.toSet();
    _requestedFeedCursorsByFeedId.removeWhere(
      (feedId, _) => !selected.contains(feedId),
    );
  }

  void _requestNextFilteredFeedPage(String feedId) {
    final cursors = _requestedFeedCursors(feedId);
    if (cursors.isEmpty) return;

    final lastCursor = cursors.last;
    final lastPage = ref.read(
      virtualFeedDetailsProvider(
        _filteredFeedDetailsArgs(feedId, cursor: lastCursor),
      ),
    );
    final details = lastPage.asData?.value;
    final nextCursor = details?.continueCursor;
    if (details == null ||
        details.isDone ||
        nextCursor == null ||
        nextCursor.isEmpty ||
        cursors.contains(nextCursor)) {
      return;
    }

    setState(() {
      _requestedFeedCursorsByFeedId[feedId] = <String?>[...cursors, nextCursor];
    });
  }

  void _retryFilteredFeedPage(String feedId, String? cursor) {
    ref.invalidate(
      virtualFeedDetailsProvider(
        _filteredFeedDetailsArgs(feedId, cursor: cursor),
      ),
    );
  }

  void _maybePrefetchFilteredFeedPagesForActiveVideo(
    Iterable<String> selectedFeedIds,
    String? activeVideoId,
  ) {
    final targetId = activeVideoId?.trim();
    if (targetId == null || targetId.isEmpty) return;
    if (_visibleFeedQueue.any((video) => video.youtubeVideoId == targetId)) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      for (final feedId in selectedFeedIds) {
        final cursors = _requestedFeedCursors(feedId);
        if (cursors.isEmpty) continue;
        final lastPage = ref.read(
          virtualFeedDetailsProvider(
            _filteredFeedDetailsArgs(feedId, cursor: cursors.last),
          ),
        );
        final details = lastPage.asData?.value;
        if (details == null || details.isDone) continue;
        final nextCursor = details.continueCursor;
        if (nextCursor == null ||
            nextCursor.isEmpty ||
            cursors.contains(nextCursor)) {
          continue;
        }
        _requestNextFilteredFeedPage(feedId);
        break;
      }
    });
  }

  void _maybeLoadMoreFilteredFeeds() {
    if (!_hasFeedFilters) return;
    final controller = _activeScrollController();
    if (!controller.hasClients) return;

    final remainingExtent =
        controller.position.maxScrollExtent - controller.position.pixels;
    if (remainingExtent > _filteredFeedLoadMoreExtent) {
      return;
    }

    for (final feedId in _feedFilterIds) {
      final cursors = _requestedFeedCursors(feedId);
      if (cursors.isEmpty) continue;
      final lastPage = ref.read(
        virtualFeedDetailsProvider(
          _filteredFeedDetailsArgs(feedId, cursor: cursors.last),
        ),
      );
      if (lastPage.isLoading) continue;
      final details = lastPage.asData?.value;
      if (details == null || details.isDone) continue;
      final nextCursor = details.continueCursor;
      if (nextCursor == null ||
          nextCursor.isEmpty ||
          cursors.contains(nextCursor)) {
        continue;
      }
      _requestNextFilteredFeedPage(feedId);
    }
  }

  void _jumpFeedViewsToTop() {
    _lastFeedScrollAnchor = null;
    for (
      var index = 0;
      index < _pendingFeedScrollAnchorsByTab.length;
      index++
    ) {
      _pendingFeedScrollAnchorsByTab[index] = null;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      for (final controller in [
        _cardScrollController,
        _listScrollController,
        _summaryScrollController,
      ]) {
        if (controller.hasClients) {
          controller.jumpTo(0);
        }
      }
    });
  }

  ScrollController _scrollControllerForTab(int index) {
    switch (index) {
      case 1:
        return _listScrollController;
      case 2:
        return _summaryScrollController;
      case 0:
      default:
        return _cardScrollController;
    }
  }

  void _syncScrollPositionBetweenViewModes(int previousIndex, int nextIndex) {
    final anchor =
        _anchorForVisibleVideo(previousIndex, snapToNearest: true) ??
        _lastFeedScrollAnchor;
    if (anchor == null) {
      return;
    }

    _lastFeedScrollAnchor = anchor;
    _pendingFeedScrollAnchorsByTab[nextIndex] = anchor;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _scrollTabToAnchor(
        nextIndex,
        anchor,
        animated: true,
        duration: _feedSyncAnimationDuration,
        curve: _feedSyncCurve,
      );
    });
  }

  int _estimatedIndexForScrollOffset(double offset, int tabIndex) {
    final topPadding = tabIndex == 1 ? 0.0 : 16.0;
    final itemExtent = _estimatedItemExtentForTab(tabIndex);
    return math.max(0, ((offset - topPadding + 24) / itemExtent).round());
  }

  double _estimatedItemExtentForTab(int tabIndex) {
    return switch (tabIndex) {
      1 => 88.0,
      2 => 156.0,
      _ => 324.0,
    };
  }

  void _scheduleEntryScrollToActiveFeedVideo(
    List<YouTubeVideo> visibleVideos,
    String? activeVideoId,
  ) {
    final token = widget.activeVideoScrollToken;
    if (token == null || token.isEmpty) {
      return;
    }
    if (_handledActiveVideoScrollToken == token) {
      return;
    }
    final targetVideoId = widget.activeVideoScrollId ?? activeVideoId;
    if (targetVideoId == null || targetVideoId.isEmpty) {
      return;
    }

    final index = visibleVideos.indexWhere(
      (video) => video.youtubeVideoId == targetVideoId,
    );
    if (index == -1) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_handledActiveVideoScrollToken == token) return;
      final controller = _activeScrollController();
      if (!controller.hasClients) return;
      final target = _estimatedScrollOffsetForIndex(
        index,
      ).clamp(0.0, controller.position.maxScrollExtent);
      _handledActiveVideoScrollToken = token;
      controller.animateTo(
        target,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
    });
  }

  double _estimatedScrollOffsetForIndex(int index) {
    return _estimatedScrollOffsetForIndexAndTab(index, _tabController.index);
  }

  double _estimatedScrollOffsetForIndexAndTab(int index, int tabIndex) {
    final topPadding = tabIndex == 1 ? 0.0 : 16.0;
    final itemExtent = _estimatedItemExtentForTab(tabIndex);
    return math.max(0, topPadding + (index * itemExtent) - 24);
  }

  double _feedTrailingAlignmentPadding(BoxConstraints constraints) {
    if (!constraints.hasBoundedHeight || constraints.maxHeight <= 0) {
      return 320.0;
    }
    return math.max(96.0, constraints.maxHeight - 24.0);
  }

  String _videoAnchorId(YouTubeVideo video) {
    return video.id.isNotEmpty ? video.id : video.youtubeVideoId;
  }

  GlobalKey _feedItemKeyForTab(int tabIndex, YouTubeVideo video) {
    final anchorId = _videoAnchorId(video);
    return _feedItemKeysByTab[tabIndex].putIfAbsent(
      anchorId,
      () => GlobalKey(),
    );
  }

  void _pruneFeedItemKeys(List<YouTubeVideo> videos) {
    final visibleIds = videos.map(_videoAnchorId).toSet();
    for (final keysById in _feedItemKeysByTab) {
      keysById.removeWhere((id, _) => !visibleIds.contains(id));
    }
  }

  _FeedScrollAnchor? _anchorForVisibleVideo(
    int tabIndex, {
    required bool snapToNearest,
  }) {
    if (_visibleFeedQueue.isEmpty) return null;

    final viewportContext = _feedViewportKeysByTab[tabIndex].currentContext;
    final viewportBox = viewportContext?.findRenderObject();
    if (viewportBox is! RenderBox || !viewportBox.attached) {
      return _estimatedAnchorForTab(tabIndex);
    }

    final viewportTop = viewportBox.localToGlobal(Offset.zero).dy;
    final viewportBottom = viewportTop + viewportBox.size.height;
    const tolerance = 2.0;
    _FeedScrollAnchor? firstBelowTop;
    double? firstBelowDistance;

    for (var index = 0; index < _visibleFeedQueue.length; index++) {
      final video = _visibleFeedQueue[index];
      final anchorId = _videoAnchorId(video);
      final itemContext =
          _feedItemKeysByTab[tabIndex][anchorId]?.currentContext;
      final itemBox = itemContext?.findRenderObject();
      if (itemBox is! RenderBox || !itemBox.attached) {
        continue;
      }

      final itemTop = itemBox.localToGlobal(Offset.zero).dy;
      final itemBottom = itemTop + itemBox.size.height;
      if (itemBottom <= viewportTop + tolerance ||
          itemTop >= viewportBottom - tolerance) {
        continue;
      }

      if (itemTop <= viewportTop + tolerance &&
          itemBottom > viewportTop + tolerance) {
        if (snapToNearest &&
            viewportTop - itemTop > itemBox.size.height / 2 &&
            index + 1 < _visibleFeedQueue.length) {
          final nextVideo = _visibleFeedQueue[index + 1];
          return _FeedScrollAnchor(
            index: index + 1,
            videoId: _videoAnchorId(nextVideo),
          );
        }
        return _FeedScrollAnchor(index: index, videoId: anchorId);
      }

      if (itemTop > viewportTop) {
        final distance = itemTop - viewportTop;
        if (firstBelowDistance == null || distance < firstBelowDistance) {
          firstBelowDistance = distance;
          firstBelowTop = _FeedScrollAnchor(index: index, videoId: anchorId);
        }
      }
    }

    return firstBelowTop ?? _estimatedAnchorForTab(tabIndex);
  }

  _FeedScrollAnchor? _estimatedAnchorForTab(int tabIndex) {
    if (_visibleFeedQueue.isEmpty) return null;
    final controller = _scrollControllerForTab(tabIndex);
    if (!controller.hasClients) return null;

    final offset = controller.offset;
    final index = _estimatedIndexForScrollOffset(
      offset,
      tabIndex,
    ).clamp(0, _visibleFeedQueue.length - 1);
    final video = _visibleFeedQueue[index];
    return _FeedScrollAnchor(index: index, videoId: _videoAnchorId(video));
  }

  int _anchorIndex(_FeedScrollAnchor anchor) {
    final matchingIndex = _visibleFeedQueue.indexWhere(
      (video) => _videoAnchorId(video) == anchor.videoId,
    );
    if (matchingIndex != -1) return matchingIndex;
    if (_visibleFeedQueue.isEmpty) return 0;
    return anchor.index.clamp(0, _visibleFeedQueue.length - 1);
  }

  double? _preciseScrollOffsetForAnchor(
    int tabIndex,
    _FeedScrollAnchor anchor,
  ) {
    final controller = _scrollControllerForTab(tabIndex);
    if (!controller.hasClients) return null;

    final viewportContext = _feedViewportKeysByTab[tabIndex].currentContext;
    final viewportBox = viewportContext?.findRenderObject();
    final itemContext =
        _feedItemKeysByTab[tabIndex][anchor.videoId]?.currentContext;
    final itemBox = itemContext?.findRenderObject();
    if (viewportBox is! RenderBox ||
        !viewportBox.attached ||
        itemBox is! RenderBox ||
        !itemBox.attached) {
      return null;
    }

    final viewportTop = viewportBox.localToGlobal(Offset.zero).dy;
    final itemTop = itemBox.localToGlobal(Offset.zero).dy;
    return (controller.offset + itemTop - viewportTop).clamp(
      0.0,
      controller.position.maxScrollExtent,
    );
  }

  void _syncInactiveFeedViewsToAnchor(
    int sourceTabIndex,
    _FeedScrollAnchor anchor,
  ) {
    if (_visibleFeedQueue.isEmpty) return;

    for (var tabIndex = 0; tabIndex < 3; tabIndex++) {
      if (tabIndex == sourceTabIndex) continue;
      _queueOrJumpFeedTabToAnchor(tabIndex, anchor);
    }
  }

  void _queueOrJumpFeedTabToAnchor(int tabIndex, _FeedScrollAnchor anchor) {
    if (tabIndex < 0 || tabIndex >= _pendingFeedScrollAnchorsByTab.length) {
      return;
    }

    final controller = _scrollControllerForTab(tabIndex);
    if (!controller.hasClients || _visibleFeedQueue.isEmpty) {
      _pendingFeedScrollAnchorsByTab[tabIndex] = anchor;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _applyPendingFeedScrollAnchors();
        }
      });
      return;
    }

    _jumpFeedTabToAnchor(tabIndex, anchor);
    _pendingFeedScrollAnchorsByTab[tabIndex] = null;
  }

  void _jumpFeedTabToAnchor(int tabIndex, _FeedScrollAnchor anchor) {
    final controller = _scrollControllerForTab(tabIndex);
    if (!controller.hasClients || _visibleFeedQueue.isEmpty) {
      return;
    }

    final index = _anchorIndex(anchor);
    final resolvedAnchor = _FeedScrollAnchor(
      index: index,
      videoId: _videoAnchorId(_visibleFeedQueue[index]),
    );
    final target =
        _preciseScrollOffsetForAnchor(tabIndex, resolvedAnchor) ??
        _estimatedScrollOffsetForIndexAndTab(
          index,
          tabIndex,
        ).clamp(0.0, controller.position.maxScrollExtent);

    if ((controller.offset - target).abs() < 1) return;
    controller.jumpTo(target);
  }

  void _scrollTabToAnchor(
    int tabIndex,
    _FeedScrollAnchor anchor, {
    required bool animated,
    Duration duration = _feedSnapAnimationDuration,
    Curve curve = _feedSnapCurve,
  }) {
    final controller = _scrollControllerForTab(tabIndex);
    if (!controller.hasClients || _visibleFeedQueue.isEmpty) {
      _pendingFeedScrollAnchorsByTab[tabIndex] = anchor;
      return;
    }
    _feedSnapIdleTimer?.cancel();

    final index = _anchorIndex(anchor);
    final resolvedAnchor = _FeedScrollAnchor(
      index: index,
      videoId: _videoAnchorId(_visibleFeedQueue[index]),
    );
    final target =
        _preciseScrollOffsetForAnchor(tabIndex, resolvedAnchor) ??
        _estimatedScrollOffsetForIndexAndTab(
          index,
          tabIndex,
        ).clamp(0.0, controller.position.maxScrollExtent);

    _isAdjustingFeedScroll = true;
    if (animated) {
      controller
          .animateTo(target, duration: duration, curve: curve)
          .whenComplete(() {
            _softCorrectPreciseAnchor(tabIndex, resolvedAnchor);
          });
    } else {
      controller.jumpTo(target);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final preciseTarget = _preciseScrollOffsetForAnchor(
          tabIndex,
          resolvedAnchor,
        );
        if (preciseTarget != null && controller.hasClients) {
          controller.jumpTo(preciseTarget);
        }
        _finishProgrammaticFeedScroll();
      });
    }

    if (_pendingFeedScrollAnchorsByTab[tabIndex]?.videoId == anchor.videoId) {
      _pendingFeedScrollAnchorsByTab[tabIndex] = null;
    }
    _lastFeedScrollAnchor = resolvedAnchor;
    _syncInactiveFeedViewsToAnchor(tabIndex, resolvedAnchor);
  }

  void _softCorrectPreciseAnchor(int tabIndex, _FeedScrollAnchor anchor) {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final controller = _scrollControllerForTab(tabIndex);
      final preciseTarget = _preciseScrollOffsetForAnchor(tabIndex, anchor);
      if (preciseTarget == null || !controller.hasClients) {
        _finishProgrammaticFeedScroll();
        return;
      }

      final delta = (controller.offset - preciseTarget).abs();
      if (delta < 2) {
        _finishProgrammaticFeedScroll();
        return;
      }

      controller
          .animateTo(
            preciseTarget,
            duration: const Duration(milliseconds: 120),
            curve: Curves.easeOut,
          )
          .whenComplete(_finishProgrammaticFeedScroll);
    });
  }

  void _finishProgrammaticFeedScroll() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _isAdjustingFeedScroll = false;
      }
    });
  }

  void _schedulePendingFeedScrollAnchors() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _applyPendingFeedScrollAnchors();
      }
    });
  }

  void _applyPendingFeedScrollAnchors() {
    if (!mounted || _visibleFeedQueue.isEmpty) return;

    for (
      var tabIndex = 0;
      tabIndex < _pendingFeedScrollAnchorsByTab.length;
      tabIndex++
    ) {
      final pendingAnchor = _pendingFeedScrollAnchorsByTab[tabIndex];
      if (pendingAnchor == null) continue;

      final controller = _scrollControllerForTab(tabIndex);
      if (!controller.hasClients) continue;

      if (tabIndex == _tabController.index) {
        _scrollTabToAnchor(
          tabIndex,
          pendingAnchor,
          animated: true,
          duration: _feedSyncAnimationDuration,
          curve: _feedSyncCurve,
        );
      } else {
        _jumpFeedTabToAnchor(tabIndex, pendingAnchor);
        _pendingFeedScrollAnchorsByTab[tabIndex] = null;
      }
    }
  }

  void _resetFeedScrollVelocityTracking(ScrollMetrics metrics) {
    _feedSnapIdleTimer?.cancel();
    _feedScrollVelocityPxPerSecond = 0;
    _lastFeedScrollSampleAt = DateTime.now();
    _lastFeedScrollSamplePixels = metrics.pixels;
  }

  void _recordFeedScrollVelocity(ScrollMetrics metrics) {
    if (metrics.axis != Axis.vertical) return;

    final now = DateTime.now();
    final previousAt = _lastFeedScrollSampleAt;
    final previousPixels = _lastFeedScrollSamplePixels;
    _lastFeedScrollSampleAt = now;
    _lastFeedScrollSamplePixels = metrics.pixels;

    if (previousAt == null || previousPixels == null) return;

    final elapsedSeconds =
        now.difference(previousAt).inMicroseconds /
        Duration.microsecondsPerSecond;
    if (elapsedSeconds <= 0) return;

    final sampleVelocity =
        (metrics.pixels - previousPixels).abs() / elapsedSeconds;
    _feedScrollVelocityPxPerSecond = _feedScrollVelocityPxPerSecond == 0
        ? sampleVelocity
        : (_feedScrollVelocityPxPerSecond * 0.65) + (sampleVelocity * 0.35);
  }

  void _scheduleFeedSnapAfterIdle(int tabIndex) {
    _feedSnapIdleTimer?.cancel();
    _feedSnapIdleTimer = Timer(const Duration(milliseconds: 180), () {
      if (!mounted ||
          _isAdjustingFeedScroll ||
          tabIndex != _tabController.index) {
        return;
      }

      final controller = _scrollControllerForTab(tabIndex);
      if (!controller.hasClients) {
        return;
      }
      if (controller.position.isScrollingNotifier.value) {
        _scheduleFeedSnapAfterIdle(tabIndex);
        return;
      }

      _snapFeedViewToNearestVideo(
        tabIndex,
        velocityPxPerSecond: _feedSlowSnapVelocity,
      );
      _lastFeedScrollSampleAt = null;
      _lastFeedScrollSamplePixels = null;
    });
  }

  double _velocityForScrollEnd(ScrollEndNotification notification) {
    final dragVelocity = notification.dragDetails?.primaryVelocity?.abs();
    if (dragVelocity != null) {
      return dragVelocity;
    }
    return _feedScrollVelocityPxPerSecond;
  }

  _FeedScrollAnchor? _anchorForProgressiveSnap(
    int tabIndex,
    double velocityPxPerSecond,
  ) {
    const minimumSnapWindow = 0.24;
    const maximumSnapWindow = 0.50;

    if (_visibleFeedQueue.isEmpty ||
        velocityPxPerSecond >= _feedDisabledSnapVelocity) {
      return null;
    }

    final velocityRatio =
        ((velocityPxPerSecond - _feedSlowSnapVelocity) /
                (_feedDisabledSnapVelocity - _feedSlowSnapVelocity))
            .clamp(0.0, 1.0);
    final snapStrength = 1 - velocityRatio;
    final snapWindow =
        minimumSnapWindow +
        ((maximumSnapWindow - minimumSnapWindow) * snapStrength);
    final shouldSnapToNearest = velocityPxPerSecond <= _feedSlowSnapVelocity;

    final viewportContext = _feedViewportKeysByTab[tabIndex].currentContext;
    final viewportBox = viewportContext?.findRenderObject();
    if (viewportBox is! RenderBox || !viewportBox.attached) {
      return snapStrength >= 0.65
          ? _anchorForVisibleVideo(tabIndex, snapToNearest: true)
          : null;
    }

    final viewportTop = viewportBox.localToGlobal(Offset.zero).dy;
    final viewportBottom = viewportTop + viewportBox.size.height;
    const tolerance = 2.0;
    _FeedScrollAnchor? firstBelowTop;
    double? firstBelowDistance;
    double? firstBelowHeight;

    for (var index = 0; index < _visibleFeedQueue.length; index++) {
      final video = _visibleFeedQueue[index];
      final anchorId = _videoAnchorId(video);
      final itemContext =
          _feedItemKeysByTab[tabIndex][anchorId]?.currentContext;
      final itemBox = itemContext?.findRenderObject();
      if (itemBox is! RenderBox || !itemBox.attached) {
        continue;
      }

      final itemHeight = itemBox.size.height;
      if (itemHeight <= 0) continue;

      final itemTop = itemBox.localToGlobal(Offset.zero).dy;
      final itemBottom = itemTop + itemHeight;
      if (itemBottom <= viewportTop + tolerance ||
          itemTop >= viewportBottom - tolerance) {
        continue;
      }

      if (itemTop <= viewportTop + tolerance &&
          itemBottom > viewportTop + tolerance) {
        final hiddenRatio = ((viewportTop - itemTop) / itemHeight).clamp(
          0.0,
          1.0,
        );
        if (shouldSnapToNearest) {
          if (hiddenRatio < 0.5 || index + 1 >= _visibleFeedQueue.length) {
            return _FeedScrollAnchor(index: index, videoId: anchorId);
          }
          final nextVideo = _visibleFeedQueue[index + 1];
          return _FeedScrollAnchor(
            index: index + 1,
            videoId: _videoAnchorId(nextVideo),
          );
        }
        if (hiddenRatio <= snapWindow) {
          return _FeedScrollAnchor(index: index, videoId: anchorId);
        }
        if (hiddenRatio >= 1 - snapWindow) {
          if (index + 1 < _visibleFeedQueue.length) {
            final nextVideo = _visibleFeedQueue[index + 1];
            return _FeedScrollAnchor(
              index: index + 1,
              videoId: _videoAnchorId(nextVideo),
            );
          }
          return _FeedScrollAnchor(index: index, videoId: anchorId);
        }
        return null;
      }

      if (itemTop > viewportTop) {
        final distance = itemTop - viewportTop;
        if (firstBelowDistance == null || distance < firstBelowDistance) {
          firstBelowDistance = distance;
          firstBelowHeight = itemHeight;
          firstBelowTop = _FeedScrollAnchor(index: index, videoId: anchorId);
        }
      }
    }

    if (firstBelowTop != null &&
        firstBelowDistance != null &&
        firstBelowHeight != null &&
        firstBelowDistance / firstBelowHeight <= snapWindow) {
      return firstBelowTop;
    }

    return null;
  }

  bool _handleFeedScrollNotification(
    ScrollNotification notification,
    int tabIndex,
  ) {
    if (_isAdjustingFeedScroll || tabIndex != _tabController.index) {
      return false;
    }

    if (notification.metrics.axis != Axis.vertical) {
      return false;
    }

    if (notification is ScrollStartNotification) {
      _resetFeedScrollVelocityTracking(notification.metrics);
    }

    if (notification is ScrollUpdateNotification ||
        notification is UserScrollNotification) {
      _recordFeedScrollVelocity(notification.metrics);
      _maybeLoadMoreFilteredFeeds();
      final anchor = _anchorForVisibleVideo(tabIndex, snapToNearest: false);
      if (anchor != null) {
        _lastFeedScrollAnchor = anchor;
        _syncInactiveFeedViewsToAnchor(tabIndex, anchor);
      }
      _scheduleFeedSnapAfterIdle(tabIndex);
    }

    if (notification is ScrollEndNotification) {
      _maybeLoadMoreFilteredFeeds();
      _feedSnapIdleTimer?.cancel();
      _snapFeedViewToNearestVideo(
        tabIndex,
        velocityPxPerSecond: _velocityForScrollEnd(notification),
      );
      _lastFeedScrollSampleAt = null;
      _lastFeedScrollSamplePixels = null;
    }
    return false;
  }

  void _snapFeedViewToNearestVideo(
    int tabIndex, {
    required double velocityPxPerSecond,
  }) {
    final controller = _scrollControllerForTab(tabIndex);
    if (!controller.hasClients || _visibleFeedQueue.isEmpty) return;

    final anchor = _anchorForProgressiveSnap(tabIndex, velocityPxPerSecond);
    if (anchor == null) return;

    final index = _anchorIndex(anchor);
    final resolvedAnchor = _FeedScrollAnchor(
      index: index,
      videoId: _videoAnchorId(_visibleFeedQueue[index]),
    );
    final target =
        _preciseScrollOffsetForAnchor(tabIndex, resolvedAnchor) ??
        _estimatedScrollOffsetForIndexAndTab(
          index,
          tabIndex,
        ).clamp(0.0, controller.position.maxScrollExtent);

    if ((controller.offset - target).abs() < 3) {
      _lastFeedScrollAnchor = resolvedAnchor;
      return;
    }

    _lastFeedScrollAnchor = resolvedAnchor;
    _syncInactiveFeedViewsToAnchor(tabIndex, resolvedAnchor);
    _scrollTabToAnchor(
      tabIndex,
      resolvedAnchor,
      animated: true,
      duration: _feedSnapAnimationDuration,
      curve: _feedSnapCurve,
    );
  }

  Widget _buildFeedScrollSurface({
    required int tabIndex,
    required Widget child,
  }) {
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) =>
          _handleFeedScrollNotification(notification, tabIndex),
      child: KeyedSubtree(key: _feedViewportKeysByTab[tabIndex], child: child),
    );
  }

  AppLocale _locale(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'fr'
      ? AppLocale.fr
      : AppLocale.en;

  bool _useCompactViewSwitcher(BuildContext context) {
    return MediaQuery.sizeOf(context).width < _compactViewBreakpoint;
  }

  ({IconData icon, String label}) _viewModeMeta(int index) {
    switch (index) {
      case 1:
        return (icon: Icons.list_rounded, label: 'List');
      case 2:
        return (icon: Icons.notes_rounded, label: 'Notes');
      default:
        return (icon: Icons.grid_view_rounded, label: 'Cards');
    }
  }

  Widget _buildViewModeAction(BuildContext context) {
    final current = _viewModeMeta(_tabController.index);

    return PopupMenuButton<int>(
      tooltip: 'View mode: ${current.label}',
      icon: Icon(current.icon),
      position: PopupMenuPosition.under,
      onSelected: (index) {
        if (index != _tabController.index) {
          _tabController.animateTo(index);
        }
      },
      itemBuilder: (context) => [
        PopupMenuItem<int>(
          value: 0,
          child: _ViewModeMenuItem(
            icon: Icons.grid_view_rounded,
            label: 'Cards',
            selected: _tabController.index == 0,
          ),
        ),
        PopupMenuItem<int>(
          value: 1,
          child: _ViewModeMenuItem(
            icon: Icons.list_rounded,
            label: 'List',
            selected: _tabController.index == 1,
          ),
        ),
        PopupMenuItem<int>(
          value: 2,
          child: _ViewModeMenuItem(
            icon: Icons.notes_rounded,
            label: 'Notes',
            selected: _tabController.index == 2,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final useCompactViewSwitcher = _useCompactViewSwitcher(context);
    final youtubeConnectionAsync = ref.watch(youtubeConnectionProvider);
    final youtubeConnected =
        youtubeConnectionAsync.asData?.value?['connected'] == true;
    final isNotesView = _tabController.index == 2;
    final videosAsync = youtubeConnected
        ? ref.watch(videosProvider(_videosArgs))
        : null;
    final virtualFeedsAsync = youtubeConnected
        ? ref.watch(virtualFeedsProvider)
        : const AsyncValue<List<VirtualFeed>>.data(<VirtualFeed>[]);
    final selectedFeedIds = _feedFilterIds.toList()..sort();
    _pruneFilteredFeedPaginationState(selectedFeedIds);
    final selectedFeedDetailsByFeedId = youtubeConnected
        ? <String, List<AsyncValue<VirtualFeedDetails>>>{
            for (final feedId in selectedFeedIds)
              feedId: [
                for (final cursor in _requestedFeedCursors(feedId))
                  ref.watch(
                    virtualFeedDetailsProvider(
                      _filteredFeedDetailsArgs(feedId, cursor: cursor),
                    ),
                  ),
              ],
          }
        : const <String, List<AsyncValue<VirtualFeedDetails>>>{};
    final notesAsync = youtubeConnected && isNotesView
        ? ref.watch(notesProvider)
        : null;
    final watchedAsync = youtubeConnected
        ? ref.watch(watchedVideosProvider)
        : const AsyncValue<List<WatchedVideo>>.data(<WatchedVideo>[]);
    final watchedIds = _effectiveWatchedIds(
      watchedAsync.asData?.value
              .map((item) => item.youtubeVideoId)
              .toSet() ??
          const <String>{},
    );
    final currentSourceVideos = videosAsync?.asData?.value == null
        ? const <YouTubeVideo>[]
        : _feedFilterIds.isEmpty
        ? videosAsync!.asData!.value
        : _mergeFeedVideos(selectedFeedDetailsByFeedId);
    final activeFeedVideoId =
        ref.watch(playbackSessionProvider).currentVideoId ??
        ref.watch(activePlayVideoIdProvider);
    final filterFeeds = virtualFeedsAsync.asData?.value;
    final l = _locale(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(t('videosPage.title', locale: l)),
        bottom: useCompactViewSwitcher
            ? null
            : TabBar(
                controller: _tabController,
                tabs: const [
                  Tab(icon: Icon(Icons.grid_view_rounded), text: 'Cards'),
                  Tab(icon: Icon(Icons.list_rounded), text: 'List'),
                  Tab(icon: Icon(Icons.notes_rounded), text: 'Notes'),
                ],
              ),
        actions: [
          if (useCompactViewSwitcher) _buildViewModeAction(context),
          IconButton(
            icon: Icon(
              _includeWatched ? Icons.visibility : Icons.visibility_off,
            ),
            tooltip: _includeWatched ? 'Hide watched' : 'Show watched',
            onPressed: () =>
                _toggleWatchedVisibilityFilter(watchedIds, currentSourceVideos),
          ),
          PopupMenuButton<ShortFormVideoFilter>(
            tooltip: 'Filter shorts',
            icon: Icon(switch (_shortFormFilter) {
              ShortFormVideoFilter.all => Icons.smart_display_outlined,
              ShortFormVideoFilter.excludeShorts =>
                Icons.smart_display_outlined,
              ShortFormVideoFilter.onlyShorts => Icons.smart_display_rounded,
            }),
            onSelected: (value) {
              setState(() => _shortFormFilter = value);
              _persistLocalPrefs();
            },
            itemBuilder: (context) => [
              CheckedPopupMenuItem(
                value: ShortFormVideoFilter.all,
                checked: _shortFormFilter == ShortFormVideoFilter.all,
                child: const Text('All videos'),
              ),
              CheckedPopupMenuItem(
                value: ShortFormVideoFilter.excludeShorts,
                checked: _shortFormFilter == ShortFormVideoFilter.excludeShorts,
                child: const Text('Without Shorts'),
              ),
              CheckedPopupMenuItem(
                value: ShortFormVideoFilter.onlyShorts,
                checked: _shortFormFilter == ShortFormVideoFilter.onlyShorts,
                child: const Text('Shorts only'),
              ),
            ],
          ),
          PopupMenuButton<String>(
            tooltip: 'Sort videos',
            icon: const Icon(Icons.sort),
            onSelected: (value) {
              setState(() {
                _sortOrder = value;
                _resetFilteredFeedPagination(feedIds: _feedFilterIds);
              });
              _persistLocalPrefs();
            },
            itemBuilder: (context) => [
              _SortMenuItem(
                value: 'desc',
                label: 'Newest first',
                selected: _sortOrder == 'desc',
              ),
              _SortMenuItem(
                value: 'asc',
                label: 'Oldest first',
                selected: _sortOrder == 'asc',
              ),
            ],
          ),
          IconButton(
            icon: Icon(
              _hasFeedFilters ? Icons.filter_list_alt : Icons.filter_list,
            ),
            tooltip: t('p3.videos.filterByFeeds', locale: l),
            onPressed: filterFeeds == null
                ? null
                : () => _showFeedFilterSheet(context, feeds: filterFeeds),
          ),
          IconButton(
            icon: const Icon(Icons.sync),
            tooltip:
                'Refresh videos (${youtubeQuotaCostLabel(YoutubeQuotaCost.syncAllPlaylists)})',
            onPressed: () async {
              if (!youtubeConnected) {
                await startYoutubeConnectFlow(context, returnTo: Routes.videos);
                return;
              }
              await _refreshVideos();
            },
          ),
          ...commonAppBarActions(context, ref),
        ],
      ),
      body: youtubeConnectionAsync.when(
        data: (status) {
          if (status?['connected'] != true) {
            return YoutubeConnectRequiredState(
              title: t('p3.videos.connectTitle', locale: l),
              description: t('p3.videos.connectDesc', locale: l),
              returnTo: Routes.videos,
            );
          }

          return videosAsync!.when(
            data: (videos) {
              final notesByVideo = <String, int>{};
              notesAsync?.whenData((notes) {
                for (final note in notes) {
                  if (note.youtubeVideoId != null) {
                    notesByVideo[note.youtubeVideoId!] =
                        (notesByVideo[note.youtubeVideoId!] ?? 0) + 1;
                  }
                }
              });

              final filteredFeedInitialLoading = selectedFeedIds.any((feedId) {
                final pages = selectedFeedDetailsByFeedId[feedId];
                if (pages == null || pages.isEmpty) return true;
                return pages.first.isLoading;
              });
              if (filteredFeedInitialLoading) {
                return _buildShimmerLoading();
              }

              final filteredFeedErrors = <({String feedId, String? cursor})>[];
              var isLoadingMoreFilteredFeeds = false;
              for (final entry in selectedFeedDetailsByFeedId.entries) {
                final cursors = _requestedFeedCursors(entry.key);
                for (var index = 0; index < entry.value.length; index++) {
                  final pageAsync = entry.value[index];
                  if (pageAsync.isLoading && index > 0) {
                    isLoadingMoreFilteredFeeds = true;
                  }
                  if (pageAsync.hasError) {
                    filteredFeedErrors.add((
                      feedId: entry.key,
                      cursor: index < cursors.length ? cursors[index] : null,
                    ));
                  }
                }
              }

              final sourceVideos = _feedFilterIds.isEmpty
                  ? videos
                  : _mergeFeedVideos(selectedFeedDetailsByFeedId);
              final visibleVideos = _filterWatchedVideos(
                sourceVideos,
                watchedIds,
              );
              final shortFilteredVideos = _filterShortFormVideos(visibleVideos);
              _visibleFeedQueue = shortFilteredVideos;
              _pruneFeedItemKeys(shortFilteredVideos);
              _schedulePendingFeedScrollAnchors();
              _maybePrefetchFilteredFeedPagesForActiveVideo(
                selectedFeedIds,
                activeFeedVideoId,
              );
              if (_prefsLoaded) {
                _scheduleEntryScrollToActiveFeedVideo(
                  shortFilteredVideos,
                  activeFeedVideoId,
                );
              }
              if (!_prefsLoaded) {
                return _buildShimmerLoading();
              }

              final body = videos.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.only(bottom: 24),
                      children: [
                        YouTubeChannelOnboardingCard(
                          onImported: _refreshVideos,
                        ),
                        SizedBox(
                          height: 360,
                          child: YoutubeAwareEmptyState(
                            fallbackIcon: Icons.video_library_outlined,
                            fallbackTitle: t(
                              'p3.videos.noVideosTitle',
                              locale: l,
                            ),
                            fallbackDescription: t(
                              'p3.videos.noVideosDesc',
                              locale: l,
                            ),
                            onRefresh: _refreshVideos,
                          ),
                        ),
                      ],
                    )
                  : shortFilteredVideos.isEmpty
                  ? (_feedFilterIds.isNotEmpty && filteredFeedErrors.isNotEmpty)
                        ? ErrorStateView(
                            error: filteredFeedErrors.length == 1
                                ? 'Failed to load this feed page.'
                                : 'Failed to load one or more filtered feeds.',
                            prefix: 'Filtered feeds unavailable',
                            onRetry: () {
                              for (final failure in filteredFeedErrors) {
                                _retryFilteredFeedPage(
                                  failure.feedId,
                                  failure.cursor,
                                );
                              }
                            },
                          )
                        : AppEmptyState(
                            icon: Icons.filter_list_off,
                            title: t('p3.videos.noFilterMatchTitle', locale: l),
                            description: t(
                              'p3.videos.noFilterMatchDesc',
                              locale: l,
                            ),
                            action: FilledButton.tonalIcon(
                              onPressed: () {
                                setState(() {
                                  _feedFilterIds.clear();
                                  _includeWatched = true;
                                  _shortFormFilter = ShortFormVideoFilter.all;
                                  _resetFilteredFeedPagination();
                                });
                                _jumpFeedViewsToTop();
                                _persistLocalPrefs();
                              },
                              icon: const Icon(Icons.clear),
                              label: Text(
                                t('p3.common.clearFilters', locale: l),
                              ),
                            ),
                          )
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _buildCardView(
                          shortFilteredVideos,
                          watchedIds,
                          sourceVideos,
                          activeFeedVideoId,
                        ),
                        _buildListView(
                          shortFilteredVideos,
                          watchedIds,
                          sourceVideos,
                          activeFeedVideoId,
                        ),
                        _buildSummaryView(
                          shortFilteredVideos,
                          notesByVideo,
                          activeFeedVideoId,
                        ),
                      ],
                    );

              return Column(
                children: [
                  if (_hasFeedFilters && filteredFeedErrors.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      child: Card(
                        child: ListTile(
                          leading: const Icon(Icons.warning_amber_rounded),
                          title: Text(
                            filteredFeedErrors.length == 1
                                ? 'A filtered feed page failed to load.'
                                : '${filteredFeedErrors.length} filtered feed pages failed to load.',
                          ),
                          subtitle: const Text(
                            'Visible videos stay available. Retry the failed pages only.',
                          ),
                          trailing: TextButton(
                            onPressed: () {
                              for (final failure in filteredFeedErrors) {
                                _retryFilteredFeedPage(
                                  failure.feedId,
                                  failure.cursor,
                                );
                              }
                            },
                            child: const Text('Retry'),
                          ),
                        ),
                      ),
                    ),
                  if (_hasFeedFilters && isLoadingMoreFilteredFeeds)
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
                      child: LinearProgressIndicator(minHeight: 3),
                    ),
                  UiHintCard(
                    hintId: 'videos-first-actions',
                    icon: Icons.tips_and_updates_outlined,
                    title: t('p3.videos.hintTitle', locale: l),
                    message: t('p3.videos.hintMessage', locale: l),
                    actionLabel: t('p3.videos.hintAction', locale: l),
                    onAction: _refreshVideos,
                  ),
                  Expanded(child: body),
                ],
              );
            },
            loading: () => _buildShimmerLoading(),
            error: (error, stack) => ErrorStateView(
              error: error,
              prefix: 'Failed to load videos',
              onRetry: () => ref.invalidate(videosProvider(_videosArgs)),
            ),
          );
        },
        loading: () => const YoutubeConnectionLoadingState(
          title: 'Checking your YouTube library',
          description:
              'ReplayGlowz is confirming whether your YouTube account is connected before loading your videos.',
        ),
        error: (error, stack) => ErrorStateView(
          error: error,
          prefix: 'Failed to check YouTube connection',
          onRetry: () => ref.invalidate(youtubeConnectionProvider),
        ),
      ),
      floatingActionButton: youtubeConnected ? _buildFeedActionButton() : null,
    );
  }

  Widget _buildFeedActionButton() {
    final refreshTooltip =
        'Refresh feed (${youtubeQuotaCostLabel(YoutubeQuotaCost.syncAllPlaylists)})';
    return GestureDetector(
      onPanStart: (_) => _feedActionDragDelta = Offset.zero,
      onPanUpdate: (details) {
        _feedActionDragDelta += details.delta;
      },
      onPanEnd: (_) {
        if (_feedActionDragDelta.dx < -20 || _feedActionDragDelta.dy < -20) {
          setState(() => _feedActionRefreshMode = true);
        }
        _feedActionDragDelta = Offset.zero;
      },
      child: FloatingActionButton(
        onPressed: _feedActionRefreshMode ? _refreshVideos : _playVisibleFeed,
        tooltip: _feedActionRefreshMode ? refreshTooltip : 'Play feed',
        child: Icon(
          _feedActionRefreshMode ? Icons.refresh : Icons.play_arrow_rounded,
        ),
      ),
    );
  }

  void _playVisibleFeed() {
    final videoIds = _visibleFeedQueue
        .map((video) => video.youtubeVideoId)
        .where((id) => id.isNotEmpty)
        .toList(growable: false);

    if (videoIds.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('No feed videos to play.')));
      return;
    }

    ref
        .read(playbackSessionProvider.notifier)
        .start(
          sourceType: PlaybackSourceType.feed,
          sourceTitle: 'Feed',
          items: _visibleFeedQueue.map(PlaybackQueueItem.fromVideo).toList(),
          currentVideoId: videoIds.first,
        );
    context.go(
      Uri(
        path: Routes.play,
        queryParameters: {'videoId': videoIds.first, 'autoPlay': '1'},
      ).toString(),
    );
  }

  Future<void> _refreshVideos() async {
    final confirmed = await confirmYoutubeQuotaRisk(
      context: context,
      ref: ref,
      cost: YoutubeQuotaCost.syncAllPlaylists,
      actionLabel: 'Refreshing videos',
    );
    if (!confirmed) return;

    try {
      await syncAllPlaylists(ref);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Refresh complete. If this YouTube account is new, create a YouTube playlist or channel, then refresh again.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Refresh failed');
    } finally {
      if (mounted && _feedActionRefreshMode) {
        setState(() => _feedActionRefreshMode = false);
      }
    }
  }

  Widget _buildShimmerLoading() {
    return AppLoadingListSkeleton(
      itemCount: 5,
      itemBuilder: (context, index) {
        return Card(
          margin: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 200,
                color: Theme.of(context).colorScheme.surface,
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 16,
                      width: 200,
                      color: Theme.of(context).colorScheme.surface,
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 12,
                      width: 120,
                      color: Theme.of(context).colorScheme.surface,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  List<YouTubeVideo> _mergeFeedVideos(
    Map<String, List<AsyncValue<VirtualFeedDetails>>> feedDetailsByFeedId,
  ) {
    final videosById = <String, YouTubeVideo>{};
    for (final feedDetails in feedDetailsByFeedId.values) {
      for (final detailsAsync in feedDetails) {
        detailsAsync.whenData((details) {
          for (final video in details.videos) {
            final key = video.youtubeVideoId.isNotEmpty
                ? video.youtubeVideoId
                : video.id;
            videosById.putIfAbsent(key, () => video);
          }
        });
      }
    }
    final videos = videosById.values.toList(growable: false);
    videos.sort((a, b) {
      final aTime = _videoSortTimestamp(a);
      final bTime = _videoSortTimestamp(b);
      return _sortOrder == 'asc'
          ? aTime.compareTo(bTime)
          : bTime.compareTo(aTime);
    });
    return videos;
  }

  List<YouTubeVideo> _filterWatchedVideos(
    List<YouTubeVideo> videos,
    Set<String> watchedIds,
  ) {
    if (_includeWatched || watchedIds.isEmpty) {
      return videos;
    }
    return videos
        .where(
          (video) =>
              !watchedIds.contains(video.youtubeVideoId) ||
              _exitingWatchedVideoIds.contains(video.youtubeVideoId),
        )
        .toList(growable: false);
  }

  Widget _buildAnimatedWatchTransition({
    required String videoId,
    required Widget child,
  }) {
    final isExiting = _exitingWatchedVideoIds.contains(videoId);
    final isEntering = _enteringWatchedVideoIds.contains(videoId);
    final begin = isEntering ? 0.0 : 1.0;
    final end = isExiting ? 0.0 : 1.0;
    return TweenAnimationBuilder<double>(
      duration: _watchTransitionDuration,
      curve: Curves.easeOutCubic,
      tween: Tween<double>(begin: begin, end: end),
      child: child,
      builder: (context, value, builtChild) {
        final clamped = value.clamp(0.0, 1.0);
        return ClipRect(
          child: Align(
            alignment: Alignment.topCenter,
            heightFactor: clamped,
            child: Opacity(
              opacity: clamped,
              child: Transform.scale(
                scale: 0.96 + (clamped * 0.04),
                alignment: Alignment.topCenter,
                child: builtChild,
              ),
            ),
          ),
        );
      },
    );
  }

  List<YouTubeVideo> _filterShortFormVideos(List<YouTubeVideo> videos) {
    return switch (_shortFormFilter) {
      ShortFormVideoFilter.all => videos,
      ShortFormVideoFilter.excludeShorts =>
        videos
            .where((video) => !video.isProbablyShortForm)
            .toList(growable: false),
      ShortFormVideoFilter.onlyShorts =>
        videos
            .where((video) => video.isProbablyShortForm)
            .toList(growable: false),
    };
  }

  int _videoSortTimestamp(YouTubeVideo video) {
    final publishedAt = video.publishedAt;
    if (publishedAt != null) {
      final parsed = DateTime.tryParse(publishedAt);
      if (parsed != null) {
        return parsed.millisecondsSinceEpoch;
      }
    }
    return video.cachedAt;
  }

  Widget _buildCardView(
    List<YouTubeVideo> videos,
    Set<String> watchedIds,
    List<YouTubeVideo> sourceVideos,
    String? activeVideoId,
  ) {
    return _buildFeedScrollSurface(
      tabIndex: 0,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return ListView.builder(
            controller: _cardScrollController,
            key: const PageStorageKey('videos-card'),
            padding: EdgeInsets.fromLTRB(
              16,
              16,
              16,
              _feedTrailingAlignmentPadding(constraints),
            ),
            itemCount: videos.length,
            itemBuilder: (context, index) {
              final video = videos[index];
              return _buildAnimatedWatchTransition(
                videoId: video.youtubeVideoId,
                child: KeyedSubtree(
                  key: _feedItemKeyForTab(0, video),
                  child: VideoCard(
                    video: video,
                    isActive: video.youtubeVideoId == activeVideoId,
                    trailing: _buildVideoActionMenu(
                      video,
                      watchedIds,
                      sourceVideos,
                    ),
                    onTap: () => _openVideo(context, video.youtubeVideoId),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildListView(
    List<YouTubeVideo> videos,
    Set<String> watchedIds,
    List<YouTubeVideo> sourceVideos,
    String? activeVideoId,
  ) {
    return _buildFeedScrollSurface(
      tabIndex: 1,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return ListView.builder(
            controller: _listScrollController,
            key: const PageStorageKey('videos-list'),
            padding: EdgeInsets.only(
              bottom: _feedTrailingAlignmentPadding(constraints),
            ),
            itemCount: videos.length,
            itemBuilder: (context, index) {
              final video = videos[index];
              return _buildAnimatedWatchTransition(
                videoId: video.youtubeVideoId,
                child: KeyedSubtree(
                  key: _feedItemKeyForTab(1, video),
                  child: VideoListTile(
                    video: video,
                    isActive: video.youtubeVideoId == activeVideoId,
                    trailing: _buildVideoActionMenu(
                      video,
                      watchedIds,
                      sourceVideos,
                    ),
                    onTap: () => _openVideo(context, video.youtubeVideoId),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildSummaryView(
    List<YouTubeVideo> videos,
    Map<String, int> notesByVideo,
    String? activeVideoId,
  ) {
    return _buildFeedScrollSurface(
      tabIndex: 2,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return ListView.builder(
            controller: _summaryScrollController,
            key: const PageStorageKey('videos-summary'),
            padding: EdgeInsets.fromLTRB(
              16,
              16,
              16,
              _feedTrailingAlignmentPadding(constraints),
            ),
            itemCount: videos.length,
            itemBuilder: (context, index) {
              final video = videos[index];
              final isActive = video.youtubeVideoId == activeVideoId;
              final noteCount = notesByVideo[video.youtubeVideoId] ?? 0;
              final durationSec = parseDuration(video.duration);
              final theme = Theme.of(context);
              final colorScheme = theme.colorScheme;

              return _buildAnimatedWatchTransition(
                videoId: video.youtubeVideoId,
                child: KeyedSubtree(
                  key: _feedItemKeyForTab(2, video),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeOutCubic,
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isActive
                            ? colorScheme.primary.withValues(alpha: 0.52)
                            : Colors.transparent,
                        width: 1.5,
                      ),
                      boxShadow: isActive
                          ? [
                              BoxShadow(
                                color: colorScheme.primary.withValues(
                                  alpha: 0.12,
                                ),
                                blurRadius: 16,
                                offset: const Offset(0, 8),
                              ),
                            ]
                          : null,
                    ),
                    child: Card(
                      margin: EdgeInsets.zero,
                      color: isActive
                          ? Color.alphaBlend(
                              colorScheme.primary.withValues(alpha: 0.08),
                              colorScheme.surface,
                            )
                          : null,
                      child: InkWell(
                        onTap: () {
                          _openVideo(context, video.youtubeVideoId);
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (isActive) ...[
                                _NowPlayingBadge(colorScheme: colorScheme),
                                const SizedBox(height: 8),
                              ],
                              Text(
                                video.title,
                                style: theme.textTheme.titleSmall,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                video.description ??
                                    'No description available for this video.',
                                style: theme.textTheme.bodySmall,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(Icons.notes, size: 16),
                                  const SizedBox(width: 4),
                                  Text(
                                    '$noteCount note${noteCount == 1 ? '' : 's'}',
                                    style: theme.textTheme.labelSmall,
                                  ),
                                  const SizedBox(width: 16),
                                  if (durationSec != null) ...[
                                    const Icon(Icons.schedule, size: 16),
                                    const SizedBox(width: 4),
                                    Text(
                                      formatDuration(durationSec),
                                      style: theme.textTheme.labelSmall,
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _openVideo(BuildContext context, String youtubeVideoId) {
    _persistScroll();
    if (youtubeVideoId.isEmpty) {
      showErrorSnackBar(
        context,
        error: 'This video is missing an identifier.',
        prefix: 'Cannot open video',
      );
      return;
    }

    final queueItems = _visibleFeedQueue
        .map(PlaybackQueueItem.fromVideo)
        .where((item) => item.youtubeVideoId.isNotEmpty)
        .toList(growable: false);
    final queueIds = queueItems
        .map((item) => item.youtubeVideoId)
        .toList(growable: false);
    if (queueIds.contains(youtubeVideoId)) {
      ref
          .read(playbackSessionProvider.notifier)
          .start(
            sourceType: PlaybackSourceType.feed,
            sourceTitle: 'Feed',
            items: queueItems,
            currentVideoId: youtubeVideoId,
          );
    }
    ref.read(activePlayVideoIdProvider.notifier).setVideoId(youtubeVideoId);
    ref.read(appPlaybackControllerProvider.notifier).setActiveVideo(true);

    context.go(
      Uri(
        path: Routes.play,
        queryParameters: {'videoId': youtubeVideoId},
      ).toString(),
    );
  }

  Widget _buildVideoActionMenu(
    YouTubeVideo video,
    Set<String> watchedIds,
    List<YouTubeVideo> sourceVideos,
  ) {
    final isWatched = watchedIds.contains(video.youtubeVideoId);
    return PopupMenuButton<String>(
      tooltip: isWatched ? 'Watched video actions' : 'Video actions',
      onSelected: (value) =>
          _handleVideoAction(value, video, isWatched, sourceVideos),
      itemBuilder: (context) => [
        const PopupMenuItem(
          value: 'play',
          child: _VideoActionMenuItem(icon: Icons.play_arrow, label: 'Play'),
        ),
        const PopupMenuItem(
          value: 'share',
          child: _VideoActionMenuItem(
            icon: Icons.share_outlined,
            label: 'Copy YouTube link',
          ),
        ),
        PopupMenuItem(
          value: isWatched ? 'unwatched' : 'watched',
          child: _VideoActionMenuItem(
            icon: isWatched
                ? Icons.visibility_off_outlined
                : Icons.visibility_outlined,
            label: isWatched ? 'Mark unwatched' : 'Mark watched',
          ),
        ),
        const PopupMenuItem(
          value: 'add-to-playlist',
          child: _VideoActionMenuItem(
            icon: Icons.playlist_add,
            label: 'Add to playlist',
          ),
        ),
        const PopupMenuItem(
          value: 'hide',
          child: _VideoActionMenuItem(
            icon: Icons.hide_source_outlined,
            label: 'Hide from library',
          ),
        ),
      ],
    );
  }

  Future<void> _handleVideoAction(
    String action,
    YouTubeVideo video,
    bool isWatched,
    List<YouTubeVideo> sourceVideos,
  ) async {
    switch (action) {
      case 'play':
        _persistScroll();
        _openVideo(context, video.youtubeVideoId);
        return;
      case 'share':
        await Clipboard.setData(
          ClipboardData(
            text: 'https://www.youtube.com/watch?v=${video.youtubeVideoId}',
          ),
        );
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('YouTube link copied.')));
        return;
      case 'watched':
      case 'unwatched':
        try {
          final animateVisibility =
              !_includeWatched &&
              sourceVideos.any((item) => item.youtubeVideoId == video.youtubeVideoId);
          _stageWatchStateTransition(
            video.youtubeVideoId,
            watched: !isWatched,
            animateVisibility: animateVisibility,
          );
          if (isWatched) {
            await unmarkWatched(ref, video.youtubeVideoId);
          } else {
            await markWatched(ref, video.youtubeVideoId);
          }
          ref
            ..invalidate(watchedVideosProvider)
            ..invalidate(videosProvider(_videosArgs));
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                isWatched ? 'Marked unwatched.' : 'Marked watched.',
              ),
            ),
          );
        } catch (e) {
          if (mounted) {
            setState(() {
              _watchOverrides[video.youtubeVideoId] = isWatched;
              _exitingWatchedVideoIds.remove(video.youtubeVideoId);
              _enteringWatchedVideoIds.remove(video.youtubeVideoId);
            });
          }
          if (!mounted) return;
          showErrorSnackBar(context, error: e, prefix: 'Watch state failed');
        }
        return;
      case 'add-to-playlist':
        await _showAddToPlaylistSheet(video);
        return;
      case 'hide':
        try {
          await hideVideo(ref, video.youtubeVideoId);
          ref
            ..invalidate(hiddenItemsProvider)
            ..invalidate(videosProvider(_videosArgs));
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Video hidden from library.')),
          );
        } catch (e) {
          if (!mounted) return;
          showErrorSnackBar(context, error: e, prefix: 'Could not hide video');
        }
        return;
    }
  }

  Future<void> _showAddToPlaylistSheet(YouTubeVideo video) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        return Consumer(
          builder: (context, ref, child) {
            final playlistsAsync = ref.watch(playlistsProvider);
            return SafeArea(
              child: playlistsAsync.when(
                data: (playlists) {
                  final writablePlaylists =
                      playlists
                          .where(
                            (playlist) => playlist.youtubePlaylistId.isNotEmpty,
                          )
                          .toList(growable: false)
                        ..sort(
                          (a, b) => a.title.toLowerCase().compareTo(
                            b.title.toLowerCase(),
                          ),
                        );

                  if (writablePlaylists.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.all(24),
                      child: AppEmptyState(
                        icon: Icons.playlist_add,
                        title: 'No playlists available',
                        description:
                            'Create or sync a playlist before adding videos.',
                      ),
                    );
                  }

                  return ListView(
                    shrinkWrap: true,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(24, 8, 24, 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Add to playlist',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 6),
                            const YoutubeQuotaCostText(
                              cost: YoutubeQuotaCost.addPlaylistItem,
                            ),
                          ],
                        ),
                      ),
                      for (final playlist in writablePlaylists)
                        ListTile(
                          leading: const Icon(Icons.playlist_play),
                          title: Text(playlist.title),
                          subtitle: Text('${playlist.videoCount} videos'),
                          onTap: () async {
                            Navigator.of(sheetContext).pop();
                            await _addVideoToPlaylist(
                              video,
                              playlist.youtubePlaylistId,
                            );
                          },
                        ),
                    ],
                  );
                },
                loading: () => const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (error, stackTrace) => Padding(
                  padding: const EdgeInsets.all(24),
                  child: ErrorStateView(
                    error: error,
                    prefix: 'Failed to load playlists',
                    onRetry: () => ref.invalidate(playlistsProvider),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _addVideoToPlaylist(
    YouTubeVideo video,
    String playlistId,
  ) async {
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
        playlistId: playlistId,
        videoId: video.youtubeVideoId,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Video added to playlist.')));
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Add to playlist failed');
    }
  }

  Future<void> _showFeedFilterSheet(
    BuildContext context, {
    required List<VirtualFeed> feeds,
  }) async {
    final l = _locale(context);
    final sortedFeeds = feeds.where((feed) => feed.isActive).toList()
      ..sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
    final draftFeedIds = Set<String>.of(_feedFilterIds);

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (sheetContext) {
        final theme = Theme.of(sheetContext);

        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.72,
          minChildSize: 0.42,
          maxChildSize: 0.94,
          builder: (context, scrollController) {
            return StatefulBuilder(
              builder: (context, setSheetState) {
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: Column(
                    children: [
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.filter_list_alt),
                        title: Text(t('p3.videos.filterByFeeds', locale: l)),
                        subtitle: Text(
                          t('p3.videos.filterByFeedsDesc', locale: l),
                        ),
                      ),
                      Expanded(
                        child: ListView(
                          controller: scrollController,
                          children: [
                            CheckboxListTile(
                              dense: true,
                              visualDensity: VisualDensity.compact,
                              contentPadding: EdgeInsets.zero,
                              secondary: const Icon(Icons.public),
                              title: Text(t('p3.videos.allVideos', locale: l)),
                              value: draftFeedIds.isEmpty,
                              onChanged: (_) {
                                setSheetState(draftFeedIds.clear);
                              },
                            ),
                            for (final feed in sortedFeeds)
                              CheckboxListTile(
                                dense: true,
                                visualDensity: VisualDensity.compact,
                                contentPadding: EdgeInsets.zero,
                                secondary: const Icon(Icons.dynamic_feed),
                                title: Text(
                                  feed.title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                subtitle: Text(
                                  tr(
                                    'p3.videos.sourceCount',
                                    locale: l,
                                    params: {
                                      'count': '${feed.activeSourceCount}',
                                    },
                                  ),
                                ),
                                value: draftFeedIds.contains(feed.id),
                                onChanged: (selected) {
                                  setSheetState(() {
                                    if (selected == true) {
                                      draftFeedIds.add(feed.id);
                                    } else {
                                      draftFeedIds.remove(feed.id);
                                    }
                                  });
                                },
                              ),
                            if (sortedFeeds.isEmpty)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 16,
                                ),
                                child: Text(
                                  t('p3.videos.noFeedFilterOptions', locale: l),
                                  style: theme.textTheme.bodyMedium,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: draftFeedIds.isEmpty
                                  ? null
                                  : () => setSheetState(draftFeedIds.clear),
                              icon: const Icon(Icons.clear),
                              label: Text(
                                t('p3.common.clearFilters', locale: l),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: () {
                                setState(() {
                                  _feedFilterIds
                                    ..clear()
                                    ..addAll(draftFeedIds);
                                  _resetFilteredFeedPagination();
                                });
                                _jumpFeedViewsToTop();
                                _persistLocalPrefs();
                                Navigator.of(sheetContext).pop();
                              },
                              icon: const Icon(Icons.check),
                              label: Text(
                                t('p3.videos.applyFilters', locale: l),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }
}

class _SortMenuItem extends PopupMenuItem<String> {
  _SortMenuItem({
    required String value,
    required String label,
    required bool selected,
  }) : super(
         value: value,
         child: Row(
           children: [
             Expanded(child: Text(label)),
             if (selected) const Icon(Icons.check, size: 18),
           ],
         ),
       );
}

class _NowPlayingBadge extends StatelessWidget {
  const _NowPlayingBadge({required this.colorScheme});

  final ColorScheme colorScheme;

  @override
  Widget build(BuildContext context) {
    return IconTheme(
      data: IconThemeData(color: colorScheme.primary, size: 14),
      child: DefaultTextStyle(
        style: Theme.of(context).textTheme.labelSmall!.copyWith(
          color: colorScheme.primary,
          fontWeight: FontWeight.w700,
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.graphic_eq_rounded),
            SizedBox(width: 4),
            Text('Now playing'),
          ],
        ),
      ),
    );
  }
}

class _FeedScrollAnchor {
  const _FeedScrollAnchor({required this.index, required this.videoId});

  final int index;
  final String videoId;
}

class _VideoActionMenuItem extends StatelessWidget {
  const _VideoActionMenuItem({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18),
        const SizedBox(width: 12),
        Expanded(child: Text(label)),
      ],
    );
  }
}

class _ViewModeMenuItem extends StatelessWidget {
  const _ViewModeMenuItem({
    required this.icon,
    required this.label,
    required this.selected,
  });

  final IconData icon;
  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      children: [
        Icon(icon, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(label)),
        if (selected) ...[
          const SizedBox(width: 12),
          Icon(Icons.check_rounded, size: 18, color: theme.colorScheme.primary),
        ],
      ],
    );
  }
}
