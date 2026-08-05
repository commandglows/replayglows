import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';

import 'package:replayglows_app/app/theme.dart';
import 'package:replayglows_app/providers/providers.dart';
import 'package:replayglows_app/widgets/error_feedback.dart';

/// API quota and usage statistics screen.
///
/// Convex queries used:
/// - `metrics.getTodayQuotaUsage` — current YouTube API quota consumption
class StatsScreen extends ConsumerWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quotaAsync = ref.watch(quotaUsageProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('API Stats'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(quotaUsageProvider);
            },
          ),
        ],
      ),
      body: quotaAsync.when(
        data: (quotaData) {
          final usedQuota = (quotaData?['used'] as num?)?.toInt() ?? 0;
          final totalQuota = (quotaData?['limit'] as num?)?.toInt() ?? 10000;
          final recentCalls =
              (quotaData?['recentCalls'] as List<dynamic>?) ?? [];
          final dailyHistory =
              (quotaData?['dailyHistory'] as List<dynamic>?) ?? [];

          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              _buildQuotaCard(context, usedQuota, totalQuota),
              const SizedBox(height: AppSpacing.md),
              _buildDailySummaryCard(context, quotaData, dailyHistory),
              const SizedBox(height: AppSpacing.md),
              _buildRecentCallsSection(context, recentCalls),
            ],
          );
        },
        loading: () => _buildShimmerLoading(context),
        error: (error, stack) => ErrorStateView(
          error: error,
          prefix: 'Failed to load stats',
          onRetry: () => ref.invalidate(quotaUsageProvider),
        ),
      ),
    );
  }

  Widget _buildShimmerLoading(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Shimmer.fromColors(
      baseColor: colorScheme.surfaceContainerHighest,
      highlightColor: colorScheme.surface,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          Card(child: Container(height: 100, color: colorScheme.surface)),
          const SizedBox(height: AppSpacing.md),
          Card(child: Container(height: 200, color: colorScheme.surface)),
          const SizedBox(height: AppSpacing.md),
          Card(child: Container(height: 300, color: colorScheme.surface)),
        ],
      ),
    );
  }

  Widget _buildQuotaCard(BuildContext context, int usedQuota, int totalQuota) {
    final percentage = totalQuota > 0 ? usedQuota / totalQuota : 0.0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'YouTube API Quota',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '$usedQuota / $totalQuota',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.md),
              child: LinearProgressIndicator(
                value: percentage.clamp(0.0, 1.0),
                minHeight: 12,
                backgroundColor: Theme.of(
                  context,
                ).colorScheme.surfaceContainerHighest,
                color: percentage > 0.8
                    ? Theme.of(context).colorScheme.error
                    : percentage > 0.5
                    ? Theme.of(context).colorScheme.tertiary
                    : Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              '${(percentage * 100).toStringAsFixed(1)}% used today - resets at midnight PT',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDailySummaryCard(
    BuildContext context,
    Map<String, dynamic>? quotaData,
    List<dynamic> dailyHistory,
  ) {
    final syncs = (quotaData?['syncs'] as num?)?.toString() ?? '0';
    final videosFetched =
        (quotaData?['videosFetched'] as num?)?.toString() ?? '0';
    final playlistCount =
        (quotaData?['playlistCount'] as num?)?.toString() ?? '0';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Today\'s Summary',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: _buildStatTile(
                    context,
                    icon: Icons.sync,
                    label: 'Syncs',
                    value: syncs,
                  ),
                ),
                Expanded(
                  child: _buildStatTile(
                    context,
                    icon: Icons.video_library,
                    label: 'Videos Fetched',
                    value: videosFetched,
                  ),
                ),
                Expanded(
                  child: _buildStatTile(
                    context,
                    icon: Icons.playlist_play,
                    label: 'Playlists',
                    value: playlistCount,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text('Last 7 Days', style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: AppSpacing.xs),
            SizedBox(
              height: 80,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: List.generate(7, (index) {
                  // Use real daily history if available, else fallback.
                  double heightFactor = 0.1;
                  if (index < dailyHistory.length) {
                    final dayUsed =
                        (dailyHistory[index] as num?)?.toDouble() ?? 0;
                    final maxUsed = dailyHistory.fold<double>(0, (a, b) {
                      final v = (b as num?)?.toDouble() ?? 0;
                      return v > a ? v : a;
                    });
                    heightFactor = maxUsed > 0
                        ? (dayUsed / maxUsed).clamp(0.05, 1.0)
                        : 0.1;
                  }

                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xxxs,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Flexible(
                            child: FractionallySizedBox(
                              heightFactor: heightFactor,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.primary.withValues(alpha: 0.6),
                                  borderRadius: const BorderRadius.vertical(
                                    top: Radius.circular(AppRadii.sm),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xxs),
                          Text(
                            ['M', 'T', 'W', 'T', 'F', 'S', 'S'][index],
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatTile(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Column(
      children: [
        Icon(
          icon,
          size: AppSizes.iconMedium,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  Widget _buildRecentCallsSection(
    BuildContext context,
    List<dynamic> recentCalls,
  ) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Recent API Calls',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: AppSpacing.sm),
            // Table header
            Container(
              padding: const EdgeInsets.symmetric(
                vertical: AppSpacing.xs,
                horizontal: AppSpacing.xxs,
              ),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: Theme.of(context).colorScheme.outlineVariant,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: Text(
                      'Endpoint',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text(
                      'Time',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Expanded(
                    flex: 1,
                    child: Text(
                      'Cost',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.end,
                    ),
                  ),
                ],
              ),
            ),
            if (recentCalls.isEmpty)
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Center(
                  child: Text(
                    'No recent API calls',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              )
            else
              ...recentCalls.take(20).map((call) {
                final callMap = call is Map<String, dynamic>
                    ? call
                    : <String, dynamic>{};
                final endpoint = callMap['endpoint'] as String? ?? 'unknown';
                final cost = (callMap['quotaUnits'] as num?)?.toInt() ?? 0;
                final timestamp = (callMap['timestamp'] as num?)?.toInt() ?? 0;

                // Calculate minutes ago.
                final minutesAgo = timestamp > 0
                    ? ((DateTime.now().millisecondsSinceEpoch - timestamp) /
                              60000)
                          .round()
                    : 0;
                final timeStr = minutesAgo < 60
                    ? '${minutesAgo}m ago'
                    : '${minutesAgo ~/ 60}h ago';

                return Container(
                  padding: const EdgeInsets.symmetric(
                    vertical: AppSpacing.xs,
                    horizontal: AppSpacing.xxs,
                  ),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: Theme.of(context).colorScheme.outlineVariant,
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: Text(
                          endpoint,
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          timeStr,
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                        ),
                      ),
                      Expanded(
                        flex: 1,
                        child: Text(
                          '$cost units',
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w500,
                                color: cost >= 100
                                    ? Theme.of(context).colorScheme.error
                                    : null,
                              ),
                          textAlign: TextAlign.end,
                        ),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
