import {
  deleteObjects,
  queryCategorySamples,
  queryQuantitySamples,
  requestAuthorization,
  saveCategorySample,
  saveQuantitySample,
} from '@kingstinct/react-native-healthkit';

import { blankDayLog } from '@/utils/cycle/dayLog';

jest.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailableAsync: jest.fn(async () => true),
  requestAuthorization: jest.fn(async () => true),
  queryCategorySamples: jest.fn(async () => []),
  queryQuantitySamples: jest.fn(async () => []),
  saveCategorySample: jest.fn(async () => ({ uuid: 'saved' })),
  saveQuantitySample: jest.fn(async () => ({ uuid: 'saved' })),
  deleteObjects: jest.fn(async () => 0),
}));
jest.mock('@kingstinct/react-native-healthkit/types', () => ({
  CategoryValueMenstrualFlow: { none: 5, light: 2, medium: 3, heavy: 4 },
  CategoryValueNotApplicable: { notApplicable: 0 },
}));
const { readCycleHealth, writeCycleHealth } =
  jest.requireActual<typeof import('@/services/cycleHealth')>('../cycleHealth.ios.ts');
const date = new Date(2024, 0, 2);
beforeEach(() => {
  jest.clearAllMocks();
});
it('maps Apple Health temperature and flow, preserving source and ignoring owned exports', async () => {
  (queryCategorySamples as jest.Mock).mockImplementation(async (type) =>
    type === 'HKCategoryTypeIdentifierMenstrualFlow'
      ? [{ uuid: 'flow', startDate: date, value: 2, metadata: {} }]
      : []
  );
  (queryQuantitySamples as jest.Mock).mockResolvedValue([
    { uuid: 'temp', startDate: date, quantity: 36.8, metadata: {} },
    {
      uuid: 'own',
      startDate: date,
      quantity: 37,
      metadata: { HKSyncIdentifier: 'musclog-cycle-d-temperature' },
    },
  ]);
  const records = await readCycleHealth(date.getTime(), date.getTime() + 86400000);
  expect(records).toEqual([
    { id: 'flow', source: 'healthkit', kind: 'bleeding', value: 'light', date: date.getTime() },
    { id: 'temp', source: 'healthkit', kind: 'temperatureC', value: 36.8, date: date.getTime() },
  ]);
  expect(requestAuthorization).toHaveBeenCalledWith({
    toRead: expect.arrayContaining([
      'HKCategoryTypeIdentifierMenstrualFlow',
      'HKQuantityTypeIdentifierBasalBodyTemperature',
    ]),
  });
});
it('uses correct sync metadata and only reconciles its own records', async () => {
  const logs = [
    {
      ...blankDayLog(date.getTime()),
      id: 'd',
      timezone: '+00:00',
      bleeding: 'spotting' as const,
      observations: { temperatureC: 36.4 },
    },
  ];
  expect(await writeCycleHealth(logs)).toBe(2);
  expect(saveCategorySample).toHaveBeenCalledWith(
    'HKCategoryTypeIdentifierIntermenstrualBleeding',
    0,
    expect.any(Date),
    expect.any(Date),
    expect.objectContaining({ HKSyncIdentifier: 'musclog-cycle-d-spotting' })
  );
  expect(saveQuantitySample).toHaveBeenCalledWith(
    'HKQuantityTypeIdentifierBasalBodyTemperature',
    'degC',
    36.4,
    expect.any(Date),
    expect.any(Date),
    expect.objectContaining({ HKSyncIdentifier: 'musclog-cycle-d-temperature' })
  );
  expect(deleteObjects).toHaveBeenCalledWith('HKCategoryTypeIdentifierMenstrualFlow', {
    metadata: { withMetadataKey: 'HKSyncIdentifier', value: 'musclog-cycle-d-flow' },
  });
});
