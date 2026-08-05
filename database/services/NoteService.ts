import { Q, type Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import Note from '@/database/models/Note';

export class NoteService {
  /**
   * The canonical notes list query — soft-deleted rows excluded, newest first, windowed to
   * `limit`. Returns the `Query` rather than fetched rows so `useNotes` can observe it (see
   * `hooks/useNotes.ts`, which passes `limit + 1` as its `hasMore` probe): one definition of what
   * "the notes list" means, rather than a service copy and a screen copy free to drift into
   * different orderings or pagination models.
   */
  static notesQuery(limit: number): Query<Note> {
    return database
      .get<Note>('notes')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc), Q.take(limit));
  }

  static async createNote(data: { title?: string; body: string }): Promise<Note> {
    const now = Date.now();

    return database.write(async () =>
      database.get<Note>('notes').create((record) => {
        record.title = data.title?.trim() || undefined;
        record.body = data.body.trim();
        record.createdAt = now;
        record.updatedAt = now;
      })
    );
  }

  static async updateNote(
    id: string,
    data: { title?: null | string; body?: string }
  ): Promise<Note> {
    const note = await database.get<Note>('notes').find(id);
    // updateNote is a @writer, so it owns its transaction — do not wrap it in database.write().
    await note.updateNote(data);
    return note;
  }

  static async deleteNote(id: string): Promise<void> {
    const note = await database.get<Note>('notes').find(id);
    await note.markAsDeleted();
  }

  /**
   * Exact copy with a fresh createdAt, so the duplicate lands at the top of the list where the
   * user can act on it. The source note is read *inside* the write block: its contents decide
   * what gets written, so reading it outside would leave a TOCTOU window (see AGENTS.md).
   */
  static async duplicateNote(id: string): Promise<Note> {
    return database.write(async () => {
      const original = await database.get<Note>('notes').find(id);

      if (original.deletedAt != null) {
        throw new Error('Cannot duplicate a deleted note');
      }

      const now = Date.now();

      return database.get<Note>('notes').create((record) => {
        record.title = original.title;
        record.body = original.body;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
  }
}
