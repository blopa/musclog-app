import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Snackbar, type SnackbarType } from '@/components/Snackbar';
import { Modal } from '@/components/theme/Modal';
import { useTheme } from '@/hooks/useTheme';
import { registerSnackbarService, unregisterSnackbarService } from '@/utils/snackbarService';
import { useWebBottomDockLayerStyle } from '@/utils/webPhoneFrame';

type SnackbarContextType = {
  showSnackbar: (
    type: 'success' | 'error',
    message: string,
    options?: {
      subtitle?: string;
      action?: string;
      onAction?: () => void;
      duration?: number;
    }
  ) => void;
  dismissSnackbar: (id: number) => void;
};

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snackbars, setSnackbars] = useState<SnackbarType[]>([]);
  const [idCounter, setIdCounter] = useState(0);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const theme = useTheme();

  const showSnackbar = useCallback(
    (
      type: 'success' | 'error',
      message: string,
      options?: {
        subtitle?: string;
        action?: string;
        onAction?: () => void;
        duration?: number;
      }
    ) => {
      const id = Date.now() + idCounter;
      setIdCounter((prev) => (prev + 1) % 1000);
      const duration = options?.duration ?? 2000;

      const newSnackbar: SnackbarType = {
        id,
        type,
        message,
        subtitle: options?.subtitle,
        action: options?.action ?? t('snackbar.ok'),
        onAction: options?.onAction,
      };

      setSnackbars((prev) => [...prev, newSnackbar]);

      // Auto-dismiss after specified duration
      if (duration > 0) {
        setTimeout(() => {
          setSnackbars((prev) => prev.filter((s) => s.id !== id));
        }, duration);
      }
    },
    [t, idCounter]
  );

  const dismissSnackbar = useCallback((id: number) => {
    setSnackbars((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Register the snackbar service for global access
  useEffect(() => {
    registerSnackbarService(showSnackbar);
    return () => {
      unregisterSnackbarService();
    };
  }, [showSnackbar]);

  const paddingBottom = Math.max(insets.bottom, theme.spacing.padding.base);
  const webBottomDockStyle = useWebBottomDockLayerStyle();

  // On native, z-index is useless against React Native's Modal (which creates its own
  // native window layer). The only reliable fix is to render snackbars inside their own
  // transparent Modal so they always sit above every other modal on both iOS and Android.
  const snackbarList = snackbars.map((snackbar) => (
    <Snackbar key={snackbar.id} snackbar={snackbar} onDismiss={dismissSnackbar} />
  ));

  return (
    <SnackbarContext.Provider value={{ showSnackbar, dismissSnackbar }}>
      {children}

      {Platform.OS === 'web' ? (
        /* Web: viewport-fixed on narrow; shell-relative on desktop phone frame */
        <View
          style={[
            webBottomDockStyle,
            {
              paddingBottom,
            },
          ]}
        >
          {snackbarList}
        </View>
      ) : (
        /* Native: wrap in a transparent Modal so snackbars appear above ALL other modals */
        <Modal visible={snackbars.length > 0} transparent animationType="none" statusBarTranslucent>
          <View style={{ flex: 1, pointerEvents: 'box-none' }}>
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingBottom,
                pointerEvents: 'box-none',
              }}
            >
              {snackbarList}
            </View>
          </View>
        </Modal>
      )}
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
