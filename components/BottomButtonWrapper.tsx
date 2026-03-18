import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import { addOpacityToHex } from '../theme';

type BottomButtonWrapperProps = {
  children: ReactNode;
  effect?: 'gradient' | 'blur';
};

export function BottomButtonWrapper({ effect = 'gradient', children }: BottomButtonWrapperProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const renderContent = () => (
    <View
      className="px-6 pb-6 pt-6"
      style={{
        paddingBottom: insets.bottom || theme.spacing.padding.lg,
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
    <View className="absolute bottom-0 left-0 right-0" style={wrapperStyle}>
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
