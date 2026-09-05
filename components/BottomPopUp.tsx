import { X } from 'lucide-react-native';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput as RNTextInput,
  TouchableWithoutFeedback, // it's deprecated, but using Pressable instead causes a gap below the modal on mobile
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { computeKeyboardSheetLift } from '@/components/keyboardSheetLift';
import { sheetSurfaceColor } from '@/components/sheetSurfaceColor';
import { SurfaceColorProvider } from '@/context/SurfaceColorContext';
import { useTheme } from '@/hooks/useTheme';
import { useWebModalLayerStyle } from '@/utils/webPhoneFrame';

import { Modal } from './theme/Modal';

type BottomPopUpProps = {
  visible: boolean;
  onClose?: () => void;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  maxHeight?: number | 'auto' | `${number}%`;
  headerIcon?: ReactNode;
  /** When false, children are not wrapped in ScrollView; use for custom layout with sticky header + scrollable body */
  scrollable?: boolean;
};

export function BottomPopUp({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeight,
  headerIcon,
  scrollable = true,
}: BottomPopUpProps) {
  // On Android, flex:1 children require a definite parent height — maxHeight alone is not enough.
  // When scrollable=false (custom sticky-header + inner ScrollView layout), set an explicit height
  // so the content view can actually expand.
  const effectiveMaxHeight = maxHeight ?? '90%';
  const sheetHeightStyle =
    !scrollable && Platform.OS !== 'web' ? { height: effectiveMaxHeight } : undefined;

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  /** Published to descendants so content can fade out to the real surface behind it. */
  const sheetSurfaceColorValue = sheetSurfaceColor(theme);
  /**
   * Android: `Modal` + edge-to-edge often reports `insets.bottom === 0` while the sheet is still laid out
   * to the physical screen bottom behind the system nav bar. Padding inside ScrollView does not move the
   * sheet — use bottom margin on the sheet so the whole panel sits above the nav bar.
   *
   * Use max(insets, 3xl): when insets are wrong in a Modal, 48dp still clears the typical 3-button bar.
   */
  const androidSheetBottomMargin =
    Platform.OS === 'android' ? Math.max(insets.bottom, theme.spacing.padding['3xl']) : 0;

  /** Insets for scroll/footer padding (iOS home indicator; Android clearance is the sheet margin above). */
  const contentBottomPadding =
    Platform.OS === 'android'
      ? theme.spacing.padding.xl
      : Math.max(insets.bottom, theme.spacing.padding.xl);

  const renderContent = () => {
    if (!children) {
      return null;
    }

    if (scrollable) {
      return (
        <ScrollView
          className="p-6"
          // Bottom padding belongs on the content container, not the frame: on the frame it
          // shrinks the scrollable viewport instead of scrolling with the content. A footer
          // renders its own inset clearance below, so the content only needs breathing room.
          contentContainerStyle={{
            paddingBottom: footer ? theme.spacing.padding.lg : contentBottomPadding,
          }}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      );
    }

    return (
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.padding.xl,
          paddingTop: theme.spacing.padding.xl,
          paddingBottom: contentBottomPadding,
        }}
      >
        {children}
      </View>
    );
  };

  const [slideAnim] = useState(() => new Animated.Value(theme.size['300']));
  const sheetRef = useRef<View>(null);
  const [rawKeyboardBottomLift, setKeyboardBottomLift] = useState(0);
  // Derive: when the sheet is not visible the lift is always 0
  const keyboardBottomLift = visible ? rawKeyboardBottomLift : 0;

  /** Highest the sheet's top may go — above this its header would leave the screen. */
  const minSheetTop = Math.max(insets.top, theme.spacing.padding.md);
  /** Breathing room kept between the focused input and the keyboard. */
  const inputGap = theme.spacing.padding.base;

  useEffect(() => {
    if (Platform.OS === 'web' || !visible) {
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates: { screenY: number; height: number } }) => {
      // screenY is the keyboard's top edge in absolute screen coordinates — same space
      // as measureInWindow, so no window-vs-screen height mismatch on Android.
      const keyboardTop = e.endCoordinates.screenY;
      // The sheet is bottom-anchored, so its resting bottom edge is a known constant:
      // `androidSheetBottomMargin` above the screen bottom. Deriving it that way instead of
      // measuring keeps every input to computeKeyboardSheetLift in resting coordinates —
      // the sheet's *measured* position already includes whatever lift is currently applied
      // (and, mid slide-in, the animated translateY), which would otherwise have to be
      // corrected for against layout that updates a frame behind this callback.
      const sheetBottom = keyboardTop + e.endCoordinates.height - androidSheetBottomMargin;
      const sheet = sheetRef.current;

      if (!sheet) {
        // Nothing to measure: fall back to the lift a full-height sheet would need, which is
        // exactly the identity above with the header cap and focused input left out.
        setKeyboardBottomLift(Math.max(0, sheetBottom - keyboardTop));
        return;
      }

      /**
       * @param sheetHeight
       * @param inputBottomInSheet Bottom edge of the focused input as an offset from the sheet's
       * top edge, or null when nothing is focused.
       */
      const applyLift = (sheetHeight: number, inputBottomInSheet: null | number) => {
        const sheetTop = sheetBottom - sheetHeight;
        setKeyboardBottomLift(
          computeKeyboardSheetLift({
            focusedInputBottom: inputBottomInSheet === null ? null : sheetTop + inputBottomInSheet,
            inputGap,
            keyboardTop,
            minSheetTop,
            sheetHeight,
            sheetTop,
          })
        );
      };

      const focusedInput = RNTextInput.State.currentlyFocusedInput();

      sheet.measureInWindow((_x, sheetY, _w, sheetHeight) => {
        if (!focusedInput) {
          applyLift(sheetHeight, null);
          return;
        }

        // measureInWindow is available on the native host ref at runtime;
        // RN's declared instance type doesn't expose it directly.
        (focusedInput as any).measureInWindow((_ix: number, y: number, _iw: number, h: number) => {
          // Both measurements come from the same pass, so whatever lift is currently applied
          // cancels in the difference and the offset is already a resting-coordinate value.
          applyLift(sheetHeight, y - sheetY + h);
        });
      });
    };

    const onHide = () => setKeyboardBottomLift(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible, androidSheetBottomMargin, minSheetTop, inputGap]);

  useEffect(() => {
    if (visible) {
      // Slide up when modal becomes visible
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      // Slide down when modal is hidden
      Animated.timing(slideAnim, {
        toValue: theme.size['300'],
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, theme.size]);

  const webBackdropStyle = useWebModalLayerStyle({ variant: 'fullscreen' });

  return (
    <SurfaceColorProvider color={sheetSurfaceColorValue}>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => onClose?.()}
        statusBarTranslucent={Platform.OS !== 'web'}
      >
        <View
          className="flex-1"
          style={[{ backgroundColor: 'transparent' }, webBackdropStyle]}
          pointerEvents="box-none"
        >
          {/* Backdrop: sibling behind content so taps on content hit content first (fixes Android menu taps) */}
          <TouchableWithoutFeedback onPress={() => onClose?.()}>
            <View
              style={[
                { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
                { backgroundColor: theme.colors.overlay.scrim60 },
              ]}
            />
          </TouchableWithoutFeedback>
          {/* Content: sibling on top so hit-testing delivers touches to Pressables inside */}
          <View
            className="flex-1 justify-end"
            style={
              Platform.OS === 'web'
                ? { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }
                : undefined
            }
            pointerEvents="box-none"
          >
            <Animated.View
              ref={sheetRef}
              className="border-t border-border-dark"
              style={[
                {
                  transform: [{ translateY: slideAnim }],
                  backgroundColor: sheetSurfaceColorValue,
                  overflow: 'hidden',
                  borderTopLeftRadius: theme.borderRadius['3xl'],
                  borderTopRightRadius: theme.borderRadius['3xl'],
                  maxHeight: effectiveMaxHeight,
                  width: '100%',
                  marginBottom: androidSheetBottomMargin + keyboardBottomLift,
                },
                sheetHeightStyle,
              ]}
            >
              {/* Header */}
              <View className="border-b border-border-dark">
                <View className="flex-row items-center justify-between p-6">
                  <View className="flex-1 flex-row items-center gap-3">
                    {headerIcon ? <View>{headerIcon}</View> : null}
                    <View className="flex-1">
                      <Text className="text-2xl font-bold text-text-primary">{title}</Text>
                      {subtitle ? (
                        <Text className="mt-1 text-sm text-text-secondary">{subtitle}</Text>
                      ) : null}
                    </View>
                  </View>
                  {onClose ? (
                    <Pressable
                      className="active:bg-bg-card-elevated h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
                      onPress={() => onClose?.()}
                      {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
                    >
                      <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Content */}
              {renderContent()}

              {/* Footer */}
              {footer ? (
                <View
                  className="border-t border-border-dark px-6 pt-2"
                  style={{
                    paddingBottom: contentBottomPadding,
                  }}
                >
                  {footer}
                </View>
              ) : null}
            </Animated.View>
          </View>
        </View>
      </Modal>
    </SurfaceColorProvider>
  );
}
