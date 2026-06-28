import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireReplayGlowzAccess } from "./access";
import { PLANS } from "./subscriptions";

// =============================================================================
// GENERIC NOTES (Legacy)
// =============================================================================

// Get all notes for a specific user (including YouTube video notes)
export const getNotes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return null;

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Return ALL notes (including YouTube notes)
    return notes;
  },
});

// Get note by ID
export const getNote = query({
  args: {
    id: v.optional(v.id("notes")),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    const { id } = args;
    if (!id) return null;
    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) return null;
    return note;
  },
});

// Create a new generic note
export const createNote = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    isSummary: v.boolean(),
  },
  handler: async (ctx, { title, content, isSummary }) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("User not found");
    if (title.length > 500) throw new Error("Title too long (max 500 chars)");
    if (content.length > 50000)
      throw new Error("Content too long (max 50,000 chars)");

    const noteId = await ctx.db.insert("notes", {
      userId,
      title: title.trim(),
      content: content.trim(),
      createdAt: Date.now(),
    });

    if (isSummary) {
      await ctx.scheduler.runAfter(0, internal.openai.summary, {
        id: noteId,
        title,
        content,
      });
    }

    return noteId;
  },
});

// Delete a note (supports both noteId and id for backwards compatibility)
export const deleteNote = mutation({
  args: {
    noteId: v.optional(v.id("notes")),
    id: v.optional(v.id("notes")),
  },
  handler: async (ctx, args) => {
    const noteId = args.noteId ?? args.id;
    if (!noteId) throw new Error("Note ID required");

    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found or unauthorized");
    }

    await ctx.db.delete(noteId);
  },
});

// =============================================================================
// YOUTUBE VIDEO NOTES
// =============================================================================

// Get notes for a specific YouTube video
export const getNotesByYoutubeVideo = query({
  args: { youtubeVideoId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return [];

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_youtube_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId),
      )
      .collect();

    // Sort by timestamp (ascending), notes without timestamp at the end
    return notes.sort((a, b) => {
      if (a.timestamp === undefined && b.timestamp === undefined) return 0;
      if (a.timestamp === undefined) return 1;
      if (b.timestamp === undefined) return -1;
      return a.timestamp - b.timestamp;
    });
  },
});

// Create a note for a YouTube video with optional timestamp
export const createNoteForYoutubeVideo = mutation({
  args: {
    youtubeVideoId: v.string(),
    content: v.string(),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");
    if (args.content.length > 50000)
      throw new Error("Content too long (max 50,000 chars)");

    const noteId = await ctx.db.insert("notes", {
      userId,
      title: "",
      content: args.content.trim(),
      youtubeVideoId: args.youtubeVideoId,
      timestamp: args.timestamp,
      createdAt: Date.now(),
    });

    return noteId;
  },
});

// Update a note
export const updateNote = mutation({
  args: {
    id: v.id("notes"),
    content: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found or unauthorized");
    }

    if (args.content !== undefined && args.content.length > 50000) {
      throw new Error("Content too long (max 50,000 chars)");
    }

    const updates: Record<string, unknown> = {};
    if (args.content !== undefined) updates.content = args.content.trim();
    if (args.timestamp !== undefined) updates.timestamp = args.timestamp;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

// Get note count for a YouTube video
export const getNoteCountForVideo = query({
  args: { youtubeVideoId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return 0;

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_youtube_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId),
      )
      .collect();

    return notes.length;
  },
});

// Search notes by content
export const searchNotes = query({
  args: {
    query: v.string(),
    youtubeVideoId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return [];

    const searchTerm = args.query.toLowerCase();

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    return notes.filter((note) => {
      // Filter by YouTube video if specified
      if (args.youtubeVideoId && note.youtubeVideoId !== args.youtubeVideoId) {
        return false;
      }
      // Search in content
      return note.content.toLowerCase().includes(searchTerm);
    });
  },
});

// Export notes for a video as markdown (Pro/Team feature)
export const exportNotesForVideo = query({
  args: { youtubeVideoId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return null;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
    const plan = subscription?.plan ?? "free";
    if (!PLANS[plan].exportNotes) {
      throw new Error(
        "EXPORT_NOTES_NOT_ALLOWED: Note export is not available on this plan.",
      );
    }

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_youtube_video", (q) =>
        q.eq("userId", userId).eq("youtubeVideoId", args.youtubeVideoId),
      )
      .collect();

    // Sort by timestamp
    const sortedNotes = notes.sort((a, b) => {
      if (a.timestamp === undefined && b.timestamp === undefined) return 0;
      if (a.timestamp === undefined) return 1;
      if (b.timestamp === undefined) return -1;
      return a.timestamp - b.timestamp;
    });

    // Format time helper
    const formatTime = (seconds?: number): string => {
      if (seconds === undefined) return "";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    // Format as markdown
    const markdown = sortedNotes
      .map((note) => {
        const timestamp =
          note.timestamp !== undefined
            ? `[${formatTime(note.timestamp)}] `
            : "";
        return `- ${timestamp}${note.content}`;
      })
      .join("\n");

    return {
      markdown,
      noteCount: sortedNotes.length,
    };
  },
});
