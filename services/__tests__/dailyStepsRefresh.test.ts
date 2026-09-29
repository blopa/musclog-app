const mockSyncDailySteps = jest.fn();

jest.mock('@/services/healthConnectFitness', () => ({
  syncDailySteps: (...args: unknown[]) => mockSyncDailySteps(...args),
}));

jest.mock('@/utils/calendarDate', () => ({
  localDayHalfOpenRange: (date: Date) => ({
    start: date.getTime(),
    nextStart: date.getTime() + 86_400_000,
  }),
}));

/**
 * The throttle used to be a `let` in `app/app/index.tsx`, where none of this was reachable
 * from a test. Re-importing per case is how each one gets a fresh clock.
 */
function loadModule(): typeof import('../dailyStepsRefresh') {
  let mod!: typeof import('../dailyStepsRefresh');
  jest.isolateModules(() => {
    mod = require('../dailyStepsRefresh');
  });
  return mod;
}

describe('refreshDailyStepsIfStale', () => {
  beforeEach(() => {
    mockSyncDailySteps.mockReset();
    mockSyncDailySteps.mockResolvedValue({ totalRead: 0, written: 0, updated: 0 });
  });

  it('syncs on the first call', async () => {
    const { refreshDailyStepsIfStale } = loadModule();

    await refreshDailyStepsIfStale(1_000);

    expect(mockSyncDailySteps).toHaveBeenCalledTimes(1);
    expect(mockSyncDailySteps).toHaveBeenCalledWith({
      startTime: 1_000,
      endTime: 1_000 + 86_400_000,
    });
  });

  it('skips a second call inside the refresh interval', async () => {
    const { refreshDailyStepsIfStale, STEPS_REFRESH_INTERVAL_MS } = loadModule();

    await refreshDailyStepsIfStale(1_000);
    await refreshDailyStepsIfStale(1_000 + STEPS_REFRESH_INTERVAL_MS - 1);

    expect(mockSyncDailySteps).toHaveBeenCalledTimes(1);
  });

  it('syncs again once the interval has elapsed', async () => {
    const { refreshDailyStepsIfStale, STEPS_REFRESH_INTERVAL_MS } = loadModule();

    await refreshDailyStepsIfStale(1_000);
    await refreshDailyStepsIfStale(1_000 + STEPS_REFRESH_INTERVAL_MS);

    expect(mockSyncDailySteps).toHaveBeenCalledTimes(2);
  });

  // The timestamp is recorded on success only. Stamping before the call meant one
  // failure — a revoked permission, a health store that was not ready yet — suppressed
  // every retry for the next quarter of an hour.
  it('retries immediately after a failed sync', async () => {
    const { refreshDailyStepsIfStale } = loadModule();
    mockSyncDailySteps.mockRejectedValueOnce(new Error('permission denied'));

    await refreshDailyStepsIfStale(1_000);
    await refreshDailyStepsIfStale(2_000);

    expect(mockSyncDailySteps).toHaveBeenCalledTimes(2);
  });

  it('swallows a sync rejection rather than surfacing a declined permission', async () => {
    const { refreshDailyStepsIfStale } = loadModule();
    mockSyncDailySteps.mockRejectedValueOnce(new Error('permission denied'));

    await expect(refreshDailyStepsIfStale(1_000)).resolves.toBeUndefined();
  });

  // Two foreground resumes in the same tick must not issue two reads.
  it('shares one in-flight sync between concurrent callers', async () => {
    const { refreshDailyStepsIfStale } = loadModule();
    let release: () => void = () => {};
    mockSyncDailySteps.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        release = () => resolve();
      })
    );

    const first = refreshDailyStepsIfStale(1_000);
    const second = refreshDailyStepsIfStale(1_000);

    release();
    await Promise.all([first, second]);

    expect(mockSyncDailySteps).toHaveBeenCalledTimes(1);
  });
});
