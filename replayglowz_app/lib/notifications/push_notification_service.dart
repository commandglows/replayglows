import 'dart:async';
import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:replayglowz_app/app/build_info.dart';
import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/auth/auth_service.dart';
import 'package:replayglowz_app/auth/firebase_bootstrap.dart';
import 'package:replayglowz_app/convex/convex_provider.dart';
import 'package:replayglowz_app/providers/mutations.dart';
import 'package:replayglowz_app/utils/app_logger.dart';

const _transcriptReadyChannel = AndroidNotificationChannel(
  'replayglowz_transcript_ready',
  'Transcript ready',
  description: 'Transcript generation is complete.',
  importance: Importance.high,
);

const _newVideosChannel = AndroidNotificationChannel(
  'replayglowz_new_videos',
  'New videos',
  description: 'New videos from selected ReplayGlowz feeds and sources.',
  importance: Importance.defaultImportance,
);

const _systemChannel = AndroidNotificationChannel(
  'replayglowz_system',
  'System',
  description: 'Account, sync, and service notifications.',
  importance: Importance.defaultImportance,
);

final pushNotificationServiceProvider = Provider<PushNotificationService>((
  ref,
) {
  final service = PushNotificationService(ref);
  ref.onDispose(service.dispose);
  return service;
});

@pragma('vm:entry-point')
Future<void> replayGlowzFirebaseMessagingBackgroundHandler(
  RemoteMessage message,
) async {
  if (kIsWeb) return;
  await FirebaseBootstrap.initialise();
  AppLogger.instance.log(
    'Received background push message ${message.messageId ?? '(no id)'}',
    source: 'PushNotifications',
  );
}

void registerReplayGlowzBackgroundMessageHandler() {
  if (kIsWeb) return;
  FirebaseMessaging.onBackgroundMessage(
    replayGlowzFirebaseMessagingBackgroundHandler,
  );
}

class PushNotificationService {
  PushNotificationService(this._ref);

  final Ref _ref;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;
  StreamSubscription<String>? _tokenRefreshSubscription;

  bool get _isAndroid =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  Future<void> initialize() async {
    if (_initialized || !_isAndroid) return;
    _initialized = true;

    await FirebaseBootstrap.initialise();
    if (!FirebaseBootstrap.isConfigured) {
      AppLogger.instance.log(
        'Push notifications skipped: ${FirebaseBootstrap.initError ?? 'Firebase is not configured'}',
        source: 'PushNotifications',
        level: LogLevel.warning,
      );
      return;
    }

    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const initializationSettings = InitializationSettings(
      android: androidSettings,
    );

    await _localNotifications.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (response) {
        _openPayload(response.payload);
      },
    );

    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await androidPlugin?.createNotificationChannel(_transcriptReadyChannel);
    await androidPlugin?.createNotificationChannel(_newVideosChannel);
    await androidPlugin?.createNotificationChannel(_systemChannel);

    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    FirebaseMessaging.onMessageOpenedApp.listen(_openMessage);
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _openMessage(initialMessage);
    }

    _tokenRefreshSubscription = FirebaseMessaging.instance.onTokenRefresh
        .listen(_registerRefreshedToken);
  }

  Future<bool> requestPermissionAndRegister() async {
    if (!_isAndroid) return false;
    await initialize();
    if (!FirebaseBootstrap.isConfigured) return false;

    final permission = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    final androidPermission = await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.requestNotificationsPermission();

    final firebaseGranted =
        permission.authorizationStatus == AuthorizationStatus.authorized ||
        permission.authorizationStatus == AuthorizationStatus.provisional;
    final androidGranted = androidPermission ?? true;
    if (!firebaseGranted || !androidGranted) {
      AppLogger.instance.log(
        'Push permission denied (firebase=${permission.authorizationStatus}, android=$androidPermission)',
        source: 'PushNotifications',
        level: LogLevel.warning,
      );
      return false;
    }

    final token = await FirebaseMessaging.instance.getToken();
    if (token == null || token.isEmpty) {
      AppLogger.instance.log(
        'Push permission granted but FCM token is empty',
        source: 'PushNotifications',
        level: LogLevel.warning,
      );
      return false;
    }

    await _registerToken(token);
    return true;
  }

  Future<void> unregisterCurrentDevice() async {
    if (!_isAndroid || !FirebaseBootstrap.isConfigured) return;
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null || token.isEmpty) return;
    await deactivatePushDevice(_ref, token: token);
  }

  void dispose() {
    unawaited(_tokenRefreshSubscription?.cancel());
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ?? _stringData(message, 'title');
    final body = notification?.body ?? _stringData(message, 'body');
    if ((title == null || title.isEmpty) && (body == null || body.isEmpty)) {
      return;
    }

    final channel = _channelForMessage(message);
    await _localNotifications.show(
      id: message.messageId.hashCode,
      title: title ?? 'ReplayGlowz',
      body: body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          channel.id,
          channel.name,
          channelDescription: channel.description,
          importance: channel.importance,
          priority: channel.importance == Importance.high
              ? Priority.high
              : Priority.defaultPriority,
        ),
      ),
      payload: _payloadForMessage(message),
    );
  }

  Future<void> _registerRefreshedToken(String token) async {
    final auth = _ref.read(authServiceProvider);
    if (!auth.isAuthenticated) return;
    await _registerToken(token);
  }

  Future<void> _registerToken(String token) {
    return registerPushDevice(_ref, token: token, appVersion: buildId);
  }

  void _openMessage(RemoteMessage message) {
    unawaited(_openPayload(_payloadForMessage(message)));
  }

  Future<void> _openPayload(String? payload) async {
    if (payload == null || payload.isEmpty) return;

    final parsed = _parsePayload(payload);
    final route = parsed['route'];
    final notificationId = parsed['notificationId'];
    if (route == null || route.isEmpty) return;

    if (notificationId != null && notificationId.isNotEmpty) {
      unawaited(_markNotificationRead(notificationId));
    }

    final context = rootNavigatorKey.currentContext;
    if (context == null || !context.mounted) {
      AppLogger.instance.log(
        'Push route ignored; navigator context is not ready: $route',
        source: 'PushNotifications',
        level: LogLevel.warning,
      );
      return;
    }
    context.go(route);
  }

  Future<void> _markNotificationRead(String notificationId) async {
    try {
      await _ref.read(convexServiceProvider).mutate<dynamic>(
        'notifications:markAsRead',
        {'notificationId': notificationId},
      );
    } catch (error) {
      AppLogger.instance.log(
        'Failed to mark push notification as read: $error',
        source: 'PushNotifications',
        level: LogLevel.warning,
      );
    }
  }

  String? _routeForMessage(RemoteMessage message) {
    final rawRoute = _stringData(message, 'route');
    if (rawRoute != null && rawRoute.isNotEmpty) {
      if (rawRoute == Routes.play) {
        final videoId = _stringData(message, 'youtubeVideoId');
        if (videoId == null || videoId.isEmpty) {
          return Routes.notifications;
        }
        return Uri(
          path: Routes.play,
          queryParameters: {'videoId': videoId, 'autoPlay': '0'},
        ).toString();
      }
      if (rawRoute == 'play') {
        final videoId = _stringData(message, 'youtubeVideoId');
        if (videoId == null || videoId.isEmpty) {
          return Routes.notifications;
        }
        return Uri(
          path: Routes.play,
          queryParameters: {'videoId': videoId, 'autoPlay': '0'},
        ).toString();
      }
      if (rawRoute == Routes.notifications || rawRoute == 'notifications') {
        return Routes.notifications;
      }
      if (rawRoute.startsWith('/')) {
        return rawRoute;
      }
      return '/$rawRoute';
    }

    final videoId = _stringData(message, 'youtubeVideoId');
    if (videoId != null && videoId.isNotEmpty) {
      return Uri(
        path: Routes.play,
        queryParameters: {'videoId': videoId, 'autoPlay': '0'},
      ).toString();
    }
    return null;
  }

  String? _payloadForMessage(RemoteMessage message) {
    final route = _routeForMessage(message);
    if (route == null || route.isEmpty) return null;
    final notificationId = _stringData(message, 'notificationId');
    if (notificationId == null || notificationId.isEmpty) {
      return route;
    }

    return jsonEncode({
      'route': route,
      'notificationId': notificationId,
    });
  }

  Map<String, String?> _parsePayload(String payload) {
    if (!payload.startsWith('{')) {
      return {'route': payload, 'notificationId': null};
    }

    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map<String, dynamic>) {
        final routeValue = decoded['route'];
        final notificationIdValue = decoded['notificationId'];
        return {
          'route':
              routeValue is String && routeValue.isNotEmpty
                  ? routeValue
                  : null,
          'notificationId': notificationIdValue is String
              ? notificationIdValue
              : null,
        };
      }
    } catch (_) {
      // Keep default fallback behavior for unexpected payload formats.
    }

    return {'route': payload, 'notificationId': null};
  }

  AndroidNotificationChannel _channelForMessage(RemoteMessage message) {
    switch (_stringData(message, 'type')) {
      case 'transcript_ready':
        return _transcriptReadyChannel;
      case 'new_video':
        return _newVideosChannel;
      case 'system':
      default:
        return _systemChannel;
    }
  }

  String? _stringData(RemoteMessage message, String key) {
    final value = message.data[key];
    if (value == null) return null;
    final text = value.toString();
    if (text.isEmpty) return null;
    return text;
  }
}
