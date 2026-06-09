import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:replayglowz_app/auth/auth_gate.dart';
import 'package:replayglowz_app/auth/auth_state.dart';
import 'package:replayglowz_app/screens/feedback/feedback_admin_screen.dart';
import 'package:replayglowz_app/screens/feedback/feedback_screen.dart';
import 'package:replayglowz_app/screens/hidden/hidden_screen.dart';
import 'package:replayglowz_app/screens/notes/note_detail_screen.dart';
import 'package:replayglowz_app/screens/notes/notes_screen.dart';
import 'package:replayglowz_app/screens/notifications/notifications_screen.dart';
import 'package:replayglowz_app/screens/play/play_screen.dart';
import 'package:replayglowz_app/screens/playlists/create_playlist_screen.dart';
import 'package:replayglowz_app/screens/playlists/playlist_detail_screen.dart';
import 'package:replayglowz_app/screens/playlists/virtual_feed_detail_screen.dart';
import 'package:replayglowz_app/screens/playlists/playlists_screen.dart';
import 'package:replayglowz_app/screens/preferences/preferences_screen.dart';
import 'package:replayglowz_app/screens/stats/stats_screen.dart';
import 'package:replayglowz_app/screens/videos/videos_screen.dart';
import 'package:replayglowz_app/widgets/app_shell.dart';

// ---------------------------------------------------------------------------
// Route paths
// ---------------------------------------------------------------------------

abstract final class Routes {
  static const signIn = '/sign-in';
  static const ssoCallback = '/sso-callback';
  static const videos = '/feed';
  static const legacyVideos = '/videos';
  static const play = '/play';
  static const playlists = '/playlists';
  static const playlistCreate = '/playlists/create';
  static String playlistDetail(String id) => '/playlists/$id';
  static String virtualFeedDetail(String id) => '/playlists/feeds/$id';
  static String legacyVirtualFeed(String id) => '/playlists/feed/$id';
  static const notes = '/notes';
  static String noteDetail(String slug) => '/notes/$slug';
  static const notifications = '/notifications';
  static const preferences = '/preferences';
  static const feedback = '/feedback';
  static const feedbackAdmin = '/feedback/admin';
  static const hidden = '/hidden';
  static const stats = '/stats';
}

String _redirectTarget(GoRouterState state) {
  final uri = state.uri;
  final path = uri.path.isEmpty || uri.path == '/' ? Routes.videos : uri.path;
  return Uri(
    path: path,
    queryParameters: uri.queryParameters.isEmpty ? null : uri.queryParameters,
  ).toString();
}

String _resolvedRedirectTarget(GoRouterState state) {
  final target = state.uri.queryParameters['tf_redirect'];
  if (target == null || target.isEmpty) return Routes.videos;
  if (target.startsWith('/')) return target;
  return '/$target';
}

// ---------------------------------------------------------------------------
// Router provider
// ---------------------------------------------------------------------------

final routerProvider = Provider<GoRouter>((ref) {
  // Keep one router instance alive and refresh redirects from auth updates.
  final authStateListenable = ValueNotifier<AuthState>(
    ref.read(authStateProvider),
  );
  ref.listen<AuthState>(authStateProvider, (_, next) {
    authStateListenable.value = next;
  });

  final router = GoRouter(
    initialLocation: Routes.videos,
    refreshListenable: authStateListenable,
    redirect: (BuildContext context, GoRouterState state) {
      final authState = authStateListenable.value;
      final isAuthenticated = authState is AuthAuthenticated;
      final isLoading = authState is AuthLoading;
      final goingToSignIn = state.matchedLocation == Routes.signIn;
      final goingToSsoCallback = state.matchedLocation == Routes.ssoCallback;
      final goingToPublicFeedback = state.matchedLocation == Routes.feedback;
      final goingToProtectedRoute =
          !goingToSignIn && !goingToSsoCallback && !goingToPublicFeedback;

      if (isLoading) {
        // On web the app can cold-start on a protected route before the auth
        // session is restored. Keep that bootstrap on /sign-in so users do not
        // interact with a "dead" dashboard while auth is still unknown.
        if (goingToProtectedRoute) {
          return Uri(
            path: Routes.signIn,
            queryParameters: {'tf_redirect': _redirectTarget(state)},
          ).toString();
        }
        return null;
      }

      if (isAuthenticated && goingToSignIn) {
        return _resolvedRedirectTarget(state);
      }
      if (!isAuthenticated && goingToProtectedRoute) {
        return Uri(
          path: Routes.signIn,
          queryParameters: {'tf_redirect': _redirectTarget(state)},
        ).toString();
      }
      return null;
    },
    routes: [
      // Sign-in (no shell)
      GoRoute(
        path: Routes.signIn,
        builder: (context, state) => const AuthSignInPage(),
      ),
      GoRoute(
        path: Routes.ssoCallback,
        builder: (context, state) => const AuthSsoCallbackPage(),
      ),
      GoRoute(
        path: Routes.feedback,
        builder: (context, state) => const FeedbackScreen(),
      ),
      GoRoute(
        path: Routes.feedbackAdmin,
        builder: (context, state) => const FeedbackAdminScreen(),
      ),
      GoRoute(
        path: Routes.legacyVideos,
        redirect: (context, state) => Routes.videos,
      ),

      // Main app with shell navigation
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(shellState: state, navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.videos,
                pageBuilder: (context, state) {
                  final activeVideoScrollToken =
                      state.uri.queryParameters['focusActive'];
                  final activeVideoScrollId =
                      state.uri.queryParameters['focusVideo'];
                  return NoTransitionPage(
                    key: state.pageKey,
                    child: VideosScreen(
                      activeVideoScrollToken: activeVideoScrollToken,
                      activeVideoScrollId: activeVideoScrollId,
                    ),
                  );
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.play,
                pageBuilder: (context, state) {
                  final videoId = state.uri.queryParameters['videoId'] ?? '';
                  final autoPlay = state.uri.queryParameters['autoPlay'] == '1';
                  return NoTransitionPage(
                    key: state.pageKey,
                    child: PlayScreen(videoId: videoId, autoPlay: autoPlay),
                  );
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.playlists,
                pageBuilder: (context, state) => NoTransitionPage(
                  key: state.pageKey,
                  child: const PlaylistsScreen(),
                ),
                routes: [
                  GoRoute(
                    path: 'create',
                    builder: (context, state) => const CreatePlaylistScreen(),
                  ),
                  GoRoute(
                    path: ':id',
                    builder: (context, state) =>
                        PlaylistDetailScreen(id: state.pathParameters['id']!),
                  ),
                  GoRoute(
                    path: 'feeds/:id',
                    builder: (context, state) => VirtualFeedDetailScreen(
                      feedId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'feed/:id',
                    redirect: (context, state) =>
                        Routes.virtualFeedDetail(state.pathParameters['id']!),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.notes,
                pageBuilder: (context, state) => NoTransitionPage(
                  key: state.pageKey,
                  child: const NotesScreen(),
                ),
                routes: [
                  GoRoute(
                    path: ':slug',
                    builder: (context, state) =>
                        NoteDetailScreen(slug: state.pathParameters['slug']!),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.notifications,
                builder: (context, state) => const NotificationsScreen(),
              ),
              GoRoute(
                path: Routes.preferences,
                builder: (context, state) => const PreferencesScreen(),
              ),
              GoRoute(
                path: Routes.hidden,
                builder: (context, state) => const HiddenScreen(),
              ),
              GoRoute(
                path: Routes.stats,
                builder: (context, state) => const StatsScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );

  ref.onDispose(() {
    router.dispose();
    authStateListenable.dispose();
  });

  return router;
});
