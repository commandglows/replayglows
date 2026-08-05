import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

enum WebYoutubePlaybackState {
  unstarted,
  ended,
  playing,
  paused,
  buffering,
  cued,
  unknown,
}

class WebYoutubePlayerSnapshot {
  const WebYoutubePlayerSnapshot({
    this.isReady = false,
    this.currentSeconds = 0,
    this.durationSeconds = 0,
    this.playbackRate = 1,
    this.playbackState = WebYoutubePlaybackState.unstarted,
    this.errorCode,
  });

  final bool isReady;
  final double currentSeconds;
  final double durationSeconds;
  final double playbackRate;
  final WebYoutubePlaybackState playbackState;
  final int? errorCode;

  bool get isPlaying => playbackState == WebYoutubePlaybackState.playing;
  bool get hasEnded => playbackState == WebYoutubePlaybackState.ended;

  WebYoutubePlayerSnapshot copyWith({
    bool? isReady,
    double? currentSeconds,
    double? durationSeconds,
    double? playbackRate,
    WebYoutubePlaybackState? playbackState,
    int? errorCode,
    bool clearError = false,
  }) {
    return WebYoutubePlayerSnapshot(
      isReady: isReady ?? this.isReady,
      currentSeconds: currentSeconds ?? this.currentSeconds,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      playbackRate: playbackRate ?? this.playbackRate,
      playbackState: playbackState ?? this.playbackState,
      errorCode: clearError ? null : (errorCode ?? this.errorCode),
    );
  }
}

class WebYoutubePlayerController {
  _WebYoutubeEmbedState? _state;

  bool get isAttached => _state != null;

  void play() => _state?._play();

  void pause() => _state?._pause();

  void seekTo(double seconds) => _state?._seekTo(seconds);

  void setPlaybackRate(double rate) => _state?._setPlaybackRate(rate);

  void requestSync() => _state?._requestSync();

  void _attach(_WebYoutubeEmbedState state) {
    _state = state;
  }

  void _detach(_WebYoutubeEmbedState state) {
    if (identical(_state, state)) {
      _state = null;
    }
  }
}

class WebYoutubeEmbed extends StatefulWidget {
  const WebYoutubeEmbed({
    super.key,
    required this.videoId,
    this.onReady,
    this.onStateChanged,
    this.controller,
  });

  final String videoId;
  final VoidCallback? onReady;
  final ValueChanged<WebYoutubePlayerSnapshot>? onStateChanged;
  final WebYoutubePlayerController? controller;

  @override
  State<WebYoutubeEmbed> createState() => _WebYoutubeEmbedState();
}

class _WebYoutubeEmbedState extends State<WebYoutubeEmbed> {
  static const _youtubeOrigin = 'https://www.youtube.com';
  static const _youtubeNoCookieOrigin = 'https://www.youtube-nocookie.com';

  late final String _viewType;
  late final String _playerId;
  late final web.HTMLIFrameElement _iframe;
  late final JSFunction _windowMessageListener;
  late final JSFunction _iframeLoadListener;

  WebYoutubePlayerSnapshot _snapshot = const WebYoutubePlayerSnapshot();
  Timer? _pollTimer;
  bool _listeningMessageSent = false;
  bool _readyCallbackFired = false;

  @override
  void initState() {
    super.initState();
    final nonce = DateTime.now().microsecondsSinceEpoch;
    _viewType = 'replayglows-youtube-$nonce-${widget.videoId}';
    _playerId = 'replayglows-player-$nonce';
    _iframe = web.HTMLIFrameElement()
      ..id = _playerId
      ..tabIndex = -1
      ..allow =
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      ..allowFullscreen = false;
    _iframe.style
      ..setProperty('border', '0')
      ..setProperty('width', '100%')
      ..setProperty('height', '100%');
    _setSource(widget.videoId);

    ui_web.platformViewRegistry.registerViewFactory(
      _viewType,
      (int viewId) => _iframe,
    );

    _windowMessageListener = ((web.Event event) {
      if (event.type != 'message') {
        return;
      }
      _handleWindowMessage(event as web.MessageEvent);
    }).toJS;
    web.window.addEventListener('message', _windowMessageListener);

    _iframeLoadListener = ((web.Event event) {
      _sendListeningHandshake();
      _startPolling();
    }).toJS;
    _iframe.addEventListener('load', _iframeLoadListener);

    widget.controller?._attach(this);
  }

  @override
  void didUpdateWidget(covariant WebYoutubeEmbed oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (!identical(oldWidget.controller, widget.controller)) {
      oldWidget.controller?._detach(this);
      widget.controller?._attach(this);
    }

    if (oldWidget.videoId != widget.videoId) {
      _readyCallbackFired = false;
      _listeningMessageSent = false;
      _snapshot = const WebYoutubePlayerSnapshot();
      _emitSnapshot(_snapshot);
      _setSource(widget.videoId);
    }
  }

  void _setSource(String videoId) {
    final safeVideoId = Uri.encodeComponent(videoId);
    final origin = Uri.encodeQueryComponent(Uri.base.origin);
    final safePlayerId = Uri.encodeQueryComponent(_playerId);
    _iframe.src =
        'https://www.youtube.com/embed/$safeVideoId'
        '?enablejsapi=1'
        '&controls=0'
        '&disablekb=1'
        '&fs=0'
        '&iv_load_policy=3'
        '&playsinline=1'
        '&rel=0'
        '&modestbranding=1'
        '&origin=$origin'
        '&playerapiid=$safePlayerId';
  }

  void _play() {
    _postCommand('playVideo');
  }

  void _pause() {
    _postCommand('pauseVideo');
  }

  void _seekTo(double seconds) {
    _postCommand('seekTo', <Object>[seconds, true]);
    _requestSync();
  }

  void _setPlaybackRate(double rate) {
    _postCommand('setPlaybackRate', <Object>[rate, true]);
  }

  void _requestSync() {
    _postCommand('getCurrentTime');
    _postCommand('getDuration');
    _postCommand('getPlayerState');
    _postCommand('getPlaybackRate');
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(milliseconds: 500), (_) {
      _requestSync();
    });
  }

  void _sendListeningHandshake() {
    if (_listeningMessageSent) {
      return;
    }
    _listeningMessageSent = true;
    _postRaw(<String, Object>{
      'event': 'listening',
      'id': _playerId,
      'channel': 'widget',
    });

    for (final eventName in const <String>[
      'onReady',
      'onStateChange',
      'onPlaybackRateChange',
      'onError',
    ]) {
      _postCommand('addEventListener', <Object>[eventName]);
    }
  }

  void _postCommand(String func, [List<Object>? args]) {
    _postRaw(<String, Object>{
      'event': 'command',
      'func': func,
      'args': args ?? const <Object>[],
      'id': _playerId,
    });
  }

  void _postRaw(Map<String, Object> message) {
    final targetWindow = _iframe.contentWindow;
    if (targetWindow == null) {
      return;
    }
    targetWindow.postMessage(jsonEncode(message).toJS, _youtubeOrigin.toJS);
  }

  void _handleWindowMessage(web.MessageEvent event) {
    final origin = event.origin;
    if (origin != _youtubeOrigin && origin != _youtubeNoCookieOrigin) {
      return;
    }

    final payload = _extractPayload(event);
    if (payload == null) {
      return;
    }

    final rawId = payload['id']?.toString();
    if (rawId != null && rawId.isNotEmpty && rawId != _playerId) {
      return;
    }

    final eventName = payload['event']?.toString();
    if (eventName == null || eventName.isEmpty) {
      return;
    }

    switch (eventName) {
      case 'onReady':
        _snapshot = _snapshot.copyWith(isReady: true, clearError: true);
        _emitSnapshot(_snapshot);
        if (!_readyCallbackFired) {
          _readyCallbackFired = true;
          widget.onReady?.call();
        }
        _requestSync();
        return;
      case 'onStateChange':
        final nextState = _parsePlaybackState(payload['info']);
        _snapshot = _snapshot.copyWith(playbackState: nextState);
        _emitSnapshot(_snapshot);
        return;
      case 'onPlaybackRateChange':
        final rate = _parseNumber(payload['info']);
        if (rate != null && rate > 0) {
          _snapshot = _snapshot.copyWith(playbackRate: rate);
          _emitSnapshot(_snapshot);
        }
        return;
      case 'onError':
        final code = _parseNumber(payload['info'])?.round();
        _snapshot = _snapshot.copyWith(errorCode: code);
        _emitSnapshot(_snapshot);
        return;
      case 'infoDelivery':
      case 'initialDelivery':
        _consumeInfoDelivery(payload['info']);
        return;
      default:
        return;
    }
  }

  Map<String, dynamic>? _extractPayload(web.MessageEvent event) {
    dynamic dartData;
    try {
      dartData = event.data.dartify();
    } catch (_) {
      dartData = null;
    }

    if (dartData is String) {
      if (dartData.isEmpty) {
        return null;
      }
      try {
        final decoded = jsonDecode(dartData);
        if (decoded is Map) {
          return Map<String, dynamic>.from(decoded);
        }
      } catch (_) {
        return null;
      }
      return null;
    }

    if (dartData is Map) {
      return Map<String, dynamic>.from(dartData);
    }

    return null;
  }

  void _consumeInfoDelivery(dynamic infoRaw) {
    if (infoRaw is! Map) {
      return;
    }
    final info = Map<String, dynamic>.from(infoRaw);

    var next = _snapshot;
    var dirty = false;

    final current = _parseNumber(info['currentTime']);
    if (current != null) {
      next = next.copyWith(currentSeconds: current);
      dirty = true;
    }

    final duration = _parseNumber(info['duration']);
    if (duration != null && duration > 0) {
      next = next.copyWith(durationSeconds: duration);
      dirty = true;
    }

    final state = _parsePlaybackState(info['playerState']);
    if (state != WebYoutubePlaybackState.unknown) {
      next = next.copyWith(playbackState: state);
      dirty = true;
    }

    final rate = _parseNumber(info['playbackRate']);
    if (rate != null && rate > 0) {
      next = next.copyWith(playbackRate: rate);
      dirty = true;
    }

    final code = _parseNumber(info['errorCode'])?.round();
    if (code != null) {
      next = next.copyWith(errorCode: code);
      dirty = true;
    }

    if (!dirty) {
      return;
    }

    _snapshot = next;
    _emitSnapshot(next);
  }

  double? _parseNumber(dynamic raw) {
    if (raw is num) return raw.toDouble();
    if (raw is String) return double.tryParse(raw);
    return null;
  }

  WebYoutubePlaybackState _parsePlaybackState(dynamic raw) {
    final code = _parseNumber(raw)?.round();
    switch (code) {
      case -1:
        return WebYoutubePlaybackState.unstarted;
      case 0:
        return WebYoutubePlaybackState.ended;
      case 1:
        return WebYoutubePlaybackState.playing;
      case 2:
        return WebYoutubePlaybackState.paused;
      case 3:
        return WebYoutubePlaybackState.buffering;
      case 5:
        return WebYoutubePlaybackState.cued;
      default:
        return WebYoutubePlaybackState.unknown;
    }
  }

  void _emitSnapshot(WebYoutubePlayerSnapshot snapshot) {
    if (!mounted) {
      return;
    }
    widget.onStateChanged?.call(snapshot);
  }

  @override
  void dispose() {
    widget.controller?._detach(this);
    _pollTimer?.cancel();
    _iframe.removeEventListener('load', _iframeLoadListener);
    web.window.removeEventListener('message', _windowMessageListener);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return HtmlElementView(viewType: _viewType);
  }
}
