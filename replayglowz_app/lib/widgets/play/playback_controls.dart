import 'package:flutter/material.dart';

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
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              SizedBox(
                width: 42,
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
                width: 42,
                child: Text(
                  formatTime(maxSeconds),
                  style: textStyle,
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
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
              IconButton(
                tooltip: 'Back 30 seconds',
                constraints: const BoxConstraints.tightFor(
                  width: 38,
                  height: 38,
                ),
                padding: EdgeInsets.zero,
                iconSize: 22,
                icon: const Icon(Icons.replay_30),
                onPressed: onBackThirty,
              ),
              IconButton(
                tooltip: 'Back 10 seconds',
                constraints: const BoxConstraints.tightFor(
                  width: 38,
                  height: 38,
                ),
                padding: EdgeInsets.zero,
                iconSize: 22,
                icon: const Icon(Icons.replay_10),
                onPressed: onBackTen,
              ),
              IconButton(
                tooltip: 'Forward 10 seconds',
                constraints: const BoxConstraints.tightFor(
                  width: 38,
                  height: 38,
                ),
                padding: EdgeInsets.zero,
                iconSize: 22,
                icon: const Icon(Icons.forward_10),
                onPressed: onForwardTen,
              ),
              IconButton(
                tooltip: 'Forward 30 seconds',
                constraints: const BoxConstraints.tightFor(
                  width: 38,
                  height: 38,
                ),
                padding: EdgeInsets.zero,
                iconSize: 22,
                icon: const Icon(Icons.forward_30),
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
    return Tooltip(
      message: tooltip,
      child: InkResponse(
        onTap: onPressed,
        radius: 22,
        child: SizedBox(
          width: 38,
          height: 38,
          child: Center(
            child: Text(
              label,
              maxLines: 1,
              style: theme.textTheme.labelSmall?.copyWith(
                color: colorScheme.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
