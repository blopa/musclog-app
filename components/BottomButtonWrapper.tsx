import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { addOpacityToHex, theme } from '../theme';

type BottomButtonWrapperProps = {
  children: ReactNode;
};

export function BottomButtonWrapper({ children }: BottomButtonWrapperProps) {
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
          addOpacityToHex(theme.colors.background.primary, theme.colors.opacity.full),
          addOpacityToHex(theme.colors.background.primary, theme.colors.opacity.full),
          addOpacityToHex(theme.colors.background.primary, theme.colors.opacity.subtle),
        ]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
      >
        <View
          className="px-6 pb-6 pt-6"
          style={{
            paddingBottom: Platform.OS === 'web' ? theme.spacing.padding.lg : 0,
          }}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}
