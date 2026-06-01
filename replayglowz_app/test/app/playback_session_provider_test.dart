import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:replayglowz_app/providers/providers.dart';

void main() {
  test('playback session stores source context and current index', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container
        .read(playbackSessionProvider.notifier)
        .start(
          sourceType: PlaybackSourceType.playlist,
          sourceId: 'playlist:1',
          sourceTitle: 'Learning queue',
          items: const [
            PlaybackQueueItem(youtubeVideoId: 'video-a', title: 'A'),
            PlaybackQueueItem(youtubeVideoId: 'video-b', title: 'B'),
            PlaybackQueueItem(youtubeVideoId: 'video-c', title: 'C'),
          ],
          currentVideoId: 'video-b',
        );

    final session = container.read(playbackSessionProvider);
    expect(session.sourceType, PlaybackSourceType.playlist);
    expect(session.sourceId, 'playlist:1');
    expect(session.displayTitle, 'Learning queue');
    expect(session.currentVideoId, 'video-b');
    expect(session.previousBefore('video-b'), 'video-a');
    expect(session.nextAfter('video-b'), 'video-c');
  });

  test('markCurrent falls back to a direct session for unknown videos', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container
        .read(playbackSessionProvider.notifier)
        .start(
          sourceType: PlaybackSourceType.feed,
          sourceTitle: 'Feed',
          items: const [
            PlaybackQueueItem(youtubeVideoId: 'video-a'),
            PlaybackQueueItem(youtubeVideoId: 'video-b'),
          ],
          currentVideoId: 'video-a',
        );

    container
        .read(playbackSessionProvider.notifier)
        .markCurrent('direct-video');

    final session = container.read(playbackSessionProvider);
    expect(session.sourceType, PlaybackSourceType.direct);
    expect(session.currentVideoId, 'direct-video');
    expect(session.hasQueue, isFalse);
  });
}
