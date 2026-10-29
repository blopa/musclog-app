import type { AppLockScope } from '@/constants/settings';

export interface LockState {
  unlocked: boolean;
  backgroundedAt: number | null;
}

export type LockEvent =
  | { type: 'unlocked' }
  | { type: 'locked' }
  | { type: 'background'; now: number }
  | { type: 'foreground'; now: number; graceMs: number };

/** Starts locked: a lock that opens by itself on launch protects nothing. */
export const INITIAL_LOCK_STATE: LockState = { unlocked: false, backgroundedAt: null };

/** How long the app may sit in the background before it asks again. */
export const APP_LOCK_GRACE_MS = 30_000;

export function lockReducer(state: LockState, event: LockEvent): LockState {
  switch (event.type) {
    case 'unlocked':
      return { unlocked: true, backgroundedAt: null };
    case 'locked':
      return { unlocked: false, backgroundedAt: null };
    case 'background':
      return state.backgroundedAt == null ? { ...state, backgroundedAt: event.now } : state;
    case 'foreground': {
      const away = state.backgroundedAt == null ? 0 : event.now - state.backgroundedAt;

      return away > event.graceMs
        ? { unlocked: false, backgroundedAt: null }
        : { ...state, backgroundedAt: null };
    }
  }
}

/**
 * Whether `scope` asks for authentication given the areas the user locked. Locking the whole app
 * already covers every area, so with it on an area is not asked a second time; without it, each
 * area asks only if it was chosen, which leaves the rest of the app (gym use) untouched.
 */
export function scopeRequiresLock(scopes: readonly AppLockScope[], scope: AppLockScope): boolean {
  if (scope === 'app') {
    return scopes.includes('app');
  }

  return !scopes.includes('app') && scopes.includes(scope);
}

/**
 * `null` scopes mean "not read yet": the settings are still loading and nothing said which areas
 * are locked. Every scope then reads as locked, because the answer may be "all of them" and a
 * lock that opens until it has checked protects nothing.
 */
export function isScopeLocked(
  scopes: readonly AppLockScope[] | null,
  scope: AppLockScope,
  state: LockState
): boolean {
  if (scopes === null) {
    return true;
  }

  return scopeRequiresLock(scopes, scope) && !state.unlocked;
}

/** Whether any lock stands between a person holding the phone and the cycle records. */
export function isCycleLockProtected(scopes: readonly AppLockScope[]): boolean {
  return scopes.includes('app') || scopes.includes('cycle');
}

/**
 * Whether to draw the privacy cover: with any lock on, while the app is not in the foreground. The
 * OS snapshots the screen for the app switcher as the app leaves, so a lock that only appears
 * when the person comes BACK leaves the diary readable in the recent-apps list.
 */
export function isObscured(scopes: readonly AppLockScope[], state: LockState): boolean {
  return scopes.length > 0 && state.backgroundedAt != null;
}
