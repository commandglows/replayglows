import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:replayglowz_app/convex/convex_client.dart';
import 'package:replayglowz_app/convex/convex_errors.dart';
import 'package:replayglowz_app/convex/convex_provider.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/providers/providers.dart';

// =============================================================================
// Convex mutation helpers for the ReplayGlowz app.
//
// Each function accepts a [Ref] (or [WidgetRef]) so it can access the
// [ConvexService] singleton through Riverpod, then calls the appropriate
// Convex mutation and returns the decoded result.
//
// Usage from a widget:
//
//   ElevatedButton(
//     onPressed: () => createNote(ref,
//       videoId: video.youtubeVideoId,
//       content: _controller.text,
//       timestamp: _player.position.inSeconds.toDouble(),
//     ),
//     child: Text('Save Note'),
//   )
//
// Usage from another provider / notifier:
//
//   await createNote(ref, videoId: id, content: text);
//
// After a mutation that changes data read by a FutureProvider, callers should
// invalidate the relevant provider:
//
//   ref.invalidate(hiddenItemsProvider);
//
// StreamProvider-backed data updates automatically via Convex subscriptions.
// =============================================================================

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/// Creates a new note, optionally linked to a video at a timestamp.
///
/// Returns the Convex document ID of the created note.
Future<dynamic> createNote(
  WidgetRef ref, {
  required String videoId,
  required String content,
  double? timestamp,
  String? title,
}) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('notes:createNote', {
    'youtubeVideoId': videoId,
    'content': content,
    'timestamp': ?timestamp,
    'title': ?title,
  });
}

/// Updates the content of an existing note.
Future<dynamic> updateNote(WidgetRef ref, String noteId, String content) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('notes:updateNote', {
    'noteId': noteId,
    'content': content,
  });
}

/// Deletes a note by its Convex document ID.
Future<dynamic> deleteNote(WidgetRef ref, String noteId) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('notes:deleteNote', {'noteId': noteId});
}

// ---------------------------------------------------------------------------
// Hidden items
// ---------------------------------------------------------------------------

/// Hides a video from the user's feed.
Future<dynamic> hideVideo(WidgetRef ref, String videoId) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('hidden:hideItem', {
    'youtubeId': videoId,
    'itemType': 'video',
  });
}

/// Hides a playlist from the user's feed.
Future<dynamic> hidePlaylist(WidgetRef ref, String playlistId) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.mutate<dynamic>('hidden:hideItem', {
    'youtubeId': playlistId,
    'itemType': 'playlist',
  });
  ref
    ..invalidate(playlistsProvider)
    ..invalidate(videosProvider(const VideosArgs()));
  return result;
}

/// Un-hides a previously hidden video, restoring it to the feed.
Future<dynamic> unhideVideo(WidgetRef ref, String videoId) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('hidden:unhideItem', {
    'youtubeId': videoId,
    'itemType': 'video',
  });
}

/// Un-hides a hidden item by its Convex document ID.
Future<dynamic> unhideItem(WidgetRef ref, String hiddenItemId) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('hidden:unhideItem', {
    'hiddenItemId': hiddenItemId,
  });
}

// ---------------------------------------------------------------------------
// Watch history
// ---------------------------------------------------------------------------

/// Marks a video as watched.
Future<dynamic> markWatched(WidgetRef ref, String videoId) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('watched:markAsWatched', {
    'youtubeVideoId': videoId,
  });
}

/// Removes the watched mark from a video.
Future<dynamic> unmarkWatched(WidgetRef ref, String videoId) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('watched:unmarkAsWatched', {
    'youtubeVideoId': videoId,
  });
}

// ---------------------------------------------------------------------------
// Playback progress
// ---------------------------------------------------------------------------

/// Saves (upserts) the user's playback progress for a video.
///
/// [seconds] is the current playback position. [duration] is the total video
/// length in seconds. Both values use fractional seconds.
Future<dynamic> saveProgress(
  WidgetRef ref,
  String videoId,
  double seconds,
  double duration,
) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('progress:saveProgress', {
    'youtubeVideoId': videoId,
    'progressSeconds': seconds,
    'durationSeconds': duration,
  });
}

/// Upserts the current playback position for a video (best-effort).
///
/// Unlike [saveProgress], this does not require a duration. Use for
/// mid-session saves (pause, background, dispose).
Future<dynamic> upsertProgress(
  WidgetRef ref,
  String videoId,
  double progressSeconds,
) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('progress:saveProgress', {
    'youtubeVideoId': videoId,
    'progressSeconds': progressSeconds,
  });
}

/// Generates (or reuses) a transcript version and activates it for the user.
Future<Map<String, dynamic>> generateTranscript(
  WidgetRef ref, {
  required String youtubeVideoId,
  String language = 'en',
  String? provider,
}) async {
  final service = ref.read(convexServiceProvider);
  final raw = await service
      .action<dynamic>('transcriptGeneration:generateTranscript', {
        'youtubeVideoId': youtubeVideoId,
        'language': language,
        'activate': true,
        'provider': ?provider,
      });

  if (raw is Map<String, dynamic>) {
    return raw;
  }

  throw StateError(
    'Transcript generation returned an unexpected response: ${raw.runtimeType}',
  );
}

Future<dynamic> selectTranscriptVersion(
  WidgetRef ref, {
  required String versionId,
  required String youtubeVideoId,
  required String language,
}) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.mutate<dynamic>(
    'transcripts:selectTranscriptVersion',
    {'versionId': versionId},
  );
  ref
    ..invalidate(
      activeTranscriptProvider(
        TranscriptArgs(youtubeVideoId: youtubeVideoId, language: language),
      ),
    )
    ..invalidate(
      transcriptVersionsProvider(
        TranscriptArgs(youtubeVideoId: youtubeVideoId, language: language),
      ),
    );
  return result;
}

Future<dynamic> upsertTranscriptSecret(
  WidgetRef ref, {
  required String provider,
  required String apiKey,
}) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.mutate<dynamic>(
    'transcriptSecrets:upsertSecret',
    {'provider': provider, 'apiKey': apiKey},
  );
  ref
    ..invalidate(transcriptSecretsStatusProvider)
    ..invalidate(transcriptProviderCatalogProvider);
  return result;
}

Future<dynamic> deleteTranscriptSecret(
  WidgetRef ref, {
  required String provider,
}) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.mutate<dynamic>(
    'transcriptSecrets:deleteSecret',
    {'provider': provider},
  );
  ref
    ..invalidate(transcriptSecretsStatusProvider)
    ..invalidate(transcriptProviderCatalogProvider);
  return result;
}

Future<dynamic> testTranscriptSecret(
  WidgetRef ref, {
  required String provider,
}) async {
  final service = ref.read(convexServiceProvider);
  return service.action<dynamic>('transcriptSecrets:testSecret', {
    'provider': provider,
  });
}

Future<String> exportNotesForVideo(
  WidgetRef ref, {
  required String youtubeVideoId,
}) async {
  final service = ref.read(convexServiceProvider);
  final raw = await service.query<dynamic>('notes:exportNotesForVideo', {
    'youtubeVideoId': youtubeVideoId,
  });
  final decoded = raw is Map<String, dynamic> ? raw : null;
  return decoded?['markdown']?.toString() ?? '';
}

Future<dynamic> refreshYoutubeSubscriptions(WidgetRef ref) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.action<dynamic>(
    'youtube:fetchYoutubeSubscriptions',
    {},
  );
  ref
    ..invalidate(subscribedChannelsProvider)
    ..invalidate(channelLinksProvider)
    ..invalidate(quotaUsageProvider);
  return result;
}

Future<dynamic> linkChannelToPlaylist(
  WidgetRef ref, {
  required String youtubeChannelId,
  required String channelTitle,
  required String youtubePlaylistId,
}) async {
  final service = ref.read(convexServiceProvider);
  final result = await service
      .mutate<dynamic>('channelLinks:linkChannelToPlaylist', {
        'youtubeChannelId': youtubeChannelId,
        'channelTitle': channelTitle,
        'youtubePlaylistId': youtubePlaylistId,
      });
  ref
    ..invalidate(channelLinksProvider)
    ..invalidate(playlistsProvider);
  return result;
}

Future<dynamic> unlinkChannel(WidgetRef ref, String linkId) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.mutate<dynamic>('channelLinks:unlinkChannel', {
    'linkId': linkId,
  });
  ref.invalidate(channelLinksProvider);
  return result;
}

Future<dynamic> toggleChannelLinkStatus(WidgetRef ref, String linkId) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.mutate<dynamic>(
    'channelLinks:toggleLinkStatus',
    {'linkId': linkId},
  );
  ref.invalidate(channelLinksProvider);
  return result;
}

Future<ChannelSyncResult> syncPastVideosFromChannel(
  WidgetRef ref, {
  required String youtubeChannelId,
  required String channelTitle,
  required String youtubePlaylistId,
}) async {
  final service = ref.read(convexServiceProvider);
  final raw = await service
      .action<dynamic>('channelLinks:syncPastVideosFromChannel', {
        'youtubeChannelId': youtubeChannelId,
        'channelTitle': channelTitle,
        'youtubePlaylistId': youtubePlaylistId,
      });
  ref
    ..invalidate(channelLinksProvider)
    ..invalidate(playlistVideosProvider(youtubePlaylistId))
    ..invalidate(videosProvider(const VideosArgs()))
    ..invalidate(quotaUsageProvider);
  if (raw is Map<String, dynamic>) {
    return ChannelSyncResult.fromJson(raw);
  }
  throw StateError('Channel sync returned an unexpected response.');
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

Future<dynamic> _syncAllPlaylistsWithService(ConvexService service) async {
  return service.action<dynamic>('youtube:startQuotaSafeSync', {});
}

/// Triggers a full YouTube refresh using the current backend action names.
Future<dynamic> syncAllPlaylists(WidgetRef ref) async {
  final service = ref.read(convexServiceProvider);
  final result = await _syncAllPlaylistsWithService(service);
  ref
    ..invalidate(quotaUsageProvider)
    ..invalidate(youtubeSyncJobProvider)
    ..invalidate(playlistsProvider)
    ..invalidate(videosProvider(const VideosArgs()));
  return result;
}

/// Triggers the same full refresh without relying on a widget-bound [WidgetRef].
Future<dynamic> syncAllPlaylistsWithContainer(
  ProviderContainer container,
) async {
  final service = container.read(convexServiceProvider);
  final result = await _syncAllPlaylistsWithService(service);
  container
    ..invalidate(quotaUsageProvider)
    ..invalidate(youtubeSyncJobProvider)
    ..invalidate(playlistsProvider)
    ..invalidate(videosProvider(const VideosArgs()));
  return result;
}

/// Refreshes a single YouTube playlist and updates its cached videos.
Future<dynamic> syncPlaylist(WidgetRef ref, String playlistId) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.action<dynamic>('youtube:fetchPlaylistItems', {
    'playlistId': playlistId,
  });
  ref
    ..invalidate(playlistVideosProvider(playlistId))
    ..invalidate(playlistsProvider)
    ..invalidate(videosProvider(const VideosArgs()))
    ..invalidate(quotaUsageProvider);
  return result;
}

Future<Map<String, dynamic>> importPlaylistByUrl(
  WidgetRef ref,
  String url,
) async {
  final service = ref.read(convexServiceProvider);
  final raw = await service.action<dynamic>('youtube:importPlaylistByUrl', {
    'url': url,
  });
  ref
    ..invalidate(playlistVideosProvider(_readPlaylistId(raw)))
    ..invalidate(playlistsProvider)
    ..invalidate(videosProvider(const VideosArgs()))
    ..invalidate(quotaUsageProvider)
    ..invalidate(youtubeSyncJobProvider);
  if (raw is Map<String, dynamic>) return raw;
  if (raw is Map) return Map<String, dynamic>.from(raw);
  throw StateError('Playlist import returned an unexpected response.');
}

String _readPlaylistId(dynamic raw) {
  if (raw is Map && raw['playlistId'] != null) {
    return raw['playlistId'].toString();
  }
  return '';
}

/// Persists the custom video ordering for a playlist.
///
/// Uses `videoOrder:updateOrder` when available, and falls back to
/// `videoOrder:saveVideoOrder` for environments still on the older function name.
Future<dynamic> reorderPlaylistVideos(
  WidgetRef ref, {
  required String playlistId,
  required List<String> orderedIds,
}) async {
  final service = ref.read(convexServiceProvider);
  final args = {'playlistId': playlistId, 'orderedIds': orderedIds};

  try {
    return await service.mutate<dynamic>('videoOrder:updateOrder', args);
  } catch (e) {
    if (isMissingPublicConvexFunctionError(e, path: 'videoOrder:updateOrder')) {
      return service.mutate<dynamic>('videoOrder:saveVideoOrder', args);
    }
    rethrow;
  }
}

/// Disconnects the current YouTube account and clears cached playlist data.
Future<dynamic> disconnectYoutube(WidgetRef ref) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('youtube:disconnectYoutube', {});
}

/// Adds a video to a YouTube playlist.
Future<dynamic> addVideoToYoutubePlaylist(
  WidgetRef ref, {
  required String playlistId,
  required String videoId,
}) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.action<dynamic>(
    'youtube:addVideoToYoutubePlaylist',
    {'playlistId': playlistId, 'videoId': videoId},
  );
  ref
    ..invalidate(playlistVideosProvider(playlistId))
    ..invalidate(playlistsProvider)
    ..invalidate(videosProvider(const VideosArgs()))
    ..invalidate(quotaUsageProvider);
  return result;
}

/// Removes a video from a YouTube playlist using its playlist item ID.
Future<dynamic> removeVideoFromYoutubePlaylist(
  WidgetRef ref, {
  required String playlistId,
  required String playlistItemId,
}) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.action<dynamic>(
    'youtube:removeVideoFromYoutubePlaylist',
    {'playlistId': playlistId, 'playlistItemId': playlistItemId},
  );
  ref
    ..invalidate(playlistVideosProvider(playlistId))
    ..invalidate(playlistsProvider)
    ..invalidate(videosProvider(const VideosArgs()))
    ..invalidate(quotaUsageProvider);
  return result;
}

/// Moves a video within a YouTube playlist.
Future<dynamic> moveVideoInYoutubePlaylist(
  WidgetRef ref, {
  required String playlistId,
  required String playlistItemId,
  required String videoId,
  required int newPosition,
}) async {
  final service = ref.read(convexServiceProvider);
  final result = await service
      .action<dynamic>('youtube:moveVideoInYoutubePlaylist', {
        'playlistId': playlistId,
        'playlistItemId': playlistItemId,
        'videoId': videoId,
        'newPosition': newPosition,
      });
  ref
    ..invalidate(playlistVideosProvider(playlistId))
    ..invalidate(playlistsProvider)
    ..invalidate(videosProvider(const VideosArgs()))
    ..invalidate(quotaUsageProvider);
  return result;
}

/// Removes a video from a playlist.
Future<dynamic> removeVideoFromPlaylist(
  WidgetRef ref, {
  required String playlistId,
  required String videoId,
}) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('playlists:removeVideoFromPlaylist', {
    'playlistId': playlistId,
    'videoId': videoId,
  });
}

/// Creates a new playlist.
///
/// Returns the Convex document ID of the created playlist.
Future<dynamic> createPlaylist(
  WidgetRef ref, {
  required String title,
  String? description,
  String privacyStatus = 'private',
  String? color,
}) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.action<dynamic>(
    'youtube:createYoutubePlaylist',
    {
      'title': title,
      'description': ?description,
      'privacyStatus': privacyStatus,
    },
  );
  await service.action<dynamic>('youtube:fetchYoutubePlaylists', {});
  final playlistId = result is Map ? result['id']?.toString() : null;
  if (playlistId != null && playlistId.isNotEmpty && color != null) {
    await service.mutate<dynamic>('youtube:updatePlaylistDetails', {
      'playlistId': playlistId,
      'color': color,
    });
  }
  ref
    ..invalidate(playlistsProvider)
    ..invalidate(quotaUsageProvider);
  return result;
}

/// Updates a YouTube playlist title, description, and local display color.
Future<dynamic> updateYoutubePlaylistDetails(
  WidgetRef ref, {
  required String playlistId,
  required String title,
  String? description,
  String? color,
}) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.action<dynamic>(
    'youtube:updateYoutubePlaylist',
    {'playlistId': playlistId, 'title': title, 'description': ?description},
  );
  if (color != null) {
    await service.mutate<dynamic>('youtube:updatePlaylistDetails', {
      'playlistId': playlistId,
      'color': color,
    });
  }
  ref
    ..invalidate(playlistsProvider)
    ..invalidate(playlistVideosProvider(playlistId))
    ..invalidate(videosProvider(const VideosArgs()))
    ..invalidate(quotaUsageProvider);
  return result;
}

/// Deletes a YouTube playlist and refreshes cached playlist data.
Future<dynamic> deleteYoutubePlaylist(WidgetRef ref, String playlistId) async {
  final service = ref.read(convexServiceProvider);
  final result = await service.action<dynamic>(
    'youtube:deleteYoutubePlaylist',
    {'playlistId': playlistId},
  );
  ref
    ..invalidate(playlistsProvider)
    ..invalidate(playlistVideosProvider(playlistId))
    ..invalidate(videosProvider(const VideosArgs()))
    ..invalidate(quotaUsageProvider);
  return result;
}

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

/// Toggles a like or dislike on a video.
///
/// [type] should be `'like'` or `'dislike'`. Toggling the same type twice
/// removes the interaction.
Future<dynamic> toggleLike(WidgetRef ref, String videoId, String type) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('likes:toggleLike', {
    'youtubeVideoId': videoId,
    'type': type,
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/// Creates a comment on a video.
///
/// Returns the Convex document ID of the created comment.
Future<dynamic> createComment(
  WidgetRef ref,
  String videoId,
  String content,
) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('comments:createComment', {
    'youtubeVideoId': videoId,
    'content': content,
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/// Marks a single notification as read.
Future<dynamic> markNotificationRead(
  WidgetRef ref,
  String notificationId,
) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('notifications:markAsRead', {
    'notificationId': notificationId,
  });
}

/// Marks all unread notifications as read.
Future<dynamic> markAllNotificationsRead(WidgetRef ref) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('notifications:markAllAsRead', {});
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/// Updates user settings with a raw patch map. Only the provided fields are
/// patched; omitted fields remain unchanged on the server.
///
/// Example:
/// ```dart
/// await updateSettings(ref, {'theme': 'dark'});
/// await updateSettings(ref, {'playback': {'speed': 1.5}});
/// ```
Future<dynamic> updateSettings(
  WidgetRef ref,
  Map<String, dynamic> patch,
) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('settings:updateAllSettings', patch);
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

/// Requests a short-lived Convex upload URL for feedback audio blobs.
Future<String> getFeedbackUploadUrl(WidgetRef ref) async {
  final service = ref.read(convexServiceProvider);
  final raw = await service.mutate<dynamic>('feedback:getUploadUrl', {});
  if (raw is String && raw.isNotEmpty) {
    return raw;
  }
  throw StateError('Convex feedback upload URL is missing');
}

/// Creates a text feedback entry.
Future<dynamic> createFeedbackText(
  WidgetRef ref, {
  required String message,
  required String platform,
  required String locale,
  String? buildCommitSha,
  String? buildEnvironment,
  String? buildTimestamp,
}) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('feedback:createText', {
    'message': message,
    'platform': platform,
    'locale': locale,
    'buildCommitSha': ?buildCommitSha,
    'buildEnvironment': ?buildEnvironment,
    'buildTimestamp': ?buildTimestamp,
  });
}

/// Creates an audio feedback entry after the audio file has been uploaded.
Future<dynamic> createFeedbackAudio(
  WidgetRef ref, {
  required String audioStorageId,
  required int audioDurationMs,
  required String platform,
  required String locale,
  String? message,
  String? buildCommitSha,
  String? buildEnvironment,
  String? buildTimestamp,
}) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('feedback:createAudio', {
    'audioStorageId': audioStorageId,
    'audioDurationMs': audioDurationMs,
    'platform': platform,
    'locale': locale,
    'message': ?message,
    'buildCommitSha': ?buildCommitSha,
    'buildEnvironment': ?buildEnvironment,
    'buildTimestamp': ?buildTimestamp,
  });
}

/// Marks an admin feedback entry as reviewed.
Future<dynamic> markFeedbackReviewed(WidgetRef ref, String feedbackId) async {
  final service = ref.read(convexServiceProvider);
  return service.mutate<dynamic>('feedback:markReviewed', {
    'feedbackId': feedbackId,
  });
}
