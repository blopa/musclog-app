import React, { useEffect, useRef, ReactNode } from 'react';
import { View, Text, Pressable, Modal, Animated } from 'react-native';
import { X } from 'lucide-react-native';
import { theme } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

type FullScreenModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerRight?: ReactNode;
};

export function FullScreenModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  headerRight,
}: FullScreenModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          backgroundColor: theme.colors.background.primary,
        }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Header */}
          <View
            className="flex-row items-center justify-between border-b border-border-dark"
            style={{
              paddingHorizontal: theme.spacing.padding['2xl'],
              paddingVertical: theme.spacing.padding.base,
            }}>
            <View className="flex-1">
              <Text
                className="font-bold text-text-primary"
                style={{ fontSize: theme.typography.fontSize['2xl'] }}>
                {title}
              </Text>
              {subtitle && (
                <Text
                  className="mt-1 text-text-secondary"
                  style={{ fontSize: theme.typography.fontSize.sm }}>
                  {subtitle}
                </Text>
              )}
            </View>
            <View className="flex-row items-center gap-3">
              {headerRight}
              <Pressable
                className="active:bg-bg-card-elevated h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
                onPress={onClose}>
                <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>{children}</View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

