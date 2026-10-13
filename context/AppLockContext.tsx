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

import { useSettingsContext } from '@/context/SettingsContext';
import { authenticateToUnlock } from '@/utils/appLock';
import {
  APP_LOCK_GRACE_MS,
  INITIAL_LOCK_STATE,
  isScopeLocked,
  type LockScope,
  lockReducer,
} from '@/utils/appLockState';

interface AppLockContextType {
  isLocked: (scope: LockScope) => boolean;
  /** Asks the device to authenticate; resolves true and unlocks on success. */
  unlock: () => Promise<boolean>;
  lock: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { appLockMode } = useSettingsContext();
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
    (scope: LockScope) => isScopeLocked(appLockMode, scope, state),
    [appLockMode, state]
  );

  const value = useMemo(() => ({ isLocked, unlock, lock }), [isLocked, unlock, lock]);

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockContextType {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }

  return context;
}
