import 'package:flutter/material.dart';

class WebYoutubeEmbed extends StatelessWidget {
  const WebYoutubeEmbed({super.key, required this.videoId, this.onReady});

  final String videoId;
  final VoidCallback? onReady;

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(color: Colors.black);
  }
}
