import 'package:flutter_test/flutter_test.dart';
import 'package:replayglowz_app/widgets/app_shell.dart';

void main() {
  test('playback seek controls swipe action is deterministic', () {
    expect(
      playbackSeekControlsSwipeActionForVelocity(-260),
      PlaybackSeekControlsSwipeAction.show,
    );
    expect(
      playbackSeekControlsSwipeActionForVelocity(260),
      PlaybackSeekControlsSwipeAction.hide,
    );
    expect(
      playbackSeekControlsSwipeActionForVelocity(40),
      PlaybackSeekControlsSwipeAction.none,
    );
  });

  test('playback seek controls swipe action respects threshold', () {
    expect(
      playbackSeekControlsSwipeActionForVelocity(-120, threshold: 100),
      PlaybackSeekControlsSwipeAction.show,
    );
    expect(
      playbackSeekControlsSwipeActionForVelocity(120, threshold: 100),
      PlaybackSeekControlsSwipeAction.hide,
    );
    expect(
      playbackSeekControlsSwipeActionForVelocity(80, threshold: 100),
      PlaybackSeekControlsSwipeAction.none,
    );
  });

  test(
    'playback seek controls swipe action is deterministic from drag offset',
    () {
      expect(
        playbackSeekControlsSwipeActionForOffset(-30),
        PlaybackSeekControlsSwipeAction.show,
      );
      expect(
        playbackSeekControlsSwipeActionForOffset(30),
        PlaybackSeekControlsSwipeAction.hide,
      );
      expect(
        playbackSeekControlsSwipeActionForOffset(8),
        PlaybackSeekControlsSwipeAction.none,
      );
    },
  );

  test('playback seek controls drag offset respects threshold', () {
    expect(
      playbackSeekControlsSwipeActionForOffset(-18, threshold: 16),
      PlaybackSeekControlsSwipeAction.show,
    );
    expect(
      playbackSeekControlsSwipeActionForOffset(18, threshold: 16),
      PlaybackSeekControlsSwipeAction.hide,
    );
    expect(
      playbackSeekControlsSwipeActionForOffset(12, threshold: 16),
      PlaybackSeekControlsSwipeAction.none,
    );
  });

  test(
    'playback seek controls are available on Play before active playback',
    () {
      expect(
        playbackSeekControlsAvailableForPlayContext(
          location: '/play',
          routeVideoId: 'youtube-id',
          activeVideoId: null,
          hasActiveVideo: false,
        ),
        isTrue,
      );
      expect(
        playbackSeekControlsAvailableForPlayContext(
          location: '/play',
          routeVideoId: null,
          activeVideoId: 'last-video-id',
          hasActiveVideo: false,
        ),
        isTrue,
      );
      expect(
        playbackSeekControlsAvailableForPlayContext(
          location: '/play',
          routeVideoId: null,
          activeVideoId: null,
          hasActiveVideo: true,
        ),
        isTrue,
      );
    },
  );

  test('playback seek controls are globally available with active video', () {
    expect(
      playbackSeekControlsAvailableForPlayContext(
        location: '/videos',
        routeVideoId: null,
        activeVideoId: 'last-video-id',
        hasActiveVideo: false,
      ),
      isTrue,
    );
    expect(
      playbackSeekControlsAvailableForPlayContext(
        location: '/notes',
        routeVideoId: null,
        activeVideoId: null,
        hasActiveVideo: true,
      ),
      isTrue,
    );
  });

  test('playback seek controls stay unavailable without video context', () {
    expect(
      playbackSeekControlsAvailableForPlayContext(
        location: '/videos',
        routeVideoId: null,
        activeVideoId: null,
        hasActiveVideo: false,
      ),
      isFalse,
    );
    expect(
      playbackSeekControlsAvailableForPlayContext(
        location: '/play',
        routeVideoId: null,
        activeVideoId: null,
        hasActiveVideo: false,
      ),
      isFalse,
    );
  });
}
