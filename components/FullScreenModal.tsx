import React, { ReactNode } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Platform } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from '../theme';

type FullScreenModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
};

export function FullScreenModal({
  visible,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  scrollable = true,
  footer,
}: FullScreenModalProps) {
  // Web-specific styles for proper viewport positioning
  const webModalStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          // Prevent browser swipe-to-go-back gesture
          touchAction: 'pan-y',
        } as any)
      : {};

  // Web-specific ScrollView styles to prevent browser gestures
  const webScrollViewStyle =
    Platform.OS === 'web'
      ? ({
          // Allow vertical scrolling but prevent horizontal browser gestures
          touchAction: 'pan-y',
        } as any)
      : {};

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}>
      <View className="flex-1 bg-bg-primary" style={webModalStyle}>
        {/* Header */}
        <View className="flex-row items-center gap-4 border-b border-border-light bg-bg-primary px-4 py-4">
          <Pressable className="-ml-2 rounded-full p-2" onPress={onClose}>
            <ArrowLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold tracking-tight text-text-primary">{title}</Text>
            {subtitle && <Text className="mt-0.5 text-sm text-text-secondary">{subtitle}</Text>}
          </View>
          {headerRight && <View className="-mr-2">{headerRight}</View>}
        </View>

        {/* Content area + optional footer */}
        <View className="flex-1">
          {scrollable ? (
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              style={webScrollViewStyle}
              contentContainerStyle={{ paddingBottom: footer ? 120 : 20 }}>
              {children}
            </ScrollView>
          ) : (
            <View className="flex-1">{children}</View>
          )}

          {footer && (
            <View
              className="absolute bottom-0 left-0 right-0"
              style={{
                paddingBottom: Platform.OS === 'ios' ? 24 : 12,
                paddingHorizontal: 0,
                backgroundColor: 'transparent',
              }}>
              {footer}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
