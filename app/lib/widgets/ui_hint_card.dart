import 'package:flutter/material.dart';
import 'package:replayglowz_app/app/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

class UiHintCard extends StatefulWidget {
  const UiHintCard({
    super.key,
    required this.hintId,
    required this.title,
    required this.message,
    this.icon = Icons.lightbulb_outline,
    this.actionLabel,
    this.onAction,
  });

  final String hintId;
  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  State<UiHintCard> createState() => _UiHintCardState();
}

class _UiHintCardState extends State<UiHintCard> {
  static const _prefix = 'ui_hint_dismissed:';
  bool _loading = true;
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    _loadState();
  }

  Future<void> _loadState() async {
    final prefs = await SharedPreferences.getInstance();
    final dismissed = prefs.getBool('$_prefix${widget.hintId}') ?? false;
    if (!mounted) return;
    setState(() {
      _dismissed = dismissed;
      _loading = false;
    });
  }

  Future<void> _dismiss() async {
    setState(() => _dismissed = true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$_prefix${widget.hintId}', true);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _dismissed) {
      return const SizedBox.shrink();
    }

    return Card(
      margin: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.xxs,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(widget.icon, size: AppSpacing.md2),
            const SizedBox(width: AppSpacing.xs + AppSpacing.xxxs),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.title,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(widget.message),
                  if (widget.actionLabel != null && widget.onAction != null)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.xs),
                      child: FilledButton.tonal(
                        onPressed: widget.onAction,
                        child: Text(widget.actionLabel!),
                      ),
                    ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close),
              tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
              onPressed: _dismiss,
            ),
          ],
        ),
      ),
    );
  }
}
