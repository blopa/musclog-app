import * as Device from 'expo-device';
import { useIsFocused } from 'expo-router';
import { type ReactElement, type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import {
  evictHiddenTabs,
  keepAliveLimit,
  shouldRenderTab,
  touchKeptTab,
} from '@/utils/tabKeepAlive';

/**
 * Which tab screens stay mounted while hidden (`utils/tabKeepAlive.ts` holds the rule). One
 * module-level store because there is one tab navigator (`components/navigation/singleTabsRouter.ts`
 * keeps it that way) and every tab's gate must agree on the same order.
 */
const limit = keepAliveLimit(Device.totalMemory);
let order: readonly string[] = [];
const listeners = new Set<() => void>();

function setOrder(next: readonly string[]) {
  if (next === order) {
    return;
  }

  order = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => order;

/**
 * Wraps one tab's screen (the tab navigator's `screenLayout`). A hidden tab outside the kept set
 * renders nothing, which unmounts it; opening it again builds it fresh.
 */
function TabKeepAlive({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const focused = useIsFocused();
  const kept = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (focused) {
      setOrder(touchKeptTab(order, routeKey, limit));
    }
  }, [focused, routeKey]);

  return shouldRenderTab(kept, routeKey, focused) ? children : null;
}

/** `screenLayout` for the tab navigator (`app/app/(tabs)/_layout.tsx`). */
export function renderTabScreenLayout({
  route,
  children,
}: {
  route: { key: string };
  children: ReactElement;
}): ReactElement {
  return <TabKeepAlive routeKey={route.key}>{children}</TabKeepAlive>;
}

/**
 * When the OS says memory is short, unmount every hidden tab. Only iOS forwards that warning to
 * JavaScript: React Native's Android `AppStateModule` never emits `memoryWarning`, so Android
 * relies on the RAM-sized limit alone.
 */
export function useReleaseHiddenTabsOnMemoryWarning() {
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    const subscription = AppState.addEventListener('memoryWarning', () => {
      setOrder(evictHiddenTabs(order));
    });
    return () => subscription.remove();
  }, []);
}
