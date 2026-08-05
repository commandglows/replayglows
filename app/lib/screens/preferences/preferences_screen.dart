import 'package:flutter/material.dart';
import 'package:replayglowz_app/app/theme.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:replayglowz_app/app/build_info.dart';
import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/auth/auth_state.dart';
import 'package:replayglowz_app/i18n/translations.dart';
import 'package:replayglowz_app/auth/auth_service.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/notifications/push_notification_service.dart';
import 'package:replayglowz_app/providers/mutations.dart';
import 'package:replayglowz_app/providers/providers.dart';
import 'package:replayglowz_app/utils/app_logger.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';
import 'package:replayglowz_app/widgets/settings/settings_rows.dart';
import 'package:replayglowz_app/widgets/youtube_channel_onboarding.dart';
import 'package:replayglowz_app/widgets/youtube_connect.dart';

/// Preferences screen with grouped settings sections.
///
/// Convex queries/mutations used:
/// - `users.ensureUser` — create the Convex user/settings/subscription if needed
/// - `settings.getSettings` — load current user settings
/// - `subscriptions.getSubscription` — check subscription tier / quota
/// - `users.getCurrentUser` — fetch user profile info
/// - `settings.updateAllSettings` — persist settings changes
class PreferencesScreen extends ConsumerStatefulWidget {
  const PreferencesScreen({super.key});

  @override
  ConsumerState<PreferencesScreen> createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends ConsumerState<PreferencesScreen> {
  Future<void> _persistSettings(Map<String, dynamic> patch) async {
    try {
      await updateSettings(ref, patch);
      ref.invalidate(preferencesDataProvider);
      ref.invalidate(settingsProvider);
      ref.invalidate(subscriptionProvider);
      ref.invalidate(currentUserProvider);
    } catch (e) {
      if (mounted) {
        showErrorSnackBar(context, error: e, prefix: 'Failed to save setting');
      }
    }
  }

  Future<void> _setPushNotifications(
    BuildContext context,
    NotificationSettings notifications,
    bool enabled,
  ) async {
    if (!enabled) {
      try {
        await ref
            .read(pushNotificationServiceProvider)
            .unregisterCurrentDevice();
      } catch (e, st) {
        AppLogger.instance.log(
          'Failed to unregister push device',
          source: 'Preferences',
          level: LogLevel.warning,
          error: e,
          stackTrace: st,
        );
      }
      await _persistSettings({
        'notifications': notifications.copyWith(push: false).toJson(),
      });
      return;
    }

    final granted = await ref
        .read(pushNotificationServiceProvider)
        .requestPermissionAndRegister();
    if (!mounted || !context.mounted) return;
    if (!granted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Android notification permission was not granted.'),
        ),
      );
      return;
    }
    await _persistSettings({
      'notifications': notifications.copyWith(push: true).toJson(),
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final preferencesAsync = ref.watch(preferencesDataProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Preferences')),
      body: ListView(
        children: [
          const SettingsSection(title: 'Account'),
          _AccountTile(authState: authState),
          const _DiagnosticsCard(),
          const _LogsCard(),
          const Divider(),
          ..._buildConvexSections(context, authState, preferencesAsync),
        ],
      ),
    );
  }

  List<Widget> _buildConvexSections(
    BuildContext context,
    AuthState authState,
    AsyncValue<PreferencesData?> preferencesAsync,
  ) {
    if (authState is! AuthAuthenticated) {
      return [
        const Padding(
          padding: EdgeInsets.all(AppSpacing.lg),
          child: Text(
            'Sign in to manage playback, notifications and transcript '
            'preferences.',
            textAlign: TextAlign.center,
          ),
        ),
      ];
    }

    return [
      preferencesAsync.when(
        data: (data) => data == null
            ? const Padding(
                padding: EdgeInsets.all(AppSpacing.lg),
                child: Text(
                  'No preferences available for this account yet.',
                  textAlign: TextAlign.center,
                ),
              )
            : _buildSettingsBody(context, data),
        loading: () => _buildShimmerLoading(),
        error: (error, stack) => ErrorStateView(
          error: error,
          prefix: 'Failed to load preferences',
          onRetry: () => ref.invalidate(preferencesDataProvider),
        ),
      ),
    ];
  }

  Widget _buildShimmerLoading() {
    return const Padding(
      padding: EdgeInsets.all(AppSpacing.md),
      child: Card(
        child: Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  SizedBox(
                    width: AppSizes.iconSmall,
                    height: AppSizes.iconSmall,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Text(
                    'Loading preferences',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              SizedBox(height: AppSpacing.sm),
              Text(
                'ReplayGlowz is fetching your settings, subscription, and profile data from Convex.',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSettingsBody(BuildContext context, PreferencesData data) {
    final locale = Localizations.localeOf(context).languageCode == 'fr'
        ? AppLocale.fr
        : AppLocale.en;
    final settings = data.settings;
    final subscription = data.subscription;
    final user = data.user;
    final themeMode = settings.theme;
    final notifications = settings.notifications;
    final playback = settings.playback;
    final notes = settings.notes;
    final transcriptLanguage = settings.transcripts.defaultLanguage;
    final feedbackIsAdmin = ref.watch(feedbackIsAdminProvider);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ListTile(
          leading: const Icon(Icons.lightbulb_outline),
          title: Text(t('p3.preferences.hintsTitle', locale: locale)),
          subtitle: Text(t('p3.preferences.hintsSubtitle', locale: locale)),
          trailing: FilledButton.tonal(
            onPressed: () async {
              final prefs = await SharedPreferences.getInstance();
              final keys = prefs
                  .getKeys()
                  .where((k) => k.startsWith('ui_hint_dismissed:'))
                  .toList(growable: false);
              for (final key in keys) {
                await prefs.remove(key);
              }
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      t('p3.preferences.hintsReset', locale: locale),
                    ),
                  ),
                );
              }
            },
            child: Text(t('p3.preferences.reset', locale: locale)),
          ),
        ),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.workspace_premium),
          title: const Text('Subscription'),
          subtitle: Text(
            '${subscription.plan.name.toUpperCase()} plan'
            ' - ${subscription.status.name}',
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {},
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Videos: ${SubscriptionFeatures.isUnlimited(subscription.features.maxVideos) ? 'Unlimited' : subscription.features.maxVideos}'
                  '  |  Playlists: ${SubscriptionFeatures.isUnlimited(subscription.features.maxPlaylists) ? 'Unlimited' : subscription.features.maxPlaylists}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ],
          ),
        ),
        const Divider(),

        const SettingsSection(title: 'Appearance'),
        SettingsChoiceTile(
          icon: Icons.palette_outlined,
          title: 'Theme',
          value: themeMode.name,
          onTap: () => showSettingsChoiceDialog(
            context,
            title: 'Theme',
            options: const ['light', 'dark', 'system'],
            currentValue: themeMode.name,
            onSelected: (value) => _persistSettings({'theme': value}),
          ),
        ),
        SettingsChoiceTile(
          icon: Icons.language,
          title: 'Language',
          value: settings.language ?? 'en',
          onTap: () => showSettingsChoiceDialog(
            context,
            title: 'Language',
            options: const ['en', 'fr', 'es', 'de', 'pt'],
            currentValue: settings.language ?? 'en',
            onSelected: (value) => _persistSettings({'language': value}),
          ),
        ),
        const Divider(),

        const SettingsSection(title: 'Account'),
        const YoutubeConnectionSettingsCard(),
        if (user != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Connected as ${user.displayName}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ),
        const Divider(),

        const SettingsSection(title: 'Notifications'),
        SettingsSwitchTile(
          icon: Icons.alternate_email,
          title: 'Email notifications',
          subtitle: 'Receive updates by email',
          value: notifications.email,
          onChanged: (value) => _persistSettings({
            'notifications': notifications.copyWith(email: value).toJson(),
          }),
        ),
        SettingsSwitchTile(
          icon: Icons.notifications,
          title: 'Push notifications',
          subtitle: 'Enable Android push delivery',
          value: notifications.push,
          onChanged: (value) =>
              _setPushNotifications(context, notifications, value),
        ),
        SettingsChoiceTile(
          icon: Icons.schedule_send_outlined,
          title: 'New video cadence',
          value: _pushCadenceLabel(notifications.pushCadence),
          onTap: () => showSettingsChoiceDialog(
            context,
            title: 'New video cadence',
            options: const [
              'Every hour',
              'Every 6 hours',
              'Daily',
              'Every 3 days',
            ],
            currentValue: _pushCadenceLabel(notifications.pushCadence),
            onSelected: (value) => _persistSettings({
              'notifications': notifications
                  .copyWith(pushCadence: _pushCadenceFromLabel(value))
                  .toJson(),
            }),
          ),
        ),
        SettingsChoiceTile(
          icon: Icons.filter_alt_outlined,
          title: 'Notification sources',
          value: _notificationSourceLabel(notifications),
          onTap: () => _showNotificationSourcesSheet(context, notifications),
        ),
        SettingsSwitchTile(
          icon: Icons.comment_outlined,
          title: 'New comments',
          subtitle: 'Notify about comment activity',
          value: notifications.newComments,
          onChanged: (value) => _persistSettings({
            'notifications': notifications
                .copyWith(newComments: value)
                .toJson(),
          }),
        ),
        SettingsSwitchTile(
          icon: Icons.thumb_up_alt_outlined,
          title: 'New likes',
          subtitle: 'Notify when notes get likes',
          value: notifications.newLikes,
          onChanged: (value) => _persistSettings({
            'notifications': notifications.copyWith(newLikes: value).toJson(),
          }),
        ),
        SettingsSwitchTile(
          icon: Icons.video_library_outlined,
          title: 'New video alerts',
          subtitle: 'Notify when selected sources publish',
          value: notifications.newVideos,
          onChanged: (value) => _persistSettings({
            'notifications': notifications.copyWith(newVideos: value).toJson(),
          }),
        ),
        SettingsSwitchTile(
          icon: Icons.auto_awesome_motion_outlined,
          title: 'Transcript ready',
          subtitle: 'Notify as soon as a transcript is available',
          value: notifications.transcriptReady,
          onChanged: (value) => _persistSettings({
            'notifications': notifications
                .copyWith(transcriptReady: value)
                .toJson(),
          }),
        ),
        SettingsSwitchTile(
          icon: Icons.info_outline,
          title: 'System notifications',
          subtitle: 'Notify about account, sync, and service updates',
          value: notifications.system,
          onChanged: (value) => _persistSettings({
            'notifications': notifications.copyWith(system: value).toJson(),
          }),
        ),
        SettingsChoiceTile(
          icon: Icons.schedule,
          title: 'Feed check interval',
          value: _intervalLabel(notifications.feedRefreshIntervalMinutes),
          onTap: () => showSettingsChoiceDialog(
            context,
            title: 'Feed check interval',
            options: const [
              'Off',
              'Every 30 minutes',
              'Every hour',
              'Every 2 hours',
              'Every 6 hours',
              'Daily',
            ],
            currentValue: _intervalLabel(
              notifications.feedRefreshIntervalMinutes,
            ),
            onSelected: (value) => _persistSettings({
              'notifications': notifications
                  .copyWith(
                    feedRefreshIntervalMinutes: _intervalFromLabel(value),
                  )
                  .toJson(),
            }),
          ),
        ),
        const Divider(),

        const SettingsSection(title: 'Playback'),
        SettingsSwitchTile(
          icon: Icons.play_circle,
          title: 'Autoplay',
          subtitle: 'Play next video automatically',
          value: playback.autoplay,
          onChanged: (value) => _persistSettings({
            'playback': playback.copyWith(autoplay: value).toJson(),
          }),
        ),
        SettingsChoiceTile(
          icon: Icons.hd_outlined,
          title: 'Default quality',
          value: playback.defaultQuality ?? 'auto',
          onTap: () => showSettingsChoiceDialog(
            context,
            title: 'Default quality',
            options: const ['auto', '1080p', '720p', '480p', '360p'],
            currentValue: playback.defaultQuality ?? 'auto',
            onSelected: (value) => _persistSettings({
              'playback': playback.copyWith(defaultQuality: value).toJson(),
            }),
          ),
        ),
        SettingsChoiceTile(
          icon: Icons.speed,
          title: 'Default speed',
          value: '${playback.defaultSpeed ?? 1.0}x',
          onTap: () => showSettingsChoiceDialog(
            context,
            title: 'Default speed',
            options: const ['0.5', '0.75', '1', '1.25', '1.5', '1.75', '2'],
            currentValue: '${playback.defaultSpeed ?? 1.0}'.replaceAll(
              '.0',
              '',
            ),
            onSelected: (value) => _persistSettings({
              'playback': playback
                  .copyWith(defaultSpeed: double.tryParse(value) ?? 1.0)
                  .toJson(),
            }),
          ),
        ),
        SettingsSwitchTile(
          icon: Icons.closed_caption_disabled_outlined,
          title: 'Captions enabled',
          subtitle: 'Show captions by default',
          value: playback.captionsEnabled ?? false,
          onChanged: (value) => _persistSettings({
            'playback': playback.copyWith(captionsEnabled: value).toJson(),
          }),
        ),
        const Divider(),

        const SettingsSection(title: 'Notes'),
        SettingsSwitchTile(
          icon: Icons.pause_circle,
          title: 'Auto timestamp',
          subtitle: 'Create note prompt when pausing video',
          value: notes.defaultTimestamped,
          onChanged: (value) => _persistSettings({
            'notes': notes.copyWith(defaultTimestamped: value).toJson(),
          }),
        ),
        SettingsChoiceTile(
          icon: Icons.sort,
          title: 'Sort order',
          value: (notes.sortOrder ?? NoteSortOrder.asc).name,
          onTap: () => showSettingsChoiceDialog(
            context,
            title: 'Sort order',
            options: const ['asc', 'desc'],
            currentValue: (notes.sortOrder ?? NoteSortOrder.asc).name,
            onSelected: (value) => _persistSettings({
              'notes': notes
                  .copyWith(sortOrder: NoteSortOrder.fromJson(value))
                  .toJson(),
            }),
          ),
        ),
        const Divider(),

        const SettingsSection(title: 'Transcripts'),
        SettingsChoiceTile(
          icon: Icons.translate,
          title: 'Transcript Language',
          value: transcriptLanguage ?? 'Auto-detect',
          onTap: () => showSettingsChoiceDialog(
            context,
            title: 'Transcript Language',
            options: ['Auto-detect', 'English', 'French', 'Spanish', 'German'],
            currentValue: transcriptLanguage ?? 'Auto-detect',
            onSelected: (value) => _persistSettings({
              'transcripts': {
                ...settings.transcripts.toJson(),
                'defaultLanguage': value == 'Auto-detect'
                    ? null
                    : value.toLowerCase(),
              },
            }),
          ),
        ),
        SettingsChoiceTile(
          icon: Icons.auto_awesome,
          title: 'Default transcript provider',
          value: settings.transcripts.defaultProvider?.toJson() ?? 'automatic',
          onTap: () => showSettingsChoiceDialog(
            context,
            title: 'Default transcript provider',
            options: const [
              'automatic',
              'youtube_captions',
              'faster_whisper',
              'sensevoice',
              'openai_mini',
              'openai',
              'deepgram',
            ],
            currentValue:
                settings.transcripts.defaultProvider?.toJson() ?? 'automatic',
            onSelected: (value) => _persistSettings({
              'transcripts': {
                ...settings.transcripts.toJson(),
                if (value == 'automatic')
                  'defaultProvider': null
                else
                  'defaultProvider': value,
              },
            }),
          ),
        ),
        SettingsSwitchTile(
          icon: Icons.closed_caption,
          title: 'Try YouTube captions first',
          subtitle: 'Uses published captions before audio transcription',
          value: settings.transcripts.autoAttemptYoutubeCaptions ?? true,
          onChanged: (value) => _persistSettings({
            'transcripts': {
              ...settings.transcripts.toJson(),
              'autoAttemptYoutubeCaptions': value,
            },
          }),
        ),
        SettingsSwitchTile(
          icon: Icons.computer,
          title: 'Use local fallback',
          subtitle: 'Enabled only when the transcript worker is available',
          value: settings.transcripts.autoAttemptLocalFallback ?? true,
          onChanged: (value) => _persistSettings({
            'transcripts': {
              ...settings.transcripts.toJson(),
              'autoAttemptLocalFallback': value,
            },
          }),
        ),
        const _TranscriptProviderSettingsCard(),
        const Divider(),

        const SettingsSection(title: 'Channel automation'),
        const _YouTubeLibrarySetupSection(),
        const _ChannelAutomationSettingsCard(),
        const Divider(),

        const SettingsSection(title: 'Support'),
        ListTile(
          leading: const Icon(Icons.feedback_outlined),
          title: const Text('Send feedback'),
          subtitle: const Text('Report issues or tell us what to improve'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.go(Routes.feedback),
        ),
        feedbackIsAdmin.when(
          data: (isAdmin) => isAdmin
              ? ListTile(
                  leading: const Icon(Icons.admin_panel_settings_outlined),
                  title: const Text('Feedback admin'),
                  subtitle: const Text(
                    'Review incoming text and audio feedback',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go(Routes.feedbackAdmin),
                )
              : const SizedBox.shrink(),
          loading: () => const ListTile(
            leading: Icon(Icons.admin_panel_settings_outlined),
            title: Text('Checking admin access…'),
          ),
          error: (error, stackTrace) => const SizedBox.shrink(),
        ),
        const SizedBox(height: AppSpacing.xl),

        // App info
        Center(
          child: Text(
            'ReplayGlowz v1.0.0',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
      ],
    );
  }

  String _intervalLabel(int minutes) {
    switch (minutes) {
      case 0:
        return 'Off';
      case 30:
        return 'Every 30 minutes';
      case 60:
        return 'Every hour';
      case 120:
        return 'Every 2 hours';
      case 360:
        return 'Every 6 hours';
      case 1440:
        return 'Daily';
      default:
        return 'Every $minutes min';
    }
  }

  int _intervalFromLabel(String label) {
    switch (label) {
      case 'Off':
        return 0;
      case 'Every 30 minutes':
        return 30;
      case 'Every hour':
        return 60;
      case 'Every 2 hours':
        return 120;
      case 'Every 6 hours':
        return 360;
      case 'Daily':
        return 1440;
      default:
        return 60;
    }
  }

  String _pushCadenceLabel(PushCadence cadence) {
    switch (cadence) {
      case PushCadence.hourly:
        return 'Every hour';
      case PushCadence.every6Hours:
        return 'Every 6 hours';
      case PushCadence.daily:
        return 'Daily';
      case PushCadence.every3Days:
        return 'Every 3 days';
    }
  }

  PushCadence _pushCadenceFromLabel(String label) {
    switch (label) {
      case 'Every hour':
        return PushCadence.hourly;
      case 'Every 6 hours':
        return PushCadence.every6Hours;
      case 'Every 3 days':
        return PushCadence.every3Days;
      case 'Daily':
      default:
        return PushCadence.daily;
    }
  }

  String _notificationSourceLabel(NotificationSettings notifications) {
    if (notifications.notifyAllSources) return 'All feeds and channels';
    final total =
        notifications.selectedFeedIds.length +
        notifications.selectedChannelSourceIds.length;
    if (total == 0) return 'No source selected';
    return '$total selected';
  }

  Future<void> _showNotificationSourcesSheet(
    BuildContext context,
    NotificationSettings notifications,
  ) async {
    try {
      final feeds = await ref.read(virtualFeedsProvider.future);
      final channelSources = <VirtualFeedSource>[];
      final seenChannelSourceIds = <String>{};
      for (final feed in feeds) {
        final details = await ref.read(
          virtualFeedDetailsProvider(
            VirtualFeedDetailsArgs(feedId: feed.id),
          ).future,
        );
        for (final source in details.sources.where(
          (source) => source.isChannelSource,
        )) {
          if (seenChannelSourceIds.add(source.id)) {
            channelSources.add(source);
          }
        }
      }
      if (!mounted || !context.mounted) return;

      var notifyAll = notifications.notifyAllSources;
      final selectedFeedIds = notifications.selectedFeedIds.toSet();
      final selectedChannelIds = notifications.selectedChannelSourceIds.toSet();

      await showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (sheetContext) {
          return StatefulBuilder(
            builder: (context, setSheetState) {
              return SafeArea(
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(context).height * 0.82,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const ListTile(
                        leading: Icon(Icons.filter_alt_outlined),
                        title: Text('Notification sources'),
                        subtitle: Text(
                          'Choose which Replay Feeds and synced channels can send new video alerts.',
                        ),
                      ),
                      SwitchListTile(
                        secondary: const Icon(Icons.all_inclusive),
                        title: const Text('All feeds and channels'),
                        value: notifyAll,
                        onChanged: (value) =>
                            setSheetState(() => notifyAll = value),
                      ),
                      const Divider(height: AppElevation.raised),
                      Expanded(
                        child: ListView(
                          children: [
                            const SettingsSection(title: 'Replay Feeds'),
                            if (feeds.isEmpty)
                              const ListTile(title: Text('No Replay Feed yet'))
                            else
                              for (final feed in feeds)
                                CheckboxListTile(
                                  secondary: const Icon(
                                    Icons.dynamic_feed_outlined,
                                  ),
                                  title: Text(feed.title),
                                  subtitle: Text(
                                    '${feed.activeSourceCount} active sources',
                                  ),
                                  value: selectedFeedIds.contains(feed.id),
                                  enabled: !notifyAll,
                                  onChanged: (value) => setSheetState(() {
                                    if (value ?? false) {
                                      selectedFeedIds.add(feed.id);
                                    } else {
                                      selectedFeedIds.remove(feed.id);
                                    }
                                  }),
                                ),
                            const SettingsSection(title: 'Synced channels'),
                            if (channelSources.isEmpty)
                              const ListTile(
                                title: Text('No synced channel yet'),
                              )
                            else
                              for (final channel in channelSources)
                                CheckboxListTile(
                                  secondary: const Icon(
                                    Icons.smart_display_outlined,
                                  ),
                                  title: Text(channel.sourceTitle),
                                  subtitle: Text(channel.sourceId),
                                  value: selectedChannelIds.contains(
                                    channel.id,
                                  ),
                                  enabled:
                                      !notifyAll &&
                                      channel.isActive &&
                                      channel.isAvailable,
                                  onChanged: (value) => setSheetState(() {
                                    if (value ?? false) {
                                      selectedChannelIds.add(channel.id);
                                    } else {
                                      selectedChannelIds.remove(channel.id);
                                    }
                                  }),
                                ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => Navigator.of(context).pop(),
                                child: const Text('Cancel'),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: FilledButton(
                                onPressed: () async {
                                  Navigator.of(context).pop();
                                  await _persistSettings({
                                    'notifications': notifications
                                        .copyWith(
                                          notifyAllSources: notifyAll,
                                          selectedFeedIds: selectedFeedIds
                                              .toList(growable: false),
                                          selectedChannelSourceIds:
                                              selectedChannelIds.toList(
                                                growable: false,
                                              ),
                                        )
                                        .toJson(),
                                  });
                                },
                                child: const Text('Save'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      );
    } catch (e) {
      if (context.mounted) {
        showErrorSnackBar(
          context,
          error: e,
          prefix: 'Failed to load notification sources',
        );
      }
    }
  }
}

class _YouTubeLibrarySetupSection extends ConsumerWidget {
  const _YouTubeLibrarySetupSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playlistsAsync = ref.watch(playlistsProvider);
    return playlistsAsync.when(
      data: (playlists) => playlists.isEmpty
          ? const YouTubeChannelOnboardingCard(compact: true)
          : const SizedBox.shrink(),
      loading: () => const SizedBox.shrink(),
      error: (error, stackTrace) =>
          const YouTubeChannelOnboardingCard(compact: true),
    );
  }
}

class _TranscriptProviderSettingsCard extends ConsumerStatefulWidget {
  const _TranscriptProviderSettingsCard();

  @override
  ConsumerState<_TranscriptProviderSettingsCard> createState() =>
      _TranscriptProviderSettingsCardState();
}

class _TranscriptProviderSettingsCardState
    extends ConsumerState<_TranscriptProviderSettingsCard> {
  final _controllers = <String, TextEditingController>{};
  final _busy = <String>{};

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final catalogAsync = ref.watch(transcriptProviderCatalogProvider);
    return catalogAsync.when(
      data: (catalog) {
        if (catalog.isEmpty) {
          return const ListTile(
            leading: Icon(Icons.subtitles_off),
            title: Text('No transcript providers available'),
            subtitle: Text('YouTube captions will be used when available.'),
          );
        }
        return Column(
          children: catalog
              .map(
                (provider) => ExpansionTile(
                  leading: Icon(
                    provider.available ? Icons.check_circle : Icons.info,
                    color: provider.available
                        ? Theme.of(context).colorScheme.primary
                        : null,
                  ),
                  title: Text(provider.label),
                  subtitle: Text(
                    provider.available
                        ? '${provider.priceLabel} · ${provider.speedLabel} · ${provider.qualityLabel}'
                        : provider.unavailableReason ??
                              'Not available in this environment.',
                  ),
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(provider.recommendedUse),
                      ),
                    ),
                    if (provider.requiresSecret &&
                        provider.secretProvider != null)
                      _buildSecretControls(provider.secretProvider!),
                  ],
                ),
              )
              .toList(growable: false),
        );
      },
      loading: () => const ListTile(
        leading: SizedBox(
          width: AppSizes.iconMedium,
          height: AppSizes.iconMedium,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        title: Text('Loading transcript providers'),
      ),
      error: (error, stack) => ErrorStateView(
        error: error,
        prefix: 'Failed to load transcript providers',
        onRetry: () => ref.invalidate(transcriptProviderCatalogProvider),
      ),
    );
  }

  Widget _buildSecretControls(String provider) {
    final controller = _controllers.putIfAbsent(
      provider,
      TextEditingController.new,
    );
    final isBusy = _busy.contains(provider);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        children: [
          TextField(
            controller: controller,
            obscureText: true,
            decoration: InputDecoration(
              labelText: '${provider.toUpperCase()} API key',
              prefixIcon: const Icon(Icons.key),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: 8,
            children: [
              FilledButton.icon(
                onPressed: isBusy
                    ? null
                    : () => _runSecretAction(provider, () async {
                        final value = controller.text.trim();
                        if (value.isEmpty) {
                          throw StateError('Enter an API key first.');
                        }
                        await upsertTranscriptSecret(
                          ref,
                          provider: provider,
                          apiKey: value,
                        );
                        controller.clear();
                      }, 'Secret saved.'),
                icon: const Icon(Icons.save),
                label: const Text('Save'),
              ),
              OutlinedButton.icon(
                onPressed: isBusy
                    ? null
                    : () => _runSecretAction(
                        provider,
                        () => testTranscriptSecret(ref, provider: provider),
                        'Secret test passed.',
                      ),
                icon: const Icon(Icons.verified),
                label: const Text('Test'),
              ),
              TextButton.icon(
                onPressed: isBusy
                    ? null
                    : () => _runSecretAction(
                        provider,
                        () => deleteTranscriptSecret(ref, provider: provider),
                        'Secret deleted.',
                      ),
                icon: const Icon(Icons.delete_outline),
                label: const Text('Delete'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _runSecretAction(
    String provider,
    Future<dynamic> Function() action,
    String successMessage,
  ) async {
    setState(() => _busy.add(provider));
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(successMessage)));
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Transcript secret failed');
    } finally {
      if (mounted) setState(() => _busy.remove(provider));
    }
  }
}

class _ChannelAutomationSettingsCard extends ConsumerWidget {
  const _ChannelAutomationSettingsCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final channelsAsync = ref.watch(subscribedChannelsProvider);
    final linksAsync = ref.watch(channelLinksProvider);
    final playlistsAsync = ref.watch(playlistsProvider);

    return channelsAsync.when(
      data: (channels) {
        final header = ListTile(
          leading: const Icon(Icons.subscriptions_outlined),
          title: const Text('YouTube subscriptions cache'),
          subtitle: const Text(
            'Refresh only when you want to pull the latest subscriptions from YouTube.',
          ),
          trailing: TextButton.icon(
            icon: const Icon(Icons.sync),
            label: const Text('Refresh'),
            onPressed: () async {
              try {
                await refreshYoutubeSubscriptions(ref);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Subscriptions refreshed.')),
                );
              } catch (e) {
                if (!context.mounted) return;
                showErrorSnackBar(
                  context,
                  error: e,
                  prefix: 'Subscriptions refresh failed',
                );
              }
            },
          ),
        );
        if (channels.isEmpty) {
          return Column(
            children: [
              header,
              const ListTile(
                leading: Icon(Icons.subscriptions_outlined),
                title: Text('No YouTube subscriptions found'),
                subtitle: Text(
                  'This is normal for a new YouTube account. Playlists still work.',
                ),
              ),
            ],
          );
        }
        return Column(
          children: channels.take(12).map((channel) {
            ChannelPlaylistLink? link;
            for (final item
                in linksAsync.asData?.value ?? const <ChannelPlaylistLink>[]) {
              if (item.youtubeChannelId == channel.youtubeChannelId) {
                link = item;
                break;
              }
            }
            final currentLink = link;
            return ListTile(
              leading: const Icon(Icons.account_circle_outlined),
              title: Text(channel.title),
              subtitle: Text(
                currentLink == null
                    ? 'Not linked'
                    : '${currentLink.isActive ? 'Active' : 'Paused'} · ${currentLink.youtubePlaylistId}',
              ),
              trailing: Wrap(
                spacing: 4,
                children: [
                  if (currentLink != null)
                    IconButton(
                      tooltip: currentLink.isActive
                          ? 'Pause link'
                          : 'Resume link',
                      icon: Icon(
                        currentLink.isActive ? Icons.pause : Icons.play_arrow,
                      ),
                      onPressed: () async {
                        await toggleChannelLinkStatus(ref, currentLink.id);
                      },
                    ),
                  IconButton(
                    tooltip: currentLink == null
                        ? 'Link to playlist'
                        : 'Sync channel',
                    icon: Icon(
                      currentLink == null ? Icons.add_link : Icons.sync,
                    ),
                    onPressed: () async {
                      if (currentLink == null) {
                        await _showLinkDialog(
                          context,
                          ref,
                          channel,
                          playlistsAsync.asData?.value ?? const [],
                        );
                        return;
                      }
                      final result = await syncPastVideosFromChannel(
                        ref,
                        youtubeChannelId: currentLink.youtubeChannelId,
                        channelTitle: currentLink.channelTitle,
                        youtubePlaylistId: currentLink.youtubePlaylistId,
                      );
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            result.message ??
                                'Synced ${result.addedCount} video(s).',
                          ),
                        ),
                      );
                    },
                  ),
                  if (currentLink != null)
                    IconButton(
                      tooltip: 'Unlink channel',
                      icon: const Icon(Icons.link_off),
                      onPressed: () => unlinkChannel(ref, currentLink.id),
                    ),
                ],
              ),
            );
          }).toList()..insert(0, header),
        );
      },
      loading: () => const ListTile(
        leading: SizedBox(
          width: AppSizes.iconMedium,
          height: AppSizes.iconMedium,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        title: Text('Loading YouTube subscriptions'),
      ),
      error: (error, stack) => ErrorStateView(
        error: error,
        prefix: 'Failed to load subscriptions',
        onRetry: () => ref.invalidate(subscribedChannelsProvider),
      ),
    );
  }

  Future<void> _showLinkDialog(
    BuildContext context,
    WidgetRef ref,
    YouTubeChannel channel,
    List<YouTubePlaylist> playlists,
  ) async {
    if (playlists.isEmpty) {
      showErrorSnackBar(
        context,
        error: StateError('Create or sync a playlist before linking channels.'),
        prefix: 'No playlist available',
      );
      return;
    }
    final selected = await showDialog<YouTubePlaylist>(
      context: context,
      builder: (context) => SimpleDialog(
        title: Text('Link ${channel.title}'),
        children: playlists
            .map(
              (playlist) => SimpleDialogOption(
                onPressed: () => Navigator.of(context).pop(playlist),
                child: Text(playlist.title),
              ),
            )
            .toList(growable: false),
      ),
    );
    if (selected == null) return;
    try {
      await linkChannelToPlaylist(
        ref,
        youtubeChannelId: channel.youtubeChannelId,
        channelTitle: channel.title,
        youtubePlaylistId: selected.youtubePlaylistId,
      );
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${channel.title} linked to ${selected.title}.'),
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Link failed');
    }
  }
}

// ---------------------------------------------------------------------------
// Account tile — reads auth state directly, no Convex dependency
// ---------------------------------------------------------------------------

class _AccountTile extends ConsumerWidget {
  const _AccountTile({required this.authState});

  final AuthState authState;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    switch (authState) {
      case AuthLoading():
        return const ListTile(
          leading: CircleAvatar(child: Icon(Icons.person)),
          title: Text('Checking session…'),
        );
      case AuthAuthenticated(:final user):
        return Column(
          children: [
            ListTile(
              leading: CircleAvatar(
                backgroundImage: user.imageUrl != null
                    ? NetworkImage(user.imageUrl!)
                    : null,
                child: user.imageUrl == null ? const Icon(Icons.person) : null,
              ),
              title: Text(user.label),
              subtitle: user.email.isNotEmpty ? Text(user.email) : null,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.logout, size: AppSizes.iconSmall),
                  label: const Text('Sign out'),
                  onPressed: () async {
                    try {
                      await ref
                          .read(pushNotificationServiceProvider)
                          .unregisterCurrentDevice();
                    } catch (e, st) {
                      AppLogger.instance.log(
                        'Failed to unregister push device during sign out',
                        source: 'Preferences',
                        level: LogLevel.warning,
                        error: e,
                        stackTrace: st,
                      );
                    }
                    await ref.read(authServiceProvider).signOut();
                    if (context.mounted) context.go(Routes.signIn);
                  },
                ),
              ),
            ),
          ],
        );
      case AuthUnauthenticated(:final error):
        return Column(
          children: [
            const ListTile(
              leading: CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text('Not signed in'),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: InlineErrorCard(
                  error: error,
                  prefix: 'Authentication error',
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: FilledButton.icon(
                  icon: const Icon(Icons.login, size: AppSizes.iconSmall),
                  label: const Text('Sign in'),
                  onPressed: () => context.go(Routes.signIn),
                ),
              ),
            ),
          ],
        );
    }
  }
}

// ---------------------------------------------------------------------------
// Diagnostics card — env vars + service status
// ---------------------------------------------------------------------------

class _DiagnosticsCard extends ConsumerWidget {
  const _DiagnosticsCard();

  Future<void> _copyDiagnostics(
    BuildContext context,
    AuthService auth,
    AuthState authState,
  ) async {
    final lines = _buildLines(auth, authState);
    await Clipboard.setData(ClipboardData(text: lines.join('\n')));
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Diagnostics copied.')));
  }

  List<String> _buildLines(AuthService auth, AuthState authState) {
    String authLabel;
    switch (authState) {
      case AuthLoading():
        authLabel = 'Loading';
      case AuthAuthenticated():
        authLabel = 'Authenticated';
      case AuthUnauthenticated():
        authLabel = 'Unauthenticated';
    }

    return [
      ...buildIdentityHeader(),
      'ReplayGlowz preferences diagnostics',
      'Build id: $buildId',
      'Build commit: $buildCommitSha',
      'Build environment: $buildEnvironment',
      'Build timestamp: $buildTimestamp',
      'Build mode: ${buildModeLabel()}',
      'Current URL: ${kIsWeb ? Uri.base.toString() : 'not-web'}',
      'Current host: ${kIsWeb ? Uri.base.host : 'not-web'}',
      'CONVEX_URL: ${convexUrl.isNotEmpty ? convexUrl : '(missing)'}',
      'Auth owner: ${authConfigOwnerLabel()}',
      'CLERK_PUBLISHABLE_KEY: ${clerkPublishableKeyStatusLabel()}',
      'CLERK_SIGN_IN_URL: $clerkSignInUrl',
      'CLERK_SIGN_UP_URL: $clerkSignUpUrl',
      'REPLAYGLOWZ_PRODUCT_ID: $replayGlowzProductId',
      'REPLAYGLOWZ_LEGACY_PRODUCT_IDS: $replayGlowzLegacyProductIds',
      'REPLAYGLOWZ_ACCOUNT_CENTER_URL: $replayGlowzAccountCenterUrl',
      'REPLAYGLOWZ_APP_URL: ${replayGlowzAppUrl.isNotEmpty ? replayGlowzAppUrl : '(missing)'}',
      'REPLAYGLOWZ_APP_URL host match: ${hostMatchLabel(replayGlowzAppUrl)}',
      'SENTRY: ${sentryStatusLabel()}',
      'ReplayGlowz sign-in initialised: ${auth.isInitialised ? 'yes' : 'no'}',
      'Auth state: $authLabel',
      'Current user: ${auth.currentUser?.id ?? 'none'}',
      '',
      'Recent logs:',
      AppLogger.instance.formatAll(),
    ];
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authServiceProvider);
    final authState = ref.watch(authStateProvider);

    String authLabel;
    switch (authState) {
      case AuthLoading():
        authLabel = 'Loading';
      case AuthAuthenticated():
        authLabel = 'Authenticated';
      case AuthUnauthenticated():
        authLabel = 'Unauthenticated';
    }

    final rows = <({String key, String value, bool ok})>[
      (
        key: 'CONVEX_URL',
        value: convexUrl.isNotEmpty ? convexUrl : '(missing)',
        ok: convexUrl.isNotEmpty,
      ),
      (
        key: 'CLERK_PUBLISHABLE_KEY',
        value: clerkPublishableKeyStatusLabel(),
        ok: !requiresClerkConfig || clerkPublishableKey.isNotEmpty,
      ),
      (
        key: 'CLERK_SIGN_IN_URL',
        value: clerkSignInUrl,
        ok: clerkSignInUrl.isNotEmpty,
      ),
      (
        key: 'REPLAYGLOWZ_PRODUCT_ID',
        value: replayGlowzProductId,
        ok: replayGlowzProductId.isNotEmpty,
      ),
      (
        key: 'REPLAYGLOWZ_LEGACY_PRODUCT_IDS',
        value: replayGlowzLegacyProductIds,
        ok: replayGlowzLegacyProductIds.isNotEmpty,
      ),
      (
        key: 'BUILD_COMMIT_SHA',
        value: buildCommitSha,
        ok: buildCommitSha != 'unknown',
      ),
      (
        key: 'REPLAYGLOWZ_APP_URL',
        value: replayGlowzAppUrl.isNotEmpty ? replayGlowzAppUrl : '(missing)',
        ok: replayGlowzAppUrl.isNotEmpty,
      ),
      (
        key: 'APP_URL host match',
        value: hostMatchLabel(replayGlowzAppUrl),
        ok:
            hostMatchLabel(replayGlowzAppUrl) == 'yes' ||
            hostMatchLabel(replayGlowzAppUrl) == 'not-web',
      ),
      (
        key: 'ReplayGlowz sign-in initialised',
        value: auth.isInitialised ? 'yes' : 'no',
        ok: auth.isInitialised,
      ),
      (key: 'Auth state', value: authLabel, ok: authState is AuthAuthenticated),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.tune, size: AppSizes.iconSmall),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'Diagnostics',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () => _copyDiagnostics(context, auth, authState),
                    icon: const Icon(Icons.copy, size: AppSizes.iconSmall),
                    label: const Text('Copy'),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final r in rows)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        r.ok ? Icons.check_circle : Icons.error,
                        size: AppSizes.iconSmall,
                        color: r.ok
                            ? Theme.of(context).colorScheme.primary
                            : Theme.of(context).colorScheme.error,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      SizedBox(
                        width: 160,
                        child: Text(
                          r.key,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: AppTypography.bodySmall,
                          ),
                        ),
                      ),
                      Expanded(
                        child: SelectableText(
                          r.value,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: AppTypography.bodySmall,
                          ),
                        ),
                      ),
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

// ---------------------------------------------------------------------------
// Logs card — in-memory AppLogger view with Copy + Clear
// ---------------------------------------------------------------------------

class _LogsCard extends StatefulWidget {
  const _LogsCard();

  @override
  State<_LogsCard> createState() => _LogsCardState();
}

class _LogsCardState extends State<_LogsCard> {
  @override
  void initState() {
    super.initState();
    AppLogger.instance.addListener(_onLogs);
  }

  @override
  void dispose() {
    AppLogger.instance.removeListener(_onLogs);
    super.dispose();
  }

  void _onLogs() {
    if (mounted) setState(() {});
  }

  Future<void> _copyAll() async {
    await Clipboard.setData(
      ClipboardData(text: AppLogger.instance.formatAll()),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Logs copied')));
  }

  @override
  Widget build(BuildContext context) {
    final entries = AppLogger.instance.entries.reversed.toList();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.bug_report_outlined,
                    size: AppSizes.iconSmall,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'Logs (${entries.length})',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.copy, size: AppSizes.iconSmall),
                    tooltip: 'Copy all',
                    onPressed: entries.isEmpty ? null : _copyAll,
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.delete_outline,
                      size: AppSizes.iconSmall,
                    ),
                    tooltip: 'Clear',
                    onPressed: entries.isEmpty
                        ? null
                        : () => AppLogger.instance.clear(),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              if (entries.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  child: Text(
                    '(no logs yet)',
                    style: TextStyle(fontStyle: FontStyle.italic),
                  ),
                )
              else
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 320),
                  child: Scrollbar(
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: entries.length,
                      separatorBuilder: (context, index) =>
                          const Divider(height: 8),
                      itemBuilder: (context, i) {
                        final e = entries[i];
                        final color = switch (e.level) {
                          LogLevel.error => Theme.of(context).colorScheme.error,
                          LogLevel.warning => Theme.of(
                            context,
                          ).colorScheme.tertiary,
                          LogLevel.info => null,
                        };
                        return SelectableText(
                          e.format(),
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: AppTypography.labelSmall,
                            color: color,
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
