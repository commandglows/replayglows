import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/providers/mutations.dart';
import 'package:replayglowz_app/providers/providers.dart';
import 'package:replayglowz_app/utils/duration_utils.dart';
import 'package:replayglowz_app/widgets/app_states.dart';
import 'package:replayglowz_app/widgets/common_app_bar_actions.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';
import 'package:replayglowz_app/widgets/media/video_card.dart';
import 'package:replayglowz_app/widgets/media/video_list_tile.dart';
import 'package:replayglowz_app/widgets/youtube_quota_guard.dart';
import 'package:replayglowz_app/widgets/youtube_connect.dart';

/// Video feed screen with multiple view modes.
///
/// Convex queries/mutations used:
/// - `youtube.getAllVideos` — fetch all cached videos across playlists
/// - `notes.getNotes` — fetch notes count per video for badge display
/// - `settings.getSettings` — load user preferences (default view mode, etc.)
class VideosScreen extends ConsumerStatefulWidget {
  const VideosScreen({super.key});

  @override
  ConsumerState<VideosScreen> createState() => _VideosScreenState();
}

class _VideosScreenState extends ConsumerState<VideosScreen>
    with SingleTickerProviderStateMixin {
  static const _compactViewBreakpoint = 640.0;
  late final TabController _tabController;
  String _sortOrder = 'desc';
  bool _includeWatched = true;
  String? _playlistFilterId;

  VideosArgs get _videosArgs =>
      VideosArgs(sortOrder: _sortOrder, includeWatched: _includeWatched);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(_handleTabChanged);
  }

  @override
  void dispose() {
    _tabController.removeListener(_handleTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _handleTabChanged() {
    if (mounted) {
      setState(() {});
    }
  }

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
    final notesAsync = youtubeConnected && isNotesView
        ? ref.watch(notesProvider)
        : null;
    final watchedAsync = youtubeConnected
        ? ref.watch(watchedVideosProvider)
        : const AsyncValue<List<WatchedVideo>>.data(<WatchedVideo>[]);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Videos'),
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
            onPressed: () {
              setState(() => _includeWatched = !_includeWatched);
            },
          ),
          PopupMenuButton<String>(
            tooltip: 'Sort videos',
            icon: const Icon(Icons.sort),
            onSelected: (value) {
              setState(() => _sortOrder = value);
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
              _playlistFilterId == null
                  ? Icons.filter_list
                  : Icons.filter_list_alt,
            ),
            tooltip: 'Filter by playlist',
            onPressed: videosAsync == null
                ? null
                : () => _showPlaylistFilterSheet(
                    context,
                    videosAsync.asData?.value ?? const [],
                  ),
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
            return const YoutubeConnectRequiredState(
              title: 'Connect YouTube to browse videos',
              description:
                  'ReplayGlowz builds your video library from your synced YouTube playlists. Connect YouTube first, then your videos will appear here.',
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

              final visibleVideos = _applyLocalFilters(videos);
              final watchedIds =
                  watchedAsync.asData?.value
                      .map((item) => item.youtubeVideoId)
                      .toSet() ??
                  const <String>{};

              if (videos.isEmpty) {
                return YoutubeAwareEmptyState(
                  fallbackIcon: Icons.video_library_outlined,
                  fallbackTitle: 'No YouTube videos yet',
                  fallbackDescription:
                      'ReplayGlowz is connected, but this YouTube account does not have imported videos yet. New Google accounts may need a YouTube channel or playlists before anything can sync.',
                  onRefresh: _refreshVideos,
                );
              }

              if (visibleVideos.isEmpty) {
                return AppEmptyState(
                  icon: Icons.filter_list_off,
                  title: 'No videos match these filters',
                  description:
                      'Clear the playlist filter or show watched videos to see more results.',
                  action: FilledButton.tonalIcon(
                    onPressed: () {
                      setState(() {
                        _playlistFilterId = null;
                        _includeWatched = true;
                      });
                    },
                    icon: const Icon(Icons.clear),
                    label: const Text('Clear filters'),
                  ),
                );
              }

              return TabBarView(
                controller: _tabController,
                children: [
                  _buildCardView(visibleVideos, watchedIds),
                  _buildListView(visibleVideos, watchedIds),
                  _buildSummaryView(visibleVideos, notesByVideo),
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
      floatingActionButton: youtubeConnected
          ? FloatingActionButton(
              onPressed: _refreshVideos,
              tooltip:
                  'Refresh videos (${youtubeQuotaCostLabel(YoutubeQuotaCost.syncAllPlaylists)})',
              child: const Icon(Icons.refresh),
            )
          : null,
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

  List<YouTubeVideo> _applyLocalFilters(List<YouTubeVideo> videos) {
    final playlistFilterId = _playlistFilterId;
    if (playlistFilterId == null) {
      return videos;
    }
    return videos
        .where((video) => video.playlistId == playlistFilterId)
        .toList(growable: false);
  }

  Widget _buildCardView(List<YouTubeVideo> videos, Set<String> watchedIds) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: videos.length,
      itemBuilder: (context, index) {
        final video = videos[index];
        return VideoCard(
          video: video,
          trailing: _buildVideoActionMenu(video, watchedIds),
          onTap: () => _openVideo(context, video.youtubeVideoId),
        );
      },
    );
  }

  Widget _buildListView(List<YouTubeVideo> videos, Set<String> watchedIds) {
    return ListView.builder(
      itemCount: videos.length,
      itemBuilder: (context, index) {
        final video = videos[index];
        return VideoListTile(
          video: video,
          trailing: _buildVideoActionMenu(video, watchedIds),
          onTap: () => _openVideo(context, video.youtubeVideoId),
        );
      },
    );
  }

  Widget _buildSummaryView(
    List<YouTubeVideo> videos,
    Map<String, int> notesByVideo,
  ) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: videos.length,
      itemBuilder: (context, index) {
        final video = videos[index];
        final noteCount = notesByVideo[video.youtubeVideoId] ?? 0;
        final durationSec = parseDuration(video.duration);

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: InkWell(
            onTap: () {
              _openVideo(context, video.youtubeVideoId);
            },
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    video.title,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    video.description ??
                        'No description available for this video.',
                    style: Theme.of(context).textTheme.bodySmall,
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
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      const SizedBox(width: 16),
                      if (durationSec != null) ...[
                        const Icon(Icons.schedule, size: 16),
                        const SizedBox(width: 4),
                        Text(
                          formatDuration(durationSec),
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _openVideo(BuildContext context, String youtubeVideoId) {
    if (youtubeVideoId.isEmpty) {
      showErrorSnackBar(
        context,
        error: 'This video is missing an identifier.',
        prefix: 'Cannot open video',
      );
      return;
    }

    context.go(
      Uri(
        path: Routes.play,
        queryParameters: {'videoId': youtubeVideoId},
      ).toString(),
    );
  }

  Widget _buildVideoActionMenu(YouTubeVideo video, Set<String> watchedIds) {
    final isWatched = watchedIds.contains(video.youtubeVideoId);
    return PopupMenuButton<String>(
      tooltip: 'Video actions',
      onSelected: (value) => _handleVideoAction(value, video, isWatched),
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
  ) async {
    switch (action) {
      case 'play':
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

  Future<void> _showPlaylistFilterSheet(
    BuildContext context,
    List<YouTubeVideo> videos,
  ) async {
    final playlists = <String, String>{};
    for (final video in videos) {
      if (video.playlistId.isEmpty) continue;
      playlists[video.playlistId] = video.playlistTitle ?? 'Untitled playlist';
    }
    final entries = playlists.entries.toList()
      ..sort((a, b) => a.value.toLowerCase().compareTo(b.value.toLowerCase()));

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              ListTile(
                leading: const Icon(Icons.video_library_outlined),
                title: const Text('All playlists'),
                trailing: _playlistFilterId == null
                    ? const Icon(Icons.check)
                    : null,
                onTap: () {
                  setState(() => _playlistFilterId = null);
                  Navigator.of(sheetContext).pop();
                },
              ),
              for (final entry in entries)
                ListTile(
                  leading: const Icon(Icons.playlist_play),
                  title: Text(entry.value),
                  trailing: _playlistFilterId == entry.key
                      ? const Icon(Icons.check)
                      : null,
                  onTap: () {
                    setState(() => _playlistFilterId = entry.key);
                    Navigator.of(sheetContext).pop();
                  },
                ),
            ],
          ),
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
