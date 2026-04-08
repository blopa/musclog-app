import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Modal as RNModal, Platform, View } from 'react-native';

import { useWebModalShellHost } from '@/context/WebModalShellContext';
import { useWebDesktopPhoneFrame } from '@/utils/webPhoneFrame';

export type ShellAwareModalProps = {
  visible: boolean;
  children: ReactNode;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  onRequestClose?: () => void;
  onShow?: () => void;
  statusBarTranslucent?: boolean;
};

/**
 * On web in the desktop phone frame, portals modal content into the shell host so layers stay inside the frame.
 * Otherwise uses React Native `Modal` (including react-native-web’s body portal).
 */
export function Modal({
  visible,
  children,
  transparent = false,
  animationType = 'none',
  onRequestClose,
  onShow,
  statusBarTranslucent,
}: ShellAwareModalProps) {
  const hostElement = useWebModalShellHost();
  const isDesktopFrame = useWebDesktopPhoneFrame();
  const useShellPortal = Platform.OS === 'web' && isDesktopFrame && hostElement != null;

  useEffect(() => {
    if (!useShellPortal || !visible || !onShow) {
      return;
    }
    onShow();
  }, [useShellPortal, visible, onShow]);

  useEffect(() => {
    if (!useShellPortal || !visible || !onRequestClose) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onRequestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [useShellPortal, visible, onRequestClose]);

  if (useShellPortal) {
    if (!visible) {
      return null;
    }

    return createPortal(
      <View
        pointerEvents="auto"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </View>,
      hostElement
    );
  }

  return (
    <RNModal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onRequestClose}
      onShow={onShow}
      statusBarTranslucent={statusBarTranslucent}
    >
      {children}
    </RNModal>
  );
}
