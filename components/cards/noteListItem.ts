import type Note from '@/database/models/Note';

/**
 * Shared by both note list presentations — the highlighted `NoteCard` tile and the flat `NoteRow`.
 * They render the same data at different visual weights, so the contract lives here rather than
 * one importing the other's props and silently inheriting its changes.
 */
export type NoteListItemProps = {
  note: Note;
  /** Pre-formatted by the screen so locale/`t` resolve in one place. */
  relativeTime: string;
  onPress: () => void;
  onMenuPress: () => void;
};
