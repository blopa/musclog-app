import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';
import { View } from 'react-native';

type WebModalShellContextValue = {
  hostElement: HTMLElement | null;
};

const WebModalShellContext = createContext<WebModalShellContextValue | null>(null);

export function WebModalShellProvider({ children }: { children: ReactNode }) {
  const [hostElement, setHostElement] = useState<HTMLElement | null>(null);

  const setHostRef = useCallback((node: View | null) => {
    if (node == null) {
      setHostElement(null);
      return;
    }
    setHostElement(node as unknown as HTMLElement);
  }, []);

  useLayoutEffect(() => {
    if (hostElement == null) {
      return;
    }
    // Defensive: beat any RN inline pointer style; HTML does not support `box-none`.
    hostElement.style.setProperty('pointer-events', 'none', 'important');
    // If the flex/% height chain collapses, absolute inset can compute to 0×0 and the portal is invisible.
    const parent = hostElement.parentElement;
    if (parent != null) {
      const h = parent.clientHeight;
      if (h > 0 && hostElement.offsetHeight === 0) {
        hostElement.style.minHeight = `${h}px`;
      }
    }
  }, [hostElement]);

  return (
    <WebModalShellContext.Provider value={{ hostElement }}>
      <View style={{ flex: 1, minHeight: 0, height: '100%', width: '100%', position: 'relative' }}>
        <View style={{ flex: 1, minHeight: 0, height: '100%', width: '100%' }} collapsable={false}>
          {children}
        </View>
        <View
          id="expo-web-modal-shell-host"
          ref={setHostRef}
          collapsable={false}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 1_000_000,
          }}
        />
      </View>
    </WebModalShellContext.Provider>
  );
}

export function useWebModalShellHost(): HTMLElement | null {
  return useContext(WebModalShellContext)?.hostElement ?? null;
}
