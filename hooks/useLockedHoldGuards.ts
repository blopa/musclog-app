import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, BackHandler, Platform } from 'react-native';

/**
 * A locked voice hold has no finger on it, so nothing else would end it when the person goes
 * elsewhere. It is cancelled when the app goes to the background, when the route changes (a
 * notification or a link; the bar that holds the microphone may stay mounted, unseen) and on
 * Android's back button, which cancels the hold instead of leaving the screen.
 */
export function useLockedHoldGuards(locked: boolean, cancel: () => void): void {
  const pathname = usePathname();
  const lockedAt = useRef<string | null>(null);

  useEffect(() => {
    if (!locked) {
      lockedAt.current = null;
      return;
    }

    lockedAt.current ??= pathname;
    if (lockedAt.current !== pathname) {
      cancel();
    }
  }, [cancel, locked, pathname]);

  useEffect(() => {
    if (!locked) {
      return;
    }

    // Not `inactive`: iOS reports it for a pulled-down notification shade.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        cancel();
      }
    });
    const back =
      Platform.OS === 'android'
        ? BackHandler.addEventListener('hardwareBackPress', () => {
            cancel();
            return true;
          })
        : null;

    return () => {
      appState.remove();
      back?.remove();
    };
  }, [cancel, locked]);
}
