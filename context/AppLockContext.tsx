import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import type { AppLockScope } from '@/constants/settings';
import { useSettingsContext } from '@/context/SettingsContext';
import { authenticateToUnlock } from '@/utils/appLock';
import {
  APP_LOCK_GRACE_MS,
  INITIAL_LOCK_STATE,
  isObscured,
  isScopeLocked,
  lockReducer,
} from '@/utils/appLockState';

interface AppLockContextType {
  isLocked: (scope: AppLockScope) => boolean;
  /** The app is in the background with a lock on: draw the privacy cover. */
  obscured: boolean;
  /** Asks the device to authenticate; resolves true and unlocks on success. */
  unlock: () => Promise<boolean>;
  lock: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { appLockScopes } = useSettingsContext();
  const [state, dispatch] = useReducer(lockReducer, INITIAL_LOCK_STATE);
  const authenticating = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        dispatch({ type: 'foreground', now: Date.now(), graceMs: APP_LOCK_GRACE_MS });
      } else {
        dispatch({ type: 'background', now: Date.now() });
      }
    });

    return () => subscription.remove();
  }, []);

  const unlock = useCallback(async () => {
    // The system prompt itself backgrounds the app on some platforms; ignore a re-entrant request.
    if (authenticating.current) {
      return false;
    }

    authenticating.current = true;
    try {
      const ok = await authenticateToUnlock(t('cycle.lock.prompt'));
      if (ok) {
        dispatch({ type: 'unlocked' });
      }

      return ok;
    } finally {
      authenticating.current = false;
    }
  }, [t]);

  const lock = useCallback(() => dispatch({ type: 'locked' }), []);
  const isLocked = useCallback(
    (scope: AppLockScope) => isScopeLocked(appLockScopes, scope, state),
    [appLockScopes, state]
  );

  const obscured = isObscured(appLockScopes, state);
  const value = useMemo(
    () => ({ isLocked, obscured, unlock, lock }),
    [isLocked, obscured, unlock, lock]
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

/**
 * For surfaces that can render outside the provider (the shared Modal primitive is also used by
 * screens mounted before it): null there, instead of throwing.
 */
export function useOptionalAppLock(): AppLockContextType | null {
  return useContext(AppLockContext) ?? null;
}

export function useAppLock(): AppLockContextType {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }

  return context;
}
