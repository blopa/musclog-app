import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { localDayStartMs } from '@/utils/calendarDate';

/**
 * Re-checks at the next local midnight, and whenever the app returns to the foreground (a
 * suspended timer does not fire while the phone sleeps through midnight).
 */
function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = setTimeout(
      () => {
        onChange();
        arm();
      },
      next.getTime() - now.getTime() + 1_000
    );
  };

  arm();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      onChange();
    }
  });

  return () => {
    clearTimeout(timer);
    subscription.remove();
  };
}

const getSnapshot = () => localDayStartMs(new Date());

/**
 * Local midnight ms of today, changing only when the calendar day does. Everything the cycle
 * area derives (day count, phase, predictions, insights) is day-granular, so a per-minute clock
 * re-rendered every consumer and rebuilt the whole model 1,440 times a day for nothing.
 */
export function useLocalToday(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
