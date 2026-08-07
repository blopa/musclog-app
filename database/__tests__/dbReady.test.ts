type DbReadyModule = typeof import('@/database/dbReady');

/**
 * `dbReady` holds one process-wide promise by design — a fresh module registry per test
 * is the only way to observe the pre-resolution state more than once.
 */
const loadDbReady = (): DbReadyModule => {
  let module!: DbReadyModule;
  jest.isolateModules(() => {
    module = require('@/database/dbReady');
  });
  return module;
};

describe('dbReady gate', () => {
  it('starts not-ready with no error, so boot code blocks rather than racing the reset', () => {
    const { getDbReadyError, isDbReady } = loadDbReady();

    expect(isDbReady()).toBe(false);
    expect(getDbReadyError()).toBeNull();
  });

  it('hands every caller the same promise instance', () => {
    const { waitForDbReady } = loadDbReady();

    expect(waitForDbReady()).toBe(waitForDbReady());
  });

  it('does not resolve until boot marks the DB ready', async () => {
    const { markDbReady, waitForDbReady } = loadDbReady();
    const settled = jest.fn();
    void waitForDbReady().then(settled);

    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();

    markDbReady();
    await waitForDbReady();

    expect(settled).toHaveBeenCalled();
  });

  it('resolves every waiter registered before readiness, not just the first', async () => {
    const { markDbReady, waitForDbReady } = loadDbReady();
    const waiters = [waitForDbReady(), waitForDbReady(), waitForDbReady()];

    markDbReady();

    await expect(Promise.all(waiters)).resolves.toEqual([undefined, undefined, undefined]);
  });

  it('resolves immediately for a caller that arrives after readiness', async () => {
    const { isDbReady, markDbReady, waitForDbReady } = loadDbReady();
    markDbReady();

    await expect(waitForDbReady()).resolves.toBeUndefined();
    expect(isDbReady()).toBe(true);
  });

  it('rejects with the boot error when the DB cannot be made ready', async () => {
    const { getDbReadyError, isDbReady, markDbReadyFailed, waitForDbReady } = loadDbReady();
    const error = new Error('seeding failed');

    markDbReadyFailed(error);

    await expect(waitForDbReady()).rejects.toBe(error);
    expect(isDbReady()).toBe(false);
    expect(getDbReadyError()).toBe(error);
  });

  it('is idempotent — a second markDbReady is a no-op', async () => {
    const { markDbReady, waitForDbReady } = loadDbReady();

    markDbReady();
    markDbReady();

    await expect(waitForDbReady()).resolves.toBeUndefined();
  });

  it('ignores a failure reported after the DB already came up', async () => {
    // A late probe error must not flip a working session into the recovery screen.
    const { getDbReadyError, isDbReady, markDbReady, markDbReadyFailed, waitForDbReady } =
      loadDbReady();

    markDbReady();
    markDbReadyFailed(new Error('late probe error'));

    await expect(waitForDbReady()).resolves.toBeUndefined();
    expect(isDbReady()).toBe(true);
    expect(getDbReadyError()).toBeNull();
  });

  it('ignores a later success once boot has already failed terminally', async () => {
    const { getDbReadyError, isDbReady, markDbReady, markDbReadyFailed, waitForDbReady } =
      loadDbReady();
    const error = new Error('watchdog expired');

    markDbReadyFailed(error);
    markDbReady();

    await expect(waitForDbReady()).rejects.toBe(error);
    expect(isDbReady()).toBe(false);
    expect(getDbReadyError()).toBe(error);
  });

  it('keeps only the first failure so the recovery screen shows the root cause', async () => {
    const { getDbReadyError, markDbReadyFailed, waitForDbReady } = loadDbReady();
    const first = new Error('first');

    markDbReadyFailed(first);
    markDbReadyFailed(new Error('second'));

    await expect(waitForDbReady()).rejects.toBe(first);
    expect(getDbReadyError()).toBe(first);
  });

  it('does not surface an unhandled rejection when nobody is awaiting the gate', async () => {
    // The module attaches its own catch handler for exactly this reason; without it a
    // failed boot would crash the JS context before the recovery UI could mount.
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    const { markDbReadyFailed } = loadDbReady();
    markDbReadyFailed(new Error('nobody is listening'));

    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });
});
