import { useCallback, useEffect, useMemo, useState } from 'react';

import type Note from '@/database/models/Note';
import { NoteService } from '@/database/services/NoteService';

/**
 * How many of the newest notes render as highlighted "Latest" tiles; the rest fall through to the
 * flat "Earlier" rows. The notes screen slices on this, so it lives here next to the page size it
 * feeds rather than as a bare `2` at the call site.
 */
export const LATEST_NOTE_COUNT = 2;

/** How many further "Earlier" rows each "Load more" press appends. */
const NOTES_BATCH_SIZE = 10;

/** One screenful: the "Latest" tiles plus a batch of "Earlier" rows. */
export const NOTES_INITIAL_LIMIT = LATEST_NOTE_COUNT + NOTES_BATCH_SIZE;

export interface UseNotesResult {
  notes: Note[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

export function useNotes(): UseNotesResult {
  const [limit, setLimit] = useState(NOTES_INITIAL_LIMIT);
  const [notes, setNotes] = useState<Note[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // limit + 1: the extra row is the "is there another page?" probe. One query, so no count/list
    // race and no second subscription. The query shape itself is NoteService's to define.
    const query = NoteService.notesQuery(limit + 1);

    // observeWithColumns, NOT observe: sortBy/take force WatermelonDB's "reloading" observer,
    // which dedupes emissions by record identity. Editing a note mutates the cached Model in
    // place, so observe() would see an identical array and never emit — the list would go stale.
    // Listing the mutable columns makes in-place edits emit a fresh array.
    const subscription = query.observeWithColumns(['title', 'body', 'updated_at']).subscribe({
      next: (rows) => {
        setHasMore(rows.length > limit);
        setNotes(rows.slice(0, limit));
        setIsLoading(false);
      },
      error: (error: Error) => {
        console.error('Error observing notes:', error);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [limit]);

  // Growing the limit re-subscribes with a superset; the current page stays rendered until the
  // new one arrives, so there is no flash and no separate loading state to manage.
  const loadMore = useCallback(() => {
    setLimit((previous) => previous + NOTES_BATCH_SIZE);
  }, []);

  return useMemo(
    () => ({ notes, isLoading, hasMore, loadMore }),
    [notes, isLoading, hasMore, loadMore]
  );
}
