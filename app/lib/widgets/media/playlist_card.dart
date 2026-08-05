// ignore_for_file: use_null_aware_elements

import 'package:flutter/material.dart';

import 'package:replayglows_app/app/theme.dart';
import 'package:replayglows_app/models/models.dart';
import 'package:replayglows_app/utils/color_utils.dart';
import 'package:replayglows_app/utils/date_utils.dart';
import 'package:replayglows_app/widgets/media/media_thumbnail.dart';
import 'package:replayglows_app/i18n/translations.dart';

class PlaylistCard extends StatelessWidget {
  const PlaylistCard({
    super.key,
    required this.playlist,
    required this.onTap,
    this.locale,
    this.trailing,
  });

  final YouTubePlaylist playlist;
  final AppLocale? locale;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final color = playlist.color != null
        ? parseHexColor(playlist.color!)
        : Theme.of(context).colorScheme.primary;
    final theme = Theme.of(context);
    final l =
        locale ??
        (Localizations.localeOf(context).languageCode == 'fr'
            ? AppLocale.fr
            : AppLocale.en);

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Row(
          children: [
            SizedBox(
              width: 120,
              height: 90,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(color: color.withValues(alpha: 0.2)),
                  MediaThumbnail(
                    imageUrl: playlist.effectiveThumbnailUrl,
                    width: 120,
                    height: 90,
                    icon: Icons.playlist_play,
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Container(width: AppSpacing.xxs, color: color),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      playlist.title,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      '${playlist.videoCount} video${playlist.videoCount == 1 ? '' : 's'}',
                      style: theme.textTheme.bodySmall,
                    ),
                    const SizedBox(height: AppSpacing.xxs / 2),
                    Text(
                      playlist.cachedAt > 0
                          ? '${t('playlistsPage.updated', locale: l)} ${formatDate(playlist.cachedAt)}'
                          : '',
                      style: theme.textTheme.labelSmall,
                    ),
                  ],
                ),
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}
