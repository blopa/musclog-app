import type CycleContext from '@/database/models/CycleContext';
import type CyclePeriod from '@/database/models/CyclePeriod';
import {
  clearCycleDtoCache,
  toContextDto,
  toPeriodDto,
} from '@/database/repositories/CycleRepository';
import { contextGuidance } from '@/utils/cycle/contraception';
import { CONTRACEPTION_METHOD_KEYS, CYCLE_LIFE_STAGES } from '@/utils/cycle/types';

const mockDecrypt = jest.fn();
jest.mock('@/database/cyclePayload', () => ({
  decryptCyclePayload: (cipher: string) => mockDecrypt(cipher),
}));
jest.mock('@/database/database-instance', () => ({ database: {} }));

beforeEach(() => {
  clearCycleDtoCache();
  mockDecrypt.mockReset();
});

it.each([true, false])(
  'keeps the current version when the old read finishes last=%s',
  async (oldLast) => {
    let finishOld!: (value: object) => void;
    let finishNew!: (value: object) => void;
    mockDecrypt
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve;
          })
      );
    const row = { id: 'period', cycleId: 'cycle', payload: 'old', updatedAt: 1 } as CyclePeriod;
    const oldRead = toPeriodDto(row);
    row.payload = 'new';
    row.updatedAt = 2;
    const newRead = toPeriodDto(row);
    if (oldLast) {
      finishNew({ startDate: 200 });
      await newRead;
      finishOld({ startDate: 100 });
    } else {
      finishOld({ startDate: 100 });
      await oldRead;
      finishNew({ startDate: 200 });
    }

    expect((await oldRead)?.startDate).toBe(100);
    expect((await newRead)?.startDate).toBe(200);
    expect((await toPeriodDto(row))?.startDate).toBe(200);
    expect(mockDecrypt).toHaveBeenCalledTimes(2);
  }
);

it('does not restore a cleared cache when an in-flight read completes', async () => {
  let finish!: (value: object) => void;
  mockDecrypt.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const row = { id: 'period', cycleId: 'cycle', payload: 'cipher', updatedAt: 1 } as CyclePeriod;
  const pending = toPeriodDto(row);
  clearCycleDtoCache();
  finish({ startDate: 100 });
  await pending;
  mockDecrypt.mockResolvedValue({ startDate: 200 });
  expect((await toPeriodDto(row))?.startDate).toBe(200);
  expect(mockDecrypt).toHaveBeenCalledTimes(2);
});

it.each([
  { lifeStage: 'regular', contraception: 'future_method' },
  { lifeStage: 'future_stage', contraception: 'none' },
])('skips unsupported context vocabulary: %j', async (context) => {
  mockDecrypt.mockResolvedValue({ effectiveFrom: 0, ...context });
  const row = { id: 'context', cycleId: 'cycle', payload: 'cipher', updatedAt: 1 } as CycleContext;
  expect(await toContextDto(row)).toBeNull();
});

it('accepts every supported context without a downstream lookup failure', async () => {
  for (const lifeStage of CYCLE_LIFE_STAGES) {
    for (const contraception of CONTRACEPTION_METHOD_KEYS) {
      mockDecrypt.mockResolvedValue({
        effectiveFrom: 0,
        lifeStage,
        contraception,
        futureKey: true,
      });
      const row = {
        id: `${lifeStage}:${contraception}`,
        cycleId: 'cycle',
        payload: 'cipher',
        updatedAt: 1,
      } as CycleContext;
      const dto = await toContextDto(row);
      expect(dto).toMatchObject({ lifeStage, contraception });
      expect(() => contextGuidance(dto)).not.toThrow();
    }
  }
});
