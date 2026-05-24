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
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.child});

  /// The routed page content.
  final Widget child;

  // ---------------------------------------------------------------------------
  // Navigation destinations
  // ---------------------------------------------------------------------------

  static const _destinations = <_NavDestination>[
    _NavDestination(
      label: 'Videos',
      icon: Icons.video_library_outlined,
      selectedIcon: Icons.video_library,
      path: Routes.videos,
    ),
    _NavDestination(
      label: 'Play',
      icon: Icons.play_circle_outline,
      selectedIcon: Icons.play_circle,
      path: Routes.play,
    ),
    _NavDestination(
      label: 'Playlists',
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
  int _selectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    for (var i = 0; i < _destinations.length; i++) {
      if (location.startsWith(_destinations[i].path)) {
        return i;
      }
    }
    return 0;
  }

  bool _showYoutubeStatusChrome(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    return location.startsWith(Routes.videos) ||
        location.startsWith(Routes.play) ||
        location.startsWith(Routes.playlists) ||
        location.startsWith(Routes.notes);
  }

  void _onDestinationSelected(BuildContext context, int index) {
    context.go(_destinations[index].path);
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  /// Breakpoint above which the side [NavigationRail] is used instead of the
  /// bottom [NavigationBar]. 600dp matches the Material 3 compact/medium
  /// breakpoint.
  static const _railBreakpoint = 600.0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final width = MediaQuery.sizeOf(context).width;
    final selected = _selectedIndex(context);
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
        : child;

    if (width >= _railBreakpoint) {
      return _buildWithRail(context, ref, selected, routedChild);
    }
    return _buildWithBottomNav(context, ref, selected, routedChild);
  }

  // ---------------------------------------------------------------------------
  // Bottom navigation (mobile)
  // ---------------------------------------------------------------------------

  Widget _buildWithBottomNav(
    BuildContext context,
    WidgetRef ref,
    int selected,
    Widget routedChild,
  ) {
    final showYoutubeStatusChrome = _showYoutubeStatusChrome(context);
    return Scaffold(
      body: Column(
        children: [
          if (showYoutubeStatusChrome) const YoutubeConnectBanner(),
          const YoutubeOAuthFeedbackBanner(),
          Expanded(child: routedChild),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: (i) => _onDestinationSelected(context, i),
        destinations: [
          for (final dest in _destinations)
            NavigationDestination(
              icon: Icon(dest.icon),
              selectedIcon: Icon(dest.selectedIcon),
              label: dest.label,
            ),
        ],
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
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final showYoutubeStatusChrome = _showYoutubeStatusChrome(context);

    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: selected,
            onDestinationSelected: (i) => _onDestinationSelected(context, i),
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
                data: (status) => Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.lock_outline,
                          color: theme.colorScheme.primary,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          status.accountRecognized
                              ? 'Account recognized, product access inactive'
                              : 'ReplayGlowz access check required',
                          style: theme.textTheme.titleMedium,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      status.accountRecognized
                          ? 'Your account is valid, but it does not have active ReplayGlowz access yet.'
                          : 'ReplayGlowz could not confirm your product access for this account.',
                    ),
                    if ((status.reasonCode ?? '').isNotEmpty) ...[
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
                ),
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
