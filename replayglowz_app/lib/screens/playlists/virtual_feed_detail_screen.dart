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

class _VirtualFeedVideoListItem {
  const _VirtualFeedVideoListItem._({this.headerTitle, this.video});

  factory _VirtualFeedVideoListItem.header(String title) {
    return _VirtualFeedVideoListItem._(headerTitle: title);
  }

  factory _VirtualFeedVideoListItem.video(YouTubeVideo video) {
    return _VirtualFeedVideoListItem._(video: video);
  }

  final String? headerTitle;
  final YouTubeVideo? video;

  bool get isHeader => headerTitle != null;
}

class _SortMenuItem extends PopupMenuItem<String> {
  _SortMenuItem({
    required String value,
    required IconData icon,
    required String label,
    required bool selected,
  }) : super(
         value: value,
         child: Row(
           children: [
             Icon(icon, size: 18),
             const SizedBox(width: 10),
             Expanded(child: Text(label)),
             if (selected) const Icon(Icons.check_rounded, size: 18),
           ],
         ),
       );
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
      (source) =>
          source.sourceType == sourceType && source.sourceId == sourceId,
    );
  }

  String _sourceSubtitle(VirtualFeedSource source, AppLocale l) {
    final prefix = source.sourceType == 'subscriptions'
        ? t('virtualFeedDetail.sourceType.subscriptions', locale: l)
        : source.sourceType == 'video'
        ? t('virtualFeedDetail.sourceType.video', locale: l)
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

  String _sortOrderLabel(String sortOrder, AppLocale l) {
    return switch (sortOrder) {
      'oldest' => t('virtualFeedDetail.sortOldest', locale: l),
      'sourceOrder' => t('virtualFeedDetail.sortSourceOrder', locale: l),
      _ => t('virtualFeedDetail.sortNewest', locale: l),
    };
  }

  IconData _sortOrderIcon(String sortOrder) {
    return switch (sortOrder) {
      'oldest' => Icons.arrow_upward_rounded,
      'sourceOrder' => Icons.low_priority_rounded,
      _ => Icons.arrow_downward_rounded,
    };
  }

  List<_VirtualFeedVideoListItem> _videoListItems(
    List<YouTubeVideo> videos,
    bool groupBySource,
  ) {
    if (!groupBySource) {
      return videos
          .map(_VirtualFeedVideoListItem.video)
          .toList(growable: false);
    }

    final items = <_VirtualFeedVideoListItem>[];
    String? currentSourceKey;
    for (final video in videos) {
      final sourceKey =
          '${video.feedSourceType ?? 'unknown'}:${video.feedSourceId ?? ''}';
      if (sourceKey != currentSourceKey) {
        currentSourceKey = sourceKey;
        items.add(
          _VirtualFeedVideoListItem.header(
            video.feedSourceTitle?.trim().isNotEmpty == true
                ? video.feedSourceTitle!.trim()
                : video.channelTitle,
          ),
        );
      }
      items.add(_VirtualFeedVideoListItem.video(video));
    }
    return items;
  }

  List<YouTubeVideo> _videosForSources(
    List<YouTubeVideo> videos,
    List<VirtualFeedSource> sources,
  ) {
    final sourceKeys = sources
        .map((source) => '${source.sourceType}:${source.sourceId}')
        .toSet();

    return videos
        .where((video) {
          final sourceType = video.feedSourceType;
          final sourceId = video.feedSourceId;
          if (sourceType == null || sourceId == null) return true;
          return sourceKeys.contains('$sourceType:$sourceId');
        })
        .toList(growable: false);
  }

  String _queueActiveVideoId() {
    return ref.watch(playbackSessionProvider).currentVideoId ??
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

  Future<void> _openVideo(
    String videoId,
    List<YouTubeVideo> videos, {
    String? sourceTitle,
  }) async {
    if (videoId.isEmpty) return;

    final queueItems = videos
        .map(PlaybackQueueItem.fromVideo)
        .where((item) => item.youtubeVideoId.isNotEmpty)
        .toList(growable: false);
    if (queueItems.isNotEmpty) {
      ref
          .read(playbackSessionProvider.notifier)
          .start(
            sourceType: PlaybackSourceType.virtualFeed,
            sourceId: widget.feedId,
            sourceTitle: sourceTitle ?? 'ReplayGlowz feed',
            items: queueItems,
            currentVideoId: videoId,
          );
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

  Future<void> _startPlayback(
    List<YouTubeVideo> videos, {
    String? sourceTitle,
  }) async {
    final firstVideoId = videos
        .map((video) => video.youtubeVideoId)
        .firstWhere((id) => id.isNotEmpty, orElse: () => '');
    if (firstVideoId.isEmpty) {
      return;
    }
    await _openVideo(firstVideoId, videos, sourceTitle: sourceTitle);
  }

  Future<void> _scrollToActiveVideo(
    List<YouTubeVideo> videos,
    String videoId,
  ) async {
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
        SnackBar(content: Text(t('virtualFeedDetail.sourceAdded', locale: l))),
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

  Future<void> _addChannelSources(
    BuildContext context,
    String feedId,
    List<PlaylistChannelCandidate> channels,
    AppLocale l,
  ) async {
    if (channels.isEmpty) return;
    try {
      final result = await addVirtualFeedChannelSources(
        ref,
        feedId: feedId,
        channels: channels,
      );
      if (!mounted || !context.mounted) return;
      final message = tr(
        'virtualFeedDetail.batchSourceAdded',
        locale: l,
        params: {
          'added': result.addedCount.toString(),
          'already': result.alreadyAddedCount.toString(),
          'rejected': result.rejectedCount.toString(),
        },
      );
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
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
    final confirmed = await _confirmRemoveSource(
      context,
      source.sourceTitle,
      l,
    );
    if (!confirmed) return;

    final previousSources = _editableSources.toList(growable: false);
    try {
      setState(() {
        _clearSourceOrderCache();
        _editableSources.removeWhere((entry) => entry.id == source.id);
        _sourceTileKeys.remove(source.id);
      });
      await removeVirtualFeedSource(ref, feedId, source.id);
      if (!mounted || !context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(t('virtualFeedDetail.sourceRemoved', locale: l)),
        ),
      );
    } catch (e) {
      if (!mounted || !context.mounted) return;
      setState(() {
        _editableSources
          ..clear()
          ..addAll(previousSources);
      });
      showErrorSnackBar(
        context,
        error: e,
        prefix: t('virtualFeedDetail.sourceRemoveFailed', locale: l),
      );
    }
  }

  Future<void> _updateFeedSortOrder(
    BuildContext context,
    VirtualFeed feed,
    String sortOrder,
    AppLocale l,
  ) async {
    try {
      await updateVirtualFeed(ref, feedId: feed.id, sortOrder: sortOrder);
      if (!mounted || !context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('virtualFeedDetail.sortUpdated', locale: l))),
      );
    } catch (error) {
      if (!mounted || !context.mounted) return;
      showErrorSnackBar(
        context,
        error: error,
        prefix: t('virtualFeedDetail.sortUpdateFailed', locale: l),
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

    final sourceIds = reordered
        .map((source) => source.id)
        .toList(growable: false);
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

  Future<int?> _refreshSubscriptionsCache(
    BuildContext context,
    AppLocale l,
  ) async {
    if (_isRefreshing) return null;

    final confirmed = await confirmYoutubeQuotaRisk(
      context: context,
      ref: ref,
      cost: YoutubeQuotaCost.syncSubscriptions,
      actionLabel: t('virtualFeedDetail.importSubscriptions', locale: l),
    );

    if (!confirmed) return null;

    try {
      setState(() => _isRefreshing = true);
      final result = await refreshYoutubeSubscriptions(ref);
      if (!mounted || !context.mounted) return null;
      final count = result is List ? result.length : 0;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            tr(
              'virtualFeedDetail.subscriptionsImported',
              locale: l,
              params: {'count': count.toString()},
            ),
          ),
        ),
      );
      return count;
    } catch (e) {
      if (!mounted || !context.mounted) return null;
      showErrorSnackBar(
        context,
        error: e,
        prefix: t('virtualFeedDetail.subscriptionsImportFailed', locale: l),
      );
      return null;
    } finally {
      if (mounted) {
        setState(() => _isRefreshing = false);
      }
    }
  }

  Future<bool> _backfillPlaylistChannelMetadata(
    BuildContext context,
    YouTubePlaylist playlist,
    PlaylistChannelCandidatesArgs args,
    AppLocale l,
  ) async {
    if (_isRefreshing) return false;

    final confirmed = await confirmYoutubeQuotaRisk(
      context: context,
      ref: ref,
      cost: YoutubeQuotaCost.syncPlaylist,
      actionLabel: t('virtualFeedDetail.enrichPlaylistChannels', locale: l),
    );

    if (!confirmed) return false;

    try {
      setState(() => _isRefreshing = true);
      final result = await backfillPlaylistChannelMetadata(
        ref,
        youtubePlaylistId: playlist.youtubePlaylistId,
      );
      ref.invalidate(playlistChannelCandidatesProvider(args));
      if (!mounted || !context.mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            tr(
              'virtualFeedDetail.playlistChannelsEnriched',
              locale: l,
              params: {
                'updated': result.updatedCount.toString(),
                'remaining': result.remainingMissingCount.toString(),
              },
            ),
          ),
        ),
      );
      return true;
    } catch (e) {
      if (!mounted || !context.mounted) return false;
      showErrorSnackBar(
        context,
        error: e,
        prefix: t('virtualFeedDetail.playlistChannelsEnrichFailed', locale: l),
      );
      return false;
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
    final feed = feedDetails.feed;
    if (feed == null) return;

    if (!mounted) return;
    final selected = await showModalBottomSheet<String>(
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
              const SizedBox(height: 6),
              Text(
                t('virtualFeedDetail.addSourceHelp', locale: l),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 12),
              if (channels.isEmpty && playlists.isEmpty)
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AppEmptyState(
                      icon: hasCacheError
                          ? Icons.warning_amber_outlined
                          : Icons.hourglass_empty,
                      title: hasCacheError
                          ? t(
                              'virtualFeedDetail.emptySourcePickerError',
                              locale: l,
                            )
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
                      label: Text(
                        t('virtualFeedDetail.sourcePickerRefresh', locale: l),
                      ),
                    ),
                  ],
                )
              else
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ListTile(
                      leading: const Icon(Icons.person_search),
                      title: Text(
                        t('virtualFeedDetail.sourceModeChannels', locale: l),
                      ),
                      subtitle: Text(
                        channels.isEmpty
                            ? t(
                                'virtualFeedDetail.sourceModeChannelsEmptyDescription',
                                locale: l,
                              )
                            : t(
                                'virtualFeedDetail.sourceModeChannelsDescription',
                                locale: l,
                              ),
                      ),
                      onTap: () => Navigator.of(dialogContext).pop(
                        channels.isEmpty ? 'importSubscriptions' : 'channels',
                      ),
                    ),
                    ListTile(
                      leading: const Icon(Icons.playlist_play),
                      title: Text(
                        t('virtualFeedDetail.sourceModePlaylist', locale: l),
                      ),
                      subtitle: Text(
                        t(
                          'virtualFeedDetail.sourceModePlaylistDescription',
                          locale: l,
                        ),
                      ),
                      enabled: playlists.isNotEmpty,
                      onTap: playlists.isEmpty
                          ? null
                          : () => Navigator.of(dialogContext).pop('playlist'),
                    ),
                    ListTile(
                      leading: const Icon(Icons.hub_outlined),
                      title: Text(
                        t(
                          'virtualFeedDetail.sourceModePlaylistChannels',
                          locale: l,
                        ),
                      ),
                      subtitle: Text(
                        t(
                          'virtualFeedDetail.sourceModePlaylistChannelsDescription',
                          locale: l,
                        ),
                      ),
                      enabled: playlists.isNotEmpty,
                      onTap: playlists.isEmpty
                          ? null
                          : () => Navigator.of(
                              dialogContext,
                            ).pop('playlistChannels'),
                    ),
                    if (!_isSourceAlreadyAdded(
                      feedDetails.sources,
                      'subscriptions',
                      _subscriptionsSourceId,
                    ))
                      ListTile(
                        leading: const Icon(Icons.rss_feed),
                        title: Text(
                          t(
                            'virtualFeedDetail.sourceType.subscriptions',
                            locale: l,
                          ),
                        ),
                        subtitle: Text(
                          channels.isEmpty
                              ? t(
                                  'virtualFeedDetail.sourceType.subscriptionsEmptyHint',
                                  locale: l,
                                )
                              : t(
                                  'virtualFeedDetail.sourceType.subscriptionsHint',
                                  locale: l,
                                ),
                        ),
                        onTap: () => Navigator.of(dialogContext).pop(
                          channels.isEmpty
                              ? 'importSubscriptionsForAll'
                              : 'subscriptions',
                        ),
                      ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );

    if (!mounted || !context.mounted || selected == null) return;
    switch (selected) {
      case 'channels':
        await _showChannelSourcePicker(
          context,
          feed,
          feedDetails.sources,
          channels,
          l,
        );
      case 'importSubscriptions':
        await _refreshSubscriptionsCache(context, l);
      case 'importSubscriptionsForAll':
        final count = await _refreshSubscriptionsCache(context, l);
        if (!mounted || !context.mounted || count == null || count == 0) {
          return;
        }
        await _addSourceFromCandidate(
          context,
          feed,
          _VirtualFeedSourceCandidate(
            sourceType: 'subscriptions',
            sourceId: _subscriptionsSourceId,
            title: t('virtualFeedDetail.sourceType.subscriptions', locale: l),
            subtitle: t(
              'virtualFeedDetail.sourceType.subscriptionsHint',
              locale: l,
            ),
            icon: Icons.rss_feed,
          ),
          l,
        );
      case 'playlist':
        await _showPlaylistSourcePicker(
          context,
          feed,
          feedDetails.sources,
          playlists,
          l,
        );
      case 'playlistChannels':
        await _showPlaylistChannelSourcePicker(context, feed, playlists, l);
      case 'subscriptions':
        await _addSourceFromCandidate(
          context,
          feed,
          _VirtualFeedSourceCandidate(
            sourceType: 'subscriptions',
            sourceId: _subscriptionsSourceId,
            title: t('virtualFeedDetail.sourceType.subscriptions', locale: l),
            subtitle: t(
              'virtualFeedDetail.sourceType.subscriptionsHint',
              locale: l,
            ),
            icon: Icons.rss_feed,
          ),
          l,
        );
    }
  }

  Future<void> _showPlaylistSourcePicker(
    BuildContext context,
    VirtualFeed feed,
    List<VirtualFeedSource> existingSources,
    List<YouTubePlaylist> playlists,
    AppLocale l,
  ) async {
    final candidates = playlists
        .where(
          (playlist) => !_isSourceAlreadyAdded(
            existingSources,
            'playlist',
            playlist.youtubePlaylistId,
          ),
        )
        .toList(growable: false);
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
                t('virtualFeedDetail.sourceModePlaylist', locale: l),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              Text(
                t('virtualFeedDetail.sourceModePlaylistDescription', locale: l),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 12),
              if (candidates.isEmpty)
                AppEmptyState(
                  icon: Icons.playlist_add_check,
                  title: t('virtualFeedDetail.noPlaylistSources', locale: l),
                  description: t(
                    'virtualFeedDetail.noPlaylistSourcesDescription',
                    locale: l,
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: candidates.length,
                    separatorBuilder: (context, index) => const Divider(),
                    itemBuilder: (context, index) {
                      final playlist = candidates[index];
                      return ListTile(
                        leading: const Icon(Icons.playlist_play),
                        title: Text(playlist.title),
                        subtitle: Text(
                          '${playlist.videoCount} ${t('virtualFeedDetail.videoCount', locale: l)}',
                        ),
                        onTap: () => Navigator.of(dialogContext).pop(
                          _VirtualFeedSourceCandidate(
                            sourceType: 'playlist',
                            sourceId: playlist.youtubePlaylistId,
                            title: playlist.title,
                            icon: Icons.playlist_play,
                          ),
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
    if (!mounted || !context.mounted || selected == null) return;
    await _addSourceFromCandidate(context, feed, selected, l);
  }

  Future<void> _showChannelSourcePicker(
    BuildContext context,
    VirtualFeed feed,
    List<VirtualFeedSource> existingSources,
    List<YouTubeChannel> channels,
    AppLocale l,
  ) async {
    final selectedIds = <String>{};
    var query = '';
    final selected = await showModalBottomSheet<List<YouTubeChannel>>(
      context: context,
      isScrollControlled: true,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setSheetState) {
          final normalizedQuery = query.trim().toLowerCase();
          final filtered = channels
              .where((channel) {
                final haystack = '${channel.title} ${channel.youtubeChannelId}'
                    .toLowerCase();
                return haystack.contains(normalizedQuery);
              })
              .toList(growable: false);
          return SafeArea(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                16,
                8,
                16,
                24 + MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t('virtualFeedDetail.sourceModeChannels', locale: l),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search),
                      hintText: t(
                        'virtualFeedDetail.searchChannels',
                        locale: l,
                      ),
                    ),
                    onChanged: (value) => setSheetState(() => query = value),
                  ),
                  const SizedBox(height: 12),
                  Flexible(
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: filtered.length,
                      separatorBuilder: (context, index) => const Divider(),
                      itemBuilder: (context, index) {
                        final channel = filtered[index];
                        final alreadyAdded = _isSourceAlreadyAdded(
                          existingSources,
                          'channel',
                          channel.youtubeChannelId,
                        );
                        final isSelected = selectedIds.contains(
                          channel.youtubeChannelId,
                        );
                        return CheckboxListTile(
                          secondary: const Icon(Icons.person_search),
                          value: isSelected || alreadyAdded,
                          onChanged: alreadyAdded
                              ? null
                              : (value) => setSheetState(() {
                                  if (value == true) {
                                    selectedIds.add(channel.youtubeChannelId);
                                  } else {
                                    selectedIds.remove(
                                      channel.youtubeChannelId,
                                    );
                                  }
                                }),
                          title: Text(channel.title),
                          subtitle: alreadyAdded
                              ? Text(
                                  t(
                                    'virtualFeedDetail.sourceAlreadyAdded',
                                    locale: l,
                                  ),
                                )
                              : null,
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: selectedIds.isEmpty
                          ? null
                          : () => Navigator.of(dialogContext).pop(
                              channels
                                  .where(
                                    (channel) => selectedIds.contains(
                                      channel.youtubeChannelId,
                                    ),
                                  )
                                  .toList(growable: false),
                            ),
                      child: Text(
                        t('virtualFeedDetail.addSelectedSources', locale: l),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
    if (!mounted || !context.mounted || selected == null || selected.isEmpty) {
      return;
    }
    await _addChannelSources(
      context,
      feed.id,
      selected
          .map(
            (channel) => PlaylistChannelCandidate(
              youtubeChannelId: channel.youtubeChannelId,
              title: channel.title,
              thumbnailUrl: channel.thumbnailUrl,
              videoCount: 0,
              alreadyAdded: false,
              isSubscribed: true,
            ),
          )
          .toList(growable: false),
      l,
    );
  }

  Future<void> _showPlaylistChannelSourcePicker(
    BuildContext context,
    VirtualFeed feed,
    List<YouTubePlaylist> playlists,
    AppLocale l,
  ) async {
    final selectedPlaylist = await showModalBottomSheet<YouTubePlaylist>(
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
                t('virtualFeedDetail.sourceModePlaylistChannels', locale: l),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              Text(
                t(
                  'virtualFeedDetail.sourceModePlaylistChannelsDescription',
                  locale: l,
                ),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 12),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: playlists.length,
                  separatorBuilder: (context, index) => const Divider(),
                  itemBuilder: (context, index) {
                    final playlist = playlists[index];
                    return ListTile(
                      leading: const Icon(Icons.hub_outlined),
                      title: Text(playlist.title),
                      subtitle: Text(
                        '${playlist.videoCount} ${t('virtualFeedDetail.videoCount', locale: l)}',
                      ),
                      onTap: () => Navigator.of(dialogContext).pop(playlist),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (!mounted || !context.mounted || selectedPlaylist == null) return;
    await _showPlaylistChannelCandidates(context, feed, selectedPlaylist, l);
  }

  Future<void> _showPlaylistChannelCandidates(
    BuildContext context,
    VirtualFeed feed,
    YouTubePlaylist playlist,
    AppLocale l,
  ) async {
    final selectedIds = <String>{};
    final args = PlaylistChannelCandidatesArgs(
      feedId: feed.id,
      youtubePlaylistId: playlist.youtubePlaylistId,
    );
    final selected = await showModalBottomSheet<List<PlaylistChannelCandidate>>(
      context: context,
      isScrollControlled: true,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setSheetState) => Consumer(
          builder: (context, ref, child) {
            final candidatesAsync = ref.watch(
              playlistChannelCandidatesProvider(args),
            );
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                child: candidatesAsync.when(
                  loading: () => const SizedBox(
                    height: 220,
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (error, stack) => ErrorStateView(
                    error: error,
                    prefix: t('virtualFeedDetail.sourceAddFailed', locale: l),
                    onRetry: () =>
                        ref.invalidate(playlistChannelCandidatesProvider(args)),
                  ),
                  data: (result) {
                    final available = result.candidates
                        .where((candidate) => !candidate.alreadyAdded)
                        .toList(growable: false);
                    return Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          playlist.title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          result.missingMetadataCount > 0
                              ? tr(
                                  'virtualFeedDetail.playlistChannelMissingMetadata',
                                  locale: l,
                                  params: {
                                    'count': result.missingMetadataCount
                                        .toString(),
                                  },
                                )
                              : t(
                                  'virtualFeedDetail.playlistChannelSelectHelp',
                                  locale: l,
                                ),
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                        ),
                        const SizedBox(height: 12),
                        if (result.missingMetadataCount > 0) ...[
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: _isRefreshing
                                  ? null
                                  : () async {
                                      await _backfillPlaylistChannelMetadata(
                                        context,
                                        playlist,
                                        args,
                                        l,
                                      );
                                    },
                              icon: const Icon(Icons.manage_search),
                              label: Text(
                                t(
                                  'virtualFeedDetail.enrichPlaylistChannels',
                                  locale: l,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                        if (result.candidates.isEmpty)
                          AppEmptyState(
                            icon: Icons.hub_outlined,
                            title: t(
                              'virtualFeedDetail.noPlaylistChannels',
                              locale: l,
                            ),
                            description: t(
                              'virtualFeedDetail.noPlaylistChannelsDescription',
                              locale: l,
                            ),
                          )
                        else
                          Flexible(
                            child: ListView.separated(
                              shrinkWrap: true,
                              itemCount: result.candidates.length,
                              separatorBuilder: (context, index) =>
                                  const Divider(),
                              itemBuilder: (context, index) {
                                final candidate = result.candidates[index];
                                final isSelected = selectedIds.contains(
                                  candidate.youtubeChannelId,
                                );
                                return CheckboxListTile(
                                  secondary: const Icon(Icons.person_search),
                                  value: isSelected || candidate.alreadyAdded,
                                  onChanged: candidate.alreadyAdded
                                      ? null
                                      : (value) => setSheetState(() {
                                          if (value == true) {
                                            selectedIds.add(
                                              candidate.youtubeChannelId,
                                            );
                                          } else {
                                            selectedIds.remove(
                                              candidate.youtubeChannelId,
                                            );
                                          }
                                        }),
                                  title: Text(candidate.title),
                                  subtitle: Text(
                                    candidate.alreadyAdded
                                        ? t(
                                            'virtualFeedDetail.sourceAlreadyAdded',
                                            locale: l,
                                          )
                                        : '${candidate.videoCount} ${t('virtualFeedDetail.videoCount', locale: l)}',
                                  ),
                                );
                              },
                            ),
                          ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: selectedIds.isEmpty
                                ? null
                                : () => Navigator.of(dialogContext).pop(
                                    available
                                        .where(
                                          (candidate) => selectedIds.contains(
                                            candidate.youtubeChannelId,
                                          ),
                                        )
                                        .toList(growable: false),
                                  ),
                            child: Text(
                              t(
                                'virtualFeedDetail.addSelectedSources',
                                locale: l,
                              ),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            );
          },
        ),
      ),
    );
    if (!mounted || !context.mounted || selected == null || selected.isEmpty) {
      return;
    }
    await _addChannelSources(context, feed.id, selected, l);
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
            appBar: AppBar(
              title: Text(t('virtualFeedDetail.feedNotFound', locale: l)),
            ),
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
        final sources = _editableSources.toList(growable: false);
        final videos = _videosForSources(detailsData.videos, sources);
        final sortOrder = detailsData.sortOrder;
        final videoListItems = _videoListItems(
          videos,
          sortOrder == 'sourceOrder',
        );
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
              PopupMenuButton<String>(
                tooltip: t('virtualFeedDetail.sortVideos', locale: l),
                icon: Icon(_sortOrderIcon(sortOrder)),
                onSelected: (value) async {
                  if (value == sortOrder ||
                      (value == 'newest' && sortOrder == 'default')) {
                    return;
                  }
                  await _updateFeedSortOrder(context, feed, value, l);
                },
                itemBuilder: (context) => [
                  _SortMenuItem(
                    value: 'newest',
                    icon: Icons.arrow_downward_rounded,
                    label: t('virtualFeedDetail.sortNewest', locale: l),
                    selected: sortOrder == 'newest' || sortOrder == 'default',
                  ),
                  _SortMenuItem(
                    value: 'oldest',
                    icon: Icons.arrow_upward_rounded,
                    label: t('virtualFeedDetail.sortOldest', locale: l),
                    selected: sortOrder == 'oldest',
                  ),
                  _SortMenuItem(
                    value: 'sourceOrder',
                    icon: Icons.low_priority_rounded,
                    label: t('virtualFeedDetail.sortSourceOrder', locale: l),
                    selected: sortOrder == 'sourceOrder',
                  ),
                ],
              ),
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
                            '${feed.description?.trim().isNotEmpty == true ? feed.description!.trim() : t('virtualFeedDetail.feedDescriptionFallback', locale: l)}\n'
                            '${t('virtualFeedDetail.sortLabel', locale: l)}: ${_sortOrderLabel(sortOrder, l)}',
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
                                    ? () => _startPlayback(
                                        videos,
                                        sourceTitle: feed.title,
                                      )
                                    : null,
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.play_arrow, size: 18),
                                    const SizedBox(width: 6),
                                    Text(
                                      t('virtualFeedDetail.playAll', locale: l),
                                    ),
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
                              label: Text(
                                t('virtualFeedDetail.addSource', locale: l),
                              ),
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
                      color: Theme.of(
                        context,
                      ).colorScheme.errorContainer.withValues(alpha: 0.35),
                      child: ListTile(
                        leading: const Icon(Icons.warning_amber_outlined),
                        title: Text(
                          t('virtualFeedDetail.sourceUnavailable', locale: l),
                        ),
                        subtitle: Text(
                          t(
                            'virtualFeedDetail.sourceUnavailableDesc',
                            locale: l,
                          ),
                        ),
                        trailing: TextButton(
                          onPressed: () => _refreshYoutubeCache(context, l),
                          child: Text(
                            t('virtualFeedDetail.refreshYoutube', locale: l),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 16, 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t('virtualFeedDetail.sourceSectionTitle', locale: l),
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        t('virtualFeedDetail.sourceSectionHelp', locale: l),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (sources.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: AppEmptyState(
                    icon: Icons.source,
                    title: t('virtualFeedDetail.emptySources', locale: l),
                    description: t(
                      'virtualFeedDetail.emptySourcesDesc',
                      locale: l,
                    ),
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
                                : source.isVideoSource
                                ? Icons.play_circle_outline
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
                              onPressed: () => _startPlayback(
                                videos,
                                sourceTitle: feed.title,
                              ),
                              child: Text(
                                t('virtualFeedDetail.play', locale: l),
                              ),
                            )
                          : null,
                    ),
                  ),
                )
              else
                SliverList.builder(
                  itemCount: videoListItems.length,
                  itemBuilder: (context, index) {
                    final item = videoListItems[index];
                    if (item.isHeader) {
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
                        child: Row(
                          children: [
                            const Icon(Icons.source_outlined, size: 16),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                item.headerTitle!,
                                style: Theme.of(context).textTheme.titleSmall,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      );
                    }

                    final video = item.video!;
                    final key = _videoItemKeys[video.youtubeVideoId];
                    return Card(
                      key: key,
                      margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                      child: VideoListTile(
                        video: video,
                        onTap: () => _openVideo(
                          video.youtubeVideoId,
                          videos,
                          sourceTitle: feed.title,
                        ),
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
        appBar: AppBar(
          title: Text(t('virtualFeedDetail.feedUnavailable', locale: l)),
        ),
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
