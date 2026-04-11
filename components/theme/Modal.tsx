import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Modal as RNModal, type ModalProps } from 'react-native';

let modalCounter = 0;
const activeModals = new Set<string>();

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

function getCallerName(): string {
  try {
    const err = new Error();
    const stack = err.stack?.split('\n') || [];
    // Find the first line that's not from Modal.tsx
    for (const line of stack) {
      if (!line.includes('Modal.tsx') && line.includes('at ')) {
        // Extract component/function name from stack trace
        const match = line.match(/at\s+(\w+)/);
        if (match) {
          return match[1];
        }
      }
    }
  } catch {
    // ignore
  }
  return 'unknown';
}

/**
 * Safe Modal wrapper that ensures proper native cleanup.
 *
 * React Native has a bug where Modal native windows can become "ghost" windows
 * that intercept touches if the Modal is unmounted while visible. This wrapper
 * ensures the Modal is properly hidden before unmounting by using a delayed
 * visibility state and forcing remount when needed.
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
  const instanceId = useRef<string>(`modal-${++modalCounter}`);
  const callerName = useRef<string>(getCallerName());
  const [internalVisible, setInternalVisible] = useState(visible);
  const [shouldRender, setShouldRender] = useState(visible);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Handle visibility changes with proper cleanup
  useEffect(() => {
    const id = instanceId.current;
    const caller = callerName.current;

    if (visible) {
      // Becoming visible - render immediately
      setShouldRender(true);
      // Small delay to ensure mount before showing (helps with native cleanup)
      requestAnimationFrame(() => {
        if (mounted.current) {
          setInternalVisible(true);
        }
      });
      activeModals.add(id);
      console.log(`[Modal:${id}] VISIBLE (caller: ${caller}), active: ${activeModals.size}`);
    } else {
      // Becoming hidden - hide first, then unmount
      setInternalVisible(false);
      activeModals.delete(id);
      console.log(`[Modal:${id}] HIDDEN (caller: ${caller}), active: ${activeModals.size}`);

      // Delay unmounting to allow native cleanup
      const timer = setTimeout(() => {
        if (mounted.current) {
          setShouldRender(false);
        }
        // TODO: 300ms is a lot, no? Cant we use less ms?
      }, 300); // 300ms is usually enough for native cleanup

      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    const id = instanceId.current;
    return () => {
      activeModals.delete(id);
      console.log(`[Modal:${id}] UNMOUNTED, active: ${activeModals.size}`);
    };
  }, []);

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
