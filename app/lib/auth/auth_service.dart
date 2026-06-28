import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:replayglowz_app/auth/auth_session_adapter.dart';
import 'package:replayglowz_app/auth/auth_state.dart';
import 'package:replayglowz_app/convex/convex_client.dart';
import 'package:replayglowz_app/utils/app_logger.dart';

class AuthService {
  AuthService({required this.authNotifier}) {
    _initialise();
  }

  final AuthNotifier authNotifier;
  final AuthSessionAdapter _adapter = createAuthSessionAdapter();
  final Completer<void> _ready = Completer<void>();

  AuthUser? _currentUser;
  bool _isInitialised = false;

  Future<void> get ready => _ready.future;

  bool get isInitialised => _isInitialised;

  bool get isAuthenticated => _currentUser != null;

  AuthUser? get currentUser => _currentUser;

  Future<void> _initialise() async {
    try {
      await _adapter.initialise();

      _isInitialised = true;

      _syncSessionUser(_adapter.currentUser);

      if (_adapter.statusMessage != null) {
        authNotifier.setUnauthenticated(error: _adapter.statusMessage);
        AppLogger.instance.log(
          _adapter.statusMessage!,
          source: 'AuthService',
          level: LogLevel.warning,
        );
      }

      AppLogger.instance.log(
        kIsWeb
            ? 'AuthService initialised with ClerkJS'
            : 'AuthService initialised with native Firebase session adapter',
        source: 'AuthService',
      );

      if (!_ready.isCompleted) {
        _ready.complete();
      }

      return;
    } catch (e, st) {
      authNotifier.setUnauthenticated(
        error: 'ReplayGlowz sign-in is unavailable.',
      );
      AppLogger.instance.log(
        'AuthService initialisation failed',
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

  void _syncSessionUser(AuthUser? user) {
    if (user == null || user.id.isEmpty) {
      _currentUser = null;
      authNotifier.setUnauthenticated();
      return;
    }

    final authUser = user;
    _currentUser = authUser;
    authNotifier.setAuthenticated(authUser);
  }

  Future<void> signIn({String? redirectTo}) async {
    await ready;
    if (!_adapter.hasConfig) {
      throw StateError('ReplayGlowz sign-in is not configured for this build.');
    }

    authNotifier.setLoading();
    try {
      await _adapter.signIn(redirectTo: redirectTo);
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
      final sessionUser = await _adapter.refreshSession();
      _syncSessionUser(sessionUser);
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
    return _adapter.getConvexToken(forceRefresh: forceRefresh);
  }

  Future<String?> getSessionToken({bool forceRefresh = false}) async {
    await ready;
    return _adapter.getSessionToken(forceRefresh: forceRefresh);
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
    await _adapter.openUserProfile();
  }

  Future<bool> openAccountCenter() async {
    await ready;
    return _adapter.openAccountCenter();
  }

  Future<void> signOut() async {
    await ready;
    await _adapter.signOut();
    try {
      ConvexService.instance.clearAuth();
    } catch (_) {
      // Convex service is optional during early bootstrap.
    }
    _currentUser = null;
    authNotifier.setUnauthenticated();
  }

  void dispose() {
    _adapter.dispose();
  }
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
