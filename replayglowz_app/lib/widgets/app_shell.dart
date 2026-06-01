import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/auth/auth_service.dart';
import 'package:replayglowz_app/auth/auth_state.dart';
import 'package:replayglowz_app/providers/providers.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';
import 'package:replayglowz_app/widgets/youtube_connect.dart';

/// Responsive app shell with bottom navigation (mobile) or side rail
/// (tablet / web).
///
/// Used as the builder for the [ShellRoute] in [router.dart]. The [child]
/// parameter is the currently active route widget injected by GoRouter.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({
    super.key,
    required this.shellState,
    required this.navigationShell,
  });

  /// The stateful routed page content.
  final StatefulNavigationShell navigationShell;
  final GoRouterState shellState;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  static const _bottomNavIconSize = 28.0;
  static const _temporaryPlaybackControlsDuration = Duration(seconds: 5);
  Timer? _temporaryPlaybackControlsTimer;
  bool _persistentPlaybackControls = false;
  bool _temporaryPlaybackControls = false;
  bool _videoActionControlsVisible = false;

  StatefulNavigationShell get navigationShell => widget.navigationShell;
  GoRouterState get shellState => widget.shellState;

  @override
  void dispose() {
    _temporaryPlaybackControlsTimer?.cancel();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Navigation destinations
  // ---------------------------------------------------------------------------

  static const _destinations = <_NavDestination>[
    _NavDestination(
      label: 'Feed',
      icon: Icons.dynamic_feed_outlined,
      selectedIcon: Icons.dynamic_feed,
      path: Routes.videos,
    ),
    _NavDestination(
      label: 'Play',
      icon: Icons.play_circle_outline,
      selectedIcon: Icons.play_circle,
      path: Routes.play,
    ),
    _NavDestination(
      label: 'Lists',
      icon: Icons.queue_music_outlined,
      selectedIcon: Icons.queue_music,
      path: Routes.playlists,
    ),
    _NavDestination(
      label: 'Notes',
      icon: Icons.sticky_note_2_outlined,
      selectedIcon: Icons.sticky_note_2,
      path: Routes.notes,
    ),
  ];

  /// Returns the index of the currently selected destination based on the
  /// active route location, or 0 if no match is found.
  bool _showYoutubeStatusChrome(String location) {
    return location.startsWith(Routes.videos) ||
        location.startsWith(Routes.play) ||
        location.startsWith(Routes.playlists) ||
        location.startsWith(Routes.notes);
  }

  void _onDestinationSelected(BuildContext context, WidgetRef ref, int index) {
    final destination = _destinations[index];
    final playbackController = ref.read(appPlaybackControllerProvider);
    if (destination.path == Routes.play &&
        navigationShell.currentIndex == index &&
        playbackController.hasActiveVideo) {
      _showTemporaryPlaybackControls();
      return;
    }

    if (index == navigationShell.currentIndex) {
      return;
    }

    if (destination.path == Routes.play) {
      final activeVideoId = ref.read(activePlayVideoIdProvider);
      if (activeVideoId != null && activeVideoId.isNotEmpty) {
        _showTemporaryPlaybackControls();
        context.go(
          Uri(
            path: Routes.play,
            queryParameters: {'videoId': activeVideoId},
          ).toString(),
        );
        return;
      }
    }

    navigationShell.goBranch(index);
  }

  void _showTemporaryPlaybackControls() {
    _temporaryPlaybackControlsTimer?.cancel();
    if (!mounted) return;
    setState(() => _temporaryPlaybackControls = true);
    _temporaryPlaybackControlsTimer = Timer(
      _temporaryPlaybackControlsDuration,
      () {
        if (!mounted || _persistentPlaybackControls) return;
        setState(() => _temporaryPlaybackControls = false);
      },
    );
  }

  void _togglePersistentPlaybackControls() {
    _temporaryPlaybackControlsTimer?.cancel();
    setState(() {
      _persistentPlaybackControls = !_persistentPlaybackControls;
      _temporaryPlaybackControls = false;
    });
  }

  void _handlePlaybackControl(VoidCallback action) {
    action();
    if (!_persistentPlaybackControls) {
      _showTemporaryPlaybackControls();
    }
  }

  void _showVideoActionControls() {
    if (!mounted || _videoActionControlsVisible) return;
    setState(() => _videoActionControlsVisible = true);
  }

  void _hideVideoActionControls() {
    if (!mounted || !_videoActionControlsVisible) return;
    setState(() => _videoActionControlsVisible = false);
  }

  void _handleVideoActionControl(VoidCallback action, {bool close = false}) {
    action();
    if (close) {
      _hideVideoActionControls();
    }
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  /// Breakpoint above which the side [NavigationRail] is used instead of the
  /// bottom [NavigationBar]. 600dp matches the Material 3 compact/medium
  /// breakpoint.
  static const _railBreakpoint = 600.0;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final location = shellState.uri.path;
    final selected = navigationShell.currentIndex.clamp(
      0,
      _destinations.length - 1,
    );
    final authState = ref.watch(authStateProvider);
    final accessAsync = ref.watch(productAccessStatusProvider);
    final shouldGate =
        authState is AuthAuthenticated &&
        accessAsync.maybeWhen(
          data: (status) => !status.loading && !status.hasAccess,
          orElse: () => false,
        );
    final routedChild = shouldGate
        ? _ProductAccessInactiveView(statusAsync: accessAsync)
        : navigationShell;

    if (width >= _railBreakpoint) {
      return _buildWithRail(context, ref, selected, routedChild, location);
    }
    return _buildWithBottomNav(context, ref, selected, routedChild, location);
  }

  // ---------------------------------------------------------------------------
  // Bottom navigation (mobile)
  // ---------------------------------------------------------------------------

  Widget _buildWithBottomNav(
    BuildContext context,
    WidgetRef ref,
    int selected,
    Widget routedChild,
    String location,
  ) {
    final showYoutubeStatusChrome = _showYoutubeStatusChrome(location);
    final playbackController = ref.watch(appPlaybackControllerProvider);
    final showPlaybackControls =
        location.startsWith(Routes.play) &&
        playbackController.hasActiveVideo &&
        (_persistentPlaybackControls || _temporaryPlaybackControls);
    final showVideoActionControls =
        location.startsWith(Routes.play) &&
        playbackController.hasActiveVideo &&
        _videoActionControlsVisible;
    final primaryBottomBar = showPlaybackControls
        ? _buildPlaybackBottomBar(context, ref, playbackController)
        : NavigationBar(
            selectedIndex: selected,
            onDestinationSelected: (i) =>
                _onDestinationSelected(context, ref, i),
            destinations: [
              for (final dest in _destinations)
                NavigationDestination(
                  icon: _buildBottomNavIcon(
                    context,
                    ref,
                    dest,
                    selected: false,
                    playbackController: playbackController,
                  ),
                  selectedIcon: _buildBottomNavIcon(
                    context,
                    ref,
                    dest,
                    selected: true,
                    playbackController: playbackController,
                  ),
                  label: dest.label,
                ),
            ],
          );

    return Scaffold(
      body: Column(
        children: [
          if (showYoutubeStatusChrome) const YoutubeConnectBanner(),
          if (showYoutubeStatusChrome) const _YoutubeQuotaSyncStrip(),
          const YoutubeOAuthFeedbackBanner(),
          Expanded(child: routedChild),
        ],
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            reverseDuration: const Duration(milliseconds: 160),
            transitionBuilder: (child, animation) {
              return SizeTransition(
                sizeFactor: animation,
                axisAlignment: 1,
                child: SlideTransition(
                  position:
                      Tween<Offset>(
                        begin: const Offset(0, 0.45),
                        end: Offset.zero,
                      ).animate(
                        CurvedAnimation(
                          parent: animation,
                          curve: Curves.easeOutCubic,
                        ),
                      ),
                  child: child,
                ),
              );
            },
            child: showVideoActionControls
                ? _buildVideoActionBottomBar(context, ref, playbackController)
                : const SizedBox.shrink(),
          ),
          primaryBottomBar,
        ],
      ),
    );
  }

  Widget _buildVideoActionBottomBar(
    BuildContext context,
    WidgetRef ref,
    AppPlaybackControllerState playbackController,
  ) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final rate = playbackController.playbackRate;
    return GestureDetector(
      key: const ValueKey('video-action-bottom-bar'),
      behavior: HitTestBehavior.opaque,
      onVerticalDragEnd: (details) {
        final velocity = details.primaryVelocity ?? 0;
        if (velocity > 220) {
          _hideVideoActionControls();
        }
      },
      child: Container(
        height: 72,
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainerHighest,
          border: Border(top: BorderSide(color: colorScheme.outlineVariant)),
        ),
        child: Row(
          children: [
            _PlaybackBarButton(
              icon: Icons.visibility_off_outlined,
              label: 'Hide',
              onPressed: () => _handleVideoActionControl(
                ref
                    .read(appPlaybackControllerProvider.notifier)
                    .requestHideCurrentVideo,
                close: true,
              ),
            ),
            _PlaybackBarButton(
              icon: Icons.done_all_rounded,
              label: 'Watched',
              onPressed: () => _handleVideoActionControl(
                ref
                    .read(appPlaybackControllerProvider.notifier)
                    .requestMarkCurrentVideoWatched,
                close: true,
              ),
            ),
            _PlaybackBarButton(
              icon: Icons.remove_rounded,
              label: 'Slower',
              onPressed: () => _handleVideoActionControl(
                ref
                    .read(appPlaybackControllerProvider.notifier)
                    .requestSpeedDown,
              ),
            ),
            _PlaybackBarButton(
              icon: Icons.add_rounded,
              label: rate == rate.truncateToDouble()
                  ? '${rate.toInt()}x'
                  : '${rate.toStringAsFixed(2)}x',
              selected: rate != 1,
              onPressed: () => _handleVideoActionControl(
                ref.read(appPlaybackControllerProvider.notifier).requestSpeedUp,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaybackBottomBar(
    BuildContext context,
    WidgetRef ref,
    AppPlaybackControllerState playbackController,
  ) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return SafeArea(
      top: false,
      child: Container(
        height: 80,
        decoration: BoxDecoration(
          color: colorScheme.surface,
          border: Border(top: BorderSide(color: colorScheme.outlineVariant)),
        ),
        child: Row(
          children: [
            _PlaybackBarButton(
              icon: Icons.skip_previous_rounded,
              label: 'Previous',
              onPressed: () => _handlePlaybackControl(
                ref
                    .read(appPlaybackControllerProvider.notifier)
                    .requestPrevious,
              ),
              onLongPressStart: (_) => ref
                  .read(appPlaybackControllerProvider.notifier)
                  .showPreviousPreview(),
              onLongPressEnd: (_) => ref
                  .read(appPlaybackControllerProvider.notifier)
                  .hidePreview(),
              onLongPressCancel: () => ref
                  .read(appPlaybackControllerProvider.notifier)
                  .hidePreview(),
            ),
            _PlaybackBarButton(
              icon: playbackController.isPlaying
                  ? Icons.pause_circle_filled_rounded
                  : Icons.play_circle_filled_rounded,
              label: playbackController.isPlaying ? 'Pause' : 'Play',
              selected: true,
              onPressed: () => _handlePlaybackControl(
                ref.read(appPlaybackControllerProvider.notifier).requestToggle,
              ),
              onLongPress: _togglePersistentPlaybackControls,
              onSwipeUp: _showVideoActionControls,
            ),
            _PlaybackBarButton(
              icon: Icons.skip_next_rounded,
              label: 'Next',
              onPressed: () => _handlePlaybackControl(
                ref.read(appPlaybackControllerProvider.notifier).requestNext,
              ),
              onLongPressStart: (_) => ref
                  .read(appPlaybackControllerProvider.notifier)
                  .showNextPreview(),
              onLongPressEnd: (_) => ref
                  .read(appPlaybackControllerProvider.notifier)
                  .hidePreview(),
              onLongPressCancel: () => ref
                  .read(appPlaybackControllerProvider.notifier)
                  .hidePreview(),
            ),
            _PlaybackBarButton(
              icon: playbackController.loopEnabled
                  ? Icons.repeat_one_rounded
                  : Icons.repeat_rounded,
              label: playbackController.loopEnabled ? 'Loop on' : 'Loop',
              selected: playbackController.loopEnabled,
              onPressed: () => _handlePlaybackControl(
                ref.read(appPlaybackControllerProvider.notifier).toggleLoop,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNavIcon(
    BuildContext context,
    WidgetRef ref,
    _NavDestination destination, {
    required bool selected,
    required AppPlaybackControllerState playbackController,
  }) {
    if (destination.path != Routes.play) {
      return Icon(
        selected ? destination.selectedIcon : destination.icon,
        size: _bottomNavIconSize,
      );
    }

    final icon = playbackController.controllerMode
        ? playbackController.isPlaying
              ? Icons.pause_circle
              : Icons.play_circle
        : selected
        ? destination.selectedIcon
        : destination.icon;

    return Tooltip(
      message: playbackController.hasActiveVideo
          ? 'Double tap to play or pause'
          : destination.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onDoubleTap: playbackController.hasActiveVideo
            ? () => ref
                  .read(appPlaybackControllerProvider.notifier)
                  .requestToggle()
            : null,
        onLongPress: playbackController.hasActiveVideo
            ? _togglePersistentPlaybackControls
            : null,
        onVerticalDragEnd: playbackController.hasActiveVideo
            ? (details) {
                final velocity = details.primaryVelocity ?? 0;
                if (velocity < -220) {
                  _showVideoActionControls();
                }
              }
            : null,
        child: Icon(icon, size: _bottomNavIconSize),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Side rail (tablet / web)
  // ---------------------------------------------------------------------------

  Widget _buildWithRail(
    BuildContext context,
    WidgetRef ref,
    int selected,
    Widget routedChild,
    String location,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final showYoutubeStatusChrome = _showYoutubeStatusChrome(location);

    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: selected,
            onDestinationSelected: (i) =>
                _onDestinationSelected(context, ref, i),
            labelType: NavigationRailLabelType.all,
            leading: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.play_circle_outline_rounded,
                  size: 32,
                  color: colorScheme.primary,
                ),
                const SizedBox(height: 8),
              ],
            ),
            destinations: [
              for (final dest in _destinations)
                NavigationRailDestination(
                  icon: Icon(dest.icon),
                  selectedIcon: Icon(dest.selectedIcon),
                  label: Text(dest.label),
                ),
            ],
          ),
          const VerticalDivider(thickness: 1, width: 1),
          Expanded(
            child: Column(
              children: [
                if (showYoutubeStatusChrome) const YoutubeConnectBanner(),
                if (showYoutubeStatusChrome) const _YoutubeQuotaSyncStrip(),
                const YoutubeOAuthFeedbackBanner(),
                Expanded(child: routedChild),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helper model
// ---------------------------------------------------------------------------

class _NavDestination {
  const _NavDestination({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    required this.path,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final String path;
}

class _PlaybackBarButton extends StatelessWidget {
  const _PlaybackBarButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.onLongPress,
    this.onLongPressStart,
    this.onLongPressEnd,
    this.onLongPressCancel,
    this.onSwipeUp,
    this.selected = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final VoidCallback? onLongPress;
  final GestureLongPressStartCallback? onLongPressStart;
  final GestureLongPressEndCallback? onLongPressEnd;
  final VoidCallback? onLongPressCancel;
  final VoidCallback? onSwipeUp;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final color = selected ? colorScheme.primary : colorScheme.onSurfaceVariant;
    return Expanded(
      child: Tooltip(
        message: label,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onLongPressStart: onLongPressStart,
          onLongPressEnd: onLongPressEnd,
          onLongPressCancel: onLongPressCancel,
          onVerticalDragEnd: onSwipeUp == null
              ? null
              : (details) {
                  final velocity = details.primaryVelocity ?? 0;
                  if (velocity < -220) {
                    onSwipeUp!();
                  }
                },
          child: InkResponse(
            onTap: onPressed,
            onLongPress: onLongPress,
            radius: 32,
            child: SizedBox.expand(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: selected ? 34 : 28, color: color),
                  const SizedBox(height: 4),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: color,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _YoutubeQuotaSyncStrip extends ConsumerWidget {
  const _YoutubeQuotaSyncStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quotaAsync = ref.watch(quotaUsageProvider);
    final syncJobAsync = ref.watch(youtubeSyncJobProvider);
    final quota = quotaAsync.asData?.value;
    final job = syncJobAsync.asData?.value;
    final used = (quota?['used'] as num?)?.toInt();
    final limit = (quota?['limit'] as num?)?.toInt();
    final percentage = (quota?['percentage'] as num?)?.toInt();
    final status = job?['status']?.toString();
    final phase = job?['phase']?.toString();
    final current = (job?['current'] as num?)?.toInt() ?? 0;
    final total = (job?['total'] as num?)?.toInt() ?? 0;
    final isRunning = status == 'running';

    if (quota == null && !isRunning) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isThrottled = (percentage ?? 0) >= 90;
    final progress = limit != null && limit > 0 && used != null
        ? (used / limit).clamp(0.0, 1.0)
        : null;
    final syncLabel = isRunning
        ? 'Sync $current/$total${phase != null ? ' · $phase' : ''}'
        : status == 'partial'
        ? 'Last sync paused'
        : status == 'failed'
        ? 'Last sync failed'
        : null;

    return Material(
      color: isThrottled
          ? colorScheme.errorContainer
          : colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            Icon(
              isThrottled ? Icons.warning_amber_rounded : Icons.speed_rounded,
              size: 18,
              color: isThrottled
                  ? colorScheme.onErrorContainer
                  : colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                [
                  if (used != null && limit != null)
                    'YouTube quota $used / $limit'
                  else
                    'YouTube quota loading',
                  ?syncLabel,
                ].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: isThrottled
                      ? colorScheme.onErrorContainer
                      : colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            if (isRunning)
              const SizedBox.square(
                dimension: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else if (progress != null)
              SizedBox(
                width: 72,
                child: LinearProgressIndicator(value: progress),
              ),
          ],
        ),
      ),
    );
  }
}

class _ProductAccessInactiveView extends ConsumerWidget {
  const _ProductAccessInactiveView({required this.statusAsync});

  final AsyncValue<ProductAccessStatus> statusAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: statusAsync.when(
                data: (status) {
                  final isNewAccount = status.reasonCode == 'account_not_found';
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isNewAccount
                                ? Icons.hourglass_empty_rounded
                                : Icons.lock_outline,
                            color: theme.colorScheme.primary,
                          ),
                          const SizedBox(width: 12),
                          Text(
                            isNewAccount
                                ? 'Setting up your ReplayGlowz account'
                                : status.accountRecognized
                                ? 'Account recognized, product access inactive'
                                : 'ReplayGlowz access check required',
                            style: theme.textTheme.titleMedium,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        isNewAccount
                            ? 'Your sign-in worked. ReplayGlowz is creating your workspace and free access; retry in a moment if this message stays visible.'
                            : status.accountRecognized
                            ? 'Your account is valid, but it does not have active ReplayGlowz access yet.'
                            : 'ReplayGlowz could not confirm your product access for this account.',
                      ),
                      const SizedBox(height: 16),
                      const _FreeTrialAccessSummary(),
                      if ((status.reasonCode ?? '').isNotEmpty &&
                          !isNewAccount) ...[
                        const SizedBox(height: 12),
                        SelectableText(
                          'Reason: ${status.reasonCode}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          FilledButton.icon(
                            onPressed: () {
                              ref.invalidate(productAccessStatusProvider);
                            },
                            icon: const Icon(Icons.refresh),
                            label: const Text('Retry access check'),
                          ),
                          OutlinedButton.icon(
                            onPressed: () async {
                              final launched = await ref
                                  .read(authServiceProvider)
                                  .openAccountCenter();
                              if (!context.mounted || launched) return;
                              showErrorSnackBar(
                                context,
                                error: 'Could not open the account center.',
                                prefix: 'Account center unavailable',
                              );
                            },
                            icon: const Icon(Icons.manage_accounts),
                            label: const Text('Open account center'),
                          ),
                        ],
                      ),
                    ],
                  );
                },
                loading: () => const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    SizedBox(width: 12),
                    Text('Checking product access…'),
                  ],
                ),
                error: (error, stackTrace) => Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ReplayGlowz cannot verify product access right now.',
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    SelectableText(
                      '$error',
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontFamily: 'monospace',
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: () {
                        ref.invalidate(productAccessStatusProvider);
                      },
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry access check'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FreeTrialAccessSummary extends StatelessWidget {
  const _FreeTrialAccessSummary();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.workspace_premium_outlined,
                  size: 18,
                  color: colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Text('Free trial access', style: theme.textTheme.labelLarge),
              ],
            ),
            const SizedBox(height: 10),
            const _TrialAccessRow(
              icon: Icons.video_library_outlined,
              text: 'Sync a starter YouTube library',
            ),
            const _TrialAccessRow(
              icon: Icons.playlist_play_outlined,
              text: 'Create and manage playlists',
            ),
            const _TrialAccessRow(
              icon: Icons.sticky_note_2_outlined,
              text: 'Save timestamped notes and watch progress',
            ),
            const _TrialAccessRow(
              icon: Icons.speed_outlined,
              text:
                  'Quota placeholders: daily sync and playlist actions included while limits are finalized',
            ),
            const SizedBox(height: 8),
            Text(
              'Trial limits are placeholders during beta and may change before billing launches.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TrialAccessRow extends StatelessWidget {
  const _TrialAccessRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurfaceVariant;
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}
