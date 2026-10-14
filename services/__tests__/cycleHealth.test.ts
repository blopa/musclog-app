import { Platform } from 'react-native';
import {
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

const { readCycleHealth, writeCycleHealth } =
  jest.requireActual<typeof import('@/services/cycleHealth')>('../cycleHealth.ts');
import { blankDayLog } from '@/utils/cycle/dayLog';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(async () => true),
  requestPermission: jest.fn(async (p) => p),
  readRecords: jest.fn(),
  insertRecords: jest.fn(async () => []),
  deleteRecordsByUuids: jest.fn(async () => undefined),
}));
const day = new Date(2024, 0, 2).getTime();
beforeEach(() => {
  jest.clearAllMocks();
  (readRecords as jest.Mock).mockResolvedValue({ records: [] });
  (requestPermission as jest.Mock).mockImplementation(async (p) => p);
});
it('reads typed native records and preserves source without importing its own exports', async () => {
  (readRecords as jest.Mock).mockImplementation(async (type) => ({
    records:
      type === 'BasalBodyTemperature'
        ? [
            {
              time: new Date(day).toISOString(),
              temperature: { inCelsius: 36.5 },
              metadata: { id: 't' },
            },
          ]
        : type === 'MenstruationFlow'
          ? [
              { time: new Date(day).toISOString(), flow: 2, metadata: { id: 'f' } },
              {
                time: new Date(day).toISOString(),
                flow: 3,
                metadata: { id: 'own', clientRecordId: 'musclog-cycle-log-flow' },
              },
            ]
          : [],
  }));
  expect(await readCycleHealth(day, day + 86400000)).toEqual(
    expect.arrayContaining([
      { date: day, id: 't', source: 'health_connect', kind: 'temperatureC', value: 36.5 },
      { date: day, id: 'f', source: 'health_connect', kind: 'bleeding', value: 'medium' },
    ])
  );
  expect(await readCycleHealth(day, day + 86400000)).toHaveLength(2);
});
it('requests cycle-specific permission only on demand and rejects declined access', async () => {
  expect(initialize).not.toHaveBeenCalled();
  (requestPermission as jest.Mock).mockResolvedValue([]);
  await expect(readCycleHealth(day, day + 86400000)).rejects.toThrow('health_permission_denied');
  expect(readRecords).not.toHaveBeenCalled();
  expect(Platform.OS).toBe('android');
});
it('exports only manual bleeding and temperature with stable client IDs, excluding intimate fields', async () => {
  const logs = [
    {
      ...blankDayLog(day),
      id: 'd',
      timezone: '+00:00',
      bleeding: 'heavy' as const,
      note: 'private',
      observations: {
        sex: true,
        medication: 'private',
        temperatureC: 36.4,
        health: [
          { id: 'other', source: 'healthkit' as const, kind: 'temperatureC' as const, value: 38 },
        ],
      },
    },
  ];
  expect(await writeCycleHealth(logs)).toBe(2);
  const written = (insertRecords as jest.Mock).mock.calls[0][0];
  expect(written[0].metadata.clientRecordId).toBe('musclog-cycle-d-flow');
  expect(written[1].temperature.value).toBe(36.4);
  expect(JSON.stringify(written)).not.toContain('private');
  expect(written.map((r: { recordType: string }) => r.recordType)).toEqual([
    'MenstruationFlow',
    'BasalBodyTemperature',
  ]);
});
