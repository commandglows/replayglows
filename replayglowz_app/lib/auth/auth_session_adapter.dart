import 'auth_session_adapter_native.dart'
    if (dart.library.js_interop) 'auth_session_adapter_web.dart';

import 'auth_state.dart';

abstract class AuthSessionAdapter {
  bool get isInitialised;

  bool get hasConfig;

  AuthUser? get currentUser;

  bool get isAuthenticated;

  String? get statusMessage;

  Future<void> initialise();

  Future<AuthUser?> refreshSession();

  Future<void> signIn({String? redirectTo});

  Future<String?> getConvexToken({bool forceRefresh = false});

  Future<String?> getSessionToken({bool forceRefresh = false});

  Future<bool> waitForConvexTokenReady({int attempts = 8});

  Future<void> openUserProfile();

  Future<bool> openAccountCenter();

  Future<void> signOut();

  void dispose() {}
}

AuthSessionAdapter createAuthSessionAdapter() => createAuthSessionAdapterImpl();
