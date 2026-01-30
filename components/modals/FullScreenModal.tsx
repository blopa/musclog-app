import React, { ReactNode } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { addOpacityToHex, theme } from '../../theme';

type FullScreenModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
  withGradient?: boolean;
  showHeader?: boolean;
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
  withGradient = false,
  showHeader = true,
}: FullScreenModalProps) {
  const insets = useSafeAreaInsets();
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
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      <View
        className="flex-1 bg-bg-primary"
        style={[
          webModalStyle,
          {
            paddingTop: Platform.OS !== 'web' ? insets.top : 0,
            paddingBottom: Platform.OS !== 'web' ? insets.bottom : 0,
          },
        ]}
      >
        {/* Header */}
        {showHeader ? (
          <View className="border-b border-border-light bg-bg-primary">
            <LinearGradient
              colors={
                withGradient
                  ? [theme.colors.status.purple40, theme.colors.accent.secondary10, 'transparent']
                  : ['transparent', 'transparent']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="flex-row items-center gap-4 px-4 py-4"
            >
              <Pressable className="-ml-2 rounded-full p-2" onPress={onClose}>
                <ArrowLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
              </Pressable>
              <View className="flex-1">
                <Text className="text-xl font-bold tracking-tight text-text-primary">{title}</Text>
                {subtitle ? (
                  <Text className="mt-0.5 text-sm font-normal text-text-secondary">{subtitle}</Text>
                ) : null}
              </View>
              {headerRight ? <View className="-mr-2">{headerRight}</View> : null}
            </LinearGradient>
          </View>
        ) : null}

        {/* Content area */}
        <View className="flex-1">
          {scrollable ? (
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              style={webScrollViewStyle}
              contentContainerStyle={{
                paddingBottom: footer ? theme.spacing.padding['4xl'] : theme.spacing.padding.lg,
              }}
            >
              {children}
            </ScrollView>
          ) : (
            <View className="flex-1">{children}</View>
          )}

          {/* optional footer */}
          {footer ? (
            <View
              className="absolute bottom-0 left-0 right-0"
              style={{
                paddingBottom: Platform.OS === 'web' ? theme.spacing.padding.lg : insets.bottom,
                paddingHorizontal: theme.spacing.padding.zero,
                backgroundColor: 'transparent',
              }}
            >
              <LinearGradient
                colors={[
                  theme.colors.background.primary,
                  addOpacityToHex(theme.colors.background.primary, theme.colors.opacity.subtle),
                  'transparent',
                ]}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
              >
                <View className="px-6 pb-6 pt-6">{footer}</View>
              </LinearGradient>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
