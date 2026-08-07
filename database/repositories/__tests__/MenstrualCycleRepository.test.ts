import { MenstrualCycleRepository } from '@/database/repositories/MenstrualCycleRepository';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { getCurrentTimezone } from '@/utils/timezone';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, comparison: unknown) => ({
      clause: 'where',
      field,
      comparison,
    })),
    eq: jest.fn((value: unknown) => ({ op: 'eq', value })),
    notEq: jest.fn((value: unknown) => ({ op: 'notEq', value })),
    sortBy: jest.fn((field: string, direction: string) => ({ clause: 'sortBy', field, direction })),
    asc: 'asc',
    desc: 'desc',
  },
}));

// Two collections behind one `database.get`, so a test can tell a prepared cycle apart
// from a prepared period log and inspect exactly what went into each batch.
jest.mock('@/database/database-instance', () => {
  const state: {
    activeCycles: any[];
    createdCycles: any[];
    preparedCycles: any[];
    preparedLogs: any[];
    batched: any[][];
  } = {
    activeCycles: [],
    createdCycles: [],
    preparedCycles: [],
    preparedLogs: [],
    batched: [],
  };

  const cyclesFetch = jest.fn(async () => [...state.activeCycles]);

  const cyclesCollection = {
    query: jest.fn(() => ({ fetch: cyclesFetch })),
    create: jest.fn(async (callback: (record: any) => void) => {
      const record: any = { id: `created-cycle-${state.createdCycles.length + 1}` };
      callback(record);
      state.createdCycles.push(record);
      return record;
    }),
    prepareCreate: jest.fn((callback: (record: any) => void) => {
      const record: any = { id: `cycle-${state.preparedCycles.length + 1}` };
      callback(record);
      state.preparedCycles.push(record);
      return record;
    }),
  };

  const logsCollection = {
    prepareCreate: jest.fn((callback: (record: any) => void) => {
      const record: any = { id: `log-${state.preparedLogs.length + 1}` };
      callback(record);
      state.preparedLogs.push(record);
      return record;
    }),
  };

  const callWriter = jest.fn((fn: () => unknown) => fn());

  const database = {
    get: jest.fn((table: string) =>
      table === 'menstrual_cycles' ? cyclesCollection : logsCollection
    ),
    write: jest.fn(async (callback: (writer: unknown) => unknown) => callback({ callWriter })),
    batch: jest.fn(async (...records: any[]) => {
      state.batched.push(records);
    }),
  };

  return {
    __esModule: true,
    database,
    __state: state,
    __cyclesCollection: cyclesCollection,
    __logsCollection: logsCollection,
    __cyclesFetch: cyclesFetch,
    __callWriter: callWriter,
  };
});

const dbMock = jest.requireMock('@/database/database-instance') as {
  database: { get: jest.Mock; write: jest.Mock; batch: jest.Mock };
  __state: {
    activeCycles: any[];
    createdCycles: any[];
    preparedCycles: any[];
    preparedLogs: any[];
    batched: any[][];
  };
  __cyclesCollection: { query: jest.Mock; create: jest.Mock; prepareCreate: jest.Mock };
  __logsCollection: { prepareCreate: jest.Mock };
  __cyclesFetch: jest.Mock;
  __callWriter: jest.Mock;
};

const {
  database,
  __state: state,
  __cyclesCollection: cycles,
  __logsCollection: logs,
  __cyclesFetch: cyclesFetch,
  __callWriter: callWriter,
} = dbMock;

const eq = (value: unknown) => ({ op: 'eq', value });
const where = (field: string, comparison: unknown) => ({ clause: 'where', field, comparison });
const sortBy = (field: string, direction: string) => ({ clause: 'sortBy', field, direction });

const DAY = MS_PER_SOLAR_DAY;
const daysAgo = (n: number) => Date.now() - n * DAY;

/** An existing active cycle whose `prepareUpdate` applies its patch in place. */
function makeActiveCycle(id: string) {
  const cycle: any = { id, isActive: true, updatedAt: 0 };
  cycle.prepareUpdate = jest.fn((callback: (record: any) => void) => {
    callback(cycle);
    return { kind: 'update', id };
  });
  cycle.updateCycle = jest.fn(async (patch: Record<string, unknown>) => {
    Object.assign(cycle, patch);
  });
  return cycle;
}

describe('MenstrualCycleRepository', () => {
  beforeEach(() => {
    state.activeCycles = [];
    state.createdCycles.length = 0;
    state.preparedCycles.length = 0;
    state.preparedLogs.length = 0;
    state.batched.length = 0;
    jest.clearAllMocks();
  });

  describe('getActive / getAll', () => {
    it('getActive selects the flagged-active, non-deleted cycle', () => {
      MenstrualCycleRepository.getActive();

      expect(database.get).toHaveBeenCalledWith('menstrual_cycles');
      expect(cycles.query.mock.calls[0]).toEqual([
        where('is_active', true),
        where('deleted_at', eq(null)),
      ]);
    });

    it('getAll returns every non-deleted cycle newest first, active or not', () => {
      MenstrualCycleRepository.getAll();

      expect(cycles.query.mock.calls[0]).toEqual([
        where('deleted_at', eq(null)),
        sortBy('created_at', 'desc'),
      ]);
      expect(cycles.query.mock.calls[0]).not.toContainEqual(where('is_active', true));
    });
  });

  describe('createNewCycle', () => {
    it('applies the documented defaults inside a write block', async () => {
      const cycle = await MenstrualCycleRepository.createNewCycle({});

      expect(database.write).toHaveBeenCalled();
      expect(cycle.avgCycleLength).toBe(28);
      expect(cycle.avgPeriodDuration).toBe(5);
      expect(cycle.useHormonalBirthControl).toBe(false);
      expect(cycle.birthControlType).toBeNull();
      expect(cycle.syncGoal).toBeNull();
      expect(cycle.lifeStage).toBeNull();
      expect(cycle.isActive).toBe(true);
      expect(cycle.deletedAt).toBeNull();
      expect(cycle.timezone).toBe(getCurrentTimezone());
      expect(cycle.createdAt).toBe(cycle.updatedAt);
    });

    // A cycle created without logs has no period to anchor to; PeriodLogRepository sets the
    // anchor when the first log lands. A non-zero placeholder would fake a period.
    it('leaves lastPeriodStartDate unanchored at 0 when no logs accompany the cycle', async () => {
      const cycle = await MenstrualCycleRepository.createNewCycle({ avgCycleLength: 30 });

      expect(cycle.lastPeriodStartDate).toBe(0);
      expect(cycle.avgCycleLength).toBe(30);
    });

    it('passes explicit birth-control and life-stage choices through', async () => {
      const cycle = await MenstrualCycleRepository.createNewCycle({
        useHormonalBirthControl: true,
        birthControlType: 'pill',
        syncGoal: 'performance',
        lifeStage: 'perimenopause',
      } as any);

      expect(cycle.useHormonalBirthControl).toBe(true);
      expect(cycle.birthControlType).toBe('pill');
      expect(cycle.syncGoal).toBe('performance');
      expect(cycle.lifeStage).toBe('perimenopause');
    });
  });

  describe('createNewCycleWithLogs', () => {
    // "Either both exist or neither": the cycle and its logs must land in ONE batch, so a
    // crash can't leave a cycle with no periods (or orphan logs).
    it('commits the cycle and its logs in a single atomic batch', async () => {
      await MenstrualCycleRepository.createNewCycleWithLogs({}, [
        { startDate: daysAgo(40) },
        { startDate: daysAgo(10) },
      ]);

      expect(database.batch).toHaveBeenCalledTimes(1);
      expect(state.batched[0]).toHaveLength(3);
      expect(state.batched[0][0]).toBe(state.preparedCycles[0]);
      expect(state.batched[0].slice(1)).toEqual(state.preparedLogs);
    });

    it('links every log to the prepared cycle id rather than a post-hoc lookup', async () => {
      await MenstrualCycleRepository.createNewCycleWithLogs({}, [
        { startDate: daysAgo(40) },
        { startDate: daysAgo(10) },
      ]);

      const cycleId = state.preparedCycles[0].id;
      expect(state.preparedLogs.map((log) => log.menstrualCycleId)).toEqual([cycleId, cycleId]);
    });

    // The anchor is derived from the logs, never passed in, so it can't disagree with them.
    it('derives lastPeriodStartDate from the newest log instead of taking it as input', async () => {
      const newest = daysAgo(10);

      await MenstrualCycleRepository.createNewCycleWithLogs({}, [
        { startDate: daysAgo(40) },
        { startDate: newest },
        { startDate: daysAgo(70) },
      ]);

      expect(state.preparedCycles[0].lastPeriodStartDate).toBe(newest);
    });

    it('leaves the anchor at 0 when no initial logs are supplied', async () => {
      await MenstrualCycleRepository.createNewCycleWithLogs({}, []);

      expect(state.preparedCycles[0].lastPeriodStartDate).toBe(0);
      expect(state.preparedLogs).toHaveLength(0);
    });

    it('normalizes the logs first, so duplicate starts collapse into one period', async () => {
      const startDate = daysAgo(30);

      await MenstrualCycleRepository.createNewCycleWithLogs({ avgPeriodDuration: 5 }, [
        { startDate },
        { startDate },
      ]);

      expect(state.preparedLogs).toHaveLength(1);
      expect(state.preparedLogs[0].endDate).toBe(startDate + 4 * DAY);
    });

    // Validation runs before the transaction opens: a rejected setup must not leave a
    // half-written cycle behind.
    it('rejects a future period without ever opening a write transaction', async () => {
      await expect(
        MenstrualCycleRepository.createNewCycleWithLogs({}, [{ startDate: Date.now() + 5 * DAY }])
      ).rejects.toThrow('period_date_in_future');

      expect(database.write).not.toHaveBeenCalled();
      expect(database.batch).not.toHaveBeenCalled();
    });

    it('rejects overlapping initial periods without ever opening a write transaction', async () => {
      await expect(
        MenstrualCycleRepository.createNewCycleWithLogs({}, [
          { startDate: daysAgo(20), endDate: daysAgo(14) },
          { startDate: daysAgo(16), endDate: daysAgo(12) },
        ])
      ).rejects.toThrow('period_log_overlaps_existing');

      expect(database.write).not.toHaveBeenCalled();
      expect(database.batch).not.toHaveBeenCalled();
    });
  });

  describe('replaceActiveCycle', () => {
    // The reason this exists: deactivating in one write and creating in another can leave
    // the app with zero active cycles if the second half fails.
    it('deactivates the old cycles and creates the new one in a single batch', async () => {
      const previous = makeActiveCycle('previous');
      state.activeCycles = [previous];

      await MenstrualCycleRepository.replaceActiveCycle({}, [{ startDate: daysAgo(10) }]);

      expect(database.batch).toHaveBeenCalledTimes(1);
      expect(previous.isActive).toBe(false);
      expect(state.batched[0][0]).toEqual({ kind: 'update', id: 'previous' });
      expect(state.batched[0]).toContain(state.preparedCycles[0]);
      expect(state.preparedCycles[0].isActive).toBe(true);
    });

    it('deactivates every active cycle, not just the first', async () => {
      state.activeCycles = [makeActiveCycle('a'), makeActiveCycle('b')];

      await MenstrualCycleRepository.replaceActiveCycle({});

      expect(state.batched[0].slice(0, 2)).toEqual([
        { kind: 'update', id: 'a' },
        { kind: 'update', id: 'b' },
      ]);
    });

    // AGENTS.md read-then-write rule: the active-cycle read feeds the deactivation, so it
    // must happen inside the same write block as the batch.
    it('reads the active cycles INSIDE the write block (TOCTOU guard)', async () => {
      state.activeCycles = [makeActiveCycle('previous')];
      let fetchedDuringWrite = false;

      database.write.mockImplementationOnce(async (callback: (writer: unknown) => unknown) => {
        expect(cyclesFetch).not.toHaveBeenCalled();
        const result = await callback({ callWriter });
        fetchedDuringWrite = cyclesFetch.mock.calls.length === 1;
        return result;
      });

      await MenstrualCycleRepository.replaceActiveCycle({});

      expect(fetchedDuringWrite).toBe(true);
    });

    it('validates before the write so a rejected replacement leaves the old cycle active', async () => {
      const previous = makeActiveCycle('previous');
      state.activeCycles = [previous];

      await expect(
        MenstrualCycleRepository.replaceActiveCycle({}, [{ startDate: Date.now() + 5 * DAY }])
      ).rejects.toThrow('period_date_in_future');

      expect(database.write).not.toHaveBeenCalled();
      expect(previous.isActive).toBe(true);
    });

    it('still creates a new active cycle when nothing was active before', async () => {
      state.activeCycles = [];

      await MenstrualCycleRepository.replaceActiveCycle({});

      expect(state.batched[0]).toEqual([state.preparedCycles[0]]);
      expect(state.preparedCycles[0].isActive).toBe(true);
    });

    it('derives the anchor from the replacement logs', async () => {
      const newest = daysAgo(3);
      state.activeCycles = [makeActiveCycle('previous')];

      await MenstrualCycleRepository.replaceActiveCycle({}, [
        { startDate: daysAgo(35) },
        { startDate: newest },
      ]);

      expect(state.preparedCycles[0].lastPeriodStartDate).toBe(newest);
      expect(logs.prepareCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('deactivateAll', () => {
    // updateCycle is a WatermelonDB @writer; calling it directly from inside database.write()
    // deadlocks. callWriter is the sanctioned way to nest one.
    it('routes each model @writer through callWriter instead of nesting a write block', async () => {
      const first = makeActiveCycle('first');
      const second = makeActiveCycle('second');
      state.activeCycles = [first, second];

      await MenstrualCycleRepository.deactivateAll();

      expect(callWriter).toHaveBeenCalledTimes(2);
      expect(first.updateCycle).toHaveBeenCalledWith({ isActive: false });
      expect(second.updateCycle).toHaveBeenCalledWith({ isActive: false });
      expect(first.isActive).toBe(false);
      expect(second.isActive).toBe(false);
    });

    it('opens a write block but touches nothing when no cycle is active', async () => {
      state.activeCycles = [];

      await MenstrualCycleRepository.deactivateAll();

      expect(callWriter).not.toHaveBeenCalled();
      expect(database.batch).not.toHaveBeenCalled();
    });
  });
});
