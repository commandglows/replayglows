import 'package:flutter_test/flutter_test.dart';
import 'package:replayglowz_app/models/settings.dart';

void main() {
  group('UserSettings.fromJson', () {
    test('keeps backward compatibility when ux is absent', () {
      final settings = UserSettings.fromJson({
        '_id': 'settings:legacy',
        'userId': 'user:1',
        'theme': 'system',
      });

      expect(settings.ux.dismissedHints, isEmpty);
      expect(settings.ux.feed.selectedTab, isNull);
      expect(settings.ux.player.layout, isNull);
    });

    test('ignores invalid ux values instead of throwing', () {
      final settings = UserSettings.fromJson({
        '_id': 'settings:invalid',
        'userId': 'user:2',
        'theme': 'light',
        'ux': {
          'dismissedHints': ['hint.feed.swipe', 1, true],
          'feed': {
            'selectedTab': 'unknown',
            'viewMode': 'broken',
            'showWatched': 'yes',
          },
          'playlists': {
            'viewMode': 'grid',
            'layout': 'compact',
            'lastFilterPlaylistId': 999,
          },
          'notes': {'sortOrder': 'desc', 'viewMode': 'compact'},
          'player': {
            'layout': 'focus',
            'focusMode': true,
            'shortcutsHintDismissed': false,
          },
        },
      });

      expect(settings.ux.dismissedHints, ['hint.feed.swipe']);
      expect(settings.ux.feed.selectedTab, isNull);
      expect(settings.ux.feed.viewMode, isNull);
      expect(settings.ux.feed.showWatched, isNull);
      expect(settings.ux.playlists.viewMode, CollectionViewMode.grid);
      expect(settings.ux.playlists.layout, DensityLayout.compact);
      expect(settings.ux.playlists.lastFilterPlaylistId, isNull);
      expect(settings.ux.notes.sortOrder, NoteSortOrder.desc);
      expect(settings.ux.notes.viewMode, NotesViewMode.compact);
      expect(settings.ux.player.layout, PlayerLayoutPreference.focus);
      expect(settings.ux.player.focusMode, isTrue);
      expect(settings.ux.player.shortcutsHintDismissed, isFalse);
    });
  });

  group('UxSettings.toJson', () {
    test('serializes only non-empty optional sections', () {
      const ux = UxSettings(
        dismissedHints: ['hint.player.shortcuts'],
        player: UxPlayerSettings(
          layout: PlayerLayoutPreference.theater,
          focusMode: true,
        ),
      );

      final json = ux.toJson();
      expect(json['dismissedHints'], ['hint.player.shortcuts']);
      expect((json['player'] as Map<String, dynamic>)['layout'], 'theater');
      expect((json['player'] as Map<String, dynamic>)['focusMode'], isTrue);
      expect(json.containsKey('feed'), isFalse);
      expect(json.containsKey('playlists'), isFalse);
      expect(json.containsKey('notes'), isFalse);
    });
  });
}
