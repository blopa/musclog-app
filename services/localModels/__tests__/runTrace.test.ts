const mockStore = new Map<string, string>();
const mockCaptureMessage = jest.fn(async () => undefined);

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore.set(key, value);
    }),
    getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    removeItem: jest.fn(async (key: string) => {
      mockStore.delete(key);
    }),
  },
}));
jest.mock('@sentry/react-native', () => ({ addBreadcrumb: jest.fn() }));
jest.mock('@/utils/sentry', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...(args as [])),
}));

import { LOCAL_MODEL_RUN_MARKER } from '@/constants/misc';

import {
  clearLocalRun,
  markLocalRun,
  reportInterruptedLocalRun,
  reportLocalOutcome,
} from '../runTrace';

beforeEach(() => {
  mockStore.clear();
  mockCaptureMessage.mockClear();
});

describe('run marker', () => {
  it('reports a run the process did not survive, once, with its phase', async () => {
    await markLocalRun({ phase: 'projector', model: 'm', hasImage: true, imageChars: 1234 });
    await reportInterruptedLocalRun();

    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'on-device-run-interrupted',
      expect.objectContaining({ tags: expect.objectContaining({ phase: 'projector' }) })
    );
    expect(mockStore.has(LOCAL_MODEL_RUN_MARKER)).toBe(false);

    await reportInterruptedLocalRun();
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
  });

  it('reports nothing for a run that ended normally', async () => {
    await markLocalRun({ phase: 'completion', model: 'm', hasImage: false, imageChars: 0 });
    await clearLocalRun();
    await reportInterruptedLocalRun();

    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('survives a corrupt marker', async () => {
    mockStore.set(LOCAL_MODEL_RUN_MARKER, '{nope');
    await expect(reportInterruptedLocalRun()).resolves.toBeUndefined();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });
});

describe('reportLocalOutcome', () => {
  it('sends the outcome with sizes only', async () => {
    await reportLocalOutcome('empty-reply', { replyChars: 0 });

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'on-device-empty-reply',
      expect.objectContaining({ tags: expect.objectContaining({ outcome: 'empty-reply' }) })
    );
  });
});
