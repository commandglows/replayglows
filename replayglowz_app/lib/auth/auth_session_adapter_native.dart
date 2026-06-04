import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'package:replayglowz_app/app/build_info.dart';
import 'package:replayglowz_app/auth/auth_session_adapter.dart';
import 'package:replayglowz_app/auth/auth_state.dart';
import 'package:replayglowz_app/auth/firebase_bootstrap.dart';
import 'package:replayglowz_app/auth/suite_identity.dart';
import 'package:replayglowz_app/auth/suite_identity_bridge_client.dart';
import 'package:url_launcher/url_launcher.dart';

class _SuiteIdentitySession {
  _SuiteIdentitySession.fromUser(firebase_auth.User user)
    : id = user.uid,
      email = user.email?.trim() ?? '',
      displayName = user.displayName?.trim(),
      imageUrl = user.photoURL?.trim();

  final String id;
  final String email;
  final String? displayName;
  final String? imageUrl;

  SuiteIdentityRuntimeSession toBridgeSession() => SuiteIdentityRuntimeSession(
    firebaseUserId: id,
    email: email,
    userName: displayName,
    imageUrl: imageUrl,
  );
}

class NativeFirebaseAuthSessionAdapter implements AuthSessionAdapter {
  NativeFirebaseAuthSessionAdapter({
    firebase_auth.FirebaseAuth? firebaseAuth,
    GoogleSignIn? googleSignIn,
    SuiteIdentityBridgeClient? suiteIdentityBridgeClient,
    SuiteIdentityBridgeRuntimeConfig? bridgeConfig,
  }) : _firebaseAuth = firebaseAuth ?? firebase_auth.FirebaseAuth.instance,
       _googleSignIn =
           googleSignIn ??
           GoogleSignIn(
             clientId: firebaseWebClientId.isEmpty ? null : firebaseWebClientId,
           ),
       _suiteIdentityBridgeClient =
           suiteIdentityBridgeClient ?? const SuiteIdentityBridgeClient(),
       _bridgeConfig =
           bridgeConfig ?? suiteIdentityBridgeRuntimeConfigFromBuildInfo();

  final firebase_auth.FirebaseAuth _firebaseAuth;
  final GoogleSignIn _googleSignIn;
  final SuiteIdentityBridgeClient _suiteIdentityBridgeClient;
  final SuiteIdentityBridgeRuntimeConfig _bridgeConfig;

  AuthUser? _currentUser;
  bool _initialised = false;
  String? _statusMessage;
  SuiteIdentitySnapshot? _suiteIdentitySnapshot;
  StreamSubscription<firebase_auth.User?>? _authSubscription;

  @override
  bool get isInitialised => _initialised;

  @override
  bool get hasConfig => hasFirebaseNativeConfig;

  @override
  AuthUser? get currentUser => _currentUser;

  @override
  bool get isAuthenticated => _currentUser != null;

  @override
  String? get statusMessage => _statusMessage;

  @override
  Future<void> initialise() async {
    if (!hasFirebaseNativeConfig) {
      _statusMessage = 'ReplayGlowz native sign-in is not configured.';
      _initialised = true;
      return;
    }

    await FirebaseBootstrap.initialise();
    if (!FirebaseBootstrap.isConfigured) {
      _statusMessage =
          FirebaseBootstrap.initError ??
          'ReplayGlowz native auth is unavailable.';
      _initialised = true;
      return;
    }

    _authSubscription = _firebaseAuth.authStateChanges().listen((user) {
      _updateFromFirebaseUser(user);
    });

    await refreshSession();
    _statusMessage = null;
    _initialised = true;
  }

  Future<void> _updateFromFirebaseUser(firebase_auth.User? user) async {
    if (user == null) {
      _currentUser = null;
      _suiteIdentitySnapshot = null;
      return;
    }

    final session = _SuiteIdentitySession.fromUser(user);
    _currentUser = AuthUser(
      id: session.id,
      email: session.email,
      displayName: session.displayName,
      imageUrl: session.imageUrl,
    );

    _suiteIdentitySnapshot = null;
    unawaited(_resolveSuiteIdentity(session));
  }

  Future<void> _resolveSuiteIdentity(
    _SuiteIdentitySession session, {
    bool refresh = false,
    bool forceRefresh = false,
  }) async {
    final snapshot = await _suiteIdentityBridgeClient
        .resolveFromFirebaseSession(
          session: session.toBridgeSession(),
          bridgeConfig: _bridgeConfig,
          forceRefresh: forceRefresh,
          resolveIdToken: ({required bool forceRefresh}) async {
            try {
              return _firebaseAuth.currentUser?.getIdToken(forceRefresh);
            } catch (_) {
              return null;
            }
          },
        );

    if (refresh) {
      _suiteIdentitySnapshot = snapshot;
    } else if (_currentUser != null && _currentUser!.id == session.id) {
      _suiteIdentitySnapshot = snapshot;
    }
  }

  @override
  Future<AuthUser?> refreshSession() async {
    if (!hasFirebaseNativeConfig || !FirebaseBootstrap.isConfigured) {
      _currentUser = null;
      return null;
    }

    final user = _firebaseAuth.currentUser;
    if (user == null) {
      _currentUser = null;
      return null;
    }

    final session = _SuiteIdentitySession.fromUser(user);
    _currentUser = AuthUser(
      id: session.id,
      email: session.email,
      displayName: session.displayName,
      imageUrl: session.imageUrl,
    );
    await _resolveSuiteIdentity(session, refresh: true, forceRefresh: true);
    return _currentUser;
  }

  @override
  Future<void> signIn({String? redirectTo}) async {
    if (redirectTo != null) {
      // Native flow uses Google Sign-In directly; redirect targets are web-only.
    }

    if (!hasFirebaseNativeConfig || !FirebaseBootstrap.isConfigured) {
      throw StateError('ReplayGlowz native sign-in is not configured.');
    }

    if (kIsWeb) {
      throw UnsupportedError('Google sign-in is handled by Clerk on web.');
    }

    final account = await _googleSignIn.signIn();
    if (account == null) {
      return;
    }

    final auth = await account.authentication;
    if (auth.idToken == null || auth.idToken!.isEmpty) {
      throw StateError('Google sign-in did not return an id token.');
    }

    final credential = firebase_auth.GoogleAuthProvider.credential(
      idToken: auth.idToken,
      accessToken: auth.accessToken,
    );
    await _firebaseAuth.signInWithCredential(credential);
    await refreshSession();
  }

  @override
  Future<String?> getConvexToken({bool forceRefresh = false}) async {
    if (!isAuthenticated) {
      return null;
    }

    final snapshot = _suiteIdentitySnapshot;
    if (snapshot == null || !snapshot.hasReplayGlowzAccess) {
      if (forceRefresh) {
        await refreshSession();
      }
    }

    final refreshedSnapshot = _suiteIdentitySnapshot;
    if (refreshedSnapshot == null || !refreshedSnapshot.hasReplayGlowzAccess) {
      return null;
    }

    final bridgeProductToken = refreshedSnapshot.productToken;
    if (bridgeProductToken != null && bridgeProductToken.isNotEmpty) {
      return bridgeProductToken;
    }

    return null;
  }

  @override
  Future<String?> getSessionToken({bool forceRefresh = false}) async {
    return getConvexToken(forceRefresh: forceRefresh);
  }

  @override
  Future<bool> waitForConvexTokenReady({int attempts = 8}) async {
    for (var attempt = 0; attempt < attempts; attempt++) {
      final token = await getConvexToken(forceRefresh: attempt == 0);
      if (token != null && token.isNotEmpty) {
        return true;
      }
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }
    return false;
  }

  @override
  Future<void> openUserProfile() => openAccountCenter();

  @override
  Future<bool> openAccountCenter() async {
    final url = Uri.tryParse(replayGlowzAccountCenterUrl);
    if (url == null || !url.hasScheme || url.host.isEmpty) {
      return false;
    }
    return launchUrl(url);
  }

  @override
  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
    } catch (_) {
      // Ignore Google sign-out errors; still proceed with Firebase sign-out.
    }
    await _firebaseAuth.signOut();
    _currentUser = null;
    _suiteIdentitySnapshot = null;
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
  }
}

AuthSessionAdapter createAuthSessionAdapterImpl() =>
    _NativeAuthSessionAdapterFactory.instance.create();

class _NativeAuthSessionAdapterFactory {
  _NativeAuthSessionAdapterFactory._();

  static final instance = _NativeAuthSessionAdapterFactory._();

  NativeFirebaseAuthSessionAdapter create() =>
      NativeFirebaseAuthSessionAdapter();
}
