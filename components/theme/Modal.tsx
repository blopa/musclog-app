import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Modal as RNModal, type ModalProps } from 'react-native';

export type ShellAwareModalProps = {
  visible: boolean;
  children: ReactNode;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  onRequestClose?: () => void;
  onShow?: () => void;
  statusBarTranslucent?: boolean;
  presentationStyle?: ModalProps['presentationStyle'];
};

/**
 * Safe Modal wrapper that ensures proper native cleanup.
 *
 * React Native Modal windows intercept touches at the OS level even after the
 * React tree says they should be hidden. This wrapper hides the native window
 * first (`internalVisible = false`), then delays unmounting by one tick so the
 * native layer has time to tear down before React removes the node.
 *
 * See: https://github.com/facebook/react-native/issues/29455
 */
export function Modal({
  visible,
  children,
  transparent = false,
  animationType = 'none',
  onRequestClose,
  onShow,
  statusBarTranslucent,
  presentationStyle,
}: ShellAwareModalProps) {
  const [internalVisible, setInternalVisible] = useState(visible);
  const [shouldRender, setShouldRender] = useState(visible);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        if (mounted.current) {
          setInternalVisible(true);
        }
      });
    } else {
      setInternalVisible(false);
      const timer = setTimeout(() => {
        if (mounted.current) {
          setShouldRender(false);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!shouldRender) {
    return null;
  }

  return (
    <RNModal
      visible={internalVisible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onRequestClose}
      onShow={onShow}
      statusBarTranslucent={statusBarTranslucent}
      presentationStyle={presentationStyle}
    >
      {children}
    </RNModal>
  );
}
