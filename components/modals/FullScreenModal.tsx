import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { ReactNode, RefObject, useLayoutEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import { SwipeToReturnWrapper } from '@/components/SwipeToReturnWrapper';
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
  scrollViewRef?: RefObject<KeyboardAwareScrollViewRef | null>;
  showConfetti?: boolean;
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
  showConfetti = false,
}: FullScreenModalProps) {
  const theme = useTheme();
  const webModalStyle = useWebModalLayerStyle({ variant: 'fullscreen' });

  // Force remount of Modal when visibility changes to prevent "ghost" native window
  // that captures touches. See: https://github.com/facebook/react-native/issues/29455
  const [modalInstance, setModalInstance] = useState(0);
  const wasVisibleRef = useRef(visible);

  useLayoutEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setModalInstance((current) => current + 1);
    }

    wasVisibleRef.current = visible;
  }, [visible]);

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
      key={Platform.OS !== 'web' ? `modal-${modalInstance}` : undefined}
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={closable ? onClose : undefined}
      onShow={onShow}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      <SafeAreaView
        edges={Platform.OS !== 'web' ? ['top', 'bottom'] : []}
        className="flex-1 bg-bg-primary"
        style={webModalStyle}
      >
        <SwipeToReturnWrapper
          onClose={onClose}
          enabled={closable}
          className="flex-1"
          pointerEvents="auto"
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
                    style={{ padding: 12, borderRadius: 9999 }}
                    onPress={onClose}
                    hitSlop={12}
                  >
                    <ArrowLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
                  </Pressable>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text className="text-xl font-bold tracking-tight text-text-primary">
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text className="mt-0.5 text-sm font-normal text-text-secondary">
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                {headerRight ? <View>{headerRight}</View> : null}
              </LinearGradient>
            </View>
          ) : null}

          {/* Content area */}
          <View className="flex-1" pointerEvents="box-none">
            {scrollable ? (
              <KeyboardAwareScrollView
                ref={scrollViewRef}
                className="flex-1"
                showsVerticalScrollIndicator={false}
                style={webScrollViewStyle}
                contentContainerStyle={{
                  paddingBottom: footer ? theme.spacing.padding['4xl'] : theme.spacing.padding.lg,
                }}
                bottomOffset={16}
              >
                {children}
              </KeyboardAwareScrollView>
            ) : (
              <View className="flex-1" pointerEvents="auto">
                {children}
              </View>
            )}

            {/* optional footer */}
            {footer ? (
              <BottomButtonWrapper>
                {footer}
                <View style={{ height: theme.spacing.margin.base }} />
              </BottomButtonWrapper>
            ) : null}
          </View>
        </SwipeToReturnWrapper>
      </SafeAreaView>
      {showConfetti ? <ConfettiOverlay /> : null}
    </Modal>
  );
}
