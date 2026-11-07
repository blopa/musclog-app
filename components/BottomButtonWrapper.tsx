import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { addOpacityToHex } from '@/theme';

type BottomButtonWrapperProps = {
  children: ReactNode;
  effect?: 'gradient' | 'blur';
  /** Reports the bar's height, so a body that scrolls beneath it can pad by exactly that much. */
  onHeightChange?: (height: number) => void;
};

export function BottomButtonWrapper({
  effect = 'gradient',
  children,
  onHeightChange,
}: BottomButtonWrapperProps) {
  const theme = useTheme();

  const renderContent = () => (
    <View
      className="px-6 pb-6 pt-6"
      style={{
        // On web the outer FullScreenModal container already applies paddingBottom: insets.bottom
        // (via viewport-fit=cover + useSafeAreaInsets), so only add extra visual breathing room here.
        // On native the outer container also applies insets.bottom, so no extra padding needed.
        paddingBottom: Platform.OS === 'web' ? theme.spacing.padding.lg : 0,
      }}
    >
      {children}
    </View>
  );

  const wrapperStyle = {
    paddingBottom: theme.spacing.padding.zero,
    paddingHorizontal: theme.spacing.padding.zero,
    backgroundColor: 'transparent',
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0"
      style={wrapperStyle}
      onLayout={
        onHeightChange ? (event) => onHeightChange(event.nativeEvent.layout.height) : undefined
      }
    >
      {effect === 'blur' ? (
        <BlurView intensity={60} tint="dark" className="w-full">
          {renderContent()}
        </BlurView>
      ) : (
        <LinearGradient
          colors={[
            theme.colors.background.primary,
            addOpacityToHex(theme.colors.background.primary, theme.colors.opacity.full),
            addOpacityToHex(theme.colors.background.primary, theme.colors.opacity.full),
            addOpacityToHex(theme.colors.background.primary, theme.colors.opacity.subtle),
          ]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
        >
          {renderContent()}
        </LinearGradient>
      )}
    </View>
  );
}
