import React, { useEffect, useRef, ReactNode } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  Platform,
  TouchableWithoutFeedback, // it's deprecated, but using Pressable instead causes a gap below the modal on mobile
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { theme } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

type BottomPopUpProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  maxHeight?: number | 'auto' | `${number}%`;
  headerIcon?: ReactNode;
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
}: BottomPopUpProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(theme.size['300'])).current; // Start off-screen

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
  }, [visible, slideAnim]);

  // Web-specific styles for proper viewport positioning
  const webBackdropStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
        } as any)
      : {};

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          className="flex-1"
          style={[{ backgroundColor: theme.colors.overlay.black60 }, webBackdropStyle]}
        >
          <View
            className="flex-1 justify-end"
            style={
              Platform.OS === 'web'
                ? { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }
                : undefined
            }
          >
            {/* Modal Content */}
            <TouchableWithoutFeedback>
              <Animated.View
                className="border-t border-border-dark"
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                style={{
                  transform: [{ translateY: slideAnim }],
                  backgroundColor: theme.colors.background.cardElevated,
                  overflow: 'hidden',
                  borderTopLeftRadius: theme.borderRadius['3xl'],
                  borderTopRightRadius: theme.borderRadius['3xl'],
                  maxHeight: maxHeight || '90%',
                  width: '100%',
                }}
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
                    <Pressable
                      className="active:bg-bg-card-elevated h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
                      onPress={onClose}
                    >
                      <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
                    </Pressable>
                  </View>
                </LinearGradient>

                {/* Content */}
                {children ? (
                  <View
                    className="p-6"
                    style={
                      !footer
                        ? { paddingBottom: Math.max(insets.bottom, theme.spacing.padding.xl) }
                        : undefined
                    }
                  >
                    {children}
                  </View>
                ) : null}

                {/* Footer */}
                {footer ? (
                  <View
                    className="border-t border-border-dark px-6 pt-2"
                    style={{
                      paddingBottom: Math.max(insets.bottom, theme.spacing.padding.xl),
                    }}
                  >
                    {footer}
                  </View>
                ) : null}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
