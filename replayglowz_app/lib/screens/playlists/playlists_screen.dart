import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/i18n/translations.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/providers/mutations.dart';
import 'package:replayglowz_app/providers/providers.dart';
import 'package:replayglowz_app/utils/color_utils.dart';
import 'package:replayglowz_app/widgets/app_states.dart';
import 'package:replayglowz_app/widgets/common_app_bar_actions.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';
import 'package:replayglowz_app/widgets/media/playlist_card.dart';
import 'package:replayglowz_app/widgets/ui_hint_card.dart';
import 'package:replayglowz_app/widgets/youtube_channel_onboarding.dart';
import 'package:replayglowz_app/widgets/youtube_connect.dart';

/// Playlists overview screen showing all user playlists.
///
/// Convex queries/mutations used:
/// - `playlists.getPlaylists` — fetch all playlists for the current user
/// - `playlistOrder.getOrder` — fetch custom sort order
/// - `playlistOrder.updateOrder` — persist reorder changes
class PlaylistsScreen extends ConsumerStatefulWidget {
  const PlaylistsScreen({super.key});

  @override
  ConsumerState<PlaylistsScreen> createState() => _PlaylistsScreenState();
}

class _PlaylistsScreenState extends ConsumerState<PlaylistsScreen> {
  static const _prefsScroll = 'playlists.pref.scroll';
  final _scrollController = ScrollController();
  Timer? _fadeTimer;
  double _fabOpacity = 0.0;
  bool _restoredScroll = false;
  static const _fabIdleOpacity = 0.24;
  static const _fabActiveOpacity = 0.78;
  static const _fabScrollRevealDelay = Duration(milliseconds: 850);
  static const _fabScrollThreshold = 12.0;

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

  @override
  void dispose() {
    _fadeTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  AppLocale _locale(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'fr'
      ? AppLocale.fr
      : AppLocale.en;

  Future<void> _persistScroll() async {
    if (!_scrollController.hasClients) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_prefsScroll, _scrollController.offset);
  }

  Future<void> _restoreScroll() async {
    if (_restoredScroll || !_scrollController.hasClients) return;
    final prefs = await SharedPreferences.getInstance();
    final offset = prefs.getDouble(_prefsScroll) ?? 0;
    _scrollController.jumpTo(offset.clamp(0, 200000));
    if (!mounted) return;
    _setFabToRestingState(currentOffset: offset);
    _restoredScroll = true;
  }

  bool _isScrollRangeAvailable() {
    return _scrollController.hasClients &&
        _scrollController.position.maxScrollExtent > 0;
  }

  double _computeFabRestingOpacity(double currentOffset) {
    if (_isScrollRangeAvailable()) {
      return currentOffset > _fabScrollThreshold ? _fabIdleOpacity : 0.0;
    }

    return _fabIdleOpacity;
  }

  void _setFabToRestingState({double currentOffset = 0}) {
    final effectiveOffset = _scrollController.hasClients
        ? _scrollController.offset
        : currentOffset;
    final restingOpacity = _computeFabRestingOpacity(effectiveOffset);
    if (_fabOpacity != restingOpacity && mounted) {
      setState(() => _fabOpacity = restingOpacity);
    }
  }

  void _showFabForScroll({double currentOffset = 0}) {
    _fadeTimer?.cancel();
    if (_fabOpacity < _fabActiveOpacity) {
      setState(() => _fabOpacity = _fabActiveOpacity);
    }
    _fadeTimer = Timer(_fabScrollRevealDelay, () {
      if (!mounted) return;
      final effectiveOffset = _scrollController.hasClients
          ? _scrollController.offset
          : currentOffset;
      setState(() => _fabOpacity = _computeFabRestingOpacity(effectiveOffset));
    });
  }

  String _playlistSource(YouTubePlaylist playlist) {
    return playlist.source ?? 'owned';
  }

  String _playlistsHintMessage(List<YouTubePlaylist> playlists, AppLocale l) {
    final hasImported = playlists.any(
      (playlist) => _playlistSource(playlist) == 'url_import',
    );
    final hasOwned = playlists.any(
      (playlist) => _playlistSource(playlist) == 'owned',
    );
    if (hasImported && !hasOwned) {
      return t('p3.playlists.hintMessageImported', locale: l);
    }
    if (hasOwned) {
      return t('p3.playlists.hintMessageOwned', locale: l);
    }
    return t('p3.playlists.hintMessage', locale: l);
  }

  @override
  Widget build(BuildContext context) {
    final l = _locale(context);
    final youtubeConnectionAsync = ref.watch(youtubeConnectionProvider);
    final youtubeConnected =
        youtubeConnectionAsync.asData?.value?['connected'] == true;
    final playlistsAsync = youtubeConnected
        ? ref.watch(playlistsProvider)
        : null;

    return Scaffold(
      appBar: AppBar(
        title: Text(t('playlistsPage.title', locale: l)),
        actions: [
          IconButton(
            icon: const Icon(Icons.sort),
            onPressed: () {
              // TODO: show sort options (alphabetical, date, custom)
            },
          ),
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: () async {
              if (!youtubeConnected) {
                await startYoutubeConnectFlow(
                  context,
                  returnTo: Routes.playlists,
                );
                return;
              }

              try {
                await syncAllPlaylists(ref);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Sync complete. If this YouTube account is new, create a YouTube playlist or channel, then refresh again.',
                      ),
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  showErrorSnackBar(context, error: e, prefix: 'Sync failed');
                }
              }
            },
          ),
          ...commonAppBarActions(context, ref),
        ],
      ),
      body: youtubeConnectionAsync.when(
        data: (status) {
          if (status?['connected'] != true) {
            return const YoutubeConnectRequiredState(
              title: 'Connect YouTube to import playlists',
              description:
                  'Playlists, channel imports, and automatic refresh all depend on your YouTube connection.',
              returnTo: Routes.playlists,
            );
          }

          return playlistsAsync!.when(
            data: (playlists) {
              if (playlists.isEmpty) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  _setFabToRestingState();
                });
                return ListView(
                  padding: const EdgeInsets.only(bottom: 96),
                  children: [
                    YouTubeChannelOnboardingCard(
                      onImported: () => ref.invalidate(playlistsProvider),
                    ),
                    SizedBox(
                      height: 360,
                      child: YoutubeAwareEmptyState(
                        fallbackIcon: Icons.playlist_play,
                        fallbackTitle: 'No YouTube playlists yet',
                        fallbackDescription:
                            'ReplayGlowz is connected, but this YouTube account has no playlists to import yet. New Google accounts may need a YouTube channel before YouTube returns library data.',
                        onRefresh: () => syncAllPlaylists(ref),
                      ),
                    ),
                  ],
                );
              }
              WidgetsBinding.instance.addPostFrameCallback((_) {
                _restoreScroll();
              });
              return Column(
                children: [
                  UiHintCard(
                    hintId: 'playlists-onboarding',
                    icon: Icons.playlist_add_check_circle_outlined,
                    title: t('p3.playlists.hintTitle', locale: l),
                    message: _playlistsHintMessage(playlists, l),
                  ),
                  Expanded(
                    child: NotificationListener<ScrollNotification>(
                      onNotification: (notification) {
                        if (notification.metrics.axis == Axis.vertical) {
                          _showFabForScroll(
                            currentOffset: notification.metrics.pixels,
                          );
                        }
                        return false;
                      },
                      child: ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                        itemCount: playlists.length,
                        itemBuilder: (context, index) {
                          return _buildPlaylistCard(
                            context,
                            ref,
                            playlists[index],
                          );
                        },
                      ),
                    ),
                  ),
                ],
              );
            },
            loading: () => AppLoadingListSkeleton(
              itemCount: 4,
              itemBuilder: (context, index) => Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Container(
                      width: 120,
                      height: 90,
                      color: Theme.of(context).colorScheme.surface,
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              height: 14,
                              width: 100,
                              color: Theme.of(context).colorScheme.surface,
                            ),
                            const SizedBox(height: 8),
                            Container(
                              height: 10,
                              width: 60,
                              color: Theme.of(context).colorScheme.surface,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            error: (error, stack) => ErrorStateView(
              error: error,
              prefix: 'Failed to load playlists',
              onRetry: () => ref.invalidate(playlistsProvider),
            ),
          );
        },
        loading: () => const YoutubeConnectionLoadingState(
          title: 'Checking your YouTube playlists',
          description:
              'ReplayGlowz is confirming your YouTube connection before loading playlist data.',
        ),
        error: (error, stack) => ErrorStateView(
          error: error,
          prefix: 'Failed to check YouTube connection',
          onRetry: () => ref.invalidate(youtubeConnectionProvider),
        ),
      ),
      floatingActionButton: IgnorePointer(
        ignoring: !youtubeConnected || _fabOpacity == 0.0,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 180),
          opacity: youtubeConnected ? _fabOpacity : 0.0,
          child: FloatingActionButton.small(
            onPressed: youtubeConnected
                ? () {
                    _showFabForScroll(
                      currentOffset: _scrollController.hasClients
                          ? _scrollController.offset
                          : 0,
                    );
                    _showCreatePlaylistDialog(context, ref, l);
                  }
                : null,
            tooltip: t('playlistCreate.title', locale: l),
            child: const Icon(Icons.add),
          ),
        ),
      ),
    );
  }

  Widget _buildPlaylistCard(
    BuildContext context,
    WidgetRef ref,
    YouTubePlaylist playlist,
  ) {
    final canMutateOnYoutube =
        playlist.source == null || playlist.source == 'owned';
    return PlaylistCard(
      playlist: playlist,
      onTap: () {
        _persistScroll();
        context.go(Routes.playlistDetail(playlist.youtubePlaylistId));
      },
      trailing: PopupMenuButton<String>(
        onSelected: (value) async {
          switch (value) {
            case 'edit':
              await _showEditPlaylistDialog(context, ref, playlist);
              break;
            case 'hide':
              try {
                await hidePlaylist(ref, playlist.youtubePlaylistId);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Playlist hidden.')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  showErrorSnackBar(context, error: e, prefix: 'Error');
                }
              }
              break;
            case 'delete':
              await _confirmDeletePlaylist(context, ref, playlist);
              break;
          }
        },
        itemBuilder: (context) => [
          if (canMutateOnYoutube)
            const PopupMenuItem(value: 'edit', child: Text('Edit')),
          const PopupMenuItem(value: 'hide', child: Text('Hide')),
          if (canMutateOnYoutube)
            const PopupMenuItem(value: 'delete', child: Text('Delete')),
        ],
      ),
    );
  }

  Future<void> _showEditPlaylistDialog(
    BuildContext context,
    WidgetRef ref,
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
                    const SizedBox(height: 12),
                    TextField(
                      controller: descriptionController,
                      decoration: const InputDecoration(
                        labelText: 'Description',
                        border: OutlineInputBorder(),
                      ),
                      minLines: 2,
                      maxLines: 4,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Color',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
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
                          child: CircularProgressIndicator(strokeWidth: 2),
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

  Future<void> _showCreatePlaylistDialog(
    BuildContext context,
    WidgetRef ref,
    AppLocale l,
  ) async {
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController();
    final descriptionController = TextEditingController();
    var isPublic = true;
    var selectedColor = Theme.of(context).colorScheme.primary;
    var saving = false;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(t('playlistCreate.title', locale: l)),
              content: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextFormField(
                        controller: nameController,
                        autofocus: true,
                        decoration: InputDecoration(
                          labelText: t('playlistCreate.titleLabel', locale: l),
                          border: const OutlineInputBorder(),
                        ),
                        validator: (value) {
                          final name = value?.trim() ?? '';
                          if (name.isEmpty) {
                            return t('playlistCreate.nameRequired', locale: l);
                          }
                          if (name.length < 2) {
                            return t('playlistCreate.nameTooShort', locale: l);
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: descriptionController,
                        minLines: 2,
                        maxLines: 4,
                        decoration: InputDecoration(
                          labelText: t(
                            'playlistCreate.descriptionLabel',
                            locale: l,
                          ),
                          border: const OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        title: Text(t('playlistCreate.makePublic', locale: l)),
                        subtitle: Text(
                          isPublic
                              ? t('playlistCreate.publicDescription', locale: l)
                              : t(
                                  'playlistCreate.privateDescription',
                                  locale: l,
                                ),
                        ),
                        value: isPublic,
                        onChanged: saving
                            ? null
                            : (value) => setDialogState(() => isPublic = value),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        t('playlistCreate.colorLabel', locale: l),
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
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
              ),
              actions: [
                TextButton(
                  onPressed: saving
                      ? null
                      : () => Navigator.of(dialogContext).pop(),
                  child: Text(t('common.cancel', locale: l)),
                ),
                FilledButton.icon(
                  onPressed: saving
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          setDialogState(() => saving = true);
                          try {
                            await createPlaylist(
                              ref,
                              title: nameController.text.trim(),
                              description:
                                  descriptionController.text.trim().isEmpty
                                  ? null
                                  : descriptionController.text.trim(),
                              privacyStatus: isPublic ? 'public' : 'private',
                              color: _colorToHex(selectedColor),
                            );
                            if (!dialogContext.mounted) return;
                            Navigator.of(dialogContext).pop();
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  t('playlistCreate.created', locale: l),
                                ),
                              ),
                            );
                          } catch (e) {
                            if (dialogContext.mounted) {
                              showErrorSnackBar(
                                dialogContext,
                                error: e,
                                prefix: t(
                                  'playlistCreate.createError',
                                  locale: l,
                                ),
                              );
                            }
                            setDialogState(() => saving = false);
                          }
                        },
                  icon: saving
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check),
                  label: Text(t('playlistCreate.create', locale: l)),
                ),
              ],
            );
          },
        );
      },
    );

    nameController.dispose();
    descriptionController.dispose();
  }

  Future<void> _confirmDeletePlaylist(
    BuildContext context,
    WidgetRef ref,
    YouTubePlaylist playlist,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete playlist?'),
        content: Text(
          'This deletes "${playlist.title}" from YouTube and refreshes ReplayGlowz.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await deleteYoutubePlaylist(ref, playlist.youtubePlaylistId);
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Playlist deleted.')));
    } catch (e) {
      if (context.mounted) {
        showErrorSnackBar(context, error: e, prefix: 'Delete failed');
      }
    }
  }

  String _colorToHex(Color color) {
    return '#${color.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}';
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
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: selected
              ? Border.all(
                  color: Theme.of(context).colorScheme.onSurface,
                  width: 3,
                )
              : null,
        ),
        child: selected
            ? const Icon(Icons.check, size: 18, color: Colors.white)
            : null,
      ),
    );
  }
}
