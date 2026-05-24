import 'clerk_js_bridge_stub.dart'
    if (dart.library.js_interop) 'clerk_js_bridge_web.dart';

class ClerkBridgeConfig {
  const ClerkBridgeConfig({
    required this.publishableKey,
    required this.signInUrl,
    required this.signUpUrl,
    required this.accountCenterUrl,
  });

  final String publishableKey;
  final String signInUrl;
  final String signUpUrl;
  final String accountCenterUrl;
}

class ClerkBridgeUser {
  const ClerkBridgeUser({
    required this.id,
    required this.email,
    this.displayName,
    this.imageUrl,
  });

  final String id;
  final String email;
  final String? displayName;
  final String? imageUrl;
}

class ClerkBridgeSession {
  const ClerkBridgeSession({
    required this.configured,
    required this.isSignedIn,
    this.user,
  });

  final bool configured;
  final bool isSignedIn;
  final ClerkBridgeUser? user;
}

abstract class ClerkJsBridge {
  Future<ClerkBridgeSession> load(ClerkBridgeConfig config);

  Future<bool> isSignedIn();

  Future<ClerkBridgeUser?> getUser();

  Future<void> openSignIn({String? redirectTo});

  Future<void> openUserProfile();

  Future<void> signOut({String? redirectTo});

  Future<String?> getConvexToken({bool skipCache});

  Future<String?> getSessionToken({bool skipCache});
}

ClerkJsBridge createClerkJsBridge() => createBridgeImpl();
