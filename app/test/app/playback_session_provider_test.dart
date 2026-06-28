import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:replayglowz_app/models/models.dart';
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

  test('playback queue items preserve channel metadata from videos', () {
    const video = YouTubeVideo(
      id: 'doc-1',
      youtubeVideoId: 'video-a',
      playlistId: 'playlist-1',
      title: 'A',
      channelTitle: 'Channel A',
      youtubeChannelId: 'channel-a',
      cachedAt: 1,
    );

    final item = PlaybackQueueItem.fromVideo(video);

    expect(item.youtubeVideoId, 'video-a');
    expect(item.channelTitle, 'Channel A');
    expect(item.youtubeChannelId, 'channel-a');
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

  test(
    'playback controller preview does not trigger previous or next requests',
    () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final controller = container.read(appPlaybackControllerProvider.notifier);
      controller.setActiveVideo(true);

      controller.showPreviousPreview();
      var state = container.read(appPlaybackControllerProvider);
      expect(state.previewDirection, PlaybackPreviewDirection.previous);
      expect(state.previousRequestId, 0);
      expect(state.nextRequestId, 0);

      controller.showNextPreview();
      state = container.read(appPlaybackControllerProvider);
      expect(state.previewDirection, PlaybackPreviewDirection.next);
      expect(state.previousRequestId, 0);
      expect(state.nextRequestId, 0);

      controller.hidePreview();
      state = container.read(appPlaybackControllerProvider);
      expect(state.previewDirection, isNull);
      expect(state.previousRequestId, 0);
      expect(state.nextRequestId, 0);
    },
  );

  test('playback controller clamps seek requests to known duration', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final controller = container.read(appPlaybackControllerProvider.notifier);
    controller.setActiveVideo(true);
    controller.setPlaybackPosition(currentSeconds: 35, durationSeconds: 90);

    controller.requestSeekRelative(-50);
    var state = container.read(appPlaybackControllerProvider);
    expect(state.seekRequestId, 1);
    expect(state.seekSeconds, 0);
    expect(state.currentSeconds, 0);

    controller.setPlaybackPosition(currentSeconds: 35, durationSeconds: 90);
    controller.requestSeekRelative(30);
    state = container.read(appPlaybackControllerProvider);
    expect(state.seekRequestId, 2);
    expect(state.seekSeconds, 65);
    expect(state.currentSeconds, 65);

    controller.requestSeekTo(120);
    state = container.read(appPlaybackControllerProvider);
    expect(state.seekRequestId, 3);
    expect(state.seekSeconds, 90);
    expect(state.currentSeconds, 90);
  });

  test('playback controller exposes exact speed delta requests', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final controller = container.read(appPlaybackControllerProvider.notifier);
    controller.setActiveVideo(true);

    controller.requestSpeedDelta(-0.10);
    var state = container.read(appPlaybackControllerProvider);
    expect(state.speedDeltaRequestId, 1);
    expect(state.speedDelta, -0.10);

    controller.requestSpeedDelta(0.50);
    state = container.read(appPlaybackControllerProvider);
    expect(state.speedDeltaRequestId, 2);
    expect(state.speedDelta, 0.50);
  });

  test('playback controller exposes add current media requests', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final controller = container.read(appPlaybackControllerProvider.notifier);
    controller.setActiveVideo(true);

    controller.requestAddCurrentVideoToPlaylist();
    var state = container.read(appPlaybackControllerProvider);
    expect(state.addCurrentVideoToPlaylistRequestId, 1);
    expect(state.addCurrentChannelToFeedRequestId, 0);

    controller.requestAddCurrentChannelToFeed();
    state = container.read(appPlaybackControllerProvider);
    expect(state.addCurrentVideoToPlaylistRequestId, 1);
    expect(state.addCurrentChannelToFeedRequestId, 1);
  });

  test(
    'playback controller emits navigation requests before active video latch',
    () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final controller = container.read(appPlaybackControllerProvider.notifier);

      controller.requestPrevious();
      controller.requestNext();
      controller.showPreviousPreview();
      var state = container.read(appPlaybackControllerProvider);
      expect(state.previousRequestId, 1);
      expect(state.nextRequestId, 1);
      expect(state.previewDirection, PlaybackPreviewDirection.previous);

      controller.showNextPreview();
      state = container.read(appPlaybackControllerProvider);
      expect(state.previousRequestId, 1);
      expect(state.nextRequestId, 1);
      expect(state.previewDirection, PlaybackPreviewDirection.next);
    },
  );
}
