import 'package:flutter/foundation.dart';

const convexUrl = String.fromEnvironment('CONVEX_URL', defaultValue: '');

const firebaseProjectId = String.fromEnvironment(
  'FIREBASE_PROJECT_ID',
  defaultValue: '',
);

const firebaseDevApiKey = String.fromEnvironment(
  'FIREBASE_DEV_API_KEY',
  defaultValue: '',
);

const firebaseDevAppId = String.fromEnvironment(
  'FIREBASE_DEV_APP_ID',
  defaultValue: '',
);

const firebaseDevMessagingSenderId = String.fromEnvironment(
  'FIREBASE_DEV_MESSAGING_SENDER_ID',
  defaultValue: '',
);

const firebaseDevAuthDomain = String.fromEnvironment(
  'FIREBASE_DEV_AUTH_DOMAIN',
  defaultValue: '',
);

const firebaseDevStorageBucket = String.fromEnvironment(
  'FIREBASE_DEV_STORAGE_BUCKET',
  defaultValue: '',
);

const firebaseWebClientId = String.fromEnvironment(
  'FIREBASE_WEB_CLIENT_ID',
  defaultValue: '',
);

const clerkPublishableKey = String.fromEnvironment(
  'CLERK_PUBLISHABLE_KEY',
  defaultValue: '',
);

const clerkSignInUrl = String.fromEnvironment(
  'CLERK_SIGN_IN_URL',
  defaultValue: '/sign-in',
);

const clerkSignUpUrl = String.fromEnvironment(
  'CLERK_SIGN_UP_URL',
  defaultValue: '/sign-up',
);

const replayGlowzProductId = String.fromEnvironment(
  'REPLAYGLOWZ_PRODUCT_ID',
  defaultValue: 'replayglowz',
);

const replayGlowzLegacyProductIds = String.fromEnvironment(
  'REPLAYGLOWZ_LEGACY_PRODUCT_IDS',
  defaultValue: 'tubeflow',
);

const replayGlowzAccountCenterUrl = String.fromEnvironment(
  'REPLAYGLOWZ_ACCOUNT_CENTER_URL',
  defaultValue: 'https://winflows.com/account',
);

const replayGlowzAppUrl = String.fromEnvironment(
  'REPLAYGLOWZ_APP_URL',
  defaultValue: '',
);

const sentryDsn = String.fromEnvironment('SENTRY_DSN', defaultValue: '');

const sentryEnvironment = String.fromEnvironment(
  'SENTRY_ENVIRONMENT',
  defaultValue: '',
);

const sentryRelease = String.fromEnvironment(
  'SENTRY_RELEASE',
  defaultValue: '',
);

const sentryTracesSampleRateRaw = String.fromEnvironment(
  'SENTRY_TRACES_SAMPLE_RATE',
  defaultValue: '0',
);

const suiteIdentityBridgeUrl = String.fromEnvironment(
  'SUITE_IDENTITY_BRIDGE_URL',
  defaultValue: '',
);

const sentryDebug = bool.fromEnvironment('SENTRY_DEBUG');

const buildCommitSha = String.fromEnvironment(
  'BUILD_COMMIT_SHA',
  defaultValue: 'unknown',
);

const buildId = String.fromEnvironment('BUILD_ID', defaultValue: 'unknown');

const buildEnvironment = String.fromEnvironment(
  'BUILD_ENVIRONMENT',
  defaultValue: 'unknown',
);

const buildTimestamp = String.fromEnvironment(
  'BUILD_TIMESTAMP',
  defaultValue: 'unknown',
);

const buildAtParis = String.fromEnvironment(
  'BUILD_AT_PARIS',
  defaultValue: 'unknown',
);

const buildAtUtc = String.fromEnvironment(
  'BUILD_AT_UTC',
  defaultValue: buildTimestamp,
);

String buildIdentityValue() {
  if (buildId.isNotEmpty && buildId != 'unknown') {
    return buildId;
  }
  return buildCommitSha;
}

List<String> buildIdentityHeader() {
  return <String>[
    'commit/build: ${buildIdentityValue()}',
    'build_at_paris: $buildAtParis',
    'build_at_utc: $buildAtUtc',
  ];
}

String buildModeLabel() {
  if (kReleaseMode) return 'release';
  if (kProfileMode) return 'profile';
  return 'debug';
}

String sentryEnvironmentLabel() {
  if (sentryEnvironment.isNotEmpty) return sentryEnvironment;
  if (buildEnvironment.isNotEmpty && buildEnvironment != 'unknown') {
    return buildEnvironment;
  }
  return buildModeLabel();
}

String sentryReleaseLabel() {
  if (sentryRelease.isNotEmpty) return sentryRelease;
  return 'replayglowz_app@$buildCommitSha';
}

double get sentryTracesSampleRate =>
    double.tryParse(sentryTracesSampleRateRaw) ?? 0;

String sentryStatusLabel() {
  if (sentryDsn.isEmpty) return 'disabled';
  final traces = sentryTracesSampleRate > 0
      ? sentryTracesSampleRate.toString()
      : 'off';
  return 'enabled (environment=${sentryEnvironmentLabel()}, release=${sentryReleaseLabel()}, traces=$traces)';
}

bool get hasClerkConfig => clerkPublishableKey.isNotEmpty;

bool get requiresClerkConfig => kIsWeb;

String authConfigOwnerLabel() => kIsWeb ? 'Clerk web' : 'Firebase native';

String maskValue(String value, {int head = 10, int tail = 5}) {
  if (value.isEmpty) return '(missing)';
  if (value.length <= head + tail + 3) return value;
  return '${value.substring(0, head)}...${value.substring(value.length - tail)}';
}

String clerkPublishableKeyStatusLabel() {
  if (!requiresClerkConfig) return 'not required on native';
  return maskValue(clerkPublishableKey);
}

String hostForUrl(String value) {
  final uri = Uri.tryParse(value);
  if (uri == null || uri.host.isEmpty) {
    return 'invalid';
  }
  return uri.host;
}

String hostMatchLabel(String value) {
  if (!kIsWeb) {
    return 'not-web';
  }
  final host = hostForUrl(value);
  if (host == 'invalid') {
    return 'invalid';
  }
  return host == Uri.base.host ? 'yes' : 'no (expected $host)';
}

class FirebaseRuntimeConfig {
  const FirebaseRuntimeConfig({
    required this.projectId,
    required this.apiKey,
    required this.appId,
    required this.messagingSenderId,
    required this.authDomain,
    required this.storageBucket,
    required this.missingEnvironmentNames,
  });

  final String projectId;
  final String apiKey;
  final String appId;
  final String messagingSenderId;
  final String authDomain;
  final String storageBucket;
  final List<String> missingEnvironmentNames;

  bool get isComplete => missingEnvironmentNames.isEmpty;

  static const String projectIdEnvironmentName = 'FIREBASE_PROJECT_ID';
  static const String apiKeyEnvironmentName = 'FIREBASE_DEV_API_KEY';
  static const String appIdEnvironmentName = 'FIREBASE_DEV_APP_ID';
  static const String messagingSenderIdEnvironmentName =
      'FIREBASE_DEV_MESSAGING_SENDER_ID';
  static const String authDomainEnvironmentName = 'FIREBASE_DEV_AUTH_DOMAIN';
  static const String storageBucketEnvironmentName =
      'FIREBASE_DEV_STORAGE_BUCKET';

  static FirebaseRuntimeConfig resolve({
    required String projectId,
    required String apiKey,
    required String appId,
    required String messagingSenderId,
    required String authDomain,
    required String storageBucket,
  }) {
    final normalizedProjectId = projectId.trim();
    final normalizedApiKey = apiKey.trim();
    final normalizedAppId = appId.trim();
    final normalizedMessagingSenderId = messagingSenderId.trim();
    final normalizedAuthDomain = authDomain.trim();
    final normalizedStorageBucket = storageBucket.trim();

    return FirebaseRuntimeConfig(
      projectId: normalizedProjectId,
      apiKey: normalizedApiKey,
      appId: normalizedAppId,
      messagingSenderId: normalizedMessagingSenderId,
      authDomain: normalizedAuthDomain,
      storageBucket: normalizedStorageBucket,
      missingEnvironmentNames: [
        if (normalizedProjectId.isEmpty) projectIdEnvironmentName,
        if (normalizedApiKey.isEmpty) apiKeyEnvironmentName,
        if (normalizedAppId.isEmpty) appIdEnvironmentName,
        if (normalizedMessagingSenderId.isEmpty)
          messagingSenderIdEnvironmentName,
      ],
    );
  }
}

FirebaseRuntimeConfig get firebaseRuntimeConfig =>
    FirebaseRuntimeConfig.resolve(
      projectId: firebaseProjectId,
      apiKey: firebaseDevApiKey,
      appId: firebaseDevAppId,
      messagingSenderId: firebaseDevMessagingSenderId,
      authDomain: firebaseDevAuthDomain,
      storageBucket: firebaseDevStorageBucket,
    );

bool get hasFirebaseNativeConfig => !kIsWeb && firebaseRuntimeConfig.isComplete;

bool get hasSuiteIdentityBridgeUrl => suiteIdentityBridgeUrl.trim().isNotEmpty;

bool get hasNativeAuthConfig => !kIsWeb && hasFirebaseNativeConfig;

bool get hasAuthConfig => kIsWeb ? hasClerkConfig : hasNativeAuthConfig;

String get trimmedSuiteIdentityBridgeUrl => suiteIdentityBridgeUrl.trim();

List<String> get missingFirebaseNativeEnvironmentNames =>
    firebaseRuntimeConfig.missingEnvironmentNames;
