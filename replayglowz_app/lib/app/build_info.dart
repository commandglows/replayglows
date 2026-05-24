import 'package:flutter/foundation.dart';

const convexUrl = String.fromEnvironment('CONVEX_URL', defaultValue: '');

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

const sentryDebug = bool.fromEnvironment('SENTRY_DEBUG');

const buildCommitSha = String.fromEnvironment(
  'BUILD_COMMIT_SHA',
  defaultValue: 'unknown',
);

const buildEnvironment = String.fromEnvironment(
  'BUILD_ENVIRONMENT',
  defaultValue: 'unknown',
);

const buildTimestamp = String.fromEnvironment(
  'BUILD_TIMESTAMP',
  defaultValue: 'unknown',
);

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

String maskValue(String value, {int head = 10, int tail = 5}) {
  if (value.isEmpty) return '(missing)';
  if (value.length <= head + tail + 3) return value;
  return '${value.substring(0, head)}...${value.substring(value.length - tail)}';
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
