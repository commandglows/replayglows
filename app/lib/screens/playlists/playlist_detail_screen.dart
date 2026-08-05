import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';

import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/app/theme.dart';
import 'package:replayglowz_app/i18n/translations.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/providers/mutations.dart';
import 'package:replayglowz_app/providers/providers.dart';
import 'package:replayglowz_app/utils/color_utils.dart';
import 'package:replayglowz_app/utils/duration_utils.dart';
import 'package:replayglowz_app/widgets/app_states.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';
import 'package:replayglowz_app/widgets/media/video_list_tile.dart';
import 'package:replayglowz_app/widgets/ui_hint_card.dart';
import 'package:replayglowz_app/widgets/youtube_quota_guard.dart';

/// Playlist detail screen showing the playlist header and its video list.
///
/// Convex queries/mutations used:
/// - `playlists.getPlaylistWithVideos` — fetch playlist metadata + videos
/// - `videoOrder.getOrder` — fetch custom video sort order within playlist
/// - `videoOrder.updateOrder` (or `videoOrder.saveVideoOrder`) — persist reorder changes
/// - `playlists.updatePlaylist` — update playlist metadata (title, color, etc.)
/// - `youtube.removeVideoFromYoutubePlaylist` — remove a video from the YouTube playlist
class PlaylistDetailScreen extends ConsumerStatefulWidget {
  /// Convex document ID of the playlist.
  final String id;

  const PlaylistDetailScreen({super.key, required this.id});

  @override
  ConsumerState<PlaylistDetailScreen> createState() =>
      _PlaylistDetailScreenState();
}

class _PlaylistDetailScreenState extends ConsumerState<PlaylistDetailScreen> {
  bool _isReorderMode = false;
  bool _isSavingOrder = false;
  List<YouTubeVideo> _reorderList = [];
  List<YouTubeVideo> _currentPlaylistQueue = const <YouTubeVideo>[];

  AppLocale _locale(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'fr'
      ? AppLocale.fr
      : AppLocale.en;

  bool _canMutatePlaylistOnYoutube(YouTubePlaylist? playlist) {
    return playlist != null &&
        (playlist.source == null || playlist.source == 'owned');
  }

  @override
  Widget build(BuildContext context) {
    final videosAsync = ref.watch(playlistVideosProvider(widget.id));
    final playlistsAsync = ref.watch(playlistsProvider);
    final watchedAsync = ref.watch(watchedVideosProvider);

    // Find the current playlist from the playlists list.
    YouTubePlaylist? playlist;
    playlistsAsync.whenData((playlists) {
      for (final p in playlists) {
        if (p.id == widget.id) {
          playlist = p;
          break;
        }
      }
    });

    final playlistColor = playlist?.color != null
        ? parseHexColor(playlist!.color!)
        : Theme.of(context).colorScheme.primary;
    final playlistTitle = playlist?.title ?? 'Playlist';
    final l = _locale(context);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // Collapsible playlist header
          _buildSliverAppBar(context, playlistTitle, playlistColor, playlist),
          // Stats bar
          SliverToBoxAdapter(
            child: videosAsync.when(
              data: (videos) => Column(
                children: [
                  UiHintCard(
                    hintId: 'playlist-detail-actions',
                    icon: Icons.touch_app_outlined,
                    title: t('p3.playlistDetail.hintTitle', locale: l),
                    message: t('p3.playlistDetail.hintMessage', locale: l),
                  ),
                  _buildStatsBar(context, videos),
                ],
              ),
              loading: () => _buildStatsBar(context, []),
              error: (error, stackTrace) => _buildStatsBar(context, []),
            ),
          ),
          // Video list (reorderable when in edit mode)
          videosAsync.when(
            data: (videos) {
              _currentPlaylistQueue = videos;
              if (_isReorderMode) {
                if (_reorderList.isEmpty ||
                    _reorderList.length != videos.length) {
                  _reorderList = List.from(videos);
                }
                return _buildReorderableList();
              }
              final watchedIds =
                  watchedAsync.asData?.value
                      .map((item) => item.youtubeVideoId)
                      .toSet() ??
                  const <String>{};
              return _buildVideoList(videos, watchedIds, playlist);
            },
            loading: () => SliverToBoxAdapter(child: _buildShimmerList()),
            error: (error, stack) => SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: ErrorStateView(
                  error: error,
                  prefix: 'Failed to load videos',
                  onRetry: () =>
                      ref.invalidate(playlistVideosProvider(widget.id)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShimmerList() {
    return AppLoadingListSkeleton(
      itemCount: 5,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemBuilder: (context, index) => ListTile(
        leading: Container(
          width: 100,
          height: 56,
          color: Theme.of(context).colorScheme.surface,
        ),
        title: Container(
          height: 14,
          width: 160,
          color: Theme.of(context).colorScheme.surface,
        ),
        subtitle: Container(
          height: 10,
          width: 100,
          color: Theme.of(context).colorScheme.surface,
        ),
      ),
    );
  }

  Widget _buildSliverAppBar(
    BuildContext context,
    String title,
    Color color,
    YouTubePlaylist? playlist,
  ) {
    return SliverAppBar(
      expandedHeight: 200,
      pinned: true,
      actions: [
        IconButton(
          icon: _isSavingOrder
              ? const SizedBox.square(
                  dimension: AppSpacing.md2,
                  child: CircularProgressIndicator(
                    strokeWidth: AppSpacing.xxxs,
                  ),
                )
              : Icon(_isReorderMode ? Icons.check : Icons.reorder),
          tooltip: _isReorderMode ? 'Done reordering' : 'Reorder videos',
          onPressed: _isSavingOrder
              ? null
              : () async {
                  if (!_isReorderMode) {
                    setState(() => _isReorderMode = true);
                    return;
                  }
                  await _persistVideoOrder(context);
                },
        ),
        PopupMenuButton<String>(
          onSelected: (value) async {
            switch (value) {
              case 'refresh':
                final confirmed = await confirmYoutubeQuotaRisk(
                  context: context,
                  ref: ref,
                  cost: YoutubeQuotaCost.syncPlaylist,
                  actionLabel: 'Refreshing this playlist',
                );
                if (!confirmed) break;

                try {
                  await syncPlaylist(ref, widget.id);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Refreshing playlist...')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    showErrorSnackBar(
                      context,
                      error: e,
                      prefix: 'Refresh failed',
                    );
                  }
                }
                break;
              case 'share':
                await _copyPlaylistLink(context);
                break;
              case 'edit':
                if (playlist != null) {
                  await _showEditPlaylistDialog(context, playlist);
                }
                break;
            }
          },
          itemBuilder: (context) => [
            if (_canMutatePlaylistOnYoutube(playlist))
              const PopupMenuItem(value: 'edit', child: Text('Edit Playlist')),
            const PopupMenuItem(
              value: 'refresh',
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('Refresh from YouTube'),
                subtitle: YoutubeQuotaCostText(
                  cost: YoutubeQuotaCost.syncPlaylist,
                  prefix: 'Cost',
                ),
              ),
            ),
            const PopupMenuItem(value: 'share', child: Text('Share')),
          ],
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        title: Text(title, style: Theme.of(context).textTheme.titleMedium),
        background: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                color.withValues(alpha: 0.6),
                color.withValues(alpha: 0.2),
              ],
            ),
          ),
          child: playlist?.effectiveThumbnailUrl != null
              ? CachedNetworkImage(
                  imageUrl: playlist!.effectiveThumbnailUrl!,
                  fit: BoxFit.cover,
                  color: Theme.of(context).colorScheme.scrim.withValues(
                    alpha: AppElevation.scrimOpacity,
                  ),
                  colorBlendMode: BlendMode.darken,
                  errorWidget: (context, url, error) => const Center(
                    child: Icon(
                      Icons.playlist_play,
                      size: AppSizes.emptyStateIcon,
                      color: AppColors.primaryForeground,
                    ),
                  ),
                )
              : const Center(
                  child: Icon(
                    Icons.playlist_play,
                    size: AppSizes.emptyStateIcon,
                    color: AppColors.primaryForeground,
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildStatsBar(BuildContext context, List<YouTubeVideo> videos) {
    int totalSeconds = 0;
    for (final v in videos) {
      totalSeconds += parseDuration(v.duration) ?? 0;
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          _buildStatChip(
            context,
            Icons.video_library,
            '${videos.length} video${videos.length == 1 ? '' : 's'}',
          ),
          const SizedBox(width: AppSpacing.md),
          _buildStatChip(
            context,
            Icons.schedule,
            '${formatDuration(totalSeconds)} total',
          ),
          const Spacer(),
          FilledButton.tonal(
            onPressed: videos.isNotEmpty
                ? () => _openVideo(context, videos.first.youtubeVideoId)
                : null,
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.play_arrow, size: AppSpacing.md2),
                SizedBox(width: AppSpacing.xxs),
                Text('Play All'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatChip(BuildContext context, IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: AppSizes.iconSmall,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: AppSpacing.xxs),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }

  Widget _buildVideoList(
    List<YouTubeVideo> videos,
    Set<String> watchedIds,
    YouTubePlaylist? playlist,
  ) {
    if (videos.isEmpty) {
      return const SliverToBoxAdapter(
        child: AppEmptyState(
          icon: Icons.playlist_play,
          title: 'No videos in this playlist',
          description: 'Sync the playlist to import items from YouTube.',
        ),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate((context, index) {
        final video = videos[index];
        final isWatched = watchedIds.contains(video.youtubeVideoId);
        return VideoListTile(
          video: video,
          leadingWidth: 100,
          leadingHeight: 56,
          trailing: _buildVideoActionMenu(
            video: video,
            isWatched: isWatched,
            index: index,
            videoCount: videos.length,
            canMutatePlaylistOnYoutube: _canMutatePlaylistOnYoutube(playlist),
          ),
          onTap: () => _openVideo(context, video.youtubeVideoId),
        );
      }, childCount: videos.length),
    );
  }

  Widget _buildVideoActionMenu({
    required YouTubeVideo video,
    required bool isWatched,
    required int index,
    required int videoCount,
    required bool canMutatePlaylistOnYoutube,
  }) {
    final canMove =
        canMutatePlaylistOnYoutube &&
        (video.playlistItemId?.isNotEmpty ?? false);
    return PopupMenuButton<String>(
      tooltip: 'Video actions',
      onSelected: (value) => _handleVideoAction(
        value,
        video: video,
        isWatched: isWatched,
        index: index,
        canMutatePlaylistOnYoutube: canMutatePlaylistOnYoutube,
      ),
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
        const PopupMenuItem(
          value: 'copy-to-playlist',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.playlist_add),
            title: Text('Copy to another playlist'),
            subtitle: YoutubeQuotaCostText(
              cost: YoutubeQuotaCost.addPlaylistItem,
              prefix: 'Cost',
            ),
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
        if (canMutatePlaylistOnYoutube)
          PopupMenuItem(
            value: 'move-up',
            enabled: canMove && index > 0,
            child: const _VideoActionMenuItem(
              icon: Icons.arrow_upward,
              label: 'Move up',
            ),
          ),
        if (canMutatePlaylistOnYoutube)
          PopupMenuItem(
            value: 'move-down',
            enabled: canMove && index < videoCount - 1,
            child: const _VideoActionMenuItem(
              icon: Icons.arrow_downward,
              label: 'Move down',
            ),
          ),
        const PopupMenuDivider(),
        PopupMenuItem(
          value: 'remove',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.playlist_remove),
            title: const Text('Remove from playlist'),
            subtitle: canMove
                ? const YoutubeQuotaCostText(
                    cost: YoutubeQuotaCost.removePlaylistItem,
                    prefix: 'Cost',
                  )
                : const Text('Removes it from this ReplayGlowz playlist only.'),
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
    String action, {
    required YouTubeVideo video,
    required bool isWatched,
    required int index,
    required bool canMutatePlaylistOnYoutube,
  }) async {
    switch (action) {
      case 'play':
        _openVideo(context, video.youtubeVideoId);
        return;
      case 'share':
        await _copyYoutubeLink(video.youtubeVideoId);
        return;
      case 'copy-to-playlist':
        await _showCopyToPlaylistSheet(video);
        return;
      case 'watched':
      case 'unwatched':
        await _toggleWatched(video.youtubeVideoId, isWatched);
        return;
      case 'move-up':
        await _movePlaylistItem(video, index - 1);
        return;
      case 'move-down':
        await _movePlaylistItem(video, index + 1);
        return;
      case 'remove':
        await _removePlaylistItem(
          video,
          canMutatePlaylistOnYoutube: canMutatePlaylistOnYoutube,
        );
        return;
      case 'hide':
        await _hideVideo(video.youtubeVideoId);
        return;
    }
  }

  Future<void> _copyYoutubeLink(String youtubeVideoId) async {
    await Clipboard.setData(
      ClipboardData(text: 'https://www.youtube.com/watch?v=$youtubeVideoId'),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('YouTube link copied.')));
  }

  Future<void> _toggleWatched(String youtubeVideoId, bool isWatched) async {
    try {
      if (isWatched) {
        await unmarkWatched(ref, youtubeVideoId);
      } else {
        await markWatched(ref, youtubeVideoId);
      }
      ref
        ..invalidate(watchedVideosProvider)
        ..invalidate(playlistVideosProvider(widget.id));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isWatched ? 'Marked unwatched.' : 'Marked watched.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Watch state failed');
    }
  }

  Future<void> _movePlaylistItem(YouTubeVideo video, int newPosition) async {
    final playlistItemId = video.playlistItemId;
    if (playlistItemId == null || playlistItemId.isEmpty) {
      showErrorSnackBar(
        context,
        error: StateError(
          'This playlist item cannot be moved until the playlist is refreshed from YouTube.',
        ),
        prefix: 'Move unavailable',
      );
      return;
    }

    final confirmed = await confirmYoutubeQuotaRisk(
      context: context,
      ref: ref,
      cost: YoutubeQuotaCost.movePlaylistItem,
      actionLabel: 'Moving this video in the playlist',
    );
    if (!confirmed) return;

    try {
      await moveVideoInYoutubePlaylist(
        ref,
        playlistId: widget.id,
        playlistItemId: playlistItemId,
        videoId: video.youtubeVideoId,
        newPosition: newPosition,
      );
      ref.invalidate(playlistVideosProvider(widget.id));
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Playlist order updated.')));
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(
        context,
        error: e,
        prefix: 'Failed to move playlist item',
      );
    }
  }

  Future<void> _removePlaylistItem(
    YouTubeVideo video, {
    required bool canMutatePlaylistOnYoutube,
  }) async {
    final playlistItemId = video.playlistItemId;
    final canRemoveOnYoutube =
        canMutatePlaylistOnYoutube &&
        playlistItemId != null &&
        playlistItemId.isNotEmpty;

    if (canRemoveOnYoutube) {
      final confirmed = await confirmYoutubeQuotaRisk(
        context: context,
        ref: ref,
        cost: YoutubeQuotaCost.removePlaylistItem,
        actionLabel: 'Removing this video from the playlist',
      );
      if (!confirmed) return;
    }

    try {
      if (canRemoveOnYoutube) {
        await removeVideoFromYoutubePlaylist(
          ref,
          playlistId: widget.id,
          playlistItemId: playlistItemId,
        );
      } else {
        await removeCachedVideoFromPlaylist(
          ref,
          playlistId: widget.id,
          videoCacheId: video.id,
        );
      }
      ref.invalidate(playlistVideosProvider(widget.id));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Video removed from playlist.')),
      );
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Remove failed');
    }
  }

  Future<void> _hideVideo(String youtubeVideoId) async {
    try {
      await hideVideo(ref, youtubeVideoId);
      ref
        ..invalidate(hiddenItemsProvider)
        ..invalidate(playlistVideosProvider(widget.id))
        ..invalidate(videosProvider(const VideosArgs()));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Video hidden from library.')),
      );
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Could not hide video');
    }
  }

  Future<void> _showCopyToPlaylistSheet(YouTubeVideo video) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
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
                            (playlist) =>
                                _canMutatePlaylistOnYoutube(playlist) &&
                                playlist.youtubePlaylistId.isNotEmpty &&
                                playlist.youtubePlaylistId != widget.id,
                          )
                          .toList(growable: false)
                        ..sort(
                          (a, b) => a.title.toLowerCase().compareTo(
                            b.title.toLowerCase(),
                          ),
                        );

                  if (writablePlaylists.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.all(AppSpacing.lg),
                      child: AppEmptyState(
                        icon: Icons.playlist_add,
                        title: 'No other playlists available',
                        description:
                            'Create or sync another playlist before copying videos.',
                      ),
                    );
                  }

                  return ListView(
                    shrinkWrap: true,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.xs,
                          AppSpacing.lg,
                          AppSpacing.sm,
                        ),
                        child: Text(
                          'Copy to another playlist',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      for (final playlist in writablePlaylists)
                        ListTile(
                          leading: const Icon(Icons.playlist_play),
                          title: Text(playlist.title),
                          subtitle: Text('${playlist.videoCount} videos'),
                          onTap: () async {
                            Navigator.of(sheetContext).pop();
                            await _copyVideoToPlaylist(
                              video,
                              playlist.youtubePlaylistId,
                            );
                          },
                        ),
                    ],
                  );
                },
                loading: () => const Padding(
                  padding: EdgeInsets.all(AppSpacing.lg),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (error, stackTrace) => Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
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

  Future<void> _copyVideoToPlaylist(
    YouTubeVideo video,
    String playlistId,
  ) async {
    final confirmed = await confirmYoutubeQuotaRisk(
      context: context,
      ref: ref,
      cost: YoutubeQuotaCost.addPlaylistItem,
      actionLabel: 'Copying this video to another playlist',
    );
    if (!confirmed) return;

    try {
      await addVideoToYoutubePlaylist(
        ref,
        playlistId: playlistId,
        videoId: video.youtubeVideoId,
      );
      ref
        ..invalidate(playlistVideosProvider(widget.id))
        ..invalidate(playlistVideosProvider(playlistId))
        ..invalidate(playlistsProvider)
        ..invalidate(videosProvider(const VideosArgs()));
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Video copied.')));
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Copy failed');
    }
  }

  Future<void> _persistVideoOrder(BuildContext context) async {
    if (_reorderList.isEmpty) {
      setState(() => _isReorderMode = false);
      return;
    }

    final orderedIds = _reorderList
        .map((video) => video.youtubeVideoId)
        .toList(growable: false);
    setState(() {
      _isSavingOrder = true;
    });

    try {
      await reorderPlaylistVideos(
        ref,
        playlistId: widget.id,
        orderedIds: orderedIds,
      );
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Playlist order saved.')));
      }
      setState(() {
        _isReorderMode = false;
      });
      ref.invalidate(playlistVideosProvider(widget.id));
    } catch (e) {
      if (context.mounted) {
        showErrorSnackBar(
          context,
          error: e,
          prefix: 'Failed to save playlist order',
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSavingOrder = false;
        });
      }
    }
  }

  void _openVideo(BuildContext context, String youtubeVideoId) {
    if (youtubeVideoId.isEmpty) {
      showErrorSnackBar(
        context,
        error: 'This video is missing a YouTube identifier.',
        prefix: 'Cannot open video',
      );
      return;
    }

    final sourceQueue = _isReorderMode && _reorderList.isNotEmpty
        ? _reorderList
        : _currentPlaylistQueue;
    final queueItems = sourceQueue
        .map(PlaybackQueueItem.fromVideo)
        .where((item) => item.youtubeVideoId.isNotEmpty)
        .toList(growable: false);
    final queueIds = queueItems
        .map((item) => item.youtubeVideoId)
        .toList(growable: false);
    if (queueIds.contains(youtubeVideoId)) {
      final playlistTitle = sourceQueue
          .map((video) => video.playlistTitle)
          .firstWhere(
            (title) => title != null && title.trim().isNotEmpty,
            orElse: () => null,
          );
      ref
          .read(playbackSessionProvider.notifier)
          .start(
            sourceType: PlaybackSourceType.playlist,
            sourceId: widget.id,
            sourceTitle: playlistTitle ?? 'Playlist',
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

  Future<void> _copyPlaylistLink(BuildContext context) async {
    await Clipboard.setData(
      ClipboardData(text: Routes.playlistDetail(widget.id)),
    );
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Playlist link copied.')));
  }

  Future<void> _showEditPlaylistDialog(
    BuildContext context,
    YouTubePlaylist playlist,
  ) async {
    final titleController = TextEditingController(text: playlist.title);
    final descriptionController = TextEditingController(
      text: playlist.description ?? '',
    );
    Color selectedColor = playlist.color != null
        ? parseHexColor(playlist.color!)
        : Theme.of(context).colorScheme.primary;
    var saving = false;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Edit playlist'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      controller: titleController,
                      autofocus: true,
                      decoration: const InputDecoration(
                        labelText: 'Name',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: descriptionController,
                      decoration: const InputDecoration(
                        labelText: 'Description',
                        border: OutlineInputBorder(),
                      ),
                      minLines: 2,
                      maxLines: 4,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Color',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: [
                        for (final color in _colorOptions)
                          _ColorSwatch(
                            color: color,
                            selected:
                                color.toARGB32() == selectedColor.toARGB32(),
                            onTap: saving
                                ? null
                                : () => setDialogState(() {
                                    selectedColor = color;
                                  }),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: saving
                      ? null
                      : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton.icon(
                  onPressed: saving
                      ? null
                      : () async {
                          final title = titleController.text.trim();
                          if (title.isEmpty) return;
                          setDialogState(() => saving = true);
                          try {
                            await updateYoutubePlaylistDetails(
                              ref,
                              playlistId: playlist.youtubePlaylistId,
                              title: title,
                              description:
                                  descriptionController.text.trim().isEmpty
                                  ? null
                                  : descriptionController.text.trim(),
                              color: _colorToHex(selectedColor),
                            );
                            if (!dialogContext.mounted) return;
                            Navigator.of(dialogContext).pop();
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Playlist updated.'),
                              ),
                            );
                          } catch (e) {
                            if (dialogContext.mounted) {
                              showErrorSnackBar(
                                dialogContext,
                                error: e,
                                prefix: 'Update failed',
                              );
                            }
                            setDialogState(() => saving = false);
                          }
                        },
                  icon: saving
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: AppSpacing.xxxs,
                          ),
                        )
                      : const Icon(Icons.check),
                  label: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );

    titleController.dispose();
    descriptionController.dispose();
  }

  static const _colorOptions = [
    Colors.purple,
    Colors.blue,
    Colors.teal,
    Colors.green,
    Colors.orange,
    Colors.red,
    Colors.pink,
    Colors.indigo,
  ];

  String _colorToHex(Color color) {
    return '#${color.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}';
  }

  Widget _buildReorderableList() {
    return SliverToBoxAdapter(
      child: ReorderableListView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: _reorderList.length,
        onReorder: (oldIndex, newIndex) {
          setState(() {
            if (newIndex > oldIndex) newIndex--;
            final item = _reorderList.removeAt(oldIndex);
            _reorderList.insert(newIndex, item);
          });
        },
        itemBuilder: (context, index) {
          final video = _reorderList[index];
          final durationSec = parseDuration(video.duration);
          return ListTile(
            key: ValueKey(video.id),
            leading: const Icon(Icons.drag_handle),
            title: Text(
              video.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              durationSec != null ? formatDuration(durationSec) : '',
            ),
          );
        },
      ),
    );
  }
}

class _ColorSwatch extends StatelessWidget {
  const _ColorSwatch({
    required this.color,
    required this.selected,
    required this.onTap,
  });

  final Color color;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Container(
        width: AppSizes.iconLarge,
        height: AppSizes.iconLarge,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: selected
              ? Border.all(
                  color: Theme.of(context).colorScheme.onSurface,
                  width: AppSpacing.xxxs,
                )
              : null,
        ),
        child: selected
            ? const Icon(
                Icons.check,
                size: AppSpacing.md2,
                color: AppColors.primaryForeground,
              )
            : null,
      ),
    );
  }
}

class _VideoActionMenuItem extends StatelessWidget {
  const _VideoActionMenuItem({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(label),
    );
  }
}
