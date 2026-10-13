import type { AppLockMode } from '@/constants/settings';

/** Which part of the app a screen belongs to. */
export type LockScope = 'app' | 'cycle';

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
 * Whether `scope` asks for authentication in `mode`. Whole-app mode already covers the cycle
 * area, so it is not asked twice; cycle mode leaves the rest of the app (gym use) untouched.
 */
export function scopeRequiresLock(mode: AppLockMode, scope: LockScope): boolean {
  if (mode === 'off') {
    return false;
  }

  return mode === 'app' ? scope === 'app' : scope === 'cycle';
}

export function isScopeLocked(mode: AppLockMode, scope: LockScope, state: LockState): boolean {
  return scopeRequiresLock(mode, scope) && !state.unlocked;
}
