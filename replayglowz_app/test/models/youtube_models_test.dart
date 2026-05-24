import 'package:flutter_test/flutter_test.dart';
import 'package:replayglowz_app/models/playlist.dart';
import 'package:replayglowz_app/models/video.dart';

void main() {
  group('YouTubePlaylist.fromJson', () {
    test('accepts backend cache projection fields', () {
      final playlist = YouTubePlaylist.fromJson({
        '_id': 'doc-playlist',
        'id': 'PL123',
        'youtubePlaylistId': 'PL123',
        'title': 'ReplayGlowz',
        'description': null,
        'thumbnailUrl': null,
        'customThumbnailUrl': null,
        'videoCount': 2,
        'originalVideoCount': 5,
        'privacyStatus': 'public',
        'publishedAt': '2026-05-24T20:00:00Z',
        'lastVideoAddedAt': '2026-05-24T21:00:00Z',
        'cachedAt': 1760000000000,
        'isStale': false,
      });

      expect(playlist.id, 'doc-playlist');
      expect(playlist.youtubePlaylistId, 'PL123');
      expect(playlist.description, isNull);
      expect(playlist.thumbnailUrl, isNull);
      expect(playlist.videoCount, 2);
      expect(playlist.originalVideoCount, 5);
      expect(playlist.lastVideoAddedAt, isA<int>());
    });

    test('falls back to id when youtubePlaylistId is absent', () {
      final playlist = YouTubePlaylist.fromJson({
        'id': 'PL456',
        'title': 'Imported',
        'videoCount': 1,
        'privacyStatus': 'private',
        'cachedAt': 1760000000000,
      });

      expect(playlist.id, 'PL456');
      expect(playlist.youtubePlaylistId, 'PL456');
    });
  });

  group('YouTubeVideo.fromJson', () {
    test('accepts getAllVideos projection fields', () {
      final video = YouTubeVideo.fromJson({
        '_id': 'doc-video',
        'id': 'vid123',
        'youtubeVideoId': 'vid123',
        'playlistId': 'PL123',
        'youtubePlaylistId': 'PL123',
        'title': 'A synced video',
        'description': null,
        'thumbnailUrl': null,
        'channelTitle': 'Creator',
        'channelThumbnailUrl': null,
        'duration': 'PT1M',
        'publishedAt': '2026-05-24T20:00:00Z',
        'cachedAt': 1760000000000,
        'playlistTitle': 'ReplayGlowz',
      });

      expect(video.id, 'doc-video');
      expect(video.youtubeVideoId, 'vid123');
      expect(video.playlistId, 'PL123');
      expect(video.description, isNull);
      expect(video.thumbnailUrl, isNull);
      expect(video.channelTitle, 'Creator');
    });

    test('falls back to id and playlistId for compact projections', () {
      final video = YouTubeVideo.fromJson({
        'id': 'vid456',
        'playlistId': 'PL456',
        'title': 'Compact video',
        'cachedAt': 1760000000000,
      });

      expect(video.id, 'vid456');
      expect(video.youtubeVideoId, 'vid456');
      expect(video.playlistId, 'PL456');
      expect(video.channelTitle, '');
    });
  });
}
