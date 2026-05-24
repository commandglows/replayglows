import 'dart:convert';
import 'dart:js_interop';

import 'clerk_js_bridge.dart';

@JS('replayGlowzClerkBridge')
external _ReplayGlowzClerkBridge get _bridge;

extension type _ReplayGlowzClerkBridge(JSObject _) implements JSObject {
  external JSPromise<JSString> load(JSString configJson);

  external JSPromise<JSBoolean> isSignedIn();

  external JSPromise<JSString> getUser();

  external JSPromise<JSAny?> openSignIn(JSString redirectTo);

  external JSPromise<JSAny?> openUserProfile();

  external JSPromise<JSAny?> signOut(JSString redirectTo);

  external JSPromise<JSString> getConvexToken(JSString template);

  external JSPromise<JSString> getSessionToken();
}

class _WebClerkJsBridge implements ClerkJsBridge {
  @override
  Future<ClerkBridgeSession> load(ClerkBridgeConfig config) async {
    final configJson = jsonEncode({
      'publishableKey': config.publishableKey,
      'signInUrl': config.signInUrl,
      'signUpUrl': config.signUpUrl,
      'accountCenterUrl': config.accountCenterUrl,
    });

    final raw = (await _bridge.load(configJson.toJS).toDart).toDart;
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return _sessionFromJson(decoded);
  }

  @override
  Future<bool> isSignedIn() async {
    return (await _bridge.isSignedIn().toDart).toDart;
  }

  @override
  Future<ClerkBridgeUser?> getUser() async {
    final raw = (await _bridge.getUser().toDart).toDart;
    if (raw == 'null' || raw.isEmpty) return null;
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return _userFromJson(decoded);
  }

  @override
  Future<void> openSignIn({String? redirectTo}) async {
    await _bridge.openSignIn((redirectTo ?? '').toJS).toDart;
  }

  @override
  Future<void> openUserProfile() async {
    await _bridge.openUserProfile().toDart;
  }

  @override
  Future<void> signOut({String? redirectTo}) async {
    await _bridge.signOut((redirectTo ?? '').toJS).toDart;
  }

  @override
  Future<String?> getConvexToken({
    String template = 'convex',
    bool skipCache = false,
  }) async {
    final token = (await _bridge.getConvexToken(template.toJS).toDart).toDart;
    if (token.isEmpty) return null;
    return token;
  }

  @override
  Future<String?> getSessionToken({bool skipCache = false}) async {
    final token = (await _bridge.getSessionToken().toDart).toDart;
    if (token.isEmpty) return null;
    return token;
  }

  ClerkBridgeSession _sessionFromJson(Map<String, dynamic> json) {
    return ClerkBridgeSession(
      configured: json['configured'] == true,
      isSignedIn: json['isSignedIn'] == true,
      user: _userFromJson(json['user'] as Map<String, dynamic>?),
    );
  }

  ClerkBridgeUser? _userFromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final id = (json['id'] as String?)?.trim() ?? '';
    if (id.isEmpty) return null;
    final email = (json['email'] as String?)?.trim() ?? '';
    final displayName = (json['displayName'] as String?)?.trim();
    final imageUrl = (json['imageUrl'] as String?)?.trim();
    return ClerkBridgeUser(
      id: id,
      email: email,
      displayName: displayName == null || displayName.isEmpty
          ? null
          : displayName,
      imageUrl: imageUrl == null || imageUrl.isEmpty ? null : imageUrl,
    );
  }
}

ClerkJsBridge createBridgeImpl() => _WebClerkJsBridge();
