import { act, renderHook } from '@testing-library/react';
import { useSessionBleTracking } from '@/hooks/useSessionBleTracking';
import { compressRawToDataPoints, saveBleWorkoutFile } from '@/utils/bleWorkoutDataStorage';

let mockBatch: (batch: any) => void;
const mockWit = {
  isConnected: true,
  connectedDevice: { id: 'sensor', name: 'Sensor' },
  disconnect: jest.fn(),
};
jest.mock('@/modules/witmotion-ble', () => ({
  useWitMotion: () => mockWit,
  witMotionClient: {
    onBatch: jest.fn((callback) => {
      mockBatch = callback;
      return jest.fn();
    }),
    connect: jest.fn(),
  },
}));
jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: jest.fn() }),
}));
jest.mock('@/database/services/BleDeviceService', () => ({
  BleDeviceService: { getAll: jest.fn(async () => []) },
}));
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getLatest: jest.fn(async () => null) },
}));
jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn(async () => null) },
}));
jest.mock('@/utils/bleWorkoutDataStorage', () => ({
  createBleWorkoutTrackingTempFile: jest.fn(() => ({
    delete: jest.fn(),
    parentDirectory: { delete: jest.fn() },
  })),
  appendBleWorkoutSamplesToNdjsonFile: jest.fn(),
  saveBleWorkoutFile: jest.fn(async () => 'recording-uri'),
  compressRawToDataPoints: jest.fn(async () => {}),
}));
const current = () => ({
  set: { id: 'bench-set', reps: 8 },
  exercise: {
    name: 'Bench',
    muscleGroup: 'chest',
    equipmentType: 'barbell',
    mechanicType: 'compound',
  },
  setNumber: 1,
});
const samples = () =>
  mockBatch({
    packets: Array.from({ length: 20 }, () => ({
      kind: 'motion',
      timestamp: 1,
      accel: {},
      gyro: {},
      angle: {},
    })),
  });
beforeEach(() => jest.clearAllMocks());
it('preserves recording identity, uses logged reps, and refuses to attach to another row', async () => {
  const set = current();
  const hook = renderHook(
    ({ data }) =>
      useSessionBleTracking({
        workoutLogId: 'log',
        workoutLog: { id: 'log' } as any,
        currentSetData: data as any,
        reps: 9,
        bleGenerateChartPayload: true,
      }),
    { initialProps: { data: set } }
  );
  act(() => {
    hook.result.current.startTracking();
    samples();
  });
  hook.rerender({ data: { ...set, exercise: { ...set.exercise, name: 'Replacement' } } });
  await act(async () => {
    expect(await hook.result.current.finishSetRecording('bench-set', 12)).toEqual({
      setId: 'bench-set',
      uri: 'recording-uri',
      reps: 12,
    });
  });
  expect(saveBleWorkoutFile).toHaveBeenCalledWith(
    expect.objectContaining({ exerciseName: 'Bench', reps: 12, workoutLogId: 'log' })
  );
  hook.result.current.attachRecordingToSet('squat-set', 100);
  expect(compressRawToDataPoints).not.toHaveBeenCalled();
  hook.result.current.attachRecordingToSet('bench-set', 12);
  expect(compressRawToDataPoints).toHaveBeenCalledWith('recording-uri', 'bench-set', 12);
  hook.unmount();
});
it('completing another Inline row never changes the recorded movement or reps', async () => {
  const hook = renderHook(() =>
    useSessionBleTracking({
      workoutLogId: 'log',
      workoutLog: { id: 'log' } as any,
      currentSetData: current() as any,
      reps: 9,
      bleGenerateChartPayload: true,
    })
  );
  act(() => {
    hook.result.current.startTracking();
    samples();
  });
  await act(() => hook.result.current.finishSetRecording('squat-set', 100));
  hook.result.current.attachRecordingToSet('squat-set', 100);
  expect(saveBleWorkoutFile).toHaveBeenCalledWith(
    expect.objectContaining({ exerciseName: 'Bench', reps: 9 })
  );
  expect(compressRawToDataPoints).not.toHaveBeenCalled();
  hook.unmount();
});
