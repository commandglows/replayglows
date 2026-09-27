import 'package:flutter/material.dart';

/// Shows a saved watch position as a compact red-to-green line.
class WatchProgressBar extends StatelessWidget {
  const WatchProgressBar({
    super.key,
    required this.progressSeconds,
    required this.durationSeconds,
    this.completed = false,
    this.height = 3,
  });

  final double? progressSeconds;
  final double? durationSeconds;
  final bool completed;
  final double height;

  @override
  Widget build(BuildContext context) {
    final total = durationSeconds;
    final current = progressSeconds;
    if (!completed &&
        (current == null ||
            !current.isFinite ||
            current <= 0 ||
            total == null ||
            !total.isFinite ||
            total <= 0)) {
      return const SizedBox.shrink();
    }

    final ratio = completed ? 1.0 : (current! / total!).clamp(0.0, 1.0);
    final color = completed ? const Color(0xFF22C55E) : _colorAt(ratio);
    return Semantics(
      label: completed
          ? 'Video watched'
          : 'Video progress ${(ratio * 100).round()} percent',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(height),
        child: SizedBox(
          height: height,
          child: ColoredBox(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: Align(
              alignment: Alignment.centerLeft,
              child: FractionallySizedBox(
                widthFactor: ratio,
                child: ColoredBox(color: color),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Color _colorAt(double ratio) {
    const stops = <(double, Color)>[
      (0, Color(0xFFEF4444)),
      (0.33, Color(0xFFF97316)),
      (0.66, Color(0xFFEAB308)),
      (0.94, Color(0xFF22C55E)),
    ];
    for (var index = 0; index < stops.length - 1; index++) {
      final (start, startColor) = stops[index];
      final (end, endColor) = stops[index + 1];
      if (ratio <= end) {
        return Color.lerp(
          startColor,
          endColor,
          (ratio - start) / (end - start),
        )!;
      }
    }
    return stops.last.$2;
  }
}
