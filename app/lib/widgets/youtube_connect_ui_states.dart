part of 'youtube_connect.dart';

class YoutubeConnectionLoadingState extends StatelessWidget {
  const YoutubeConnectionLoadingState({
    super.key,
    required this.title,
    required this.description,
  });

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: AppSizes.authPanelMaxWidth),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md2),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(
                    width: AppSizes.youtubeLoadingIndicator,
                    height: AppSizes.youtubeLoadingIndicator,
                    child: CircularProgressIndicator(
                      strokeWidth: AppSpacing.xxxs,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md2 - AppSpacing.xxs),
                  Text(
                    title,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    description,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withValues(
                        alpha: 0.82,
                      ),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class YoutubeConnectRequiredState extends ConsumerWidget {
  const YoutubeConnectRequiredState({
    super.key,
    required this.title,
    required this.description,
    this.returnTo,
    this.ctaLabel = 'Connect YouTube',
  });

  final String title;
  final String description;
  final String? returnTo;
  final String ctaLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: AppSizes.authPanelMaxWidth),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Card(
            clipBehavior: Clip.antiAlias,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md2),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: AppSizes.youtubeEmptyStateIcon,
                    height: AppSizes.youtubeEmptyStateIcon,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(AppRadii.xl),
                    ),
                    child: Icon(
                      Icons.smart_display_rounded,
                      size: AppSizes.iconLarge,
                      color: theme.colorScheme.onErrorContainer,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md2 - AppSpacing.xxs),
                  Text(
                    title,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.xs + 2),
                  Text(
                    description,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.textTheme.bodySmall?.color,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.md2 - AppSpacing.xxs),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () =>
                          startYoutubeConnectFlow(context, returnTo: returnTo),
                      icon: const Icon(
                        Icons.open_in_new_rounded,
                        size: AppSizes.compactProgress,
                      ),
                      label: Text(ctaLabel),
                      style: FilledButton.styleFrom(
                        backgroundColor: theme.colorScheme.error,
                        foregroundColor: theme.colorScheme.onError,
                        padding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.sm2,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    kIsWeb
                        ? 'ReplayGlows redirects this tab to Google, then brings you back automatically after YouTube authorisation.'
                        : 'Google opens in this tab, then returns to ReplayGlows automatically.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withValues(
                        alpha: 0.74,
                      ),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class YoutubeConnectionSettingsCard extends ConsumerStatefulWidget {
  const YoutubeConnectionSettingsCard({
    super.key,
    this.returnTo = Routes.preferences,
  });

  final String returnTo;

  @override
  ConsumerState<YoutubeConnectionSettingsCard> createState() =>
      _YoutubeConnectionSettingsCardState();
}

class _YoutubeConnectionSettingsCardState
    extends ConsumerState<YoutubeConnectionSettingsCard> {
  bool _busy = false;
  Object? _inlineError;

  Future<void> _copyDiagnostics(Map<String, dynamic>? status) async {
    await Clipboard.setData(
      ClipboardData(text: _formatYoutubeDiagnostics(status)),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('YouTube diagnostics copied.')),
    );
  }

  Future<void> _runAction(Future<void> Function() action) async {
    final container = _providerContainer(context);
    setState(() {
      _busy = true;
      _inlineError = null;
    });

    try {
      await action();
      _invalidateYoutubeData(container);
      if (!mounted) return;
    } catch (e, st) {
      AppLogger.instance.log(
        'YouTube settings action failed',
        source: 'YoutubeConnect',
        level: LogLevel.warning,
        error: e,
        stackTrace: st,
      );
      if (!mounted) return;
      setState(() {
        _inlineError = e;
      });
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _connect() async {
    await _launchYoutubeConnect(context, returnTo: widget.returnTo);
  }

  Future<void> _disconnect() async {
    await _runAction(() async {
      await disconnectYoutube(ref);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('YouTube disconnected.')));
    });
  }

  Future<void> _syncNow() async {
    await _runAction(() async {
      await syncAllPlaylists(ref);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Sync complete. If this YouTube account is new, create a YouTube playlist or channel, then refresh again.',
          ),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final statusAsync = ref.watch(youtubeConnectionProvider);

    final status = statusAsync.asData?.value;
    final connected = status?['connected'] == true;
    final hasTokens = status?['hasTokens'] == true;
    final diagnosticsText = _formatYoutubeDiagnostics(status);

    final accentColor = connected ? colorScheme.primary : colorScheme.error;
    final icon = connected
        ? Icons.check_circle_rounded
        : Icons.smart_display_rounded;
    final title = connected ? 'YouTube connected' : 'Connect your YouTube';
    final description = connected
        ? 'ReplayGlows can now refresh your playlists and imported videos. Use this card to sync again or disconnect cleanly.'
        : hasTokens
        ? 'ReplayGlows found a partial YouTube authorisation. Connect YouTube again to refresh Google access cleanly.'
        : 'Authorise Google once to import your playlists, watch queue, and future video syncs directly in ReplayGlows.';

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.md,
      ),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: AppSizes.youtubeAction,
                    height: AppSizes.youtubeAction,
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(AppRadii.lg),
                    ),
                    child: Icon(icon, color: accentColor),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          description,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.textTheme.bodySmall?.color?.withValues(
                              alpha: 0.82,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm2),
              if (statusAsync.isLoading && status == null)
                const Row(
                  children: [
                    SizedBox(
                      width: AppSizes.iconSmall,
                      height: AppSizes.iconSmall,
                      child: CircularProgressIndicator(
                        strokeWidth: AppSpacing.xxxs,
                      ),
                    ),
                    SizedBox(width: AppSpacing.xs + AppSpacing.xxxs),
                    Text('Checking YouTube connection...'),
                  ],
                )
              else
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    if (!connected)
                      FilledButton.icon(
                        onPressed: _busy ? null : _connect,
                        icon: _busy
                            ? const SizedBox(
                                width: AppSizes.iconSmall,
                                height: AppSizes.iconSmall,
                                child: CircularProgressIndicator(
                                  strokeWidth: AppSpacing.xxxs,
                                ),
                              )
                            : const Icon(Icons.open_in_new_rounded),
                        label: const Text('Connect YouTube'),
                      ),
                    if (connected) ...[
                      FilledButton.icon(
                        onPressed: _busy ? null : _syncNow,
                        icon: _busy
                            ? const SizedBox(
                                width: AppSizes.iconSmall,
                                height: AppSizes.iconSmall,
                                child: CircularProgressIndicator(
                                  strokeWidth: AppSpacing.xxxs,
                                ),
                              )
                            : const Icon(Icons.sync_rounded),
                        label: const Text('Sync now'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _busy
                            ? null
                            : () => context.go(Routes.playlists),
                        icon: const Icon(Icons.queue_music_rounded),
                        label: const Text('Open playlists'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _busy ? null : _disconnect,
                        icon: const Icon(Icons.link_off_rounded),
                        label: const Text('Disconnect'),
                      ),
                    ],
                  ],
                ),
              if (connected || hasTokens) ...[
                const SizedBox(height: AppSpacing.sm),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                  ),
                  child: Text(
                    connected
                        ? 'Google authorisation is active for this account.'
                        : 'ReplayGlows found a partial YouTube authorisation. Reconnect YouTube to refresh access.',
                    style: theme.textTheme.bodySmall,
                  ),
                ),
              ],
              if (_inlineError != null) ...[
                const SizedBox(height: AppSpacing.sm),
                InlineErrorCard(
                  error: _inlineError!,
                  prefix: 'YouTube action failed',
                ),
              ],
              const SizedBox(height: AppSpacing.sm),
              Card(
                margin: EdgeInsets.zero,
                color: colorScheme.surfaceContainerHighest.withValues(
                  alpha: 0.45,
                ),
                child: ExpansionTile(
                  tilePadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 4,
                  ),
                  childrenPadding: const EdgeInsets.fromLTRB(
                    AppSpacing.sm,
                    0,
                    AppSpacing.sm,
                    AppSpacing.sm,
                  ),
                  leading: const Icon(
                    Icons.bug_report_outlined,
                    size: AppSpacing.md2,
                  ),
                  title: const Text('YouTube diagnostics'),
                  subtitle: Text(
                    connected
                        ? 'Connection confirmed. Copy recent sync logs if something still looks wrong.'
                        : hasTokens
                        ? 'ReplayGlows sees saved tokens but not a confirmed connected state yet.'
                        : 'Copy this if YouTube connect stalls or comes back incomplete.',
                    style: theme.textTheme.bodySmall,
                  ),
                  children: [
                    SizedBox(
                      width: double.infinity,
                      child: SelectableText(
                        diagnosticsText,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontFamily: 'monospace',
                          height: AppTypography.mediaLineHeight,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: OutlinedButton.icon(
                        onPressed: () => _copyDiagnostics(status),
                        icon: const Icon(Icons.copy_all_rounded),
                        label: const Text('Copy diagnostics'),
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

class YoutubeAwareEmptyState extends ConsumerWidget {
  const YoutubeAwareEmptyState({
    super.key,
    required this.fallbackIcon,
    required this.fallbackTitle,
    required this.fallbackDescription,
    this.onRefresh,
  });

  final IconData fallbackIcon;
  final String fallbackTitle;
  final String fallbackDescription;
  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(youtubeConnectionProvider);
    final connected = _isYoutubeConnected(async);

    if (!connected) {
      return _ConnectYoutubeEmptyState(
        loading: async.isLoading && async.asData == null,
      );
    }

    return _SimpleEmptyState(
      icon: fallbackIcon,
      title: fallbackTitle,
      description: fallbackDescription,
      action: onRefresh == null
          ? null
          : OutlinedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh, size: AppSizes.compactProgress),
              label: const Text('Refresh'),
            ),
    );
  }
}

class _ConnectYoutubeEmptyState extends ConsumerWidget {
  const _ConnectYoutubeEmptyState({required this.loading});

  final bool loading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: AppSizes.authPanelMaxWidth),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: AppSizes.youtubeConnectedIcon,
                height: AppSizes.youtubeConnectedIcon,
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(AppRadii.xl),
                ),
                child: Icon(
                  Icons.smart_display_rounded,
                  size: AppSizes.iconLarge,
                  color: theme.colorScheme.onErrorContainer,
                ),
              ),
              const SizedBox(height: AppSpacing.md2),
              Text(
                'Connect YouTube before you start',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xs + AppSpacing.xxxs),
              Text(
                'ReplayGlows needs Google access once to import your playlists and keep your video library in sync.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.textTheme.bodySmall?.color,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md + AppSpacing.xxxs),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: loading
                      ? null
                      : () => _launchYoutubeConnect(context),
                  icon: loading
                      ? const SizedBox(
                          width: AppSizes.iconSmall,
                          height: AppSizes.iconSmall,
                          child: CircularProgressIndicator(
                            strokeWidth: AppSpacing.xxxs,
                          ),
                        )
                      : const Icon(
                          Icons.open_in_new_rounded,
                          size: AppSizes.compactProgress,
                        ),
                  label: Text(
                    loading ? 'Checking status...' : 'Connect YouTube',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.error,
                    foregroundColor: theme.colorScheme.onError,
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.sm2,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                kIsWeb
                    ? 'ReplayGlows redirects this tab to Google, then returns you to the same screen after YouTube authorisation.'
                    : 'Google opens in this tab, then returns to ReplayGlows automatically.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.textTheme.bodySmall?.color?.withValues(
                    alpha: 0.74,
                  ),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SimpleEmptyState extends StatelessWidget {
  const _SimpleEmptyState({
    required this.icon,
    required this.title,
    required this.description,
    this.action,
  });

  final IconData icon;
  final String title;
  final String description;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: AppSizes.emptyStateIcon,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              description,
              style: theme.textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
            if (action != null) ...[
              const SizedBox(height: AppSpacing.md),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
