import 'package:flutter/material.dart';

import 'package:replayglows_app/app/theme.dart';

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
}

class WebYoutubePlayerController {
  bool get isAttached => false;

  void play() {}

  void pause() {}

  void seekTo(double seconds) {}

  void setPlaybackRate(double rate) {}

  void requestSync() {}
}

class WebYoutubeEmbed extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return const ColoredBox(color: AppColors.videoOverlayBase);
  }
}
