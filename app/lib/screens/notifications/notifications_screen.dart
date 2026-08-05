import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:replayglows_app/app/router.dart';
import 'package:replayglows_app/app/theme.dart';
import 'package:replayglows_app/models/models.dart';
import 'package:replayglows_app/providers/mutations.dart';
import 'package:replayglows_app/providers/providers.dart';
import 'package:replayglows_app/widgets/error_feedback.dart';

/// Screen that displays the user's notifications.
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              try {
                await markAllNotificationsRead(ref);
              } catch (e) {
                if (context.mounted) {
                  showErrorSnackBar(
                    context,
                    error: e,
                    prefix: 'Failed to mark as read',
                  );
                }
              }
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: notificationsAsync.when(
        data: (notifications) {
          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.notifications_none,
                    size: AppSizes.emptyStateIcon,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'No notifications yet',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'New videos from your subscriptions will appear here',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            itemCount: notifications.length,
            itemBuilder: (context, index) {
              final notification = notifications[index];
              return _NotificationTile(notification: notification);
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorStateView(
          error: error,
          prefix: 'Failed to load notifications',
          onRetry: () => ref.invalidate(notificationsProvider),
        ),
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification});

  final AppNotification notification;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isUnread = !notification.read;
    final timeAgo = _formatTimeAgo(notification.createdAt);

    return ListTile(
      tileColor: isUnread
          ? theme.colorScheme.primaryContainer.withValues(alpha: 0.15)
          : null,
      leading: _buildLeading(theme),
      title: Text(
        notification.title,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: isUnread ? const TextStyle(fontWeight: FontWeight.w600) : null,
      ),
      subtitle: Text(
        [
          if (notification.body != null) notification.body!,
          timeAgo,
        ].join(' \u00b7 '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: isUnread
          ? Container(
              width: AppSpacing.xs,
              height: AppSpacing.xs,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary,
                shape: BoxShape.circle,
              ),
            )
          : null,
      onTap: () {
        // Mark as read
        if (isUnread) {
          markNotificationRead(ref, notification.id);
        }

        // Navigate based on type
        if ((notification.type == NotificationType.newVideo ||
                notification.type == NotificationType.transcriptReady) &&
            notification.youtubeVideoId != null) {
          context.go(
            Uri(
              path: Routes.play,
              queryParameters: {'videoId': notification.youtubeVideoId!},
            ).toString(),
          );
        }
      },
    );
  }

  Widget _buildLeading(ThemeData theme) {
    if (notification.thumbnailUrl != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: Image.network(
          notification.thumbnailUrl!,
          width: 56,
          height: 42,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) =>
              _buildIconLeading(theme),
        ),
      );
    }
    return _buildIconLeading(theme);
  }

  Widget _buildIconLeading(ThemeData theme) {
    final IconData icon;
    switch (notification.type) {
      case NotificationType.newVideo:
        icon = Icons.fiber_new;
      case NotificationType.transcriptReady:
        icon = Icons.subtitles;
      case NotificationType.system:
        icon = Icons.info_outline;
    }
    return CircleAvatar(
      backgroundColor: theme.colorScheme.primaryContainer,
      child: Icon(icon, color: theme.colorScheme.onPrimaryContainer),
    );
  }
}

String _formatTimeAgo(int timestampMs) {
  final diff = DateTime.now().difference(
    DateTime.fromMillisecondsSinceEpoch(timestampMs),
  );

  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return '${(diff.inDays / 7).floor()}w ago';
}
