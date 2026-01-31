import React, { ReactNode } from 'react';
import { View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { addOpacityToHex, theme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomButtonWrapperProps = {
  children: ReactNode;
};

export function BottomButtonWrapper({ children }: BottomButtonWrapperProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute bottom-0 left-0 right-0"
      style={{
        paddingBottom: 0,
        paddingHorizontal: theme.spacing.padding.zero,
        backgroundColor: 'transparent',
      }}
    >
      <LinearGradient
        colors={[
          theme.colors.background.primary,
          addOpacityToHex(theme.colors.background.primary, theme.colors.opacity.medium),
          addOpacityToHex(theme.colors.background.primary, theme.colors.opacity.ultra),
        ]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
      >
        <View
          className="px-6 pb-6 pt-6"
          style={{
            paddingBottom: Platform.OS === 'web' ? theme.spacing.padding.lg : insets.bottom,
          }}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}
