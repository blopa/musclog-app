import { APP_LOCK_SCOPES } from '@/constants/settings';

import {
  APP_LOCK_GRACE_MS,
  INITIAL_LOCK_STATE,
  isCycleLockProtected,
  isObscured,
  isScopeLocked,
  lockReducer,
  scopeRequiresLock,
} from '../appLockState';

describe('scopeRequiresLock', () => {
  it('locks nothing when no scope is chosen', () => {
    for (const scope of APP_LOCK_SCOPES) {
      expect(scopeRequiresLock([], scope)).toBe(false);
    }
  });

  it('asks only for the areas that were chosen', () => {
    expect(scopeRequiresLock(['workout', 'progress'], 'workout')).toBe(true);
    expect(scopeRequiresLock(['workout', 'progress'], 'progress')).toBe(true);
    expect(scopeRequiresLock(['workout', 'progress'], 'nutrition')).toBe(false);
    expect(scopeRequiresLock(['workout', 'progress'], 'cycle')).toBe(false);
    expect(scopeRequiresLock(['workout', 'progress'], 'app')).toBe(false);
  });

  it('whole-app covers every area, so the areas are not asked a second time', () => {
    expect(scopeRequiresLock(['app'], 'app')).toBe(true);
    expect(scopeRequiresLock(['app', 'cycle', 'nutrition'], 'cycle')).toBe(false);
    expect(scopeRequiresLock(['app', 'cycle', 'nutrition'], 'nutrition')).toBe(false);
  });
});

describe('isCycleLockProtected', () => {
  it('is true for the cycle or whole-app lock only', () => {
    expect(isCycleLockProtected(['cycle'])).toBe(true);
    expect(isCycleLockProtected(['app'])).toBe(true);
    expect(isCycleLockProtected(['workout', 'nutrition', 'progress'])).toBe(false);
    expect(isCycleLockProtected([])).toBe(false);
  });
});

describe('lockReducer', () => {
  it('starts locked and unlocks on success', () => {
    expect(isScopeLocked(['app'], 'app', INITIAL_LOCK_STATE)).toBe(true);
    const unlocked = lockReducer(INITIAL_LOCK_STATE, { type: 'unlocked' });
    expect(isScopeLocked(['app'], 'app', unlocked)).toBe(false);
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

describe('isObscured', () => {
  it('covers the screen while away whenever a lock is on, so the app switcher shows nothing', () => {
    const away = lockReducer(lockReducer(INITIAL_LOCK_STATE, { type: 'unlocked' }), {
      type: 'background',
      now: 1000,
    });
    expect(isObscured(['cycle'], away)).toBe(true);
    expect(isObscured(['progress'], away)).toBe(true);
    expect(isObscured(['app'], away)).toBe(true);
    expect(isObscured([], away)).toBe(false);

    const back = lockReducer(away, { type: 'foreground', now: 2000, graceMs: APP_LOCK_GRACE_MS });
    expect(isObscured(['cycle'], back)).toBe(false);
  });
});
