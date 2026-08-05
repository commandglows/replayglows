import 'package:flutter_test/flutter_test.dart';
import 'package:replayglows_app/models/playlist.dart';
import 'package:replayglows_app/models/transcript.dart';
import 'package:replayglows_app/models/video.dart';
import 'package:replayglows_app/models/youtube_channel.dart';

void main() {
  group('YouTubePlaylist.fromJson', () {
    test('accepts backend cache projection fields', () {
      final playlist = YouTubePlaylist.fromJson({
        '_id': 'doc-playlist',
        'id': 'PL123',
        'youtubePlaylistId': 'PL123',
        'title': 'ReplayGlows',
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
        'source': 'url_import',
        'importedByUrlAt': '2026-05-24T21:30:00Z',
        'importedPlaylistId': 'PL123',
      });

      expect(playlist.id, 'doc-playlist');
      expect(playlist.youtubePlaylistId, 'PL123');
      expect(playlist.description, isNull);
      expect(playlist.thumbnailUrl, isNull);
      expect(playlist.videoCount, 2);
      expect(playlist.originalVideoCount, 5);
      expect(playlist.lastVideoAddedAt, isA<int>());
      expect(playlist.source, 'url_import');
      expect(playlist.importedByUrlAt, isA<int>());
      expect(playlist.importedPlaylistId, 'PL123');
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
        'playlistTitle': 'ReplayGlows',
      });

      expect(video.id, 'doc-video');
      expect(video.youtubeVideoId, 'vid123');
      expect(video.playlistId, 'PL123');
      expect(video.playlistItemId, isNull);
      expect(video.description, isNull);
      expect(video.thumbnailUrl, isNull);
      expect(video.channelTitle, 'Creator');
    });

    test('keeps playlist item id for YouTube playlist mutations', () {
      final video = YouTubeVideo.fromJson({
        '_id': 'doc-video',
        'id': 'vid789',
        'youtubeVideoId': 'vid789',
        'playlistId': 'PL789',
        'playlistItemId': 'PLI789',
        'title': 'Mutable playlist item',
        'cachedAt': 1760000000000,
      });

      expect(video.id, 'doc-video');
      expect(video.youtubeVideoId, 'vid789');
      expect(video.playlistItemId, 'PLI789');
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

    test('flags strong short metadata as short-form', () {
      final video = YouTubeVideo.fromJson({
        'id': 'vidShort',
        'youtubeVideoId': 'vidShort',
        'playlistId': 'PL456',
        'title': 'Quick tip #shorts',
        'description': '',
        'duration': 'PT45S',
        'cachedAt': 1760000000000,
      });

      expect(video.shortFormSignalScore, greaterThanOrEqualTo(2));
      expect(video.isProbablyShortForm, isTrue);
    });

    test('does not flag normal long-form video as short-form', () {
      final video = YouTubeVideo.fromJson({
        'id': 'vidLong',
        'youtubeVideoId': 'vidLong',
        'playlistId': 'PL456',
        'title': 'Deep dive walkthrough',
        'description': 'A normal tutorial episode',
        'duration': 'PT12M15S',
        'cachedAt': 1760000000000,
      });

      expect(video.shortFormSignalScore, lessThan(2));
      expect(video.isProbablyShortForm, isFalse);
    });

    test('prefers backend short classification when present', () {
      final video = YouTubeVideo.fromJson({
        'id': 'vidBackendShort',
        'youtubeVideoId': 'vidBackendShort',
        'playlistId': 'PL456',
        'title': 'Clip',
        'duration': '4:20',
        'thumbnailWidth': 720,
        'thumbnailHeight': 1280,
        'shortFormSignalScore': 3,
        'isShortForm': true,
        'cachedAt': 1760000000000,
      });

      expect(video.shortFormSignalScore, 3);
      expect(video.isProbablyShortForm, isTrue);
    });
  });

  group('decodeYouTubeVideoList', () {
    test('accepts paginated getAllVideos response objects', () {
      final videos = decodeYouTubeVideoList({
        'page': [
          {
            'id': 'vid123',
            'youtubeVideoId': 'vid123',
            'playlistId': 'PL123',
            'title': 'Queued video',
            'cachedAt': 1760000000000,
          },
        ],
        'isDone': true,
        'continueCursor': null,
      });

      expect(videos, hasLength(1));
      expect(videos.single.youtubeVideoId, 'vid123');
      expect(videos.single.playlistId, 'PL123');
      expect(videos.single.title, 'Queued video');
    });

    test('accepts legacy raw list JSON strings', () {
      final videos = decodeYouTubeVideoList('''
[
  {
    "id": "vid456",
    "youtubeVideoId": "vid456",
    "youtubePlaylistId": "PL456",
    "title": "Legacy video",
    "cachedAt": 1760000000000
  }
]
''');

      expect(videos, hasLength(1));
      expect(videos.single.youtubeVideoId, 'vid456');
      expect(videos.single.playlistId, 'PL456');
    });
  });

  group('YouTubeChannel.fromJson', () {
    test('accepts cached subscription projection fields', () {
      final channel = YouTubeChannel.fromJson({
        'youtubeChannelId': 'UC123',
        'title': 'Creator',
        'description': 'Channel description',
        'thumbnailUrl': 'https://example.com/thumb.jpg',
      });

      expect(channel.youtubeChannelId, 'UC123');
      expect(channel.title, 'Creator');
      expect(channel.description, 'Channel description');
      expect(channel.thumbnailUrl, contains('thumb.jpg'));
    });

    test('accepts Convex channel id projection as channel id fallback', () {
      final channel = YouTubeChannel.fromJson({
        'id': 'UC_FROM_ID',
        'title': 'Creator from id',
      });

      expect(channel.youtubeChannelId, 'UC_FROM_ID');
      expect(channel.title, 'Creator from id');
    });
  });

  group('ChannelPlaylistLink.fromJson', () {
    test('accepts channel link projection fields', () {
      final link = ChannelPlaylistLink.fromJson({
        'id': 'link123',
        'youtubeChannelId': 'UC123',
        'channelTitle': 'Creator',
        'youtubePlaylistId': 'PL123',
        'linkedAt': 1760000000000,
        'lastSyncedAt': 1760000000100,
        'isActive': false,
      });

      expect(link.id, 'link123');
      expect(link.youtubeChannelId, 'UC123');
      expect(link.youtubePlaylistId, 'PL123');
      expect(link.isActive, isFalse);
      expect(link.lastSyncedAt, 1760000000100);
    });
  });

  group('TranscriptProviderCatalogItem.fromJson', () {
    test('accepts backend isAvailable and maskedSecret fields', () {
      final item = TranscriptProviderCatalogItem.fromJson({
        'id': 'openai',
        'label': 'OpenAI',
        'description': 'Premium provider',
        'type': 'paid_api',
        'requiresSecret': true,
        'secretProvider': 'openai',
        'requiresWorker': true,
        'priceLabel': 'Billed by OpenAI',
        'speedLabel': 'Fast',
        'qualityLabel': 'Excellent',
        'recommendedUse': 'Premium rerun',
        'isAvailable': true,
        'maskedSecret': '....abcd',
      });

      expect(item.id?.toJson(), 'openai');
      expect(item.available, isTrue);
      expect(item.maskedSecret, '....abcd');
    });
  });
}
