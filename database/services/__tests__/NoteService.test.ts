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

  describe('getNotes', () => {
    it('filters soft-deleted rows, sorts newest first, and windows to the limit', async () => {
      const rows = [{ id: 'note-1' }];
      const query = jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue(rows) });
      mockDatabase.get.mockReturnValue({ query } as any);

      const result = await NoteService.getNotes(12);

      expect(result).toBe(rows);
      expect(mockDatabase.get).toHaveBeenCalledWith('notes');
      expect(Q.where).toHaveBeenCalledWith('deleted_at', null);
      expect(Q.sortBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(Q.take).toHaveBeenCalledWith(12);
    });

    it('omits Q.skip on the first page so the query stays minimal', async () => {
      const query = jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) });
      mockDatabase.get.mockReturnValue({ query } as any);

      await NoteService.getNotes(12);

      expect(Q.skip).not.toHaveBeenCalled();
      expect(query.mock.calls[0]).toHaveLength(3);
    });

    it('applies Q.skip for later pages', async () => {
      const query = jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) });
      mockDatabase.get.mockReturnValue({ query } as any);

      await NoteService.getNotes(10, 12);

      expect(Q.skip).toHaveBeenCalledWith(12);
      expect(query.mock.calls[0]).toHaveLength(4);
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

  describe('getNoteById', () => {
    it('returns null for a soft-deleted note', async () => {
      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockResolvedValue({ id: 'note-1', deletedAt: 123 }),
      } as any);

      await expect(NoteService.getNoteById('note-1')).resolves.toBeNull();
    });

    it('returns null when the row is missing', async () => {
      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockRejectedValue(new Error('not found')),
      } as any);

      await expect(NoteService.getNoteById('missing')).resolves.toBeNull();
    });
  });
});
