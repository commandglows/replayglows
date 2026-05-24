import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:replayglowz_app/app/build_info.dart';
import 'package:replayglowz_app/auth/clerk_js_bridge.dart';
import 'package:replayglowz_app/auth/auth_state.dart';
import 'package:replayglowz_app/utils/app_logger.dart';

class AuthService {
  AuthService({required this.authNotifier}) {
    _initialise();
  }

  final AuthNotifier authNotifier;
  final ClerkJsBridge _bridge = createClerkJsBridge();
  final Completer<void> _ready = Completer<void>();

  AuthUser? _currentUser;
  bool _isInitialised = false;

  Future<void> get ready => _ready.future;

  bool get isInitialised => _isInitialised;

  bool get isAuthenticated => _currentUser != null;

  AuthUser? get currentUser => _currentUser;

  Future<void> _initialise() async {
    try {
      if (!hasClerkConfig) {
        authNotifier.setUnauthenticated(
          error: 'ReplayGlowz sign-in is not configured for this build.',
        );
        AppLogger.instance.log(
          'Clerk auth skipped: missing CLERK_PUBLISHABLE_KEY dart-define',
          source: 'AuthService',
          level: LogLevel.warning,
        );
        _ready.complete();
        return;
      }

      final session = await _bridge.load(
        const ClerkBridgeConfig(
          publishableKey: clerkPublishableKey,
          signInUrl: clerkSignInUrl,
          signUpUrl: clerkSignUpUrl,
          accountCenterUrl: replayGlowzAccountCenterUrl,
        ),
      );
      _syncBridgeUser(session.user, isSignedIn: session.isSignedIn);
      _isInitialised = true;
      AppLogger.instance.log(
        'Clerk auth initialised via ClerkJS bridge',
        source: 'AuthService',
      );
      _ready.complete();
    } catch (e, st) {
      authNotifier.setUnauthenticated(
        error: 'ReplayGlowz sign-in is unavailable.',
      );
      AppLogger.instance.log(
        'Clerk auth initialisation failed',
        source: 'AuthService',
        level: LogLevel.error,
        error: e,
        stackTrace: st,
      );
      if (!_ready.isCompleted) {
        _ready.completeError(e, st);
      }
    }
  }

  void _syncBridgeUser(ClerkBridgeUser? user, {required bool isSignedIn}) {
    if (!isSignedIn || user == null || user.id.isEmpty) {
      _currentUser = null;
      authNotifier.setUnauthenticated();
      return;
    }

    final authUser = AuthUser(
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      imageUrl: user.imageUrl,
    );
    _currentUser = authUser;
    authNotifier.setAuthenticated(authUser);
  }

  Future<void> signIn({String? redirectTo}) async {
    await ready;
    if (!hasClerkConfig) {
      throw StateError('ReplayGlowz sign-in is not configured for this build.');
    }

    authNotifier.setLoading();
    try {
      await _bridge.openSignIn(redirectTo: redirectTo);
      await refreshSession();
    } catch (e, st) {
      authNotifier.setUnauthenticated(error: 'ReplayGlowz sign-in failed.');
      AppLogger.instance.log(
        'ReplayGlowz sign-in failed',
        source: 'AuthService',
        level: LogLevel.error,
        error: e,
        stackTrace: st,
      );
      rethrow;
    }
  }

  Future<void> refreshSession() async {
    await ready;
    try {
      final signedIn = await _bridge.isSignedIn();
      if (!signedIn) {
        _currentUser = null;
        authNotifier.setUnauthenticated();
        return;
      }
      final bridgeUser = await _bridge.getUser();
      _syncBridgeUser(bridgeUser, isSignedIn: true);
    } catch (e, st) {
      _currentUser = null;
      authNotifier.setUnauthenticated(
        error: 'ReplayGlowz session refresh failed.',
      );
      AppLogger.instance.log(
        'ReplayGlowz session refresh failed',
        source: 'AuthService',
        level: LogLevel.warning,
        error: e,
        stackTrace: st,
      );
    }
  }

  Future<String?> getConvexToken({bool forceRefresh = false}) async {
    await ready;
    return _bridge.getConvexToken(skipCache: forceRefresh);
  }

  Future<String?> getSessionToken({bool forceRefresh = false}) async {
    await ready;
    return _bridge.getSessionToken(skipCache: forceRefresh);
  }

  Future<bool> waitForConvexTokenReady() async {
    await ready;
    for (var attempt = 0; attempt < 8; attempt++) {
      final String? token;
      try {
        token = await getConvexToken(forceRefresh: attempt == 0);
      } catch (e, st) {
        AppLogger.instance.log(
          'Convex auth token is unavailable',
          source: 'AuthService',
          level: LogLevel.warning,
          error: e,
          stackTrace: st,
        );
        return false;
      }
      if (token != null && token.isNotEmpty) {
        return true;
      }
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }
    return false;
  }

  Future<void> openUserProfile() async {
    await ready;
    await _bridge.openUserProfile();
  }

  Future<bool> openAccountCenter() async {
    final url = Uri.tryParse(replayGlowzAccountCenterUrl);
    if (url == null || !url.hasScheme || url.host.isEmpty) {
      return false;
    }
    return launchUrl(url, webOnlyWindowName: '_self');
  }

  Future<void> signOut() async {
    await _bridge.signOut(redirectTo: clerkSignInUrl);
    _currentUser = null;
    authNotifier.setUnauthenticated();
  }

  void dispose() {}
}

final authServiceProvider = Provider<AuthService>((ref) {
  final authNotifier = ref.read(authStateProvider.notifier);
  final service = AuthService(authNotifier: authNotifier);
  ref.onDispose(service.dispose);
  return service;
});

final convexAuthReadyProvider = FutureProvider<bool>((ref) async {
  final service = ref.watch(authServiceProvider);
  await service.ready;
  return service.waitForConvexTokenReady();
});
