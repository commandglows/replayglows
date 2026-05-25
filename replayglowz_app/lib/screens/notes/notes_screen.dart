import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:replayglowz_app/app/router.dart';
import 'package:replayglowz_app/i18n/translations.dart';
import 'package:replayglowz_app/models/models.dart';
import 'package:replayglowz_app/providers/mutations.dart';
import 'package:replayglowz_app/providers/providers.dart';
import 'package:replayglowz_app/widgets/app_states.dart';
import 'package:replayglowz_app/widgets/common_app_bar_actions.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';
import 'package:replayglowz_app/widgets/notes/note_group_header.dart';
import 'package:replayglowz_app/widgets/notes/note_tile.dart';
import 'package:replayglowz_app/widgets/ui_hint_card.dart';
import 'package:replayglowz_app/widgets/youtube_connect.dart';

/// Notes overview screen with search and grouped display.
///
/// Convex queries used:
/// - `notes.getNotes` — fetch all notes for the current user
/// - `youtube.getVideosInfoBatch` — fetch video metadata for note grouping
class NotesScreen extends ConsumerStatefulWidget {
  const NotesScreen({super.key});

  @override
  ConsumerState<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends ConsumerState<NotesScreen> {
  static const _prefsSort = 'notes.pref.sort';
  final _searchController = TextEditingController();
  String _searchQuery = '';
  NoteSortOrder _sortOrder = NoteSortOrder.desc;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsSort);
    if (!mounted) return;
    setState(() {
      _sortOrder = NoteSortOrder.fromJson(raw);
    });
  }

  Future<void> _persistSort() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsSort, _sortOrder.toJson());
  }

  AppLocale _locale(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'fr'
      ? AppLocale.fr
      : AppLocale.en;

  @override
  Widget build(BuildContext context) {
    final l = _locale(context);
    final settings = ref.watch(settingsProvider).asData?.value;
    final preferredSort = settings?.notes.sortOrder;
    final effectiveSort = preferredSort ?? _sortOrder;
    final youtubeConnectionAsync = ref.watch(youtubeConnectionProvider);
    final youtubeConnected =
        youtubeConnectionAsync.asData?.value?['connected'] == true;
    final notesAsync = youtubeConnected ? ref.watch(notesProvider) : null;

    return Scaffold(
      appBar: AppBar(
        title: Text(t('common.notes', locale: l)),
        actions: [
          IconButton(
            icon: const Icon(Icons.sort),
            onPressed: () => setState(() {
              _sortOrder = _sortOrder == NoteSortOrder.desc
                  ? NoteSortOrder.asc
                  : NoteSortOrder.desc;
              _persistSort();
            }),
          ),
          ...commonAppBarActions(context, ref),
        ],
      ),
      body: Column(
        children: [
          UiHintCard(
            hintId: 'notes-onboarding',
            icon: Icons.sticky_note_2_outlined,
            title: t('p3.notes.hintTitle', locale: l),
            message: t('p3.notes.hintMessage', locale: l),
          ),
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: t('notesSection.searchPlaceholder', locale: l),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
              onChanged: (value) {
                setState(() => _searchQuery = value);
              },
            ),
          ),
          // Notes list grouped by video
          Expanded(
            child: youtubeConnectionAsync.when(
              data: (status) {
                if (status?['connected'] != true) {
                  return const YoutubeConnectRequiredState(
                    title: 'Connect YouTube to start taking notes',
                    description:
                        'ReplayGlowz creates notes while you watch synced YouTube videos. Connect YouTube first, then your notes will appear here.',
                    returnTo: Routes.notes,
                  );
                }

                return notesAsync!.when(
                  data: (notes) => _buildGroupedNotesList(
                    context,
                    notes,
                    youtubeConnected,
                    effectiveSort,
                  ),
                  loading: () => _buildShimmerLoading(),
                  error: (error, stack) => ErrorStateView(
                    error: error,
                    prefix: 'Failed to load notes',
                    onRetry: () => ref.invalidate(notesProvider),
                  ),
                );
              },
              loading: () => const YoutubeConnectionLoadingState(
                title: 'Checking your YouTube notes',
                description:
                    'ReplayGlowz is confirming your YouTube connection before loading notes.',
              ),
              error: (error, stack) => ErrorStateView(
                error: error,
                prefix: 'Failed to check YouTube connection',
                onRetry: () => ref.invalidate(youtubeConnectionProvider),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShimmerLoading() {
    return AppLoadingListSkeleton(
      itemCount: 6,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemBuilder: (context, index) => Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          leading: Container(
            width: 50,
            height: 14,
            color: Theme.of(context).colorScheme.surface,
          ),
          title: Container(
            height: 12,
            width: 200,
            color: Theme.of(context).colorScheme.surface,
          ),
        ),
      ),
    );
  }

  Widget _buildGroupedNotesList(
    BuildContext context,
    List<Note> allNotes,
    bool youtubeConnected,
    NoteSortOrder effectiveSort,
  ) {
    final normalizedQuery = _searchQuery.trim().toLowerCase();

    // Filter notes by search query.
    final filtered = normalizedQuery.isEmpty
        ? allNotes
        : allNotes
              .where(
                (n) =>
                    n.title.toLowerCase().contains(normalizedQuery) ||
                    n.content.toLowerCase().contains(normalizedQuery),
              )
              .toList();
    filtered.sort((a, b) {
      final left = a.createdAt ?? 0;
      final right = b.createdAt ?? 0;
      return effectiveSort == NoteSortOrder.asc
          ? left.compareTo(right)
          : right.compareTo(left);
    });

    if (filtered.isEmpty) {
      if (!youtubeConnected) {
        return const YoutubeConnectRequiredState(
          title: 'Connect YouTube to start taking notes',
          description:
              'ReplayGlowz notes are attached to YouTube playback. Connect YouTube, open a video, and your notes will show up here.',
          returnTo: Routes.notes,
        );
      }

      return AppEmptyState(
        icon: _searchQuery.isNotEmpty ? Icons.search_off : Icons.note_outlined,
        title: _searchQuery.isNotEmpty ? 'No matching notes' : 'No notes yet',
        description: _searchQuery.isEmpty
            ? 'Notes you take during video playback will appear here'
            : 'Try another search term.',
      );
    }

    // Group notes by youtubeVideoId (null = standalone).
    final grouped = <String?, List<Note>>{};
    for (final note in filtered) {
      grouped.putIfAbsent(note.youtubeVideoId, () => []).add(note);
    }

    final groupKeys = grouped.keys.toList();

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: groupKeys.length,
      itemBuilder: (context, groupIndex) {
        final videoId = groupKeys[groupIndex];
        final groupNotes = grouped[videoId]!;
        final videoTitle = videoId != null
            ? 'Video: $videoId'
            : 'Standalone Notes';
        return _buildVideoGroup(
          context,
          videoTitle,
          groupNotes,
          groupIndex,
          groupKeys.length,
        );
      },
    );
  }

  Widget _buildVideoGroup(
    BuildContext context,
    String videoTitle,
    List<Note> notes,
    int groupIndex,
    int totalGroups,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: NoteGroupHeader(
                title: videoTitle,
                noteCount: notes.length,
              ),
            ),
            if (notes.first.youtubeVideoId != null)
              IconButton(
                tooltip: 'Copy notes as Markdown',
                icon: const Icon(Icons.copy_all_outlined),
                onPressed: () => _copyVideoNotes(notes.first.youtubeVideoId!),
              ),
          ],
        ),
        // Notes for this video
        ...notes.map((note) {
          return NoteTile(
            content: note.content,
            timestampLabel: note.isTimestamped
                ? '[${note.formattedTimestamp}]'
                : null,
            compactText: true,
            trailing: const Icon(Icons.chevron_right, size: 20),
            onTap: () => context.go(Routes.noteDetail(note.id)),
          );
        }),
        if (groupIndex < totalGroups - 1) const Divider(),
      ],
    );
  }

  Future<void> _copyVideoNotes(String youtubeVideoId) async {
    try {
      final markdown = await exportNotesForVideo(
        ref,
        youtubeVideoId: youtubeVideoId,
      );
      if (markdown.trim().isEmpty) {
        throw StateError('There are no notes to export for this video.');
      }
      await Clipboard.setData(ClipboardData(text: markdown));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Notes copied as Markdown.')),
      );
    } catch (e) {
      if (!mounted) return;
      showErrorSnackBar(context, error: e, prefix: 'Export unavailable');
    }
  }
}
