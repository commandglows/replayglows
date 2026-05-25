import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import 'package:replayglowz_app/widgets/play/web_youtube_embed.dart';

class PlayerPanel extends StatelessWidget {
  const PlayerPanel({
    super.key,
    required this.videoId,
    required this.controller,
    required this.onReady,
    required this.onEnded,
  });

  final String videoId;
  final YoutubePlayerController controller;
  final VoidCallback onReady;
  final VoidCallback onEnded;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: kIsWeb
          ? WebYoutubeEmbed(videoId: videoId, onReady: onReady)
          : YoutubePlayer(
              controller: controller,
              showVideoProgressIndicator: true,
              progressIndicatorColor: Theme.of(context).colorScheme.primary,
              progressColors: ProgressBarColors(
                playedColor: Theme.of(context).colorScheme.primary,
                handleColor: Theme.of(context).colorScheme.primary,
              ),
              onReady: onReady,
              onEnded: (_) => onEnded(),
            ),
    );
  }
}
