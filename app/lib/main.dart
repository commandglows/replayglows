import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'package:replayglowz_app/app/build_info.dart';
import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/app/theme.dart';
import 'package:replayglowz_app/auth/auth_service.dart';
import 'package:replayglowz_app/convex/convex_client.dart';
import 'package:replayglowz_app/convex/convex_provider.dart';
import 'package:replayglowz_app/notifications/push_notification_service.dart';
import 'package:replayglowz_app/utils/app_logger.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (kIsWeb) {
    usePathUrlStrategy();
  } else {
    registerReplayGlowzBackgroundMessageHandler();
  }

  if (sentryDsn.isEmpty) {
    await _runApp();
    return;
  }

  await SentryFlutter.init((options) {
    options.dsn = sentryDsn;
    options.environment = sentryEnvironmentLabel();
    options.release = sentryReleaseLabel();
    options.sendDefaultPii = false;
    options.attachScreenshot = false;
    options.debug = sentryDebug;
    options.diagnosticLevel = sentryDebug
        ? SentryLevel.debug
        : SentryLevel.warning;
    if (sentryTracesSampleRate > 0) {
      options.tracesSampleRate = sentryTracesSampleRate;
    }
  }, appRunner: _runApp);
}

Future<void> _runApp() async {
  _installErrorHandlers();
  await _configureSentryScope();

  AppLogger.instance.log(
    sentryDsn.isEmpty
        ? 'Sentry disabled — SENTRY_DSN is empty'
        : 'Sentry initialised (environment=${sentryEnvironmentLabel()}, release=${sentryReleaseLabel()}, tracesSampleRate=$sentryTracesSampleRate)',
    source: 'Sentry',
    level: sentryDsn.isEmpty ? LogLevel.warning : LogLevel.info,
    reportToSentry: false,
  );

  AppLogger.instance.log(
    'main() start — CONVEX_URL=${const bool.hasEnvironment('CONVEX_URL')} '
    'has_auth_config=$hasAuthConfig '
    'BUILD_ID=$buildId '
    'BUILD_COMMIT_SHA=$buildCommitSha '
    'BUILD_ENVIRONMENT=$buildEnvironment',
    source: 'main',
  );

  if (convexUrl.isNotEmpty) {
    try {
      await ConvexService.initialize(convexUrl);
      AppLogger.instance.log('ConvexService initialised', source: 'main');
    } catch (e, st) {
      AppLogger.instance.log(
        'ConvexService.initialize failed',
        source: 'main',
        level: LogLevel.error,
        error: e,
        stackTrace: st,
      );
    }
  } else {
    AppLogger.instance.log(
      'CONVEX_URL empty — skipping Convex init',
      source: 'main',
      level: LogLevel.warning,
    );
  }

  runApp(const ProviderScope(child: _AppBootstrap()));
}

void _installErrorHandlers() {
  final previousFlutterError = FlutterError.onError;
  FlutterError.onError = (FlutterErrorDetails details) {
    AppLogger.instance.log(
      details.summary.toString(),
      source: 'FlutterError',
      level: LogLevel.error,
      error: details.exception,
      stackTrace: details.stack,
      reportToSentry: false,
    );
    if (previousFlutterError != null) {
      previousFlutterError(details);
    } else {
      FlutterError.presentError(details);
    }
  };

  final previousPlatformError = PlatformDispatcher.instance.onError;
  PlatformDispatcher.instance.onError = (error, stack) {
    AppLogger.instance.log(
      'Uncaught platform error',
      source: 'PlatformDispatcher',
      level: LogLevel.error,
      error: error,
      stackTrace: stack,
      reportToSentry: false,
    );
    return previousPlatformError?.call(error, stack) ?? true;
  };
}

Future<void> _configureSentryScope() async {
  if (sentryDsn.isEmpty) return;

  await Sentry.configureScope((scope) async {
    await scope.setTag('build_commit', buildCommitSha);
    await scope.setTag('build_environment', buildEnvironment);
    await scope.setTag('build_mode', buildModeLabel());
    await scope.setContexts('replayglowz_build', {
      'commit': buildCommitSha,
      'environment': buildEnvironment,
      'timestamp': buildTimestamp,
      'mode': buildModeLabel(),
      'app_url_host': hostForUrl(replayGlowzAppUrl),
      'has_auth_config': hasAuthConfig,
      'has_clerk_config': hasClerkConfig,
      'has_native_firebase_config': hasFirebaseNativeConfig,
      'product_id': replayGlowzProductId,
      'sentry_traces_sample_rate': sentryTracesSampleRate,
    });
    if (kIsWeb) {
      await scope.setTag('current_host', Uri.base.host);
      await scope.setContexts('replayglowz_web', {
        'origin': Uri.base.origin,
        'path': Uri.base.path,
        'fragment_path': Uri.base.fragment,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Bootstrap widget
// ---------------------------------------------------------------------------

/// This is a separate [ConsumerStatefulWidget] so that the auth service is
/// created (and begins restoring a persisted session) on the very first frame,
/// and the Convex client gets its token provider as soon as both services
/// exist.
/// Eagerly initialises the active auth owner (Clerk web or native Firebase)
/// and wires the Convex auth token before building the main application widget.
class _AppBootstrap extends ConsumerStatefulWidget {
  const _AppBootstrap();

  @override
  ConsumerState<_AppBootstrap> createState() => _AppBootstrapState();
}

class _AppBootstrapState extends ConsumerState<_AppBootstrap> {
  String? _bootstrapError;

  bool get _hasConvexConfig => convexUrl.isNotEmpty;

  bool get _hasAuthConfig => hasAuthConfig;

  @override
  void initState() {
    super.initState();
    // Defer to the first frame so Riverpod providers are accessible.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _bootstrap();
    });
  }

  Future<void> _bootstrap() async {
    AppLogger.instance.log(
      'bootstrap() start — hasConvex=$_hasConvexConfig hasAuth=$_hasAuthConfig',
      source: 'bootstrap',
    );
    try {
      if (_hasConvexConfig && _hasAuthConfig) {
        final auth = ref.read(authServiceProvider);
        await auth.ready;
        AppLogger.instance.log(
          hasAuthConfig
              ? 'Auth ready (isInitialised=${auth.isInitialised})'
              : 'Auth unavailable because native/web auth config is missing',
          source: 'bootstrap',
        );
        final convex = ref.read(convexServiceProvider);
        await convex.setAuth(() => auth.getConvexToken());
        AppLogger.instance.log('Convex auth wired', source: 'bootstrap');
        await ref.read(pushNotificationServiceProvider).initialize();
        if (auth.isAuthenticated) {
          final convexAuthReady = await auth.waitForConvexTokenReady();
          AppLogger.instance.log(
            convexAuthReady
                ? 'Convex auth ready for ${auth.currentUser?.id ?? 'signed-in user'}'
                : 'Convex auth not fully ready yet; guarded providers will use '
                      'local fallbacks until auth token minting catches up',
            source: 'bootstrap',
            level: convexAuthReady ? LogLevel.info : LogLevel.warning,
          );
        }
      } else {
        AppLogger.instance.log(
          'Skipping auth/Convex wiring — missing env vars',
          source: 'bootstrap',
          level: LogLevel.warning,
        );
      }
    } catch (e, st) {
      AppLogger.instance.log(
        'Bootstrap failed',
        source: 'bootstrap',
        level: LogLevel.error,
        error: e,
        stackTrace: st,
      );
      _bootstrapError = '$e';
    }

    if (mounted) {
      setState(() {});
      AppLogger.instance.log('bootstrap() complete', source: 'bootstrap');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_bootstrapError != null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.system,
        home: _ConfigFallbackScreen(
          hasConvexConfig: _hasConvexConfig,
          hasAuthConfig: _hasAuthConfig,
          bootstrapError: _bootstrapError,
        ),
      );
    }

    return const ReplayGlowzApp();
  }
}

class _ConfigFallbackScreen extends StatelessWidget {
  const _ConfigFallbackScreen({
    required this.hasConvexConfig,
    required this.hasAuthConfig,
    this.bootstrapError,
  });

  final bool hasConvexConfig;
  final bool hasAuthConfig;
  final String? bootstrapError;

  Future<void> _copyDiagnostics(BuildContext context) async {
    final lines = <String>[
      ...buildIdentityHeader(),
      'ReplayGlowz bootstrap diagnostics',
      'Build id: $buildId',
      'Build commit: $buildCommitSha',
      'Build environment: $buildEnvironment',
      'Build timestamp: $buildTimestamp',
      'Build mode: ${buildModeLabel()}',
      'Current URL: ${kIsWeb ? Uri.base.toString() : 'not-web'}',
      'Current host: ${kIsWeb ? Uri.base.host : 'not-web'}',
      'CONVEX_URL: ${convexUrl.isNotEmpty ? convexUrl : '(missing)'}',
      'Auth owner: ${authConfigOwnerLabel()}',
      'CLERK_PUBLISHABLE_KEY: ${clerkPublishableKeyStatusLabel()}',
      'FIREBASE_PROJECT_ID: ${firebaseProjectId.isNotEmpty ? maskValue(firebaseProjectId) : '(missing)'}',
      'FIREBASE_DEV_API_KEY: ${firebaseDevApiKey.isNotEmpty ? maskValue(firebaseDevApiKey) : '(missing)'}',
      'FIREBASE_DEV_APP_ID: ${firebaseDevAppId.isNotEmpty ? maskValue(firebaseDevAppId) : '(missing)'}',
      'FIREBASE_DEV_MESSAGING_SENDER_ID: ${firebaseDevMessagingSenderId.isNotEmpty ? maskValue(firebaseDevMessagingSenderId) : '(missing)'}',
      'FIREBASE_DEV_AUTH_DOMAIN: ${firebaseDevAuthDomain.isNotEmpty ? firebaseDevAuthDomain : '(missing)'}',
      'FIREBASE_DEV_STORAGE_BUCKET: ${firebaseDevStorageBucket.isNotEmpty ? firebaseDevStorageBucket : '(missing)'}',
      'SUITE_IDENTITY_BRIDGE_URL: ${trimmedSuiteIdentityBridgeUrl.isNotEmpty ? trimmedSuiteIdentityBridgeUrl : '(missing)'}',
      'CLERK_SIGN_IN_URL: $clerkSignInUrl',
      'CLERK_SIGN_UP_URL: $clerkSignUpUrl',
      'REPLAYGLOWZ_PRODUCT_ID: $replayGlowzProductId',
      'REPLAYGLOWZ_LEGACY_PRODUCT_IDS: $replayGlowzLegacyProductIds',
      'REPLAYGLOWZ_ACCOUNT_CENTER_URL: $replayGlowzAccountCenterUrl',
      'REPLAYGLOWZ_APP_URL: ${replayGlowzAppUrl.isNotEmpty ? replayGlowzAppUrl : '(missing)'}',
      'REPLAYGLOWZ_APP_URL host match: ${hostMatchLabel(replayGlowzAppUrl)}',
      'SENTRY: ${sentryStatusLabel()}',
      'Bootstrap error: ${bootstrapError ?? 'none'}',
      '',
      'Recent logs:',
      AppLogger.instance.formatAll(),
    ];

    await Clipboard.setData(ClipboardData(text: lines.join('\n')));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Bootstrap diagnostics copied.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final missing = <String>[
      if (!hasConvexConfig) 'CONVEX_URL',
      if (!hasAuthConfig && kIsWeb) 'CLERK_PUBLISHABLE_KEY',
      if (!hasAuthConfig && !kIsWeb) ...missingFirebaseNativeEnvironmentNames,
    ];

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(
                            Icons.settings_rounded,
                            size: AppSizes.navigationIcon,
                          ),
                          SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              'ReplayGlowz bootstrap failed',
                              style: TextStyle(
                                fontSize: AppTypography.titleLarge,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        missing.isEmpty
                            ? 'The app started, but bootstrap failed.'
                            : 'This build succeeded, but the app is running in '
                                  'fallback mode because required environment '
                                  'variables are missing.',
                      ),
                      if (missing.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          'Missing variables: ${missing.join(', ')}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.sm),
                      const SelectableText(
                        kIsWeb
                            ? 'Set these at build time with --dart-define or '
                                  'web project environment variables.'
                            : 'Set these at build time with --dart-define in '
                                  'the Android CI workflow secrets.',
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      OutlinedButton.icon(
                        onPressed: () => _copyDiagnostics(context),
                        icon: const Icon(Icons.copy, size: AppSizes.iconSmall),
                        label: const Text('Copy diagnostics'),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      SelectableText(
                        '${buildIdentityHeader().join('\n')}\n'
                        'Build id: $buildId\n'
                        'Build commit: $buildCommitSha\n'
                        'Build environment: $buildEnvironment\n'
                        'Build timestamp: $buildTimestamp\n'
                        'Build mode: ${buildModeLabel()}\n'
                        'Current URL: ${kIsWeb ? Uri.base.toString() : 'not-web'}\n'
                        'CONVEX_URL: ${convexUrl.isNotEmpty ? convexUrl : '(missing)'}\n'
                        'Auth owner: ${authConfigOwnerLabel()}\n'
                        'CLERK_PUBLISHABLE_KEY: ${clerkPublishableKeyStatusLabel()}\n'
                        'FIREBASE_PROJECT_ID: ${firebaseProjectId.isNotEmpty ? maskValue(firebaseProjectId) : '(missing)'}\n'
                        'FIREBASE_DEV_API_KEY: ${firebaseDevApiKey.isNotEmpty ? maskValue(firebaseDevApiKey) : '(missing)'}\n'
                        'FIREBASE_DEV_APP_ID: ${firebaseDevAppId.isNotEmpty ? maskValue(firebaseDevAppId) : '(missing)'}\n'
                        'FIREBASE_DEV_MESSAGING_SENDER_ID: ${firebaseDevMessagingSenderId.isNotEmpty ? maskValue(firebaseDevMessagingSenderId) : '(missing)'}\n'
                        'FIREBASE_DEV_AUTH_DOMAIN: ${firebaseDevAuthDomain.isNotEmpty ? firebaseDevAuthDomain : '(missing)'}\n'
                        'FIREBASE_DEV_STORAGE_BUCKET: ${firebaseDevStorageBucket.isNotEmpty ? firebaseDevStorageBucket : '(missing)'}\n'
                        'SUITE_IDENTITY_BRIDGE_URL: ${trimmedSuiteIdentityBridgeUrl.isNotEmpty ? trimmedSuiteIdentityBridgeUrl : '(missing)'}\n'
                        'CLERK_SIGN_IN_URL: $clerkSignInUrl\n'
                        'CLERK_SIGN_UP_URL: $clerkSignUpUrl\n'
                        'REPLAYGLOWZ_PRODUCT_ID: $replayGlowzProductId\n'
                        'REPLAYGLOWZ_LEGACY_PRODUCT_IDS: $replayGlowzLegacyProductIds\n'
                        'REPLAYGLOWZ_ACCOUNT_CENTER_URL: $replayGlowzAccountCenterUrl\n'
                        'REPLAYGLOWZ_APP_URL: ${replayGlowzAppUrl.isNotEmpty ? replayGlowzAppUrl : '(missing)'}\n'
                        'REPLAYGLOWZ_APP_URL host match: ${hostMatchLabel(replayGlowzAppUrl)}\n'
                        'SENTRY: ${sentryStatusLabel()}',
                      ),
                      if (bootstrapError != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        SelectableText(
                          'Bootstrap error: $bootstrapError',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        OutlinedButton.icon(
                          onPressed: () => copyErrorToClipboard(
                            context,
                            bootstrapError!,
                            prefix: 'Bootstrap error',
                          ),
                          icon: const Icon(
                            Icons.copy,
                            size: AppSizes.iconSmall,
                          ),
                          label: Text(
                            Localizations.localeOf(context).languageCode == 'fr'
                                ? 'Copier'
                                : 'Copy',
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Root application widget
// ---------------------------------------------------------------------------

/// Root application widget.
///
/// Wraps the entire app in [MaterialApp.router] with GoRouter navigation,
/// Riverpod state management, and light/dark/system theme support.
///
/// Auth state changes from [authStateProvider] trigger router redirects so
/// the user is automatically sent to the sign-in screen when unauthenticated
/// and back to the main app when authenticated.
class ReplayGlowzApp extends ConsumerWidget {
  const ReplayGlowzApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'ReplayGlowz',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
