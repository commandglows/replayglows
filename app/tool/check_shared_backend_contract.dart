import 'dart:io';

const _requiredFunctions = <String>[
  'users:ensureUser',
  'users:getCurrentUser',
  'users:getProductAccessStatus',
  'settings:getSettings',
  'subscriptions:getSubscription',
  'youtube:getYoutubeConnectionStatus',
  'feedback:isAdmin',
  'feedback:listAdmin',
  'notifications:getNotifications',
  'notifications:getUnreadCount',
];

void main() {
  final backendRoot = _resolveBackendRoot();
  if (!backendRoot.existsSync()) {
    stderr.writeln(
      'ReplayGlows product backend not found at ${backendRoot.path}.\n'
      'Set REPLAYGLOWS_BACKEND_ROOT to the ReplayGlows product Convex backend directory if needed.',
    );
    exitCode = 1;
    return;
  }

  final missing = <String>[];

  for (final functionPath in _requiredFunctions) {
    final parts = functionPath.split(':');
    final moduleName = parts.first;
    final exportName = parts.last;
    final file = File('${backendRoot.path}/$moduleName.ts');
    if (!file.existsSync()) {
      missing.add('$functionPath (missing file ${file.path})');
      continue;
    }

    final source = file.readAsStringSync();
    final expectedExport = 'export const $exportName =';
    if (!source.contains(expectedExport)) {
      missing.add('$functionPath (missing `$expectedExport`)');
    }
  }

  if (missing.isEmpty) {
    stdout.writeln(
      'ReplayGlows product backend contract OK: ${_requiredFunctions.length} critical '
      'ReplayGlows product backend functions found in ${backendRoot.path}',
    );
    return;
  }

  stderr.writeln('ReplayGlows product backend contract check failed:');
  for (final item in missing) {
    stderr.writeln('- $item');
  }
  exitCode = 1;
}

Directory _resolveBackendRoot() {
  final fromEnv = Platform.environment['REPLAYGLOWS_BACKEND_ROOT'];
  if (fromEnv != null && fromEnv.trim().isNotEmpty) {
    return Directory(fromEnv.trim());
  }

  final candidates = <String>[
    'backend/packages/backend/convex',
    '../backend/packages/backend/convex',
  ];
  for (final candidate in candidates) {
    final directory = Directory(candidate);
    if (directory.existsSync()) {
      return directory;
    }
  }

  return Directory(candidates.first);
}
