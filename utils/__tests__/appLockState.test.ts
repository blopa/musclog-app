import {
  APP_LOCK_GRACE_MS,
  INITIAL_LOCK_STATE,
  isScopeLocked,
  lockReducer,
  scopeRequiresLock,
} from '../appLockState';

describe('scopeRequiresLock', () => {
  it('locks nothing when off', () => {
    expect(scopeRequiresLock('off', 'app')).toBe(false);
    expect(scopeRequiresLock('off', 'cycle')).toBe(false);
  });

  it('cycle mode locks only the cycle area, app mode only the app (which contains the cycle area)', () => {
    expect(scopeRequiresLock('cycle', 'cycle')).toBe(true);
    expect(scopeRequiresLock('cycle', 'app')).toBe(false);
    expect(scopeRequiresLock('app', 'app')).toBe(true);
    expect(scopeRequiresLock('app', 'cycle')).toBe(false);
  });
});

describe('lockReducer', () => {
  it('starts locked and unlocks on success', () => {
    expect(isScopeLocked('app', 'app', INITIAL_LOCK_STATE)).toBe(true);
    const unlocked = lockReducer(INITIAL_LOCK_STATE, { type: 'unlocked' });
    expect(isScopeLocked('app', 'app', unlocked)).toBe(false);
  });

  it('stays unlocked for a short trip to the background', () => {
    let state = lockReducer(INITIAL_LOCK_STATE, { type: 'unlocked' });
    state = lockReducer(state, { type: 'background', now: 1000 });
    state = lockReducer(state, {
      type: 'foreground',
      now: 1000 + 5000,
      graceMs: APP_LOCK_GRACE_MS,
    });
    expect(state.unlocked).toBe(true);
    expect(state.backgroundedAt).toBeNull();
  });

  it('relocks after the grace period away', () => {
    let state = lockReducer(INITIAL_LOCK_STATE, { type: 'unlocked' });
    state = lockReducer(state, { type: 'background', now: 1000 });
    state = lockReducer(state, {
      type: 'foreground',
      now: 1000 + APP_LOCK_GRACE_MS + 1,
      graceMs: APP_LOCK_GRACE_MS,
    });
    expect(state.unlocked).toBe(false);
  });

  it('keeps the first background time when several arrive', () => {
    let state = lockReducer(INITIAL_LOCK_STATE, { type: 'unlocked' });
    state = lockReducer(state, { type: 'background', now: 1000 });
    state = lockReducer(state, { type: 'background', now: 9000 });
    expect(state.backgroundedAt).toBe(1000);
  });

  it('can be locked explicitly', () => {
    const state = lockReducer({ unlocked: true, backgroundedAt: null }, { type: 'locked' });
    expect(state.unlocked).toBe(false);
  });
});
