import { changeLockScope } from '../appLockScopeChange';

const setup = (overrides: Partial<Parameters<typeof changeLockScope>[2]> = {}) => {
  const deps = {
    canEnable: jest.fn(async () => true),
    unlock: jest.fn(async () => true),
    read: jest.fn(async () => ['cycle'] as ('cycle' | 'workout')[]),
    write: jest.fn(async () => {}),
    ...overrides,
  };

  return deps;
};

describe('changeLockScope', () => {
  it('asks for the device credential before turning a lock on, then adds it', async () => {
    const deps = setup();
    await expect(changeLockScope('workout', true, deps)).resolves.toBe('changed');
    expect(deps.unlock).toHaveBeenCalledTimes(1);
    expect(deps.write).toHaveBeenCalledWith(['cycle', 'workout']);
  });

  it('asks for the device credential before turning a lock off, then removes it', async () => {
    const deps = setup();
    await expect(changeLockScope('cycle', false, deps)).resolves.toBe('changed');
    expect(deps.unlock).toHaveBeenCalledTimes(1);
    expect(deps.write).toHaveBeenCalledWith([]);
  });

  it.each([true, false])(
    'changes nothing when the prompt is cancelled (enabled=%s)',
    async (enabled) => {
      const deps = setup({ unlock: jest.fn(async () => false) });
      await expect(changeLockScope('cycle', enabled, deps)).resolves.toBe('cancelled');
      expect(deps.write).not.toHaveBeenCalled();
    }
  );

  it('refuses to turn a lock on when the device has nothing to unlock with', async () => {
    const deps = setup({ canEnable: jest.fn(async () => false) });
    await expect(changeLockScope('workout', true, deps)).resolves.toBe('noCredential');
    expect(deps.unlock).not.toHaveBeenCalled();
    expect(deps.write).not.toHaveBeenCalled();
  });

  it('still lets a lock be turned off on a device that no longer has a credential, after the prompt', async () => {
    const deps = setup({ canEnable: jest.fn(async () => false) });
    await expect(changeLockScope('cycle', false, deps)).resolves.toBe('changed');
    expect(deps.canEnable).not.toHaveBeenCalled();
  });

  it('reads the list after the prompt, so a change made meanwhile is kept', async () => {
    const order: string[] = [];
    const deps = setup({
      unlock: jest.fn(async () => {
        order.push('unlock');

        return true;
      }),
      read: jest.fn(async () => {
        order.push('read');

        return ['cycle'];
      }),
    });
    await changeLockScope('workout', true, deps);
    expect(order).toEqual(['unlock', 'read']);
  });
});
