import type NutritionLog from '@/database/models/NutritionLog';

import { classifyHealthRecord, type OwnershipContext } from '../nutritionHealthOwnership';

function log(id: string, extra: Partial<NutritionLog> = {}): NutritionLog {
  return { id, ...extra } as NutritionLog;
}

const context = (overrides: Partial<OwnershipContext> = {}): OwnershipContext => ({
  ownLogs: new Map(),
  tombstonedExternalIds: new Set(),
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
