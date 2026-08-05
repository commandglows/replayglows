import 'package:flutter/material.dart';
import 'package:replayglowz_app/app/theme.dart';

class NoteGroupHeader extends StatelessWidget {
  const NoteGroupHeader({
    super.key,
    required this.title,
    required this.noteCount,
  });

  final String title;
  final int noteCount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.md, bottom: AppSpacing.xs),
      child: Row(
        children: [
          Container(
            width: AppSpacing.xxl,
            height: AppSpacing.lg + AppSpacing.xxs,
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: const Icon(Icons.play_arrow, size: AppSizes.iconSmall),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Text(
              title,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Text(
            '$noteCount note${noteCount == 1 ? '' : 's'}',
            style: theme.textTheme.labelSmall,
          ),
        ],
      ),
    );
  }
}
