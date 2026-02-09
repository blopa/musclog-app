import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

import { useTheme } from '../hooks/useTheme';

type GradientTextProps = {
  colors: readonly [string, string, ...string[]];
  style?: any;
  children: ReactNode;
};

export function GradientText({ colors, style, children }: GradientTextProps) {
  const theme = useTheme();
  // For web, use a CSS-based approach with inline styles
  if (Platform.OS === 'web') {
    // const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;
    const gradientStops = colors
      .map((color, index) => {
        const offset = (index / (colors.length - 1)) * 100;
        return `${color} ${offset}%`;
      })
      .join(', ');

    return (
      <Text
        style={[
          style,
          {
            background: `linear-gradient(to right, ${gradientStops})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          },
        ]}
      >
        {children}
      </Text>
    );
  }

  // For native platforms, use MaskedView
  return (
    <MaskedView
      style={StyleSheet.flatten([{ flexDirection: 'row' }, style])}
      maskElement={
        <Text
          style={[
            style,
            {
              backgroundColor: 'transparent',
              color: theme.colors.text.black,
            },
          ]}
        >
          {children}
        </Text>
      }
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[style, { opacity: theme.colors.opacity.zero }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
