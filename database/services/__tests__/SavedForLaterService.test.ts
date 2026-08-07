import { Q } from '@nozbe/watermelondb';

import { database } from '@/database';
import { decryptOptionalString } from '@/database/encryptionHelpers';
import type NutritionLog from '@/database/models/NutritionLog';
import { SavedForLaterService } from '@/database/services/SavedForLaterService';
import { utcDayKeyFromLocalDate, utcNormalizedDayKey } from '@/utils/calendarDate';
import { widgetEvents } from '@/utils/widgetEvents';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => ({ kind: 'eq', value })),
    sortBy: jest.fn((field: string, direction: string) => ({ kind: 'sortBy', field, direction })),
    asc: 'asc',
    desc: 'desc',
  },
}));

jest.mock('@/database', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(async (callback: (writer?: unknown) => unknown) => callback({})),
    batch: jest.fn(async () => undefined),
  },
}));

jest.mock('@/utils/widgetEvents', () => ({
  widgetEvents: { emitNutritionWidgetUpdate: jest.fn() },
}));

jest.mock('@/database/services/DatabaseRepairService', () => ({
  DatabaseRepairService: {},
  REPAIR_DESCRIPTORS: { savedForLater: 'savedForLater' },
  retryAfterRepair: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { retryAfterRepair } = require('@/database/services/DatabaseRepairService');

const mockDatabase = database as jest.Mocked<typeof database>;

const IS_NULL = { kind: 'eq', value: null };

type CollectionStub = {
  created: any[];
  find: jest.Mock;
  prepareCreate: jest.Mock;
  query: jest.Mock;
  queryClauses: unknown[][];
};

function makeCollection(table: string, options: { find?: unknown; rows?: unknown[] } = {}) {
  const created: any[] = [];
  const queryClauses: unknown[][] = [];

  const collection: CollectionStub = {
    created,
    queryClauses,
    find: jest.fn().mockResolvedValue(options.find),
    prepareCreate: jest.fn((callback: (r: any) => void) => {
      const record: any = { id: `${table}-${created.length + 1}` };
      callback(record);
      created.push(record);
      return record;
    }),
    query: jest.fn((...clauses: unknown[]) => {
      queryClauses.push(clauses);
      return { fetch: jest.fn().mockResolvedValue(options.rows ?? []) };
    }),
  };

  return collection;
}

/** Routes `database.get(table)` to a per-table stub, creating empty ones on demand. */
function wireDatabase(map: Record<string, CollectionStub>) {
  mockDatabase.get.mockImplementation(
    ((table: string) => (map[table] ??= makeCollection(table))) as any
  );
  return map;
}

/** A stored nutrition log — only the fields the save path snapshots. */
function stubLog(overrides: Record<string, unknown> = {}) {
  const record: any = {
    id: 'log-1',
    foodId: 'food-1',
    amount: 100,
    portionId: 'portion-1',
    loggedFoodNameRaw: 'cipher-name',
    loggedCaloriesRaw: 'cipher-cal',
    loggedProteinRaw: 'cipher-pro',
    loggedCarbsRaw: 'cipher-carb',
    loggedFatRaw: 'cipher-fat',
    loggedFiberRaw: 'cipher-fib',
    loggedMicrosRaw: 'cipher-mic',
    loggedMealName: undefined,
    groupId: undefined,
    deletedAt: undefined,
    ...overrides,
  };
  record.prepareUpdate = jest.fn((mutator: (r: any) => void) => {
    mutator(record);
    return record;
  });
  return record as NutritionLog & Record<string, any>;
}

/** A stored saved-for-later item as `trackGroup` / `deleteGroup` see it. */
function stubItem(overrides: Record<string, unknown> = {}) {
  const record: any = {
    id: 'item-1',
    groupId: 'group-1',
    foodId: 'food-1',
    amount: 100,
    portionId: 'portion-1',
    loggedFoodNameRaw: 'cipher-name',
    loggedCaloriesRaw: 'cipher-cal',
    loggedProteinRaw: 'cipher-pro',
    loggedCarbsRaw: 'cipher-carb',
    loggedFatRaw: 'cipher-fat',
    loggedFiberRaw: 'cipher-fib',
    loggedMicrosRaw: 'cipher-mic',
    loggedMealName: undefined,
    originalGroupId: undefined,
    deletedAt: undefined,
    ...overrides,
  };
  record.prepareUpdate = jest.fn((mutator: (r: any) => void) => {
    mutator(record);
    return record;
  });
  return record;
}

function stubGroup(overrides: Record<string, unknown> = {}) {
  const record: any = { id: 'group-1', name: 'Leftovers', deletedAt: undefined, ...overrides };
  record.prepareUpdate = jest.fn((mutator: (r: any) => void) => {
    mutator(record);
    return record;
  });
  return record;
}

describe('SavedForLaterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (retryAfterRepair as jest.Mock).mockResolvedValue(undefined);
  });

  describe('saveGroupForLater — note encryption', () => {
    // AGENTS.md: unlike `notes.title` / `notes.body` (deliberately plaintext so the list
    // query stays SQL-side), `saved_for_later_groups.note` is encrypted at rest.
    it('stores the note as ciphertext that round-trips back to the original text', async () => {
      const map = wireDatabase({});

      await SavedForLaterService.saveGroupForLater(
        [stubLog()],
        'Leftovers',
        'dinner',
        Date.now(),
        100,
        'Half the curry, reheat 2 min'
      );

      const [group] = map.saved_for_later_groups.created;
      expect(group.noteRaw).toBeDefined();
      expect(group.noteRaw).not.toBe('Half the curry, reheat 2 min');
      expect(group.noteRaw).not.toContain('curry');
      await expect(decryptOptionalString(group.noteRaw)).resolves.toBe(
        'Half the curry, reheat 2 min'
      );
    });

    it('leaves the note column unset rather than storing empty ciphertext', async () => {
      const map = wireDatabase({});

      await SavedForLaterService.saveGroupForLater([stubLog()], 'Leftovers', 'dinner', Date.now());

      expect(map.saved_for_later_groups.created[0].noteRaw).toBeUndefined();
    });

    it('encrypts before opening the write block, so no async crypto runs in the transaction', async () => {
      wireDatabase({});
      let writeOpened = false;
      (mockDatabase.write as jest.Mock).mockImplementationOnce(async (callback: () => unknown) => {
        writeOpened = true;
        return await callback();
      });

      const promise = SavedForLaterService.saveGroupForLater(
        [stubLog()],
        'Leftovers',
        'dinner',
        Date.now(),
        100,
        'secret'
      );
      expect(writeOpened).toBe(false);

      await promise;
      expect(writeOpened).toBe(true);
    });
  });

  describe('saveGroupForLater — percentages', () => {
    it('snapshots the whole log and soft-deletes the original at 100%', async () => {
      const log = stubLog({ amount: 250 });
      const map = wireDatabase({});

      await SavedForLaterService.saveGroupForLater([log], 'Leftovers', 'lunch', Date.now(), 100);

      expect(map.saved_for_later_items.created[0].amount).toBe(250);
      expect(typeof (log as any).deletedAt).toBe('number');
      expect((log as any).amount).toBe(250);
    });

    it('splits the log at a partial percentage instead of deleting it', async () => {
      const log = stubLog({ amount: 200 });
      const map = wireDatabase({});

      await SavedForLaterService.saveGroupForLater([log], 'Half', 'lunch', Date.now(), 40);

      expect(map.saved_for_later_items.created[0].amount).toBeCloseTo(80);
      expect((log as any).amount).toBeCloseTo(120);
      expect((log as any).deletedAt).toBeUndefined();
    });

    it('clamps a percentage above 100 so the original is never scaled up', async () => {
      const log = stubLog({ amount: 100 });
      const map = wireDatabase({});

      await SavedForLaterService.saveGroupForLater([log], 'All', 'lunch', Date.now(), 150);

      expect(map.saved_for_later_items.created[0].amount).toBe(100);
      expect(typeof (log as any).deletedAt).toBe('number');
    });

    it('copies the encrypted macro snapshot verbatim rather than re-encrypting it', async () => {
      const log = stubLog();
      const map = wireDatabase({});

      await SavedForLaterService.saveGroupForLater([log], 'Leftovers', 'lunch', Date.now());

      expect(map.saved_for_later_items.created[0]).toMatchObject({
        loggedFoodNameRaw: 'cipher-name',
        loggedCaloriesRaw: 'cipher-cal',
        loggedProteinRaw: 'cipher-pro',
        loggedCarbsRaw: 'cipher-carb',
        loggedFatRaw: 'cipher-fat',
        loggedFiberRaw: 'cipher-fib',
        loggedMicrosRaw: 'cipher-mic',
      });
    });

    it('remembers the meal group_id so a grouped meal can be restored as one meal', async () => {
      const map = wireDatabase({});

      await SavedForLaterService.saveGroupForLater(
        [
          stubLog({ id: 'a', groupId: 'meal-7', loggedMealName: 'Chicken bowl' }),
          stubLog({ id: 'b', groupId: 'meal-7', loggedMealName: 'Chicken bowl' }),
        ],
        'Leftovers',
        'dinner',
        Date.now()
      );

      expect(map.saved_for_later_items.created.map((i) => i.originalGroupId)).toEqual([
        'meal-7',
        'meal-7',
      ]);
      expect(map.saved_for_later_items.created.map((i) => i.loggedMealName)).toEqual([
        'Chicken bowl',
        'Chicken bowl',
      ]);
    });

    it('writes the group, its items and the original logs in one atomic batch', async () => {
      const logs = [stubLog({ id: 'a' }), stubLog({ id: 'b' })];
      const map = wireDatabase({});

      const group = await SavedForLaterService.saveGroupForLater(
        logs,
        'Leftovers',
        'dinner',
        Date.now()
      );

      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      const batched = (mockDatabase.batch as jest.Mock).mock.calls[0];
      expect(batched).toHaveLength(1 + 2 + 2);
      expect(batched[0]).toBe(group);
      // Every item points at the group created in the same batch.
      expect(map.saved_for_later_items.created.every((i) => i.groupId === group.id)).toBe(true);
      expect(widgetEvents.emitNutritionWidgetUpdate).toHaveBeenCalledTimes(1);
    });

    it('rethrows when the repair pass cannot recover the write', async () => {
      wireDatabase({});
      const failure = new Error('database disk image is malformed');
      (mockDatabase.write as jest.Mock).mockRejectedValueOnce(failure);

      await expect(
        SavedForLaterService.saveGroupForLater([stubLog()], 'Leftovers', 'dinner', Date.now())
      ).rejects.toThrow(failure);
      expect(retryAfterRepair).toHaveBeenCalledWith(failure, 'savedForLater', expect.any(Function));
    });

    it('returns the repaired result when a repair pass succeeds', async () => {
      wireDatabase({});
      const recovered = { id: 'group-recovered' };
      (mockDatabase.write as jest.Mock).mockRejectedValueOnce(new Error('corrupt'));
      (retryAfterRepair as jest.Mock).mockResolvedValueOnce(recovered);

      await expect(
        SavedForLaterService.saveGroupForLater([stubLog()], 'Leftovers', 'dinner', Date.now())
      ).resolves.toBe(recovered);
    });
  });

  describe('reads', () => {
    it('lists only live groups, newest first', async () => {
      const map = wireDatabase({ saved_for_later_groups: makeCollection('g', { rows: [] }) });

      await SavedForLaterService.getAllGroups();

      expect(Q.where).toHaveBeenCalledWith('deleted_at', IS_NULL);
      expect(Q.sortBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(map.saved_for_later_groups.queryClauses[0]).toHaveLength(2);
    });

    it('scopes a group read to its own live items', async () => {
      const group = stubGroup();
      const map = wireDatabase({
        saved_for_later_groups: makeCollection('g', { find: group }),
        saved_for_later_items: makeCollection('i', { rows: [stubItem()] }),
      });

      const result = await SavedForLaterService.getGroupWithItems('group-1');

      expect(result.group).toBe(group);
      expect(result.items).toHaveLength(1);
      expect(map.saved_for_later_items.queryClauses[0]).toEqual([
        { field: 'group_id', condition: 'group-1' },
        { field: 'deleted_at', condition: IS_NULL },
      ]);
    });

    it('reports whether any saved meal exists', async () => {
      wireDatabase({ saved_for_later_groups: makeCollection('g', { rows: [] }) });
      await expect(SavedForLaterService.hasAnyGroups()).resolves.toBe(false);

      wireDatabase({ saved_for_later_groups: makeCollection('g', { rows: [stubGroup()] }) });
      await expect(SavedForLaterService.hasAnyGroups()).resolves.toBe(true);
    });
  });

  describe('trackGroup', () => {
    it('restores each item onto the target day and meal type, then consumes the group', async () => {
      const group = stubGroup();
      const items = [stubItem({ id: 'i1', amount: 80 }), stubItem({ id: 'i2', amount: 20 })];
      const map = wireDatabase({
        saved_for_later_groups: makeCollection('g', { find: group }),
        saved_for_later_items: makeCollection('i', { rows: items }),
      });
      const targetDate = new Date(2026, 7, 1);

      await SavedForLaterService.trackGroup('group-1', targetDate, 'breakfast');

      const logs = map.nutrition_logs.created;
      expect(logs).toHaveLength(2);
      expect(logs.map((l) => l.type)).toEqual(['breakfast', 'breakfast']);
      expect(logs.map((l) => l.amount)).toEqual([80, 20]);
      expect(utcNormalizedDayKey(logs[0].date, logs[0].timezone)).toBe(
        utcDayKeyFromLocalDate(targetDate)
      );

      // Group and items are soft-deleted in the same batch that inserts the logs.
      expect(typeof group.deletedAt).toBe('number');
      expect(items.map((i) => typeof i.deletedAt)).toEqual(['number', 'number']);
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      expect((mockDatabase.batch as jest.Mock).mock.calls[0]).toHaveLength(2 + 1 + 2);
      expect(widgetEvents.emitNutritionWidgetUpdate).toHaveBeenCalledTimes(1);
    });

    it('restores the original meal group_id so a saved meal comes back grouped', async () => {
      const items = [
        stubItem({ id: 'i1', originalGroupId: 'meal-7', loggedMealName: 'Chicken bowl' }),
        stubItem({ id: 'i2', originalGroupId: undefined }),
      ];
      const map = wireDatabase({
        saved_for_later_groups: makeCollection('g', { find: stubGroup() }),
        saved_for_later_items: makeCollection('i', { rows: items }),
      });

      await SavedForLaterService.trackGroup('group-1', new Date(2026, 7, 1), 'dinner');

      expect(map.nutrition_logs.created.map((l) => l.groupId)).toEqual(['meal-7', undefined]);
      expect(map.nutrition_logs.created[0].loggedMealName).toBe('Chicken bowl');
    });

    it('carries the encrypted snapshot straight back into the nutrition log', async () => {
      const map = wireDatabase({
        saved_for_later_groups: makeCollection('g', { find: stubGroup() }),
        saved_for_later_items: makeCollection('i', { rows: [stubItem()] }),
      });

      await SavedForLaterService.trackGroup('group-1', new Date(2026, 7, 1), 'lunch');

      expect(map.nutrition_logs.created[0]).toMatchObject({
        loggedFoodNameRaw: 'cipher-name',
        loggedCaloriesRaw: 'cipher-cal',
        loggedMicrosRaw: 'cipher-mic',
      });
    });
  });

  describe('deleteGroup', () => {
    it('soft-deletes the group and its items without recreating any nutrition log', async () => {
      const group = stubGroup();
      const items = [stubItem({ id: 'i1' }), stubItem({ id: 'i2' })];
      const map = wireDatabase({
        saved_for_later_groups: makeCollection('g', { find: group }),
        saved_for_later_items: makeCollection('i', { rows: items }),
      });

      await SavedForLaterService.deleteGroup('group-1');

      expect(typeof group.deletedAt).toBe('number');
      expect(items.map((i) => typeof i.deletedAt)).toEqual(['number', 'number']);
      expect(map.nutrition_logs?.created ?? []).toHaveLength(0);
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      expect((mockDatabase.batch as jest.Mock).mock.calls[0]).toHaveLength(3);
      // Discarding a saved meal changes no consumed totals, so the widget stays put.
      expect(widgetEvents.emitNutritionWidgetUpdate).not.toHaveBeenCalled();
    });
  });
});
