import 'dart:async';

import 'package:flutter/material.dart';
import 'package:replayglowz_app/app/theme.dart';

Color? _controlOverlayColor(ColorScheme colorScheme, Set<WidgetState> states) {
  if (states.contains(WidgetState.pressed)) {
    return colorScheme.primary.withValues(alpha: 0.16);
  }
  if (states.contains(WidgetState.focused) ||
      states.contains(WidgetState.hovered)) {
    return colorScheme.primary.withValues(alpha: 0.10);
  }
  return null;
}

class PlaybackControlsPanel extends StatelessWidget {
  const PlaybackControlsPanel({
    super.key,
    required this.currentSeconds,
    required this.maxSeconds,
    this.onChangeStart,
    required this.onChanged,
    required this.onSeekEnd,
    required this.onSpeedDownHalf,
    required this.onSpeedDownTenth,
    required this.onBackThirty,
    required this.onBackTen,
    required this.onForwardTen,
    required this.onForwardThirty,
    required this.onSpeedUpTenth,
    required this.onSpeedUpHalf,
    required this.formatTime,
  });

  final double currentSeconds;
  final double maxSeconds;
  final ValueChanged<double>? onChangeStart;
  final ValueChanged<double> onChanged;
  final ValueChanged<double> onSeekEnd;
  final VoidCallback onSpeedDownHalf;
  final VoidCallback onSpeedDownTenth;
  final VoidCallback onBackThirty;
  final VoidCallback onBackTen;
  final VoidCallback onForwardTen;
  final VoidCallback onForwardThirty;
  final VoidCallback onSpeedUpTenth;
  final VoidCallback onSpeedUpHalf;
  final String Function(double seconds) formatTime;

  @override
  Widget build(BuildContext context) {
    final textStyle = Theme.of(context).textTheme.labelSmall;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        0,
        AppSpacing.xxs,
        0,
        AppSpacing.xxs + 2,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              SizedBox(
                width: AppSpacing.xxl - AppSpacing.xs,
                child: Text(
                  formatTime(currentSeconds),
                  style: textStyle,
                  textAlign: TextAlign.left,
                ),
              ),
              Expanded(
                child: Slider(
                  value: currentSeconds,
                  max: maxSeconds,
                  onChangeStart: onChangeStart,
                  onChanged: onChanged,
                  onChangeEnd: onSeekEnd,
                ),
              ),
              SizedBox(
                width: AppSpacing.xxl - AppSpacing.xs,
                child: Text(
                  formatTime(maxSeconds),
                  style: textStyle,
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
          Row(
            children: [
              _RateStepButton(
                label: '-50',
                tooltip: 'Slow down by 0.50x',
                onPressed: onSpeedDownHalf,
              ),
              _RateStepButton(
                label: '-10',
                tooltip: 'Slow down by 0.10x',
                onPressed: onSpeedDownTenth,
              ),
              _SeekStepButton(
                icon: Icons.replay_30,
                tooltip: 'Back 30 seconds',
                onPressed: onBackThirty,
              ),
              _SeekStepButton(
                icon: Icons.replay_10,
                tooltip: 'Back 10 seconds',
                onPressed: onBackTen,
              ),
              _SeekStepButton(
                icon: Icons.forward_10,
                tooltip: 'Forward 10 seconds',
                onPressed: onForwardTen,
              ),
              _SeekStepButton(
                icon: Icons.forward_30,
                tooltip: 'Forward 30 seconds',
                onPressed: onForwardThirty,
              ),
              _RateStepButton(
                label: '+10',
                tooltip: 'Speed up by 0.10x',
                onPressed: onSpeedUpTenth,
              ),
              _RateStepButton(
                label: '+50',
                tooltip: 'Speed up by 0.50x',
                onPressed: onSpeedUpHalf,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SeekStepButton extends StatelessWidget {
  const _SeekStepButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return _ControlFeedbackCell(
      tooltip: tooltip,
      onPressed: onPressed,
      child: Center(
        child: Icon(
          icon,
          size: AppSizes.iconMedium,
          color: colorScheme.primary,
        ),
      ),
    );
  }
}

class _ControlFeedbackCell extends StatefulWidget {
  const _ControlFeedbackCell({
    required this.tooltip,
    required this.onPressed,
    required this.child,
  });

  final String tooltip;
  final VoidCallback onPressed;
  final Widget child;

  @override
  State<_ControlFeedbackCell> createState() => _ControlFeedbackCellState();
}

class _ControlFeedbackCellState extends State<_ControlFeedbackCell> {
  Timer? _pressedTimer;
  bool _pressed = false;
  bool _hovered = false;
  bool _focused = false;

  @override
  void dispose() {
    _pressedTimer?.cancel();
    super.dispose();
  }

  void _setPressed(bool pressed) {
    _pressedTimer?.cancel();
    if (!mounted) return;
    setState(() => _pressed = pressed);
  }

  void _releasePressedSoon() {
    _pressedTimer?.cancel();
    _pressedTimer = Timer(const Duration(milliseconds: 140), () {
      if (!mounted) return;
      setState(() => _pressed = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final backgroundColor = _pressed
        ? colorScheme.primary.withValues(alpha: 0.22)
        : _hovered || _focused
        ? colorScheme.primary.withValues(alpha: 0.12)
        : colorScheme.surface.withValues(alpha: 0);

    return Expanded(
      child: Tooltip(
        message: widget.tooltip,
        child: FocusableActionDetector(
          onShowHoverHighlight: (value) => setState(() => _hovered = value),
          onShowFocusHighlight: (value) => setState(() => _focused = value),
          child: AnimatedScale(
            scale: _pressed ? 0.96 : 1,
            duration: const Duration(milliseconds: 90),
            curve: Curves.easeOut,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 110),
              curve: Curves.easeOut,
              color: backgroundColor,
              child: Material(
                type: MaterialType.transparency,
                child: InkWell(
                  onTap: widget.onPressed,
                  onTapDown: (_) => _setPressed(true),
                  onTapUp: (_) => _releasePressedSoon(),
                  onTapCancel: _releasePressedSoon,
                  overlayColor: WidgetStateProperty.resolveWith(
                    (states) => _controlOverlayColor(colorScheme, states),
                  ),
                  child: SizedBox(
                    height: 44,
                    width: double.infinity,
                    child: widget.child,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RateStepButton extends StatelessWidget {
  const _RateStepButton({
    required this.label,
    required this.tooltip,
    required this.onPressed,
  });

  final String label;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return _ControlFeedbackCell(
      tooltip: tooltip,
      onPressed: onPressed,
      child: Center(
        child: Text(
          label,
          maxLines: 1,
          style: theme.textTheme.labelMedium?.copyWith(
            color: colorScheme.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
