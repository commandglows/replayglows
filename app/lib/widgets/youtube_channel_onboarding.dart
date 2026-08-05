import 'package:flutter/material.dart';
import 'package:replayglows_app/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:replayglows_app/i18n/translations.dart';
import 'package:replayglows_app/providers/mutations.dart';
import 'package:replayglows_app/widgets/error_feedback.dart';

const _youtubeCreateChannelHelpUrl =
    'https://support.google.com/youtube/answer/1646861';

class YouTubeChannelOnboardingCard extends ConsumerStatefulWidget {
  const YouTubeChannelOnboardingCard({
    super.key,
    this.compact = false,
    this.onImported,
  });

  final bool compact;
  final VoidCallback? onImported;

  @override
  ConsumerState<YouTubeChannelOnboardingCard> createState() =>
      _YouTubeChannelOnboardingCardState();
}

class _YouTubeChannelOnboardingCardState
    extends ConsumerState<YouTubeChannelOnboardingCard> {
  final _controller = TextEditingController();
  bool _importing = false;
  String? _validationError;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  AppLocale _locale(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'fr'
      ? AppLocale.fr
      : AppLocale.en;

  Future<void> _openChannelHelp() async {
    final uri = Uri.parse(_youtubeCreateChannelHelpUrl);
    await launchUrl(uri, webOnlyWindowName: '_blank');
  }

  Future<void> _import() async {
    final value = _controller.text.trim();
    final validation = validateYoutubePlaylistUrl(value);
    if (validation != YoutubePlaylistUrlValidation.valid) {
      setState(() => _validationError = _validationMessage(validation));
      return;
    }

    setState(() {
      _importing = true;
      _validationError = null;
    });

    try {
      final result = await importPlaylistByUrl(ref, value);
      if (!mounted) return;
      _controller.clear();
      widget.onImported?.call();
      final count = result['importedVideoCount']?.toString() ?? '0';
      final title = result['title']?.toString() ?? 'playlist';
      final reason = result['reason']?.toString();
      final success = tr(
        'youtubeLibrary.importSuccess',
        locale: _locale(context),
        params: {'title': title, 'count': count},
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            reason == null || reason.isEmpty ? success : '$success $reason',
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        showErrorSnackBar(
          context,
          error: e,
          prefix: t('youtubeLibrary.importFailed', locale: _locale(context)),
        );
      }
    } finally {
      if (mounted) setState(() => _importing = false);
    }
  }

  String _validationMessage(YoutubePlaylistUrlValidation validation) {
    final l = _locale(context);
    return switch (validation) {
      YoutubePlaylistUrlValidation.empty => t(
        'youtubeLibrary.errorEmpty',
        locale: l,
      ),
      YoutubePlaylistUrlValidation.notYoutube => t(
        'youtubeLibrary.errorNotYoutube',
        locale: l,
      ),
      YoutubePlaylistUrlValidation.missingList => t(
        'youtubeLibrary.errorMissingList',
        locale: l,
      ),
      YoutubePlaylistUrlValidation.invalidId => t(
        'youtubeLibrary.errorInvalidId',
        locale: l,
      ),
      YoutubePlaylistUrlValidation.specialPlaylist => t(
        'youtubeLibrary.errorSpecialPlaylist',
        locale: l,
      ),
      YoutubePlaylistUrlValidation.valid => '',
    };
  }

  @override
  Widget build(BuildContext context) {
    final l = _locale(context);
    final theme = Theme.of(context);

    return Card(
      margin: EdgeInsets.fromLTRB(
        AppSpacing.md,
        widget.compact ? AppSpacing.xs : AppSpacing.md,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.account_tree_outlined,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t('youtubeLibrary.title', locale: l),
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xxs + 2),
                      Text(
                        t('youtubeLibrary.description', locale: l),
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm + 2),
            Wrap(
              spacing: 10,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: _openChannelHelp,
                  icon: const Icon(
                    Icons.open_in_new_rounded,
                    size: AppSizes.compactProgress,
                  ),
                  label: Text(t('youtubeLibrary.createChannel', locale: l)),
                ),
                TextButton.icon(
                  onPressed: _importing ? null : _import,
                  icon: _importing
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: AppSpacing.xxxs,
                          ),
                        )
                      : const Icon(
                          Icons.playlist_add_rounded,
                          size: AppSizes.compactProgress,
                        ),
                  label: Text(
                    _importing
                        ? t('youtubeLibrary.importing', locale: l)
                        : t('youtubeLibrary.importAction', locale: l),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _controller,
              enabled: !_importing,
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _importing ? null : _import(),
              decoration: InputDecoration(
                labelText: t('youtubeLibrary.urlLabel', locale: l),
                hintText: 'https://www.youtube.com/playlist?list=...',
                border: const OutlineInputBorder(),
                errorText: _validationError,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              t('youtubeLibrary.publicHint', locale: l),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.textTheme.bodySmall?.color?.withValues(
                  alpha: 0.78,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum YoutubePlaylistUrlValidation {
  valid,
  empty,
  notYoutube,
  missingList,
  invalidId,
  specialPlaylist,
}

YoutubePlaylistUrlValidation validateYoutubePlaylistUrl(String input) {
  final value = input.trim();
  if (value.isEmpty) return YoutubePlaylistUrlValidation.empty;

  Uri? uri;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    uri = Uri.tryParse(value);
  } else if (value.startsWith('www.')) {
    uri = Uri.tryParse('https://$value');
  }

  String? playlistId;
  if (uri != null) {
    final host = uri.host.toLowerCase().replaceFirst(RegExp(r'^www\.'), '');
    const allowedHosts = {
      'youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'youtu.be',
    };
    if (!allowedHosts.contains(host)) {
      return YoutubePlaylistUrlValidation.notYoutube;
    }
    playlistId = uri.queryParameters['list'];
  } else {
    playlistId = value;
  }

  if (playlistId == null || playlistId.trim().isEmpty) {
    return YoutubePlaylistUrlValidation.missingList;
  }

  final normalized = playlistId.trim();
  if (!RegExp(r'^[A-Za-z0-9_-]{2,150}$').hasMatch(normalized)) {
    return YoutubePlaylistUrlValidation.invalidId;
  }

  if ({'WL', 'LL'}.contains(normalized.toUpperCase())) {
    return YoutubePlaylistUrlValidation.specialPlaylist;
  }

  return YoutubePlaylistUrlValidation.valid;
}
