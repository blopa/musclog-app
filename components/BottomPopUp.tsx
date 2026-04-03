import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableWithoutFeedback, // it's deprecated, but using Pressable instead causes a gap below the modal on mobile
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import { useWebModalLayerStyle } from '../utils/webPhoneFrame';
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

  const slideAnim = useRef(new Animated.Value(theme.size['300'])).current; // Start off-screen
  /** Lifts the sheet when the keyboard opens so focused inputs stay visible (half keyboard height). */
  const [keyboardBottomLift, setKeyboardBottomLift] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardBottomLift(0);
    }
  }, [visible]);

  useEffect(() => {
    if (Platform.OS === 'web' || !visible) {
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates: { height: number } }) => {
      setKeyboardBottomLift(Math.max(0, e.endCoordinates.height) / 2);
    };
    const onHide = () => setKeyboardBottomLift(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

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
              { backgroundColor: theme.colors.overlay.black60 },
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
            className="border-t border-border-dark"
            style={[
              {
                transform: [{ translateY: slideAnim }],
                backgroundColor: theme.colors.background.cardElevated,
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
            <LinearGradient
              colors={[
                theme.colors.status.purple40,
                theme.colors.accent.secondary10,
                'transparent',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="border-b border-border-dark"
            >
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
            </LinearGradient>

            {/* Content */}
            {children ? (
              scrollable ? (
                <ScrollView
                  className="p-6"
                  style={!footer ? { paddingBottom: contentBottomPadding } : undefined}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {children}
                </ScrollView>
              ) : (
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
              )
            ) : null}

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
  );
}
