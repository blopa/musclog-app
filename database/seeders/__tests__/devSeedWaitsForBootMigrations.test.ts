const order: string[] = [];

jest.mock('@/database/dbReady', () => ({
  waitForDbReady: jest.fn(async () => {
    order.push('ready');
  }),
  waitForBootMigrations: jest.fn(async () => {
    order.push('drained');
  }),
}));

jest.mock('@/database/database-instance', () => ({
  database: {
    write: jest.fn(async (fn: () => Promise<void>) => fn()),
    unsafeResetDatabase: jest.fn(async () => {
      order.push('reset');
      // Stop right after the reset: the rest of the seeding is not under test.
      throw new Error('stop-after-reset');
    }),
    get: jest.fn(),
  },
}));

import { seedDevData } from '@/database/seeders/dev';

describe('seedDevData', () => {
  it('waits for readiness and the boot migration chain before resetting the database', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await seedDevData().catch(() => {});
    expect(order.slice(0, 3)).toEqual(['ready', 'drained', 'reset']);
  });
});
