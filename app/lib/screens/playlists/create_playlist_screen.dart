import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:replayglowz_app/app/theme.dart';
import 'package:replayglowz_app/providers/mutations.dart';
import 'package:replayglowz_app/widgets/error_feedback.dart';

/// Form screen for creating a new playlist.
///
/// Convex mutations used:
/// - `playlists.createPlaylist` — persist the new playlist
class CreatePlaylistScreen extends ConsumerStatefulWidget {
  const CreatePlaylistScreen({super.key});

  @override
  ConsumerState<CreatePlaylistScreen> createState() =>
      _CreatePlaylistScreenState();
}

class _CreatePlaylistScreenState extends ConsumerState<CreatePlaylistScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _isPublic = true;
  Color _selectedColor = Colors.purple;
  bool _isSaving = false;

  static const _colorOptions = [
    Colors.purple,
    Colors.blue,
    Colors.teal,
    Colors.green,
    Colors.orange,
    Colors.red,
    Colors.pink,
    Colors.indigo,
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Playlist'),
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _handleSave,
            child: _isSaving
                ? const SizedBox.square(
                    dimension: AppSizes.iconSmall,
                    child: CircularProgressIndicator(
                      strokeWidth: AppSpacing.xxxs,
                    ),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            // Name field
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Playlist Name',
                hintText: 'Enter a name for your playlist',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Please enter a playlist name';
                }
                if (value.trim().length < 2) {
                  return 'Name must be at least 2 characters';
                }
                return null;
              },
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: AppSpacing.md),

            // Description field
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Description',
                hintText: 'Optional description',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
              maxLines: 3,
              textInputAction: TextInputAction.done,
            ),
            const SizedBox(height: AppSpacing.lg),

            // Visibility toggle
            SwitchListTile(
              title: const Text('Public'),
              subtitle: Text(
                _isPublic ? 'Visible to everyone' : 'Only visible to you',
              ),
              value: _isPublic,
              onChanged: (value) {
                setState(() => _isPublic = value);
              },
              secondary: Icon(_isPublic ? Icons.public : Icons.lock),
            ),
            const SizedBox(height: AppSpacing.lg),

            // Color picker
            Text(
              'Playlist Color',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: _colorOptions.map((color) {
                final isSelected = _selectedColor == color;
                return GestureDetector(
                  onTap: () => setState(() => _selectedColor = color),
                  child: Container(
                    width: AppSizes.minTouchTarget,
                    height: AppSizes.minTouchTarget,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                      border: isSelected
                          ? Border.all(
                              color: Theme.of(context).colorScheme.onSurface,
                              width: AppSpacing.xxxs,
                            )
                          : null,
                    ),
                    child: isSelected
                        ? const Icon(
                            Icons.check,
                            color: AppColors.primaryForeground,
                            size: AppSizes.iconMedium,
                          )
                        : null,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: AppSpacing.xl),

            // Preview card
            Text('Preview', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: AppSpacing.xs),
            Card(
              clipBehavior: Clip.antiAlias,
              child: Row(
                children: [
                  Container(
                    width: AppSpacing.xxs,
                    height: 60,
                    color: _selectedColor,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.xs,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _nameController.text.isEmpty
                                ? 'Playlist Name'
                                : _nameController.text,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          Text(
                            '0 videos - ${_isPublic ? 'Public' : 'Private'}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      await createPlaylist(
        ref,
        title: _nameController.text.trim(),
        description: _descriptionController.text.trim(),
        privacyStatus: _isPublic ? 'public' : 'private',
        color:
            '#${_selectedColor.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}',
      );

      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Playlist created!')));
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        showErrorSnackBar(context, error: e, prefix: 'Error creating playlist');
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }
}
