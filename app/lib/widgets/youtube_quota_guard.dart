import 'package:flutter/material.dart';
import 'package:replayglowz_app/app/theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:replayglowz_app/providers/providers.dart';

class YoutubeQuotaCost {
  const YoutubeQuotaCost._();

  static const syncPlaylist = 1;
  static const syncAllPlaylists = 1;
  static const syncSubscriptions = 1;
  static const addPlaylistItem = 50;
  static const removePlaylistItem = 50;
  static const movePlaylistItem = 50;
}

String youtubeQuotaCostLabel(int cost) {
  return '$cost YouTube quota unit${cost == 1 ? '' : 's'}';
}

Future<bool> confirmYoutubeQuotaRisk({
  required BuildContext context,
  required WidgetRef ref,
  required int cost,
  required String actionLabel,
}) async {
  final snapshot = ref.read(quotaUsageSnapshotProvider).asData?.value;
  if (snapshot == null || !snapshot.isRisky(cost)) {
    return true;
  }

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        title: const Text('Quota may be tight'),
        content: Text(
          '$actionLabel costs ${youtubeQuotaCostLabel(cost)}. '
          'You have ${snapshot.remaining} of ${snapshot.limit} units left today.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Continue'),
          ),
        ],
      );
    },
  );

  return confirmed == true;
}

class YoutubeQuotaCostText extends ConsumerWidget {
  const YoutubeQuotaCostText({
    super.key,
    required this.cost,
    this.prefix = 'Estimated cost',
  });

  final int cost;
  final String prefix;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshotAsync = ref.watch(quotaUsageSnapshotProvider);
    final color = Theme.of(context).colorScheme.onSurfaceVariant;
    final style = Theme.of(context).textTheme.bodySmall?.copyWith(color: color);

    final quotaText = snapshotAsync.when(
      data: (snapshot) => snapshot.describeCost(cost),
      loading: () => youtubeQuotaCostLabel(cost),
      error: (_, _) => youtubeQuotaCostLabel(cost),
    );

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.speed, size: AppSizes.iconSmall, color: color),
        const SizedBox(width: AppSpacing.xxs + 2),
        Flexible(child: Text('$prefix: $quotaText', style: style)),
      ],
    );
  }
}
