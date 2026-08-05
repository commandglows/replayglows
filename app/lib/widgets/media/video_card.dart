import 'package:flutter/material.dart';

import 'package:replayglowz_app/app/theme.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/utils/color_utils.dart';
import 'package:replayglowz_app/utils/duration_utils.dart';
import 'package:replayglowz_app/widgets/media/media_thumbnail.dart';

class VideoCard extends StatelessWidget {
  const VideoCard({
    super.key,
    required this.video,
    required this.onTap,
    this.isActive = false,
    this.trailing,
  });

  final YouTubeVideo video;
  final VoidCallback onTap;
  final bool isActive;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final duration = parseDuration(video.duration);
    final theme = Theme.of(context);

    final colorScheme = theme.colorScheme;

    return AnimatedContainer(
      duration: AppMotion.standard,
      curve: AppMotion.curve,
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isActive
              ? colorScheme.primary.withValues(alpha: 0.52)
              : Colors.transparent,
          width: AppSpacing.xxs / 2,
        ),
        boxShadow: isActive
            ? [
                BoxShadow(
                  color: colorScheme.primary.withValues(alpha: 0.12),
                  blurRadius: AppSpacing.md,
                  offset: const Offset(0, AppSpacing.xs),
                ),
              ]
            : null,
      ),
      child: Card(
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        color: isActive
            ? Color.alphaBlend(
                colorScheme.primary.withValues(alpha: 0.08),
                colorScheme.surface,
              )
            : null,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MediaThumbnail(
                imageUrl: video.thumbnailUrl,
                height: 200,
                width: double.infinity,
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (isActive) ...[
                      _NowPlayingBadge(colorScheme: colorScheme),
                      const SizedBox(height: AppSpacing.xs),
                    ],
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            video.title,
                            style: theme.textTheme.titleMedium,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (trailing != null) ...[
                          const SizedBox(width: AppSpacing.xs),
                          trailing!,
                        ],
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            video.channelTitle,
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                        if (duration != null)
                          Text(
                            formatDuration(duration),
                            style: theme.textTheme.labelSmall,
                          ),
                      ],
                    ),
                    if (video.playlistTitle != null) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Row(
                        children: [
                          if (video.playlistColor != null)
                            Container(
                              width: AppSpacing.xs,
                              height: AppSpacing.xs,
                              margin: const EdgeInsets.only(
                                right: AppSpacing.xxs,
                              ),
                              decoration: BoxDecoration(
                                color: parseHexColor(video.playlistColor!),
                                shape: BoxShape.circle,
                              ),
                            ),
                          Text(
                            video.playlistTitle!,
                            style: theme.textTheme.labelSmall,
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NowPlayingBadge extends StatelessWidget {
  const _NowPlayingBadge({required this.colorScheme});

  final ColorScheme colorScheme;

  @override
  Widget build(BuildContext context) {
    return IconTheme(
      data: IconThemeData(color: colorScheme.primary, size: 14),
      child: DefaultTextStyle(
        style: Theme.of(context).textTheme.labelSmall!.copyWith(
          color: colorScheme.primary,
          fontWeight: FontWeight.w700,
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.graphic_eq_rounded),
            SizedBox(width: 4),
            Text('Now playing'),
          ],
        ),
      ),
    );
  }
}
