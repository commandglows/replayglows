import 'package:flutter/material.dart';
import 'package:replayglows_app/app/theme.dart';
import 'package:flutter/foundation.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import 'package:replayglows_app/widgets/media/media_thumbnail.dart';
import 'package:replayglows_app/widgets/play/web_youtube_embed.dart';

class PlayerPanel extends StatelessWidget {
  const PlayerPanel({
    super.key,
    required this.videoId,
    required this.controller,
    required this.onReady,
    required this.onEnded,
    this.aspectRatio = 16 / 9,
    this.webController,
    this.onWebStateChanged,
    this.showPoster = false,
    this.posterThumbnailUrl,
    this.posterTitle,
    this.posterChannelTitle,
    this.posterChannelThumbnailUrl,
    this.onPosterPlay,
  });

  final String videoId;
  final YoutubePlayerController controller;
  final VoidCallback onReady;
  final VoidCallback onEnded;
  final double aspectRatio;
  final WebYoutubePlayerController? webController;
  final ValueChanged<WebYoutubePlayerSnapshot>? onWebStateChanged;
  final bool showPoster;
  final String? posterThumbnailUrl;
  final String? posterTitle;
  final String? posterChannelTitle;
  final String? posterChannelThumbnailUrl;
  final VoidCallback? onPosterPlay;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: aspectRatio,
      child: kIsWeb
          ? Stack(
              fit: StackFit.expand,
              children: [
                WebYoutubeEmbed(
                  videoId: videoId,
                  onReady: onReady,
                  controller: webController,
                  onStateChanged: onWebStateChanged,
                ),
                if (showPoster)
                  _VideoPosterOverlay(
                    thumbnailUrl: posterThumbnailUrl,
                    title: posterTitle,
                    channelTitle: posterChannelTitle,
                    channelThumbnailUrl: posterChannelThumbnailUrl,
                    onPlay: onPosterPlay,
                  ),
              ],
            )
          : YoutubePlayer(
              controller: controller,
              builder: (context, player, controller) {
                WidgetsBinding.instance.addPostFrameCallback((_) => onReady());
                return player;
              },
            ),
    );
  }
}

class _VideoPosterOverlay extends StatelessWidget {
  const _VideoPosterOverlay({
    required this.thumbnailUrl,
    required this.title,
    required this.channelTitle,
    required this.channelThumbnailUrl,
    required this.onPlay,
  });

  final String? thumbnailUrl;
  final String? title;
  final String? channelTitle;
  final String? channelThumbnailUrl;
  final VoidCallback? onPlay;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasChannel = channelTitle != null && channelTitle!.trim().isNotEmpty;

    return Material(
      color: AppColors.videoOverlayBase,
      child: InkWell(
        onTap: onPlay,
        child: Stack(
          fit: StackFit.expand,
          children: [
            MediaThumbnail(
              imageUrl: thumbnailUrl,
              width: double.infinity,
              height: double.infinity,
              fit: BoxFit.cover,
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.videoOverlayTop,
                    AppColors.videoOverlayMiddle,
                    AppColors.videoOverlayBottom,
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundColor: AppColors.videoOverlayAvatar,
                        backgroundImage:
                            channelThumbnailUrl != null &&
                                channelThumbnailUrl!.isNotEmpty
                            ? NetworkImage(channelThumbnailUrl!)
                            : null,
                        child:
                            channelThumbnailUrl == null ||
                                channelThumbnailUrl!.isEmpty
                            ? const Icon(
                                Icons.person,
                                color: AppColors.videoOverlayForeground,
                                size: AppSizes.compactProgress,
                              )
                            : null,
                      ),
                      const SizedBox(width: AppSpacing.xs + 2),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (title != null && title!.trim().isNotEmpty)
                              Text(
                                title!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.titleSmall?.copyWith(
                                  color: AppColors.videoOverlayForeground,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            if (hasChannel)
                              Text(
                                channelTitle!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: AppColors.videoOverlayMuted,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Center(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary,
                        borderRadius: BorderRadius.circular(AppRadii.lg + 2),
                        boxShadow: const [
                          BoxShadow(
                            color: AppColors.videoOverlayShadow,
                            blurRadius: AppSpacing.lg,
                            offset: Offset(
                              0,
                              AppSpacing.xs + AppSpacing.xxxs,
                            ),
                          ),
                        ],
                      ),
                      child: IconButton(
                        tooltip: 'Play',
                        onPressed: onPlay,
                        color: AppColors.videoOverlayForeground,
                        iconSize: 42,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 26,
                          vertical: 14,
                        ),
                        icon: const Icon(Icons.play_arrow_rounded),
                      ),
                    ),
                  ),
                  const Spacer(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
