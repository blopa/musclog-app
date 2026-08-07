import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { ChatService } from '@/database/services/ChatService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => ({ kind: 'eq', value })),
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
    write: jest.fn(async (callback: (writer?: unknown) => unknown) => callback({})),
  },
}));

const mockDatabase = database as jest.Mocked<typeof database>;

/** A chainable query stub — `extend` returns itself so clause order is observable. */
function stubQuery(rows: unknown[] = []) {
  const query: any = {
    extend: jest.fn(() => query),
    fetch: jest.fn().mockResolvedValue(rows),
  };
  return query;
}

/** A stored message whose `update` applies the mutator to the record itself. */
function stubMessage(overrides: Record<string, unknown> = {}) {
  const record: any = {
    id: 'msg-1',
    deletedAt: undefined,
    ...overrides,
  };
  record.update = jest.fn(async (mutator: (r: any) => void) => mutator(record));
  return record;
}

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveMessage', () => {
    it('creates the row inside a single write block with matching timestamps', async () => {
      const record: any = {};
      const create = jest.fn((callback: (r: any) => void) => {
        callback(record);
        return record;
      });
      mockDatabase.get.mockReturnValue({ create } as any);

      const result = await ChatService.saveMessage({
        sender: 'user',
        message: 'How many calories in an egg?',
        context: 'nutrition',
      });

      expect(mockDatabase.get).toHaveBeenCalledWith('chat_messages');
      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(result).toBe(record);
      expect(record.sender).toBe('user');
      expect(record.message).toBe('How many calories in an egg?');
      expect(record.context).toBe('nutrition');
      expect(record.createdAt).toBe(record.updatedAt);
      expect(typeof record.createdAt).toBe('number');
    });

    it("defaults messageType to 'text' but keeps an explicit payload and summary", async () => {
      const record: any = {};
      mockDatabase.get.mockReturnValue({
        create: jest.fn((callback: (r: any) => void) => {
          callback(record);
          return record;
        }),
      } as any);

      await ChatService.saveMessage({
        sender: 'coach',
        message: 'Logged.',
        context: 'general',
        payloadJson: '{"type":"image"}',
        summarizedMessage: 'logged a meal',
      });

      expect(record.messageType).toBe('text');
      expect(record.payloadJson).toBe('{"type":"image"}');
      expect(record.summarizedMessage).toBe('logged a meal');
    });
  });

  describe('getMessagesByContext', () => {
    it('scopes to the context, excludes soft-deleted rows and returns newest first', async () => {
      const query = stubQuery();
      const collectionQuery = jest.fn().mockReturnValue(query);
      mockDatabase.get.mockReturnValue({ query: collectionQuery } as any);

      await ChatService.getMessagesByContext('exercise');

      expect(Q.where).toHaveBeenCalledWith('context', 'exercise');
      expect(Q.where).toHaveBeenCalledWith('deleted_at', { kind: 'eq', value: null });
      expect(Q.sortBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(collectionQuery.mock.calls[0]).toHaveLength(3);
      expect(query.fetch).toHaveBeenCalledTimes(1);
    });

    it('adds no pagination clauses when no limit is given', async () => {
      const query = stubQuery();
      mockDatabase.get.mockReturnValue({ query: jest.fn().mockReturnValue(query) } as any);

      await ChatService.getMessagesByContext('general');

      expect(query.extend).not.toHaveBeenCalled();
      expect(Q.take).not.toHaveBeenCalled();
      expect(Q.skip).not.toHaveBeenCalled();
    });

    it('takes without skipping when a limit is given but the offset is zero', async () => {
      const query = stubQuery();
      mockDatabase.get.mockReturnValue({ query: jest.fn().mockReturnValue(query) } as any);

      await ChatService.getMessagesByContext('general', 20, 0);

      expect(query.extend).toHaveBeenCalledWith({ kind: 'take', count: 20 });
      expect(Q.skip).not.toHaveBeenCalled();
    });

    it('skips then takes when loading an older page', async () => {
      const query = stubQuery();
      mockDatabase.get.mockReturnValue({ query: jest.fn().mockReturnValue(query) } as any);

      await ChatService.getMessagesByContext('nutrition', 20, 40);

      expect(query.extend).toHaveBeenCalledWith(
        { kind: 'skip', count: 40 },
        { kind: 'take', count: 20 }
      );
    });
  });

  describe('getAllMessages', () => {
    it('pages across every context, newest first, ignoring soft-deleted rows', async () => {
      const query = stubQuery();
      const collectionQuery = jest.fn().mockReturnValue(query);
      mockDatabase.get.mockReturnValue({ query: collectionQuery } as any);

      await ChatService.getAllMessages(10, 30);

      expect(Q.where).toHaveBeenCalledTimes(1);
      expect(Q.where).toHaveBeenCalledWith('deleted_at', { kind: 'eq', value: null });
      expect(Q.skip).toHaveBeenCalledWith(30);
      expect(Q.take).toHaveBeenCalledWith(10);
      expect(query.extend).not.toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    it('soft-deletes by stamping deleted_at rather than destroying the row', async () => {
      const record = stubMessage();
      mockDatabase.get.mockReturnValue({ find: jest.fn().mockResolvedValue(record) } as any);

      await ChatService.deleteMessage('msg-1');

      expect(typeof record.deletedAt).toBe('number');
      expect(record.updatedAt).toBe(record.deletedAt);
      expect(record.destroyPermanently).toBeUndefined();
      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateMessage / updateMessagePayload', () => {
    it('edits only the message body and bumps updated_at', async () => {
      const record = stubMessage({ message: 'old', payloadJson: '{"type":"image"}' });
      mockDatabase.get.mockReturnValue({ find: jest.fn().mockResolvedValue(record) } as any);

      await ChatService.updateMessage('msg-1', 'new');

      expect(record.message).toBe('new');
      expect(record.payloadJson).toBe('{"type":"image"}');
      expect(typeof record.updatedAt).toBe('number');
    });

    it('edits only the payload and leaves the visible message alone', async () => {
      const record = stubMessage({ message: 'Tracked your lunch', payloadJson: '{}' });
      mockDatabase.get.mockReturnValue({ find: jest.fn().mockResolvedValue(record) } as any);

      await ChatService.updateMessagePayload('msg-1', '{"type":"trackedMeal"}');

      expect(record.payloadJson).toBe('{"type":"trackedMeal"}');
      expect(record.message).toBe('Tracked your lunch');
    });
  });

  describe('deleteMessagesByContext', () => {
    it('soft-deletes every message of the context in one write with one shared timestamp', async () => {
      const messages = [stubMessage({ id: 'a' }), stubMessage({ id: 'b' })];
      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(stubQuery(messages)),
      } as any);

      await ChatService.deleteMessagesByContext('nutrition');

      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(messages.map((m) => typeof m.deletedAt)).toEqual(['number', 'number']);
      // A single `now` for the whole clear keeps the batch consistent.
      expect(messages[0].deletedAt).toBe(messages[1].deletedAt);
    });

    it('only fetches messages of the requested context that are not already deleted', async () => {
      const collectionQuery = jest.fn().mockReturnValue(stubQuery([]));
      mockDatabase.get.mockReturnValue({ query: collectionQuery } as any);

      await ChatService.deleteMessagesByContext('exercise');

      expect(Q.where).toHaveBeenCalledWith('context', 'exercise');
      expect(Q.where).toHaveBeenCalledWith('deleted_at', { kind: 'eq', value: null });
      expect(collectionQuery.mock.calls[0]).toHaveLength(2);
    });

    it('updates nothing when the context is already empty', async () => {
      mockDatabase.get.mockReturnValue({ query: jest.fn().mockReturnValue(stubQuery([])) } as any);

      await expect(ChatService.deleteMessagesByContext('general')).resolves.toBeUndefined();
    });
  });
});
