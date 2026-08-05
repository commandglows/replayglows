import 'package:flutter/material.dart';

import 'package:replayglowz_app/app/theme.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/utils/duration_utils.dart';
import 'package:replayglowz_app/widgets/media/media_thumbnail.dart';

class VideoListTile extends StatelessWidget {
  const VideoListTile({
    super.key,
    required this.video,
    required this.onTap,
    this.isActive = false,
    this.leadingWidth = 120,
    this.leadingHeight = 68,
    this.trailing,
  });

  final YouTubeVideo video;
  final VoidCallback onTap;
  final bool isActive;
  final double leadingWidth;
  final double leadingHeight;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final durationSec = parseDuration(video.duration);
    final subtitle = video.channelTitle.isEmpty
        ? (durationSec != null ? formatDuration(durationSec) : '')
        : '${video.channelTitle}'
              '${durationSec != null ? ' - ${formatDuration(durationSec)}' : ''}';
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return AnimatedContainer(
      duration: AppMotion.standard,
      curve: AppMotion.curve,
      decoration: BoxDecoration(
        color: isActive
            ? colorScheme.primary.withValues(alpha: 0.08)
            : colorScheme.surface.withValues(alpha: 0),
        border: Border(
          left: BorderSide(
            color: isActive
                ? colorScheme.primary
                : colorScheme.surface.withValues(alpha: 0),
            width: AppSpacing.xxs - 1,
          ),
        ),
      ),
      child: ListTile(
        leading: MediaThumbnail(
          imageUrl: video.thumbnailUrl,
          width: leadingWidth,
          height: leadingHeight,
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                video.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isActive) ...[
              const SizedBox(width: AppSpacing.xs),
              Tooltip(
                message: 'Now playing',
                child: Icon(
                  Icons.graphic_eq_rounded,
                  size: AppSizes.iconSmall,
                  color: colorScheme.primary,
                ),
              ),
            ],
          ],
        ),
        subtitle: subtitle.isEmpty ? null : Text(subtitle),
        trailing: trailing,
        onTap: onTap,
      ),
    );
  }
}
