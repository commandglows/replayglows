import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:replayglowz_app/app/theme.dart';

bool _isFrench(BuildContext context) =>
    Localizations.localeOf(context).languageCode == 'fr';

String _copyLabel(BuildContext context) =>
    _isFrench(context) ? 'Copier' : 'Copy';

String _retryLabel(BuildContext context) =>
    _isFrench(context) ? 'Réessayer' : 'Retry';

Color _snackBarForegroundColor(BuildContext context) {
  final theme = Theme.of(context);
  return theme.snackBarTheme.contentTextStyle?.color ??
      theme.colorScheme.onInverseSurface;
}

String formatErrorMessage(Object error, {String? prefix}) {
  final message = error.toString().trim();
  if (prefix == null || prefix.isEmpty) {
    return message;
  }
  return '$prefix: $message';
}

Future<void> copyErrorToClipboard(
  BuildContext context,
  Object error, {
  String? prefix,
}) async {
  final message = formatErrorMessage(error, prefix: prefix);
  await Clipboard.setData(ClipboardData(text: message));

  if (!context.mounted) return;

  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(_isFrench(context) ? 'Erreur copiée' : 'Error copied'),
      duration: AppMotion.feedback,
    ),
  );
}

void showErrorSnackBar(
  BuildContext context, {
  required Object error,
  String? prefix,
}) {
  final message = formatErrorMessage(error, prefix: prefix);
  final foregroundColor = _snackBarForegroundColor(context);

  final messenger = ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      duration: AppMotion.persistentError,
      showCloseIcon: true,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(message, maxLines: 6, overflow: TextOverflow.ellipsis),
          const SizedBox(height: AppSpacing.xs),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              style: TextButton.styleFrom(
                foregroundColor: foregroundColor,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                minimumSize: const Size(0, AppSizes.minTouchTarget),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              onPressed: () {
                copyErrorToClipboard(context, error, prefix: prefix);
              },
              icon: const Icon(Icons.copy, size: AppSizes.iconSmall),
              label: Text(_copyLabel(context)),
            ),
          ),
        ],
      ),
    ),
  );
}

class InlineErrorCard extends StatelessWidget {
  const InlineErrorCard({super.key, required this.error, this.prefix});

  final Object error;
  final String? prefix;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final message = formatErrorMessage(error, prefix: prefix);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colorScheme.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SelectableText(
            message,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: colorScheme.error),
          ),
          const SizedBox(height: AppSpacing.xs),
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton.icon(
              onPressed: () =>
                  copyErrorToClipboard(context, error, prefix: prefix),
              icon: const Icon(Icons.copy, size: AppSizes.iconSmall),
              label: Text(_copyLabel(context)),
            ),
          ),
        ],
      ),
    );
  }
}

class ErrorStateView extends StatelessWidget {
  const ErrorStateView({
    super.key,
    required this.error,
    this.prefix,
    this.onRetry,
    this.centered = true,
  });

  final Object error;
  final String? prefix;
  final VoidCallback? onRetry;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    final message = formatErrorMessage(error, prefix: prefix);
    final content = LayoutBuilder(
      builder: (context, constraints) {
        final textWidth = constraints.maxWidth.isFinite
            ? (constraints.maxWidth > 320.0 ? 320.0 : constraints.maxWidth)
            : 320.0;

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline,
              size: AppSpacing.xxl,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: AppSpacing.md),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  SizedBox(
                    width: textWidth,
                    child: Text(
                      message,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: () =>
                        copyErrorToClipboard(context, error, prefix: prefix),
                    icon: const Icon(Icons.copy, size: AppSizes.iconSmall),
                    label: Text(_copyLabel(context)),
                  ),
                ],
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.md),
              FilledButton.tonal(
                onPressed: onRetry,
                child: Text(_retryLabel(context)),
              ),
            ],
          ],
        );
      },
    );

    if (!centered) {
      return content;
    }

    return Center(child: content);
  }
}
