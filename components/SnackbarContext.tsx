import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Snackbar, type SnackbarType } from './Snackbar';

type SnackbarContextType = {
  showSnackbar: (
    type: 'success' | 'error',
    message: string,
    options?: {
      subtitle?: string;
      action?: string;
      duration?: number;
    }
  ) => void;
  dismissSnackbar: (id: number) => void;
};

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snackbars, setSnackbars] = useState<SnackbarType[]>([]);
  const insets = useSafeAreaInsets();

  const showSnackbar = useCallback(
    (
      type: 'success' | 'error',
      message: string,
      options?: {
        subtitle?: string;
        action?: string;
        duration?: number;
      }
    ) => {
      const id = Date.now();
      const duration = options?.duration ?? 5000;

      const newSnackbar: SnackbarType = {
        id,
        type,
        message,
        subtitle: options?.subtitle,
        action: options?.action ?? (type === 'success' ? 'VIEW' : 'RETRY'),
      };

      setSnackbars((prev) => [...prev, newSnackbar]);

      // Auto-dismiss after specified duration
      if (duration > 0) {
        setTimeout(() => {
          setSnackbars((prev) => prev.filter((s) => s.id !== id));
        }, duration);
      }
    },
    []
  );

  const dismissSnackbar = useCallback((id: number) => {
    setSnackbars((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Web-specific styles for proper viewport positioning
  const webContainerStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          bottom: 0,
          left: 0,
          right: 0,
          width: '100vw',
        } as any)
      : {};

  return (
    <SnackbarContext.Provider value={{ showSnackbar, dismissSnackbar }}>
      {children}
      {/* Snackbar Container - renders at the bottom of the screen */}
      <View
        className="absolute bottom-0 left-0 right-0"
        style={{
          pointerEvents: 'box-none',
          paddingBottom: Math.max(insets.bottom, 16),
          ...webContainerStyle,
        }}>
        {snackbars.map((snackbar) => (
          <Snackbar key={snackbar.id} snackbar={snackbar} onDismiss={dismissSnackbar} />
        ))}
      </View>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (context === undefined) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
}
