import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { NoteService } from '@/database/services/NoteService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
    sortBy: jest.fn((field: string, direction: string) => ({ kind: 'sortBy', field, direction })),
    skip: jest.fn((count: number) => ({ kind: 'skip', count })),
    take: jest.fn((count: number) => ({ kind: 'take', count })),
    asc: 'asc',
    desc: 'desc',
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(async (callback) => callback()),
  },
}));

const mockDatabase = database as jest.Mocked<typeof database>;

describe('NoteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('notesQuery', () => {
    it('filters soft-deleted rows, sorts newest first, and windows to the limit', () => {
      const built = { observeWithColumns: jest.fn() };
      const query = jest.fn().mockReturnValue(built);
      mockDatabase.get.mockReturnValue({ query } as any);

      const result = NoteService.notesQuery(13);

      expect(result).toBe(built);
      expect(mockDatabase.get).toHaveBeenCalledWith('notes');
      expect(Q.where).toHaveBeenCalledWith('deleted_at', null);
      expect(Q.sortBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(Q.take).toHaveBeenCalledWith(13);
      expect(query.mock.calls[0]).toHaveLength(3);
    });

    // Returning the Query (not fetched rows) is what lets useNotes observe the same definition
    // instead of re-inlining the clauses — keep it lazy.
    it('does not fetch: the caller decides between observing and fetching', () => {
      const fetch = jest.fn();
      mockDatabase.get.mockReturnValue({ query: jest.fn().mockReturnValue({ fetch }) } as any);

      NoteService.notesQuery(13);

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('createNote', () => {
    it('trims the body and stamps matching timestamps inside a write block', async () => {
      const record = {} as any;
      const create = jest.fn().mockImplementation((callback) => {
        callback(record);
        return record;
      });
      mockDatabase.get.mockReturnValue({ create } as any);

      const result = await NoteService.createNote({ body: '  70g of broccoli  ' });

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(record.body).toBe('70g of broccoli');
      expect(record.createdAt).toBe(record.updatedAt);
      expect(typeof record.createdAt).toBe('number');
      expect(result).toBe(record);
    });

    it('coerces a blank title to undefined rather than storing an empty string', async () => {
      const record = {} as any;
      mockDatabase.get.mockReturnValue({
        create: jest.fn().mockImplementation((callback) => {
          callback(record);
          return record;
        }),
      } as any);

      await NoteService.createNote({ title: '   ', body: 'Chicken breast' });

      expect(record.title).toBeUndefined();
    });

    it('trims a provided title', async () => {
      const record = {} as any;
      mockDatabase.get.mockReturnValue({
        create: jest.fn().mockImplementation((callback) => {
          callback(record);
          return record;
        }),
      } as any);

      await NoteService.createNote({ title: '  Lunch prep  ', body: 'Chicken breast' });

      expect(record.title).toBe('Lunch prep');
    });
  });

  describe('duplicateNote', () => {
    it('copies the source and stamps a fresh createdAt so the copy sorts to the top', async () => {
      const original = { id: 'note-1', title: 'Lunch', body: 'Broccoli', createdAt: 1_000 };
      const record = {} as any;
      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValue(original),
        create: jest.fn().mockImplementation((callback) => {
          callback(record);
          return record;
        }),
      } as any);

      await NoteService.duplicateNote('note-1');

      expect(record.title).toBe('Lunch');
      expect(record.body).toBe('Broccoli');
      expect(record.createdAt).toBeGreaterThan(original.createdAt);
      expect(record.createdAt).toBe(record.updatedAt);
    });

    it('reads the source INSIDE the write block (TOCTOU guard)', async () => {
      const find = jest.fn().mockResolvedValue({ id: 'note-1', body: 'Broccoli' });
      mockDatabase.get.mockReturnValue({
        find,
        create: jest.fn().mockImplementation((callback) => {
          callback({} as any);
          return {};
        }),
      } as any);

      let findCalledDuringWrite = false;
      (mockDatabase.write as jest.Mock).mockImplementationOnce(async (callback: () => unknown) => {
        expect(find).not.toHaveBeenCalled();
        const result = await callback();
        findCalledDuringWrite = find.mock.calls.length === 1;
        return result;
      });

      await NoteService.duplicateNote('note-1');

      expect(findCalledDuringWrite).toBe(true);
    });

    it('refuses to duplicate a soft-deleted note', async () => {
      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValue({ id: 'note-1', deletedAt: 123 }),
        create: jest.fn(),
      } as any);

      await expect(NoteService.duplicateNote('note-1')).rejects.toThrow(
        'Cannot duplicate a deleted note'
      );
    });
  });

  describe('deleteNote', () => {
    it('delegates to the model writer without opening a nested write block', async () => {
      const markAsDeleted = jest.fn().mockResolvedValue(undefined);
      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValue({ id: 'note-1', markAsDeleted }),
      } as any);

      await NoteService.deleteNote('note-1');

      expect(markAsDeleted).toHaveBeenCalledTimes(1);
      // Nesting database.write() around a @writer deadlocks WatermelonDB.
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });
  });

  describe('updateNote', () => {
    it('delegates to the model writer without opening a nested write block', async () => {
      const updateNote = jest.fn().mockResolvedValue(undefined);
      const note = { id: 'note-1', updateNote };
      mockDatabase.get.mockReturnValue({ find: jest.fn().mockResolvedValue(note) } as any);

      const result = await NoteService.updateNote('note-1', { body: 'Updated' });

      expect(updateNote).toHaveBeenCalledWith({ body: 'Updated' });
      expect(mockDatabase.write).not.toHaveBeenCalled();
      expect(result).toBe(note);
    });
  });
});
