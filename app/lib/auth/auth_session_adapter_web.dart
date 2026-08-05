import 'package:replayglows_app/app/build_info.dart';
import 'package:replayglows_app/auth/auth_session_adapter.dart';
import 'package:replayglows_app/auth/auth_state.dart';
import 'package:replayglows_app/auth/clerk_js_bridge.dart';
import 'package:url_launcher/url_launcher.dart';

class _WebAuthSessionAdapter implements AuthSessionAdapter {
  _WebAuthSessionAdapter() {
    _bridge = createClerkJsBridge();
  }

  late final ClerkJsBridge _bridge;

  AuthUser? _currentUser;
  bool _initialised = false;
  String? _statusMessage;

  @override
  bool get isInitialised => _initialised;

  @override
  bool get hasConfig => hasClerkConfig;

  @override
  AuthUser? get currentUser => _currentUser;

  @override
  bool get isAuthenticated => _currentUser != null;

  @override
  String? get statusMessage => _statusMessage;

  @override
  Future<void> initialise() async {
    if (!hasClerkConfig) {
      _statusMessage = 'ReplayGlows sign-in is not configured for this build.';
      _initialised = true;
      _currentUser = null;
      return;
    }

    final session = await _bridge.load(
      const ClerkBridgeConfig(
        publishableKey: clerkPublishableKey,
        signInUrl: clerkSignInUrl,
        signUpUrl: clerkSignUpUrl,
        accountCenterUrl: replayGlowsAccountCenterUrl,
      ),
    );

    if (session.configured && session.isSignedIn) {
      _syncUser(session.user);
    }
    _initialised = true;
  }

  void _syncUser(ClerkBridgeUser? user) {
    if (user == null || user.id.isEmpty) {
      _currentUser = null;
      return;
    }
    _currentUser = AuthUser(
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      imageUrl: user.imageUrl,
    );
  }

  @override
  Future<AuthUser?> refreshSession() async {
    if (!hasClerkConfig) {
      _currentUser = null;
      return null;
    }
    final signedIn = await _bridge.isSignedIn();
    if (!signedIn) {
      _currentUser = null;
      return null;
    }
    final user = await _bridge.getUser();
    _syncUser(user);
    return _currentUser;
  }

  @override
  Future<void> signIn({String? redirectTo}) async {
    await _bridge.openSignIn(redirectTo: redirectTo);
    await refreshSession();
  }

  @override
  Future<String?> getConvexToken({bool forceRefresh = false}) =>
      _bridge.getConvexToken(skipCache: forceRefresh);

  @override
  Future<String?> getSessionToken({bool forceRefresh = false}) =>
      _bridge.getSessionToken(skipCache: forceRefresh);

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
  Future<void> openUserProfile() => _bridge.openUserProfile();

  @override
  Future<bool> openAccountCenter() async {
    final url = Uri.tryParse(replayGlowsAccountCenterUrl);
    if (url == null || !url.hasScheme || url.host.isEmpty) {
      return false;
    }
    return launchUrl(url, webOnlyWindowName: '_self');
  }

  @override
  Future<void> signOut() async {
    await _bridge.signOut(redirectTo: clerkSignInUrl);
    _currentUser = null;
  }

  @override
  void dispose() {}
}

AuthSessionAdapter createAuthSessionAdapterImpl() => _WebAuthSessionAdapter();
