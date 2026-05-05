import type { ReactNode } from 'react';
import { Modal as RNModal } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

export type ShellAwareModalProps = {
  visible: boolean;
  children: ReactNode;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  onRequestClose?: () => void;
  onShow?: () => void;
  statusBarTranslucent?: boolean;
};

export function Modal({
  visible,
  children,
  transparent = false,
  animationType = 'none',
  onRequestClose,
  onShow,
  statusBarTranslucent,
}: ShellAwareModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onRequestClose}
      onShow={onShow}
      statusBarTranslucent={statusBarTranslucent}
    >
      {/* SafeAreaProvider is required inside RNModal on iOS: the modal creates a
          separate native window that doesn't inherit the root SafeAreaProvider
          context. Without this, useSafeAreaInsets/SafeAreaView inside the modal
          returns zero insets, causing content to render behind the status bar. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>{children}</SafeAreaProvider>
    </RNModal>
  );
}
