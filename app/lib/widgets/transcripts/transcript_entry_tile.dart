import 'package:flutter/material.dart';
import 'package:replayglows_app/app/theme.dart';

class TranscriptEntryTile extends StatelessWidget {
  const TranscriptEntryTile({
    super.key,
    required this.timestampLabel,
    required this.text,
    required this.onTap,
    this.speaker,
    this.isActive = false,
  });

  final String timestampLabel;
  final String text;
  final VoidCallback onTap;
  final String? speaker;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      color: isActive ? theme.colorScheme.primaryContainer : null,
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: AppSpacing.xxl + AppSpacing.xs + AppSpacing.xxs / 2,
                child: Text(
                  timestampLabel,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w700,
                    fontSize: AppTypography.labelMedium,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (speaker != null && speaker!.trim().isNotEmpty) ...[
                      Text(speaker!.trim(), style: theme.textTheme.labelSmall),
                      const SizedBox(height: AppSpacing.xxs),
                    ],
                    Text(text),
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
