import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { ReactNode, RefObject, useRef } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { Modal } from '@/components/theme/Modal';
import { useTheme } from '@/hooks/useTheme';
import { useWebModalLayerStyle } from '@/utils/webPhoneFrame';

type FullScreenModalProps = {
  visible: boolean;
  onClose: () => void;
  onShow?: () => void;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
  withGradient?: boolean;
  showHeader?: boolean;
  closable?: boolean;
  scrollViewRef?: RefObject<ScrollView | null>;
};

export function FullScreenModal({
  visible,
  onClose,
  onShow,
  title,
  subtitle,
  headerRight,
  children,
  scrollable = true,
  footer,
  withGradient = false,
  showHeader = true,
  closable = true,
  scrollViewRef,
}: FullScreenModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const webModalStyle = useWebModalLayerStyle({ variant: 'fullscreen' });

  // Force remount of Modal when visibility changes to prevent "ghost" native window
  // that captures touches. See: https://github.com/facebook/react-native/issues/29455
  const modalKeyRef = useRef<string>('modal-hidden');
  if (visible && modalKeyRef.current === 'modal-hidden') {
    // Only regenerate key when transitioning from hidden to visible
    modalKeyRef.current = `modal-${Date.now()}`;
  } else if (!visible) {
    modalKeyRef.current = 'modal-hidden';
  }

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
      key={Platform.OS !== 'web' ? modalKeyRef.current : undefined}
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={closable ? onClose : undefined}
      onShow={onShow}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      <View
        className="flex-1 bg-bg-primary"
        pointerEvents="auto"
        style={[
          webModalStyle,
          {
            paddingTop: Platform.OS !== 'web' ? insets.top : 0,
            paddingBottom: insets.bottom,
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
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
            >
              {closable ? (
                <Pressable
                  style={{ marginLeft: -8, padding: 8, borderRadius: 9999 }}
                  onPress={onClose}
                  hitSlop={10}
                >
                  <ArrowLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text className="text-xl font-bold tracking-tight text-text-primary">{title}</Text>
                {subtitle ? (
                  <Text className="mt-0.5 text-sm font-normal text-text-secondary">{subtitle}</Text>
                ) : null}
              </View>
              {headerRight ? <View style={{ marginRight: -8 }}>{headerRight}</View> : null}
            </LinearGradient>
          </View>
        ) : null}

        {/* Content area */}
        <View className="flex-1">
          {scrollable ? (
            <ScrollView
              ref={scrollViewRef}
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
            <BottomButtonWrapper>
              {footer}
              <View style={{ height: theme.spacing.margin.base }} />
            </BottomButtonWrapper>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
