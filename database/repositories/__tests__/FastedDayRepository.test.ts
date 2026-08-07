import AsyncStorage from '@react-native-async-storage/async-storage';

import { MACRO_STREAK_STATE } from '@/constants/misc';
import { dayRangeClauses } from '@/database/dayKeyQuery';
import { FastedDayRepository } from '@/database/repositories/FastedDayRepository';
import {
  dayKeyRange,
  dayKeyRangeForLocalDate,
  localDayStartMs,
  utcDayKeyFromLocalDate,
  utcNormalizedDayKey,
} from '@/utils/calendarDate';
import { getTimezoneAt } from '@/utils/timezone';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, comparison: unknown) => ({
      clause: 'where',
      field,
      comparison,
    })),
    eq: jest.fn((value: unknown) => ({ op: 'eq', value })),
    gte: jest.fn((value: unknown) => ({ op: 'gte', value })),
    lt: jest.fn((value: unknown) => ({ op: 'lt', value })),
  },
}));

// Controllable WatermelonDB stub: `state.rows` is whatever the fasted_days query returns,
// `state.created`/`state.batched` capture everything the repository prepares and commits.
jest.mock('@/database/database-instance', () => {
  const state: { rows: any[]; created: any[]; batched: any[][] } = {
    rows: [],
    created: [],
    batched: [],
  };

  const fetch = jest.fn(async () => [...state.rows]);

  const collection = {
    query: jest.fn(() => ({ fetch })),
    prepareCreate: jest.fn((callback: (record: any) => void) => {
      const record: any = { id: `created-${state.created.length + 1}` };
      callback(record);
      state.created.push(record);
      return record;
    }),
  };

  const database = {
    get: jest.fn(() => collection),
    write: jest.fn(async (callback: () => unknown) => callback()),
    batch: jest.fn(async (...records: any[]) => {
      state.batched.push(records);
    }),
  };

  return { __esModule: true, database, __state: state, __collection: collection, __fetch: fetch };
});

const dbMock = jest.requireMock('@/database/database-instance') as {
  database: {
    get: jest.Mock;
    write: jest.Mock;
    batch: jest.Mock;
  };
  __state: { rows: any[]; created: any[]; batched: any[][] };
  __collection: { query: jest.Mock; prepareCreate: jest.Mock };
  __fetch: jest.Mock;
};

const { database, __state: state, __collection: collection, __fetch: fetch } = dbMock;

const eq = (value: unknown) => ({ op: 'eq', value });
const where = (field: string, comparison: unknown) => ({ clause: 'where', field, comparison });

/**
 * A stored fasted_days row, with a `prepareUpdate` that applies its patch in place.
 * `timezone` defaults to the offset in effect at `date` — the matched (date, timezone)
 * pair the repository itself writes — so a row built from a device-local instant buckets
 * onto that same local day. Pass `timezone` explicitly to simulate another device.
 */
function makeRow({ date, ...overrides }: Record<string, unknown> & { date: number }) {
  const row: any = {
    id: 'row-1',
    date,
    timezone: getTimezoneAt(date),
    createdAt: 1_000,
    updatedAt: 1_000,
    deletedAt: null,
    ...overrides,
  };
  row.prepareUpdate = jest.fn((callback: (record: any) => void) => {
    callback(row);
    return { kind: 'update', id: row.id };
  });
  return row;
}

const setRows = (...rows: any[]) => {
  state.rows = rows;
};

const clausesOf = (call = 0) => collection.query.mock.calls[call];

const NOW = new Date(2026, 0, 15, 9, 30, 0).getTime();
const DAY = new Date(2026, 0, 15);

describe('FastedDayRepository', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    jest.setSystemTime(NOW);
    state.rows = [];
    state.created.length = 0;
    state.batched.length = 0;
    jest.clearAllMocks();
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isFasted', () => {
    it('queries fasted_days over the widened bounds of the requested calendar day', async () => {
      setRows(makeRow({ date: DAY.getTime() }));

      await expect(FastedDayRepository.isFasted(DAY)).resolves.toBe(true);

      expect(database.get).toHaveBeenCalledWith('fasted_days');
      expect(clausesOf()).toEqual(dayRangeClauses(dayKeyRangeForLocalDate(DAY)));
    });

    // No deleted_at clause here on purpose: markFasted needs to SEE a soft-deleted row for
    // that day so it can revive it instead of inserting a second row for the same day.
    it('reads rows in any deleted state, then filters actives in memory', async () => {
      setRows(makeRow({ date: DAY.getTime(), deletedAt: 5_000 }));

      await expect(FastedDayRepository.isFasted(DAY)).resolves.toBe(false);

      expect(clausesOf()).not.toContainEqual(where('deleted_at', eq(null)));
    });

    it('returns false when the day has no rows at all', async () => {
      setRows();

      await expect(FastedDayRepository.isFasted(DAY)).resolves.toBe(false);
    });

    // AGENTS.md: a fasted day is stamped with `date` + `timezone` like nutrition_logs, so
    // `utcNormalizedDayKey(date, timezone)` shares the exact bucket space. The widened DB
    // bounds over-scan by ±14h; `range.filterRecords` must trim that back by each row's
    // own stored offset, or a neighbouring day's flag would count as today's.
    it('buckets rows by their own stored timezone, not the raw timestamp (widen-then-trim)', async () => {
      const amsterdamOnTheDay = makeRow({
        id: 'amsterdam',
        date: Date.UTC(2026, 0, 14, 23, 30),
        timezone: '+01:00',
      });
      const brazilPreviousDay = makeRow({
        id: 'brazil',
        date: Date.UTC(2026, 0, 15, 1, 0),
        timezone: '-03:00',
      });

      const targetKey = utcDayKeyFromLocalDate(DAY);
      expect(utcNormalizedDayKey(amsterdamOnTheDay.date, amsterdamOnTheDay.timezone)).toBe(
        targetKey
      );
      expect(utcNormalizedDayKey(brazilPreviousDay.date, brazilPreviousDay.timezone)).not.toBe(
        targetKey
      );

      setRows(brazilPreviousDay);
      await expect(FastedDayRepository.isFasted(DAY)).resolves.toBe(false);

      setRows(amsterdamOnTheDay);
      await expect(FastedDayRepository.isFasted(DAY)).resolves.toBe(true);
    });
  });

  describe('markFasted', () => {
    // The whole point of the (date, timezone) pair: the key this row produces must be
    // identical to the key a nutrition log consumed on the same day would produce.
    it('stamps date+timezone so utcNormalizedDayKey matches the nutrition-log day key', async () => {
      setRows();

      await FastedDayRepository.markFasted(DAY);

      const [created] = state.created;
      expect(utcNormalizedDayKey(created.date, created.timezone)).toBe(utcDayKeyFromLocalDate(DAY));
      expect(created.deletedAt).toBeNull();
      expect(created.createdAt).toBe(NOW);
      expect(created.updatedAt).toBe(NOW);
      expect(database.batch).toHaveBeenCalledWith(created);
    });

    // Mirrors nutrition_logs.date, which is a consumed datetime rather than a day key.
    it('stores a consumed datetime, not a midnight day key', async () => {
      setRows();

      await FastedDayRepository.markFasted(DAY);

      expect(state.created[0].date).not.toBe(localDayStartMs(DAY));
      expect(state.created[0].date).toBe(new Date(2026, 0, 15, 9, 30, 0).getTime());
    });

    it('is idempotent: an already-flagged day creates no second row', async () => {
      setRows(makeRow({ date: DAY.getTime() }));

      await FastedDayRepository.markFasted(DAY);

      expect(collection.prepareCreate).not.toHaveBeenCalled();
      expect(database.batch).not.toHaveBeenCalled();
    });

    // The unified-denominator rule counts DISTINCT days; duplicates would still collapse in
    // the Set, but leaving them around lets an unmark miss one and resurrect the flag.
    it('collapses duplicate active rows for one day down to a single flag', async () => {
      const keeper = makeRow({ id: 'keeper', date: DAY.getTime() });
      const duplicate = makeRow({ id: 'duplicate', date: DAY.getTime() });
      setRows(keeper, duplicate);

      await FastedDayRepository.markFasted(DAY);

      expect(keeper.deletedAt).toBeNull();
      expect(duplicate.deletedAt).toBe(NOW);
      expect(database.batch).toHaveBeenCalledWith({ kind: 'update', id: 'duplicate' });
      expect(collection.prepareCreate).not.toHaveBeenCalled();
    });

    // Soft-delete-then-re-mark: one row per day, revived rather than duplicated.
    it('revives a soft-deleted row instead of inserting a second row for the same day', async () => {
      const previouslyUnmarked = makeRow({
        id: 'revived',
        date: DAY.getTime(),
        deletedAt: 5_000,
      });
      setRows(previouslyUnmarked);

      await FastedDayRepository.markFasted(DAY);

      expect(collection.prepareCreate).not.toHaveBeenCalled();
      expect(previouslyUnmarked.deletedAt).toBeNull();
      expect(previouslyUnmarked.updatedAt).toBe(NOW);
      expect(utcNormalizedDayKey(previouslyUnmarked.date, previouslyUnmarked.timezone)).toBe(
        utcDayKeyFromLocalDate(DAY)
      );
      expect(database.batch).toHaveBeenCalledWith({ kind: 'update', id: 'revived' });
    });

    // AGENTS.md read-then-write rule: the "does a row already exist for this day?" read
    // must happen inside the same database.write() as the insert, or two concurrent marks
    // both observe an empty day and each insert a row.
    it('reads the existing rows INSIDE the write block (TOCTOU guard)', async () => {
      setRows();
      let fetchedDuringWrite = false;

      database.write.mockImplementationOnce(async (callback: () => unknown) => {
        expect(fetch).not.toHaveBeenCalled();
        const result = await callback();
        fetchedDuringWrite = fetch.mock.calls.length === 1;
        return result;
      });

      await FastedDayRepository.markFasted(DAY);

      expect(fetchedDuringWrite).toBe(true);
    });

    it('busts the macro streak cache so the streak recomputes with the new fasted day', async () => {
      setRows();

      await FastedDayRepository.markFasted(DAY);

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(MACRO_STREAK_STATE);
    });

    it('still succeeds when busting the streak cache fails', async () => {
      setRows();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('storage full'));

      await expect(FastedDayRepository.markFasted(DAY)).resolves.toBeUndefined();
      expect(state.created).toHaveLength(1);
    });
  });

  describe('unmarkFasted', () => {
    it('soft-deletes every active row for the day and busts the streak cache', async () => {
      const first = makeRow({ id: 'first', date: DAY.getTime() });
      const second = makeRow({ id: 'second', date: DAY.getTime() });
      setRows(first, second);

      await FastedDayRepository.unmarkFasted(DAY);

      expect(first.deletedAt).toBe(NOW);
      expect(second.deletedAt).toBe(NOW);
      expect(first.updatedAt).toBe(NOW);
      expect(database.batch).toHaveBeenCalledWith(
        { kind: 'update', id: 'first' },
        { kind: 'update', id: 'second' }
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(MACRO_STREAK_STATE);
    });

    it('is a no-op on a day that was never flagged, leaving the streak cache warm', async () => {
      setRows(makeRow({ date: DAY.getTime(), deletedAt: 5_000 }));

      await FastedDayRepository.unmarkFasted(DAY);

      expect(database.batch).not.toHaveBeenCalled();
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('reads the active rows INSIDE the write block (TOCTOU guard)', async () => {
      setRows(makeRow({ date: DAY.getTime() }));
      let fetchedDuringWrite = false;

      database.write.mockImplementationOnce(async (callback: () => unknown) => {
        expect(fetch).not.toHaveBeenCalled();
        const result = await callback();
        fetchedDuringWrite = fetch.mock.calls.length === 1;
        return result;
      });

      await FastedDayRepository.unmarkFasted(DAY);

      expect(fetchedDuringWrite).toBe(true);
    });
  });

  describe('getFastedDayKeys', () => {
    const START = new Date(2026, 0, 10);
    const END = new Date(2026, 0, 20);

    it('filters soft-deleted rows in SQL and windows on the widened day bounds', async () => {
      setRows();

      await FastedDayRepository.getFastedDayKeys(START, END);

      const range = dayKeyRange(utcDayKeyFromLocalDate(START), utcDayKeyFromLocalDate(END));
      expect(clausesOf()).toEqual([where('deleted_at', eq(null)), ...dayRangeClauses(range)]);
    });

    it('returns an empty set when nothing in the range is flagged', async () => {
      setRows();

      await expect(FastedDayRepository.getFastedDayKeys(START, END)).resolves.toEqual(
        new Set<number>()
      );
    });

    it('normalizes each row by its own stored timezone into the shared key space', async () => {
      setRows(
        makeRow({ id: 'a', date: Date.UTC(2026, 0, 14, 23, 30), timezone: '+01:00' }),
        makeRow({ id: 'b', date: Date.UTC(2026, 0, 16, 3, 0), timezone: '-03:00' })
      );

      await expect(FastedDayRepository.getFastedDayKeys(START, END)).resolves.toEqual(
        new Set([Date.UTC(2026, 0, 15), Date.UTC(2026, 0, 16)])
      );
    });

    // Two flags on the same calendar day must not inflate `effectiveDayCount`, which is a
    // denominator for every historical macro average.
    it('collapses several rows on one calendar day into a single day key', async () => {
      setRows(
        makeRow({ id: 'morning', date: Date.UTC(2026, 0, 15, 8, 0), timezone: '+00:00' }),
        makeRow({ id: 'evening', date: Date.UTC(2026, 0, 15, 21, 0), timezone: '+00:00' })
      );

      const keys = await FastedDayRepository.getFastedDayKeys(START, END);

      expect(keys.size).toBe(1);
      expect(keys).toEqual(new Set([Date.UTC(2026, 0, 15)]));
    });

    it('trims rows the ±14h overscan pulled in but that fall outside the range', async () => {
      setRows(
        makeRow({ id: 'inside', date: Date.UTC(2026, 0, 15, 12, 0), timezone: '+00:00' }),
        makeRow({ id: 'after-end', date: Date.UTC(2026, 0, 21, 6, 0), timezone: '+00:00' }),
        makeRow({ id: 'before-start', date: Date.UTC(2026, 0, 9, 18, 0), timezone: '+00:00' })
      );

      await expect(FastedDayRepository.getFastedDayKeys(START, END)).resolves.toEqual(
        new Set([Date.UTC(2026, 0, 15)])
      );
    });
  });

  describe('getAllFastedDayKeys', () => {
    // Streak paths cannot be windowed: a back-dated flag can extend a streak arbitrarily
    // far, so this read must carry no date bounds at all.
    it('reads unbounded, filtering only soft-deleted rows', async () => {
      setRows(makeRow({ date: Date.UTC(2020, 5, 1, 12, 0), timezone: '+00:00' }));

      await FastedDayRepository.getAllFastedDayKeys();

      expect(clausesOf()).toEqual([where('deleted_at', eq(null))]);
    });

    it('normalizes every row by its own timezone and dedupes shared days', async () => {
      setRows(
        makeRow({ id: 'a', date: Date.UTC(2026, 0, 14, 23, 30), timezone: '+01:00' }),
        makeRow({ id: 'b', date: Date.UTC(2026, 0, 15, 10, 0), timezone: '+00:00' }),
        makeRow({ id: 'c', date: Date.UTC(2019, 11, 31, 12, 0), timezone: '+00:00' })
      );

      await expect(FastedDayRepository.getAllFastedDayKeys()).resolves.toEqual(
        new Set([Date.UTC(2026, 0, 15), Date.UTC(2019, 11, 31)])
      );
    });

    it('returns an empty set when nothing has ever been flagged', async () => {
      setRows();

      await expect(FastedDayRepository.getAllFastedDayKeys()).resolves.toEqual(new Set<number>());
    });
  });
});
