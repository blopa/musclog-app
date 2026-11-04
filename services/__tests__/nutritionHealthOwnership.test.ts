import type NutritionLog from '@/database/models/NutritionLog';

const mockFetchMap = jest.fn();
const mockFetchByIds = jest.fn();
const mockLoadState = jest.fn();

jest.mock('@/database/queryByIds', () => ({
  fetchMapByIds: (...args: unknown[]) => mockFetchMap(...args),
  fetchByIds: (...args: unknown[]) => mockFetchByIds(...args),
}));
jest.mock('@/database/repositories/NutritionHealthRepository', () => ({
  NutritionHealthRepository: { loadState: (...args: unknown[]) => mockLoadState(...args) },
}));

import {
  classifyHealthRecord,
  loadOwnershipContext,
  type OwnershipContext,
} from '../nutritionHealthOwnership';

function log(id: string, extra: Partial<NutritionLog> = {}): NutritionLog {
  return { id, ...extra } as NutritionLog;
}

const context = (overrides: Partial<OwnershipContext> = {}): OwnershipContext => ({
  ownLogs: new Map(),
  tombstonedExternalIds: new Set(),
  ignoredRecordIds: new Set(),
  ownedLogIds: new Set(),
  ownedExternalIds: new Set(),
  ...overrides,
});

describe('classifyHealthRecord', () => {
  it('adopts a record Musclog wrote for a live local log', () => {
    const ctx = context({ ownLogs: new Map([['log-1', log('log-1')]]) });
    expect(classifyHealthRecord('hc-1', 'log-1', ctx)).toBe('adopt');
  });

  it('flags a record Musclog wrote for a log the user deleted as an orphan', () => {
    const ctx = context({ ownLogs: new Map([['log-1', log('log-1', { deletedAt: 5 })]]) });
    expect(classifyHealthRecord('hc-1', 'log-1', ctx)).toBe('orphan');
  });

  it("keeps another app's record the user already deleted from coming back", () => {
    const ctx = context({ tombstonedExternalIds: new Set(['hc-9']) });
    expect(classifyHealthRecord('hc-9', undefined, ctx)).toBe('tombstoned');
  });

  it('does not import an original Musclog superseded with its own copy', () => {
    const ctx = context({ ignoredRecordIds: new Set(['hc-orig']) });
    expect(classifyHealthRecord('hc-orig', undefined, ctx)).toBe('tombstoned');
  });

  it('keeps an owned log authoritative even when its platform record lacks origin metadata', () => {
    const ctx = context({ ownedExternalIds: new Set(['legacy-own']) });
    expect(classifyHealthRecord('legacy-own', undefined, ctx)).toBe('adopt');
  });

  it('cleans up an owned record even after its local log has been permanently removed', () => {
    const ctx = context({ ownedLogIds: new Set(['purged-log']) });
    expect(classifyHealthRecord('hc-old', 'purged-log', ctx)).toBe('orphan');
  });

  it('treats a record naming an unknown origin as foreign', () => {
    expect(classifyHealthRecord('hc-2', 'someone-elses-id', context())).toBe('foreign');
  });

  it('treats a record with no origin as foreign', () => {
    expect(classifyHealthRecord('hc-3', undefined, context())).toBe('foreign');
  });

  it('prefers ownership over a tombstone on the same record', () => {
    const ctx = context({
      ownLogs: new Map([['log-1', log('log-1')]]),
      tombstonedExternalIds: new Set(['hc-1']),
    });
    expect(classifyHealthRecord('hc-1', 'log-1', ctx)).toBe('adopt');
  });
});

describe('loadOwnershipContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadState.mockResolvedValue({ ownedLogIds: new Set(), ignoredRecordIds: new Set() });
    mockFetchByIds.mockResolvedValue([]);
  });

  it('protects legacy locally-authored logs while leaving imported logs reconcilable', async () => {
    const local = log('local', { foodId: 'user-food', externalId: 'hc-own' });
    const imported = log('imported', { foodId: 'sentinel' });
    mockFetchMap.mockImplementation(async (table: string) =>
      table === 'foods'
        ? new Map([
            ['user-food', { source: 'user' }],
            ['sentinel', { source: 'health_connect' }],
          ])
        : new Map()
    );

    const result = await loadOwnershipContext([], [], [local, imported]);

    expect(result.ownedLogIds.has('local')).toBe(true);
    expect(classifyHealthRecord('hc-own', undefined, result)).toBe('adopt');
    expect(result.ownedLogIds.has('imported')).toBe(false);
    expect(mockLoadState).toHaveBeenCalledWith(['local', 'imported'], []);
  });

  it('retains ownership of a taken-over imported log even when its platform copy is missing', async () => {
    mockFetchMap.mockResolvedValue(new Map());
    mockLoadState.mockResolvedValue({
      ownedLogIds: new Set(['taken-over']),
      ignoredRecordIds: new Set(['foreign-original']),
    });

    const result = await loadOwnershipContext([], ['foreign-original'], [log('taken-over')]);

    expect(result.ownedLogIds.has('taken-over')).toBe(true);
    expect(classifyHealthRecord('foreign-original', undefined, result)).toBe('tombstoned');
  });

  it('uses origin metadata to protect an owned log without a persisted ownership fact', async () => {
    mockFetchMap.mockImplementation(async (table: string) =>
      table === 'nutrition_logs' ? new Map([['own', log('own')]]) : new Map()
    );

    const result = await loadOwnershipContext(['own'], ['hc']);

    expect(result.ownedLogIds.has('own')).toBe(true);
  });
});
