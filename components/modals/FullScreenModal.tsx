import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { ReactNode, RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../hooks/useTheme';
import { BottomButtonWrapper } from '../BottomButtonWrapper';

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
          // dvh (dynamic viewport height) always equals the *current* visible
          // height — it shrinks when Chrome's address bar is visible, unlike
          // 100vh which is the *large* (address-bar-hidden) viewport height.
          // Using 100vh causes the modal to be taller than the screen when the
          // address bar is shown, pushing the bottom button below the fold.
          height: '100dvh',
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
              className="flex-row items-center gap-4 px-4 py-4"
            >
              {closable ? (
                <Pressable className="-ml-2 rounded-full p-2" onPress={onClose} hitSlop={10}>
                  <ArrowLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
                </Pressable>
              ) : null}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View className="flex-1">
            {scrollable ? (
              <ScrollView
                ref={scrollViewRef}
                className="flex-1"
                showsVerticalScrollIndicator={false}
                style={webScrollViewStyle}
                keyboardShouldPersistTaps="handled"
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
