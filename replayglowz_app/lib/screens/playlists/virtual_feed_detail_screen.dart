import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/i18n/translations.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/providers/mutations.dart';
import 'package:replayglowz_app/providers/providers.dart';
import 'package:replayglowz_app/utils/color_utils.dart';
import 'package:replayglowz_app/widgets/app_states.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';
import 'package:replayglowz_app/widgets/media/video_list_tile.dart';
import 'package:replayglowz_app/widgets/youtube_quota_guard.dart';

const String _subscriptionsSourceId = '__subscriptions__';

class _VirtualFeedSourceCandidate {
  const _VirtualFeedSourceCandidate({
    required this.sourceType,
    required this.sourceId,
    required this.title,
    this.subtitle,
    required this.icon,
  });

  final String sourceType;
  final String sourceId;
  final String title;
  final String? subtitle;
  final IconData icon;
}

class VirtualFeedDetailScreen extends ConsumerStatefulWidget {
  /// Convex document ID of the virtual feed.
  final String feedId;

  const VirtualFeedDetailScreen({super.key, required this.feedId});

  @override
  ConsumerState<VirtualFeedDetailScreen> createState() =>
      _VirtualFeedDetailScreenState();
}

class _VirtualFeedDetailScreenState
    extends ConsumerState<VirtualFeedDetailScreen> {
  final ScrollController _scrollController = ScrollController();
  final Map<String, GlobalKey> _videoItemKeys = {};
  final Map<String, GlobalKey> _sourceTileKeys = {};

  final List<VirtualFeedSource> _editableSources = [];
  String? _lastScrolledCursor;
  bool _isReorderingSources = false;
  bool _isRefreshing = false;
  bool _isSavingOrder = false;
  List<String>? _pendingSourceOrder;

  AppLocale _locale(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'fr'
      ? AppLocale.fr
      : AppLocale.en;

  bool _sameSourceListById(
    List<VirtualFeedSource> a,
    List<VirtualFeedSource> b,
  ) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i += 1) {
      if (a[i].id != b[i].id) return false;
    }
    return true;
  }

  bool _sameSourceOrderIds(
    List<String> sourceIds,
    List<VirtualFeedSource> sources,
  ) {
    if (sourceIds.length != sources.length) return false;
    for (var i = 0; i < sourceIds.length; i += 1) {
      if (sourceIds[i] != sources[i].id) return false;
    }
    return true;
  }

  void _syncSourceList(List<VirtualFeedSource> detailsSources) {
    if (_pendingSourceOrder != null &&
        _sameSourceOrderIds(_pendingSourceOrder!, detailsSources)) {
      _isReorderingSources = false;
      _pendingSourceOrder = null;
    }

    if (_isReorderingSources) {
      return;
    }

    if (!_sameSourceListById(_editableSources, detailsSources)) {
      _editableSources
        ..clear()
        ..addAll(detailsSources);
    }
  }

  void _clearSourceOrderCache() {
    _pendingSourceOrder = null;
    _isReorderingSources = false;
  }

  bool _isSourceAlreadyAdded(
    List<VirtualFeedSource> sources,
    String sourceType,
    String sourceId,
  ) {
    return sources.any(
      (source) => source.sourceType == sourceType && source.sourceId == sourceId,
    );
  }

  String _sourceSubtitle(VirtualFeedSource source, AppLocale l) {
    final prefix = source.sourceType == 'subscriptions'
        ? t('virtualFeedDetail.sourceType.subscriptions', locale: l)
        : source.sourceType == 'channel'
        ? t('virtualFeedDetail.sourceType.channel', locale: l)
        : t('virtualFeedDetail.sourceType.playlist', locale: l);

    if (!source.isAvailable && source.staleReason != null) {
      return '$prefix • ${source.staleReason!}';
    }

    final suffix = source.videoCount > 0
        ? '${source.videoCount} ${t('virtualFeedDetail.videoCount', locale: l)}'
        : t('virtualFeedDetail.noVideos', locale: l);
    return '$prefix • $suffix';
  }

  String _queueActiveVideoId() {
    return ref
            .watch(feedPlaybackQueueProvider)
            .currentVideoId ??
        ref.watch(activePlayVideoIdProvider) ??
        '';
  }

  void _invalidateFeedDetails() {
    ref.invalidate(
      virtualFeedDetailsProvider(
        VirtualFeedDetailsArgs(feedId: widget.feedId, pageSize: 100),
      ),
    );
  }

  Future<bool> _confirmDeleteFeed(BuildContext context, AppLocale l) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(t('virtualFeedDetail.deleteConfirmTitle', locale: l)),
        content: Text(t('virtualFeedDetail.deleteConfirmBody', locale: l)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(t('common.cancel', locale: l)),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(t('common.delete', locale: l)),
          ),
        ],
      ),
    );

    return result == true;
  }

  Future<bool> _confirmRemoveSource(
    BuildContext context,
    String sourceTitle,
    AppLocale l,
  ) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(t('virtualFeedDetail.removeSource', locale: l)),
        content: Text(
          '${t('virtualFeedDetail.removeSourceConfirm', locale: l)} "$sourceTitle"?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(t('common.cancel', locale: l)),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(t('common.delete', locale: l)),
          ),
        ],
      ),
    );

    return result == true;
  }

  Future<void> _openVideo(String videoId, List<YouTubeVideo> videos) async {
    if (videoId.isEmpty) return;

    final queueIds = videos
        .map((video) => video.youtubeVideoId)
        .where((id) => id.isNotEmpty)
        .toList(growable: false);
    if (queueIds.isNotEmpty) {
      ref.read(feedPlaybackQueueProvider.notifier).start(queueIds);
      ref.read(feedPlaybackQueueProvider.notifier).markCurrent(videoId);
    }

    if (mounted) {
      context.go(
        Uri(
          path: Routes.play,
          queryParameters: {'videoId': videoId, 'autoPlay': '1'},
        ).toString(),
      );
    }
  }

  Future<void> _startPlayback(List<YouTubeVideo> videos) async {
    final firstVideoId = videos
        .map((video) => video.youtubeVideoId)
        .firstWhere(
          (id) => id.isNotEmpty,
          orElse: () => '',
        );
    if (firstVideoId.isEmpty) {
      return;
    }
    await _openVideo(firstVideoId, videos);
  }

  Future<void> _scrollToActiveVideo(List<YouTubeVideo> videos, String videoId) async {
    if (videoId.isEmpty) return;

    final video = videos.firstWhere(
      (entry) => entry.youtubeVideoId == videoId,
      orElse: () => const YouTubeVideo(
        id: '',
        youtubeVideoId: '',
        playlistId: '',
        title: '',
        channelTitle: '',
        publishedAt: null,
        cachedAt: 0,
      ),
    );
    if (video.youtubeVideoId.isEmpty) return;

    final cursor = '${widget.feedId}:$videoId';
    if (_lastScrolledCursor == cursor) return;
    final key = _videoItemKeys[videoId];
    final targetContext = key?.currentContext;
    if (targetContext == null) return;

    _lastScrolledCursor = cursor;
    await Scrollable.ensureVisible(
      targetContext,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
      alignment: 0.25,
    );
  }

  Future<void> _addSourceFromCandidate(
    BuildContext context,
    VirtualFeed feed,
    _VirtualFeedSourceCandidate candidate,
    AppLocale l,
  ) async {
    try {
      await addVirtualFeedSource(
        ref,
        feedId: feed.id,
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        sourceTitle: candidate.title,
      );
      if (!mounted || !context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(t('virtualFeedDetail.sourceAdded', locale: l)),
        ),
      );
      _invalidateFeedDetails();
    } catch (e) {
      if (!mounted || !context.mounted) return;
      showErrorSnackBar(
        context,
        error: e,
        prefix: t('virtualFeedDetail.sourceAddFailed', locale: l),
      );
    }
  }

  Future<void> _toggleSource({
    required BuildContext context,
    required String feedId,
    required VirtualFeedSource source,
    required bool isActive,
    required AppLocale l,
  }) async {
    try {
      await toggleVirtualFeedSource(
        ref,
        feedId: feedId,
        sourceId: source.id,
        isActive: isActive,
      );
      if (!mounted || !context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isActive
                ? t('virtualFeedDetail.sourceToggledOn', locale: l)
                : t('virtualFeedDetail.sourceToggledOff', locale: l),
          ),
        ),
      );
    } catch (e) {
      if (!mounted || !context.mounted) return;
      showErrorSnackBar(
        context,
        error: e,
        prefix: t('virtualFeedDetail.sourceUpdateFailed', locale: l),
      );
    }
  }

  Future<void> _removeSourceAction(
    BuildContext context,
    String feedId,
    VirtualFeedSource source,
    AppLocale l,
  ) async {
    final confirmed = await _confirmRemoveSource(context, source.sourceTitle, l);
    if (!confirmed) return;

    try {
      await removeVirtualFeedSource(ref, feedId, source.id);
      if (!mounted || !context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(t('virtualFeedDetail.sourceRemoved', locale: l)),
        ),
      );
      _clearSourceOrderCache();
      _editableSources.clear();
    } catch (e) {
      if (!mounted || !context.mounted) return;
      showErrorSnackBar(
        context,
        error: e,
        prefix: t('virtualFeedDetail.sourceRemoveFailed', locale: l),
      );
    }
  }

  Future<void> _reorderSourceList(
    BuildContext context,
    VirtualFeed feed,
    List<VirtualFeedSource> current,
    int oldIndex,
    int newIndex,
    AppLocale l,
  ) async {
    if (_isSavingOrder) return;

    if (oldIndex == newIndex) return;
    if (newIndex > oldIndex) newIndex -= 1;

    final reordered = List<VirtualFeedSource>.from(current);
    final item = reordered.removeAt(oldIndex);
    reordered.insert(newIndex, item);

    final sourceIds = reordered.map((source) => source.id).toList(growable: false);
    if (_sameSourceOrderIds(sourceIds, current)) {
      return;
    }

    setState(() {
      _isSavingOrder = true;
      _isReorderingSources = true;
      _editableSources
        ..clear()
        ..addAll(reordered);
      _pendingSourceOrder = sourceIds;
    });

    try {
      await reorderVirtualFeedSources(
        ref,
        feedId: feed.id,
        sourceIds: sourceIds,
      );
      if (!mounted || !context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(t('virtualFeedDetail.sourceReordered', locale: l)),
        ),
      );
      _invalidateFeedDetails();
    } catch (e) {
      if (!mounted || !context.mounted) return;
      showErrorSnackBar(
        context,
        error: e,
        prefix: t('virtualFeedDetail.sourceOrderFailed', locale: l),
      );
      setState(() {
        _clearSourceOrderCache();
        _editableSources.clear();
        _editableSources.addAll(current);
      });
    } finally {
      if (mounted) {
        setState(() => _isSavingOrder = false);
      }
    }
  }

  Future<void> _refreshYoutubeCache(BuildContext context, AppLocale l) async {
    if (_isRefreshing) return;

    final confirmed = await confirmYoutubeQuotaRisk(
      context: context,
      ref: ref,
      cost: YoutubeQuotaCost.syncAllPlaylists,
      actionLabel: t('virtualFeedDetail.refreshCache', locale: l),
    );

    if (!confirmed) return;

    try {
      setState(() => _isRefreshing = true);
      await refreshYoutubeSubscriptions(ref);
      await syncAllPlaylists(ref);
      if (!mounted || !context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('virtualFeedDetail.refreshDone', locale: l))),
      );
      _invalidateFeedDetails();
    } catch (e) {
      if (!mounted || !context.mounted) return;
      showErrorSnackBar(
        context,
        error: e,
        prefix: t('virtualFeedDetail.refreshYoutube', locale: l),
      );
    } finally {
      if (mounted) {
        setState(() => _isRefreshing = false);
      }
    }
  }

  Future<void> _showSourcePicker(
    BuildContext context,
    VirtualFeedDetails feedDetails,
    AppLocale l,
    AsyncValue<List<YouTubeChannel>> channelsAsync,
    AsyncValue<List<YouTubePlaylist>> playlistsAsync,
  ) async {
    final channels = channelsAsync.asData?.value ?? [];
    final playlists = playlistsAsync.asData?.value ?? [];
    final isLoadingCache = channelsAsync.isLoading || playlistsAsync.isLoading;
    final hasCacheError = channelsAsync.hasError || playlistsAsync.hasError;
    final existing = feedDetails.sources;

    final candidates = <_VirtualFeedSourceCandidate>[];

    if (channels.isNotEmpty &&
        !_isSourceAlreadyAdded(existing, 'subscriptions', _subscriptionsSourceId)) {
      candidates.add(
        _VirtualFeedSourceCandidate(
          sourceType: 'subscriptions',
          sourceId: _subscriptionsSourceId,
          title: t('virtualFeedDetail.sourceType.subscriptions', locale: l),
          subtitle: t('virtualFeedDetail.sourceType.subscriptionsHint', locale: l),
          icon: Icons.rss_feed,
        ),
      );
    }

    for (final channel in channels) {
      if (_isSourceAlreadyAdded(existing, 'channel', channel.youtubeChannelId)) {
        continue;
      }
      candidates.add(
        _VirtualFeedSourceCandidate(
          sourceType: 'channel',
          sourceId: channel.youtubeChannelId,
          title: channel.title.isNotEmpty
              ? channel.title
              : t('virtualFeedDetail.untitledChannel', locale: l),
          subtitle: t('virtualFeedDetail.sourceType.channel', locale: l),
          icon: Icons.person_search,
        ),
      );
    }

    for (final playlist in playlists) {
      if (_isSourceAlreadyAdded(
        existing,
        'playlist',
        playlist.youtubePlaylistId,
      )) {
        continue;
      }
      candidates.add(
        _VirtualFeedSourceCandidate(
          sourceType: 'playlist',
          sourceId: playlist.youtubePlaylistId,
          title: playlist.title,
          subtitle:
              '${t('virtualFeedDetail.sourceType.playlist', locale: l)} • ${playlist.videoCount} ${t('virtualFeedDetail.videoCount', locale: l)}',
          icon: Icons.playlist_play,
        ),
      );
    }

    if (!mounted) return;
    final selected = await showModalBottomSheet<_VirtualFeedSourceCandidate>(
      context: context,
      isScrollControlled: true,
      builder: (dialogContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                t('virtualFeedDetail.addSource', locale: l),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              if (candidates.isEmpty)
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AppEmptyState(
                      icon: hasCacheError
                          ? Icons.warning_amber_outlined
                          : Icons.hourglass_empty,
                      title: hasCacheError
                          ? t('virtualFeedDetail.emptySourcePickerError', locale: l)
                          : isLoadingCache
                          ? t(
                              'virtualFeedDetail.emptySourcePickerLoading',
                              locale: l,
                            )
                          : t('virtualFeedDetail.emptySourcePicker', locale: l),
                      description: hasCacheError
                          ? t(
                              'virtualFeedDetail.emptySourcePickerErrorDescription',
                              locale: l,
                            )
                          : isLoadingCache
                          ? t(
                              'virtualFeedDetail.emptySourcePickerLoadingDescription',
                              locale: l,
                            )
                          : t(
                              'virtualFeedDetail.emptySourcePickerDescription',
                              locale: l,
                            ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: () async {
                        Navigator.of(dialogContext).pop();
                        if (!mounted) return;
                        await _refreshYoutubeCache(context, l);
                      },
                      icon: const Icon(Icons.refresh),
                      label: Text(t('virtualFeedDetail.sourcePickerRefresh', locale: l)),
                    ),
                  ],
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: candidates.length,
                    separatorBuilder: (context, index) => const Divider(),
                    itemBuilder: (context, index) {
                      final candidate = candidates[index];
                      return ListTile(
                        leading: Icon(candidate.icon),
                        title: Text(candidate.title),
                        subtitle: candidate.subtitle == null
                            ? null
                            : Text(candidate.subtitle!),
                        onTap: () =>
                            Navigator.of(dialogContext).pop<_VirtualFeedSourceCandidate>(
                              candidate,
                            ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );

    if (!mounted || !context.mounted || selected == null || feedDetails.feed == null) return;
    await _addSourceFromCandidate(context, feedDetails.feed!, selected, l);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = _locale(context);
    final details = ref.watch(
      virtualFeedDetailsProvider(
        VirtualFeedDetailsArgs(feedId: widget.feedId, pageSize: 100),
      ),
    );
    final channelsAsync = ref.watch(subscribedChannelsProvider);
    final playlistsAsync = ref.watch(playlistsProvider);
    final activeVideoId = _queueActiveVideoId();

    if (channelsAsync is AsyncError && playlistsAsync is AsyncError) {
      return Scaffold(
        appBar: AppBar(title: Text(t('virtualFeedDetail.title', locale: l))),
        body: ErrorStateView(
          error: channelsAsync.error ?? playlistsAsync.error!,
          onRetry: () {
            ref.invalidate(subscribedChannelsProvider);
            ref.invalidate(playlistsProvider);
          },
        ),
      );
    }

    return details.when(
      data: (detailsData) {
        final feed = detailsData.feed;
        if (feed == null) {
          return Scaffold(
            appBar: AppBar(title: Text(t('virtualFeedDetail.feedNotFound', locale: l))),
            body: ErrorStateView(
              error: t('virtualFeedDetail.feedUnavailable', locale: l),
              onRetry: () => ref.invalidate(
                virtualFeedDetailsProvider(
                  VirtualFeedDetailsArgs(feedId: widget.feedId, pageSize: 100),
                ),
              ),
              prefix: t('virtualFeedDetail.feedUnavailable', locale: l),
            ),
          );
        }

        _syncSourceList(detailsData.sources);
        final color = feed.color != null
            ? parseHexColor(feed.color!)
            : Theme.of(context).colorScheme.primary;
        final videos = detailsData.videos;
        final sources = _editableSources.toList(growable: false);
        final feedStats = detailsData.stats;

        final hasCacheError = sources.any((source) => source.isStale);

        final sourceCount = sources.length;
        final activeCount = sources.where((source) => source.isActive).length;

        final playlistIds = <String>{
          for (final video in videos) video.playlistId,
        };

        for (final video in videos) {
          if (video.youtubeVideoId.isNotEmpty &&
              !_videoItemKeys.containsKey(video.youtubeVideoId)) {
            _videoItemKeys[video.youtubeVideoId] = GlobalKey();
          }
        }

        final activeFeedVideoId = activeVideoId;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (activeFeedVideoId.isEmpty) return;
          _scrollToActiveVideo(videos, activeFeedVideoId);
        });

        return Scaffold(
          appBar: AppBar(
            title: Text(feed.title),
            actions: [
              IconButton(
                tooltip: t('virtualFeedDetail.refreshYoutube', locale: l),
                icon: _isRefreshing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh),
                onPressed: _isRefreshing
                    ? null
                    : () => _refreshYoutubeCache(context, l),
              ),
              PopupMenuButton<String>(
                onSelected: (action) async {
                  if (action == 'delete') {
                    final confirmed = await _confirmDeleteFeed(context, l);
                    if (!confirmed) return;
                    await deleteVirtualFeed(ref, feed.id);
                    if (mounted && context.mounted) {
                      context.go(Routes.playlists);
                    }
                  }
                },
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: 'delete',
                    child: Text(t('virtualFeedDetail.delete', locale: l)),
                  ),
                ],
              ),
            ],
          ),
          body: CustomScrollView(
            controller: _scrollController,
            slivers: [
              SliverToBoxAdapter(
                child: Card(
                  margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(Icons.layers, color: color, size: 20),
                          ),
                          title: Text(feed.title),
                          subtitle: Text(
                            feed.description?.trim().isNotEmpty == true
                                ? feed.description!.trim()
                                : t(
                                    'virtualFeedDetail.feedDescriptionFallback',
                                    locale: l,
                                  ),
                          ),
                          trailing: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Chip(
                                label: Text(
                                  '${feedStats.matchedVideoCount} '
                                  '${t('common.videos', locale: l)}',
                                ),
                                visualDensity: VisualDensity.compact,
                              ),
                              Chip(
                                label: Text(
                                  '$sourceCount '
                                  '${sourceCount == 1 ? t('virtualFeedDetail.sourceCountSingular', locale: l) : t('virtualFeedDetail.sourceCountPlural', locale: l)} '
                                  '• $activeCount ${t('virtualFeedDetail.sourcesActiveLabel', locale: l)}',
                                ),
                                visualDensity: VisualDensity.compact,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: FilledButton.tonal(
                                onPressed: videos.isNotEmpty
                                    ? () => _startPlayback(videos)
                                    : null,
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.play_arrow, size: 18),
                                    const SizedBox(width: 6),
                                    Text(t('virtualFeedDetail.playAll', locale: l)),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            ElevatedButton.icon(
                              onPressed: () => _showSourcePicker(
                                context,
                                detailsData,
                                l,
                                channelsAsync,
                                playlistsAsync,
                              ),
                              icon: const Icon(Icons.add),
                              label: Text(t('virtualFeedDetail.addSource', locale: l)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (hasCacheError)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Card(
                      color: Theme.of(context)
                          .colorScheme
                          .errorContainer
                          .withValues(alpha: 0.35),
                      child: ListTile(
                        leading: const Icon(Icons.warning_amber_outlined),
                        title: Text(t('virtualFeedDetail.sourceUnavailable', locale: l)),
                        subtitle: Text(
                          t('virtualFeedDetail.sourceUnavailableDesc', locale: l),
                        ),
                        trailing: TextButton(
                          onPressed: () => _refreshYoutubeCache(context, l),
                          child: Text(t('virtualFeedDetail.refreshYoutube', locale: l)),
                        ),
                      ),
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 16, 4),
                  child: Text(
                    t('virtualFeedDetail.sourceSectionTitle', locale: l),
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
              ),
              if (sources.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: AppEmptyState(
                    icon: Icons.source,
                    title: t('virtualFeedDetail.emptySources', locale: l),
                    description: t('virtualFeedDetail.emptySourcesDesc', locale: l),
                  ),
                )
              else
                SliverToBoxAdapter(
                  child: ReorderableListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: sources.length,
                    onReorder: (oldIndex, newIndex) async {
                      if (_isSavingOrder) return;
                      await _reorderSourceList(
                        context,
                        feed,
                        sources,
                        oldIndex,
                        newIndex,
                        l,
                      );
                    },
                    itemBuilder: (context, index) {
                      final source = sources[index];
                      _sourceTileKeys[source.id] =
                          _sourceTileKeys[source.id] ?? GlobalKey();
                      return Card(
                        key: _sourceTileKeys[source.id],
                        margin: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 4,
                        ),
                        child: ListTile(
                          leading: Icon(
                            source.isSubscriptionSource
                                ? Icons.rss_feed
                                : source.isChannelSource
                                    ? Icons.person_search
                                    : Icons.playlist_play,
                            color: source.isActive ? color : Colors.grey,
                          ),
                          title: Text(source.sourceTitle),
                          subtitle: Text(_sourceSubtitle(source, l)),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (!source.isAvailable)
                                Icon(
                                  Icons.warning_amber_outlined,
                                  size: 18,
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              const SizedBox(width: 8),
                              Switch(
                                value: source.isActive,
                                onChanged: (isActive) => _toggleSource(
                                  context: context,
                                  feedId: feed.id,
                                  source: source,
                                  isActive: isActive,
                                  l: l,
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline),
                                tooltip: t(
                                  'virtualFeedDetail.removeSource',
                                  locale: l,
                                ),
                                onPressed: () => _removeSourceAction(
                                  context,
                                  feed.id,
                                  source,
                                  l,
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.drag_handle),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              if (videos.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
                    child: AppEmptyState(
                      icon: Icons.dynamic_feed,
                      title: t('virtualFeedDetail.noVideosTitle', locale: l),
                      description: t(
                        'virtualFeedDetail.noVideosDescription',
                        locale: l,
                      ),
                      action: playlistIds.isNotEmpty
                          ? FilledButton(
                              onPressed: () => _startPlayback(videos),
                              child: Text(t('virtualFeedDetail.play', locale: l)),
                            )
                          : null,
                    ),
                  ),
                )
              else
                SliverList.builder(
                  itemCount: videos.length,
                  itemBuilder: (context, index) {
                    final video = videos[index];
                    final key = _videoItemKeys[video.youtubeVideoId];
                    return Card(
                      key: key,
                      margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                      child: VideoListTile(
                        video: video,
                        onTap: () => _openVideo(video.youtubeVideoId, videos),
                        trailing: activeVideoId == video.youtubeVideoId
                            ? Icon(
                                Icons.play_arrow,
                                color: Theme.of(context).colorScheme.primary,
                              )
                            : null,
                      ),
                    );
                  },
                ),
            ],
          ),
        );
      },
      loading: () => Scaffold(
        appBar: AppBar(title: Text(t('virtualFeedDetail.title', locale: l))),
        body: AppLoadingListSkeleton(
          itemCount: 8,
          itemBuilder: (context, index) => ListTile(
            title: Container(
              height: 14,
              width: 120,
              color: Theme.of(context).colorScheme.surface,
            ),
            subtitle: Container(
              height: 10,
              width: 80,
              color: Theme.of(context).colorScheme.surface,
            ),
          ),
        ),
      ),
      error: (error, stack) => Scaffold(
        appBar: AppBar(title: Text(t('virtualFeedDetail.feedUnavailable', locale: l))),
        body: ErrorStateView(
          error: error,
          prefix: t('virtualFeedDetail.feedUnavailable', locale: l),
          onRetry: () => ref.invalidate(
            virtualFeedDetailsProvider(
              VirtualFeedDetailsArgs(feedId: widget.feedId, pageSize: 100),
            ),
          ),
        ),
      ),
    );
  }
}
