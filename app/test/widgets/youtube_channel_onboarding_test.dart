import 'package:flutter_test/flutter_test.dart';
import 'package:replayglowz_app/widgets/youtube_channel_onboarding.dart';

void main() {
  group('validateYoutubePlaylistUrl', () {
    test('accepts standard YouTube playlist URLs and raw playlist ids', () {
      expect(
        validateYoutubePlaylistUrl(
          'https://www.youtube.com/playlist?list=PL123_abc-xyz',
        ),
        YoutubePlaylistUrlValidation.valid,
      );
      expect(
        validateYoutubePlaylistUrl('PL123_abc-xyz'),
        YoutubePlaylistUrlValidation.valid,
      );
    });

    test('rejects unsupported special playlists', () {
      expect(
        validateYoutubePlaylistUrl('https://www.youtube.com/playlist?list=WL'),
        YoutubePlaylistUrlValidation.specialPlaylist,
      );
      expect(
        validateYoutubePlaylistUrl('LL'),
        YoutubePlaylistUrlValidation.specialPlaylist,
      );
    });

    test('rejects non-YouTube URLs and URLs without list ids', () {
      expect(
        validateYoutubePlaylistUrl('https://example.com/playlist?list=PL123'),
        YoutubePlaylistUrlValidation.notYoutube,
      );
      expect(
        validateYoutubePlaylistUrl('https://www.youtube.com/watch?v=abc'),
        YoutubePlaylistUrlValidation.missingList,
      );
    });
  });
}
