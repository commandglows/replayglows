import 'package:firebase_core/firebase_core.dart';

import 'package:replayglows_app/app/build_info.dart';

class FirebaseBootstrap {
  static const String projectIdEnvironmentName =
      FirebaseRuntimeConfig.projectIdEnvironmentName;
  static const String apiKeyEnvironmentName =
      FirebaseRuntimeConfig.apiKeyEnvironmentName;
  static const String appIdEnvironmentName =
      FirebaseRuntimeConfig.appIdEnvironmentName;
  static const String messagingSenderIdEnvironmentName =
      FirebaseRuntimeConfig.messagingSenderIdEnvironmentName;

  static bool _initialized = false;
  static String? _initError;

  static bool get isInitialized => _initialized;
  static bool get isConfigured =>
      hasFirebaseNativeConfig && _initialized && _initError == null;
  static String? get initError => _initError;

  static Future<void> initialise() async {
    if (_initialized) return;

    final config = firebaseRuntimeConfig;

    if (!config.isComplete) {
      _initialized = false;
      _initError =
          'Firebase runtime config missing: '
          '${config.missingEnvironmentNames.join(', ')}.';
      return;
    }

    try {
      if (Firebase.apps.isNotEmpty) {
        _initialized = true;
        _initError = null;
        return;
      }

      await Firebase.initializeApp(
        options: FirebaseOptions(
          projectId: config.projectId,
          apiKey: config.apiKey,
          appId: config.appId,
          messagingSenderId: config.messagingSenderId,
          authDomain: config.authDomain.isEmpty ? null : config.authDomain,
          storageBucket: config.storageBucket.isEmpty
              ? null
              : config.storageBucket,
        ),
      );
      _initialized = true;
      _initError = null;
    } catch (error) {
      _initialized = false;
      _initError = 'Firebase initialization failed: $error';
    }
  }
}
