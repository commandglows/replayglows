import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

class WebYoutubeEmbed extends StatefulWidget {
  const WebYoutubeEmbed({super.key, required this.videoId, this.onReady});

  final String videoId;
  final VoidCallback? onReady;

  @override
  State<WebYoutubeEmbed> createState() => _WebYoutubeEmbedState();
}

class _WebYoutubeEmbedState extends State<WebYoutubeEmbed> {
  late final String _viewType;
  late final web.HTMLIFrameElement _iframe;

  @override
  void initState() {
    super.initState();
    _viewType =
        'replayglowz-youtube-${DateTime.now().microsecondsSinceEpoch}-${widget.videoId}';
    _iframe = web.HTMLIFrameElement()
      ..allow =
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      ..allowFullscreen = true;
    _iframe.style
      ..setProperty('border', '0')
      ..setProperty('width', '100%')
      ..setProperty('height', '100%');
    _setSource(widget.videoId);

    ui_web.platformViewRegistry.registerViewFactory(
      _viewType,
      (int viewId) => _iframe,
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onReady?.call();
    });
  }

  @override
  void didUpdateWidget(covariant WebYoutubeEmbed oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoId != widget.videoId) {
      _setSource(widget.videoId);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onReady?.call();
      });
    }
  }

  void _setSource(String videoId) {
    final safeVideoId = Uri.encodeComponent(videoId);
    _iframe.src =
        'https://www.youtube.com/embed/$safeVideoId?playsinline=1&rel=0&modestbranding=1';
  }

  @override
  Widget build(BuildContext context) {
    return HtmlElementView(viewType: _viewType);
  }
}
