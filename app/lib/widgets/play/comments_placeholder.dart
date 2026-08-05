import 'package:flutter/material.dart';
import 'package:replayglowz_app/app/theme.dart';

class CommentsPlaceholderPanel extends StatelessWidget {
  const CommentsPlaceholderPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final mutedColor = theme.colorScheme.onSurfaceVariant;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.comment_outlined, size: AppSpacing.xxl, color: mutedColor),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Comments coming soon',
            style: theme.textTheme.bodyMedium?.copyWith(color: mutedColor),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'In-app comments will appear here',
            style: theme.textTheme.bodySmall?.copyWith(color: mutedColor),
          ),
        ],
      ),
    );
  }
}
