import 'package:flutter/material.dart';
import 'package:replayglowz_app/app/theme.dart';

class CommentsPlaceholderPanel extends StatelessWidget {
  const CommentsPlaceholderPanel({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.comment_outlined,
            size: AppSpacing.xxl,
            color: Colors.grey,
          ),
          SizedBox(height: AppSpacing.md),
          Text('Comments coming soon', style: TextStyle(color: Colors.grey)),
          SizedBox(height: AppSpacing.xs),
          Text(
            'In-app comments will appear here',
            style: TextStyle(
              color: Colors.grey,
              fontSize: AppTypography.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
