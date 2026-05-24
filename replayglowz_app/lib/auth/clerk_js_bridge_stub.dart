import 'clerk_js_bridge.dart';

class _UnsupportedClerkJsBridge implements ClerkJsBridge {
  @override
  Future<ClerkBridgeSession> load(ClerkBridgeConfig config) async {
    return const ClerkBridgeSession(configured: false, isSignedIn: false);
  }

  @override
  Future<bool> isSignedIn() async => false;

  @override
  Future<ClerkBridgeUser?> getUser() async => null;

  @override
  Future<void> openSignIn({String? redirectTo}) async {
    throw UnsupportedError('ClerkJS bridge is only available on web.');
  }

  @override
  Future<void> openUserProfile() async {
    throw UnsupportedError('ClerkJS bridge is only available on web.');
  }

  @override
  Future<void> signOut({String? redirectTo}) async {}

  @override
  Future<String?> getConvexToken({
    String template = 'convex',
    bool skipCache = false,
  }) async => null;

  @override
  Future<String?> getSessionToken({bool skipCache = false}) async => null;
}

ClerkJsBridge createBridgeImpl() => _UnsupportedClerkJsBridge();
